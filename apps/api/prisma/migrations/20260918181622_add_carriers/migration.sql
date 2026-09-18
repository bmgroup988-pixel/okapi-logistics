-- AlterTable
ALTER TABLE "parcels" ADD COLUMN     "carrier_id" UUID;
-- CreateTable
CREATE TABLE "carriers" (
    "id" UUID NOT NULL,
    "name" TEXT NOT NULL,
    "contact_name" TEXT,
    "contact_phone" TEXT,
    "contact_email" TEXT,
    "is_active" BOOLEAN NOT NULL DEFAULT true,
    "created_by" UUID,
    "created_at" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMPTZ(6) NOT NULL,
    CONSTRAINT "carriers_pkey" PRIMARY KEY ("id")
);
-- AddForeignKey
ALTER TABLE "parcels" ADD CONSTRAINT "parcels_carrier_id_fkey" FOREIGN KEY ("carrier_id") REFERENCES "carriers"("id") ON DELETE SET NULL ON UPDATE CASCADE;
