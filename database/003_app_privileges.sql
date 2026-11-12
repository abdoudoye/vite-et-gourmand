-- Manuel, après le schéma et les démonstrations, avec vg_migrator.
BEGIN;
SET LOCAL ROLE vg_owner;
REVOKE CREATE ON SCHEMA public FROM PUBLIC;
REVOKE ALL ON SCHEMA vg FROM PUBLIC;
REVOKE EXECUTE ON ALL FUNCTIONS IN SCHEMA vg FROM PUBLIC;
GRANT USAGE ON SCHEMA vg TO vg_app;
GRANT SELECT ON ALL TABLES IN SCHEMA vg TO vg_app;
GRANT USAGE, SELECT ON ALL SEQUENCES IN SCHEMA vg TO vg_app;
GRANT INSERT, UPDATE ON vg.users, vg.addresses, vg.password_reset_tokens,
    vg.themes, vg.diets, vg.menus, vg.menu_images, vg.dishes, vg.menu_dishes,
    vg.allergens, vg.dish_allergens, vg.orders, vg.order_items, vg.order_contacts,
    vg.reviews, vg.opening_hours, vg.email_outbox TO vg_app;
GRANT DELETE ON vg.password_reset_tokens, vg.menu_images, vg.menu_dishes, vg.dish_allergens TO vg_app;
-- Aucun droit DDL, ni écriture directe dans l'historique, ni suppression de commande.
-- Les autorisations client/employé/admin restent à imposer par le futur backend.
COMMIT;
