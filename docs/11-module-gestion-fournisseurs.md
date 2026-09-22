# 11 — Module « Gestion des fournisseurs » : expéditions groupées, facturation consolidée, portail dédié

> **État : implémenté** (`Supplier`, `Shipment`, `SupplierInvoice`, portail fournisseur). Document de conception d'origine, en réponse à la demande du 2026-09-18 — conservé tel quel comme référence du schéma et de la logique de clôture/facturation. Complémentaire à `03-modele-de-donnees.md` (référentiel existant) et `09-addendum-extension-reseau-permissions.md` (dont il reprend le style de modélisation). Voir aussi §9 : le **groupage**, une brique distincte ajoutée le 2026-09-22 pour le suivi de transit (walk-in et/ou fournisseur), sans lien avec la facturation décrite ici.

---

## 1. Concept et vocabulaire

Un **fournisseur** (`Supplier`) est un partenaire commercial externe (grossiste, boutique en ligne, revendeur...) qui confie à Okapi Logistics plusieurs colis destinés chacun à **un client final différent**, regroupés en une **expédition** (`Shipment`). À la clôture de l'expédition, Okapi émet **une seule facture** au fournisseur, listant tous les clients/colis de cette expédition avec un total général — le fournisseur répercute ensuite ce coût à ses propres clients selon son propre modèle commercial, ce qui ne regarde pas Okapi.

Point important de conception : **le fournisseur n'est pas le `DeliveryPartner`** déjà présent dans le schéma (`09-addendum...`, §1.4). Les deux concepts sont symétriques mais opposés :

| | `DeliveryPartner` (existant) | `Supplier` (nouveau) |
|---|---|---|
| Rôle | Livre les colis **à l'arrivée**, dernier kilomètre | Dépose des colis **au départ**, en amont |
| Relation à Okapi | Sous-traitant rémunéré par Okapi (`PartnerSettlement`) | Client d'Okapi, facturé par Okapi (`SupplierInvoice`) |
| Granularité | Un partenaire par ville | Un fournisseur, multi-villes, multi-clients |

Le **client final** de chaque colis n'a pas besoin d'une nouvelle table : il est déjà modélisé par `ParcelContact` (rôle `RECIPIENT`) sur le `Parcel` correspondant — nom, téléphone, ville, adresse. On réutilise l'existant plutôt que de dupliquer.

### Identifiant anti-fraude

Chaque fournisseur reçoit, à sa création, un **code attribué par l'entreprise** (pas choisi par le fournisseur), utilisé comme identifiant de référence sur toutes ses expéditions et factures — objectif explicite de traçabilité/anti-fraude. Format proposé : `FRN-` + 6 caractères alphanumériques générés aléatoirement côté serveur (ex. `FRN-7K2M9X`), jamais dérivé du nom (pas de collision prévisible, pas d'énumération triviale). Le même principe (code système, non modifiable par l'acteur externe) s'applique à un compte **Okapi Pay** le jour où ce moyen de paiement est intégré — voir §6.4.

---

## 2. Modèle de données

### 2.1 `Supplier` (fournisseurs)

```
Supplier
  id                uuid PK
  code              text unique       -- FRN-XXXXXX, généré serveur, anti-fraude (§1)
  name              text              -- raison sociale
  contactName       text?
  contactPhone      text?
  contactEmail      text?
  address           text?
  countryId         uuid FK -> Country
  defaultAgencyId   uuid FK -> Agency  -- agence de rattachement (dépôt habituel)
  billingCurrency   char(3) FK -> Currency
  userId            uuid? FK -> User unique  -- compte de connexion au portail (§5), nul tant que non activé
  isActive          boolean default true
  createdAt / updatedAt
```

### 2.2 `Shipment` (expéditions)

```
Shipment
  id               uuid PK
  code             text unique        -- EXP-AAMM-NNNN, séquentiel par fournisseur/mois (§3)
  supplierId       uuid FK -> Supplier
  originAgencyId   uuid FK -> Agency  -- agence de dépôt
  status           ShipmentStatus     -- OUVERTE | CLOTUREE | ANNULEE
  parcelCount      int default 0      -- dénormalisé, recalculé à la clôture (source de vérité = COUNT(parcels))
  totalWeightKg    decimal(10,2) default 0
  currency         char(3)
  totalAmountDue           decimal(18,4) default 0
  referenceCurrency        char(3)
  totalAmountDueReference  decimal(18,4) default 0
  openedById       uuid FK -> User    -- ou le user lié au fournisseur, selon qui ouvre
  closedById       uuid? FK -> User
  openedAt         timestamptz default now()
  closedAt         timestamptz?
  createdAt / updatedAt

  @@index([supplierId, status, openedAt])
```

```
enum ShipmentStatus {
  OUVERTE     -- accepte l'ajout de colis
  CLOTUREE    -- verrouillée, facture générée, immuable
  ANNULEE     -- clôturée sans facture (cas d'erreur — voir §4.3)
}
```

### 2.3 `Parcel` — extension (pas de nouvelle table)

Deux colonnes nullables ajoutées au modèle `Parcel` existant :

```
Parcel
  ...            -- colonnes existantes inchangées
  supplierId     uuid? FK -> Supplier
  shipmentId     uuid? FK -> Shipment
```

Contrainte applicative (vérifiée dans le service, pas seulement en base) : `shipmentId` non nul ⟹ `supplierId` non nul et cohérent avec `Shipment.supplierId`. Un colis d'un client walk-in classique (agence physique) garde les deux colonnes à `null`, comme aujourd'hui — **aucune migration de données historiques nécessaire**.

Le **client final** de chaque colis reste `ParcelContact` (rôle `RECIPIENT`) — nom, téléphone, ville, adresse — exactement comme pour un colis walk-in. Rien de neuf à apprendre pour les agents.

### 2.4 `SupplierInvoice` (supplier_invoices)

```
SupplierInvoice
  id                    uuid PK
  shipmentId            uuid FK -> Shipment unique   -- 1 expédition = 1 facture, jamais plus
  supplierId            uuid FK -> Supplier
  number                text unique          -- FACT-FRN-XXXXXX-AAMM-NNNN (§3)
  currency              char(3)
  amountGross           decimal(18,4)        -- somme des lignes, recalculée à la clôture (source de vérité)
  referenceCurrency     char(3)
  amountReference       decimal(18,4)
  fxRate                decimal(18,8)
  issuedAt              timestamptz default now()
  issuedById            uuid? FK -> User
  legalMentionsSnapshot json                 -- mêmes mentions légales figées qu'Invoice existant
  createdAt             timestamptz default now()

  @@index([supplierId, issuedAt])
```

### 2.5 `SupplierInvoiceLine` (supplier_invoice_lines) — une ligne par client final

```
SupplierInvoiceLine
  id                  uuid PK
  supplierInvoiceId   uuid FK -> SupplierInvoice
  parcelId            uuid FK -> Parcel unique   -- un colis ne peut apparaître que sur une seule facture
  trackingNumber      text            -- snapshot, même si le colis est modifié après
  recipientName       text            -- snapshot de ParcelContact au moment de la clôture
  recipientPhone      text?
  destinationCityLabel text
  weightKg            decimal(10,2)
  amount              decimal(18,4)
  currency            char(3)
  amountReference     decimal(18,4)
  createdAt           timestamptz default now()
```

> **Pourquoi un instantané (`snapshot`) du nom/téléphone du client ?** Une facture, une fois émise, ne doit plus changer même si le contact est corrigé ou anonymisé plus tard (politique de rétention RGPD déjà en place sur `ParcelContact.anonymized`, `03-modele-de-donnees.md`). C'est le même principe que `legalMentionsSnapshot` sur `Invoice` : la facture reste l'exacte photographie de ce qui a été facturé, indépendamment de l'évolution ultérieure des données source.

### 2.6 Numérotation — réutilisation de `Sequence`

Aucune nouvelle table de compteur : le modèle générique `Sequence` (`scopeType`, `scopeKey`, `period`, `lastValue`) déjà utilisé pour les numéros de suivi colis (`SequenceService.next('tracking', cityCode, 'AAMM')`) et les numéros de pièces comptables (`SequenceService.next('invoice', 'country:CD', 'ALL')`) est réutilisé tel quel avec deux nouveaux `scopeType` :

| Usage | `scopeType` | `scopeKey` | `period` |
|---|---|---|---|
| Code expédition | `shipment` | `supplier:{code fournisseur}` | `AAMM` |
| Numéro de facture fournisseur | `supplier_invoice` | `supplier:{code fournisseur}` | `AAMM` |

Aucune modification du service `SequenceService` ni de la table `sequences` — la conception générique existante couvre déjà ce besoin (principe EF-EVOL-01 : étendre par la donnée, pas par le code).

---

## 3. Convention de numérotation

Conformément à la convention déjà en place pour les colis (`OKP` + `AAMM` + `NNNN` + code ville, implémentée dans `packages/shared/src/tracking.ts`), les nouveaux identifiants suivent le même style :

| Objet | Format | Exemple | Remarque |
|---|---|---|---|
| Colis (inchangé) | `OKP` + `AAMM` + `NNNN` + ville | `OKP26070042FIH` | Séquence globale par ville de destination — **inchangée**, un colis d'une expédition fournisseur suit exactement la même règle qu'un colis walk-in |
| Expédition | `EXP` + `AAMM` + `NNNN` | `EXP26090007` | Séquence par fournisseur et par mois |
| Facture fournisseur | `FACT-` + code fournisseur + `-AAMM-NNNN` | `FACT-FRN-7K2M9X-2609-0003` | Séquence par fournisseur et par mois |

---

## 4. Logique de clôture et de génération de facture

### 4.1 Pré-conditions

- L'expédition appartient bien au fournisseur authentifié (isolation, §5).
- `Shipment.status === 'OUVERTE'`.
- Au moins un colis rattaché (`parcelCount >= 1`) — pas de facture vide.
- Aucun colis de l'expédition n'est `ANNULE` sans avoir été retiré au préalable (un colis annulé doit être explicitement exclu de l'expédition avant clôture, pas facturé silencieusement).

### 4.2 Algorithme (dans une transaction Prisma, même pattern que `ParcelsService.create` — `$transaction`)

```
1. Verrouiller la ligne Shipment (SELECT ... FOR UPDATE via transaction Prisma)
   et revérifier les pré-conditions (évite une double clôture concurrente).

2. Charger tous les Parcel de l'expédition (WHERE shipmentId = :id),
   avec leur ParcelContact (RECIPIENT) et leur ville de destination.
   → C'est la SOURCE DE VÉRITÉ pour les totaux, jamais les compteurs
     dénormalisés sur Shipment (qui ne sont qu'un cache d'affichage).

3. Pour chaque colis :
     - convertir amountDue vers la devise de facturation du fournisseur
       (réutilise crossConvert / toReference de packages/shared/src/fx.ts,
       déjà utilisé pour les colis individuels)
     - créer une SupplierInvoiceLine (snapshot recipientName/phone/ville)

4. Calculer amountGross = somme des lignes (devise fournisseur)
   et amountReference = somme des montants convertis en devise de référence (USD).

5. Générer le numéro de facture : sequences.next('supplier_invoice',
   `supplier:${supplier.code}`, periodKey(now)).

6. Créer SupplierInvoice (amountGross, amountReference, fxRate, lignes liées).

7. Passer Shipment.status = 'CLOTUREE', closedAt = now(), closedById = user.id,
   et recalculer parcelCount/totalWeightKg/totalAmountDue pour cohérence d'affichage.

8. Générer le PDF (réutilise pdf-lib comme billing.service.ts — nouveau
   template "facture fournisseur multi-lignes", même charte de couleurs
   personnalisable — voir Branding, déjà en place) et le stocker via
   StorageService (même mécanisme que les factures/reçus existants).

9. Notifier le fournisseur (email — réutilise NotificationsService,
   trigger à ajouter : SHIPMENT_INVOICED).
```

### 4.3 Cas d'erreur — annulation d'expédition

Si un fournisseur doit annuler une expédition avant clôture (erreur de saisie), `Shipment.status = 'ANNULEE'` — les colis qu'elle contenait doivent être explicitement détachés (`shipmentId = null`) ou annulés individuellement au préalable ; aucune facture n'est générée pour une expédition annulée.

---

## 5. Isolation des données par fournisseur

Le système de permissions existant (`Role` / `Permission` / `UserRole`, `packages/shared/src/permissions.ts`) scope déjà chaque rôle interne par `scopeCountryId` et/ou `scopeAgencyId` (ex. un DAF limité à son pays). On étend **exactement le même mécanisme** avec une nouvelle dimension, plutôt que de construire un système d'authentification séparé pour les fournisseurs :

```
UserRole
  ...
  scopeCountryId   uuid?   -- existant
  scopeAgencyId    uuid?   -- existant
  scopeSupplierId  uuid?   -- NOUVEAU, FK -> Supplier
```

```
ROLE_CODES = ['AGENT_FRET', 'ADMIN_DAF', 'SUPER_ADMIN', 'FOURNISSEUR']  -- +1
```

Un utilisateur avec le rôle `FOURNISSEUR` est toujours créé avec `scopeSupplierId` renseigné (jamais `null` pour ce rôle — contrainte applicative dans le service de création de compte). Un nouveau guard, symétrique à `parcelScopeWhere(user)` / `paymentScopeWhere(user)` déjà en place (`reports.service.ts`), filtre chaque requête :

```ts
function supplierScopeWhere(user: CurrentUser): Prisma.ShipmentWhereInput {
  if (user.roleCode !== 'FOURNISSEUR') return {}; // staff interne : pas de restriction ici
  return { supplierId: user.scopeSupplierId };
}
```

Appliqué systématiquement sur `Shipment`, `Parcel` (quand `shipmentId` non nul) et `SupplierInvoice` dans le module `supplier-portal`, ce qui garantit qu'un fournisseur ne peut **jamais** lire ou modifier les expéditions/factures d'un autre — même en devinant un UUID, la clause `WHERE` l'exclut au niveau requête, pas seulement au niveau contrôleur.

Nouvelles permissions (`packages/shared/src/permissions.ts`), accordées uniquement au rôle `FOURNISSEUR` :

```
'shipment:create'
'shipment:read'
'shipment:close'
'supplier-parcel:create'   -- ajouter un colis à SA PROPRE expédition ouverte
'supplier-invoice:read'
```

---

## 6. Endpoints API proposés

### 6.1 Back-office (gestion interne des fournisseurs — `ADMIN_DAF` / `SUPER_ADMIN`)

| Méthode | Route | Description |
|---|---|---|
| `POST` | `/admin/suppliers` | Créer un fournisseur (génère `code` FRN-XXXXXX) |
| `GET` | `/admin/suppliers` | Lister, filtrable par pays/agence |
| `GET` | `/admin/suppliers/:id` | Détail |
| `PATCH` | `/admin/suppliers/:id` | Modifier coordonnées, devise, statut actif |
| `POST` | `/admin/suppliers/:id/activate-portal` | Crée le `User` lié (rôle `FOURNISSEUR`), envoie l'identifiant de connexion par email |
| `GET` | `/admin/suppliers/:id/shipments` | Vue interne de toutes les expéditions du fournisseur (aucune restriction de scope ici — vue staff) |

### 6.2 Portail fournisseur (self-service — rôle `FOURNISSEUR`, isolation §5)

| Méthode | Route | Permission | Description |
|---|---|---|---|
| `POST` | `/supplier-portal/shipments` | `shipment:create` | Ouvrir une nouvelle expédition (statut `OUVERTE`) |
| `GET` | `/supplier-portal/shipments` | `shipment:read` | Lister mes expéditions (filtrable par statut) |
| `GET` | `/supplier-portal/shipments/:id` | `shipment:read` | Détail + liste des colis |
| `POST` | `/supplier-portal/shipments/:id/parcels` | `supplier-parcel:create` | Ajouter un colis (destinataire, ville, poids, montant) — réutilise `ParcelsService.create` en interne avec `supplierId`/`shipmentId` renseignés |
| `DELETE` | `/supplier-portal/shipments/:id/parcels/:parcelId` | `supplier-parcel:create` | Retirer un colis avant clôture (erreur de saisie) |
| `POST` | `/supplier-portal/shipments/:id/close` | `shipment:close` | Clôturer + générer la facture (§4.2) |
| `GET` | `/supplier-portal/invoices` | `supplier-invoice:read` | Lister mes factures |
| `GET` | `/supplier-portal/invoices/:id` | `supplier-invoice:read` | Détail (lignes) |
| `GET` | `/supplier-portal/invoices/:id/pdf` | `supplier-invoice:read` | Télécharger le PDF (URL pré-signée, même mécanisme que `DocumentFile` existant) |

### 6.3 Suivi client final (aucun changement)

Un client final destinataire d'un colis d'expédition fournisseur suit son colis exactement comme aujourd'hui via `/public/tracking/:code` (numéro `OKP...` inchangé) — il n'a jamais besoin de savoir qu'il fait partie d'une expédition groupée.

### 6.4 Okapi Pay — même principe d'identifiant

Non détaillé ici (hors périmètre de ce module), mais la demande initiale mentionne qu'Okapi Pay doit suivre le même principe d'ID attribué par l'entreprise. Recommandation : réutiliser le même mécanisme de code anti-fraude que `Supplier.code` (préfixe dédié, ex. `PAY-XXXXXX`) le jour de l'intégration, plutôt qu'un système séparé — cohérence + réutilisation du composant de génération déjà écrit pour `Supplier`.

---

## 7. Maquette React — portail fournisseur

Composant illustratif (à affiner en maquette Figma/wireframe si besoin — voir `04-wireframes.md` pour le style visuel du reste de l'app), dans le style déjà utilisé en back-office (`react-query`, wrapper `api<T>()`, composants `Pill`/`Modal`/`Loading` de `components/ui.tsx`) :

```tsx
// apps/back-office/src/pages/SupplierPortal.tsx  (maquette — non branchée)
import { useState } from 'react';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { api } from '../lib/api';
import { Loading, ErrorText, Pill, Modal } from '../components/ui';

interface Shipment {
  id: string;
  code: string;               // EXP-2609-0007
  status: 'OUVERTE' | 'CLOTUREE' | 'ANNULEE';
  parcelCount: number;
  totalWeightKg: string;
  totalAmountDue: string;
  currency: string;
  openedAt: string;
}

interface SupplierInvoice {
  id: string;
  number: string;              // FACT-FRN-7K2M9X-2609-0003
  amountGross: string;
  currency: string;
  issuedAt: string;
}

function statusKind(s: Shipment['status']) {
  return s === 'CLOTUREE' ? 'ok' : s === 'ANNULEE' ? 'danger' : 'info';
}

export function SupplierPortal() {
  const qc = useQueryClient();
  const [tab, setTab] = useState<'shipments' | 'invoices'>('shipments');
  const [detailId, setDetailId] = useState<string | null>(null);

  const shipments = useQuery({
    queryKey: ['supplier-shipments'],
    queryFn: () => api<Shipment[]>('/supplier-portal/shipments'),
    enabled: tab === 'shipments',
  });

  const invoices = useQuery({
    queryKey: ['supplier-invoices'],
    queryFn: () => api<SupplierInvoice[]>('/supplier-portal/invoices'),
    enabled: tab === 'invoices',
  });

  const openShipment = useMutation({
    mutationFn: () => api('/supplier-portal/shipments', { method: 'POST' }),
    onSuccess: () => qc.invalidateQueries({ queryKey: ['supplier-shipments'] }),
  });

  const closeShipment = useMutation({
    mutationFn: (id: string) => api(`/supplier-portal/shipments/${id}/close`, { method: 'POST' }),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['supplier-shipments'] });
      qc.invalidateQueries({ queryKey: ['supplier-invoices'] });
    },
  });

  return (
    <div>
      <div className="tabs">
        <button className={tab === 'shipments' ? 'active' : ''} onClick={() => setTab('shipments')}>
          Mes expéditions
        </button>
        <button className={tab === 'invoices' ? 'active' : ''} onClick={() => setTab('invoices')}>
          Mes factures
        </button>
        {tab === 'shipments' && (
          <button className="primary" onClick={() => openShipment.mutate()}>
            + Nouvelle expédition
          </button>
        )}
      </div>

      {tab === 'shipments' && (
        <>
          {shipments.isLoading && <Loading />}
          {shipments.error && <ErrorText error={shipments.error} />}
          <table>
            <thead>
              <tr>
                <th>Code</th><th>Statut</th><th>Colis</th><th>Poids</th><th>Montant</th><th />
              </tr>
            </thead>
            <tbody>
              {shipments.data?.map((s) => (
                <tr key={s.id}>
                  <td>
                    <button className="link" onClick={() => setDetailId(s.id)}>{s.code}</button>
                  </td>
                  <td><Pill kind={statusKind(s.status)}>{s.status}</Pill></td>
                  <td>{s.parcelCount}</td>
                  <td>{s.totalWeightKg} kg</td>
                  <td>{s.totalAmountDue} {s.currency}</td>
                  <td>
                    {s.status === 'OUVERTE' && (
                      <button onClick={() => closeShipment.mutate(s.id)}>
                        Clôturer et facturer
                      </button>
                    )}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </>
      )}

      {tab === 'invoices' && (
        <>
          {invoices.isLoading && <Loading />}
          <table>
            <thead>
              <tr><th>N° facture</th><th>Montant</th><th>Émise le</th><th /></tr>
            </thead>
            <tbody>
              {invoices.data?.map((f) => (
                <tr key={f.id}>
                  <td>{f.number}</td>
                  <td>{f.amountGross} {f.currency}</td>
                  <td>{new Date(f.issuedAt).toLocaleDateString('fr-FR')}</td>
                  <td>
                    <a href={`/api/v1/supplier-portal/invoices/${f.id}/pdf`} target="_blank" rel="noreferrer">
                      PDF
                    </a>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </>
      )}

      {detailId && <Modal onClose={() => setDetailId(null)} title="Détail de l'expédition">
        {/* liste des colis de l'expédition, ajout de colis, retrait avant clôture */}
      </Modal>}
    </div>
  );
}
```

---

## 8. Ce qui n'est PAS couvert par cette proposition (à trancher ensuite)

- **Paiement du fournisseur** : cette proposition couvre l'émission de la facture, pas son règlement. À rattacher au module `Payment` existant (le fournisseur paie sa facture comme un client classique) ou à un flux dédié si le crédit/délai de paiement diffère — question ouverte, dépend du modèle commercial voulu avec les fournisseurs.
- **Tarification spécifique fournisseur** (remise volume, tarif négocié) : le calcul actuel réutilise le moteur de tarification standard (`Tariff`, `pricing.ts`) tel quel. Un tarif préférentiel par fournisseur serait une extension ultérieure (nouvelle table `SupplierTariff`, même logique que `PartnerTariff`).
- **Auto-inscription** des fournisseurs (actuellement : création uniquement par un agent interne via `/admin/suppliers`, puis activation du portail). Un formulaire public de demande d'inscription serait une itération suivante si le volume le justifie.

---

## 9. Groupage — suivi de transit indépendant de la facturation

> **État : implémenté** (`Groupage`, 2026-09-22).

Besoin distinct de l'expédition fournisseur (§1-8) : regrouper des colis **quelle que soit leur
origine** (walk-in enregistré en agence, et/ou fournisseur) sous un même **numéro de groupage**,
pour savoir précisément, colis par colis, lesquels sont effectivement partis lors d'un transit
donné — cas concret : 100 colis groupés, mais seuls 80 embarqués sur le vol/véhicule au moment de
l'expédition, les 20 autres repartant sur le groupage suivant.

Différence-clé avec `Shipment` : **aucune facturation** n'est rattachée à un groupage. Chaque colis
(walk-in ou fournisseur) est déjà facturé/soldé individuellement à son enregistrement
(`Parcel.amountDue`) — le groupage n'est qu'un regroupement logistique, formé parfois plusieurs
jours après le dépôt des colis.

```
Groupage
  id               uuid PK
  code             text unique       -- GRP-AAMM-NNNN, séquentiel global mensuel
  originAgencyId   uuid FK -> Agency
  status           GroupageStatus     -- OUVERT | CLOTURE | ANNULE
  parcelCount      int default 0      -- dénormalisé, recalculé à la clôture
  totalWeightKg    decimal(10,2) default 0
  note             text?
  openedById / closedById
  openedAt / closedAt
  createdAt / updatedAt
```

`Parcel.groupageId` (nullable, indépendant de `supplierId`/`shipmentId`) : un colis peut appartenir
à un `Shipment` (facturation fournisseur) **et** à un `Groupage` (suivi de transit) en même temps,
à l'un des deux, ou à aucun.

Endpoints (`groupage:manage` — agent fret, DAF, super-admin ; **pas** le rôle FOURNISSEUR) :

| Méthode | Route | Effet |
|---|---|---|
| `GET` | `/groupages` | Liste, filtrable par `status`, restreinte au périmètre agence de l'utilisateur. |
| `GET` | `/groupages/:id` | Détail + colis membres avec leur statut individuel (`ENREGISTRE`…`LIVRE`). |
| `POST` | `/groupages` | Ouvre un groupage (agence de départ, note libre). |
| `POST` | `/groupages/:id/parcels` | Ajoute un colis par numéro de suivi (rejette un colis annulé ou déjà dans un autre groupage). |
| `DELETE` | `/groupages/:id/parcels/:parcelId` | Retire un colis (uniquement tant que `OUVERT`). |
| `POST` | `/groupages/:id/close` | Clôture (`CLOTURE`), fige `parcelCount`. |

« Combien sont arrivés » se lit directement depuis le statut de chaque colis membre
(`ARRIVE`/`HANDED_TO_PARTNER`/`LIVRE` = arrivé) — aucune donnée dupliquée, la source de vérité
reste le statut du colis, déjà mis à jour par les écrans existants (transition de statut).

---

*Fin du document 11.*
