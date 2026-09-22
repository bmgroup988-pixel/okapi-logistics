-- CreateEnum
CREATE TYPE "GroupageStatus" AS ENUM ('OUVERT', 'CLOTURE', 'ANNULE');

-- AlterTable
ALTER TABLE "parcels" ADD COLUMN     "groupage_id" UUID;

-- CreateTable
CREATE TABLE "groupages" (
    "id" UUID NOT NULL,
    "code" TEXT NOT NULL,
    "origin_agency_id" UUID NOT NULL,
    "status" "GroupageStatus" NOT NULL DEFAULT 'OUVERT',
    "parcel_count" INTEGER NOT NULL DEFAULT 0,
    "total_weight_kg" DECIMAL(10,2) NOT NULL DEFAULT 0,
    "note" TEXT,
    "opened_by" UUID,
    "closed_by" UUID,
    "opened_at" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "closed_at" TIMESTAMPTZ(6),
    "created_at" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMPTZ(6) NOT NULL,

    CONSTRAINT "groupages_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "groupages_code_key" ON "groupages"("code");

-- CreateIndex
CREATE INDEX "groupages_status_opened_at_idx" ON "groupages"("status", "opened_at");

-- CreateIndex
CREATE INDEX "parcels_groupage_id_idx" ON "parcels"("groupage_id");

-- AddForeignKey
ALTER TABLE "parcels" ADD CONSTRAINT "parcels_groupage_id_fkey" FOREIGN KEY ("groupage_id") REFERENCES "groupages"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "groupages" ADD CONSTRAINT "groupages_origin_agency_id_fkey" FOREIGN KEY ("origin_agency_id") REFERENCES "agencies"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
