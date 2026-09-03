# @okapi/api — API REST Okapi Logistics

NestJS 11 + Prisma 6 + PostgreSQL 16. Préfixe `/api/v1`.

## Démarrage

```bash
# à la racine du monorepo
npm install
npm run infra:up                     # Postgres, Redis, MinIO, Mailhog (Docker)
cp .env.example apps/api/.env

npm run prisma:migrate --workspace @okapi/api    # crée le schéma
npm run db:constraints --workspace @okapi/api    # colonne générée, triggers, EXCLUDE, index trigram
npm run seed --workspace @okapi/api              # référentiel + comptes de démo

npm run dev:api                       # http://localhost:3000/api/v1
```

Sonde : `GET /api/v1/health`.

## Comptes de démonstration (après seed)

| Compte | E-mail | Rôle |
|--------|--------|------|
| Super-admin | `admin@okapi.example` | SUPER_ADMIN (global) |
| Agent fret | `a.boni@okapi.example` | AGENT_FRET (Agence Cotonou) |

Mot de passe : valeur de `SEED_PASSWORD` (`OkapiDev!2026` par défaut).

## Structure

```
prisma/
  schema.prisma        modèle de données (miroir de db/schema.sql)
  sql/00_constraints.sql  objets non gérés par Prisma (à appliquer après migrate)
  apply-sql.ts         exécute 00_constraints.sql
  seed.ts              jeu de données de référence (idempotent)
src/
  main.ts              bootstrap (helmet, CORS, préfixe, filtre d'erreurs)
  app.module.ts        ConfigModule + Throttler + Prisma + Health
  config/              validation d'environnement (Zod) + config typée
  common/              request-id, filtre d'exceptions, pipe Zod, pagination
  prisma/              PrismaService (+ ping /health)
  health/              GET /api/v1/health
```

Les modules métier (auth/RBAC, colis, paiements, facturation, FX, notifications,
suivi public, reporting) sont ajoutés aux étapes 3 à 6.
