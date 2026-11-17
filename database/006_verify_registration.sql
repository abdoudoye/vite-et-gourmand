-- LECTURE SEULE. A executer avec vg_migrator dans pgAdmin ou psql.
-- Changer uniquement l'email FICTIF ci-dessous si vous utilisez un autre test.
-- Ne jamais remplacer cette projection par SELECT * ou afficher password_hash.
BEGIN READ ONLY;
SET LOCAL ROLE vg_owner;
WITH target AS (
  SELECT id, role_code, is_active, password_hash, is_demo
  FROM vg.users WHERE lower(email) = 'inscription.audit@example.test'
)
SELECT count(*) = 1 AS compte_unique,
  coalesce(bool_and(role_code = 'utilisateur'), false) AS role_client,
  coalesce(bool_and(is_active), false) AS compte_actif,
  coalesce(bool_and(NOT is_demo), false) AS compte_hors_seed,
  coalesce(bool_and(password_hash LIKE '$argon2id$%'), false) AS format_argon2id,
  (SELECT count(*) FROM vg.addresses a JOIN target t ON t.id=a.user_id) = 1 AS une_adresse,
  (SELECT count(*) FROM vg.addresses a JOIN target t ON t.id=a.user_id
    WHERE a.is_default AND a.archived_at IS NULL) = 1 AS adresse_principale,
  (SELECT count(*) FROM vg.email_outbox e JOIN target t ON t.id=e.user_id
    WHERE e.kind='bienvenue') = 1 AS un_evenement_bienvenue,
  (SELECT count(*) FROM vg.email_outbox e JOIN target t ON t.id=e.user_id
    WHERE e.kind='bienvenue' AND e.status='en_attente' AND e.sent_at IS NULL) = 1 AS email_en_attente
FROM target;
ROLLBACK;
