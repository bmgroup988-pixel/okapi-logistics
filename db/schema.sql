-- =============================================================================
-- Okapi Logistics — schéma de référence PostgreSQL 16
-- Version 1.0 — 2026-09-03
-- DDL de référence accompagnant docs/03-modele-de-donnees.md.
-- L'implémentation cible utilise Prisma Migrate ; ce fichier fait foi pour la
-- structure, les contraintes et les index attendus.
-- =============================================================================

-- ------------------------------------------------------------------ Extensions
CREATE EXTENSION IF NOT EXISTS pgcrypto;    -- gen_random_uuid()
CREATE EXTENSION IF NOT EXISTS citext;      -- e-mails insensibles à la casse
CREATE EXTENSION IF NOT EXISTS pg_trgm;     -- recherche floue
CREATE EXTENSION IF NOT EXISTS btree_gist;  -- contraintes d'exclusion sur périodes

-- ------------------------------------------------------------------ Enumérations
CREATE TYPE transport_mode        AS ENUM ('AIR', 'SEA');
-- HANDED_TO_PARTNER ajouté par l'addendum 08 (§3.2) — remise à un partenaire
-- de livraison tiers pour une ville de statut PARTNER.
CREATE TYPE parcel_status         AS ENUM ('ENREGISTRE','EN_TRANSIT','ARRIVE','HANDED_TO_PARTNER','LIVRE','ANNULE','RETOURNE');
CREATE TYPE payment_status        AS ENUM ('IMPAYE','PARTIEL','PAYE');
-- Addendum 08, §1.2 : couverture réseau d'une ville.
CREATE TYPE city_status           AS ENUM ('HUB','PARTNER','PLANNED');
-- Addendum 08, §5.3/§5.4 : partenaires de livraison et réconciliation.
CREATE TYPE settlement_mode       AS ENUM ('PER_KG','PERCENT_COLLECTED');
CREATE TYPE settlement_status     AS ENUM ('DRAFT','VALIDATED','PAID');
CREATE TYPE parcel_contact_role   AS ENUM ('SENDER','RECIPIENT');
CREATE TYPE payment_method        AS ENUM ('MOBILE_MONEY','BANK_TRANSFER','CARD','CASH');
CREATE TYPE payment_state         AS ENUM ('EN_ATTENTE','CONFIRME','ECHOUE','REMBOURSE');
CREATE TYPE document_type         AS ENUM ('LABEL','REGISTRATION_RECEIPT','PAYMENT_RECEIPT','INVOICE','CREDIT_NOTE');
CREATE TYPE fx_rate_source        AS ENUM ('MANUAL','API');
CREATE TYPE notification_channel  AS ENUM ('SMS','WHATSAPP','EMAIL');
CREATE TYPE notification_status   AS ENUM ('FILE','ENVOYE','LIVRE','ECHEC');
CREATE TYPE notification_trigger  AS ENUM ('STATUS_CHANGE','PAYMENT_RECEIVED','UNPAID_ON_ARRIVAL','DUNNING_REMINDER','DELIVERED');
CREATE TYPE audit_action          AS ENUM ('CREATE','UPDATE','DELETE','LOGIN','LOGIN_FAILED','TRANSITION','REFUND','EXPORT','CONFIG_CHANGE','GDPR_ACCESS','GDPR_ERASURE');
CREATE TYPE erasure_status        AS ENUM ('RECU','EN_COURS','TERMINE','REFUSE');
CREATE TYPE setting_scope         AS ENUM ('GLOBAL','COUNTRY','AGENCY');

-- ------------------------------------------------------------------ Fonctions transverses
CREATE OR REPLACE FUNCTION set_updated_at() RETURNS trigger AS $$
BEGIN
  NEW.updated_at := now();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

-- =============================================================================
-- DOMAINE : RÉFÉRENTIEL & CONFIGURATION
-- =============================================================================

CREATE TABLE currencies (
  code            char(3)      PRIMARY KEY,                 -- ISO 4217
  name_key        text         NOT NULL,
  symbol          text         NOT NULL,
  decimal_digits  smallint     NOT NULL DEFAULT 2 CHECK (decimal_digits BETWEEN 0 AND 4),
  rounding_mode   text         NOT NULL DEFAULT 'HALF_UP',
  is_active       boolean      NOT NULL DEFAULT true,
  is_reference    boolean      NOT NULL DEFAULT false,
  created_at      timestamptz  NOT NULL DEFAULT now(),
  updated_at      timestamptz  NOT NULL DEFAULT now()
);
-- Exactement une devise de référence.
CREATE UNIQUE INDEX uq_currency_reference ON currencies ((is_reference)) WHERE is_reference;
CREATE TRIGGER trg_currencies_updated BEFORE UPDATE ON currencies
  FOR EACH ROW EXECUTE FUNCTION set_updated_at();

CREATE TABLE countries (
  id                     uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  iso2                   char(2) NOT NULL UNIQUE,
  name_key               text    NOT NULL,
  default_currency       char(3) NOT NULL REFERENCES currencies(code),
  default_locale         text    NOT NULL DEFAULT 'fr',
  phone_prefix           text,
  tax_rate               numeric(6,4) NOT NULL DEFAULT 0 CHECK (tax_rate >= 0),
  unpaid_delivery_policy text    NOT NULL DEFAULT 'derogation'
                                 CHECK (unpaid_delivery_policy IN ('strict','derogation')),
  data_residency_region  text,
  is_active              boolean NOT NULL DEFAULT true,
  created_at             timestamptz NOT NULL DEFAULT now(),
  updated_at             timestamptz NOT NULL DEFAULT now(),
  deleted_at             timestamptz
);
CREATE TRIGGER trg_countries_updated BEFORE UPDATE ON countries
  FOR EACH ROW EXECUTE FUNCTION set_updated_at();

CREATE TABLE cities (
  id             uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  country_id     uuid NOT NULL REFERENCES countries(id),
  code           char(3) NOT NULL,                 -- code inséré dans le n° de suivi
  name_key       text    NOT NULL,
  timezone       text    NOT NULL,
  -- Addendum 08, §1.2 : HUB (agence propre) / PARTNER (livreur tiers) / PLANNED.
  status         city_status NOT NULL DEFAULT 'PLANNED',
  is_origin      boolean NOT NULL DEFAULT true,
  is_destination boolean NOT NULL DEFAULT true,
  is_active      boolean NOT NULL DEFAULT true,
  created_at     timestamptz NOT NULL DEFAULT now(),
  updated_at     timestamptz NOT NULL DEFAULT now(),
  deleted_at     timestamptz,
  CONSTRAINT uq_city_code UNIQUE (code)             -- unicité globale (cf. doc 03, Q5)
);
CREATE INDEX ix_cities_country ON cities(country_id);
CREATE INDEX ix_cities_status  ON cities(status);
CREATE TRIGGER trg_cities_updated BEFORE UPDATE ON cities
  FOR EACH ROW EXECUTE FUNCTION set_updated_at();

CREATE TABLE agencies (
  id               uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  code             text NOT NULL UNIQUE,
  name             text NOT NULL,
  city_id          uuid NOT NULL REFERENCES cities(id),
  country_id       uuid NOT NULL REFERENCES countries(id),
  billing_currency char(3) NOT NULL REFERENCES currencies(code),
  address          text,
  email            citext,
  phone            text,
  timezone         text NOT NULL,
  is_active        boolean NOT NULL DEFAULT true,
  created_at       timestamptz NOT NULL DEFAULT now(),
  updated_at       timestamptz NOT NULL DEFAULT now(),
  deleted_at       timestamptz
);
CREATE INDEX ix_agencies_country ON agencies(country_id);
CREATE TRIGGER trg_agencies_updated BEFORE UPDATE ON agencies
  FOR EACH ROW EXECUTE FUNCTION set_updated_at();

CREATE TABLE corridors (
  id                     uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  origin_country_id      uuid NOT NULL REFERENCES countries(id),
  destination_country_id uuid NOT NULL REFERENCES countries(id),
  label_key              text,
  is_active              boolean NOT NULL DEFAULT true,
  created_at             timestamptz NOT NULL DEFAULT now(),
  updated_at             timestamptz NOT NULL DEFAULT now(),
  CONSTRAINT uq_corridor UNIQUE (origin_country_id, destination_country_id)
);
CREATE TRIGGER trg_corridors_updated BEFORE UPDATE ON corridors
  FOR EACH ROW EXECUTE FUNCTION set_updated_at();

CREATE TABLE tariffs (
  id                  uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  corridor_id         uuid REFERENCES corridors(id),
  origin_city_id      uuid REFERENCES cities(id),
  destination_city_id uuid REFERENCES cities(id),
  mode                transport_mode NOT NULL,
  currency            char(3) NOT NULL REFERENCES currencies(code),
  fixed_fee           numeric(18,4) NOT NULL DEFAULT 0 CHECK (fixed_fee   >= 0),
  price_per_kg        numeric(18,4) NOT NULL DEFAULT 0 CHECK (price_per_kg >= 0),
  min_charge          numeric(18,4) NOT NULL DEFAULT 0 CHECK (min_charge  >= 0),
  ad_valorem_enabled  boolean NOT NULL DEFAULT false,
  ad_valorem_rate     numeric(6,4) NOT NULL DEFAULT 0 CHECK (ad_valorem_rate >= 0),
  override_min        numeric(6,4) NOT NULL DEFAULT 0,
  override_max        numeric(6,4) NOT NULL DEFAULT 0,
  validity            daterange NOT NULL DEFAULT daterange(CURRENT_DATE, NULL, '[)'),
  created_by          uuid,
  created_at          timestamptz NOT NULL DEFAULT now(),
  updated_at          timestamptz NOT NULL DEFAULT now(),
  CONSTRAINT ck_tariff_target CHECK (
    corridor_id IS NOT NULL
    OR (origin_city_id IS NOT NULL AND destination_city_id IS NOT NULL)
  ),
  -- Pas deux tarifs qui se chevauchent pour la même cible ville->ville + mode.
  CONSTRAINT ex_tariff_city_overlap EXCLUDE USING gist (
    origin_city_id      WITH =,
    destination_city_id WITH =,
    mode                WITH =,
    validity            WITH &&
  ) WHERE (origin_city_id IS NOT NULL)
);
CREATE INDEX ix_tariffs_corridor ON tariffs(corridor_id);
CREATE TRIGGER trg_tariffs_updated BEFORE UPDATE ON tariffs
  FOR EACH ROW EXECUTE FUNCTION set_updated_at();

-- Addendum 08, §1.4 : partenaire de livraison tiers pour une ville PARTNER.
-- Plusieurs partenaires actifs peuvent desservir la même ville (zones
-- différentes) ; aucune contrainte d'unicité sur city_id.
CREATE TABLE delivery_partners (
  id               uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  city_id          uuid NOT NULL REFERENCES cities(id),
  name             text NOT NULL,
  coverage_zone    text,
  contact_name     text,
  contact_phone    text,
  contact_email    citext,
  commission_pct   numeric(6,4),
  settlement_mode  settlement_mode NOT NULL DEFAULT 'PER_KG',
  reliability_note text,
  is_preferred     boolean NOT NULL DEFAULT false,
  is_active        boolean NOT NULL DEFAULT true,
  created_at       timestamptz NOT NULL DEFAULT now(),
  updated_at       timestamptz NOT NULL DEFAULT now()
);
CREATE INDEX ix_delivery_partners_city_active ON delivery_partners(city_id, is_active);
CREATE TRIGGER trg_delivery_partners_updated BEFORE UPDATE ON delivery_partners
  FOR EACH ROW EXECUTE FUNCTION set_updated_at();

-- Addendum 08, §1.5 : tarif de la dernière étape (hub -> destinataire) d'un
-- partenaire donné. Distinct de `tariffs` (trajet principal jusqu'au hub).
CREATE TABLE partner_tariffs (
  id                   uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  delivery_partner_id  uuid NOT NULL REFERENCES delivery_partners(id) ON DELETE CASCADE,
  price_per_kg         numeric(18,4) NOT NULL CHECK (price_per_kg >= 0),
  currency_code        char(3) NOT NULL REFERENCES currencies(code),
  min_weight_kg        numeric(10,2),
  is_active            boolean NOT NULL DEFAULT true,
  effective_from       date NOT NULL DEFAULT CURRENT_DATE,
  effective_to         date,
  created_at           timestamptz NOT NULL DEFAULT now(),
  updated_at           timestamptz NOT NULL DEFAULT now()
);
CREATE INDEX ix_partner_tariffs_partner ON partner_tariffs(delivery_partner_id, is_active, effective_from);
CREATE TRIGGER trg_partner_tariffs_updated BEFORE UPDATE ON partner_tariffs
  FOR EACH ROW EXECUTE FUNCTION set_updated_at();

-- Addendum 08, §5 : réconciliation périodique des commissions dues à un
-- partenaire (générée depuis les colis LIVRE avec delivery_partner_id renseigné).
CREATE TABLE partner_settlements (
  id                      uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  delivery_partner_id     uuid NOT NULL REFERENCES delivery_partners(id),
  period_start            date NOT NULL,
  period_end              date NOT NULL,
  parcel_count            integer NOT NULL CHECK (parcel_count >= 0),
  total_collected_amount  numeric(18,4) NOT NULL,
  commission_amount       numeric(18,4) NOT NULL,
  currency_code           char(3) NOT NULL REFERENCES currencies(code),
  status                  settlement_status NOT NULL DEFAULT 'DRAFT',
  validated_by_user_id    uuid,
  paid_at                 timestamptz,
  payment_reference       text,
  created_at              timestamptz NOT NULL DEFAULT now(),
  updated_at              timestamptz NOT NULL DEFAULT now(),
  CONSTRAINT ck_settlement_period CHECK (period_end >= period_start)
);
CREATE INDEX ix_partner_settlements_partner_period ON partner_settlements(delivery_partner_id, period_start, period_end);
CREATE TRIGGER trg_partner_settlements_updated BEFORE UPDATE ON partner_settlements
  FOR EACH ROW EXECUTE FUNCTION set_updated_at();

CREATE TABLE exchange_rates (
  id             uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  base_currency  char(3) NOT NULL REFERENCES currencies(code),
  quote_currency char(3) NOT NULL REFERENCES currencies(code),
  rate           numeric(18,8) NOT NULL CHECK (rate > 0),
  source         fx_rate_source NOT NULL,
  provider       text,
  effective_from timestamptz NOT NULL,
  created_by     uuid,
  created_at     timestamptz NOT NULL DEFAULT now(),
  CONSTRAINT ck_fx_distinct CHECK (base_currency <> quote_currency),
  CONSTRAINT uq_fx UNIQUE (base_currency, quote_currency, effective_from)
);
-- Lookup du taux applicable à une date.
CREATE INDEX ix_fx_lookup ON exchange_rates (base_currency, quote_currency, effective_from DESC);

CREATE TABLE settings (
  id         uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  scope      setting_scope NOT NULL,
  scope_id   uuid,                                -- countries.id / agencies.id / NULL si GLOBAL
  key        text NOT NULL,
  value      jsonb NOT NULL,
  updated_by uuid,
  updated_at timestamptz NOT NULL DEFAULT now(),
  CONSTRAINT uq_setting UNIQUE (scope, scope_id, key),
  CONSTRAINT ck_setting_scope CHECK (
    (scope = 'GLOBAL' AND scope_id IS NULL) OR
    (scope <> 'GLOBAL' AND scope_id IS NOT NULL)
  )
);

CREATE TABLE content_blocks (
  id          uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  key         text NOT NULL UNIQUE,
  description text
);

CREATE TABLE content_translations (
  id               uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  content_block_id uuid NOT NULL REFERENCES content_blocks(id) ON DELETE CASCADE,
  locale           text NOT NULL,
  value            text NOT NULL,
  updated_by       uuid,
  updated_at       timestamptz NOT NULL DEFAULT now(),
  CONSTRAINT uq_content_translation UNIQUE (content_block_id, locale)
);

CREATE TABLE notification_templates (
  id        uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  trigger   notification_trigger NOT NULL,
  channel   notification_channel NOT NULL,
  locale    text NOT NULL,
  subject   text,
  body      text NOT NULL,
  is_active boolean NOT NULL DEFAULT true,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  CONSTRAINT uq_notif_template UNIQUE (trigger, channel, locale)
);
CREATE TRIGGER trg_notif_template_updated BEFORE UPDATE ON notification_templates
  FOR EACH ROW EXECUTE FUNCTION set_updated_at();

-- =============================================================================
-- DOMAINE : IDENTITÉ & SÉCURITÉ
-- =============================================================================

CREATE TABLE users (
  id                 uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  email              citext NOT NULL UNIQUE,
  password_hash      text   NOT NULL,
  full_name          text   NOT NULL,
  phone              text,
  default_locale     text   NOT NULL DEFAULT 'fr',
  totp_secret_enc    text,
  totp_enabled       boolean NOT NULL DEFAULT false,
  is_active          boolean NOT NULL DEFAULT true,
  failed_login_count integer NOT NULL DEFAULT 0,
  locked_until       timestamptz,
  last_login_at      timestamptz,
  created_by         uuid,
  updated_by         uuid,
  created_at         timestamptz NOT NULL DEFAULT now(),
  updated_at         timestamptz NOT NULL DEFAULT now(),
  deleted_at         timestamptz
);
CREATE TRIGGER trg_users_updated BEFORE UPDATE ON users
  FOR EACH ROW EXECUTE FUNCTION set_updated_at();

CREATE TABLE roles (
  id        uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  code      text NOT NULL UNIQUE,
  name_key  text NOT NULL,
  is_system boolean NOT NULL DEFAULT false
);

CREATE TABLE permissions (
  code        text PRIMARY KEY,
  description text NOT NULL
);

CREATE TABLE role_permissions (
  role_id         uuid NOT NULL REFERENCES roles(id) ON DELETE CASCADE,
  permission_code text NOT NULL REFERENCES permissions(code) ON DELETE CASCADE,
  PRIMARY KEY (role_id, permission_code)
);

CREATE TABLE user_roles (
  id               uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id          uuid NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  role_id          uuid NOT NULL REFERENCES roles(id),
  scope_country_id uuid REFERENCES countries(id),
  scope_agency_id  uuid REFERENCES agencies(id),
  created_by       uuid,
  created_at       timestamptz NOT NULL DEFAULT now(),
  CONSTRAINT uq_user_role UNIQUE (
    user_id, role_id,
    COALESCE(scope_country_id, '00000000-0000-0000-0000-000000000000'::uuid),
    COALESCE(scope_agency_id,  '00000000-0000-0000-0000-000000000000'::uuid)
  )
);
CREATE INDEX ix_user_roles_user ON user_roles(user_id);

CREATE TABLE user_sessions (
  id                 uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id            uuid NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  refresh_token_hash text NOT NULL UNIQUE,
  replaced_by_id     uuid REFERENCES user_sessions(id),
  user_agent         text,
  ip                 inet,
  expires_at         timestamptz NOT NULL,
  revoked_at         timestamptz,
  created_at         timestamptz NOT NULL DEFAULT now()
);
CREATE INDEX ix_sessions_user ON user_sessions(user_id);

CREATE TABLE password_reset_tokens (
  id         uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id    uuid NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  token_hash text NOT NULL UNIQUE,
  expires_at timestamptz NOT NULL,
  used_at    timestamptz,
  created_at timestamptz NOT NULL DEFAULT now()
);

-- Append-only : révoquer UPDATE/DELETE au rôle applicatif via GRANT.
CREATE TABLE audit_logs (
  id            uuid NOT NULL DEFAULT gen_random_uuid(),
  actor_user_id uuid REFERENCES users(id),
  actor_label   text,
  action        audit_action NOT NULL,
  entity_type   text NOT NULL,
  entity_id     uuid,
  before        jsonb,
  after         jsonb,
  ip            inet,
  request_id    text,
  created_at    timestamptz NOT NULL DEFAULT now(),
  PRIMARY KEY (id, created_at)
) PARTITION BY RANGE (created_at);
CREATE INDEX ix_audit_entity ON audit_logs (entity_type, entity_id, created_at);
CREATE INDEX ix_audit_actor  ON audit_logs (actor_user_id, created_at);
-- Exemple de partition (créées mensuellement par un job de maintenance) :
CREATE TABLE audit_logs_2026_09 PARTITION OF audit_logs
  FOR VALUES FROM ('2026-09-01') TO ('2026-10-01');

CREATE TABLE idempotency_keys (
  key                 text PRIMARY KEY,
  user_id             uuid REFERENCES users(id),
  request_fingerprint text NOT NULL,
  response_status     integer,
  response_snapshot   jsonb,
  created_at          timestamptz NOT NULL DEFAULT now(),
  expires_at          timestamptz NOT NULL
);
CREATE INDEX ix_idempotency_expiry ON idempotency_keys(expires_at);

-- =============================================================================
-- DOMAINE : COLIS
-- =============================================================================

CREATE TABLE parcels (
  id                     uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  tracking_number        text NOT NULL UNIQUE,
  registration_agency_id uuid NOT NULL REFERENCES agencies(id),
  registration_agent_id  uuid NOT NULL REFERENCES users(id),
  country_id             uuid NOT NULL REFERENCES countries(id),
  origin_city_id         uuid NOT NULL REFERENCES cities(id),
  destination_city_id    uuid NOT NULL REFERENCES cities(id),
  destination_city_code  char(3) NOT NULL,
  -- Addendum 08, §3.1 : agence de destination (si ville HUB), agence de
  -- transbordement, partenaire de livraison retenu (si ville PARTNER).
  destination_agency_id  uuid REFERENCES agencies(id),
  transit_agency_id      uuid REFERENCES agencies(id),
  delivery_partner_id    uuid REFERENCES delivery_partners(id),
  transport_mode         transport_mode NOT NULL,
  weight_kg              numeric(10,2) NOT NULL CHECK (weight_kg > 0),
  content_nature         text NOT NULL,
  declared_value          numeric(18,4) NOT NULL DEFAULT 0 CHECK (declared_value >= 0),
  declared_value_currency char(3) NOT NULL REFERENCES currencies(code),
  billing_currency       char(3) NOT NULL REFERENCES currencies(code),
  status                 parcel_status  NOT NULL DEFAULT 'ENREGISTRE',
  payment_status         payment_status NOT NULL DEFAULT 'IMPAYE',
  amount_due             numeric(18,4) NOT NULL CHECK (amount_due >= 0),
  amount_paid            numeric(18,4) NOT NULL DEFAULT 0 CHECK (amount_paid >= 0),
  -- Colonne normale (pas GENERATED) : Prisma Client ne sait pas omettre un
  -- champ ayant un défaut applicatif, il écrit donc toujours `balance` — ce
  -- qu'une colonne GENERATED ALWAYS refuse. Cohérence garantie à la place par
  -- ck_parcel_balance (CHECK) ; toujours écrite explicitement par l'API.
  balance                numeric(18,4) NOT NULL DEFAULT 0,
  reference_currency     char(3) NOT NULL REFERENCES currencies(code),
  amount_due_reference   numeric(18,4) NOT NULL,
  fx_rate_due            numeric(18,8) NOT NULL,
  exchange_rate_id_due   uuid REFERENCES exchange_rates(id),
  pricing_override_pct   numeric(6,4) NOT NULL DEFAULT 0,
  pricing_snapshot       jsonb NOT NULL,
  consent_given          boolean NOT NULL DEFAULT false,
  consent_text_version   text,
  consent_at             timestamptz,
  client_channel         notification_channel,
  client_locale          text NOT NULL DEFAULT 'fr',
  cancel_reason          text,
  delivered_at           timestamptz,
  created_by             uuid,
  updated_by             uuid,
  created_at             timestamptz NOT NULL DEFAULT now(),
  updated_at             timestamptz NOT NULL DEFAULT now(),
  CONSTRAINT ck_parcel_cancel_reason CHECK (status <> 'ANNULE' OR cancel_reason IS NOT NULL),
  CONSTRAINT ck_parcel_balance CHECK (balance = amount_due - amount_paid)
);
CREATE INDEX ix_parcels_agency_created  ON parcels (registration_agency_id, created_at DESC);
CREATE INDEX ix_parcels_dashboard       ON parcels (country_id, status, payment_status, created_at);
CREATE INDEX ix_parcels_tracking_trgm   ON parcels USING gin (tracking_number gin_trgm_ops);
CREATE INDEX ix_parcels_status_unpaid   ON parcels (status, payment_status)
  WHERE payment_status IN ('IMPAYE','PARTIEL');
CREATE INDEX ix_parcels_destination_agency ON parcels (destination_agency_id);
CREATE INDEX ix_parcels_delivery_partner   ON parcels (delivery_partner_id);
CREATE TRIGGER trg_parcels_updated BEFORE UPDATE ON parcels
  FOR EACH ROW EXECUTE FUNCTION set_updated_at();

CREATE TABLE parcel_contacts (
  id             uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  parcel_id      uuid NOT NULL REFERENCES parcels(id) ON DELETE CASCADE,
  role           parcel_contact_role NOT NULL,
  name           text NOT NULL,
  phone          text,
  email          citext,
  address        text,
  city_label     text,
  country_label  text,
  id_document_ref text,                              -- PII sensible : chiffrée applicativement
  anonymized     boolean NOT NULL DEFAULT false,
  anonymized_at  timestamptz,
  created_at     timestamptz NOT NULL DEFAULT now(),
  updated_at     timestamptz NOT NULL DEFAULT now(),
  CONSTRAINT uq_parcel_contact UNIQUE (parcel_id, role)
);
CREATE INDEX ix_contacts_phone     ON parcel_contacts(phone);
CREATE INDEX ix_contacts_email     ON parcel_contacts(email);
CREATE INDEX ix_contacts_name_trgm ON parcel_contacts USING gin (name gin_trgm_ops);
CREATE TRIGGER trg_contacts_updated BEFORE UPDATE ON parcel_contacts
  FOR EACH ROW EXECUTE FUNCTION set_updated_at();

CREATE TABLE parcel_photos (
  id              uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  parcel_id       uuid NOT NULL REFERENCES parcels(id),
  storage_key     text UNIQUE,                       -- NULL après purge RGPD
  derivative_keys jsonb,
  sha256          char(64) NOT NULL,
  bytes           integer  NOT NULL,
  mime_type       text     NOT NULL,
  width           integer,
  height          integer,
  is_primary      boolean  NOT NULL DEFAULT false,
  taken_by        uuid     NOT NULL REFERENCES users(id),
  taken_at        timestamptz NOT NULL DEFAULT now(),
  exif_stripped   boolean  NOT NULL DEFAULT false,
  locked          boolean  NOT NULL DEFAULT false,
  created_at      timestamptz NOT NULL DEFAULT now()
);
CREATE UNIQUE INDEX uq_parcel_primary_photo ON parcel_photos (parcel_id) WHERE is_primary;
CREATE INDEX ix_photos_parcel ON parcel_photos(parcel_id);

CREATE TABLE parcel_events (
  id                uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  parcel_id         uuid NOT NULL REFERENCES parcels(id),
  status            parcel_status NOT NULL,
  location_city_id  uuid REFERENCES cities(id),
  location_label    text,
  note              text,
  visible_to_client boolean NOT NULL DEFAULT true,
  created_by        uuid REFERENCES users(id),
  created_at        timestamptz NOT NULL DEFAULT now()
);
CREATE INDEX ix_events_parcel ON parcel_events (parcel_id, created_at);

-- =============================================================================
-- DOMAINE : PAIEMENT & FACTURATION
-- =============================================================================

CREATE TABLE payments (
  id                         uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  parcel_id                  uuid NOT NULL REFERENCES parcels(id),
  amount                     numeric(18,4) NOT NULL CHECK (amount > 0),
  currency                   char(3) NOT NULL REFERENCES currencies(code),
  amount_in_billing_currency numeric(18,4) NOT NULL,
  billing_currency           char(3) NOT NULL REFERENCES currencies(code),
  amount_reference           numeric(18,4) NOT NULL,
  reference_currency         char(3) NOT NULL REFERENCES currencies(code),
  fx_rate                    numeric(18,8) NOT NULL,
  fx_rate_to_billing         numeric(18,8) NOT NULL,
  exchange_rate_id           uuid REFERENCES exchange_rates(id),
  method                     payment_method NOT NULL,
  mobile_money_provider      text,
  external_ref               text,
  state                      payment_state NOT NULL DEFAULT 'EN_ATTENTE',
  confirmed_at               timestamptz,
  failure_reason             text,
  refund_of_payment_id       uuid REFERENCES payments(id),
  refund_reason              text,
  collected_by               uuid NOT NULL REFERENCES users(id),
  agency_id                  uuid NOT NULL REFERENCES agencies(id),
  country_id                 uuid NOT NULL REFERENCES countries(id),
  received_at                timestamptz NOT NULL DEFAULT now(),
  idempotency_key            text,
  created_by                 uuid,
  created_at                 timestamptz NOT NULL DEFAULT now(),
  updated_at                 timestamptz NOT NULL DEFAULT now(),
  CONSTRAINT ck_pay_mm_provider CHECK (method <> 'MOBILE_MONEY' OR mobile_money_provider IS NOT NULL),
  CONSTRAINT ck_pay_refund_reason CHECK (refund_of_payment_id IS NULL OR refund_reason IS NOT NULL)
);
CREATE INDEX ix_pay_parcel   ON payments (parcel_id, received_at);
CREATE INDEX ix_pay_agency   ON payments (agency_id, received_at);
CREATE INDEX ix_pay_country  ON payments (country_id, received_at);
CREATE INDEX ix_pay_state    ON payments (state);
CREATE INDEX ix_pay_method   ON payments (method);
CREATE TRIGGER trg_payments_updated BEFORE UPDATE ON payments
  FOR EACH ROW EXECUTE FUNCTION set_updated_at();

-- Recalcul du solde et du statut de paiement du colis (RG-03).
CREATE OR REPLACE FUNCTION recompute_parcel_balance() RETURNS trigger AS $$
DECLARE
  v_parcel_id uuid := COALESCE(NEW.parcel_id, OLD.parcel_id);
  v_paid      numeric(18,4);
  v_due       numeric(18,4);
BEGIN
  PERFORM 1 FROM parcels WHERE id = v_parcel_id FOR UPDATE;

  SELECT
    COALESCE(SUM(amount_in_billing_currency) FILTER (WHERE state = 'CONFIRME'), 0)
    - COALESCE(SUM(amount_in_billing_currency) FILTER (WHERE state = 'REMBOURSE'), 0)
  INTO v_paid
  FROM payments
  WHERE parcel_id = v_parcel_id;

  SELECT amount_due INTO v_due FROM parcels WHERE id = v_parcel_id;

  UPDATE parcels
  SET amount_paid = GREATEST(v_paid, 0),
      balance = v_due - GREATEST(v_paid, 0),
      payment_status = CASE
        WHEN v_due <= 0                THEN 'PAYE'
        WHEN GREATEST(v_paid,0) >= v_due THEN 'PAYE'
        WHEN GREATEST(v_paid,0) > 0    THEN 'PARTIEL'
        ELSE 'IMPAYE'
      END,
      updated_at = now()
  WHERE id = v_parcel_id;

  RETURN NULL;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER trg_payment_recompute
  AFTER INSERT OR UPDATE OF state, amount_in_billing_currency OR DELETE ON payments
  FOR EACH ROW EXECUTE FUNCTION recompute_parcel_balance();

-- Pièces comptables (append-only : révoquer UPDATE/DELETE au rôle applicatif).
CREATE TABLE invoices (
  id                       uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  parcel_id                uuid NOT NULL REFERENCES parcels(id),
  type                     document_type NOT NULL,
  number                   text NOT NULL,
  country_id               uuid NOT NULL REFERENCES countries(id),
  payment_id               uuid REFERENCES payments(id),
  amount_net               numeric(18,4) NOT NULL,
  amount_tax               numeric(18,4) NOT NULL DEFAULT 0,
  amount_gross             numeric(18,4) NOT NULL,
  currency                 char(3) NOT NULL REFERENCES currencies(code),
  amount_reference         numeric(18,4) NOT NULL,
  reference_currency       char(3) NOT NULL REFERENCES currencies(code),
  fx_rate                  numeric(18,8) NOT NULL,
  issued_at                timestamptz NOT NULL DEFAULT now(),
  issued_by                uuid REFERENCES users(id),
  legal_mentions_snapshot  jsonb NOT NULL,
  created_at               timestamptz NOT NULL DEFAULT now(),
  CONSTRAINT uq_invoice_number UNIQUE (country_id, type, number),
  CONSTRAINT ck_invoice_type CHECK (type IN
    ('REGISTRATION_RECEIPT','PAYMENT_RECEIPT','INVOICE','CREDIT_NOTE'))
);
CREATE INDEX ix_invoices_parcel ON invoices(parcel_id);

CREATE TABLE documents (
  id               uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  parcel_id        uuid NOT NULL REFERENCES parcels(id),
  payment_id       uuid REFERENCES payments(id),
  invoice_id       uuid REFERENCES invoices(id),
  type             document_type NOT NULL,
  storage_key      text NOT NULL UNIQUE,
  number           text,
  checksum_sha256  char(64),
  generated_at     timestamptz NOT NULL DEFAULT now(),
  created_at       timestamptz NOT NULL DEFAULT now()
);
CREATE INDEX ix_documents_parcel ON documents(parcel_id);

-- =============================================================================
-- DOMAINE : NOTIFICATIONS
-- =============================================================================

CREATE TABLE notifications (
  id                  uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  parcel_id           uuid REFERENCES parcels(id),
  trigger             notification_trigger NOT NULL,
  channel             notification_channel NOT NULL,
  template_id         uuid REFERENCES notification_templates(id),
  locale              text NOT NULL,
  recipient           text NOT NULL,
  subject             text,
  body_preview        text,
  status              notification_status NOT NULL DEFAULT 'FILE',
  provider            text,
  provider_message_id text,
  error               text,
  attempts            smallint NOT NULL DEFAULT 0,
  scheduled_for       timestamptz,
  sent_at             timestamptz,
  delivered_at        timestamptz,
  created_at          timestamptz NOT NULL DEFAULT now()
);
CREATE INDEX ix_notif_parcel   ON notifications (parcel_id, created_at);
CREATE INDEX ix_notif_schedule ON notifications (status, scheduled_for);

-- =============================================================================
-- DOMAINE : SÉQUENCES & NUMÉROTATION
-- =============================================================================

CREATE TABLE sequences (
  scope_type text NOT NULL,     -- 'tracking','invoice','payment_receipt',...
  scope_key  text NOT NULL,     -- 'GLOBAL' | code ville | 'country:FR' ...
  period     text NOT NULL,     -- 'AAMM' | 'AAAA' | 'ALL'
  last_value bigint NOT NULL DEFAULT 0,
  updated_at timestamptz NOT NULL DEFAULT now(),
  PRIMARY KEY (scope_type, scope_key, period)
);

-- Attribution atomique du prochain numéro.
CREATE OR REPLACE FUNCTION next_sequence_value(p_scope_type text, p_scope_key text, p_period text)
RETURNS bigint AS $$
DECLARE v bigint;
BEGIN
  INSERT INTO sequences (scope_type, scope_key, period, last_value)
  VALUES (p_scope_type, p_scope_key, p_period, 1)
  ON CONFLICT (scope_type, scope_key, period)
  DO UPDATE SET last_value = sequences.last_value + 1, updated_at = now()
  RETURNING last_value INTO v;
  RETURN v;
END;
$$ LANGUAGE plpgsql;

-- Composition du numéro de suivi (EF-ENR-07 / EF-ENR-08).
CREATE OR REPLACE FUNCTION build_tracking_number(p_city_code char(3), p_scope_key text)
RETURNS text AS $$
DECLARE
  yymm text := to_char(now() AT TIME ZONE 'UTC', 'YYMM');
  seq  bigint := next_sequence_value('tracking', p_scope_key, yymm);
BEGIN
  RETURN 'OKP' || yymm || lpad(seq::text, 4, '0') || p_city_code;
END;
$$ LANGUAGE plpgsql;

-- =============================================================================
-- DOMAINE : RGPD & RÉTENTION
-- =============================================================================

CREATE TABLE consents (
  id                uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  parcel_contact_id uuid REFERENCES parcel_contacts(id) ON DELETE SET NULL,
  parcel_id         uuid REFERENCES parcels(id) ON DELETE SET NULL,
  subject_ref       text NOT NULL,
  purpose           text NOT NULL,
  text_version      text NOT NULL,
  channel           text,
  given             boolean NOT NULL,
  given_at          timestamptz NOT NULL DEFAULT now(),
  withdrawn_at      timestamptz,
  created_at        timestamptz NOT NULL DEFAULT now()
);
CREATE INDEX ix_consents_subject ON consents(subject_ref);

CREATE TABLE retention_policies (
  id               uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  category         text NOT NULL,
  retention_months integer NOT NULL CHECK (retention_months > 0),
  action           text NOT NULL CHECK (action IN ('ANONYMIZE','DELETE')),
  country_id       uuid REFERENCES countries(id),
  updated_by       uuid,
  updated_at       timestamptz NOT NULL DEFAULT now(),
  CONSTRAINT uq_retention UNIQUE (category, country_id)
);

CREATE TABLE data_erasure_requests (
  id               uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  subject_ref      text NOT NULL,
  requested_by     text,
  received_at      timestamptz NOT NULL DEFAULT now(),
  status           erasure_status NOT NULL DEFAULT 'RECU',
  handled_by       uuid REFERENCES users(id),
  affected_parcels jsonb,
  notes            text,
  completed_at     timestamptz
);
CREATE INDEX ix_erasure_subject ON data_erasure_requests(subject_ref);

CREATE TABLE data_access_requests (
  id                 uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  subject_ref        text NOT NULL,
  requested_by       text,
  received_at        timestamptz NOT NULL DEFAULT now(),
  status             erasure_status NOT NULL DEFAULT 'RECU',
  handled_by         uuid REFERENCES users(id),
  export_document_id uuid REFERENCES documents(id),
  completed_at       timestamptz
);

-- =============================================================================
-- VUES
-- =============================================================================

CREATE VIEW v_parcel_financials AS
SELECT
  p.id,
  p.tracking_number,
  p.billing_currency,
  p.amount_due,
  COALESCE(SUM(pay.amount_in_billing_currency) FILTER (WHERE pay.state = 'CONFIRME'), 0)
    - COALESCE(SUM(pay.amount_in_billing_currency) FILTER (WHERE pay.state = 'REMBOURSE'), 0)
      AS amount_paid_calc,
  p.amount_paid AS amount_paid_stored,
  p.balance,
  CASE
    WHEN p.amount_due <= 0 THEN 'PAYE'
    WHEN COALESCE(SUM(pay.amount_in_billing_currency) FILTER (WHERE pay.state = 'CONFIRME'), 0) >= p.amount_due THEN 'PAYE'
    WHEN COALESCE(SUM(pay.amount_in_billing_currency) FILTER (WHERE pay.state = 'CONFIRME'), 0) > 0 THEN 'PARTIEL'
    ELSE 'IMPAYE'
  END AS payment_status_calc
FROM parcels p
LEFT JOIN payments pay ON pay.parcel_id = p.id
GROUP BY p.id;

CREATE MATERIALIZED VIEW mv_revenue_by_currency AS
SELECT
  pay.country_id,
  pay.agency_id,
  pay.currency,
  date_trunc('day', pay.received_at) AS day,
  SUM(pay.amount)           FILTER (WHERE pay.state = 'CONFIRME') AS revenue_origin_ccy,
  SUM(pay.amount_reference) FILTER (WHERE pay.state = 'CONFIRME') AS revenue_reference_ccy,
  COUNT(*)                  FILTER (WHERE pay.state = 'CONFIRME') AS payments_count
FROM payments pay
GROUP BY pay.country_id, pay.agency_id, pay.currency, day;
CREATE UNIQUE INDEX uq_mv_revenue ON mv_revenue_by_currency (country_id, agency_id, currency, day);

CREATE VIEW v_unpaid_on_transit AS
SELECT p.*, (p.status = 'ARRIVE') AS at_destination
FROM parcels p
WHERE p.status IN ('EN_TRANSIT','ARRIVE')
  AND p.payment_status IN ('IMPAYE','PARTIEL');

-- =============================================================================
-- SÉCURITÉ AU NIVEAU LIGNE (optionnel — défense en profondeur, ADR-011)
-- =============================================================================
-- Activer par table opérationnelle ; l'application pose :
--   SET app.user_id = '...'; SET app.scope_country_ids = '{...}'; SET app.scope_agency_ids = '{...}';
--   SET app.is_global = 'on'|'off';
--
-- ALTER TABLE parcels ENABLE ROW LEVEL SECURITY;
-- CREATE POLICY parcels_scope ON parcels USING (
--   current_setting('app.is_global', true) = 'on'
--   OR registration_agency_id = ANY (string_to_array(current_setting('app.scope_agency_ids', true), ',')::uuid[])
--   OR country_id            = ANY (string_to_array(current_setting('app.scope_country_ids', true), ',')::uuid[])
-- );
-- (idem pour payments, parcel_contacts, documents, invoices, notifications…)

-- =============================================================================
-- GRANTS (extrait — rôle applicatif à privilèges minimaux)
-- =============================================================================
-- CREATE ROLE okapi_app LOGIN PASSWORD '***';
-- GRANT SELECT, INSERT, UPDATE, DELETE ON ALL TABLES IN SCHEMA public TO okapi_app;
-- REVOKE UPDATE, DELETE ON audit_logs, invoices FROM okapi_app;      -- append-only
-- REVOKE DELETE ON parcel_events, consents FROM okapi_app;           -- append-only
-- GRANT USAGE, SELECT ON ALL SEQUENCES IN SCHEMA public TO okapi_app;

-- Fin du schéma de référence.
