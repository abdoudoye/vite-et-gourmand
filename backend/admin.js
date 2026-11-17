"use strict";

const argon2 = require("argon2");
const { SESSION_DURATION } = require("./auth-session");
const { OrderError, fail, hash } = require("./order-rules");
const { validateRegistration } = require("./registration");
const validId = (value) => typeof value === "string" && /^[1-9]\d{0,18}$/.test(value) && BigInt(value) <= 9223372036854775807n;
const STAFF_COLUMNS = 'id::text,first_name AS "firstName",last_name AS "lastName",email,phone,is_active AS "isActive",is_demo AS "isDemo",created_at AS "createdAt",deactivated_at AS "deactivatedAt"';
const MENU_COLUMNS = 'id::text,title,description,theme_id::text AS "themeId",diet_id::text AS "dietId",minimum_people AS "minimumPeople",base_price_cents AS "basePriceCents",stock_available AS stock,order_conditions AS "orderConditions",storage_conditions AS "storageConditions",notice_hours AS "noticeHours",is_demo AS "isDemo",archived_at AS "archivedAt"';

function object(body, allowed) {
  if (!body || typeof body !== "object" || Array.isArray(body) || Object.keys(body).some(key => !allowed.includes(key))) fail("Champs du formulaire invalides.");
}
function text(value, max, multiline = false) {
  if (typeof value !== "string") fail("Texte requis.");
  const result = value.trim();
  if (!result || result.length > max || /[\p{Cc}\p{Cf}<>]/u.test(multiline ? result.replace(/[\r\n\t]/g,"") : result)) fail("Texte vide, trop long ou contenant des caractères interdits.");
  return result;
}
function integer(value, minimum, maximum) {
  if (!Number.isSafeInteger(value) || value < minimum || value > maximum) fail("Nombre entier hors limites.");
  return value;
}
function page(query) {
  const value = query.offset ?? "0";
  if (typeof value !== "string" || !/^\d+$/.test(value) || !Number.isSafeInteger(Number(value))) fail("Page invalide.");
  return Number(value);
}
function validateEmployee(body) {
  object(body, ["firstName","lastName","email","phone","password","passwordConfirmation","isDemo"]);
  const { data, errors } = validateRegistration(body);
  if (["firstName","lastName","email","phone","password","passwordConfirmation"].some(key => errors[key]) || typeof body.isDemo !== "boolean") fail("Vérifiez l’identité, le téléphone, l’email et les deux mots de passe (10 à 128 caractères, majuscule, minuscule, chiffre, caractère spécial).");
  return { ...data, isDemo: body.isDemo };
}
function validateMenu(body) {
  object(body, ["title","description","themeId","dietId","minimumPeople","basePriceCents","stock","orderConditions","storageConditions","noticeHours","version"]);
  if (!validId(body.themeId) || !validId(body.dietId) || typeof body.version !== "string" || !/^[a-f0-9]{64}$/.test(body.version)) fail("Références ou version invalides. Rechargez le menu.");
  return { title:text(body.title,150),description:text(body.description,5000,true),themeId:body.themeId,dietId:body.dietId,
    minimumPeople:integer(body.minimumPeople,1,10000),basePriceCents:integer(body.basePriceCents,0,100000000),stock:integer(body.stock,0,1000000),
    orderConditions:text(body.orderConditions,5000,true),storageConditions:text(body.storageConditions,5000,true),noticeHours:integer(body.noticeHours,0,8760),version:body.version };
}
const versioned = menu => ({ ...menu,version:hash(menu) });
async function adminFor(query, id, lock = false) {
  const user = (await query(`SELECT id::text,role_code,is_active,deactivated_at FROM vg.users WHERE id=$1${lock ? " FOR SHARE" : ""}`, [id])).rows[0];
  if (!user || !user.is_active || user.deactivated_at !== null) fail("Authentification requise.",401);
  if (user.role_code !== "administrateur") fail("Accès réservé aux administrateurs actifs.",403);
  return user;
}

function adminHandlers({ database, mailer = null, now = Date.now }) {
  let hashing = 0;
  const route = work => async (req,res) => {
    try {
      if (!validId(req.session?.userId) || !Number.isFinite(req.session.loggedAt) || now()-req.session.loggedAt >= SESSION_DURATION) fail("Authentification requise.",401);
      if (!database) fail("Administration indisponible.",503);
      await adminFor((...args)=>database.query(...args),req.session.userId);
      await work(req,res);
    } catch (error) { res.status(error instanceof OrderError ? error.status : 503).json({error:error instanceof OrderError ? error.message : "Administration indisponible. Réessayez plus tard."}); }
  };
  const transaction = (req,work) => database.transaction(async tx => {
    const query = (...args)=>tx.query(...args);
    await adminFor(query,req.session.userId,true);
    return work(query);
  });
  return {
    dashboard:route(async(_req,res)=>res.json({statistics:{available:false,reason:"MongoDB non configuré. Les statistiques par menu et le chiffre d’affaires par période restent à intégrer."}})),
    employees:route(async(req,res)=>res.json((await database.query(`SELECT ${STAFF_COLUMNS} FROM vg.users WHERE role_code='employe' ORDER BY id DESC LIMIT 50 OFFSET $1`,[page(req.query)])).rows)),
    createEmployee:route(async(req,res)=>{
      const data = validateEmployee(req.body);
      if (hashing >= 2) fail("Trop de créations simultanées. Réessayez.",429);
      hashing++;
      let result;
      try {
        const passwordHash = await argon2.hash(req.body.password,{type:argon2.argon2id,memoryCost:65536,timeCost:3,parallelism:1});
        result = await transaction(req,async query=>{
          const user = (await query(`INSERT INTO vg.users(role_code,first_name,last_name,email,phone,password_hash,is_active,is_demo,created_by_user_id)
            VALUES('employe',$1,$2,$3,$4,$5,true,$6,$7) ON CONFLICT (lower(email)) DO NOTHING RETURNING ${STAFF_COLUMNS}`,
          [data.firstName,data.lastName,data.email,data.phone,passwordHash,data.isDemo,req.session.userId])).rows[0];
          if (!user) fail("Un compte utilise déjà cet email.",409);
          const notification=(await query("INSERT INTO vg.email_outbox(user_id,kind,recipient) VALUES($1,'nouvel_employe',$2) RETURNING id",[user.id,user.email])).rows[0];
          return {user,notification};
        });
      } finally { hashing--; }
      let notification = mailer?.sendEmployeeCreated ? "pending" : "disabled";
      if (mailer?.sendEmployeeCreated) {
        try {
          await mailer.sendEmployeeCreated(result.user.email);
          await database.query("UPDATE vg.email_outbox SET status='envoye',sent_at=now(),attempts=attempts+1 WHERE id=$1",[result.notification.id]);
          notification="sent";
        } catch { /* Compte conservé ; notification en attente, aucun secret journalisé. */ }
      }
      res.status(201).json({employee:result.user,notification});
    }),
    deactivateEmployee:route(async(req,res)=>{
      if (!validId(req.params.id)) fail("Employé introuvable.",404);
      object(req.body,[]);
      const result=await transaction(req,async query=>{
        const user=(await query("SELECT role_code,is_active FROM vg.users WHERE id=$1 FOR UPDATE",[req.params.id])).rows[0];
        if (!user || user.role_code!=="employe") fail("Employé introuvable.",404);
        if (!user.is_active) return {replayed:true};
        await query("UPDATE vg.users SET is_active=false,deactivated_at=now() WHERE id=$1 AND role_code='employe'",[req.params.id]);
        return {replayed:false};
      });
      res.json(result);
    }),
    menus:route(async(req,res)=>res.json((await database.query(`SELECT ${MENU_COLUMNS} FROM vg.menus ORDER BY id LIMIT 50 OFFSET $1`,[page(req.query)])).rows.map(versioned))),
    references:route(async(_req,res)=>{
      const themes=(await database.query("SELECT id::text,name FROM vg.themes ORDER BY name")).rows;
      const diets=(await database.query("SELECT id::text,name FROM vg.diets ORDER BY name")).rows;
      res.json({themes,diets});
    }),
    updateMenu:route(async(req,res)=>{
      if (!validId(req.params.id)) fail("Menu introuvable.",404);
      const data=validateMenu(req.body);
      const result=await transaction(req,async query=>{
        const current=(await query(`SELECT ${MENU_COLUMNS} FROM vg.menus WHERE id=$1 FOR UPDATE`,[req.params.id])).rows[0];
        if (!current) fail("Menu introuvable.",404);
        if (hash(current)!==data.version) fail("Le menu ou son stock a changé. Rechargez-le avant de modifier.",409);
        if (!(await query("SELECT id FROM vg.themes WHERE id=$1",[data.themeId])).rows.length || !(await query("SELECT id FROM vg.diets WHERE id=$1",[data.dietId])).rows.length) fail("Thème ou régime inexistant.");
        return versioned((await query(`UPDATE vg.menus SET title=$1,description=$2,theme_id=$3,diet_id=$4,minimum_people=$5,base_price_cents=$6,
          stock_available=$7,order_conditions=$8,storage_conditions=$9,notice_hours=$10 WHERE id=$11 RETURNING ${MENU_COLUMNS}`,
        [data.title,data.description,data.themeId,data.dietId,data.minimumPeople,data.basePriceCents,data.stock,data.orderConditions,data.storageConditions,data.noticeHours,req.params.id])).rows[0]);
      });
      res.json(result);
    }),
    reviews:route(async(req,res)=>{
      const status=req.query.status??"en_attente";
      if (!["en_attente","valide","refuse"].includes(status)) fail("Statut d’avis invalide.");
      res.json((await database.query(`SELECT r.id::text,o.reference,o.status_code AS "orderStatus",r.rating,r.comment,r.moderation_status AS status,
        r.is_demo AS "isDemo",r.created_at AS "createdAt",r.moderated_at AS "moderatedAt",r.moderated_by_user_id::text AS "moderatorId"
        FROM vg.reviews r JOIN vg.orders o ON o.id=r.order_id WHERE r.moderation_status=$1 ORDER BY r.created_at,r.id LIMIT 50 OFFSET $2`,[status,page(req.query)])).rows);
    }),
    moderateReview:route(async(req,res)=>{
      if (!validId(req.params.id)) fail("Avis introuvable.",404);
      object(req.body,["status"]);
      if (!["valide","refuse"].includes(req.body.status)) fail("Décision de modération invalide.");
      const result=await transaction(req,async query=>{
        const review=(await query("SELECT order_id,moderation_status FROM vg.reviews WHERE id=$1 FOR UPDATE",[req.params.id])).rows[0];
        if (!review) fail("Avis introuvable.",404);
        const order=(await query("SELECT status_code FROM vg.orders WHERE id=$1 FOR SHARE",[review.order_id])).rows[0];
        if (order?.status_code!=="terminee") fail("Seuls les avis liés à une commande terminée peuvent être modérés.",409);
        if (review.moderation_status===req.body.status) return {replayed:true};
        if (review.moderation_status!=="en_attente") fail("Cet avis a déjà été modéré.",409);
        await query("UPDATE vg.reviews SET moderation_status=$1,moderated_by_user_id=$2,moderated_at=now() WHERE id=$3",[req.body.status,req.session.userId,req.params.id]);
        return {replayed:false};
      });
      res.json(result);
    })
  };
}
module.exports={adminHandlers,validateEmployee,validateMenu,validId,text,object,page};
