"use strict";

const { OrderError, fail } = require("./order-rules.js");
const { SESSION_DURATION } = require("./auth-session.js");
const STATUSES = ["en_attente","accepte","en_preparation","en_livraison","livre","attente_retour_materiel","terminee","annulee","refusee"];
const validId = (id) => typeof id === "string" && /^[1-9]\d{0,18}$/.test(id) && BigInt(id) <= 9223372036854775807n;
const STAFF_SQL = "SELECT id::text,role_code,is_active,deactivated_at FROM vg.users WHERE id=$1";
const SUMMARY_SQL = `SELECT o.id::text,o.reference,o.user_id::text AS "clientId",o.service_date::text AS "serviceDate",
  o.delivery_at AS "deliveryAt",o.status_code AS status,s.label AS "statusLabel",o.is_demo AS "isDemo",
  i.menu_title_snapshot AS "menuTitle",i.people_count AS people,t.total_cents::text AS "totalCents"
  FROM vg.orders o JOIN vg.order_items i ON i.order_id=o.id JOIN vg.order_totals t ON t.order_id=o.id
  JOIN vg.order_statuses s ON s.code=o.status_code`;
const summary = (row) => ({ ...row, totalCents: Number(row.totalCents) });

async function staffFor(query, id) {
  const user = (await query(STAFF_SQL, [id])).rows[0];
  if (!user || !user.is_active || user.deactivated_at !== null) fail("Authentification requise.",401);
  if (!["employe","administrateur"].includes(user.role_code)) fail("Accès réservé aux employés et administrateurs.",403);
  return user;
}

async function detailFor(query, id) {
  const row = (await query(SUMMARY_SQL + " WHERE o.id=$1", [id])).rows[0];
  if (!row) fail("Commande introuvable.",404);
  const details = (await query(`SELECT customer_first_name AS "firstName",customer_last_name AS "lastName",
    customer_email AS email,customer_phone AS phone,delivery_street AS street,delivery_additional_line AS "additionalLine",
    delivery_postal_code AS "postalCode",delivery_city AS city,delivery_country_code AS "countryCode",accepted_at AS "acceptedAt",
    change_reason AS "changeReason",terms_version AS "termsVersion",material_loaned AS "materialLoaned"
    FROM vg.orders WHERE id=$1`, [id])).rows[0];
  const item = (await query(`SELECT gross_amount_cents AS "grossCents",discount_cents AS "discountCents",net_amount_cents AS "menuCents",
    order_conditions_snapshot AS "orderConditions",storage_conditions_snapshot AS "storageConditions"
    FROM vg.order_items WHERE order_id=$1`,[id])).rows[0];
  const history = (await query(`SELECT h.status_code AS status,s.label AS "statusLabel",h.changed_at AS date,
    h.changed_by_user_id::text AS "actorId",h.reason FROM vg.order_status_history h
    JOIN vg.order_statuses s ON s.code=h.status_code WHERE h.order_id=$1 ORDER BY h.changed_at,h.id`,[id])).rows;
  const contacts = (await query(`SELECT contact_method AS method,contacted_at AS date,reason,action,employee_id::text AS "employeeId"
    FROM vg.order_contacts WHERE order_id=$1 ORDER BY contacted_at,id`,[id])).rows;
  return { ...summary(row), ...details, ...item, history, contacts };
}

function validateDecision(body, now) {
  if (!body || !["accepte","refusee"].includes(body.status)) fail("Transition non autorisée.");
  if (body.status === "accepte") return { status:"accepte",reason:"Commande acceptée par l’équipe" };
  const reason = typeof body.reason === "string" ? body.reason.trim() : "";
  const method = body.contact?.method;
  const at = body.contact?.at;
  if (!reason || reason.length > 500 || /[\p{Cc}\p{Cf}<>]/u.test(reason)) fail("Indiquez un motif de refus valide (500 caractères maximum).");
  if (!["telephone","email"].includes(method) || typeof at !== "string" ||
    !/^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}(?:\.\d{3})?Z$/.test(at) || !Number.isFinite(Date.parse(at)) || Date.parse(at) > now) {
    fail("Déclarez le mode et la date du contact préalable avec le client.");
  }
  if (new Date(at).toISOString() !== (at.length === 20 ? at.replace("Z",".000Z") : at)) fail("Date de contact invalide.");
  return { status:"refusee",reason,contact:{method,at:new Date(at).toISOString()} };
}

function employeeOrderHandlers({ database, now = Date.now }) {
  const route = (work) => async (req,res) => {
    try {
      if (!req.session?.userId || !Number.isFinite(req.session.loggedAt) || now()-req.session.loggedAt >= SESSION_DURATION) fail("Authentification requise.",401);
      if (!database) fail("Commandes indisponibles.",503);
      req.staff = await staffFor((...args)=>database.query(...args),req.session.userId);
      await work(req,res);
    } catch(error) {
      res.status(error instanceof OrderError ? error.status : 503).json({ error:error instanceof OrderError ? error.message : "Commandes indisponibles. Réessayez plus tard." });
    }
  };
  return {
    list:route(async(req,res)=>{
      const { status, clientId } = req.query;
      const offset = req.query.offset ?? "0";
      if ((status !== undefined && !STATUSES.includes(status)) || (clientId !== undefined && !validId(clientId)) ||
        typeof offset !== "string" || !/^\d+$/.test(offset) || !Number.isSafeInteger(Number(offset))) fail("Filtres ou page invalides.");
      const rows = (await database.query(SUMMARY_SQL + ` WHERE ($1::text IS NULL OR o.status_code=$1)
        AND ($2::bigint IS NULL OR o.user_id=$2) ORDER BY o.created_at DESC,o.id DESC LIMIT 50 OFFSET $3`,[status || null,clientId || null,Number(offset)])).rows;
      res.json(rows.map(summary));
    }),
    detail:route(async(req,res)=>{
      if (!validId(req.params.id)) fail("Commande introuvable.",404);
      // Lecture cohérente du résumé, de l'historique et des contacts, y compris
      // si une autre requête vient de prendre une décision sur cette commande.
      const result = await database.transaction(async(tx)=>{
        const q=(...args)=>tx.query(...args);
        await staffFor(q,req.staff.id);
        const exists=(await q("SELECT id FROM vg.orders WHERE id=$1 FOR SHARE",[req.params.id])).rows.length;
        if (!exists) fail("Commande introuvable.",404);
        return detailFor(q,req.params.id);
      });
      res.json(result);
    }),
    decision:route(async(req,res)=>{
      if (!validId(req.params.id)) fail("Commande introuvable.",404);
      const decision=validateDecision(req.body,now());
      const result=await database.transaction(async(tx)=>{
        const q=(...args)=>tx.query(...args);
        const actor=await staffFor(q,req.staff.id);
        // Le même verrou de ligne est pris par les annulations/modifications client.
        // Aucun verrou utilisateur pris après ce verrou : pas d'inversion d'ordre.
        const order=(await q("SELECT status_code FROM vg.orders WHERE id=$1 FOR UPDATE",[req.params.id])).rows[0];
        if (!order) fail("Commande introuvable.",404);
        if (order.status_code === decision.status) return { order:await detailFor(q,req.params.id),replayed:true };
        if (order.status_code !== "en_attente") fail("Cette commande n’est plus en attente. Rechargez son état.",409);
        if (decision.status === "refusee") {
          const item=(await q("SELECT menu_id FROM vg.order_items WHERE order_id=$1",[req.params.id])).rows[0];
          if (!item) fail("Commande incomplète.",409);
          await q(`INSERT INTO vg.order_contacts(order_id,employee_id,contact_method,contacted_at,reason,action)
            VALUES($1,$2,$3,$4,$5,'annulation')`,[req.params.id,actor.id,decision.contact.method,decision.contact.at,decision.reason]);
          await q("UPDATE vg.menus SET stock_available=stock_available+1 WHERE id=$1",[item.menu_id]);
        }
        await q(`UPDATE vg.orders SET status_code=$1,changed_by_user_id=$2,change_reason=$3,
          accepted_at=CASE WHEN $1='accepte' THEN $4::timestamptz ELSE accepted_at END
          WHERE id=$5 AND status_code='en_attente'`,[decision.status,actor.id,decision.reason,new Date(now()),req.params.id]);
        return { order:await detailFor(q,req.params.id),replayed:false };
      });
      res.json(result);
    })
  };
}
module.exports = { employeeOrderHandlers, validateDecision, STATUSES, STAFF_SQL };
