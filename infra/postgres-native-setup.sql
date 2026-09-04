-- Initialisation d'une instance PostgreSQL NATIVE (sans Docker) pour Okapi Logistics.
-- Idempotent : peut être rejoué sans erreur si le rôle/la base existent déjà.
--
-- Utilisation (Windows PowerShell, adapter le chemin à votre version installée) :
--   & "C:\Program Files\PostgreSQL\18\bin\psql.exe" -U postgres -h localhost -p 5432 -f infra\postgres-native-setup.sql
--
-- Une seule invite de mot de passe (celui du superutilisateur `postgres`).

DO $$
BEGIN
  IF NOT EXISTS (SELECT FROM pg_roles WHERE rolname = 'okapi') THEN
    CREATE ROLE okapi LOGIN PASSWORD 'okapi';
  END IF;
END
$$;

-- `prisma migrate dev` crée une base "fantôme" temporaire : le rôle a besoin de CREATEDB.
ALTER ROLE okapi CREATEDB;

SELECT 'CREATE DATABASE okapi OWNER okapi'
WHERE NOT EXISTS (SELECT FROM pg_database WHERE datname = 'okapi')
\gexec

\c okapi

CREATE EXTENSION IF NOT EXISTS pgcrypto;
CREATE EXTENSION IF NOT EXISTS citext;
CREATE EXTENSION IF NOT EXISTS pg_trgm;
CREATE EXTENSION IF NOT EXISTS btree_gist;

\echo 'OK — role "okapi", base "okapi" et extensions prets.'
