# 09 — Addendum : extension du réseau (26 provinces RDC), tarification par paire origine-destination, et permissions de réception/retrait

> Document complémentaire à `02-architecture.md` et `03-modele-de-donnees.md`. Il ne remplace aucune section existante ; il ajoute les évolutions nécessaires pour couvrir un réseau multidirectionnel avec un référentiel de villes extensible.
>
> **État : intégré le 2026-09-10.** Ce document est conservé comme la spécification source de l'extension (reçue du client sous le nom `08addendumextensionreseauetpermissions.md`, renuméroté `09` ici car `08` désignait déjà `08-plan-deploiement-multipays.md`). Les points qu'il laissait ouverts ont été arbitrés dans
> [`00-registre-decisions.md`](00-registre-decisions.md#décisions--addendum-08-extension-réseau-tarification-permissions)
> (décisions **D16** à **D21**), et le résultat de l'intégration est reflété dans `02-architecture.md` §3/§5.2, `03-modele-de-donnees.md` §3/§5/§14 et le code (`apps/api`, `packages/shared`). Des encadrés « **Intégration** » ont été ajoutés ci-dessous aux points où le texte source a été précisé ou tranché ; le reste du texte original est inchangé.

---

## 1. Référentiel de villes — couverture des 26 provinces de la RDC

### 1.1 Principe retenu

Le référentiel `City` reste une **donnée**, jamais une valeur codée en dur dans l'application. Chaque ville est identifiée par son chef-lieu de province, avec un code interne à 3 lettres (aligné IATA quand l'aéroport existe, sinon code interne cohérent avec le même format). Ce choix garantit que l'ajout d'une 27ᵉ ville demain — ou d'un pays supplémentaire — se fait par une insertion en base, sans modification de code ni redéploiement.

### 1.2 Statut de couverture

Deux statuts sont nécessaires sur `City` (ou sur `Agency`, voir §1.4) pour refléter la réalité opérationnelle : vous desservez déjà 20 provinces sans y avoir de bureau propre, via des partenaires de livraison.

| Statut | Signification |
|---|---|
| `HUB` | Agence propre Okapi Logistics (bureau, agents salariés) |
| `PARTNER` | Livraison assurée par un partenaire tiers, pas de bureau Okapi |
| `PLANNED` | Ville identifiée, pas encore active (aucun flux) |

> **Intégration (D18).** `status` a été ajouté sur `cities` avec exactement ces trois valeurs (`CityStatus`). Les villes du réseau international déjà en service (Cotonou, Brazzaville, Pointe-Noire, Johannesburg, Kigali, Bujumbura, Dar es Salaam, Paris, Shanghai, Guangzhou, Lagos) sont classées `HUB` par défaut au seed — le modèle partenaire vise le dernier kilomètre domestique RDC, pas le fret international classique.

### 1.3 Tableau des 26 provinces / chefs-lieux

| # | Province | Ville (chef-lieu) | Code | Statut initial |
|---|---|---|---|---|
| 1 | Bas-Uele | Buta | BZU | PARTNER |
| 2 | Équateur | Mbandaka | MDK | PARTNER |
| 3 | Haut-Katanga | Lubumbashi | FBM | HUB *(existait déjà)* |
| 4 | Haut-Lomami | Kamina | KMN | PARTNER |
| 5 | Haut-Uele | Isiro | IRP | PARTNER |
| 6 | Ituri | Bunia | BUX | PARTNER |
| 7 | Kasaï | Tshikapa | TSH | PARTNER |
| 8 | Kasaï-Central | Kananga | KGA | PARTNER |
| 9 | Kasaï-Oriental | Mbuji-Mayi | MJM | PARTNER |
| 10 | Kinshasa | Kinshasa | FIH | HUB *(existait déjà)* |
| 11 | Kongo-Central | Matadi | MAT | PARTNER |
| 12 | Kwango | Kenge | KEN | PARTNER |
| 13 | Kwilu | Bandundu | FDU | PARTNER |
| 14 | Lomami | Kabinda | KBN | PARTNER |
| 15 | Lualaba | Kolwezi | KWZ | HUB *(couverture directe)* |
| 16 | Mai-Ndombe | Inongo | INO | PARTNER |
| 17 | Maniema | Kindu | KND | PARTNER |
| 18 | Mongala | Lisala | LIQ | PARTNER |
| 19 | Nord-Kivu | Goma | GOM | PARTNER |
| 20 | Nord-Ubangi | Gbadolite | BDT | PARTNER |
| 21 | Sankuru | Lusambo | LUS | PARTNER |
| 22 | Sud-Kivu | Bukavu | BKY | PARTNER |
| 23 | Sud-Ubangi | Gemena | GMA | PARTNER |
| 24 | Tanganyika | Kalemie | FMI | PARTNER |
| 25 | Tshopo | Kisangani | FKI | PARTNER |
| 26 | Tshuapa | Boende | BNB | PARTNER |

> **Intégration.** Les 26 codes ci-dessus ont été repris **sans modification** dans `apps/api/prisma/seed.ts` (`seedCities()`), avec le fuseau horaire correct par ville (`Africa/Kinshasa` à l'ouest, `Africa/Lubumbashi` à l'est de la RDC). Aucune collision détectée avec les codes déjà en usage dans le réseau international existant. Cf. `03-modele-de-donnees.md` §14 pour le tableau complet publié et O-7 (`00-registre-decisions.md`) pour la donnée partenaire réelle restant à saisir ville par ville.

### 1.4 Modélisation : ville ≠ agence, et plusieurs partenaires possibles par ville

Point de conception important : une **ville** (`City`) n'implique pas forcément une **agence Okapi** (`Agency`). Pour les 23 provinces desservies sans bureau, il faut un objet intermédiaire — et, vu la taille du pays et les difficultés d'accès selon les zones, **une même province peut avoir plusieurs partenaires** (2 ou plus), chacun avec sa propre zone de couverture et son propre tarif :

```
DeliveryPartner
  id              uuid PK
  cityId          uuid FK -> City         -- plusieurs partenaires peuvent référencer la même ville
  name            text                    -- raison sociale du partenaire
  coverageZone    text?                   -- ex. "centre-ville uniquement", "axe Kolwezi-Fungurume", zone desservie précise
  contactName     text?
  contactPhone    text?
  contactEmail    text?
  commissionPct   decimal?                -- commission convenue, si applicable
  reliabilityNote text?                   -- délai moyen constaté, fiabilité observée — aide au choix
  isPreferred     boolean                 -- partenaire par défaut proposé pour cette ville
  isActive        boolean
  createdAt / updatedAt
```

Un colis à destination d'une ville `PARTNER` est acheminé jusqu'à l'agence `HUB` la plus proche (ou l'agence d'origine si transit direct), puis remis à **l'un des `DeliveryPartner`** actifs pour cette ville, pour la livraison finale. Le statut du colis distingue donc explicitement « arrivé au hub » de « remis au partenaire » et « livré au client » (voir §3), et conserve la référence du partenaire choisi (`Parcel.deliveryPartnerId`).

#### Choix du partenaire à utiliser pour un colis donné

Puisque plusieurs partenaires peuvent desservir la même province avec des tarifs et zones différents, le choix ne peut pas être automatique par défaut — il dépend de l'adresse précise du destinataire et du prix accepté par le client. Deux approches, non exclusives :

- **Sélection manuelle par l'agent** au moment de la remise (`HANDED_TO_PARTNER`) : l'agent choisit, parmi les partenaires actifs de la ville, celui qui couvre la zone exacte du destinataire — utile tant que le nombre de partenaires reste gérable.
- **Partenaire par défaut** (`isPreferred = true`) proposé automatiquement à la création du colis, avec tarif affiché au client dès le départ ; l'agent peut le remplacer manuellement si la zone du destinataire n'est pas couverte par ce partenaire.

> **Intégration.** `DeliveryPartner` a été ajouté au schéma Prisma avec exactement ces champs (`settlementMode` en plus, voir §5). `parcels.doCreate()` implémente les deux approches : si un seul partenaire actif existe pour la ville (ou un `isPreferred`), il est sélectionné automatiquement ; sinon la création exige un `deliveryPartnerId` explicite (erreur sinon). `transition()` vers `HANDED_TO_PARTNER` exige et valide un `deliveryPartnerId` actif rattaché à la ville de destination du colis.

### 1.5 Tarif par partenaire (et non plus seulement par ville)

Conséquence directe : le tarif de la dernière étape (hub → destinataire final) ne peut plus être attaché uniquement à la ville, puisque deux partenaires de la même ville peuvent facturer différemment. On ajoute donc :

```
PartnerTariff
  id                  uuid PK
  deliveryPartnerId   uuid FK -> DeliveryPartner
  pricePerKg          decimal
  currency            text FK -> Currency
  minWeightKg         decimal?
  isActive            boolean
  effectiveFrom       date
  effectiveTo         date?
```

Le tarif total facturé au client pour un colis vers une ville `PARTNER` = `RouteTariff` (trajet principal, origine → hub le plus proche de la destination) **+** `PartnerTariff` du partenaire retenu (dernière étape). Cette décomposition permet d'afficher au client un tarif différent selon le partenaire choisi, sans dupliquer toute la grille `RouteTariff` par partenaire.

> **Intégration.** `PartnerTariff` ajouté tel quel (avec `@@map("partner_tariffs")`, FK `Currency`). `minWeightKg` est stocké mais **non appliqué** au calcul du montant en v1 (limite documentée dans `03-modele-de-donnees.md`). `parcels.doCreate()` additionne le montant `RouteTariff` (converti en devise de facturation) et le montant `PartnerTariff` actif du partenaire retenu pour produire `amountDue`.

### 1.6 Écran d'administration des villes et partenaires

Nouvel endpoint, réservé `SUPER_ADMIN` (permission `city:write`, déjà prévue dans votre table `permissions`) :

```
POST   /api/v1/admin/cities                    { code, nameKey, countryId, timezone, status }
PATCH  /api/v1/admin/cities/{id}                # changer le statut HUB/PARTNER/PLANNED
GET    /api/v1/admin/cities

POST   /api/v1/admin/delivery-partners          { cityId, name, coverageZone, contactPhone, isPreferred, ... }
PATCH  /api/v1/admin/delivery-partners/{id}
GET    /api/v1/admin/delivery-partners?cityId=  # liste tous les partenaires actifs d'une ville, avec leur zone

POST   /api/v1/admin/delivery-partners/{id}/tariffs   { pricePerKg, currency, effectiveFrom, ... }
GET    /api/v1/admin/delivery-partners/{id}/tariffs
```

Contrainte `UNIQUE` sur `City.code` à conserver (déjà en place côté Prisma). Aucune contrainte d'unicité sur `(DeliveryPartner.cityId)` — c'est justement le point : plusieurs partenaires actifs par ville sont autorisés et attendus.

> **Intégration.** Ces routes existent dans `apps/api/src/delivery-partners/` (`DeliveryPartnersController`/`Service`), gardées par `city:write`. Un endpoint de lecture supplémentaire, non prévu dans le texte source mais nécessaire côté agent, a été ajouté hors périmètre `SUPER_ADMIN` : `GET /api/v1/reference/delivery-partners?cityId=` (lecture seule, tout utilisateur authentifié) — pour permettre à l'agent de choisir un partenaire à la création d'un colis ou à la remise, sans lui donner `city:write`. L'interface back-office pour ces écrans n'est **pas** couverte par cette passe d'intégration (portée « Backend + BDD + docs » uniquement) ; elle reste à construire.

---

## 2. Tarification par paire origine-destination

### 2.1 Limite du modèle actuel

Les 7 corridors actuels (`BJ→CD`, `BJ→CG`, `CD→BJ`, `CD→ZA`, `CD→RW`, `CD→BI`, `CD→TZ`) sont définis au niveau **pays**, de façon quasi unidirectionnelle. Avec un maillage complet ville-à-ville et un tarif potentiellement différent selon le sens, ce modèle ne suffit plus.

### 2.2 Nouveau modèle : `RouteTariff`

```
RouteTariff
  id                  uuid PK
  originCityId        uuid FK -> City
  destinationCityId   uuid FK -> City
  pricePerKg          decimal
  currency            text FK -> Currency
  minWeightKg         decimal?          -- poids minimum facturé
  transitDays         int?              -- délai indicatif
  isActive            boolean
  effectiveFrom       date
  effectiveTo         date?
  createdAt / updatedAt

  UNIQUE (originCityId, destinationCityId, effectiveFrom)
```

Le sens compte : `Kolwezi→Cotonou` et `Cotonou→Kolwezi` sont deux lignes distinctes, avec des tarifs indépendants. Pour les villes `PARTNER`, le `RouteTariff` couvre le trajet principal jusqu'au hub le plus proche ; la dernière étape (hub → destinataire) est facturée séparément via le `PartnerTariff` du partenaire retenu (§1.5), puisque deux partenaires d'une même ville peuvent facturer différemment.

> **Intégration (D17) — écart volontaire par rapport au texte source.** Aucune table `RouteTariff` n'a été créée. Le modèle `Tariff` déjà présent dans le schéma (paire `origin_city_id`/`destination_city_id`, sens explicite, `price_per_kg`, `min_weight_kg`, `transit_days`, versionné par `effective_from`/`effective_to`, unique par paire + date) couvre exactement ce besoin — c'est la même structure sous un autre nom. Créer une seconde table aurait dupliqué le concept sans bénéfice. Seule la dernière étape partenaire (`PartnerTariff`, §1.5) est réellement nouvelle.

### 2.3 Résolution du tarif à la création d'un colis

Ordre de résolution recommandé :
1. Tarif exact `(originCityId, destinationCityId)` actif à la date du jour, dans `RouteTariff`.
2. À défaut, tarif par défaut du corridor pays (`origin.countryId, destination.countryId`) — permet de ne pas bloquer un flux avant que chaque paire de villes ait un tarif dédié.
3. À défaut, rejet de la création avec message explicite pour l'agent (« tarif non configuré pour cette destination — contacter le DAF »).
4. Si la ville de destination est `PARTNER` : ajout du `PartnerTariff` du partenaire sélectionné (par défaut le `isPreferred`, modifiable par l'agent selon la zone exacte du destinataire) — voir §1.4-1.5. Si plusieurs partenaires sont actifs sans partenaire préféré défini, l'agent doit en choisir un explicitement avant validation du colis.

> **Intégration (D19).** `pricing.service.ts` (`quoteForParcel()`) implémentait déjà un ordre de résolution qui couvre et affine celui proposé ici : (1) ville→ville exacte, (2) destination seule toutes origines, (3) corridor pays, (4) erreur `TariffMissingError`. Il n'a pas été modifié par cet addendum. L'étape 4 (ajout `PartnerTariff`) a été implémentée dans `parcels.service.ts`, en aval de `pricing.service.ts`.

### 2.4 Permission

`tariff:write` (déjà réservée `ADMIN_DAF`/`SUPER_ADMIN`) couvre la création/modification des `RouteTariff`. `tariff:read` (déjà dans les permissions `AGENT_FRET`) permet à l'agent de consulter le tarif applicable sans pouvoir le modifier.

---

## 3. Modèle de colis multidirectionnel

### 3.1 Champs `Parcel` à confirmer/ajouter

```
Parcel
  ...
  originAgencyId        uuid FK -> Agency      -- agence qui a créé le colis
  destinationCityId     uuid FK -> City         -- ville finale (peut être HUB ou PARTNER)
  destinationAgencyId   uuid? FK -> Agency      -- si destination = ville HUB
  deliveryPartnerId     uuid? FK -> DeliveryPartner  -- si destination = ville PARTNER
  transitAgencyId       uuid? FK -> Agency      -- agence intermédiaire, si transbordement
  status                enum(...)
```

Le numéro de suivi conserve le format déjà validé `OKP + AAMM + NNNN + code ville de destination` (ex. `OKP2609XXXXFIH`), le code ville étant désormais tiré du référentiel étendu à 26 provinces + villes internationales existantes.

> **Intégration.** `originAgencyId` existait déjà dans le schéma avant l'addendum. `destinationCityId` existait également (champ central de la tarification). `destinationAgencyId`, `deliveryPartnerId` et `transitAgencyId` ont été ajoutés par la migration `20260910150000_network_extension_and_permissions`. `destinationAgencyId` est résolu automatiquement à la création si la ville de destination est `HUB` ; `deliveryPartnerId` est résolu ou exigé si elle est `PARTNER` (§1.4).

### 3.2 Machine à états du colis (proposition)

```
CREATED
  → IN_TRANSIT_TO_HUB          (si transbordement via une agence intermédiaire)
  → ARRIVED_AT_DESTINATION     (voir §4.1 — nouvelle permission requise)
  → HANDED_TO_PARTNER          (si ville PARTNER — remise au livreur tiers)
  → DELIVERED                  (voir §4.2 — nouvelle permission requise, avec paiement)
  → CANCELLED
```

Chaque transition est journalisée dans `AuditLog` avec l'identité de l'agent, l'agence (`scopeAgencyId` actif au moment de l'action), l'horodatage, et — pour `DELIVERED` — la preuve de paiement associée.

> **Intégration — adaptation aux noms de statuts existants.** La machine à états `Parcel` du produit utilise déjà les libellés `ARRIVE` (≈ `ARRIVED_AT_DESTINATION`) et `LIVRE` (≈ `DELIVERED`), avec `RETOURNE` pour les retours. Le texte source a été suivi sur le fond, pas sur la nomenclature : seul le nouveau statut `HANDED_TO_PARTNER` a été ajouté à l'énumération `ParcelStatus` existante, inséré entre `ARRIVE` et `LIVRE`/`RETOURNE` (`ARRIVE → HANDED_TO_PARTNER → LIVRE | RETOURNE`, et `ARRIVE → LIVRE` reste possible directement pour les villes `HUB`). Chaque transition continue d'écrire dans `AuditLog` comme avant, sans changement de ce mécanisme.

---

## 4. Autorisations de réception, retrait et paiement à destination

C'est le point central de votre demande : aujourd'hui `parcel:transition` est une permission générique. Pour un contrôle fin et un audit clair, elle doit être scindée en deux permissions distinctes, correspondant à deux moments et deux responsabilités différentes.

### 4.1 Nouvelle permission : `parcel:arrival:confirm`

- **Usage** : l'agent de l'agence de destination (ou le hub de transit) signale que le colis est physiquement arrivé, avant tout retrait par le client.
- **Effet** : statut `ARRIVED_AT_DESTINATION`, déclenche la notification client (SMS/WhatsApp/e-mail selon vos 45 modèles de notification déjà définis).
- **Endpoint** : `POST /api/v1/agent/parcels/{id}/arrival`
- **Contrainte de périmètre** : l'agent ne peut confirmer l'arrivée que pour un colis dont `destinationAgencyId = scopeAgencyId` de son rôle — jamais pour l'agence d'origine.

### 4.2 Nouvelle permission : `parcel:deliver:confirm`

- **Usage** : l'agent constate le retrait effectif par le client **et** l'encaissement du paiement dû (solde restant, frais de livraison finale, etc.).
- **Effet** : statut `DELIVERED`, verrouillage du dossier colis (plus aucune transition possible sauf par `SUPER_ADMIN` pour correction exceptionnelle), génération du reçu.
- **Endpoint** : `POST /api/v1/agent/parcels/{id}/deliver` avec corps `{ paymentMethod, amountCollected, currency, proofReference? }`
- **Lien avec `payment:create`/`payment:confirm`** : cette action crée ou confirme l'enregistrement `Payment` associé au colis — un agent qui n'a pas `payment:create` ne peut pas finaliser une livraison avec encaissement, seulement signaler l'arrivée (§4.1).

> **Intégration — réutilisation de l'endpoint générique existant.** Aucun endpoint dédié `/arrival` ou `/deliver` n'a été créé : le produit dispose déjà d'un endpoint générique `POST /api/v1/parcels/{id}/transition` (corps `{ to, ... }`) qui couvre toutes les transitions de statut, y compris `ARRIVE` et `LIVRE`. Plutôt que de dupliquer ce mécanisme, la permission requise est désormais résolue **dynamiquement selon `to`** dans `parcels.service.ts` (`TRANSITION_PERMISSIONS`, `ARRIVE → parcel:arrival:confirm`, `LIVRE → parcel:deliver:confirm`, les autres transitions restent couvertes par `parcel:transition`) — le décorateur statique `@RequirePermissions('parcel:transition')` a été retiré du contrôleur, NestJS ne pouvant pas inspecter le corps de la requête au niveau du garde de route. Le contrôle de périmètre par `destinationAgencyId = scopeAgencyId` (§4.1) est appliqué de la même façon dans le service. L'encaissement au moment de `LIVRE` continue de passer par les endpoints `Payment` existants ; le trigger base de données `recompute_parcel_balance()` recalcule automatiquement `amount_paid`/`payment_status` du colis à partir des paiements enregistrés — il n'était donc pas nécessaire de faire porter `{ paymentMethod, amountCollected, ... }` par l'endpoint de transition lui-même.

### 4.3 Cas des villes `PARTNER` (avec plusieurs partenaires possibles)

Quand la livraison finale est assurée par un `DeliveryPartner` externe (pas un agent Okapi), et qu'une ville peut avoir plusieurs partenaires actifs, deux options selon votre choix de contrôle :
- **Option A (recommandée pour démarrer)** : l'agent du hub `HUB` le plus proche choisit le `DeliveryPartner` adapté à la zone du destinataire (§1.4), confirme `HANDED_TO_PARTNER` avec la référence de ce partenaire, puis — une fois la preuve de livraison/paiement reçue du partenaire (photo, reçu, confirmation téléphonique) — exécute lui-même `parcel:deliver:confirm` pour le compte du partenaire.
- **Option B (plus tard)** : créer un rôle `AGENT_PARTENAIRE` à permissions restreintes (`parcel:arrival:confirm` + `parcel:deliver:confirm` uniquement, pas d'accès aux rapports ni à la création de colis), avec un compte utilisateur par partenaire — utile si le volume par partenaire justifie de lui donner un accès direct plutôt que de faire remonter l'information à l'agent du hub.

Dans les deux cas, `Parcel.deliveryPartnerId` trace précisément **lequel** des partenaires actifs de la ville a traité le colis — indispensable pour réconcilier les commissions et comparer la fiabilité entre partenaires d'une même province.

> **Intégration (D16).** Option A retenue pour la v1 — aucun rôle `AGENT_PARTENAIRE` ni compte partenaire créés. La scission des permissions (§4.1-4.2), de toute façon nécessaire pour l'option A, rend l'ajout ultérieur de l'option B possible sans nouvelle migration de permissions : seulement une nouvelle valeur de rôle et une ligne `role_permissions`.

### 4.4 Mise à jour du tableau `role_permissions`

| Rôle | Permissions ajoutées |
|---|---|
| `AGENT_FRET` | `parcel:arrival:confirm`, `parcel:deliver:confirm` *(remplacent l'usage générique de `parcel:transition` pour ces deux étapes spécifiques ; `parcel:transition` reste pour les étapes intermédiaires de transit)* |
| `ADMIN_DAF` | lecture/audit des deux nouvelles permissions (`audit:read` couvre déjà la traçabilité) |
| `SUPER_ADMIN` | tout, y compris correction manuelle post-`DELIVERED` |

> **Intégration.** Table reprise avec un ajustement : `ADMIN_DAF` a reçu directement `parcel:arrival:confirm`/`parcel:deliver:confirm` (pas seulement un accès en lecture/audit), par cohérence avec ses autres permissions opérationnelles existantes et pour lui permettre d'agir en correction ponctuelle sans passer par `SUPER_ADMIN`. `ADMIN_DAF` a aussi reçu `settlement:read`/`settlement:write` (§5). Voir `packages/shared/src/permissions.ts` et `03-modele-de-donnees.md` §5 pour le détail final.

### 4.5 Traçabilité renforcée

Chaque appel à `parcel:arrival:confirm` et `parcel:deliver:confirm` doit écrire dans `AuditLog` : `userId`, `scopeAgencyId`, `parcelId`, ancien statut, nouveau statut, et pour la livraison, le montant encaissé et le moyen de paiement — ces données alimentent directement vos rapports DAF (`GET /api/v1/admin/reports/*`) déjà existants.

---

## 5. Réconciliation des commissions partenaires

### 5.1 Objectif

Permettre au DAF de calculer, sur une période donnée, ce qui est dû à chaque `DeliveryPartner` selon les colis effectivement livrés — sans dépendre d'un pointage manuel colis par colis.

### 5.2 Nouvelle entité `PartnerSettlement`

```
PartnerSettlement
  id                  uuid PK
  deliveryPartnerId   uuid FK -> DeliveryPartner
  periodStart         date
  periodEnd           date
  parcelCount         int             -- nombre de colis livrés sur la période
  totalCollectedAmount decimal        -- montant total encaissé par le partenaire pour Okapi
  commissionAmount    decimal         -- calculé : somme des commissions dues
  currency            text FK -> Currency
  status              enum(DRAFT, VALIDATED, PAID)
  validatedByUserId    uuid? FK -> User
  paidAt              date?
  paymentReference     text?
  createdAt / updatedAt
```

### 5.3 Calcul

Pour chaque colis en statut `DELIVERED` avec un `deliveryPartnerId` renseigné, sur la période choisie :
- `commissionAmount` du colis = `PartnerTariff.pricePerKg × poids` (part revenant au partenaire), ou `DeliveryPartner.commissionPct × montant encaissé` selon le mode de rémunération convenu avec ce partenaire (les deux formules coexistent — un champ `DeliveryPartner.settlementMode` = `PER_KG` ou `PERCENT_COLLECTED` précise laquelle appliquer).
- Le rapprochement agrège ces montants par `deliveryPartnerId` sur la période, produit un `PartnerSettlement` en statut `DRAFT`.

> **Intégration (D20).** `PartnerSettlement` créé quasiment à l'identique (`@@map("partner_settlements")`). Limite documentée non explicite dans le texte source : la devise du règlement (`currencyCode`) est celle du `PartnerTariff` actif du partenaire (ou du dernier colis inclus à défaut) — **pas de conversion multi-devises** dans le calcul de réconciliation en v1. À lever si un partenaire venait à facturer dans plusieurs devises. Les deux formules (`PER_KG` / `PERCENT_COLLECTED`) sont implémentées dans `PartnerSettlementsService.generate()` avec l'arithmétique décimale partagée (`dAdd`/`dMul`), jamais en flottant.

### 5.4 Workflow de validation

```
DRAFT       -- généré automatiquement (job périodique ou déclenché manuellement par le DAF)
  → VALIDATED  -- le DAF vérifie le détail (liste des colis inclus), corrige si litige, valide
  → PAID       -- une fois le virement/paiement effectué au partenaire, référence de paiement enregistrée
```

### 5.5 Endpoints et permissions

```
GET   /api/v1/admin/partner-settlements?deliveryPartnerId=&periodStart=&periodEnd=
POST  /api/v1/admin/partner-settlements/generate   { deliveryPartnerId, periodStart, periodEnd }
GET   /api/v1/admin/partner-settlements/{id}        # détail avec liste des colis inclus
PATCH /api/v1/admin/partner-settlements/{id}        { status: VALIDATED | PAID, paymentReference? }
```

Permission : `report:*` (déjà `ADMIN_DAF`/`SUPER_ADMIN`) pour la génération et la consultation ; validation et passage à `PAID` réservés au même périmètre — un agent `AGENT_FRET` n'a jamais accès à cette entité, la réconciliation étant strictement financière/DAF.

> **Intégration — permissions dédiées plutôt que `report:*`.** Deux nouvelles permissions ont été créées (`settlement:read`, `settlement:write`) plutôt que de réutiliser `report:*`, pour ne pas coupler la réconciliation partenaire au périmètre des rapports (qui pourrait évoluer indépendamment). Les deux sont accordées à `ADMIN_DAF` et `SUPER_ADMIN` ; `AGENT_FRET` n'y a effectivement jamais accès, conformément au texte source. Endpoints exposés dans `apps/api/src/partner-settlements/` sous `/api/v1/admin/partner-settlements`. `PATCH .../{id}` refuse toute modification une fois le statut `PAID` (verrouillage définitif). Il n'existe pas de génération automatique par job périodique en v1 — uniquement le déclenchement manuel `POST .../generate` décrit ici ; l'automatisation par tâche planifiée reste à ajouter si le volume le justifie.

### 5.6 Lien avec les rapports existants

Ce module vient compléter `GET /api/v1/admin/reports/*` déjà prévu dans votre architecture : un rapport agrégé « commissions dues par partenaire » peut être exposé de la même façon que vos rapports de revenus/impayés actuels, avec export CSV/PDF via `POST /api/v1/admin/exports`.

> **Intégration.** Non traité dans cette passe : aucun rapport agrégé dédié « commissions dues par partenaire » n'a été ajouté à `GET /api/v1/admin/reports/*`. `GET /api/v1/admin/partner-settlements` permet déjà de lister/filtrer les règlements par partenaire et par période ; un rapport consolidé (export CSV/PDF) reste à construire si le besoin se confirme.

---

## 6. Résumé des actions à prévoir côté implémentation

1. Étendre le seed `City` aux 26 chefs-lieux de province (tableau §1.3).
2. Créer la table/l'entité `DeliveryPartner` (avec `coverageZone`, `isPreferred`, `settlementMode`) et son couple d'endpoints admin.
3. Créer la table `PartnerTariff` pour la tarification de la dernière étape par partenaire.
4. Remplacer le corridor pays par la table `RouteTariff` (paire de villes, sens explicite).
5. Ajouter `originAgencyId`, `destinationCityId`, `destinationAgencyId`, `deliveryPartnerId`, `transitAgencyId` sur `Parcel`.
6. Scinder la permission `parcel:transition` en `parcel:arrival:confirm` et `parcel:deliver:confirm`, mettre à jour `ROLE_PERMISSIONS` dans `packages/shared/src/permissions.ts`.
7. Créer les deux nouveaux endpoints agent (`/arrival`, `/deliver`) avec contrôle de périmètre par `scopeAgencyId`.
8. Créer l'entité `PartnerSettlement` et ses endpoints de réconciliation (génération, validation, paiement).
9. Vérifier que chaque transition écrit dans `AuditLog`.

### 6.1 État final de ces neuf points après intégration (2026-09-10)

| # | Action | État |
|---|---|---|
| 1 | Seed `City` aux 26 provinces | ✅ Fait — `seed.ts` |
| 2 | `DeliveryPartner` + endpoints admin | ✅ Fait — `delivery-partners.{service,controller,module}.ts` |
| 3 | `PartnerTariff` | ✅ Fait — sous-ressource de `DeliveryPartner` |
| 4 | Table `RouteTariff` | ↔ Non créée — couverte par le modèle `Tariff` existant (D17) |
| 5 | Nouveaux champs `Parcel` | ✅ Fait — migration `20260910150000_network_extension_and_permissions` |
| 6 | Scission `parcel:transition` + `ROLE_PERMISSIONS` | ✅ Fait — `packages/shared/src/permissions.ts` |
| 7 | Endpoints `/arrival`, `/deliver` dédiés | ↔ Non créés — permission résolue dynamiquement sur l'endpoint générique `/transition` existant |
| 8 | `PartnerSettlement` + endpoints | ✅ Fait — `partner-settlements.{service,controller,module}.ts` |
| 9 | Traçabilité `AuditLog` sur chaque transition | ✅ Déjà en place, inchangé par l'addendum |

Hors périmètre de cette passe (voir tâche 10/11 du suivi d'intégration) : l'interface back-office (écrans `/admin/cities`, `/admin/delivery-partners`, `/admin/partner-settlements`) et l'application de la migration/seed sur une base réelle, qui restent à exécuter par le client (voir instructions livrées avec les fichiers).
