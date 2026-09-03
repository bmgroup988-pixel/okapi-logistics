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

## Authentification (étape 3)

| Méthode | Route | Accès |
|---------|-------|-------|
| POST | `/api/v1/auth/login` | public — `{ email, password, otp? }` → `{ accessToken, refreshToken, expiresIn }` ; renvoie `MFA_REQUIRED` si TOTP actif |
| POST | `/api/v1/auth/token` | public — `{ refreshToken }` → rotation à usage unique |
| POST | `/api/v1/auth/logout` | public — révoque la session |
| GET  | `/api/v1/me` | authentifié — rôles, permissions, périmètre |
| POST | `/api/v1/auth/mfa/enroll` | authentifié — secret TOTP + URI otpauth |
| POST | `/api/v1/auth/mfa/verify` | authentifié — `{ otp }` active le MFA |
| GET/POST/PATCH/DELETE | `/api/v1/admin/users…` | permission `user:manage` |

- Mots de passe : **Argon2id**. Verrouillage progressif après 5 échecs (15 min).
- Jetons : access JWT HS256 (15 min) + refresh opaque rotatif en base, révocable.
- MFA : TOTP RFC 6238 (implémentation interne, sans dépendance) ; secret chiffré AES-256-GCM (repli dev — KMS en prod).
- Autorisation : `JwtAuthGuard` + `PermissionsGuard` globaux ; `@Public()`, `@RequirePermissions()`, `@CurrentUser()`.
- Journal d'audit (`AuditService`) : LOGIN / LOGIN_FAILED / CONFIG_CHANGE / UPDATE… (PII expurgées).

## Colis (étape 4)

| Méthode | Route | Permission | Notes |
|---------|-------|-----------|-------|
| POST | `/api/v1/parcels` | `parcel:create` | en-tête `Idempotency-Key` (RG-12) ; calcule prix (D6), convertit vers devise de facturation puis USD, génère le n° de suivi (séquentiel par destination, mensuel — D2), crée expéditeur/destinataire + évènement + consentement |
| GET | `/api/v1/parcels` | `parcel:read` | filtres statut / paiement / destination / agence / pays / mode / période / `q` ; **périmètre appliqué** (RG-10) |
| GET | `/api/v1/parcels/:id` | `parcel:read` | fiche complète (contacts, évènements, photos signées) |
| PATCH | `/api/v1/parcels/:id` | `parcel:update` | uniquement au statut `ENREGISTRE` |
| POST | `/api/v1/parcels/:id/transition` | `parcel:transition` | machine à états (RG-07) ; blocage/dérogation livraison impayée selon le pays (RG-08) ; verrouille les photos à `EN_TRANSIT` ; met en file les notifications |
| POST | `/api/v1/parcels/:id/cancel` | `parcel:cancel` | motif obligatoire |
| GET | `/api/v1/parcels/:id/events` | `parcel:read` | historique |
| POST | `/api/v1/parcels/:id/photos/presign` | `parcel:photo:write` | URL PUT S3 signée (l'API ne relaie pas le binaire) |
| POST | `/api/v1/parcels/:id/photos` | `parcel:photo:write` | confirme l'upload `{ storageKey, sha256, bytes, mimeType, isPrimary }` |
| GET | `/api/v1/parcels/:id/photos` | `parcel:read` | URLs GET signées (≤ 15 min) |

Services transverses introduits : `SequenceService` (compteurs atomiques),
`FxService` (conversion via devise pivot USD, `FX_RATE_MISSING` si taux absent),
`PricingService` (résolution tarif ville→ville puis corridor, `TARIFF_MISSING`),
`StorageService` (pré-signature SigV4 maison, compatible OVHcloud / MinIO),
`NotificationsService` (journalisation ; envoi effectif branché à l'étape 6),
`IdempotencyService`.

## Paiements & facturation (étape 5)

| Méthode | Route | Permission | Notes |
|---------|-------|-----------|-------|
| POST | `/api/v1/parcels/:id/payments` | `payment:create` | `Idempotency-Key` ; devise libre → conversion figée vers la devise de facturation ET USD (EF-PAY-05) ; `CASH` = confirmé d'emblée, sinon `EN_ATTENTE` (EF-PAY-12) ; recalcule solde + statut (RG-03) ; reçu PDF + notification si confirmé |
| GET | `/api/v1/parcels/:id/payments` | `payment:create` | historique |
| GET | `/api/v1/parcels/:id/documents` | `document:read` | étiquette, reçus, factures, avoirs — URLs signées |
| POST | `/api/v1/payments/:id/confirm` | `payment:confirm` | `EN_ATTENTE` → `CONFIRME` |
| POST | `/api/v1/payments/:id/fail` | `payment:confirm` | `EN_ATTENTE` → `ECHOUE` |
| POST | `/api/v1/payments/:id/refund` | `payment:refund` | crée un paiement lié `REMBOURSE` + avoir ; motif obligatoire (EF-PAY-09) |

- **Facturation** (`BillingService`) : à l'enregistrement → étiquette 100×150 mm
  (QR = lien de suivi) + reçu d'enregistrement ; à chaque paiement confirmé → reçu
  de paiement ; à la clôture (`PAYE`) → facture ; à un remboursement → avoir.
- Numérotation continue **par pays** (`ISO2-AAAA-000000`), pièces `invoices`
  immuables (RG-09). TVA 0 par défaut (D13).
- PDF via `pdf-lib` + `qrcode` (purs JS) ; dépôt objet côté serveur par URL PUT
  signée (SigV4) ; échec d'upload non bloquant (PDF régénérable).

Modules restants : FX admin + tarifs admin + sync exchangerate.host (étape 6),
suivi public (étape 7), reporting.
