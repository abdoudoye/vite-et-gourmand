-- MANUEL, APRES AUTORISATION EXPLICITE, avec vg_migrator.
-- Retour au profil large de 003, observe pendant l'audit du 16 novembre 2026.
-- Ce script restaure aussi les droits des fonctions pas encore developpees.
BEGIN;
SET LOCAL ROLE vg_owner;
DO $$
DECLARE target record;
BEGIN
  FOR target IN
    SELECT c.relname, string_agg(quote_ident(a.attname), ', ' ORDER BY a.attnum) AS columns
    FROM pg_class c JOIN pg_namespace n ON n.oid=c.relnamespace
    JOIN pg_attribute a ON a.attrelid=c.oid AND a.attnum>0 AND NOT a.attisdropped
    WHERE n.nspname='vg' AND c.relkind IN ('r','v') GROUP BY c.relname
  LOOP
    EXECUTE format('REVOKE ALL PRIVILEGES (%s) ON TABLE vg.%I FROM vg_app', target.columns, target.relname);
  END LOOP;
END;
$$;
REVOKE ALL PRIVILEGES ON ALL TABLES IN SCHEMA vg FROM vg_app;
REVOKE ALL PRIVILEGES ON ALL SEQUENCES IN SCHEMA vg FROM vg_app;
GRANT SELECT ON ALL TABLES IN SCHEMA vg TO vg_app;
GRANT USAGE, SELECT ON ALL SEQUENCES IN SCHEMA vg TO vg_app;
GRANT INSERT, UPDATE ON vg.users, vg.addresses, vg.password_reset_tokens,
  vg.themes, vg.diets, vg.menus, vg.menu_images, vg.dishes, vg.menu_dishes,
  vg.allergens, vg.dish_allergens, vg.orders, vg.order_items, vg.order_contacts,
  vg.reviews, vg.opening_hours, vg.email_outbox TO vg_app;
GRANT DELETE ON vg.password_reset_tokens, vg.menu_images, vg.menu_dishes, vg.dish_allergens TO vg_app;
COMMIT;
