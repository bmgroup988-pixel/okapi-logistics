-- Un groupage est organisé par agence de DESTINATION, pas de départ —
-- décision produit du 2026-09-22 : un colis peut être intégré à un groupage
-- dont la destination diffère de la sienne (urgence, vide à combler), sans
-- jamais affecter le colis lui-même. Renomme la colonne existante
-- (préserve les données, contrairement à un drop+add).
ALTER TABLE "groupages" RENAME COLUMN "origin_agency_id" TO "destination_agency_id";
ALTER TABLE "groupages" RENAME CONSTRAINT "groupages_origin_agency_id_fkey" TO "groupages_destination_agency_id_fkey";
