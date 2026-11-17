-- MANUEL APRES AUTORISATION avec vg_migrator. Complement aux profils 007/009.
-- Aucun compte, statut ou donnee cree ; aucun UPDATE de donnees existantes.
BEGIN;
SET LOCAL ROLE vg_owner;
GRANT UPDATE (accepted_at) ON vg.orders TO vg_app;
GRANT SELECT (id, order_id, employee_id, contact_method, contacted_at, reason, action)
ON vg.order_contacts TO vg_app;
GRANT INSERT (order_id,employee_id,contact_method,contacted_at,reason,action)
  ON vg.order_contacts TO vg_app;
-- Les autres lectures, changements de statut et mises a jour du stock sont
-- deja accordes par 009. L'historique reste alimente uniquement par le trigger.
-- Identite automatique de order_contacts : aucun acces direct a une sequence.
COMMIT;
