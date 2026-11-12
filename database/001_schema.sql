-- Initialisation d'une base dédiée vide. PostgreSQL 16+.
-- Une réexécution échoue volontairement ; aucune suppression automatique.
BEGIN;
SET LOCAL client_encoding = 'UTF8';
SET LOCAL ROLE vg_owner;
CREATE SCHEMA vg AUTHORIZATION vg_owner;
SET LOCAL search_path = vg, pg_catalog;

CREATE TABLE roles (
    code text PRIMARY KEY CHECK (code IN ('utilisateur', 'employe', 'administrateur')),
    label text NOT NULL CHECK (btrim(label) <> '')
);
INSERT INTO roles VALUES ('utilisateur', 'Client'), ('employe', 'Employé'), ('administrateur', 'Administrateur');

CREATE TABLE users (
    id bigint GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
    role_code text NOT NULL DEFAULT 'utilisateur' REFERENCES roles(code),
    first_name text NOT NULL CHECK (btrim(first_name) <> ''),
    last_name text NOT NULL CHECK (btrim(last_name) <> ''),
    email text NOT NULL CHECK (email = btrim(email) AND email LIKE '%_@_%._%'),
    phone text NOT NULL CHECK (btrim(phone) <> ''),
    password_hash text,
    is_active boolean NOT NULL DEFAULT false,
    is_demo boolean NOT NULL DEFAULT false,
    created_by_user_id bigint REFERENCES users(id) ON DELETE RESTRICT,
    created_at timestamptz NOT NULL DEFAULT now(),
    deactivated_at timestamptz,
    CHECK (NOT is_active OR password_hash IS NOT NULL),
    CHECK (password_hash IS NULL OR password_hash LIKE '$argon2id$%' OR password_hash ~ '^\$2[aby]\$'),
    CHECK (NOT is_active OR deactivated_at IS NULL)
);
CREATE UNIQUE INDEX users_email_ci_idx ON users (lower(email));
CREATE INDEX users_role_idx ON users(role_code);
CREATE INDEX users_creator_idx ON users(created_by_user_id);

CREATE TABLE addresses (
    id bigint GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
    user_id bigint NOT NULL REFERENCES users(id) ON DELETE RESTRICT,
    label text NOT NULL DEFAULT 'Domicile',
    street text NOT NULL CHECK (btrim(street) <> ''),
    additional_line text,
    postal_code text NOT NULL CHECK (btrim(postal_code) <> ''),
    city text NOT NULL CHECK (btrim(city) <> ''),
    country_code text NOT NULL DEFAULT 'FR' CHECK (country_code ~ '^[A-Z]{2}$'),
    is_default boolean NOT NULL DEFAULT false,
    archived_at timestamptz,
    created_at timestamptz NOT NULL DEFAULT now()
);
CREATE INDEX addresses_user_idx ON addresses(user_id);
CREATE UNIQUE INDEX addresses_default_idx ON addresses(user_id) WHERE is_default AND archived_at IS NULL;

CREATE TABLE password_reset_tokens (
    id bigint GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
    user_id bigint NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    token_digest text NOT NULL UNIQUE CHECK (token_digest ~ '^[a-f0-9]{64}$'),
    created_at timestamptz NOT NULL DEFAULT now(),
    expires_at timestamptz NOT NULL,
    used_at timestamptz,
    CHECK (expires_at > created_at),
    CHECK (used_at IS NULL OR used_at >= created_at)
);
CREATE INDEX password_reset_user_idx ON password_reset_tokens(user_id);
CREATE INDEX password_reset_expiry_idx ON password_reset_tokens(expires_at) WHERE used_at IS NULL;

CREATE TABLE themes (id bigint GENERATED ALWAYS AS IDENTITY PRIMARY KEY, name text NOT NULL UNIQUE CHECK (btrim(name) <> ''));
CREATE TABLE diets (id bigint GENERATED ALWAYS AS IDENTITY PRIMARY KEY, name text NOT NULL UNIQUE CHECK (btrim(name) <> ''));
CREATE TABLE menus (
    id bigint GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
    title text NOT NULL CHECK (btrim(title) <> ''),
    description text NOT NULL CHECK (btrim(description) <> ''),
    theme_id bigint NOT NULL REFERENCES themes(id),
    diet_id bigint NOT NULL REFERENCES diets(id),
    minimum_people integer NOT NULL CHECK (minimum_people > 0),
    base_price_cents integer NOT NULL CHECK (base_price_cents >= 0),
    stock_available integer NOT NULL DEFAULT 0 CHECK (stock_available >= 0),
    order_conditions text NOT NULL CHECK (btrim(order_conditions) <> ''),
    storage_conditions text NOT NULL CHECK (btrim(storage_conditions) <> ''),
    notice_hours integer CHECK (notice_hours >= 0),
    is_demo boolean NOT NULL DEFAULT false,
    archived_at timestamptz,
    created_at timestamptz NOT NULL DEFAULT now()
);
CREATE INDEX menus_theme_idx ON menus(theme_id);
CREATE INDEX menus_diet_idx ON menus(diet_id);
CREATE INDEX menus_price_idx ON menus(base_price_cents) WHERE archived_at IS NULL;
CREATE INDEX menus_people_idx ON menus(minimum_people) WHERE archived_at IS NULL;
CREATE TABLE menu_images (
    id bigint GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
    menu_id bigint NOT NULL REFERENCES menus(id) ON DELETE CASCADE,
    path text NOT NULL CHECK (btrim(path) <> ''),
    alt_text text NOT NULL CHECK (btrim(alt_text) <> ''),
    caption text NOT NULL CHECK (btrim(caption) <> ''),
    position integer NOT NULL CHECK (position >= 0),
    is_demo boolean NOT NULL DEFAULT false,
    UNIQUE(menu_id, position)
);
CREATE TABLE dishes (
    id bigint GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
    name text NOT NULL CHECK (btrim(name) <> ''),
    description text NOT NULL DEFAULT '',
    category text NOT NULL CHECK (category IN ('entree', 'plat', 'dessert')),
    is_demo boolean NOT NULL DEFAULT false,
    archived_at timestamptz
);
CREATE TABLE menu_dishes (
    menu_id bigint NOT NULL REFERENCES menus(id) ON DELETE CASCADE,
    dish_id bigint NOT NULL REFERENCES dishes(id) ON DELETE RESTRICT,
    position integer NOT NULL DEFAULT 0 CHECK (position >= 0),
    PRIMARY KEY(menu_id, dish_id)
);
CREATE INDEX menu_dishes_dish_idx ON menu_dishes(dish_id);
CREATE TABLE allergens (id bigint GENERATED ALWAYS AS IDENTITY PRIMARY KEY, name text NOT NULL UNIQUE CHECK (btrim(name) <> ''));
CREATE TABLE dish_allergens (
    dish_id bigint NOT NULL REFERENCES dishes(id) ON DELETE CASCADE,
    allergen_id bigint NOT NULL REFERENCES allergens(id) ON DELETE RESTRICT,
    PRIMARY KEY(dish_id, allergen_id)
);
CREATE INDEX dish_allergens_allergen_idx ON dish_allergens(allergen_id);

CREATE TABLE order_statuses (
    code text PRIMARY KEY,
    label text NOT NULL UNIQUE
);
INSERT INTO order_statuses VALUES
 ('en_attente', 'En attente'), ('accepte', 'Accepté'), ('en_preparation', 'En préparation'),
 ('en_livraison', 'En cours de livraison'), ('livre', 'Livré'),
 ('attente_retour_materiel', 'En attente du retour de matériel'), ('terminee', 'Terminée'),
 ('annulee', 'Annulée'), ('refusee', 'Refusée');

CREATE TABLE orders (
    id bigint GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
    reference text NOT NULL UNIQUE CHECK (btrim(reference) <> ''),
    user_id bigint NOT NULL REFERENCES users(id) ON DELETE RESTRICT,
    address_id bigint REFERENCES addresses(id) ON DELETE SET NULL,
    customer_first_name text NOT NULL CHECK (btrim(customer_first_name) <> ''),
    customer_last_name text NOT NULL CHECK (btrim(customer_last_name) <> ''),
    customer_email text NOT NULL CHECK (customer_email LIKE '%_@_%._%'),
    customer_phone text NOT NULL CHECK (btrim(customer_phone) <> ''),
    delivery_street text NOT NULL CHECK (btrim(delivery_street) <> ''),
    delivery_additional_line text,
    delivery_postal_code text NOT NULL CHECK (btrim(delivery_postal_code) <> ''),
    delivery_city text NOT NULL CHECK (btrim(delivery_city) <> ''),
    delivery_country_code text NOT NULL DEFAULT 'FR' CHECK (delivery_country_code ~ '^[A-Z]{2}$'),
    service_date date NOT NULL,
    delivery_at timestamptz NOT NULL,
    delivery_in_bordeaux boolean NOT NULL,
    distance_km numeric(10,3),
    distance_source text,
    delivery_fee_cents integer NOT NULL CHECK (delivery_fee_cents >= 0),
    status_code text NOT NULL DEFAULT 'en_attente' REFERENCES order_statuses(code),
    status_changed_at timestamptz NOT NULL DEFAULT now(),
    changed_by_user_id bigint NOT NULL REFERENCES users(id),
    change_reason text NOT NULL CHECK (btrim(change_reason) <> ''),
    accepted_at timestamptz,
    cancelled_at timestamptz,
    cancellation_reason text,
    material_loaned boolean NOT NULL DEFAULT false,
    material_return_due_at timestamptz,
    material_returned_at timestamptz,
    material_penalty_cents integer NOT NULL DEFAULT 60000 CHECK (material_penalty_cents = 60000),
    terms_version text NOT NULL CHECK (btrim(terms_version) <> ''),
    terms_accepted_at timestamptz NOT NULL,
    is_demo boolean NOT NULL DEFAULT false,
    created_at timestamptz NOT NULL DEFAULT now(),
    CHECK ((delivery_at AT TIME ZONE 'Europe/Paris')::date <= service_date),
    CHECK ((delivery_in_bordeaux AND delivery_fee_cents = 0 AND distance_km IS NULL AND distance_source IS NULL)
        OR (NOT delivery_in_bordeaux AND distance_km IS NOT NULL AND distance_km >= 0
            AND distance_source IS NOT NULL AND btrim(distance_source) <> ''
            AND delivery_fee_cents = 500 + round(distance_km * 59)::integer)),
    CHECK (status_code <> 'annulee' OR (cancelled_at IS NOT NULL AND cancellation_reason IS NOT NULL AND btrim(cancellation_reason) <> '')),
    CHECK (material_loaned OR (material_return_due_at IS NULL AND material_returned_at IS NULL)),
    CHECK (status_code <> 'attente_retour_materiel' OR (material_loaned AND material_return_due_at IS NOT NULL)),
    CHECK (material_returned_at IS NULL OR material_return_due_at IS NOT NULL)
);
CREATE INDEX orders_user_date_idx ON orders(user_id, created_at DESC);
CREATE INDEX orders_status_delivery_idx ON orders(status_code, delivery_at);
CREATE INDEX orders_address_idx ON orders(address_id);
CREATE INDEX orders_actor_idx ON orders(changed_by_user_id);
CREATE INDEX orders_service_idx ON orders(service_date);

-- Le sujet ne décrit qu'un menu par commande : order_id unique, une seule ligne.
CREATE TABLE order_items (
    id bigint GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
    order_id bigint NOT NULL UNIQUE REFERENCES orders(id) ON DELETE RESTRICT,
    menu_id bigint NOT NULL REFERENCES menus(id) ON DELETE RESTRICT,
    menu_title_snapshot text NOT NULL CHECK (btrim(menu_title_snapshot) <> ''),
    minimum_people_snapshot integer NOT NULL CHECK (minimum_people_snapshot > 0),
    base_price_cents_snapshot integer NOT NULL CHECK (base_price_cents_snapshot >= 0),
    order_conditions_snapshot text NOT NULL CHECK (btrim(order_conditions_snapshot) <> ''),
    storage_conditions_snapshot text NOT NULL CHECK (btrim(storage_conditions_snapshot) <> ''),
    people_count integer NOT NULL CHECK (people_count >= minimum_people_snapshot),
    gross_amount_cents integer NOT NULL CHECK (gross_amount_cents >= 0),
    pricing_policy text NOT NULL CHECK (btrim(pricing_policy) <> ''),
    discount_percent smallint NOT NULL CHECK (discount_percent IN (0, 10)),
    discount_cents integer NOT NULL CHECK (discount_cents >= 0),
    net_amount_cents integer GENERATED ALWAYS AS (gross_amount_cents - discount_cents) STORED,
    CHECK (people_count <> minimum_people_snapshot OR gross_amount_cents = base_price_cents_snapshot),
    CHECK (discount_percent = CASE WHEN people_count::bigint >= minimum_people_snapshot::bigint + 5 THEN 10 ELSE 0 END),
    CHECK (discount_cents = round(gross_amount_cents::numeric * discount_percent / 100)::integer)
);
CREATE INDEX order_items_menu_idx ON order_items(menu_id);

CREATE TABLE order_contacts (
    id bigint GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
    order_id bigint NOT NULL REFERENCES orders(id) ON DELETE RESTRICT,
    employee_id bigint NOT NULL REFERENCES users(id),
    contact_method text NOT NULL CHECK (contact_method IN ('telephone', 'email')),
    contacted_at timestamptz NOT NULL,
    reason text NOT NULL CHECK (btrim(reason) <> ''),
    action text NOT NULL CHECK (action IN ('modification', 'annulation')),
    created_at timestamptz NOT NULL DEFAULT now()
);
CREATE INDEX order_contacts_order_idx ON order_contacts(order_id, contacted_at DESC);
CREATE INDEX order_contacts_employee_idx ON order_contacts(employee_id);

CREATE TABLE order_status_history (
    id bigint GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
    order_id bigint NOT NULL REFERENCES orders(id) ON DELETE RESTRICT,
    status_code text NOT NULL REFERENCES order_statuses(code),
    changed_at timestamptz NOT NULL,
    changed_by_user_id bigint NOT NULL REFERENCES users(id),
    reason text NOT NULL CHECK (btrim(reason) <> '')
);
CREATE INDEX order_history_order_time_idx ON order_status_history(order_id, changed_at, id);
CREATE INDEX order_history_status_idx ON order_status_history(status_code);
CREATE INDEX order_history_actor_idx ON order_status_history(changed_by_user_id);

-- AFTER : la commande existe avant la création de son historique.
CREATE FUNCTION append_order_status() RETURNS trigger LANGUAGE plpgsql
SECURITY DEFINER SET search_path = pg_catalog, vg AS $$
BEGIN
    INSERT INTO vg.order_status_history(order_id, status_code, changed_at, changed_by_user_id, reason)
    VALUES (NEW.id, NEW.status_code, NEW.status_changed_at, NEW.changed_by_user_id, NEW.change_reason);
    RETURN NEW;
END;
$$;
CREATE FUNCTION timestamp_order_status() RETURNS trigger LANGUAGE plpgsql AS $$
BEGIN
    IF NEW.status_code IS DISTINCT FROM OLD.status_code THEN
        NEW.status_changed_at := clock_timestamp();
    ELSE
        NEW.status_changed_at := OLD.status_changed_at;
    END IF;
    RETURN NEW;
END;
$$;
CREATE TRIGGER orders_status_time BEFORE UPDATE ON orders
    FOR EACH ROW EXECUTE FUNCTION timestamp_order_status();
CREATE TRIGGER orders_initial_history AFTER INSERT ON orders FOR EACH ROW EXECUTE FUNCTION append_order_status();
CREATE TRIGGER orders_changed_history AFTER UPDATE OF status_code ON orders
    FOR EACH ROW WHEN (OLD.status_code IS DISTINCT FROM NEW.status_code) EXECUTE FUNCTION append_order_status();

CREATE FUNCTION snapshot_order_menu() RETURNS trigger LANGUAGE plpgsql AS $$
DECLARE selected vg.menus%ROWTYPE;
BEGIN
    SELECT * INTO STRICT selected FROM vg.menus WHERE id = NEW.menu_id FOR SHARE;
    NEW.menu_title_snapshot := selected.title;
    NEW.minimum_people_snapshot := selected.minimum_people;
    NEW.base_price_cents_snapshot := selected.base_price_cents;
    NEW.order_conditions_snapshot := selected.order_conditions;
    NEW.storage_conditions_snapshot := selected.storage_conditions;
    RETURN NEW;
END;
$$;
CREATE TRIGGER order_item_snapshot BEFORE INSERT ON order_items FOR EACH ROW EXECUTE FUNCTION snapshot_order_menu();

CREATE FUNCTION protect_order_menu() RETURNS trigger LANGUAGE plpgsql AS $$
BEGIN
    IF (NEW.order_id, NEW.menu_id, NEW.minimum_people_snapshot, NEW.base_price_cents_snapshot,
        NEW.menu_title_snapshot, NEW.order_conditions_snapshot, NEW.storage_conditions_snapshot)
        IS DISTINCT FROM (OLD.order_id, OLD.menu_id, OLD.minimum_people_snapshot, OLD.base_price_cents_snapshot,
        OLD.menu_title_snapshot, OLD.order_conditions_snapshot, OLD.storage_conditions_snapshot) THEN
        RAISE EXCEPTION 'Le menu et ses valeurs historiques ne peuvent pas être remplacés';
    END IF;
    RETURN NEW;
END;
$$;
CREATE TRIGGER order_item_menu_immutable BEFORE UPDATE ON order_items FOR EACH ROW EXECUTE FUNCTION protect_order_menu();

-- La commande et sa ligne doivent être insérées dans une même transaction.
CREATE FUNCTION require_order_item() RETURNS trigger LANGUAGE plpgsql AS $$
DECLARE target_id bigint;
BEGIN
    IF TG_TABLE_NAME = 'orders' THEN target_id := NEW.id;
    ELSE target_id := OLD.order_id; END IF;
    IF EXISTS (SELECT 1 FROM vg.orders WHERE id = target_id)
       AND NOT EXISTS (SELECT 1 FROM vg.order_items WHERE order_id = target_id) THEN
        RAISE EXCEPTION 'Une commande doit posséder exactement une ligne de menu';
    END IF;
    RETURN NULL;
END;
$$;
CREATE CONSTRAINT TRIGGER orders_require_item AFTER INSERT ON orders
    DEFERRABLE INITIALLY DEFERRED FOR EACH ROW EXECUTE FUNCTION require_order_item();
CREATE CONSTRAINT TRIGGER items_require_order_line AFTER DELETE ON order_items
    DEFERRABLE INITIALLY DEFERRED FOR EACH ROW EXECUTE FUNCTION require_order_item();

CREATE TABLE reviews (
    id bigint GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
    order_id bigint NOT NULL UNIQUE REFERENCES orders(id) ON DELETE RESTRICT,
    rating smallint NOT NULL CHECK (rating BETWEEN 1 AND 5),
    comment text NOT NULL CHECK (btrim(comment) <> ''),
    moderation_status text NOT NULL DEFAULT 'en_attente' CHECK (moderation_status IN ('en_attente', 'valide', 'refuse')),
    moderated_by_user_id bigint REFERENCES users(id),
    moderated_at timestamptz,
    created_at timestamptz NOT NULL DEFAULT now(),
    is_demo boolean NOT NULL DEFAULT false,
    CHECK ((moderation_status = 'en_attente' AND moderated_at IS NULL AND moderated_by_user_id IS NULL)
       OR (moderation_status <> 'en_attente' AND moderated_at IS NOT NULL AND moderated_by_user_id IS NOT NULL))
);
CREATE INDEX reviews_moderation_idx ON reviews(moderation_status);
CREATE INDEX reviews_moderator_idx ON reviews(moderated_by_user_id);
CREATE TABLE opening_hours (
    weekday smallint PRIMARY KEY CHECK (weekday BETWEEN 1 AND 7),
    opens_at time,
    closes_at time,
    is_closed boolean NOT NULL,
    is_demo boolean NOT NULL DEFAULT false,
    CHECK ((is_closed AND opens_at IS NULL AND closes_at IS NULL)
        OR (NOT is_closed AND opens_at IS NOT NULL AND closes_at IS NOT NULL AND closes_at > opens_at))
);
CREATE TABLE email_outbox (
    id bigint GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
    user_id bigint REFERENCES users(id) ON DELETE SET NULL,
    order_id bigint REFERENCES orders(id) ON DELETE RESTRICT,
    kind text NOT NULL CHECK (kind IN ('bienvenue', 'nouvel_employe', 'confirmation_commande', 'retour_materiel', 'demande_avis')),
    recipient text NOT NULL CHECK (recipient LIKE '%_@_%._%'),
    status text NOT NULL DEFAULT 'en_attente' CHECK (status IN ('en_attente', 'envoye', 'echec')),
    created_at timestamptz NOT NULL DEFAULT now(),
    sent_at timestamptz,
    attempts integer NOT NULL DEFAULT 0 CHECK (attempts >= 0)
);
CREATE INDEX email_outbox_pending_idx ON email_outbox(created_at) WHERE status = 'en_attente';
CREATE INDEX email_outbox_user_idx ON email_outbox(user_id);
CREATE INDEX email_outbox_order_idx ON email_outbox(order_id);

CREATE VIEW order_totals AS
SELECT o.id AS order_id, i.net_amount_cents AS menu_total_cents, o.delivery_fee_cents,
       i.net_amount_cents::bigint + o.delivery_fee_cents AS total_cents
FROM orders o JOIN order_items i ON i.order_id = o.id;
COMMENT ON SCHEMA vg IS 'Vite & Gourmand : données métier ; démonstrations explicitement marquées is_demo.';
COMMENT ON COLUMN menus.stock_available IS 'Nombre de commandes possibles, et non de portions ; réservation atomique à implémenter côté serveur.';
COMMENT ON COLUMN order_items.pricing_policy IS 'Règle des personnes supplémentaires à valider ; aucun prorata implicite.';
COMMIT;
