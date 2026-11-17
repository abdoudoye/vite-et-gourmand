"use strict";

const { randomUUID } = require("node:crypto");
const { OrderError, fail, addressKey, validateOrder, priceOrder, menuFingerprint, hash } = require("./order-rules.js");
const { SESSION_DURATION } = require("./auth-session.js");
const UUID = /^[a-f0-9]{8}-[a-f0-9]{4}-[1-5][a-f0-9]{3}-[89ab][a-f0-9]{3}-[a-f0-9]{12}$/i;
const validId = (id) => typeof id === "string" && /^[1-9]\d{0,18}$/.test(id) && BigInt(id) <= 9223372036854775807n;
const MENU_SQL = "SELECT * FROM vg.menus WHERE id=$1 AND archived_at IS NULL AND is_demo=true";
const CLIENT_SQL = "SELECT id::text,first_name,last_name,email,phone,role_code,is_active,deactivated_at FROM vg.users WHERE id=$1";
const ORDER_SELECT = `SELECT o.id::text,o.reference,o.status_code AS status,s.label AS "statusLabel",
  o.service_date::text AS "serviceDate",o.delivery_at AS "deliveryAt",o.delivery_street AS street,
  o.delivery_additional_line AS "additionalLine",o.delivery_postal_code AS "postalCode",o.delivery_city AS city,
  o.delivery_country_code AS "countryCode",i.menu_id::text AS "menuId",i.menu_title_snapshot AS "menuTitle",
  i.people_count AS people,i.gross_amount_cents AS "grossCents",i.discount_cents AS "discountCents",
  o.delivery_fee_cents AS "deliveryCents",t.total_cents::text AS "totalCents",
  COALESCE((SELECT jsonb_agg(jsonb_build_object('status',h.status_code,'date',h.changed_at) ORDER BY h.changed_at,h.id)
    FROM vg.order_status_history h WHERE h.order_id=o.id),'[]'::jsonb) AS history
  FROM vg.orders o JOIN vg.order_items i ON i.order_id=o.id JOIN vg.order_totals t ON t.order_id=o.id
  JOIN vg.order_statuses s ON s.code=o.status_code WHERE o.user_id=$1`;

async function clientFor(query, id) {
  const user = (await query(CLIENT_SQL, [id])).rows[0];
  if (!user || !user.is_active || user.role_code !== "utilisateur" || user.deactivated_at !== null) fail("Authentification requise.", 401);
  return user;
}
async function menuFor(query, id, lock = false) {
  const menu = (await query(MENU_SQL + (lock ? " FOR UPDATE" : ""), [id])).rows[0];
  if (!menu) fail("Menu introuvable.", 404);
  return menu;
}
async function verifiedDistance(query, data) {
  const row = (await query(`SELECT distance_km::text,source_reference,expires_at FROM vg.delivery_distances
    WHERE address_key=$1 AND expires_at>now()`, [addressKey(data)])).rows[0];
  return row ? { milliKm: Math.round(Number(row.distance_km) * 1000), source: row.source_reference, expiresAt: row.expires_at } : null;
}
const dto = (row) => ({ ...row, menuId: Number(row.menuId), totalCents: Number(row.totalCents) });
async function orderFor(query, userId, id) {
  const row = (await query(ORDER_SELECT + " AND o.id=$2", [userId, id])).rows[0];
  if (!row) fail("Commande introuvable.", 404);
  return dto(row);
}
async function editable(query, userId, id, lock = false) {
  if (!validId(String(id))) fail("Commande introuvable.", 404);
  const order = (await query("SELECT id::text,status_code FROM vg.orders WHERE id=$1 AND user_id=$2" + (lock ? " FOR UPDATE" : ""), [id,userId])).rows[0];
  if (!order) fail("Commande introuvable.", 404);
  if (order.status_code !== "en_attente") fail("Cette commande ne peut plus être modifiée ou annulée.", 409);
  return (await query("SELECT * FROM vg.order_items WHERE order_id=$1", [id])).rows[0];
}
const editingMenu = (menu, item) => item ? { ...menu, minimum_people: item.minimum_people_snapshot, base_price_cents: item.base_price_cents_snapshot,
  order_conditions: item.order_conditions_snapshot, storage_conditions: item.storage_conditions_snapshot, stock_available: 1 } : menu;
async function insert(query, table, columns, values) {
  return query(`INSERT INTO vg.${table} (${columns.join(",")}) VALUES (${values.map((_, index) => "$" + (index + 1)).join(",")}) RETURNING id::text`, values);
}

function orderHandlers({ database, config, mailer = null, now = Date.now }) {
  const query = (...args) => database.query(...args);
  const route = (work) => async (req, res) => {
    try {
      if (!req.session?.userId || !Number.isFinite(req.session.loggedAt) || now() - req.session.loggedAt >= SESSION_DURATION) fail("Authentification requise.", 401);
      if (!database) fail("Commandes indisponibles.", 503);
      req.customer = await clientFor(query, req.session.userId);
      await work(req, res);
    } catch (error) {
      res.status(error instanceof OrderError ? error.status : 503).json({ error: error instanceof OrderError ? error.message : "Commandes indisponibles. Réessayez plus tard." });
    }
  };
  return {
    checkout: route(async (req, res) => {
      if (typeof req.query.menu !== "string" || !/^[1-9]\d*$/.test(req.query.menu) || !Number.isSafeInteger(Number(req.query.menu))) fail("Menu invalide.");
      const menu = await menuFor(query, req.query.menu);
      const item = req.query.order ? await editable(query, req.customer.id, req.query.order) : null;
      if (item && Number(item.menu_id) !== Number(menu.id)) fail("Le menu d’une commande ne peut pas être changé.", 409);
      const selected = editingMenu(menu, item);
      const address = (await query(`SELECT street,additional_line AS "additionalLine",postal_code AS "postalCode",city,country_code AS "countryCode"
        FROM vg.addresses WHERE user_id=$1 AND archived_at IS NULL ORDER BY is_default DESC,id LIMIT 1`, [req.customer.id])).rows[0] || null;
      const user = req.customer;
      res.json({ customer: { firstName: user.first_name, lastName: user.last_name, email: user.email, phone: user.phone }, address,
        menu: { id: Number(menu.id), title: menu.title, minimumPeople: selected.minimum_people, basePriceCents: selected.base_price_cents, stock: selected.stock_available,
          orderConditions: selected.order_conditions, storageConditions: selected.storage_conditions, noticeHours: menu.notice_hours },
        editing: item ? await orderFor(query, user.id, req.query.order) : null,
        pricing: config.pricing, termsVersion: config.termsVersion });
    }),
    quote: route(async (req, res) => {
      const data = validateOrder(req.body);
      const menu = await menuFor(query, data.menuId);
      const editOrderId = req.params.id || null;
      const item = editOrderId ? await editable(query, req.customer.id, editOrderId) : null;
      if (item && Number(item.menu_id) !== data.menuId) fail("Le menu d’une commande ne peut pas être changé.", 409);
      const selected = editingMenu(menu, item);
      const distance = await verifiedDistance(query, data);
      const calculation = priceOrder(selected, data, config, distance, now());
      const id = randomUUID();
      const expiresAt = new Date(now() + 15 * 60000).toISOString();
      const payload = { data, calculation, editOrderId, editFingerprint: editOrderId ? hash(await orderFor(query, req.customer.id, editOrderId)) : null, fingerprint: menuFingerprint(selected) };
      await query("INSERT INTO vg.order_quotes(id,user_id,payload,expires_at) VALUES($1,$2,$3::jsonb,$4)", [id, req.customer.id, JSON.stringify(payload), expiresAt]);
      res.json({ quoteId: id, expiresAt, ...calculation });
    }),
    create: route(async (req, res) => {
      const { quoteId: rawQuoteId, idempotencyKey: rawKey } = req.body || {};
      if (typeof rawQuoteId !== "string" || typeof rawKey !== "string" || !UUID.test(rawQuoteId) || !UUID.test(rawKey)) fail("Confirmation invalide.");
      // PostgreSQL normalise les UUID ; comparer leurs formes canoniques aussi en JS.
      const quoteId = rawQuoteId.toLowerCase();
      const idempotencyKey = rawKey.toLowerCase();
      if (typeof database.transaction !== "function") fail("Transactions indisponibles.", 503);
      const result = await database.transaction(async (tx) => {
        const q = (sql, values) => tx.query(sql, values);
        // Toutes les confirmations d'un même client sont sérialisées entre processus.
        await q("SELECT pg_advisory_xact_lock(7911,hashtext($1))", [req.customer.id]);
        const customer = await clientFor(q, req.customer.id);
        const existing = (await q(`SELECT quote_id::text,idempotency_key::text,order_id::text FROM vg.order_receipts
          WHERE user_id=$1 AND (idempotency_key=$2 OR quote_id=$3)`, [customer.id, idempotencyKey, quoteId])).rows;
        if (existing.length) {
          if (existing.some((row) => row.quote_id !== quoteId)) fail("Cette clé a déjà été utilisée pour une autre confirmation.", 409);
          if (existing.some((row) => row.idempotency_key !== idempotencyKey)) fail("Ce devis a déjà été confirmé avec une autre clé d’idempotence.", 409);
          return { order: await orderFor(q, customer.id, existing[0].order_id), replayed: true };
        }
        const quote = (await q("SELECT payload,expires_at FROM vg.order_quotes WHERE id=$1 AND user_id=$2", [quoteId, customer.id])).rows[0];
        if (!quote) fail("Devis introuvable.", 404);
        if (new Date(quote.expires_at).getTime() <= now()) fail("Le devis a expiré. Recalculez le prix.", 409);
        const { data, calculation, fingerprint, editOrderId, editFingerprint } = quote.payload;
        const item = editOrderId ? await editable(q, customer.id, editOrderId, true) : null;
        if (item && hash(await orderFor(q, customer.id, editOrderId)) !== editFingerprint) fail("La commande a changé. Rechargez-la avant de la modifier.", 409);
        if (item && Number(item.menu_id) !== data.menuId) fail("Le menu d’une commande ne peut pas être changé.", 409);
        const menu = await menuFor(q, data.menuId, true);
        const selected = editingMenu(menu, item);
        const fresh = priceOrder(selected, data, config, await verifiedDistance(q, data), now());
        if (menuFingerprint(selected) !== fingerprint || hash(fresh) !== hash(calculation)) fail("Le prix ou les conditions ont changé. Recalculez le devis.", 409);
        if (!item) {
          const reserved = await q("UPDATE vg.menus SET stock_available=stock_available-1 WHERE id=$1 AND stock_available>0 RETURNING id", [data.menuId]);
          if (!reserved.rows.length) fail("Ce menu est épuisé.", 409);
        }
        const reference = "VG-" + randomUUID();
        let orderId;
        if (item) {
          await q(`UPDATE vg.orders SET delivery_street=$1,delivery_additional_line=$2,delivery_postal_code=$3,delivery_city=$4,delivery_country_code=$5,
            service_date=$6,delivery_at=$7,delivery_in_bordeaux=$8,distance_km=$9,distance_source=$10,delivery_fee_cents=$11,
            changed_by_user_id=$12,change_reason='Modification par le client',terms_version=$13,terms_accepted_at=$14 WHERE id=$15 AND user_id=$12`,
          [data.street,data.additionalLine || null,data.postalCode,data.city,data.countryCode,data.serviceDate,data.deliveryAt,fresh.inBordeaux,
            fresh.distanceKm,fresh.distanceSource,fresh.deliveryCents,customer.id,fresh.termsVersion,new Date(now()),editOrderId]);
          await q(`UPDATE vg.order_items SET people_count=$1,gross_amount_cents=$2,pricing_policy=$3,discount_percent=$4,discount_cents=$5 WHERE order_id=$6`,
            [data.people,fresh.grossCents,fresh.pricingPolicy,fresh.discountPercent,fresh.discountCents,editOrderId]);
          orderId = editOrderId;
        } else {
          const created = await insert(q, "orders", ["reference","user_id","customer_first_name","customer_last_name","customer_email","customer_phone",
          "delivery_street","delivery_additional_line","delivery_postal_code","delivery_city","delivery_country_code","service_date","delivery_at",
          "delivery_in_bordeaux","distance_km","distance_source","delivery_fee_cents","status_code","changed_by_user_id","change_reason","terms_version","terms_accepted_at","is_demo"],
        [reference,customer.id,customer.first_name,customer.last_name,customer.email,customer.phone,data.street,data.additionalLine || null,data.postalCode,data.city,data.countryCode,
          data.serviceDate,data.deliveryAt,fresh.inBordeaux,fresh.distanceKm,fresh.distanceSource,fresh.deliveryCents,"en_attente",customer.id,"Création par le client",fresh.termsVersion,new Date(now()),menu.is_demo]);
          orderId = created.rows[0].id;
        await insert(q, "order_items", ["order_id","menu_id","people_count","gross_amount_cents","pricing_policy","discount_percent","discount_cents"],
          [orderId,data.menuId,data.people,fresh.grossCents,fresh.pricingPolicy,fresh.discountPercent,fresh.discountCents]);
        }
        const notification = (await q("INSERT INTO vg.email_outbox(user_id,order_id,kind,recipient) VALUES($1,$2,'confirmation_commande',$3) RETURNING id::text", [customer.id,orderId,customer.email])).rows[0];
        await q("INSERT INTO vg.order_receipts(user_id,idempotency_key,quote_id,order_id) VALUES($1,$2,$3,$4)", [customer.id,idempotencyKey,quoteId,orderId]);
        return { order: await orderFor(q, customer.id, orderId), replayed: false, notification: { id: notification.id, recipient: customer.email } };
      });
      const { notification, ...publicResult } = result;
      let confirmationEmail = "pending";
      // SMTP éventuel APRES COMMIT. En local EMAIL_MODE=disabled => mailer=null.
      if (notification && mailer?.sendOrderConfirmation) {
        try {
          await mailer.sendOrderConfirmation(notification.recipient, result.order);
          await query("UPDATE vg.email_outbox SET status='envoye',sent_at=now(),attempts=attempts+1 WHERE id=$1", [notification.id]);
          confirmationEmail = "sent";
        } catch { /* L'événement reste en attente ; aucune donnée personnelle journalisée. */ }
      }
      res.status(result.replayed ? 200 : 201).json({ ...publicResult, confirmationEmail });
    }),
    list: route(async (req, res) => {
      const offset = req.query.offset === undefined ? "0" : req.query.offset;
      if (typeof offset !== "string" || !/^\d+$/.test(offset) || !Number.isSafeInteger(Number(offset))) fail("Page invalide.");
      res.json((await query(ORDER_SELECT + " ORDER BY o.created_at DESC,o.id DESC LIMIT 50 OFFSET $2", [req.customer.id,Number(offset)])).rows.map(dto));
    }),
    detail: route(async (req, res) => {
      if (!validId(req.params.id)) fail("Commande introuvable.", 404);
      res.json(await orderFor(query, req.customer.id, req.params.id));
    }),
    cancel: route(async (req, res) => {
      const reason = typeof req.body?.reason === "string" ? req.body.reason.trim() : "";
      if (!reason || reason.length > 500 || /[\p{Cc}<>]/u.test(reason)) fail("Indiquez un motif d’annulation (500 caractères maximum).");
      if (!validId(req.params.id)) fail("Commande introuvable.", 404);
      await database.transaction(async (tx) => {
        const q = (sql, values) => tx.query(sql, values);
        await q("SELECT pg_advisory_xact_lock(7911,hashtext($1))", [req.customer.id]);
        await clientFor(q, req.customer.id);
        const order = (await q("SELECT status_code FROM vg.orders WHERE id=$1 AND user_id=$2 FOR UPDATE", [req.params.id,req.customer.id])).rows[0];
        if (!order) fail("Commande introuvable.", 404);
        if (order.status_code === "annulee") return;
        const item = await editable(q, req.customer.id, req.params.id);
        // Toujours la même réservation par commande, quel que soit le nombre de portions.
        await q("UPDATE vg.menus SET stock_available=stock_available+1 WHERE id=$1", [item.menu_id]);
        await q(`UPDATE vg.orders SET status_code='annulee',cancelled_at=$1,cancellation_reason=$2,
          changed_by_user_id=$3,change_reason='Annulation par le client' WHERE id=$4 AND user_id=$3`, [new Date(now()),reason,req.customer.id,req.params.id]);
      });
      res.status(204).end();
    })
  };
}
module.exports = { orderHandlers, MENU_SQL, CLIENT_SQL, ORDER_SELECT };
