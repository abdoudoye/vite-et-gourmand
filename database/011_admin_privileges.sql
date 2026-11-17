-- A preparer pour revue ; NE PAS executer sans autorisation distincte.
-- Complement des profils 004, 007, 009 et 010. Aucun compte ni donnee cree.
BEGIN;
SET LOCAL ROLE vg_owner;
SET LOCAL lock_timeout = '5s';
GRANT SELECT (is_demo, created_at) ON vg.users TO vg_app;
GRANT INSERT (is_demo,created_by_user_id) ON vg.users TO vg_app;
GRANT UPDATE (is_active,deactivated_at) ON vg.users TO vg_app;
GRANT UPDATE (title,description,theme_id,diet_id,minimum_people,base_price_cents,
  order_conditions,storage_conditions,notice_hours) ON vg.menus TO vg_app;
-- stock_available est deja accorde par 009. Aucun droit DELETE ajoute.
GRANT SELECT (
  id, order_id, rating, comment, moderation_status,
  moderated_by_user_id, moderated_at, created_at, is_demo
) ON vg.reviews TO vg_app;
GRANT INSERT (order_id,rating,comment,is_demo) ON vg.reviews TO vg_app;
GRANT UPDATE (moderation_status,moderated_by_user_id,moderated_at) ON vg.reviews TO vg_app;
-- Les controles de role metier sont effectues dans Express, pas par RLS.
-- Les identites automatiques ne necessitent pas d'acces direct aux sequences.
COMMIT;
