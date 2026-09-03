# 07 — Manuel de l'administration (DAF et super-administrateur)

Version 1.0 — 2026-09-03
Public : Direction Administrative et Financière (DAF), super-administrateur, DPO.
Complète le [manuel de l'agent](06-manuel-agent.md) et le
[manuel d'installation](05-manuel-installation-configuration.md).

---

## Sommaire

1. [Rôles et périmètres](#1-roles-et-perimetres)
2. [Connexion et sécurité du compte](#2-connexion-et-securite-du-compte)
3. [Pilotage : tableau de bord et rapports](#3-pilotage--tableau-de-bord-et-rapports)
4. [Suivi financier et contrôle de cohérence](#4-suivi-financier-et-controle-de-coherence)
5. [Gérer les tarifs (prix/kg)](#5-gerer-les-tarifs-prixkg)
6. [Gérer les taux de change](#6-gerer-les-taux-de-change)
7. [Gérer les utilisateurs et les droits](#7-gerer-les-utilisateurs-et-les-droits)
8. [Journal d'audit](#8-journal-daudit)
9. [Configuration (identité visuelle, textes, référentiel, notifications)](#9-configuration)
10. [Facturation et pièces comptables](#10-facturation-et-pieces-comptables)
11. [RGPD : consentements, rétention, droits des personnes](#11-rgpd)
12. [Checklist d'exploitation](#12-checklist-dexploitation)
13. [Aide](#13-aide)

> **Note.** Certains écrans du back-office sont livrés en version MVP ; les fonctions non
> encore dotées d'un écran sont accessibles par l'**API REST** `/api/v1/...`. Chaque
> section indique l'écran ou l'endpoint concerné.

---

## 1. Rôles et périmètres

| Rôle | Ce qu'il peut faire | Périmètre |
|------|---------------------|-----------|
| **Agent fret** (`AGENT_FRET`) | Enregistrer des colis, prendre la photo, encaisser, changer les statuts, imprimer. | **1 agence** obligatoire. |
| **Administration / DAF** (`ADMIN_DAF`) | Tout consulter, rembourser un paiement, gérer les tarifs et les taux, exporter, lire le journal d'audit. **Ne crée pas d'utilisateurs.** | Multi-pays (peut être restreint à certains pays). |
| **Super-administrateur** (`SUPER_ADMIN`) | Tout, dont la gestion des utilisateurs et des droits, la configuration (villes, pays, devises, tarifs, textes, identité visuelle) et les demandes RGPD. | Global. |

Le **périmètre de données** s'applique à toutes les listes et à tous les rapports : un DAF
restreint à `BJ, CG` ne voit que les colis et paiements de ces pays. Les rôles sont
**cumulables** sur un même compte.

---

## 2. Connexion et sécurité du compte

- La **vérification en deux étapes (MFA)** est **obligatoire** pour les rôles DAF et
  super-administrateur.
- Activation : dans votre profil, lancer l'enrôlement — un secret et un QR `otpauth://`
  sont fournis ; scannez-les dans une application d'authentification (Google
  Authenticator, Authy, FreeOTP…) puis validez avec un code à 6 chiffres.
  *(API : `POST /api/v1/auth/mfa/enroll` puis `POST /api/v1/auth/mfa/verify`.)*
- Jetons : la session d'accès dure 15 minutes et se renouvelle automatiquement ; le jeton
  de rafraîchissement dure 30 jours et est **révoqué** à la déconnexion.
- Verrouillage : 5 échecs de mot de passe → blocage 15 minutes.
- **Ne partagez jamais** un compte. Créez un compte nominatif par personne.

---

## 3. Pilotage : tableau de bord et rapports

### Tableau de bord (écran d'accueil)

Indicateurs du périmètre : colis du jour, colis en transit, colis arrivés à retirer,
colis impayés, et la liste des derniers colis.

### Rapports (écran « Rapports »)

Version MVP : **colis impayés / en retard** (statut « Arrivé » ou « En transit » +
paiement « Impayé » ou « Partiel »), avec le solde par colis.

### Roadmap reporting (prochaine brique)

Les fonctions suivantes sont **spécifiées** (livrable 04, écrans W-ADM-01/02) et
s'appuient sur des vues d'agrégat déjà présentes en base
(`mv_revenue_by_currency`, `v_parcel_financials`, `v_unpaid_on_transit`) :

- vue consolidée multi-pays (volumes, CA, taux d'impayés, délai moyen par corridor) ;
- bascule d'affichage **par devise d'origine** ↔ **tout consolidé en devise de
  référence (USD)** ;
- exports **Excel (.xlsx)**, **PDF**, et **CSV comptable** (date, pièce, colis, devise
  d'origine, montant, contre-valeur USD, taux) ;
- filtres pays / ville / agence / statut / devise / mode / période / agent.

En attendant l'écran, ces données sont interrogeables en SQL sur les vues ci-dessus ou
via les endpoints de liste filtrée (`GET /api/v1/parcels?...`).

---

## 4. Suivi financier et contrôle de cohérence

### Statut de paiement et solde

Ils sont **calculés automatiquement** à partir des paiements **confirmés** (les paiements
« en attente » ne comptent pas), dans la devise de facturation du colis. Ni l'agent ni
vous ne les saisissez.

- `Impayé` : aucun paiement confirmé.
- `Partiel` : payé mais solde > 0.
- `Payé` : payé ≥ dû.

### Contrôle de cohérence (objectif : 0 écart)

Une vue compare la valeur affichée et la valeur recalculée :

```sql
SELECT id, tracking_number, amount_paid_stored, amount_paid_calc, payment_status_calc
FROM v_parcel_financials
WHERE amount_paid_stored <> amount_paid_calc;
```

Le résultat doit être **vide**. À défaut, relancer le recalcul (une nouvelle écriture de
paiement le déclenche ; un utilitaire de re-synchronisation peut être ajouté).

### Remboursement d'un paiement

Réservé DAF / super-administrateur. Depuis la fiche du colis, onglet Paiements, sur un
paiement **confirmé**. *(API : `POST /api/v1/payments/:id/refund` avec `{ amount?, reason }` —
motif obligatoire.)* Effets : création d'un paiement lié `REMBOURSE`, recalcul du solde,
génération d'un **avoir** numéroté.

### Devise de facturation

Elle est **figée** dès le premier paiement confirmé et ne peut plus changer.

---

## 5. Gérer les tarifs (prix/kg)

Écran **« Tarifs (prix/kg) »** (permission `tariff:read` / `tariff:write`).

- La liste montre, pour chaque destination et chaque mode, le **prix par kg** en vigueur,
  les frais fixes, le minimum, la période de validité.
- **Créer un tarif** : choisir la destination, le mode, la devise, le prix/kg (et
  éventuellement frais fixes, minimum). L'enregistrement crée une **nouvelle version
  datée** et **clôt automatiquement** la version précédente à la veille de la nouvelle
  date d'effet. Deux tarifs actifs ne peuvent pas se chevaucher (garanti par la base).
- Toute modification est **journalisée** (`CONFIG_CHANGE`).
- La **fourchette d'ajustement agent** (par défaut −15 % / +15 %) est portée par le
  tarif ; au-delà, l'agent doit obtenir une dérogation.

> **Avant la mise en production**, saisir les grilles tarifaires réelles par corridor et
> par mode (les valeurs du jeu de données initial sont des exemples — point O-3).

---

## 6. Gérer les taux de change

Écran **« Taux de change »** (permission `fx:read` / `fx:write`).

- **Devise de référence** : USD (consolidation). Chaque transaction financière conserve
  sa devise d'origine **et** sa contre-valeur en USD, avec le taux figé.
- **Synchronisation automatique** : exchangerate.host, au démarrage puis toutes les
  6 heures. Bouton **« Synchroniser maintenant »**.
- **Saisie manuelle** : indiquez la devise, le taux (« 1 unité = ? USD ») et une note.
  Un taux **manuel récent prévaut** sur la synchro automatique.
- **Historique** : aucun taux passé n'est écrasé ; une modification crée une nouvelle
  ligne datée. *(API : `GET /api/v1/admin/exchange-rates/:base/history`.)*
- **Taux périmés** : un badge signale les taux de plus de `FX_STALE_HOURS` (36 h par
  défaut). Les transactions restent possibles avec le dernier taux connu, mais surveillez
  ces alertes.
- Si un couple de devises n'a **aucun taux**, la création de colis ou de paiement dans
  cette devise est **bloquée** (`FX_RATE_MISSING`) : saisissez un taux manuel.

---

## 7. Gérer les utilisateurs et les droits

Réservé au **super-administrateur** (permission `user:manage`). Écran **« Utilisateurs »**.

### Créer un compte

Renseigner nom, e-mail, mot de passe provisoire (≥ 10 caractères). Demander à la personne
de le changer et d'activer le MFA à la première connexion.

### Activer / désactiver

Bouton dans la liste. Un compte désactivé ne peut plus se connecter ; ses sessions
restent à révoquer si besoin.

### Attribuer un rôle et un périmètre

*(API : `POST /api/v1/admin/users/:id/roles` avec `{ roleCode, scopeCountryId?, scopeAgencyId? }`.)*

| Rôle | Contrainte de périmètre |
|------|------------------------|
| `AGENT_FRET` | `scopeAgencyId` **obligatoire**. |
| `ADMIN_DAF` | `scopeCountryId` facultatif (aucune valeur = tous les pays). |
| `SUPER_ADMIN` | aucun périmètre (global). |

Retirer un rôle : `DELETE /api/v1/admin/users/:id/roles/:userRoleId`.

### Réinitialiser le MFA

Si une personne perd son second facteur : `POST /api/v1/admin/users/:id/reset-mfa`. Elle
devra refaire l'enrôlement.

### Bonnes pratiques

- Un compte nominatif par personne, jamais de compte partagé.
- Le moins de super-administrateurs possible.
- Revoir les accès à chaque départ ou changement de poste.
- Prévoir une procédure de **secours** (break-glass) scellée pour le compte
  super-administrateur.

---

## 8. Journal d'audit

Toutes les actions sensibles sont journalisées de façon **immuable** (append-only) :
connexions et échecs, création/modification de colis, paiements, remboursements,
changements de tarifs, de taux, de droits, de configuration, accès RGPD.

- Chaque entrée conserve : acteur, action, entité, **avant/après** (données personnelles
  expurgées), adresse IP, identifiant de requête, horodatage.
- Consultation / export : *(API : `GET /api/v1/admin/audit-logs`)*, réservé DAF /
  super-administrateur.
- Conservation ≥ 5 ans.

Utilisez-le pour : tracer une modification de tarif contestée, comprendre un écart de
solde, contrôler qui a livré un colis impayé avec dérogation.

---

## 9. Configuration

Toutes ces modifications se font **sans redéploiement** et sont **journalisées**.

### 9.1 Identité visuelle et pied de page — écran « Identité visuelle »

Couleurs de marque (`brand.navy` `#170655`, `brand.orange` `#E47911`,
`brand.turquoise`, `brand.anthracite`), e-mail de contact, slogans **fr / en / zh**.
Prises en compte immédiatement par la page publique. Un jeu de valeurs par défaut est
fourni et restaurable.

### 9.2 Textes du site public

*(API : `PUT /api/v1/admin/content/:key` avec `{ fr, en, zh }`.)* Blocs : titre et
sous-titre d'accueil, slogan, et à compléter : mentions légales, politique de
confidentialité, bannière cookies, contact DPO, FAQ — **par pays et par langue**.

### 9.3 Référentiel : devises, villes, pays, corridors

*(API : `POST /api/v1/admin/currencies` ; endpoints de lecture `GET /api/v1/reference/...`.)*

- **Devise** : ajouter une ligne (code ISO 4217, symbole, décimales) + l'activer. Aucune
  devise n'est codée en dur. Une seule devise de référence.
- **Ville** : code IATA à 3 lettres, pays, fuseau, indicateurs origine/destination.
- **Corridor** : pays d'origine → pays de destination.

> L'ouverture d'un nouveau pays (France, Chine, Nigeria) consiste à : activer la devise,
> créer les villes, créer les corridors, saisir les tarifs, traduire les textes,
> configurer les fournisseurs de notification — **sans développement** (voir le
> [plan de déploiement multi-pays](08-plan-deploiement-multipays.md)).

### 9.4 Modèles de notification

45 modèles (5 déclencheurs × 3 canaux × 3 langues). Variables : `{{numero_suivi}}`,
`{{statut}}`, `{{ville_destination}}`, `{{ville_actuelle}}`, `{{lien_suivi}}`,
`{{solde}}`, `{{devise}}`. Respecter les contraintes des fournisseurs (Meta exige des
*templates* approuvés pour WhatsApp).

### 9.5 Paramètres globaux

*(API : `GET /api/v1/admin/settings` · `PUT /api/v1/admin/settings/:key`.)* Exemples :
`fx.reference_currency`, `fx.stale_hours`, `tracking.sequence_scope`,
`dunning.schedule_days`, `pricing.override_max_pct`, `contact.email`.

---

## 10. Facturation et pièces comptables

| Pièce | Généré | Numérotation |
|-------|--------|--------------|
| Reçu d'enregistrement | à l'enregistrement du colis | `ISO2-AAAA-000000`, **continue par pays** |
| Reçu de paiement | à chaque paiement confirmé | idem |
| Facture | à la clôture (colis « Payé ») | idem |
| Avoir | à un remboursement | idem |

- Les pièces (`invoices`) sont **immuables**. Une erreur se corrige par un **avoir**,
  jamais par modification.
- Numérotation **sans trou ni doublon**, par pays et par type.
- TVA : **0 % par défaut** (D13) ; le taux est paramétrable par pays (champ prévu sur les
  pièces).
- Les PDF sont archivés sur le stockage objet et téléchargeables depuis la fiche du colis
  (onglet Documents) par URL signée à durée limitée.
- **Export comptable** (CSV) : brique de reporting à venir — en attendant, les données
  sont dans les tables `payments` et `invoices` (devise d'origine, contre-valeur USD,
  taux, référence).

---

## 11. RGPD

Référent : le **DPO** (généralement porté par le super-administrateur).

### Base et consentement

- Finalités : exécution du transport, notifications, preuve en cas de litige, obligations
  comptables.
- Le **consentement** du client est recueilli et **horodaté** à l'enregistrement (table
  `consents`, avec la version des mentions présentées).

### Rétention

Table `retention_policies` (paramétrable) :

| Catégorie | Durée par défaut | Action |
|-----------|------------------|--------|
| Dossier colis (contacts, évènements, photos) | **60 mois** après livraison (D15) | anonymisation |
| Pièces comptables | 120 mois (à ajuster par pays) | conservation puis suppression |
| Journal d'audit | 60 mois | suppression |
| Notifications | 13 mois | suppression (destinataire haché à 3 mois) |

Une tâche planifiée applique ces règles.

### Droit d'accès

*(API : `POST /api/v1/admin/gdpr/access-requests`.)* Agrège les données d'une personne
(colis, contacts, notifications, consentements) identifiée par téléphone/e-mail normalisé,
et produit un export.

### Droit à l'effacement

*(API : `POST /api/v1/admin/gdpr/erasure-requests`.)* **Anonymise** les dossiers : les
champs identifiants des contacts passent à `REDACTED`, les coordonnées sont supprimées,
les photos sont retirées du stockage (la ligne et l'empreinte SHA-256 sont conservées).
Les **montants, devises et pièces comptables sont conservés** sous forme non identifiante
(obligation légale) ; un refus partiel est motivé. L'opération est tracée
(`data_erasure_requests` + `audit_logs`).

### Résidence des données

Le périmètre France / UE est hébergé en **région UE** (OVHcloud). Les sous-traitants
(stockage, e-mail, WhatsApp, taux de change) font l'objet d'un DPA ; la liste est tenue à
jour et exposée dans les mentions légales configurables.

### Violation de données

Procédure de notification à l'autorité compétente sous 72 h (à formaliser avec le DPO).

---

## 12. Checklist d'exploitation

### Quotidien

- [ ] Écran **Rapports** : traiter les **colis impayés arrivés** (relances déjà
      envoyées automatiquement ; relancer manuellement si besoin).
- [ ] **Taux de change** : vérifier l'absence de badge « périmé » ; sinon synchroniser
      ou saisir un taux manuel.
- [ ] Vérifier que la **synchro FX** du matin a bien eu lieu (source `API`, âge faible).
- [ ] Parcourir le **journal d'audit** pour les actions inhabituelles (remboursements,
      dérogations impayé, changements de tarif).

### Hebdomadaire

- [ ] Contrôle de cohérence financière (`v_parcel_financials`) : résultat vide attendu.
- [ ] Revue des **paiements « en attente »** anciens (Mobile Money/carte non confirmés).
- [ ] Revue des **comptes utilisateurs** (nouveaux, inactifs, MFA non activé pour DAF).

### Mensuel

- [ ] Rapprochement comptable (export des `payments` / `invoices` du mois).
- [ ] Vérifier la numérotation continue des pièces par pays (aucun trou).
- [ ] Contrôler les **grilles tarifaires** en vigueur.
- [ ] Vérifier le bon déroulement des **sauvegardes** (voir manuel d'installation).

### Trimestriel

- [ ] Test de **restauration** de la base.
- [ ] Revue des accès et des droits (départs, changements de poste).
- [ ] Revue des politiques de **rétention** et des demandes RGPD traitées.

---

## 13. Aide

- Questions fonctionnelles : ce manuel + [`04-wireframes.md`](04-wireframes.md).
- Questions techniques (installation, déploiement, fournisseurs) :
  [`05-manuel-installation-configuration.md`](05-manuel-installation-configuration.md).
- Ouverture d'un nouveau pays :
  [`08-plan-deploiement-multipays.md`](08-plan-deploiement-multipays.md).
- Contact général : `contact.gokapi@gmail.com`.

---

*Fin du document 07.*
