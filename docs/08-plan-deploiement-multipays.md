# 08 — Plan de déploiement multi-pays (France, Chine, Nigeria)

Version 1.0 — 2026-09-03
Public : Direction, DAF, chef de projet, équipe technique, partenaires locaux.
Décisions applicables : [`00-registre-decisions.md`](00-registre-decisions.md).

---

## Sommaire

1. [Principe directeur](#1-principe-directeur)
2. [Checklist générique d'ouverture d'un pays](#2-checklist-generique-douverture-dun-pays)
3. [Hébergement et résidence des données](#3-hebergement-et-residence-des-donnees)
4. [Multi-devises : activation GBP / CNY / NGN](#4-multi-devises--activation-gbp--cny--ngn)
5. [Notifications par pays](#5-notifications-par-pays)
6. [Facturation et fiscalité par pays](#6-facturation-et-fiscalite-par-pays)
7. [France](#7-france)
8. [Chine](#8-chine)
9. [Nigeria](#9-nigeria)
10. [Séquencement et plan projet type](#10-sequencement-et-plan-projet-type)
11. [Risques et mesures](#11-risques-et-mesures)
12. [Critères de mise en service (« go / no-go »)](#12-criteres-de-mise-en-service)

---

## 1. Principe directeur

**Une seule base de code, déployée en une ou plusieurs instances régionales ; chaque pays
est un jeu de configuration.** L'ouverture d'un pays **ne nécessite aucun développement**
(exigence EF-EVOL-01) : elle consiste à activer une devise, créer des villes et des
corridors, saisir des tarifs, traduire des textes, brancher les fournisseurs de
notification et paramétrer la fiscalité et les mentions légales locales.

Trois éléments seulement peuvent demander un travail spécifique :

| Élément | France | Chine | Nigeria |
|---------|:------:|:-----:|:-------:|
| **Hébergement / résidence des données** | région UE dédiée (RGPD) | instance locale (réglementation) | rattachement instance Afrique |
| **Connecteur de notification** | RAS (SES + WhatsApp) | **WeChat** en plus de SMS/e-mail | **SMS local** à finaliser (point O-1) |
| **Connecteur de paiement** (v2) | carte / SEPA | Alipay / WeChat Pay | Mobile Money local |

---

## 2. Checklist générique d'ouverture d'un pays

À exécuter par le super-administrateur (configuration) et l'équipe technique
(infrastructure). Détail des écrans / endpoints : [`07-manuel-administration.md`](07-manuel-administration.md).

### Configuration fonctionnelle

- [ ] **Devise** : activer la devise du pays (`currencies` → `is_active = true`).
- [ ] **Taux de change** : saisir un taux manuel devise → USD, puis vérifier la synchro
      exchangerate.host.
- [ ] **Pays** : créer / activer l'entrée `countries` (ISO2, devise par défaut, langue par
      défaut, préfixe téléphonique, **politique de livraison impayée**, taux de TVA,
      région de résidence des données).
- [ ] **Villes** : créer les villes desservies avec leur **code IATA** (3 lettres),
      fuseau horaire, indicateurs origine/destination.
- [ ] **Corridors** : créer les corridors depuis / vers le nouveau pays.
- [ ] **Tarifs** : saisir le **prix par kg par destination et par mode** (grilles réelles).
- [ ] **Agences** : créer les agences (code, ville, devise de facturation, coordonnées).
- [ ] **Textes du site public** : traduire tous les blocs dans la langue du pays +
      **mentions légales**, politique de confidentialité, bannière cookies, contact DPO.
- [ ] **Modèles de notification** : vérifier / adapter les 15 modèles de la langue
      (5 déclencheurs × 3 canaux), faire approuver les *templates* WhatsApp si applicable.
- [ ] **Fiscalité** : renseigner le taux de TVA / taxe et le format de numérotation des
      pièces (préfixe pays, remise à zéro annuelle ou non selon la règle locale).

### Infrastructure

- [ ] Décider **hébergement** : instance régionale dédiée ou rattachement (voir §3).
- [ ] Provisionner (si instance dédiée) : PostgreSQL managé, Redis, Object Storage,
      exécution conteneurs, load balancer + TLS, coffre de secrets, observabilité — en
      **région conforme**.
- [ ] Configurer les **fournisseurs** : stockage objet, e-mail (SES), WhatsApp (Meta),
      SMS local, + connecteur spécifique (WeChat pour la Chine).
- [ ] DNS : sous-domaine de suivi public + back-office ; certificats TLS.
- [ ] Sauvegardes (PITR ≥ 7 j, complète quotidienne 30 j), test de restauration.
- [ ] Journaux et métriques rattachés à l'observabilité centrale.

### Conformité et juridique

- [ ] **DPA** signés avec tous les sous-traitants intervenant sur le périmètre.
- [ ] Registre des traitements mis à jour (finalités, durées, transferts).
- [ ] Mentions d'information client validées par le conseil juridique local.
- [ ] Conditions générales de transport localisées.
- [ ] Régime fiscal des pièces validé par le cabinet comptable local.

### Comptes et formation

- [ ] Créer le(s) compte(s) DAF pays et les comptes agents (rôle + périmètre agence).
- [ ] MFA activé pour les rôles DAF / super-admin.
- [ ] Formation des agents (manuel 06) et de l'administration locale (manuel 07).

### Recette

- [ ] Parcours agent complet : enregistrement + photo + impression + encaissement
      (total, partiel, devise différente) + changements de statut + livraison.
- [ ] Parcours client : suivi public dans la langue du pays, notifications reçues.
- [ ] Rapports et export du périmètre pays.
- [ ] Contrôle de cohérence financière (résultat vide attendu).

---

## 3. Hébergement et résidence des données

| Zone | Recommandation | Justification |
|------|----------------|---------------|
| **Afrique** (corridors actuels + Nigeria au lancement) | Instance en région proche (latence agences). Nigeria **rattaché** à cette instance, isolable ensuite. | Simplicité opérationnelle, volumes modérés. |
| **France / UE** | **Instance régionale dédiée en région UE** (OVHcloud `gra` / `sbg`). Base, stockage objet, sauvegardes et *workers* en UE. | **RGPD** : résidence des données du périmètre France, transferts hors UE minimisés et encadrés (CCT). ADR-007, décision D12. |
| **Chine** | **Instance dédiée hébergée en Chine** via un partenaire local disposant d'une **licence ICP**. | Réglementation chinoise sur l'hébergement et la circulation des données ; accès réseau (le trafic sortant de Chine est contraint). |

**Consolidation siège.** Un ETL périodique remonte des **agrégats anonymisés** (pas de
données personnelles), convertis en **devise de référence (USD)**, vers un entrepôt de
données central. Les rapports détaillés restent servis par chaque instance selon le
périmètre.

**Démarrage simplifié possible.** Instance unique OVHcloud en région UE avec cloisonnement
logique par pays, puis régionalisation (instance dédiée) à l'ouverture effective de la
Chine, puis consolidation par zone.

---

## 4. Multi-devises : activation GBP / CNY / NGN

Les devises **GBP, CNY, NGN** existent déjà en base, **inactives**. Ouverture d'un pays :

1. Passer la devise à `is_active = true` (écran de configuration).
2. Saisir un **taux manuel** devise → USD, puis vérifier que la synchro automatique
   (exchangerate.host) reprend le relais (source `API`).
3. Vérifier les **décimales** de la devise (0 ou 2) — impacte l'arrondi et l'affichage.
4. Définir la **devise de facturation** des agences du pays (généralement la devise
   locale ; USD reste possible, notamment en RDC).

La consolidation reste en **USD**. Chaque transaction conserve devise d'origine +
contre-valeur USD + taux figé (EF-DEV-05).

> **GBP** : la liste native cible aussi une ouverture au Royaume-Uni ; activation par la
> même procédure.

---

## 5. Notifications par pays

| Canal | France | Chine | Nigeria |
|-------|:------:|:-----:|:-------:|
| **E-mail** (Amazon SES) | ✅ domaine + DKIM/SPF/DMARC à vérifier ; sortie du bac à sable SES | ✅ (délivrabilité entrante en Chine à surveiller) | ✅ |
| **WhatsApp** (Meta Business API) | ✅ *templates* approuvés | ❌ **indisponible en Chine** | ✅ |
| **SMS** | via agrégateur (option) | ✅ opérateurs locaux via agrégateur ou partenaire | ✅ **prioritaire** (canal principal) — connecteur à finaliser (O-1) |
| **WeChat** | — | ✅ **à ajouter** : compte officiel WeChat + connecteur (`NotificationProvider`) via un partenaire disposant des accès API | — |

- Le canal préféré est choisi **par colis** à l'enregistrement (canal + langue du client).
- Chaque envoi est **journalisé** (statut, fournisseur, référence, erreur) ; ré-essai
  automatique et bascule vers un canal de repli configurable.
- Respecter les fenêtres horaires polies (fuseau du destinataire) et les désinscriptions.

---

## 6. Facturation et fiscalité par pays

| Sujet | France | Chine | Nigeria |
|-------|--------|-------|---------|
| **TVA / taxe** | TVA applicable au transport à **paramétrer** (`countries.tax_rate`) ; le champ TVA figure déjà sur les pièces. À valider avec le cabinet FR. | Fapiao et régime local à cadrer avec le partenaire ; taux à paramétrer. | VAT nigériane à paramétrer ; règles de facturation locales à valider. |
| **Numérotation des pièces** | `FR-AAAA-000000`, continue, sans trou (déjà en place). Vérifier l'exigence de remise à zéro annuelle. | `CN-AAAA-000000` + éventuelles mentions Fapiao. | `NG-AAAA-000000`. |
| **Mentions obligatoires** | identité de l'émetteur, coordonnées, devise, taux appliqué le cas échéant, TVA. À faire valider juridiquement. | selon droit local. | selon droit local. |
| **Export comptable** | CSV par périmètre : date, pièce, colis, devise d'origine, montant, contre-valeur USD, taux (brique reporting à finaliser). | idem | idem |
| **Conservation** | pièces comptables ≥ 10 ans (paramétrable par pays). | selon droit local. | selon droit local. |

---

## 7. France

### Contexte

- Devise : **EUR**. Langue : **fr** (déjà en place).
- Politique de livraison impayée : **stricte** — pas de livraison tant que le solde n'est
  pas réglé (déjà configurée dans le jeu de données : `FR = strict`).
- Ville de référence : **Paris**, code IATA **`PAR`** (déjà présente).
- Fuseau : `Europe/Paris`.

### Spécificités à traiter

| Domaine | Action |
|---------|--------|
| **RGPD (bloquant)** | Hébergement **région UE** (OVHcloud). Registre des traitements. Consentement horodaté (déjà en place). Procédures **droit d'accès** et **droit à l'effacement** outillées (déjà en place — anonymisation des dossiers, conservation des données comptables non identifiantes). DPA avec tous les sous-traitants (OVHcloud, SES, Meta, exchangerate.host, agrégateur SMS). Procédure de notification de violation sous 72 h. Mentions d'information et politique de confidentialité rédigées et validées. |
| **Fiscalité** | Paramétrer la TVA transport (taux FR), valider le format et les mentions des factures avec le cabinet comptable, confirmer la règle de numérotation (continuité, millésime). |
| **Notifications** | SES : vérifier le domaine, sortir du bac à sable. WhatsApp : faire approuver les *templates* fr. SMS : optionnel. |
| **Juridique** | Conditions générales de transport FR ; mentions légales de l'éditeur du site public ; conformité accessibilité (WCAG 2.1 AA — déjà visée par la page publique). |
| **Paiements** | v1 : saisie manuelle (espèces, virement, carte via TPE, référence). v2 : intégration carte / virement SEPA. |
| **Infrastructure** | Instance régionale UE dédiée : PostgreSQL managé + réplica + PITR, Redis, Object Storage UE, conteneurs, LB + TLS, WAF/CDN devant le site public, coffre de secrets, observabilité. |

### Jalons France

1. Décision d'hébergement + provisioning région UE.
2. Signature des DPA + registre des traitements.
3. Paramétrage TVA + validation des pièces par le cabinet.
4. Rédaction/validation juridique (CGT, mentions, confidentialité).
5. Configuration : villes FR supplémentaires si besoin, corridors FR↔corridors existants,
   tarifs, agences, textes.
6. Recette complète + test de restauration + test d'intrusion externe.
7. Go-live.

---

## 8. Chine

### Contexte

- Devise : **CNY**. Langue : **zh** (déjà prise en charge, interface et notifications).
- Politique de livraison impayée : **stricte** (`CN = strict`).
- Villes de référence : **Shanghai** `SHA`, **Guangzhou** `CAN` (déjà présentes).
- Fuseau : `Asia/Shanghai`.
- Encodage UTF-8 de bout en bout : noms et adresses en caractères chinois **déjà gérés**.

### Spécificités à traiter

| Domaine | Action |
|---------|--------|
| **Hébergement (bloquant)** | Instance **hébergée en Chine** via un partenaire disposant d'une **licence ICP**. Prévoir la latence et les restrictions de trafic transfrontalier ; l'ETL d'agrégats vers le siège doit être conçu en conséquence (agrégats anonymisés uniquement). |
| **Notifications** | **WhatsApp indisponible.** Canaux : **SMS** (opérateurs locaux via agrégateur/partenaire) + **e-mail** + **WeChat** (compte officiel + connecteur `NotificationProvider` à ajouter via un partenaire). Adapter les 15 modèles zh. |
| **Paiements** | v1 : saisie manuelle. v2 : **Alipay** et **WeChat Pay** (intégration via prestataire agréé). |
| **Réglementation** | Conformité à la réglementation locale sur les données personnelles (PIPL) et l'hébergement ; conservation et transferts encadrés ; conseil juridique local. |
| **Fiscalité** | Régime de facturation (Fapiao) et TVA à cadrer avec le partenaire et le comptable local ; paramétrer `countries.tax_rate` et le format de numérotation `CN-…`. |
| **Site public** | Vérifier l'accessibilité réseau et les performances depuis la Chine ; envisager un hébergement statique local pour la page de suivi. |
| **Support** | Adresse de contact et horaires locaux ; documentation zh. |

### Jalons Chine

1. Sélection du **partenaire local** (hébergement ICP + WeChat + SMS + paiements).
2. Cadrage juridique et fiscal (PIPL, Fapiao).
3. Provisioning de l'instance Chine + connecteurs.
4. Développement du **connecteur WeChat** (seul développement spécifique).
5. Configuration : villes CN, corridors, tarifs, agences, textes zh, modèles zh.
6. Recette (parcours agent + client + notifications SMS/WeChat/e-mail).
7. Go-live.

---

## 9. Nigeria

### Contexte

- Devise : **NGN**. Langue : **en**.
- Politique de livraison impayée : **dérogation** (`NG = derogation`).
- Ville de référence : **Lagos** `LOS` (déjà présente).
- Fuseau : `Africa/Lagos`.
- **Rattachement** initial : instance **Afrique** (isolable ensuite).

### Spécificités à traiter

| Domaine | Action |
|---------|--------|
| **Devise NGN volatile** | Prévoir des **saisies de taux manuelles fréquentes** (le taux manuel récent prévaut). Surveiller le badge « taux périmé ». Envisager un raccourcissement de `FX_STALE_HOURS` pour le périmètre NG. |
| **Notifications** | **SMS = canal principal** : finaliser le connecteur SMS (agrégateur couvrant le Nigeria ou accord opérateur — point O-1). WhatsApp et e-mail en complément. |
| **Paiements** | v1 : saisie manuelle (espèces, virement, carte, Mobile Money local avec référence). v2 : intégration Mobile Money / passerelles locales. |
| **Réglementation FX** | Contrôles de change locaux : vérifier les règles d'affichage et de conversion ; conserver la devise d'origine et la contre-valeur USD (déjà le cas). |
| **Fiscalité** | Paramétrer la VAT nigériane, valider le format des pièces `NG-…` avec un comptable local. |
| **Juridique** | Conditions de transport, mentions du site, protection des données (NDPR) — conseil local. |
| **Infrastructure** | Rattachement à l'instance Afrique ; créer le périmètre pays, les agences, les comptes. Séparation possible plus tard si volumes le justifient. |

### Jalons Nigeria

1. Choix du connecteur **SMS** couvrant le Nigeria.
2. Cadrage juridique et fiscal (NDPR, VAT).
3. Configuration : villes NG, corridors, tarifs, agences, textes en, modèles en.
4. Mise en place d'une routine de **saisie/validation des taux NGN**.
5. Recette (parcours agent + client + notifications SMS).
6. Go-live.

---

## 10. Séquencement et plan projet type

### Ordre recommandé

1. **France** — priorité : cadre RGPD à établir de toute façon, hébergement UE structurant,
   fournisseurs (SES, WhatsApp) déjà maîtrisés, aucun développement spécifique.
2. **Nigeria** — rattachement à une instance existante, principal chantier = connecteur
   SMS + routine de taux NGN.
3. **Chine** — le plus long : partenaire local, hébergement ICP, connecteur WeChat,
   cadrage PIPL/Fapiao.

### Phases (identiques pour chaque pays)

| Phase | Contenu | Durée indicative* |
|-------|---------|-------------------|
| P0 — Cadrage | Juridique, fiscal, hébergement, sélection des partenaires/fournisseurs, DPA. | 3–6 semaines |
| P1 — Infrastructure | Provisioning (ou rattachement), connecteurs, DNS/TLS, sauvegardes, observabilité. | 2–4 semaines |
| P2 — Configuration | Devise, taux, pays, villes, corridors, tarifs, agences, textes, modèles, fiscalité. | 1–2 semaines |
| P3 — Développement spécifique | **Chine uniquement** : connecteur WeChat. **Nigeria** : connecteur SMS (mutualisable). | 2–4 semaines |
| P4 — Comptes & formation | Comptes DAF/agents, MFA, formation (manuels 06/07). | 1 semaine |
| P5 — Recette | Parcours agent + client + notifications + rapports + restauration ; test d'intrusion (France). | 1–2 semaines |
| P6 — Go-live & hypercare | Bascule, surveillance renforcée 2 semaines. | 2 semaines |

\* À affiner selon la disponibilité des partenaires et des validations juridiques.

### Responsabilités

| Rôle | Responsabilité principale |
|------|---------------------------|
| Direction | Décisions d'ouverture, choix des partenaires, budget. |
| DAF pays | Tarifs, taux, fiscalité, recette financière, formation administration. |
| Super-administrateur | Configuration de la plateforme, comptes, textes, modèles. |
| Équipe technique | Infrastructure, connecteurs, CI/CD, sauvegardes, observabilité. |
| DPO | RGPD/PIPL/NDPR, registre, DPA, mentions, procédures droits des personnes. |
| Conseil juridique / comptable local | Validation des CGT, mentions, régime fiscal, format des pièces. |
| Partenaire local (Chine) | Hébergement ICP, WeChat, SMS, paiements locaux. |

---

## 11. Risques et mesures

| Risque | Impact | Mesure |
|--------|--------|--------|
| Retard de validation **juridique/fiscale** (FR, CN, NG) | Décalage du go-live | Lancer P0 très en amont ; ne pas dépendre du technique pour démarrer le cadrage. |
| **Hébergement Chine** : sélection et conformité du partenaire ICP | Bloquant pour la Chine | Traiter la Chine en dernier ; sécuriser le partenaire dès P0. |
| **WhatsApp indisponible en Chine** | Notifications dégradées | WeChat + SMS + e-mail prévus ; connecteur WeChat en P3. |
| **Connecteur SMS** non finalisé (O-1) | Nigeria (canal principal) et relances | Choisir l'agrégateur en P0 ; interface `NotificationProvider` déjà prête. |
| **Volatilité NGN** | Écarts de conversion, marges | Taux manuels fréquents + seuil « périmé » abaissé ; alertes DAF. |
| **Grilles tarifaires réelles** non fournies (O-3) | Prix erronés | Bloquer le go-live tant que les tarifs de tous les corridors du pays ne sont pas saisis et validés. |
| **Transferts de données hors UE** (siège) | Non-conformité RGPD | ETL d'agrégats **anonymisés** uniquement ; CCT avec les sous-traitants ; registre à jour. |
| Dérive vers du **code spécifique par pays** | Perte de l'atout « config seule » | Toute demande spécifique passe par une revue d'architecture ; privilégier un nouveau paramètre plutôt qu'une branche de code. |
| Charge à l'ouverture | Lenteurs | Test de charge (k6) sur les cibles ENF-PERF ; montée en charge progressive ; hypercare 2 semaines. |

---

## 12. Critères de mise en service

Le **go-live** d'un pays est prononcé quand **tous** les critères suivants sont réunis :

### Conformité

- [ ] Registre des traitements à jour ; DPA signés avec **tous** les sous-traitants du périmètre.
- [ ] Mentions d'information, politique de confidentialité, CGT localisées et validées.
- [ ] Procédures **droit d'accès** et **droit à l'effacement** testées sur un cas réel.
- [ ] Résidence des données conforme (UE pour la France ; locale pour la Chine).

### Fonctionnel

- [ ] Devise activée ; **taux devise → USD disponible** et non périmé.
- [ ] **Tous les tarifs** (prix/kg) des corridors du pays saisis et validés par le DAF.
- [ ] Villes, corridors, agences créés ; comptes agents et DAF opérationnels avec MFA.
- [ ] Textes du site public et **15 modèles de notification** validés dans la langue du pays
      (*templates* WhatsApp approuvés le cas échéant).
- [ ] TVA et format de numérotation des pièces paramétrés et validés par le comptable local.

### Technique

- [ ] Instance (ou rattachement) en région conforme ; `GET /api/v1/health` = `ok`.
- [ ] Sauvegardes actives ; **test de restauration réussi**.
- [ ] Connecteurs de notification opérationnels (envoi de bout en bout vérifié).
- [ ] Observabilité branchée (logs, métriques, alertes).
- [ ] Test d'intrusion externe réalisé (obligatoire pour la France).

### Recette

- [ ] Parcours agent complet exécuté en conditions réelles (enregistrement + photo +
      impression + encaissement total/partiel/devise différente + statuts + livraison).
- [ ] Parcours client vérifié : suivi public dans la langue du pays, QR de l'étiquette,
      notifications reçues sur le canal choisi.
- [ ] Rapports et export du périmètre pays produits ; contrôle de cohérence financière
      (résultat vide).
- [ ] Formation des agents et de l'administration locale effectuée (manuels 06 et 07).

---

*Fin du document 08. Ce plan clôt les livrables attendus (spécifications, architecture,
modèle de données, wireframes, application fonctionnelle, manuels, plan de déploiement).*
