"use strict";
const { SESSION_DURATION } = require("./auth-session");
const { OrderError, fail } = require("./order-rules");
const { validId, text, object } = require("./admin");

function reviewHandlers({ database, now = Date.now }) {
  return {
    async create(req,res) {
      try {
        if (!validId(req.session?.userId) || !Number.isFinite(req.session.loggedAt) || now()-req.session.loggedAt >= SESSION_DURATION) fail("Authentification requise.",401);
        if (!database) fail("Avis indisponibles.",503);
        if (!validId(req.params.id)) fail("Commande introuvable.",404);
        object(req.body,["rating","comment"]);
        if (!Number.isInteger(req.body.rating) || req.body.rating<1 || req.body.rating>5) fail("La note doit être un entier de 1 à 5.");
        const comment=text(req.body.comment,2000,true);
        await database.transaction(async tx=>{
          const user=(await tx.query("SELECT role_code,is_active,deactivated_at FROM vg.users WHERE id=$1 FOR SHARE",[req.session.userId])).rows[0];
          if (!user?.is_active || user.deactivated_at!==null) fail("Authentification requise.",401);
          if (user.role_code!=="utilisateur") fail("Avis réservés aux clients.",403);
          const order=(await tx.query("SELECT status_code,is_demo FROM vg.orders WHERE id=$1 AND user_id=$2 FOR SHARE",[req.params.id,req.session.userId])).rows[0];
          if (!order) fail("Commande introuvable.",404);
          if (order.status_code!=="terminee") fail("Un avis est possible uniquement après une commande terminée.",409);
          const result=await tx.query("INSERT INTO vg.reviews(order_id,rating,comment,is_demo) VALUES($1,$2,$3,$4) ON CONFLICT(order_id) DO NOTHING RETURNING id",[req.params.id,req.body.rating,comment,order.is_demo]);
          if (!result.rows.length) fail("Un avis existe déjà pour cette commande.",409);
        });
        res.status(201).json({message:"Avis enregistré, en attente de validation."});
      } catch(error) {res.status(error instanceof OrderError?error.status:503).json({error:error instanceof OrderError?error.message:"Avis indisponibles. Réessayez plus tard."});}
    },
    async publicList(_req,res) {
      try {
        if (!database) throw new Error();
        res.json((await database.query(`SELECT r.id::text,r.rating,r.comment,r.is_demo AS "isDemo",r.created_at AS "createdAt"
          FROM vg.reviews r JOIN vg.orders o ON o.id=r.order_id WHERE r.moderation_status='valide' AND o.status_code='terminee'
          ORDER BY r.created_at DESC,r.id DESC LIMIT 20`)).rows);
      } catch {res.status(503).json({error:"Avis indisponibles."});}
    }
  };
}
module.exports={reviewHandlers};
