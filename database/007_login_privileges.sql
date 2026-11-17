-- MANUEL UNIQUEMENT, apres autorisation, avec vg_migrator.
-- Complement du profil restreint 004, pour login et me ; aucune ecriture utilisateur.
BEGIN;
SET LOCAL ROLE vg_owner;
GRANT SELECT (id, first_name, last_name, email, role_code, is_active, deactivated_at, password_hash)
  ON vg.users TO vg_app;
COMMIT;
