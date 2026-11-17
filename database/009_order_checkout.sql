-- MANUEL APRES AUTORISATION avec vg_migrator. Aucun changement de donnees existantes.
BEGIN;
SET LOCAL ROLE vg_owner;
CREATE TABLE vg.order_quotes (
  id uuid PRIMARY KEY,
  user_id bigint NOT NULL REFERENCES vg.users(id),
  payload jsonb NOT NULL,
  expires_at timestamptz NOT NULL,
  created_at timestamptz NOT NULL DEFAULT now()
);
CREATE INDEX order_quotes_user_idx ON vg.order_quotes(user_id, expires_at);
CREATE TABLE vg.order_receipts (
  user_id bigint NOT NULL REFERENCES vg.users(id),
  idempotency_key uuid NOT NULL,
  quote_id uuid NOT NULL UNIQUE REFERENCES vg.order_quotes(id),
  order_id bigint NOT NULL REFERENCES vg.orders(id),
  PRIMARY KEY(user_id, idempotency_key)
);
-- Distances ajoutees uniquement par un operateur autorise apres verification.
-- Aucune distance de demonstration n'est inseree, aucun acces en ecriture a vg_app.
CREATE TABLE vg.delivery_distances (
  address_key text PRIMARY KEY CHECK (address_key ~ '^[a-f0-9]{64}$'),
  distance_km numeric(10,3) NOT NULL CHECK (distance_km >= 0),
  source_reference text NOT NULL CHECK (btrim(source_reference) <> ''),
  verified_by_user_id bigint NOT NULL REFERENCES vg.users(id),
  verified_at timestamptz NOT NULL DEFAULT now(),
  expires_at timestamptz NOT NULL CHECK (expires_at > verified_at)
);
REVOKE ALL ON vg.order_quotes, vg.order_receipts, vg.delivery_distances FROM PUBLIC;
GRANT SELECT, INSERT ON vg.order_quotes, vg.order_receipts TO vg_app;
GRANT SELECT ON vg.delivery_distances TO vg_app;
GRANT SELECT (phone) ON vg.users TO vg_app;
GRANT SELECT ON vg.addresses, vg.orders, vg.order_items, vg.order_totals, vg.order_statuses, vg.order_status_history TO vg_app;
GRANT INSERT ON vg.orders, vg.order_items TO vg_app;
GRANT INSERT (order_id) ON vg.email_outbox TO vg_app;
GRANT UPDATE (stock_available) ON vg.menus TO vg_app;
GRANT UPDATE (delivery_street,delivery_additional_line,delivery_postal_code,delivery_city,delivery_country_code,
  service_date,delivery_at,delivery_in_bordeaux,distance_km,distance_source,delivery_fee_cents,
  changed_by_user_id,change_reason,terms_version,terms_accepted_at,status_code,cancelled_at,cancellation_reason)
  ON vg.orders TO vg_app;
GRANT UPDATE (people_count,gross_amount_cents,pricing_policy,discount_percent,discount_cents)
  ON vg.order_items TO vg_app;
-- SELECT FOR UPDATE requiert UPDATE sur au moins une colonne ; stock_available suffit.
-- Les triggers existants alimentent l'historique et verifient la ligne de menu.
-- Aucune ecriture directe dans l'historique ; aucune sequence supplementaire.
COMMIT;
