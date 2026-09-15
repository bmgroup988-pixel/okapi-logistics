-- Contraintes et objets non gérés par Prisma — à exécuter APRÈS `prisma migrate`.
--   npm run db:constraints --workspace @okapi/api
-- Idempotent (DROP ... IF EXISTS / CREATE OR REPLACE / index IF NOT EXISTS).
-- Voir db/schema.sql et docs/03-modele-de-donnees.md.

-- ---------------------------------------------------------------- Extensions
CREATE EXTENSION IF NOT EXISTS pgcrypto;
CREATE EXTENSION IF NOT EXISTS citext;
CREATE EXTENSION IF NOT EXISTS pg_trgm;
CREATE EXTENSION IF NOT EXISTS btree_gist;

-- ------------------------------------------------ Cohérence `balance`
-- `balance` = amount_due - amount_paid (EF-PAY-02). Une colonne GENERATED
-- ALWAYS ... STORED serait la garantie la plus forte, mais Prisma Client ne
-- sait pas l'omettre d'une écriture : il envoie systématiquement la valeur
-- par défaut du schéma (même quand l'application ne fournit pas `balance`),
-- ce que Postgres refuse sur une colonne générée
-- ("cannot insert a non-DEFAULT value into column «balance»"). On utilise
-- donc une CHECK constraint : même garantie de cohérence, compatible avec
-- l'ORM — `balance` reste une colonne normale, toujours écrite explicitement
-- par l'application (parcels.service.ts, payments.service.ts).
--
-- Si une exécution précédente avait converti la colonne en GENERATED
-- (versions antérieures de ce script), on la reconvertit d'abord en colonne
-- normale — bloc idempotent, sans effet sur une base déjà correcte.
DO $$
BEGIN
  IF EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_name = 'parcels' AND column_name = 'balance'
      AND is_generated <> 'NEVER'
  ) THEN
    ALTER TABLE parcels DROP COLUMN balance;
    ALTER TABLE parcels ADD COLUMN balance numeric(18,4) NOT NULL DEFAULT 0;
  END IF;
END $$;

ALTER TABLE parcels DROP CONSTRAINT IF EXISTS ck_parcel_balance;
ALTER TABLE parcels
  ADD CONSTRAINT ck_parcel_balance CHECK (balance = amount_due - amount_paid);

-- --------------------------------------- Unicité conditionnelle / exclusions
-- Une seule devise de référence.
CREATE UNIQUE INDEX IF NOT EXISTS uq_currency_reference
  ON currencies ((is_reference)) WHERE is_reference;

-- Une seule photo principale par colis.
CREATE UNIQUE INDEX IF NOT EXISTS uq_parcel_primary_photo
  ON parcel_photos (parcel_id) WHERE is_primary;

-- Recherche floue sur le numéro de suivi et le nom des contacts.
CREATE INDEX IF NOT EXISTS ix_parcels_tracking_trgm
  ON parcels USING gin (tracking_number gin_trgm_ops);
CREATE INDEX IF NOT EXISTS ix_contacts_name_trgm
  ON parcel_contacts USING gin (name gin_trgm_ops);

-- Pas deux tarifs ville->ville qui se chevauchent pour le même mode.
ALTER TABLE tariffs DROP CONSTRAINT IF EXISTS ex_tariff_city_overlap;
ALTER TABLE tariffs
  ADD CONSTRAINT ex_tariff_city_overlap EXCLUDE USING gist (
    origin_city_id      WITH =,
    destination_city_id WITH =,
    mode                WITH =,
    daterange(valid_from, valid_to, '[)') WITH &&
  ) WHERE (origin_city_id IS NOT NULL);

-- ------------------------------------------------ Séquences atomiques
CREATE OR REPLACE FUNCTION next_sequence_value(
  p_scope_type text, p_scope_key text, p_period text
) RETURNS bigint AS $fn$
DECLARE v bigint;
BEGIN
  INSERT INTO sequences (scope_type, scope_key, period, last_value, updated_at)
  VALUES (p_scope_type, p_scope_key, p_period, 1, now())
  ON CONFLICT (scope_type, scope_key, period)
  DO UPDATE SET last_value = sequences.last_value + 1, updated_at = now()
  RETURNING last_value INTO v;
  RETURN v;
END;
$fn$ LANGUAGE plpgsql;

-- ------------------------------------------------ Recalcul solde / statut
CREATE OR REPLACE FUNCTION recompute_parcel_balance() RETURNS trigger AS $fn$
DECLARE
  v_parcel_id uuid := COALESCE(NEW.parcel_id, OLD.parcel_id);
  v_paid numeric(18,4);
  v_due  numeric(18,4);
BEGIN
  PERFORM 1 FROM parcels WHERE id = v_parcel_id FOR UPDATE;

  SELECT
    COALESCE(SUM(amount_in_billing_currency) FILTER (WHERE state = 'CONFIRME'), 0)
    - COALESCE(SUM(amount_in_billing_currency) FILTER (WHERE state = 'REMBOURSE'), 0)
  INTO v_paid
  FROM payments WHERE parcel_id = v_parcel_id;

  SELECT amount_due INTO v_due FROM parcels WHERE id = v_parcel_id;
  v_paid := GREATEST(v_paid, 0);

  UPDATE parcels
  SET amount_paid = v_paid,
      balance = v_due - v_paid,
      payment_status = CASE
        WHEN v_due <= 0 OR v_paid >= v_due THEN 'PAYE'::"PaymentStatus"
        WHEN v_paid > 0 THEN 'PARTIEL'::"PaymentStatus"
        ELSE 'IMPAYE'::"PaymentStatus"
      END,
      updated_at = now()
  WHERE id = v_parcel_id;

  RETURN NULL;
END;
$fn$ LANGUAGE plpgsql;

DROP TRIGGER IF EXISTS trg_payment_recompute ON payments;
CREATE TRIGGER trg_payment_recompute
  AFTER INSERT OR UPDATE OF state, amount_in_billing_currency OR DELETE ON payments
  FOR EACH ROW EXECUTE FUNCTION recompute_parcel_balance();

-- ------------------------------------------------ Append-only (indicatif)
-- À activer avec un rôle applicatif dédié en production :
--   REVOKE UPDATE, DELETE ON audit_logs, invoices FROM okapi_app;
--   REVOKE DELETE ON parcel_events, consents FROM okapi_app;
