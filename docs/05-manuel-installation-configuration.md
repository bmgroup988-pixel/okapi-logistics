# 05 — Manuel d'installation et de configuration

Version 1.0 — 2026-09-03
Public : équipe technique, administrateur système, intégrateur.
Prérequis de lecture : [`02-architecture.md`](02-architecture.md),
[`03-modele-de-donnees.md`](03-modele-de-donnees.md),
[`00-registre-decisions.md`](00-registre-decisions.md).

---

## Table des matières

1. [Vue d'ensemble](#1-vue-densemble)
2. [Prérequis](#2-prerequis)
3. [Installation en développement local](#3-installation-en-developpement-local)
4. [Variables d'environnement](#4-variables-denvironnement)
5. [Base de données : migrations, contraintes, jeu de données](#5-base-de-donnees)
6. [Lancer les applications](#6-lancer-les-applications)
7. [Première connexion et comptes initiaux](#7-premiere-connexion-et-comptes-initiaux)
8. [Configuration fonctionnelle (sans intervention technique)](#8-configuration-fonctionnelle)
9. [Configuration des fournisseurs externes](#9-configuration-des-fournisseurs-externes)
10. [Déploiement en production (OVHcloud)](#10-deploiement-en-production-ovhcloud)
11. [Exploitation](#11-exploitation)
12. [Dépannage](#12-depannage)

---

## 1. Vue d'ensemble

Le dépôt est un **monorepo npm workspaces** :

| Paquet | Rôle | Port dev |
|--------|------|----------|
| `packages/shared` (`@okapi/shared`) | Cœur métier pur : calculs monétaires, numéro de suivi, prix, statut de paiement, schémas Zod, i18n. | — |
| `apps/api` (`@okapi/api`) | API REST NestJS 11 + Prisma 6 + PostgreSQL 16. Préfixe `/api/v1`. | 3000 |
| `apps/suivi-public` (`@okapi/suivi-public`) | Page publique de suivi, Next.js 15, fr/en/zh. | 3001 |
| `apps/back-office` (`@okapi/back-office`) | Back-office agents + administration, React 19 + Vite 6. | 5173 |

Services d'infrastructure : **PostgreSQL**, **Redis** (cache + files), **stockage
objet S3-compatible**, **e-mail transactionnel**. En développement, ils sont fournis par
`infra/docker-compose.yml` ; en production, ce sont des offres managées OVHcloud en
région UE (décision D12).

---

## 2. Prérequis

| Outil | Version | Remarque |
|-------|---------|----------|
| Node.js | **20 LTS ou 22** | voir `.nvmrc`. `nvm install` puis `nvm use`. |
| npm | 10+ | fourni avec Node. |
| Docker Desktop | récent | pour `infra:up` en local (Postgres, Redis, MinIO, Mailhog). |
| Git | 2.30+ | sous Windows : `git config core.longpaths true` si le chemin du dépôt est profond. |
| `openssl` (ou équivalent) | — | pour générer des secrets. |

> **npm 12+** applique une politique `allowScripts` : les scripts d'installation de
> `prisma`, `@prisma/client`, `@prisma/engines`, `argon2` et `esbuild` sont pré-autorisés
> dans `package.json` (`allowScripts`). Si un nouveau paquet à script natif est ajouté :
> `npm approve-scripts <paquet>` puis `npm rebuild <paquet>`.

---

## 3. Installation en développement local

```bash
git clone https://github.com/bmgroup988-pixel/okapi-logistics.git
cd okapi-logistics

# 1. Dépendances de tous les workspaces
npm install

# 2. Services locaux (Postgres 5432, Redis 6379, MinIO 9000/9001, Mailhog 1025/8025)
npm run infra:up

# 3. Fichiers d'environnement
cp .env.example .env
cp apps/api/.env.example apps/api/.env

# 4. Base de données
npm run db:migrate        # crée le schéma (Prisma Migrate)
npm run db:constraints    # colonne générée `balance`, contraintes EXCLUDE, triggers, index trigram
npm run db:seed           # référentiel complet + comptes de démonstration

# 5. Lancer les 3 applications (3 terminaux)
npm run dev:api           # http://localhost:3000/api/v1
npm run dev:public        # http://localhost:3001
npm run dev:back-office    # http://localhost:5173
```

Contrôle rapide : `curl http://localhost:3000/api/v1/health` doit répondre
`{"status":"ok","checks":{"database":"up"}}`.

Console MinIO : <http://localhost:9001> (`minioadmin` / `minioadmin`) — le bucket
`okapi-photos` est créé automatiquement par le service `createbucket`.
Boîte mail de test (Mailhog) : <http://localhost:8025>.

### 3.1 Mode sans Docker (PostgreSQL natif + MinIO natif)

`npm run infra:up` **exige Docker**. Pour développer sans Docker, seuls deux services
sont réellement nécessaires ; **Redis** n'est pas connecté au *runtime* dans la version
actuelle et **Mailhog** ne sert qu'aux tests d'e-mail (non câblés).

| Service | Requis ? | Alternative sans Docker |
|---------|:--------:|-------------------------|
| PostgreSQL | **oui** | instance PostgreSQL 16 installée localement (§3.1.1) |
| Stockage objet (S3) | pour l'upload photo + l'archivage PDF uniquement | binaire **MinIO** lancé en natif, ou un vrai bucket S3, ou s'en passer temporairement (l'API démarre ; l'upload photo échoue sans bloquer la création de colis) |
| Redis | non (pour l'instant) | rien |
| Mailhog | non | rien |

#### 3.1.1 PostgreSQL natif

> **Windows : `psql` n'est pas sur le PATH par défaut.** L'installeur EDB ne l'y ajoute
> pas systématiquement. Repérez son chemin (ex.
> `C:\Program Files\PostgreSQL\18\bin\psql.exe` — le numéro de version varie) via :
> `Get-ChildItem "C:\Program Files\PostgreSQL" -Filter psql.exe -Recurse` en PowerShell.
> Utilisez ce chemin complet dans la commande ci-dessous, ou ajoutez le dossier `bin` au
> PATH pour la session (`$env:Path += ';C:\Program Files\PostgreSQL\18\bin'`).

Le script [`infra/postgres-native-setup.sql`](../infra/postgres-native-setup.sql) crée le
rôle, la base et les extensions en **une seule fois** (idempotent — peut être rejoué) :

```powershell
& "C:\Program Files\PostgreSQL\18\bin\psql.exe" -U postgres -h localhost -p 5432 -f infra\postgres-native-setup.sql
```

Une seule invite de mot de passe (celui du superutilisateur `postgres`). Le message final
`OK — role "okapi", base "okapi" et extensions prets.` confirme le succès.

Renseigner ensuite `DATABASE_URL` dans `apps/api/.env` (et `.env` racine) :

```
DATABASE_URL=postgresql://okapi:okapi@localhost:5432/okapi?schema=public
```

Puis, **première initialisation** :

```bash
cd apps/api && npx prisma migrate dev --name init   # crée prisma/migrations/ + applique
cd ../.. && npm run db:constraints                   # colonne générée, EXCLUDE, triggers, index trigram
npm run db:seed                                      # référentiel + comptes de démo
```

Les fois suivantes : `npm run db:migrate` suffit.

#### 3.1.2 MinIO en natif (à faire quand vous voulez les photos / PDF)

1. Télécharger le binaire MinIO pour Windows depuis <https://min.io/download>.
2. Lancer le serveur :

   ```bash
   minio.exe server C:\minio-data --console-address ":9001"
   ```

3. Ouvrir la console <http://localhost:9001> (`minioadmin` / `minioadmin`), créer le
   bucket **`okapi-photos`**, laisser son accès **privé**.
4. Les valeurs `S3_*` par défaut de `apps/api/.env` pointent déjà vers `http://localhost:9000`.

> Pour ceux qui **ont** Docker mais ne veulent que le stockage objet :
> `npm run infra:up:minio` démarre uniquement MinIO + la création du bucket.

### Qualité

```bash
npm run typecheck    # tous les workspaces
npm test             # tests unitaires (@okapi/shared, @okapi/api)
npm run lint
```

---

## 4. Variables d'environnement

Fichier racine `.env` (partagé) et `apps/api/.env` (surcharge API). Modèle :
[`.env.example`](../.env.example) et [`apps/api/.env.example`](../apps/api/.env.example).
Validées au démarrage par Zod (`apps/api/src/config/env.schema.ts`) : un démarrage
échoue avec un message explicite si une variable est absente ou invalide.

### Générales

| Variable | Défaut | Description |
|----------|--------|-------------|
| `NODE_ENV` | `development` | `development` \| `test` \| `staging` \| `production`. |
| `API_PORT` | `3000` | Port d'écoute de l'API. |
| `API_BASE_URL` | `http://localhost:3000` | URL publique de l'API (liens, logs). |
| `PUBLIC_TRACKING_BASE_URL` | `http://localhost:3001` | Base des liens de suivi dans les notifications et le QR de l'étiquette. |
| `CORS_ORIGINS` | `http://localhost:3001,http://localhost:5173` | Origines autorisées (séparées par des virgules). |
| `DEFAULT_LOCALE` | `fr` | Langue par défaut. |
| `CONTACT_EMAIL` | `contact.gokapi@gmail.com` | E-mail de contact affiché (D1) — modifiable ensuite via la configuration. |

### Base de données et cache

| Variable | Défaut | Description |
|----------|--------|-------------|
| `DATABASE_URL` | `postgresql://okapi:okapi@localhost:5432/okapi?schema=public` | Chaîne de connexion PostgreSQL. En prod : instance managée OVHcloud, TLS obligatoire (`?sslmode=require`). |
| `REDIS_URL` | `redis://localhost:6379` | Redis (cache de config, files BullMQ). |

### Stockage objet (S3-compatible)

| Variable | Défaut (dev / MinIO) | Description |
|----------|----------------------|-------------|
| `S3_ENDPOINT` | `http://localhost:9000` | Endpoint S3. Prod : `https://s3.<region>.io.cloud.ovh.net`. |
| `S3_REGION` | `eu-west-par` | Région. Prod OVHcloud : `gra`, `sbg`, `rbx`… (UE). |
| `S3_BUCKET` | `okapi-photos` | Bucket des photos et des PDF. **Accès public désactivé.** |
| `S3_ACCESS_KEY` / `S3_SECRET_KEY` | `minioadmin` | Clés d'accès. Prod : utilisateur S3 dédié, droits limités au bucket. |
| `S3_FORCE_PATH_STYLE` | `true` | `true` pour MinIO ; OVHcloud accepte les deux. |
| `S3_PUBLIC_URL_TTL_SECONDS` | `900` | Expiration des URL GET internes (≤ 15 min — ENF-SEC-08). |
| `S3_CLIENT_URL_TTL_SECONDS` | `3600` | Expiration des URL GET servies au client final (≤ 60 min — EF-SUI-03). |

### Authentification

| Variable | Défaut | Description |
|----------|--------|-------------|
| `JWT_ACCESS_SECRET` | *(à changer)* | Clé HMAC des jetons d'accès. Générer : `openssl rand -base64 48`. Sert aussi de clé maîtresse au chiffrement AES-GCM du secret TOTP en dev (KMS en prod). |
| `JWT_REFRESH_SECRET` | *(à changer)* | Clé des jetons de rafraîchissement. |
| `JWT_ACCESS_TTL` | `900` | Durée de vie du jeton d'accès (s). |
| `JWT_REFRESH_TTL` | `2592000` | Durée de vie du jeton de rafraîchissement (s, 30 j). |

### Multi-devises

| Variable | Défaut | Description |
|----------|--------|-------------|
| `REFERENCE_CURRENCY` | `USD` | Devise pivot de consolidation (D3). Cohérente avec `currencies.is_reference`. |
| `FX_PROVIDER` | `exchangerate.host` | Fournisseur de taux (D8). |
| `FX_API_BASE` | `https://api.exchangerate.host` | Base de l'API de taux. |
| `FX_API_KEY` | *(vide)* | Clé d'accès si le fournisseur l'exige (`?access_key=`). |
| `FX_STALE_HOURS` | `36` | Seuil au-delà duquel un taux est signalé « périmé » dans le back-office. |
| `FX_SYNC_CRON` | `0 */6 * * *` | Fréquence de synchronisation (référence ; l'implémentation MVP utilise un intervalle de 6 h — passer à `@nestjs/schedule` en prod). |

### Notifications

| Variable | Description |
|----------|-------------|
| `WHATSAPP_PROVIDER` | `meta` (API officielle Meta WhatsApp Business — D7). |
| `META_WABA_PHONE_NUMBER_ID` / `META_WABA_TOKEN` | Identifiants du numéro WhatsApp Business et jeton d'accès. |
| `AWS_SES_REGION`, `AWS_SES_ACCESS_KEY`, `AWS_SES_SECRET_KEY` | Amazon SES (e-mail — D7). |
| `SES_FROM_EMAIL` | Adresse d'expédition vérifiée dans SES. |
| `SMS_PROVIDER` | `none` par défaut — fournisseur SMS à choisir (point ouvert O-1). |

### Séquences et relances

| Variable | Défaut | Description |
|----------|--------|-------------|
| `TRACKING_SEQUENCE_SCOPE` | `DESTINATION_CITY` | Portée du compteur du numéro de suivi (D2). |
| `DUNNING_SCHEDULE_DAYS` | `0,2,5` | Jours de relance des colis arrivés impayés. |

### Seed

| Variable | Défaut | Description |
|----------|--------|-------------|
| `SEED_PASSWORD` | `OkapiDev!2026` | Mot de passe des comptes de démonstration créés par `npm run db:seed`. **À ne jamais utiliser en production.** |

---

## 5. Base de données

### 5.1 Migrations Prisma

```bash
# développement (crée/applique une migration + régénère le client)
npm run db:migrate

# production (applique les migrations existantes, ne les crée pas)
npm run prisma:deploy --workspace @okapi/api
```

Le schéma Prisma est `apps/api/prisma/schema.prisma`. Il est le **miroir** de la DDL de
référence `db/schema.sql` (tenue à la main pour la revue). Toute évolution passe par une
migration Prisma **et** une mise à jour de `db/schema.sql`.

### 5.2 Contraintes non gérées par Prisma

Certains objets PostgreSQL ne sont pas exprimables en Prisma et sont appliqués **après**
la migration :

```bash
npm run db:constraints --workspace @okapi/api
```

Ce script (`apps/api/prisma/apply-sql.ts`) exécute `apps/api/prisma/sql/00_constraints.sql` :

- conversion de `parcels.balance` en **colonne générée** `STORED` = `amount_due - amount_paid` ;
- index unique partiel « une seule devise de référence », « une seule photo principale » ;
- index trigram (`pg_trgm`) sur `tracking_number` et `parcel_contacts.name` ;
- contrainte **EXCLUDE** empêchant deux tarifs ville→ville qui se chevauchent ;
- fonction `next_sequence_value(...)` et **trigger** `recompute_parcel_balance` sur `payments`.

> Le recalcul du solde est **aussi** fait côté application (`PaymentsService.recompute`,
> via `@okapi/shared`). Le trigger est une défense en profondeur : les deux sont cohérents.

### 5.3 Jeu de données de référence

```bash
npm run db:seed
```

`apps/api/prisma/seed.ts` est **idempotent** (upserts). Il crée :

- **12 devises** : `USD` (référence), `EUR`, `XOF`, `CDF`, `XAF`, `ZAR`, `RWF`, `BIF`, `TZS`
  actives ; `GBP`, `CNY`, `NGN` inactives (activées aux ouvertures — D4) ;
- **10 pays** (BJ, CD, CG, ZA, RW, BI, TZ, FR, CN, NG) avec devise, langue, politique de
  livraison impayée (`strict` pour FR/CN, `derogation` sinon) ;
- **13 villes** avec code IATA (D5) : `COO`, `FIH`, `FBM`, `BZV`, `PNR`, `JNB`, `KGL`,
  `BJM`, `DAR`, `PAR`, `SHA`, `CAN`, `LOS` ;
- **2 agences** (Cotonou, Kinshasa) ;
- **7 corridors** (BJ→CD, BJ→CG, CD→BJ, CD→ZA, CD→RW, CD→BI, CD→TZ) ;
- **6 tarifs prix/kg** de démonstration (à remplacer par les grilles réelles — point O-3) ;
- **8 taux de change** de départ vers USD ;
- **rôles** `AGENT_FRET`, `ADMIN_DAF`, `SUPER_ADMIN` + **23 permissions** + attributions ;
- **17 paramètres globaux** (identité visuelle, slogans, devise de référence, portée du
  n° de suivi, calendrier de relance…) ;
- **3 blocs de contenu** du site public (fr/en/zh) ;
- **45 modèles de notification** (5 déclencheurs × 3 canaux × 3 langues) ;
- **4 politiques de rétention** (dossier colis 60 mois, pièces comptables 120, audit 60,
  notifications 13) ;
- **2 comptes de démonstration** (voir §7).

En production, on **ne rejoue pas** la partie « comptes de démonstration » : le
super-administrateur initial est créé manuellement (voir §10.5).

---

## 6. Lancer les applications

| Commande (racine) | Effet |
|-------------------|-------|
| `npm run dev:api` | API en mode watch (`ts-node` + `node --watch`). |
| `npm run dev:public` | Site public Next.js (`next dev -p 3001`). |
| `npm run dev:back-office` | Back-office Vite (`vite`, port 5173, proxy `/api` → `:3000`). |
| `npm run build` | Build de tous les workspaces. |
| `npm run start --workspace @okapi/api` | API compilée (`node dist/main.js`). |

Variables front :

- `apps/back-office` : `VITE_API_BASE` (défaut `/api/v1`), `VITE_API_TARGET` (cible du proxy dev).
- `apps/suivi-public` : `NEXT_PUBLIC_API_BASE` (défaut `http://localhost:3000/api/v1`).

---

## 7. Première connexion et comptes initiaux

Après `npm run db:seed`, deux comptes existent (mot de passe = `SEED_PASSWORD`) :

| Compte | E-mail | Rôle | Périmètre |
|--------|--------|------|-----------|
| Super-administrateur | `admin@okapi.example` | `SUPER_ADMIN` | Global |
| Agent fret | `a.boni@okapi.example` | `AGENT_FRET` | Agence Cotonou |

1. Ouvrir le back-office (<http://localhost:5173>).
2. Se connecter avec `admin@okapi.example`.
3. Aller dans **Configuration → Utilisateurs** : créer les comptes réels, désactiver les
   comptes de démonstration.
4. Activer le **MFA** (obligatoire pour DAF et super-administrateur — ENF-SEC-02) :
   `POST /api/v1/auth/mfa/enroll` renvoie un secret + une URI `otpauth://` à scanner dans
   une application d'authentification, puis `POST /api/v1/auth/mfa/verify` avec le code.

---

## 8. Configuration fonctionnelle

Tout ce qui suit se règle **depuis le back-office** (rôle super-administrateur), sans
redéploiement — exigence EF-CFG-01/02/03.

### 8.1 Identité visuelle et pied de page — écran « Identité visuelle »

Logo, couleurs de marque (`brand.navy`, `brand.orange`, `brand.turquoise`,
`brand.anthracite`), e-mail de contact, slogans fr/en/zh. Prises en compte immédiatement
par la page publique via `GET /api/v1/public/branding`. Chaque modification est
**journalisée** (audit `CONFIG_CHANGE`).

### 8.2 Référentiel — devises / villes / pays / corridors

- **Devise** : ajouter une ligne + l'activer (aucune devise n'est codée en dur). Une seule
  devise `is_reference`.
- **Ville** : code IATA (3 lettres), pays, fuseau, indicateurs origine/destination.
- **Corridor** : pays d'origine → pays de destination.

*(API : `POST /api/v1/admin/currencies` — l'écran d'édition complet du référentiel villes/
pays/corridors est prévu ; en attendant, `db/seed` + endpoints admin.)*

### 8.3 Tarifs — écran « Tarifs (prix/kg) »

Saisir le **prix par kg par destination et par mode** (D6). Optionnels : frais fixes,
minimum, ad valorem. Chaque enregistrement crée une **nouvelle version datée** et clôt la
précédente (pas de chevauchement, garanti aussi par la contrainte EXCLUDE). Journalisé.

> **Avant la mise en production**, saisir les grilles tarifaires réelles (point O-3).

### 8.4 Taux de change — écran « Taux de change »

- **Synchronisation automatique** exchangerate.host au démarrage puis toutes les 6 h ;
  bouton « Synchroniser maintenant ».
- **Saisie manuelle** : un taux `MANUAL` récent **prévaut** sur la synchro.
- Les taux sont **historisés** (append-only) ; un badge signale les taux de plus de
  `FX_STALE_HOURS` heures.

### 8.5 Textes du site public

`PUT /api/v1/admin/content/:key` avec `{ fr, en, zh }`. Blocs : titre et sous-titre
d'accueil, slogan, et à compléter (mentions légales, confidentialité, cookies, contact
DPO, FAQ) par pays et par langue.

### 8.6 Modèles de notification

45 modèles créés par le seed (déclencheur × canal × langue). Variables disponibles :
`{{numero_suivi}}`, `{{statut}}`, `{{ville_destination}}`, `{{ville_actuelle}}`,
`{{lien_suivi}}`, `{{solde}}`, `{{devise}}`.

### 8.7 Utilisateurs, rôles et périmètres

- Création / désactivation d'un compte : écran « Utilisateurs ».
- Attribution d'un rôle avec périmètre : `POST /api/v1/admin/users/:id/roles`
  (`{ roleCode, scopeCountryId?, scopeAgencyId? }`). Un `AGENT_FRET` **doit** être rattaché
  à une agence ; un `ADMIN_DAF` peut couvrir plusieurs pays ; `SUPER_ADMIN` est global.
- Réinitialisation MFA : `POST /api/v1/admin/users/:id/reset-mfa`.

---

## 9. Configuration des fournisseurs externes

### 9.1 Stockage objet OVHcloud (production)

1. Créer un conteneur Object Storage **S3-compatible** en région UE (`gra` / `sbg` / `rbx`).
2. Créer un utilisateur S3 dédié, politique restreinte au bucket (lecture/écriture).
3. **Désactiver l'accès public** du conteneur.
4. Renseigner `S3_ENDPOINT`, `S3_REGION`, `S3_BUCKET`, `S3_ACCESS_KEY`, `S3_SECRET_KEY`,
   `S3_FORCE_PATH_STYLE=false`.
5. Activer le chiffrement au repos (SSE) et une **règle de cycle de vie** alignée sur la
   rétention (60 mois pour les dérivés de photos).
6. Le mécanisme de signature (`apps/api/src/storage/sigv4.ts`) est natif AWS SigV4 — aucune
   dépendance ; compatible OVHcloud, AWS S3 et MinIO.

### 9.2 exchangerate.host

1. Créer un compte, récupérer la clé d'accès si le plan l'exige.
2. `FX_API_BASE=https://api.exchangerate.host`, `FX_API_KEY=<clé>`.
3. Vérifier la première synchro : back-office → « Taux de change » → « Synchroniser
   maintenant » ; les lignes doivent passer en source `API` avec un âge faible.

### 9.3 Meta WhatsApp Business API

1. Créer une **application Meta** + un **compte WhatsApp Business (WABA)**, ajouter et
   vérifier le numéro d'expédition.
2. Faire **approuver les modèles de message** correspondant aux déclencheurs (Meta exige
   des *templates* pré-approuvés pour les messages sortants hors fenêtre de 24 h).
3. `META_WABA_PHONE_NUMBER_ID`, `META_WABA_TOKEN` (jeton système à durée longue).
4. Configurer le **webhook** d'accusé de réception vers `POST /api/v1/webhooks/whatsapp`
   *(endpoint à brancher lors de l'activation de l'envoi — étape ultérieure)*.

> **Chine** : WhatsApp n'est pas disponible. Utiliser SMS + e-mail, et prévoir un
> connecteur WeChat via un partenaire local (voir livrable 08 — plan de déploiement).

### 9.4 Amazon SES

1. Région proche du périmètre (`eu-west-1` / `eu-west-3`).
2. **Vérifier le domaine** d'expédition (DKIM, SPF, DMARC) et l'adresse `SES_FROM_EMAIL`.
3. Demander la **sortie du mode bac à sable** SES.
4. `AWS_SES_REGION`, `AWS_SES_ACCESS_KEY`, `AWS_SES_SECRET_KEY`, `SES_FROM_EMAIL`.

### 9.5 Fournisseur SMS (à choisir — point O-1)

Sélectionner un agrégateur couvrant les corridors (ex. Twilio, Vonage, Africa's Talking,
ou accords directs opérateurs). Implémenter `SmsProvider` (interface `NotificationProvider`)
et renseigner `SMS_PROVIDER` + les identifiants dédiés. À défaut, WhatsApp + e-mail
assurent la couverture au lancement.

---

## 10. Déploiement en production (OVHcloud)

### 10.1 Topologie cible

| Composant | Offre OVHcloud | Région |
|-----------|----------------|--------|
| Base de données | **Managed Databases for PostgreSQL 16** (+ réplica, PITR) | UE (`gra` / `sbg`) |
| Cache / files | **Managed Databases for Redis** (ou conteneur dédié) | même région |
| Stockage objet | **Object Storage S3-compatible** (versioning, cycle de vie) | UE |
| Exécution | **Managed Kubernetes Service** *ou* **Public Cloud Instances** + Docker | UE |
| Frontal | **Load Balancer** + TLS, CDN/WAF devant le site public | — |
| Secrets | Coffre de secrets (KMS / gestionnaire de secrets) | — |
| Observabilité | Logs (Loki/ELK), métriques (Prometheus/Grafana), erreurs (Sentry) | — |

Le périmètre **France / UE** est hébergé en région UE (résidence des données RGPD — D12).
Cible : instance régionale dédiée UE pour la France (ADR-007) ; démarrage possible en
instance unique UE cloisonnée par pays.

### 10.2 Images Docker

Produire une image par application :

```
apps/api/Dockerfile              # node:20-alpine, build multi-stage, `node dist/main.js`
apps/suivi-public/Dockerfile     # next build -> next start (ou export statique + CDN)
apps/back-office/Dockerfile      # vite build -> service statique (nginx / CDN)
```

*(Les Dockerfile ne sont pas encore versionnés ; gabarits multi-stage standards.)*

### 10.3 CI/CD (GitHub Actions)

Pipeline recommandé (voir [`02-architecture.md`](02-architecture.md#13-environnements-cicd-iac)) :

1. `npm ci` + `npm run typecheck` + `npm test` + `npm run lint`
2. Audit des dépendances + SAST + scan d'image
3. Build des images → registre privé
4. `prisma migrate deploy` en *job* dédié **avant** la bascule
5. `npm run db:constraints` (idempotent)
6. Déploiement *rolling* / *blue-green* ; *smoke test* `GET /api/v1/health`
7. Rollback automatisé si les sondes échouent

### 10.4 Secrets

Aucun secret dans le dépôt ni dans la base. En production :

- `JWT_ACCESS_SECRET`, `JWT_REFRESH_SECRET` : `openssl rand -base64 48`, stockés au coffre.
- Le chiffrement du secret TOTP utilise une **clé maîtresse KMS** distincte (remplacer le
  repli dev basé sur `JWT_ACCESS_SECRET` dans `apps/api/src/auth/auth.service.ts`).
- Clés S3 / SES / Meta / exchangerate.host : au coffre, injectées comme variables
  d'environnement au déploiement. Rotation documentée.

### 10.5 Super-administrateur initial (production)

Ne pas exécuter la partie « comptes de démonstration » du seed. Créer le premier compte
par un script ponctuel ou une console Prisma :

```bash
node -e "require('argon2').hash(process.argv[1]).then(h=>console.log(h))" 'MOT_DE_PASSE_FORT'
# puis INSERT dans users + user_roles (rôle SUPER_ADMIN) via psql / Prisma Studio
```

Le seed du **référentiel** (devises, pays, villes, rôles, permissions, modèles de
notification, politiques de rétention) reste à exécuter : il est idempotent et sans PII.

### 10.6 Sauvegardes

- PostgreSQL : PITR ≥ 7 jours, sauvegarde complète quotidienne conservée 30 jours,
  **test de restauration trimestriel** (ENF-DISP-02).
- Stockage objet : versioning activé + réplication inter-région.
- RPO ≤ 15 min, RTO ≤ 4 h.

---

## 11. Exploitation

| Sujet | Où |
|-------|-----|
| Santé | `GET /api/v1/health` (statut + ping base). Sonde *readiness*/*liveness* Kubernetes. |
| Logs | JSON structuré, corrélés par `x-request-id` ; aucune donnée personnelle en clair. |
| Journal d'audit | Table `audit_logs` append-only ; export via `GET /api/v1/admin/audit-logs` (rôles DAF/super-admin). |
| Taux de change périmés | Badge dans le back-office ; alerte si `âge > FX_STALE_HOURS`. |
| Files de traitement | Redis/BullMQ (notifications, PDF, images, sync FX) — profondeur et taux d'échec à surveiller. |
| Rétention RGPD | `retention_policies` + tâche planifiée d'anonymisation/purge (dossier colis 60 mois après livraison — D15). |
| Rotation des secrets | JWT + clés fournisseurs ; procédure au coffre ; invalidation des sessions à la rotation des clés JWT. |

### Restauration

1. Restaurer la base à un point dans le temps (PITR OVHcloud).
2. Vérifier `GET /api/v1/health`.
3. Rejouer `npm run db:constraints` (idempotent) si la restauration précède une migration
   de contraintes.
4. Contrôler la cohérence : `SELECT * FROM v_parcel_financials WHERE amount_paid_calc <> amount_paid_stored;`
   doit être vide.

---

## 12. Dépannage

| Symptôme | Cause probable | Résolution |
|----------|----------------|------------|
| `Configuration d'environnement invalide` au démarrage | variable manquante/incorrecte | lire le message (chemin + raison), compléter `.env`. |
| `FX_RATE_MISSING` à la création d'un colis ou d'un paiement | aucun taux pour le couple devise → référence | back-office → Taux de change → saisir un taux manuel, ou lancer la synchro. |
| `TARIFF_MISSING` | aucun prix/kg pour (destination, mode) | back-office → Tarifs → créer le tarif. |
| Upload photo refusé (`Upload refusé (403)`) | stockage objet injoignable / clés invalides / bucket absent | vérifier `S3_*`, l'existence du bucket, l'horloge du serveur (SigV4 est sensible à l'heure). |
| `IDEMPOTENCY_KEY_MISMATCH` (409) | même clé `Idempotency-Key` réutilisée avec un corps différent | générer une nouvelle clé côté client pour une nouvelle opération. |
| `UNPAID_DELIVERY_BLOCKED` au passage à « Livré » | pays en politique `strict`, ou justification absente en politique `derogation` | régler le solde, ou fournir `unpaidOverrideReason` (tracé). |
| Windows : `Filename too long` / `ENOTEMPTY` lors de `npm install` | chemin du dépôt trop profond | `git config core.longpaths true` ; déplacer le dépôt vers un chemin court (`C:\code\okapi-logistics`). |
| `npm warn allow-scripts` (prisma/argon2/esbuild) | npm 12 bloque les scripts d'installation | `npm approve-scripts <paquet>` puis `npm rebuild <paquet>`. |
| Le back-office renvoie 401 en boucle | jeton de rafraîchissement expiré/révoqué | se reconnecter ; vérifier l'horloge et les secrets JWT côté API. |
| Sondes `database: down` | Postgres injoignable | `npm run infra:up` ; vérifier `DATABASE_URL`. |

---

*Fin du document 05. Suite : [`06-manuel-agent.md`](06-manuel-agent.md),
[`07-manuel-administration.md`](07-manuel-administration.md),
[`08-plan-deploiement-multipays.md`](08-plan-deploiement-multipays.md).*
