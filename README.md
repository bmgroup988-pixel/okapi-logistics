# Okapi Logistics — Plateforme d'enregistrement, de suivi et de facturation de colis

Application internationale multi-devises et multi-langues pour le fret aérien/maritime
d'Okapi Logistics.

> **Slogan** — « Le futur du commerce africain »

---

## État des livrables

| # | Livrable | Statut | Emplacement |
|---|----------|--------|-------------|
| 0 | Registre des décisions (réponses aux 15 questions) | ✅ Livré | [`docs/00-registre-decisions.md`](docs/00-registre-decisions.md) |
| 1 | Spécifications techniques détaillées | ✅ Livré (v1.1) | [`docs/01-specifications-techniques.md`](docs/01-specifications-techniques.md) |
| 2 | Architecture (back-end + BDD centralisée) | ✅ Livré (v1.1) | [`docs/02-architecture.md`](docs/02-architecture.md) |
| 3 | Modèle de données / schéma BDD | ✅ Livré (v1.1) | [`docs/03-modele-de-donnees.md`](docs/03-modele-de-donnees.md) + [`db/schema.sql`](db/schema.sql) |
| 4 | Wireframes interfaces agent / admin / client | ✅ Livré (v1) | [`docs/04-wireframes.md`](docs/04-wireframes.md) + [`wireframes/index.html`](wireframes/index.html) |
| 5 | Application fonctionnelle (back-office + suivi public) | ✅ Livré (MVP) | `packages/`, `apps/` |
| — | Manuel d'installation et de configuration | ✅ Livré | [`docs/05-manuel-installation-configuration.md`](docs/05-manuel-installation-configuration.md) |
| 6 | Manuel d'utilisation agent | 🚧 En cours | [`docs/06-manuel-agent.md`](docs/06-manuel-agent.md) |
| 6 | Manuel d'utilisation administration | 🚧 En cours | [`docs/07-manuel-administration.md`](docs/07-manuel-administration.md) |
| 7 | Plan de déploiement multi-pays (FR / CN / NG) | 🚧 En cours | [`docs/08-plan-deploiement-multipays.md`](docs/08-plan-deploiement-multipays.md) |

**Ce dépôt contient aujourd'hui les livrables 0 à 4.** Les 15 questions ouvertes ont été
tranchées par le client le 2026-09-03 ; voir le registre des décisions. Les documents 1 à 3
ont été alignés sur ces décisions (v1.1).

---

## Stack retenue

| Couche | Technologie |
|--------|-------------|
| Back-end | Node.js LTS + TypeScript, **NestJS**, Prisma ORM |
| Base de données | **PostgreSQL 16** (managé, hébergement régionalisé) |
| Cache / files de traitement | Redis + BullMQ |
| Stockage des photos | Stockage objet S3-compatible + URL signées |
| Front-office (back-office agents/admin) | **React 18 + TypeScript + Vite**, TanStack Query, i18next |
| Page publique de suivi | Application légère server-rendered (Next.js), multilingue fr / en / zh |
| API | REST versionnée (`/api/v1`), spécifiée en OpenAPI 3.1 |
| Auth | JWT (access court + refresh rotatif), Argon2id, TOTP pour les rôles siège |
| Notifications | Abstraction multi-fournisseurs : SMS, WhatsApp Business, e-mail |
| Observabilité | Logs structurés (pino), OpenTelemetry, Sentry |
| Déploiement | Conteneurs Docker, CI/CD GitHub Actions, IaC Terraform |

Justification détaillée : [`docs/02-architecture.md`](docs/02-architecture.md#2-choix-de-stack).

---

## Arborescence cible du dépôt

```
okapi-logistics/
├── README.md
├── docs/
│   ├── 00-registre-decisions.md
│   ├── 01-specifications-techniques.md
│   ├── 02-architecture.md
│   ├── 03-modele-de-donnees.md
│   ├── 04-wireframes.md
│   ├── 05-manuel-agent.md          (à venir)
│   ├── 05-manuel-administration.md (à venir)
│   └── 06-plan-deploiement.md      (à venir)
├── db/
│   └── schema.sql                  DDL PostgreSQL de référence
├── infra/
│   └── docker-compose.yml          services de dev : Postgres, Redis, MinIO, Mailhog
├── apps/
│   ├── api/                        back-end NestJS 11 + Prisma 6 (auth, colis, paiements,
│   │                               facturation, FX, tarifs, config, suivi public, référentiels)
│   ├── back-office/                SPA React 19 + Vite (agent + admin + super-admin)
│   └── suivi-public/               site public Next.js 15, fr/en/zh
└── packages/
    └── shared/                     contrats, énums, schémas Zod, calculs monétaires, i18n
```

### Application (livrable 5) — construite en 8 étapes

| Étape | Contenu | Commit |
|-------|---------|--------|
| 1 | Monorepo npm workspaces + `@okapi/shared` (domaine pur testé) | `Etape 1/8` |
| 2 | API NestJS + schéma Prisma (35 modèles) + seed + infra Docker | `Etape 2/8` |
| 3 | Auth Argon2id + JWT + TOTP + RBAC + périmètre + journal d'audit | `Etape 3/8` |
| 4 | Module colis + services (séquences, FX, pricing, stockage SigV4, notifications) | `Etape 4/8` |
| 5 | Paiements + facturation (reçus / factures / avoirs PDF, recalcul solde) | `Etape 5/8` |
| 6 | Taux de change (admin + sync exchangerate.host) + tarifs admin + configuration | `Etape 6/8` |
| 7 | Suivi public Next.js fr/en/zh + endpoint public de suivi | `Etape 7/8` |
| 8 | Back-office React/Vite (connexion, tableau de bord, enregistrement colis, fiche, encaissement, tarifs, taux, utilisateurs, identité visuelle) | `Etape 8/8` |

**Vérifié hors ligne** : `npm run typecheck` + `npm run lint` verts sur les 4 workspaces,
19 tests unitaires verts, les 3 applications se *build*ent. **Non exécuté ici** (PostgreSQL /
Docker indisponibles dans l'environnement) : migrations, seed, serveur, tests d'intégration —
lancer `npm run infra:up` puis `npm run db:migrate && npm run db:constraints && npm run db:seed`.

---

## Développement

Prérequis : **Node.js 20+** (voir `.nvmrc`), et **Docker Desktop** pour les services locaux.

```bash
# 1. dépendances (npm workspaces)
npm install

# 2. services locaux (Postgres, Redis, MinIO, Mailhog)
npm run infra:up

# 3. variables d'environnement
cp .env.example .env

# 4. (étape 2+) migrations + jeu de données de référence
npm run db:migrate
npm run db:seed

# 5. lancer une application
npm run dev:api           # API REST        http://localhost:3000
npm run dev:public        # suivi public    http://localhost:3001
npm run dev:back-office   # back-office      http://localhost:5173
```

Qualité : `npm run typecheck` · `npm test` · `npm run lint` (tous les workspaces).

### Paquet `@okapi/shared`

Cœur métier **pur et testé**, réutilisé par l'API et les deux fronts :
calcul du numéro de suivi (par destination, mensuel — D2), arithmétique décimale exacte
sur `bigint` (aucun flottant), conversion multi-devises via devise pivot (USD),
calcul du prix (`prix_par_kg × poids` + options — D6), calcul du statut de paiement et
du solde (dérivés — RG-03), machine à états du colis (RG-07), permissions RBAC,
schémas Zod partagés, modèles de notification fr/en/zh.

```bash
npm test --workspace @okapi/shared
```

---

## Glossaire

| Terme | Définition |
|-------|------------|
| **Colis** (*parcel*) | Dossier d'expédition unique identifié par un numéro de suivi. |
| **Corridor** | Liaison entre un pays d'origine et un pays de destination (ex. Bénin → RDC). |
| **Devise de référence** | Devise unique de consolidation des rapports du siège (défaut : USD). |
| **Numéro de suivi** | Identifiant public : `OKP` + `AAMM` + séquentiel mensuel 4 chiffres + code ville destination. Ex. `OKP26070042FIH`. |
| **Statut de paiement** | `PAYE`, `PARTIEL` (avec solde restant), `IMPAYE` — calculé automatiquement. |
| **Agence** | Point physique d'enregistrement, rattaché à une ville et un pays. |
| **Siège / DAF** | Direction Administrative et Financière — supervision consolidée. |
| **RGPD** | Règlement Général sur la Protection des Données (UE 2016/679), requis pour l'ouverture France. |

---

## Conventions de rédaction

- Les identifiants de tables et colonnes sont en anglais `snake_case` (portabilité, outillage).
- Les libellés fonctionnels et l'interface utilisateur sont en français, anglais et chinois.
- Tout montant est stocké avec sa **devise d'origine** ET son équivalent en devise de référence.
- Toute action sensible (paiement, modification tarifaire, changement de droits) est journalisée.
