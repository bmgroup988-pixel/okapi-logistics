-- CreateEnum
CREATE TYPE "TransportMode" AS ENUM ('AIR', 'SEA');

-- CreateEnum
CREATE TYPE "ParcelStatus" AS ENUM ('ENREGISTRE', 'EN_TRANSIT', 'ARRIVE', 'LIVRE', 'ANNULE', 'RETOURNE');

-- CreateEnum
CREATE TYPE "PaymentStatus" AS ENUM ('IMPAYE', 'PARTIEL', 'PAYE');

-- CreateEnum
CREATE TYPE "ParcelContactRole" AS ENUM ('SENDER', 'RECIPIENT');

-- CreateEnum
CREATE TYPE "PaymentMethod" AS ENUM ('MOBILE_MONEY', 'BANK_TRANSFER', 'CARD', 'CASH');

-- CreateEnum
CREATE TYPE "PaymentState" AS ENUM ('EN_ATTENTE', 'CONFIRME', 'ECHOUE', 'REMBOURSE');

-- CreateEnum
CREATE TYPE "DocumentType" AS ENUM ('LABEL', 'REGISTRATION_RECEIPT', 'PAYMENT_RECEIPT', 'INVOICE', 'CREDIT_NOTE');

-- CreateEnum
CREATE TYPE "FxRateSource" AS ENUM ('MANUAL', 'API');

-- CreateEnum
CREATE TYPE "NotificationChannel" AS ENUM ('SMS', 'WHATSAPP', 'EMAIL');

-- CreateEnum
CREATE TYPE "NotificationStatus" AS ENUM ('FILE', 'ENVOYE', 'LIVRE', 'ECHEC');

-- CreateEnum
CREATE TYPE "NotificationTrigger" AS ENUM ('STATUS_CHANGE', 'PAYMENT_RECEIVED', 'UNPAID_ON_ARRIVAL', 'DUNNING_REMINDER', 'DELIVERED');

-- CreateEnum
CREATE TYPE "AuditAction" AS ENUM ('CREATE', 'UPDATE', 'DELETE', 'LOGIN', 'LOGIN_FAILED', 'TRANSITION', 'REFUND', 'EXPORT', 'CONFIG_CHANGE', 'GDPR_ACCESS', 'GDPR_ERASURE');

-- CreateEnum
CREATE TYPE "ErasureStatus" AS ENUM ('RECU', 'EN_COURS', 'TERMINE', 'REFUSE');

-- CreateEnum
CREATE TYPE "SettingScope" AS ENUM ('GLOBAL', 'COUNTRY', 'AGENCY');

-- CreateTable
CREATE TABLE "currencies" (
    "code" CHAR(3) NOT NULL,
    "name_key" TEXT NOT NULL,
    "symbol" TEXT NOT NULL,
    "decimal_digits" SMALLINT NOT NULL DEFAULT 2,
    "rounding_mode" TEXT NOT NULL DEFAULT 'HALF_UP',
    "is_active" BOOLEAN NOT NULL DEFAULT true,
    "is_reference" BOOLEAN NOT NULL DEFAULT false,
    "created_at" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMPTZ(6) NOT NULL,

    CONSTRAINT "currencies_pkey" PRIMARY KEY ("code")
);

-- CreateTable
CREATE TABLE "countries" (
    "id" UUID NOT NULL,
    "iso2" CHAR(2) NOT NULL,
    "name_key" TEXT NOT NULL,
    "default_currency" CHAR(3) NOT NULL,
    "default_locale" TEXT NOT NULL DEFAULT 'fr',
    "phone_prefix" TEXT,
    "tax_rate" DECIMAL(6,4) NOT NULL DEFAULT 0,
    "unpaid_delivery_policy" TEXT NOT NULL DEFAULT 'derogation',
    "data_residency_region" TEXT,
    "is_active" BOOLEAN NOT NULL DEFAULT true,
    "created_at" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMPTZ(6) NOT NULL,
    "deleted_at" TIMESTAMPTZ(6),

    CONSTRAINT "countries_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "cities" (
    "id" UUID NOT NULL,
    "country_id" UUID NOT NULL,
    "code" CHAR(3) NOT NULL,
    "name_key" TEXT NOT NULL,
    "timezone" TEXT NOT NULL,
    "is_origin" BOOLEAN NOT NULL DEFAULT true,
    "is_destination" BOOLEAN NOT NULL DEFAULT true,
    "is_active" BOOLEAN NOT NULL DEFAULT true,
    "created_at" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMPTZ(6) NOT NULL,
    "deleted_at" TIMESTAMPTZ(6),

    CONSTRAINT "cities_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "agencies" (
    "id" UUID NOT NULL,
    "code" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "city_id" UUID NOT NULL,
    "country_id" UUID NOT NULL,
    "billing_currency" CHAR(3) NOT NULL,
    "address" TEXT,
    "email" TEXT,
    "phone" TEXT,
    "timezone" TEXT NOT NULL,
    "is_active" BOOLEAN NOT NULL DEFAULT true,
    "created_at" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMPTZ(6) NOT NULL,
    "deleted_at" TIMESTAMPTZ(6),

    CONSTRAINT "agencies_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "corridors" (
    "id" UUID NOT NULL,
    "origin_country_id" UUID NOT NULL,
    "destination_country_id" UUID NOT NULL,
    "label_key" TEXT,
    "is_active" BOOLEAN NOT NULL DEFAULT true,
    "created_at" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMPTZ(6) NOT NULL,

    CONSTRAINT "corridors_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "tariffs" (
    "id" UUID NOT NULL,
    "corridor_id" UUID,
    "origin_city_id" UUID,
    "destination_city_id" UUID,
    "mode" "TransportMode" NOT NULL,
    "currency" CHAR(3) NOT NULL,
    "fixed_fee" DECIMAL(18,4) NOT NULL DEFAULT 0,
    "price_per_kg" DECIMAL(18,4) NOT NULL DEFAULT 0,
    "min_charge" DECIMAL(18,4) NOT NULL DEFAULT 0,
    "ad_valorem_enabled" BOOLEAN NOT NULL DEFAULT false,
    "ad_valorem_rate" DECIMAL(6,4) NOT NULL DEFAULT 0,
    "override_min" DECIMAL(6,4) NOT NULL DEFAULT -0.15,
    "override_max" DECIMAL(6,4) NOT NULL DEFAULT 0.15,
    "valid_from" DATE NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "valid_to" DATE,
    "created_by" UUID,
    "created_at" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMPTZ(6) NOT NULL,

    CONSTRAINT "tariffs_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "exchange_rates" (
    "id" UUID NOT NULL,
    "base_currency" CHAR(3) NOT NULL,
    "quote_currency" CHAR(3) NOT NULL,
    "rate" DECIMAL(18,8) NOT NULL,
    "source" "FxRateSource" NOT NULL,
    "provider" TEXT,
    "effective_from" TIMESTAMPTZ(6) NOT NULL,
    "created_by" UUID,
    "created_at" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "exchange_rates_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "settings" (
    "id" UUID NOT NULL,
    "scope" "SettingScope" NOT NULL,
    "scope_id" UUID,
    "key" TEXT NOT NULL,
    "value" JSONB NOT NULL,
    "updated_by" UUID,
    "updated_at" TIMESTAMPTZ(6) NOT NULL,

    CONSTRAINT "settings_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "content_blocks" (
    "id" UUID NOT NULL,
    "key" TEXT NOT NULL,
    "description" TEXT,

    CONSTRAINT "content_blocks_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "content_translations" (
    "id" UUID NOT NULL,
    "content_block_id" UUID NOT NULL,
    "locale" TEXT NOT NULL,
    "value" TEXT NOT NULL,
    "updated_by" UUID,
    "updated_at" TIMESTAMPTZ(6) NOT NULL,

    CONSTRAINT "content_translations_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "notification_templates" (
    "id" UUID NOT NULL,
    "trigger" "NotificationTrigger" NOT NULL,
    "channel" "NotificationChannel" NOT NULL,
    "locale" TEXT NOT NULL,
    "subject" TEXT,
    "body" TEXT NOT NULL,
    "is_active" BOOLEAN NOT NULL DEFAULT true,
    "created_at" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMPTZ(6) NOT NULL,

    CONSTRAINT "notification_templates_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "users" (
    "id" UUID NOT NULL,
    "email" TEXT NOT NULL,
    "password_hash" TEXT NOT NULL,
    "full_name" TEXT NOT NULL,
    "phone" TEXT,
    "default_locale" TEXT NOT NULL DEFAULT 'fr',
    "totp_secret_enc" TEXT,
    "totp_enabled" BOOLEAN NOT NULL DEFAULT false,
    "is_active" BOOLEAN NOT NULL DEFAULT true,
    "failed_login_count" INTEGER NOT NULL DEFAULT 0,
    "locked_until" TIMESTAMPTZ(6),
    "last_login_at" TIMESTAMPTZ(6),
    "created_by" UUID,
    "updated_by" UUID,
    "created_at" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMPTZ(6) NOT NULL,
    "deleted_at" TIMESTAMPTZ(6),

    CONSTRAINT "users_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "roles" (
    "id" UUID NOT NULL,
    "code" TEXT NOT NULL,
    "name_key" TEXT NOT NULL,
    "is_system" BOOLEAN NOT NULL DEFAULT false,

    CONSTRAINT "roles_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "permissions" (
    "code" TEXT NOT NULL,
    "description" TEXT NOT NULL,

    CONSTRAINT "permissions_pkey" PRIMARY KEY ("code")
);

-- CreateTable
CREATE TABLE "role_permissions" (
    "role_id" UUID NOT NULL,
    "permission_code" TEXT NOT NULL,

    CONSTRAINT "role_permissions_pkey" PRIMARY KEY ("role_id","permission_code")
);

-- CreateTable
CREATE TABLE "user_roles" (
    "id" UUID NOT NULL,
    "user_id" UUID NOT NULL,
    "role_id" UUID NOT NULL,
    "scope_country_id" UUID,
    "scope_agency_id" UUID,
    "created_by" UUID,
    "created_at" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "user_roles_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "user_sessions" (
    "id" UUID NOT NULL,
    "user_id" UUID NOT NULL,
    "refresh_token_hash" TEXT NOT NULL,
    "replaced_by_id" UUID,
    "user_agent" TEXT,
    "ip" INET,
    "expires_at" TIMESTAMPTZ(6) NOT NULL,
    "revoked_at" TIMESTAMPTZ(6),
    "created_at" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "user_sessions_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "password_reset_tokens" (
    "id" UUID NOT NULL,
    "user_id" UUID NOT NULL,
    "token_hash" TEXT NOT NULL,
    "expires_at" TIMESTAMPTZ(6) NOT NULL,
    "used_at" TIMESTAMPTZ(6),
    "created_at" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "password_reset_tokens_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "audit_logs" (
    "id" UUID NOT NULL,
    "actor_user_id" UUID,
    "actor_label" TEXT,
    "action" "AuditAction" NOT NULL,
    "entity_type" TEXT NOT NULL,
    "entity_id" UUID,
    "before" JSONB,
    "after" JSONB,
    "ip" INET,
    "request_id" TEXT,
    "created_at" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "audit_logs_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "idempotency_keys" (
    "key" TEXT NOT NULL,
    "user_id" UUID,
    "request_fingerprint" TEXT NOT NULL,
    "response_status" INTEGER,
    "response_snapshot" JSONB,
    "created_at" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "expires_at" TIMESTAMPTZ(6) NOT NULL,

    CONSTRAINT "idempotency_keys_pkey" PRIMARY KEY ("key")
);

-- CreateTable
CREATE TABLE "parcels" (
    "id" UUID NOT NULL,
    "tracking_number" TEXT NOT NULL,
    "registration_agency_id" UUID NOT NULL,
    "registration_agent_id" UUID NOT NULL,
    "country_id" UUID NOT NULL,
    "origin_city_id" UUID NOT NULL,
    "destination_city_id" UUID NOT NULL,
    "destination_city_code" CHAR(3) NOT NULL,
    "transport_mode" "TransportMode" NOT NULL,
    "weight_kg" DECIMAL(10,2) NOT NULL,
    "content_nature" TEXT NOT NULL,
    "declared_value" DECIMAL(18,4) NOT NULL DEFAULT 0,
    "declared_value_currency" CHAR(3) NOT NULL,
    "billing_currency" CHAR(3) NOT NULL,
    "status" "ParcelStatus" NOT NULL DEFAULT 'ENREGISTRE',
    "payment_status" "PaymentStatus" NOT NULL DEFAULT 'IMPAYE',
    "amount_due" DECIMAL(18,4) NOT NULL,
    "amount_paid" DECIMAL(18,4) NOT NULL DEFAULT 0,
    "balance" DECIMAL(18,4) NOT NULL DEFAULT 0,
    "reference_currency" CHAR(3) NOT NULL,
    "amount_due_reference" DECIMAL(18,4) NOT NULL,
    "fx_rate_due" DECIMAL(18,8) NOT NULL,
    "exchange_rate_id_due" UUID,
    "pricing_override_pct" DECIMAL(6,4) NOT NULL DEFAULT 0,
    "pricing_snapshot" JSONB NOT NULL,
    "consent_given" BOOLEAN NOT NULL DEFAULT false,
    "consent_text_version" TEXT,
    "consent_at" TIMESTAMPTZ(6),
    "client_channel" "NotificationChannel",
    "client_locale" TEXT NOT NULL DEFAULT 'fr',
    "cancel_reason" TEXT,
    "delivered_at" TIMESTAMPTZ(6),
    "created_by" UUID,
    "updated_by" UUID,
    "created_at" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMPTZ(6) NOT NULL,

    CONSTRAINT "parcels_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "parcel_contacts" (
    "id" UUID NOT NULL,
    "parcel_id" UUID NOT NULL,
    "role" "ParcelContactRole" NOT NULL,
    "name" TEXT NOT NULL,
    "phone" TEXT,
    "email" TEXT,
    "address" TEXT,
    "city_label" TEXT,
    "country_label" TEXT,
    "id_document_ref" TEXT,
    "anonymized" BOOLEAN NOT NULL DEFAULT false,
    "anonymized_at" TIMESTAMPTZ(6),
    "created_at" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMPTZ(6) NOT NULL,

    CONSTRAINT "parcel_contacts_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "parcel_photos" (
    "id" UUID NOT NULL,
    "parcel_id" UUID NOT NULL,
    "storage_key" TEXT,
    "derivative_keys" JSONB,
    "sha256" CHAR(64) NOT NULL,
    "bytes" INTEGER NOT NULL,
    "mime_type" TEXT NOT NULL,
    "width" INTEGER,
    "height" INTEGER,
    "is_primary" BOOLEAN NOT NULL DEFAULT false,
    "taken_by" UUID NOT NULL,
    "taken_at" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "exif_stripped" BOOLEAN NOT NULL DEFAULT false,
    "locked" BOOLEAN NOT NULL DEFAULT false,
    "created_at" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "parcel_photos_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "parcel_events" (
    "id" UUID NOT NULL,
    "parcel_id" UUID NOT NULL,
    "status" "ParcelStatus" NOT NULL,
    "location_city_id" UUID,
    "location_label" TEXT,
    "note" TEXT,
    "visible_to_client" BOOLEAN NOT NULL DEFAULT true,
    "created_by" UUID,
    "created_at" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "parcel_events_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "payments" (
    "id" UUID NOT NULL,
    "parcel_id" UUID NOT NULL,
    "amount" DECIMAL(18,4) NOT NULL,
    "currency" CHAR(3) NOT NULL,
    "amount_in_billing_currency" DECIMAL(18,4) NOT NULL,
    "billing_currency" CHAR(3) NOT NULL,
    "amount_reference" DECIMAL(18,4) NOT NULL,
    "reference_currency" CHAR(3) NOT NULL,
    "fx_rate" DECIMAL(18,8) NOT NULL,
    "fx_rate_to_billing" DECIMAL(18,8) NOT NULL,
    "exchange_rate_id" UUID,
    "method" "PaymentMethod" NOT NULL,
    "mobile_money_provider" TEXT,
    "external_ref" TEXT,
    "state" "PaymentState" NOT NULL DEFAULT 'EN_ATTENTE',
    "confirmed_at" TIMESTAMPTZ(6),
    "failure_reason" TEXT,
    "refund_of_payment_id" UUID,
    "refund_reason" TEXT,
    "collected_by" UUID NOT NULL,
    "agency_id" UUID NOT NULL,
    "country_id" UUID NOT NULL,
    "received_at" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "idempotency_key" TEXT,
    "created_by" UUID,
    "created_at" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMPTZ(6) NOT NULL,

    CONSTRAINT "payments_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "invoices" (
    "id" UUID NOT NULL,
    "parcel_id" UUID NOT NULL,
    "type" "DocumentType" NOT NULL,
    "number" TEXT NOT NULL,
    "country_id" UUID NOT NULL,
    "payment_id" UUID,
    "amount_net" DECIMAL(18,4) NOT NULL,
    "amount_tax" DECIMAL(18,4) NOT NULL DEFAULT 0,
    "amount_gross" DECIMAL(18,4) NOT NULL,
    "currency" CHAR(3) NOT NULL,
    "amount_reference" DECIMAL(18,4) NOT NULL,
    "reference_currency" CHAR(3) NOT NULL,
    "fx_rate" DECIMAL(18,8) NOT NULL,
    "issued_at" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "issued_by" UUID,
    "legal_mentions_snapshot" JSONB NOT NULL,
    "created_at" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "invoices_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "documents" (
    "id" UUID NOT NULL,
    "parcel_id" UUID NOT NULL,
    "payment_id" UUID,
    "invoice_id" UUID,
    "type" "DocumentType" NOT NULL,
    "storage_key" TEXT NOT NULL,
    "number" TEXT,
    "checksum_sha256" CHAR(64),
    "generated_at" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "created_at" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "documents_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "notifications" (
    "id" UUID NOT NULL,
    "parcel_id" UUID,
    "trigger" "NotificationTrigger" NOT NULL,
    "channel" "NotificationChannel" NOT NULL,
    "template_id" UUID,
    "locale" TEXT NOT NULL,
    "recipient" TEXT NOT NULL,
    "subject" TEXT,
    "body_preview" TEXT,
    "status" "NotificationStatus" NOT NULL DEFAULT 'FILE',
    "provider" TEXT,
    "provider_message_id" TEXT,
    "error" TEXT,
    "attempts" SMALLINT NOT NULL DEFAULT 0,
    "scheduled_for" TIMESTAMPTZ(6),
    "sent_at" TIMESTAMPTZ(6),
    "delivered_at" TIMESTAMPTZ(6),
    "created_at" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "notifications_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "sequences" (
    "scope_type" TEXT NOT NULL,
    "scope_key" TEXT NOT NULL,
    "period" TEXT NOT NULL,
    "last_value" BIGINT NOT NULL DEFAULT 0,
    "updated_at" TIMESTAMPTZ(6) NOT NULL,

    CONSTRAINT "sequences_pkey" PRIMARY KEY ("scope_type","scope_key","period")
);

-- CreateTable
CREATE TABLE "consents" (
    "id" UUID NOT NULL,
    "parcel_contact_id" UUID,
    "parcel_id" UUID,
    "subject_ref" TEXT NOT NULL,
    "purpose" TEXT NOT NULL,
    "text_version" TEXT NOT NULL,
    "channel" TEXT,
    "given" BOOLEAN NOT NULL,
    "given_at" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "withdrawn_at" TIMESTAMPTZ(6),
    "created_at" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "consents_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "retention_policies" (
    "id" UUID NOT NULL,
    "category" TEXT NOT NULL,
    "retention_months" INTEGER NOT NULL,
    "action" TEXT NOT NULL,
    "country_id" UUID,
    "updated_by" UUID,
    "updated_at" TIMESTAMPTZ(6) NOT NULL,

    CONSTRAINT "retention_policies_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "data_erasure_requests" (
    "id" UUID NOT NULL,
    "subject_ref" TEXT NOT NULL,
    "requested_by" TEXT,
    "received_at" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "status" "ErasureStatus" NOT NULL DEFAULT 'RECU',
    "handled_by" UUID,
    "affected_parcels" JSONB,
    "notes" TEXT,
    "completed_at" TIMESTAMPTZ(6),

    CONSTRAINT "data_erasure_requests_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "data_access_requests" (
    "id" UUID NOT NULL,
    "subject_ref" TEXT NOT NULL,
    "requested_by" TEXT,
    "received_at" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "status" "ErasureStatus" NOT NULL DEFAULT 'RECU',
    "handled_by" UUID,
    "export_document_id" UUID,
    "completed_at" TIMESTAMPTZ(6),

    CONSTRAINT "data_access_requests_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "countries_iso2_key" ON "countries"("iso2");

-- CreateIndex
CREATE UNIQUE INDEX "cities_code_key" ON "cities"("code");

-- CreateIndex
CREATE INDEX "cities_country_id_idx" ON "cities"("country_id");

-- CreateIndex
CREATE UNIQUE INDEX "agencies_code_key" ON "agencies"("code");

-- CreateIndex
CREATE INDEX "agencies_country_id_idx" ON "agencies"("country_id");

-- CreateIndex
CREATE UNIQUE INDEX "corridors_origin_country_id_destination_country_id_key" ON "corridors"("origin_country_id", "destination_country_id");

-- CreateIndex
CREATE INDEX "tariffs_corridor_id_idx" ON "tariffs"("corridor_id");

-- CreateIndex
CREATE INDEX "tariffs_destination_city_id_mode_valid_from_idx" ON "tariffs"("destination_city_id", "mode", "valid_from");

-- CreateIndex
CREATE INDEX "exchange_rates_base_currency_quote_currency_effective_from_idx" ON "exchange_rates"("base_currency", "quote_currency", "effective_from" DESC);

-- CreateIndex
CREATE UNIQUE INDEX "exchange_rates_base_currency_quote_currency_effective_from_key" ON "exchange_rates"("base_currency", "quote_currency", "effective_from");

-- CreateIndex
CREATE UNIQUE INDEX "settings_scope_scope_id_key_key" ON "settings"("scope", "scope_id", "key");

-- CreateIndex
CREATE UNIQUE INDEX "content_blocks_key_key" ON "content_blocks"("key");

-- CreateIndex
CREATE UNIQUE INDEX "content_translations_content_block_id_locale_key" ON "content_translations"("content_block_id", "locale");

-- CreateIndex
CREATE UNIQUE INDEX "notification_templates_trigger_channel_locale_key" ON "notification_templates"("trigger", "channel", "locale");

-- CreateIndex
CREATE UNIQUE INDEX "users_email_key" ON "users"("email");

-- CreateIndex
CREATE UNIQUE INDEX "roles_code_key" ON "roles"("code");

-- CreateIndex
CREATE INDEX "user_roles_user_id_idx" ON "user_roles"("user_id");

-- CreateIndex
CREATE UNIQUE INDEX "user_roles_user_id_role_id_scope_country_id_scope_agency_id_key" ON "user_roles"("user_id", "role_id", "scope_country_id", "scope_agency_id");

-- CreateIndex
CREATE UNIQUE INDEX "user_sessions_refresh_token_hash_key" ON "user_sessions"("refresh_token_hash");

-- CreateIndex
CREATE INDEX "user_sessions_user_id_idx" ON "user_sessions"("user_id");

-- CreateIndex
CREATE UNIQUE INDEX "password_reset_tokens_token_hash_key" ON "password_reset_tokens"("token_hash");

-- CreateIndex
CREATE INDEX "audit_logs_entity_type_entity_id_created_at_idx" ON "audit_logs"("entity_type", "entity_id", "created_at");

-- CreateIndex
CREATE INDEX "audit_logs_actor_user_id_created_at_idx" ON "audit_logs"("actor_user_id", "created_at");

-- CreateIndex
CREATE INDEX "idempotency_keys_expires_at_idx" ON "idempotency_keys"("expires_at");

-- CreateIndex
CREATE UNIQUE INDEX "parcels_tracking_number_key" ON "parcels"("tracking_number");

-- CreateIndex
CREATE INDEX "parcels_registration_agency_id_created_at_idx" ON "parcels"("registration_agency_id", "created_at" DESC);

-- CreateIndex
CREATE INDEX "parcels_country_id_status_payment_status_created_at_idx" ON "parcels"("country_id", "status", "payment_status", "created_at");

-- CreateIndex
CREATE INDEX "parcels_status_payment_status_idx" ON "parcels"("status", "payment_status");

-- CreateIndex
CREATE INDEX "parcel_contacts_phone_idx" ON "parcel_contacts"("phone");

-- CreateIndex
CREATE INDEX "parcel_contacts_email_idx" ON "parcel_contacts"("email");

-- CreateIndex
CREATE UNIQUE INDEX "parcel_contacts_parcel_id_role_key" ON "parcel_contacts"("parcel_id", "role");

-- CreateIndex
CREATE UNIQUE INDEX "parcel_photos_storage_key_key" ON "parcel_photos"("storage_key");

-- CreateIndex
CREATE INDEX "parcel_photos_parcel_id_idx" ON "parcel_photos"("parcel_id");

-- CreateIndex
CREATE INDEX "parcel_events_parcel_id_created_at_idx" ON "parcel_events"("parcel_id", "created_at");

-- CreateIndex
CREATE INDEX "payments_parcel_id_received_at_idx" ON "payments"("parcel_id", "received_at");

-- CreateIndex
CREATE INDEX "payments_agency_id_received_at_idx" ON "payments"("agency_id", "received_at");

-- CreateIndex
CREATE INDEX "payments_country_id_received_at_idx" ON "payments"("country_id", "received_at");

-- CreateIndex
CREATE INDEX "payments_state_idx" ON "payments"("state");

-- CreateIndex
CREATE INDEX "payments_method_idx" ON "payments"("method");

-- CreateIndex
CREATE INDEX "invoices_parcel_id_idx" ON "invoices"("parcel_id");

-- CreateIndex
CREATE UNIQUE INDEX "invoices_country_id_type_number_key" ON "invoices"("country_id", "type", "number");

-- CreateIndex
CREATE UNIQUE INDEX "documents_storage_key_key" ON "documents"("storage_key");

-- CreateIndex
CREATE INDEX "documents_parcel_id_idx" ON "documents"("parcel_id");

-- CreateIndex
CREATE INDEX "notifications_parcel_id_created_at_idx" ON "notifications"("parcel_id", "created_at");

-- CreateIndex
CREATE INDEX "notifications_status_scheduled_for_idx" ON "notifications"("status", "scheduled_for");

-- CreateIndex
CREATE INDEX "consents_subject_ref_idx" ON "consents"("subject_ref");

-- CreateIndex
CREATE UNIQUE INDEX "retention_policies_category_country_id_key" ON "retention_policies"("category", "country_id");

-- CreateIndex
CREATE INDEX "data_erasure_requests_subject_ref_idx" ON "data_erasure_requests"("subject_ref");

-- AddForeignKey
ALTER TABLE "countries" ADD CONSTRAINT "countries_default_currency_fkey" FOREIGN KEY ("default_currency") REFERENCES "currencies"("code") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "cities" ADD CONSTRAINT "cities_country_id_fkey" FOREIGN KEY ("country_id") REFERENCES "countries"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "agencies" ADD CONSTRAINT "agencies_city_id_fkey" FOREIGN KEY ("city_id") REFERENCES "cities"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "agencies" ADD CONSTRAINT "agencies_country_id_fkey" FOREIGN KEY ("country_id") REFERENCES "countries"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "agencies" ADD CONSTRAINT "agencies_billing_currency_fkey" FOREIGN KEY ("billing_currency") REFERENCES "currencies"("code") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "corridors" ADD CONSTRAINT "corridors_origin_country_id_fkey" FOREIGN KEY ("origin_country_id") REFERENCES "countries"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "corridors" ADD CONSTRAINT "corridors_destination_country_id_fkey" FOREIGN KEY ("destination_country_id") REFERENCES "countries"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "tariffs" ADD CONSTRAINT "tariffs_corridor_id_fkey" FOREIGN KEY ("corridor_id") REFERENCES "corridors"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "tariffs" ADD CONSTRAINT "tariffs_origin_city_id_fkey" FOREIGN KEY ("origin_city_id") REFERENCES "cities"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "tariffs" ADD CONSTRAINT "tariffs_destination_city_id_fkey" FOREIGN KEY ("destination_city_id") REFERENCES "cities"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "tariffs" ADD CONSTRAINT "tariffs_currency_fkey" FOREIGN KEY ("currency") REFERENCES "currencies"("code") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "exchange_rates" ADD CONSTRAINT "exchange_rates_base_currency_fkey" FOREIGN KEY ("base_currency") REFERENCES "currencies"("code") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "exchange_rates" ADD CONSTRAINT "exchange_rates_quote_currency_fkey" FOREIGN KEY ("quote_currency") REFERENCES "currencies"("code") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "content_translations" ADD CONSTRAINT "content_translations_content_block_id_fkey" FOREIGN KEY ("content_block_id") REFERENCES "content_blocks"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "role_permissions" ADD CONSTRAINT "role_permissions_role_id_fkey" FOREIGN KEY ("role_id") REFERENCES "roles"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "role_permissions" ADD CONSTRAINT "role_permissions_permission_code_fkey" FOREIGN KEY ("permission_code") REFERENCES "permissions"("code") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "user_roles" ADD CONSTRAINT "user_roles_user_id_fkey" FOREIGN KEY ("user_id") REFERENCES "users"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "user_roles" ADD CONSTRAINT "user_roles_role_id_fkey" FOREIGN KEY ("role_id") REFERENCES "roles"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "user_roles" ADD CONSTRAINT "user_roles_scope_agency_id_fkey" FOREIGN KEY ("scope_agency_id") REFERENCES "agencies"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "user_sessions" ADD CONSTRAINT "user_sessions_user_id_fkey" FOREIGN KEY ("user_id") REFERENCES "users"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "password_reset_tokens" ADD CONSTRAINT "password_reset_tokens_user_id_fkey" FOREIGN KEY ("user_id") REFERENCES "users"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "audit_logs" ADD CONSTRAINT "audit_logs_actor_user_id_fkey" FOREIGN KEY ("actor_user_id") REFERENCES "users"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "parcels" ADD CONSTRAINT "parcels_registration_agency_id_fkey" FOREIGN KEY ("registration_agency_id") REFERENCES "agencies"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "parcels" ADD CONSTRAINT "parcels_registration_agent_id_fkey" FOREIGN KEY ("registration_agent_id") REFERENCES "users"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "parcels" ADD CONSTRAINT "parcels_origin_city_id_fkey" FOREIGN KEY ("origin_city_id") REFERENCES "cities"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "parcels" ADD CONSTRAINT "parcels_destination_city_id_fkey" FOREIGN KEY ("destination_city_id") REFERENCES "cities"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "parcel_contacts" ADD CONSTRAINT "parcel_contacts_parcel_id_fkey" FOREIGN KEY ("parcel_id") REFERENCES "parcels"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "parcel_photos" ADD CONSTRAINT "parcel_photos_parcel_id_fkey" FOREIGN KEY ("parcel_id") REFERENCES "parcels"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "parcel_photos" ADD CONSTRAINT "parcel_photos_taken_by_fkey" FOREIGN KEY ("taken_by") REFERENCES "users"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "parcel_events" ADD CONSTRAINT "parcel_events_parcel_id_fkey" FOREIGN KEY ("parcel_id") REFERENCES "parcels"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "parcel_events" ADD CONSTRAINT "parcel_events_created_by_fkey" FOREIGN KEY ("created_by") REFERENCES "users"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "parcel_events" ADD CONSTRAINT "parcel_events_location_city_id_fkey" FOREIGN KEY ("location_city_id") REFERENCES "cities"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "payments" ADD CONSTRAINT "payments_parcel_id_fkey" FOREIGN KEY ("parcel_id") REFERENCES "parcels"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "payments" ADD CONSTRAINT "payments_collected_by_fkey" FOREIGN KEY ("collected_by") REFERENCES "users"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "payments" ADD CONSTRAINT "payments_agency_id_fkey" FOREIGN KEY ("agency_id") REFERENCES "agencies"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "payments" ADD CONSTRAINT "payments_refund_of_payment_id_fkey" FOREIGN KEY ("refund_of_payment_id") REFERENCES "payments"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "invoices" ADD CONSTRAINT "invoices_parcel_id_fkey" FOREIGN KEY ("parcel_id") REFERENCES "parcels"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "invoices" ADD CONSTRAINT "invoices_payment_id_fkey" FOREIGN KEY ("payment_id") REFERENCES "payments"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "documents" ADD CONSTRAINT "documents_parcel_id_fkey" FOREIGN KEY ("parcel_id") REFERENCES "parcels"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "documents" ADD CONSTRAINT "documents_payment_id_fkey" FOREIGN KEY ("payment_id") REFERENCES "payments"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "documents" ADD CONSTRAINT "documents_invoice_id_fkey" FOREIGN KEY ("invoice_id") REFERENCES "invoices"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "notifications" ADD CONSTRAINT "notifications_parcel_id_fkey" FOREIGN KEY ("parcel_id") REFERENCES "parcels"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "notifications" ADD CONSTRAINT "notifications_template_id_fkey" FOREIGN KEY ("template_id") REFERENCES "notification_templates"("id") ON DELETE SET NULL ON UPDATE CASCADE;
