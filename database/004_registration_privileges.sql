-- MANUEL, APRES AUTORISATION EXPLICITE, avec vg_migrator.
-- Profil temporaire : catalogue public + inscription uniquement.
-- Ne pas executer 003 ensuite : il retablirait les droits larges.
-- Aucun changement de donnees, de schema, de proprietaire ou de sequence.
BEGIN;
SET LOCAL ROLE vg_owner;
SET LOCAL lock_timeout = '5s';

-- Retirer aussi les droits par colonne : REVOKE sur la table ne suffit pas.
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
GRANT USAGE ON SCHEMA vg TO vg_app;

-- Tables effectivement lues par GET /api/menus.
GRANT SELECT ON vg.menus, vg.themes, vg.diets, vg.menu_images,
  vg.dishes, vg.menu_dishes, vg.allergens, vg.dish_allergens TO vg_app;
GRANT SELECT (code) ON vg.roles TO vg_app;

-- ON CONFLICT lit email ; RETURNING lit id et email.
GRANT SELECT (id, email) ON vg.users TO vg_app;
GRANT INSERT (role_code, first_name, last_name, email, phone, password_hash, is_active)
  ON vg.users TO vg_app;
GRANT INSERT (user_id, street, additional_line, postal_code, city, country_code, is_default)
  ON vg.addresses TO vg_app;
GRANT INSERT (user_id, kind, recipient) ON vg.email_outbox TO vg_app;
GRANT SELECT (id, recipient, attempts) ON vg.email_outbox TO vg_app;
GRANT UPDATE (status, sent_at, attempts) ON vg.email_outbox TO vg_app;

-- Les trois id sont GENERATED ALWAYS AS IDENTITY : leur generation automatique
-- ne demande pas de droit d'appel direct sur les sequences (verifie en memoire).
-- Aucun nextval/setval direct n'est autorise a vg_app avec ce profil.
-- Le role metier reste impose par Express ; ce script n'est pas une politique RLS.
COMMIT;
