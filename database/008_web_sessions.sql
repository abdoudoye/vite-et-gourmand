-- MANUEL UNIQUEMENT, apres autorisation, avec vg_migrator.
-- Necessaire seulement pour SESSION_STORE=postgres (obligatoire en production).
-- Ne pas executer automatiquement au demarrage. Aucun compte cree.
BEGIN;
SET LOCAL ROLE vg_owner;
CREATE TABLE vg.web_sessions (
  sid_digest text PRIMARY KEY CHECK (sid_digest ~ '^[a-f0-9]{64}$'),
  session_data jsonb NOT NULL,
  expires_at timestamptz NOT NULL
);
CREATE INDEX web_sessions_expiry_idx ON vg.web_sessions(expires_at);
REVOKE ALL ON vg.web_sessions FROM PUBLIC;
GRANT SELECT, INSERT, UPDATE, DELETE ON vg.web_sessions TO vg_app;
COMMIT;
-- Entretien futur a planifier par l'exploitation, jamais execute par ce script :
-- DELETE FROM vg.web_sessions WHERE expires_at <= now();
