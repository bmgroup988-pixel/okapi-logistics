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
| 4 | Wireframes interfaces agent / admin / client | ✅ Livré (v1) | [`docs/04-wireframes.md`](docs/04-wireframes.md) |
| 5 | Application fonctionnelle (back-office + suivi public) | ⏳ À venir | `apps/` |
| 6 | Manuel d'utilisation agents + administration | ⏳ À venir | `docs/05-manuel-*.md` |
| 7 | Plan de déploiement multi-pays (FR / CN / NG) | ⏳ À venir | `docs/06-plan-deploiement.md` |

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
│   ├── schema.sql                  DDL PostgreSQL de référence
│   └── seed/                       jeux de données de référence (villes, devises…)
├── apps/
│   ├── api/                        back-end NestJS            (à venir)
│   ├── back-office/                SPA React agents + admin   (à venir)
│   └── suivi-public/               site public de suivi       (à venir)
└── packages/
    ├── shared/                     types, contrats, i18n partagés (à venir)
    └── config/                     configuration lint / tsconfig  (à venir)
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
