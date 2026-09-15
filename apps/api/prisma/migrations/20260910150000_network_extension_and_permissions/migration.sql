-- Addendum 08 — extension du réseau (26 provinces RDC), partenaires de
-- livraison, tarification par paire origine-destination (déjà couverte par
-- `tariffs`, aucune table nouvelle requise pour ce volet) et scission des
-- permissions de réception/livraison.
-- Écrite à la main (pas de `prisma migrate dev` disponible dans cet
-- environnement) à partir du diff entre le schéma migré au 2026-09-08 et
-- `schema.prisma` — à vérifier avec `npx prisma migrate diff` avant
-- application si possible. Voir docs/03-modele-de-donnees.md.

-- CreateEnum
CREATE TYPE "CityStatus" AS ENUM ('HUB', 'PARTNER', 'PLANNED');

-- CreateEnum
CREATE TYPE "SettlementMode" AS ENUM ('PER_KG', 'PERCENT_COLLECTED');

-- CreateEnum
CREATE TYPE "SettlementStatus" AS ENUM ('DRAFT', 'VALIDATED', 'PAID');

-- AlterEnum
-- Postgres exige que l'ajout de valeur soit validé (commit) avant d'être
-- utilisable dans la même session ; comme les lignes qui suivent ne
-- l'utilisent pas, un seul fichier de migration suffit.
ALTER TYPE "ParcelStatus" ADD VALUE 'HANDED_TO_PARTNER';

-- AlterTable
ALTER TABLE "cities" ADD COLUMN "status" "CityStatus" NOT NULL DEFAULT 'PLANNED';

-- Villes déjà desservies avec bureau propre : bascule immédiate en HUB
-- (à ajuster ensuite depuis /admin/cities si besoin).
UPDATE "cities" SET "status" = 'HUB' WHERE "code" IN ('COO', 'FIH', 'FBM');

-- AlterTable
ALTER TABLE "parcels" ADD COLUMN "destination_agency_id" UUID;
ALTER TABLE "parcels" ADD COLUMN "transit_agency_id" UUID;
ALTER TABLE "parcels" ADD COLUMN "delivery_partner_id" UUID;

-- CreateTable
CREATE TABLE "delivery_partners" (
    "id" UUID NOT NULL,
    "city_id" UUID NOT NULL,
    "name" TEXT NOT NULL,
    "coverage_zone" TEXT,
    "contact_name" TEXT,
    "contact_phone" TEXT,
    "contact_email" TEXT,
    "commission_pct" DECIMAL(6,4),
    "settlement_mode" "SettlementMode" NOT NULL DEFAULT 'PER_KG',
    "reliability_note" TEXT,
    "is_preferred" BOOLEAN NOT NULL DEFAULT false,
    "is_active" BOOLEAN NOT NULL DEFAULT true,
    "created_at" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMPTZ(6) NOT NULL,

    CONSTRAINT "delivery_partners_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "partner_tariffs" (
    "id" UUID NOT NULL,
    "delivery_partner_id" UUID NOT NULL,
    "price_per_kg" DECIMAL(18,4) NOT NULL,
    "currency_code" CHAR(3) NOT NULL,
    "min_weight_kg" DECIMAL(10,2),
    "is_active" BOOLEAN NOT NULL DEFAULT true,
    "effective_from" DATE NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "effective_to" DATE,
    "created_at" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMPTZ(6) NOT NULL,

    CONSTRAINT "partner_tariffs_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "partner_settlements" (
    "id" UUID NOT NULL,
    "delivery_partner_id" UUID NOT NULL,
    "period_start" DATE NOT NULL,
    "period_end" DATE NOT NULL,
    "parcel_count" INTEGER NOT NULL,
    "total_collected_amount" DECIMAL(18,4) NOT NULL,
    "commission_amount" DECIMAL(18,4) NOT NULL,
    "currency_code" CHAR(3) NOT NULL,
    "status" "SettlementStatus" NOT NULL DEFAULT 'DRAFT',
    "validated_by_user_id" UUID,
    "paid_at" TIMESTAMPTZ(6),
    "payment_reference" TEXT,
    "created_at" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMPTZ(6) NOT NULL,

    CONSTRAINT "partner_settlements_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "cities_status_idx" ON "cities"("status");

-- CreateIndex
CREATE INDEX "parcels_destination_agency_id_idx" ON "parcels"("destination_agency_id");

-- CreateIndex
CREATE INDEX "parcels_delivery_partner_id_idx" ON "parcels"("delivery_partner_id");

-- CreateIndex
CREATE INDEX "delivery_partners_city_id_is_active_idx" ON "delivery_partners"("city_id", "is_active");

-- CreateIndex
CREATE INDEX "partner_tariffs_delivery_partner_id_is_active_effective_fr_idx" ON "partner_tariffs"("delivery_partner_id", "is_active", "effective_from");

-- CreateIndex
CREATE INDEX "partner_settlements_delivery_partner_id_period_start_perio_idx" ON "partner_settlements"("delivery_partner_id", "period_start", "period_end");

-- AddForeignKey
ALTER TABLE "delivery_partners" ADD CONSTRAINT "delivery_partners_city_id_fkey" FOREIGN KEY ("city_id") REFERENCES "cities"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "partner_tariffs" ADD CONSTRAINT "partner_tariffs_delivery_partner_id_fkey" FOREIGN KEY ("delivery_partner_id") REFERENCES "delivery_partners"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "partner_tariffs" ADD CONSTRAINT "partner_tariffs_currency_code_fkey" FOREIGN KEY ("currency_code") REFERENCES "currencies"("code") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "partner_settlements" ADD CONSTRAINT "partner_settlements_delivery_partner_id_fkey" FOREIGN KEY ("delivery_partner_id") REFERENCES "delivery_partners"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "partner_settlements" ADD CONSTRAINT "partner_settlements_currency_code_fkey" FOREIGN KEY ("currency_code") REFERENCES "currencies"("code") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "parcels" ADD CONSTRAINT "parcels_destination_agency_id_fkey" FOREIGN KEY ("destination_agency_id") REFERENCES "agencies"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "parcels" ADD CONSTRAINT "parcels_transit_agency_id_fkey" FOREIGN KEY ("transit_agency_id") REFERENCES "agencies"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "parcels" ADD CONSTRAINT "parcels_delivery_partner_id_fkey" FOREIGN KEY ("delivery_partner_id") REFERENCES "delivery_partners"("id") ON DELETE SET NULL ON UPDATE CASCADE;
