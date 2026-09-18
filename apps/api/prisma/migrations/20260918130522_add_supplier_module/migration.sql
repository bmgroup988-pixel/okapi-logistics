-- CreateEnum
CREATE TYPE "ShipmentStatus" AS ENUM ('OUVERTE', 'CLOTUREE', 'ANNULEE');
-- DropForeignKey
ALTER TABLE "partner_tariffs" DROP CONSTRAINT "partner_tariffs_delivery_partner_id_fkey";
-- DropIndex
DROP INDEX "user_roles_user_id_role_id_scope_country_id_scope_agency_id_key";
-- AlterTable
ALTER TABLE "parcels" ADD COLUMN     "shipment_id" UUID,
ADD COLUMN     "supplier_id" UUID;
-- AlterTable
ALTER TABLE "user_roles" ADD COLUMN     "scope_supplier_id" UUID;
-- CreateTable
CREATE TABLE "suppliers" (
    "id" UUID NOT NULL,
    "code" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "contact_name" TEXT,
    "contact_phone" TEXT,
    "contact_email" TEXT,
    "address" TEXT,
    "country_id" UUID NOT NULL,
    "default_agency_id" UUID NOT NULL,
    "billing_currency" CHAR(3) NOT NULL,
    "user_id" UUID,
    "is_active" BOOLEAN NOT NULL DEFAULT true,
    "created_by" UUID,
    "created_at" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMPTZ(6) NOT NULL,
    CONSTRAINT "suppliers_pkey" PRIMARY KEY ("id")
);
-- CreateTable
CREATE TABLE "shipments" (
    "id" UUID NOT NULL,
    "code" TEXT NOT NULL,
    "supplier_id" UUID NOT NULL,
    "origin_agency_id" UUID NOT NULL,
    "status" "ShipmentStatus" NOT NULL DEFAULT 'OUVERTE',
    "parcel_count" INTEGER NOT NULL DEFAULT 0,
    "total_weight_kg" DECIMAL(10,2) NOT NULL DEFAULT 0,
    "currency" CHAR(3) NOT NULL,
    "total_amount_due" DECIMAL(18,4) NOT NULL DEFAULT 0,
    "reference_currency" CHAR(3) NOT NULL DEFAULT 'USD',
    "total_amount_due_reference" DECIMAL(18,4) NOT NULL DEFAULT 0,
    "opened_by" UUID,
    "closed_by" UUID,
    "opened_at" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "closed_at" TIMESTAMPTZ(6),
    "created_at" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMPTZ(6) NOT NULL,
    CONSTRAINT "shipments_pkey" PRIMARY KEY ("id")
);
-- CreateTable
CREATE TABLE "supplier_invoices" (
    "id" UUID NOT NULL,
    "shipment_id" UUID NOT NULL,
    "supplier_id" UUID NOT NULL,
    "number" TEXT NOT NULL,
    "currency" CHAR(3) NOT NULL,
    "amount_gross" DECIMAL(18,4) NOT NULL,
    "reference_currency" CHAR(3) NOT NULL,
    "amount_reference" DECIMAL(18,4) NOT NULL,
    "fx_rate" DECIMAL(18,8) NOT NULL,
    "issued_at" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "issued_by" UUID,
    "storage_key" TEXT,
    "legal_mentions_snapshot" JSONB NOT NULL,
    "created_at" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT "supplier_invoices_pkey" PRIMARY KEY ("id")
);
-- CreateTable
CREATE TABLE "supplier_invoice_lines" (
    "id" UUID NOT NULL,
    "supplier_invoice_id" UUID NOT NULL,
    "parcel_id" UUID NOT NULL,
    "tracking_number" TEXT NOT NULL,
    "recipient_name" TEXT NOT NULL,
    "recipient_phone" TEXT,
    "destination_city_label" TEXT NOT NULL,
    "weight_kg" DECIMAL(10,2) NOT NULL,
    "amount" DECIMAL(18,4) NOT NULL,
    "currency" CHAR(3) NOT NULL,
    "amount_reference" DECIMAL(18,4) NOT NULL,
    "created_at" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT "supplier_invoice_lines_pkey" PRIMARY KEY ("id")
);
-- CreateIndex
CREATE UNIQUE INDEX "suppliers_code_key" ON "suppliers"("code");
-- CreateIndex
CREATE UNIQUE INDEX "suppliers_user_id_key" ON "suppliers"("user_id");
-- CreateIndex
CREATE INDEX "suppliers_country_id_idx" ON "suppliers"("country_id");
-- CreateIndex
CREATE UNIQUE INDEX "shipments_code_key" ON "shipments"("code");
-- CreateIndex
CREATE INDEX "shipments_supplier_id_status_opened_at_idx" ON "shipments"("supplier_id", "status", "opened_at");
-- CreateIndex
CREATE UNIQUE INDEX "supplier_invoices_shipment_id_key" ON "supplier_invoices"("shipment_id");
-- CreateIndex
CREATE UNIQUE INDEX "supplier_invoices_number_key" ON "supplier_invoices"("number");
-- CreateIndex
CREATE INDEX "supplier_invoices_supplier_id_issued_at_idx" ON "supplier_invoices"("supplier_id", "issued_at");
-- CreateIndex
CREATE UNIQUE INDEX "supplier_invoice_lines_parcel_id_key" ON "supplier_invoice_lines"("parcel_id");
-- CreateIndex
CREATE INDEX "supplier_invoice_lines_supplier_invoice_id_idx" ON "supplier_invoice_lines"("supplier_invoice_id");
-- CreateIndex
CREATE INDEX "parcels_shipment_id_idx" ON "parcels"("shipment_id");
-- CreateIndex
CREATE UNIQUE INDEX "user_roles_user_id_role_id_scope_country_id_scope_agency_id_key" ON "user_roles"("user_id", "role_id", "scope_country_id", "scope_agency_id", "scope_supplier_id");
-- AddForeignKey
ALTER TABLE "user_roles" ADD CONSTRAINT "user_roles_scope_supplier_id_fkey" FOREIGN KEY ("scope_supplier_id") REFERENCES "suppliers"("id") ON DELETE SET NULL ON UPDATE CASCADE;
-- AddForeignKey
ALTER TABLE "parcels" ADD CONSTRAINT "parcels_supplier_id_fkey" FOREIGN KEY ("supplier_id") REFERENCES "suppliers"("id") ON DELETE SET NULL ON UPDATE CASCADE;
-- AddForeignKey
ALTER TABLE "parcels" ADD CONSTRAINT "parcels_shipment_id_fkey" FOREIGN KEY ("shipment_id") REFERENCES "shipments"("id") ON DELETE SET NULL ON UPDATE CASCADE;
-- AddForeignKey
ALTER TABLE "partner_tariffs" ADD CONSTRAINT "partner_tariffs_delivery_partner_id_fkey" FOREIGN KEY ("delivery_partner_id") REFERENCES "delivery_partners"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
-- AddForeignKey
ALTER TABLE "suppliers" ADD CONSTRAINT "suppliers_country_id_fkey" FOREIGN KEY ("country_id") REFERENCES "countries"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
-- AddForeignKey
ALTER TABLE "suppliers" ADD CONSTRAINT "suppliers_default_agency_id_fkey" FOREIGN KEY ("default_agency_id") REFERENCES "agencies"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
-- AddForeignKey
ALTER TABLE "suppliers" ADD CONSTRAINT "suppliers_billing_currency_fkey" FOREIGN KEY ("billing_currency") REFERENCES "currencies"("code") ON DELETE RESTRICT ON UPDATE CASCADE;
-- AddForeignKey
ALTER TABLE "suppliers" ADD CONSTRAINT "suppliers_user_id_fkey" FOREIGN KEY ("user_id") REFERENCES "users"("id") ON DELETE SET NULL ON UPDATE CASCADE;
-- AddForeignKey
ALTER TABLE "shipments" ADD CONSTRAINT "shipments_supplier_id_fkey" FOREIGN KEY ("supplier_id") REFERENCES "suppliers"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
-- AddForeignKey
ALTER TABLE "shipments" ADD CONSTRAINT "shipments_origin_agency_id_fkey" FOREIGN KEY ("origin_agency_id") REFERENCES "agencies"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
-- AddForeignKey
ALTER TABLE "supplier_invoices" ADD CONSTRAINT "supplier_invoices_shipment_id_fkey" FOREIGN KEY ("shipment_id") REFERENCES "shipments"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
-- AddForeignKey
ALTER TABLE "supplier_invoices" ADD CONSTRAINT "supplier_invoices_supplier_id_fkey" FOREIGN KEY ("supplier_id") REFERENCES "suppliers"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
-- AddForeignKey
ALTER TABLE "supplier_invoice_lines" ADD CONSTRAINT "supplier_invoice_lines_supplier_invoice_id_fkey" FOREIGN KEY ("supplier_invoice_id") REFERENCES "supplier_invoices"("id") ON DELETE CASCADE ON UPDATE CASCADE;
-- AddForeignKey
ALTER TABLE "supplier_invoice_lines" ADD CONSTRAINT "supplier_invoice_lines_parcel_id_fkey" FOREIGN KEY ("parcel_id") REFERENCES "parcels"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
-- RenameIndex
ALTER INDEX "partner_settlements_delivery_partner_id_period_start_perio_idx" RENAME TO "partner_settlements_delivery_partner_id_period_start_period_idx";
-- RenameIndex
ALTER INDEX "partner_tariffs_delivery_partner_id_is_active_effective_fr_idx" RENAME TO "partner_tariffs_delivery_partner_id_is_active_effective_fro_idx";
