# 01 — Spécifications techniques détaillées

Version 1.0 — 2026-09-03
Projet : plateforme Okapi Logistics
Public : équipe de développement, direction, DAF, prestataires d'intégration.

---

## Table des matières

1. [Contexte et objectifs](#1-contexte-et-objectifs)
2. [Périmètre](#2-perimetre)
3. [Acteurs, rôles et droits](#3-acteurs-roles-et-droits)
4. [Exigences fonctionnelles](#4-exigences-fonctionnelles)
5. [Exigences non fonctionnelles](#5-exigences-non-fonctionnelles)
6. [Règles de gestion transverses](#6-regles-de-gestion-transverses)
7. [Contraintes et conformité](#7-contraintes-et-conformite)
8. [Hypothèses et questions ouvertes](#8-hypotheses-et-questions-ouvertes)

---

## 1. Contexte et objectifs

Okapi Logistics opère du fret aérien et maritime sur les corridors **Bénin – RDC**,
**Congo-Brazzaville**, **Afrique du Sud**, **Rwanda**, **Burundi** et **Tanzanie**, et
prépare son ouverture en **France**, en **Chine** et au **Nigeria**.

Les processus actuels sont manuels (registres papier, tableurs). Ils ne permettent ni le
suivi client en temps réel, ni la consolidation financière multi-agences, ni la gestion
fiable des paiements partiels et des devises multiples.

### Objectifs

| Objectif | Indicateur de réussite |
|----------|------------------------|
| Enregistrer un colis en agence en < 2 minutes, photo comprise | Temps médian d'enregistrement mesuré |
| Suivi client en libre-service, sans compte | Taux de tickets « où est mon colis ? » en baisse |
| Statut de paiement fiable et automatique (total / partiel / impayé) | 0 écart entre encaissements et soldes affichés |
| Consolidation financière multi-devises au siège | Rapport CA par devise disponible en < 5 s |
| Plateforme prête pour la France, la Chine et le Nigeria sans refonte | Ajout d'un pays / devise / langue par configuration seule |

### Principes directeurs

- **International par conception** : multi-devises, multi-langues, multi-fuseaux dès la v1.
- **La photo est une preuve** : immuable, horodatée, liée définitivement au dossier.
- **L'argent est traçable** : chaque paiement conserve sa devise d'origine et son
  équivalent en devise de référence, avec le taux figé au moment de la transaction.
- **Configuration sans développeur** : villes, devises, tarifs, textes, contacts modifiables
  par la Direction depuis l'interface.
- **Auditabilité** : toute action sensible est journalisée (qui, quoi, quand, avant/après).

---

## 2. Périmètre

### 2.1 Pays et corridors

| Phase | Pays | Devise principale | Langue(s) agence |
|-------|------|-------------------|------------------|
| Actuelle | Bénin (BJ) | XOF (FCFA) | fr |
| Actuelle | RD Congo (CD) | CDF, USD | fr |
| Actuelle | Congo-Brazzaville (CG) | XAF *(voir note)* | fr |
| Actuelle | Afrique du Sud (ZA) | ZAR *(voir note)* | en |
| Actuelle | Rwanda (RW) | RWF *(voir note)* | en / fr |
| Actuelle | Burundi (BI) | BIF *(voir note)* | fr |
| Actuelle | Tanzanie (TZ) | TZS *(voir note)* | en |
| Future | France (FR) | EUR | fr |
| Future | Chine (CN) | CNY | zh |
| Future | Nigeria (NG) | NGN | en |

> **Note devises** — Le cahier des charges impose la prise en charge **native immédiate** de
> **XOF, CDF, USD, EUR** et l'ajout **simple et futur** de **GBP, CNY, NGN**. Les devises
> XAF, ZAR, RWF, BIF, TZS des autres pays actuels sont traitées par le **même mécanisme
> générique** que GBP/CNY/NGN : ajout par configuration, sans développement. Le modèle de
> données ne câble aucune devise en dur.

### 2.2 Modes de transport

Aérien, maritime. Le mode conditionne la grille tarifaire et les délais indicatifs.

### 2.3 Hors périmètre v1 (backlog)

- Application mobile native agents (l'API REST est toutefois conçue pour la supporter).
- Paiement en ligne par le client final sur la page publique (encaissement = agence en v1).
- Rapprochement bancaire automatisé / connexion comptable (export comptable fourni).
- Gestion d'entrepôt, scan d'inventaire, optimisation de tournées.
- Impression ZPL directe sur imprimantes Zebra (PDF étiquette fourni en v1).
- Déclarations douanières électroniques.

---

## 3. Acteurs, rôles et droits

### 3.1 Rôles

| Rôle | Rattachement | Description |
|------|--------------|-------------|
| **Agent fret / Assistant fret** | 1 agence | Enregistre les colis, prend la photo, saisit les paiements, imprime les étiquettes/reçus, met à jour les statuts de son agence. |
| **Administration / DAF** | Siège (multi-pays) | Supervise toutes les agences, consulte les rapports financiers consolidés, gère les tarifs et les taux de change, exporte les rapports. Ne peut pas créer d'utilisateurs. |
| **Super-administrateur** | Global | Gère les utilisateurs et les droits, la configuration technique (villes, pays, devises, tarifs, textes, identité visuelle, coordonnées, réseaux sociaux). |
| **Client final** | Aucun (public) | Consulte le statut d'un colis via son numéro de suivi, sans compte. |

> Les rôles sont **cumulables** sur un même compte si nécessaire (ex. un chef d'agence
> agent + admin restreint), via un système de rôles multiples. Le périmètre d'un compte est
> toujours borné par `agency_id` / `country_id`.

### 3.2 Matrice des droits (extrait)

| Action | Agent | DAF | Super-admin | Public |
|--------|:-----:|:---:|:-----------:|:------:|
| Créer / éditer un colis | ✅ (son agence) | ➖ lecture | ✅ | ❌ |
| Prendre / remplacer la photo colis | ✅ (avant expédition) | ❌ | ✅ | ❌ |
| Saisir un paiement | ✅ (son agence) | ➖ lecture | ✅ | ❌ |
| Annuler / rembourser un paiement | ❌ (demande) | ✅ | ✅ | ❌ |
| Changer le statut d'un colis (étapes intermédiaires) | ✅ (son agence) | ✅ | ✅ | ❌ |
| Confirmer l'arrivée à destination | ✅ (agence de destination) | ✅ | ✅ | ❌ |
| Confirmer la livraison / l'encaissement final | ✅ (agence de destination, si `payment:create`) | ✅ | ✅ | ❌ |
| Gérer villes / partenaires de livraison / tarifs partenaires | ❌ | ❌ | ✅ | ❌ |
| Générer / valider un règlement partenaire | ❌ | ✅ | ✅ | ❌ |
| Consulter le suivi d'un colis | ✅ | ✅ | ✅ | ✅ (via n° de suivi) |
| Voir le détail financier d'un colis | ✅ (son agence) | ✅ (tous) | ✅ | ❌ |
| Rapports consolidés multi-pays | ❌ | ✅ | ✅ | ❌ |
| Gérer tarifs / taux de change | ❌ | ✅ | ✅ | ❌ |
| Gérer villes / pays / devises | ❌ | ❌ | ✅ | ❌ |
| Gérer utilisateurs et droits | ❌ | ❌ | ✅ | ❌ |
| Modifier identité visuelle / textes / contacts | ❌ | ➖ (selon délégation) | ✅ | ❌ |
| Exporter le journal d'audit | ❌ | ✅ | ✅ | ❌ |
| Traiter une demande RGPD (accès / effacement) | ❌ | ➖ | ✅ (DPO) | ❌ |

Légende : ✅ autorisé · ➖ partiel / lecture seule · ❌ interdit.

La matrice complète, action par action, est maintenue dans le code sous forme de
**permissions nommées** (`parcel:create`, `payment:refund`, `config:currency:write`…) et
d'une table de correspondance rôle → permissions (voir
[`03-modele-de-donnees.md`](03-modele-de-donnees.md#domaine-identite--securite)).

---

## 4. Exigences fonctionnelles

Chaque exigence porte un identifiant `EF-<module>-<n>` pour la traçabilité avec les tests.

### 4.1 Module Enregistrement du colis

| ID | Exigence |
|----|----------|
| EF-ENR-01 | Le formulaire d'enregistrement rapide saisit : expéditeur (nom, téléphone, e-mail facultatif, adresse), destinataire (idem), ville de départ, ville de destination, mode de transport, poids (kg), nature du contenu, valeur déclarée + devise. |
| EF-ENR-02 | Les villes de départ / destination sont choisies dans le référentiel actif ; une ville inactive n'est pas proposée. |
| EF-ENR-03 | Le poids accepte 2 décimales, valeur > 0. La valeur déclarée est ≥ 0. |
| EF-ENR-04 | La **prise d'une photo du colis est obligatoire** pour valider l'enregistrement (caméra mobile ou webcam). L'enregistrement ne peut pas être finalisé sans au moins une photo. |
| EF-ENR-05 | La photo est stockée sur un stockage objet chiffré, avec empreinte SHA-256, horodatage, agent et agence. Les métadonnées EXIF de géolocalisation sont retirées ; l'horodatage serveur fait foi. |
| EF-ENR-06 | La photo est **liée de façon permanente** au dossier : non supprimable et non remplaçable après le passage du colis au statut `EN_TRANSIT` (sauf action Super-admin tracée, ou demande RGPD). Avant expédition, l'agent peut ajouter/reprendre des photos. |
| EF-ENR-07 | Le **numéro de suivi** est généré automatiquement à la validation, selon la structure : `OKP` + `AAMM` (année 2 chiffres + mois 2 chiffres) + **séquentiel mensuel sur 4 chiffres, remis à zéro chaque mois** + **code IATA-like à 3 lettres de la ville de destination**. Exemple : `OKP26070042FIH`. |
| EF-ENR-08 | Le compteur séquentiel est **atomique** (pas de doublon en concurrence). Portée : **par ville de destination**, **réinitialisé le 1ᵉʳ de chaque mois** (D2). Les 4 chiffres permettent de compter les colis expédiés vers chaque destination sur le mois. Débordement au-delà de 9999/mois pour une destination : extension automatique à 5 chiffres, journalisée. |
| EF-ENR-09 | À la validation, la plateforme calcule le **montant total dû** = `prix_par_kg(destination, mode) × poids` (+ `frais_fixes` et plancher `min` si configurés, 0 par défaut), dans la **devise de facturation** de l'agence. Le **prix par kg de chaque destination** est saisi et modifié dans le back-office par l'administration (D6). L'agent peut ajuster le montant dans une fourchette autorisée (paramétrable) ; toute dérogation est tracée. |
| EF-ENR-10 | À la validation, la plateforme génère et rend imprimables : (a) une **étiquette** au format thermique (100 × 150 mm par défaut) portant le numéro de suivi, un **QR code** et un **code-barres Code 128**, les villes, le poids, la date ; (b) un **reçu d'enregistrement** A5/A4. Les deux sont archivés en PDF dans le dossier. |
| EF-ENR-11 | Un colis a un cycle de vie : `ENREGISTRE` → `EN_TRANSIT` → `ARRIVE` → `LIVRE`, avec branches `ANNULE` et `RETOURNE`. Chaque transition crée un **événement de suivi** horodaté, avec lieu, auteur et commentaire facultatif. |
| EF-ENR-12 | Un colis `ANNULE` conserve son numéro de suivi (jamais réattribué) et son historique. L'annulation exige un motif. |
| EF-ENR-13 | Recherche interne d'un colis par numéro de suivi, téléphone/nom d'une partie, agence, statut, période. |

### 4.2 Module Gestion des paiements

| ID | Exigence |
|----|----------|
| EF-PAY-01 | Le **statut de paiement** d'un colis est **calculé automatiquement** à partir de la somme des paiements confirmés : `PAYE` (payé ≥ dû), `PARTIEL` (0 < payé < dû), `IMPAYE` (payé = 0). Il n'est jamais saisi manuellement. |
| EF-PAY-02 | Le **solde restant** = montant dû − somme des paiements confirmés, exprimé dans la devise de facturation ; affiché partout où le colis apparaît côté interne. |
| EF-PAY-03 | Un paiement enregistre : montant, devise, moyen de paiement, sous-fournisseur Mobile Money le cas échéant, référence externe de transaction, date d'encaissement, agent encaisseur, agence. |
| EF-PAY-04 | Moyens de paiement pris en charge : **Mobile Money** (M-Pesa, Orange Money, Airtel Money), **virement bancaire**, **carte bancaire**, **espèces en agence**. La liste est extensible par configuration. |
| EF-PAY-05 | Un paiement peut être fait dans une **devise différente** de la devise de facturation du colis. La plateforme fige alors le **taux de change** utilisé, le montant converti dans la devise de facturation, et le montant en devise de référence. |
| EF-PAY-06 | **Historique des paiements par colis** : liste chronologique (dates, montants, devise, moyen, référence, agent). Immuable ; une correction se fait par un paiement d'ajustement ou un remboursement, tracés. |
| EF-PAY-07 | À **chaque paiement** (partiel ou total), génération automatique d'un **reçu de paiement** numéroté et archivé en PDF. À la clôture (`PAYE`), génération d'une **facture** récapitulative. |
| EF-PAY-08 | Numérotation des reçus et factures : séquence dédiée, continue, par pays (ou par agence, configurable), conforme aux exigences locales. Jamais de trou ni de doublon. |
| EF-PAY-09 | Le remboursement d'un paiement (total ou partiel) est réservé aux rôles DAF / Super-admin, exige un motif, recalcule le statut et produit un avoir. |
| EF-PAY-10 | **Alerte automatique au client en cas de solde impayé avant livraison** : lorsqu'un colis atteint `ARRIVE` avec un statut `PARTIEL` ou `IMPAYE`, une notification (e-mail / SMS / WhatsApp selon préférence) est envoyée. Relances paramétrables (J+0, J+2…). |
| EF-PAY-11 | Un colis ne peut pas passer à `LIVRE` avec un solde impayé sans une **validation explicite** d'un responsable (motif obligatoire, tracé). Comportement paramétrable par pays (blocage strict ou dérogation autorisée). |
| EF-PAY-12 | Rapprochement : chaque paiement Mobile Money / carte peut porter un statut `EN_ATTENTE` → `CONFIRME` / `ECHOUE`. Seuls les paiements `CONFIRME` comptent dans le solde. |

### 4.3 Module Multi-devises

| ID | Exigence |
|----|----------|
| EF-DEV-01 | Prise en charge native de **XOF, CDF, USD, EUR** ; ajout de **GBP, CNY, NGN** (et toute autre) par simple configuration, sans développement. |
| EF-DEV-02 | Chaque devise porte : code ISO 4217, symbole, nombre de décimales, statut actif, arrondi. Aucune devise n'est codée en dur. |
| EF-DEV-03 | Les **taux de change** sont **synchronisés via exchangerate.host** (planification régulière) ET **saisissables manuellement** à tout moment (un taux manuel plus récent prévaut). La source (`API` / `MANUAL`) et l'horodatage de chaque taux sont conservés. |
| EF-DEV-04 | Les taux sont **historisés** : une modification crée une nouvelle version avec `effective_from`. Une transaction utilise le taux en vigueur à sa date. Aucun taux passé n'est écrasé. |
| EF-DEV-05 | Il existe une **devise de référence** unique (défaut **USD**, paramétrable) pour la consolidation. Toute transaction financière stocke son montant en devise d'origine **et** en devise de référence, plus le taux et l'`exchange_rate_id` utilisés. |
| EF-DEV-06 | L'agence saisit et affiche par défaut dans la **devise de son pays**. Une **conversion indicative** peut être affichée (au client sur demande, à l'agent en permanence). |
| EF-DEV-07 | Les rapports du siège s'expriment au choix : par devise d'origine (ventilation) ou tout consolidé en devise de référence. |
| EF-DEV-08 | Si aucun taux n'est disponible pour un couple de devises à une date donnée, la transaction est bloquée avec un message explicite ; un taux manuel peut être saisi immédiatement par un rôle habilité. |

### 4.4 Module Suivi client (page publique)

| ID | Exigence |
|----|----------|
| EF-SUI-01 | Page web publique, **responsive**, **multilingue fr / en / zh** (langue détectée puis changeable), où le client saisit son **numéro de suivi**. Aucun compte requis. |
| EF-SUI-02 | Affichage : **statut du colis** (`Enregistré`, `En transit`, `Arrivé`, `Livré`, `Annulé`, `Retourné`), **photo du colis**, **statut de paiement synthétique** (`Payé` / `Paiement partiel` / `En attente de paiement`) **sans montants ni détails financiers sensibles**, **historique des étapes** avec dates et lieux. |
| EF-SUI-03 | La photo affichée au client est servie via une **URL signée à durée limitée** générée à la volée ; aucun accès direct non authentifié au stockage. |
| EF-SUI-04 | La page n'expose jamais : nom complet des parties, adresses, téléphone, valeur déclarée, montants, moyens de paiement, références de transaction. Elle peut afficher un prénom + initiale ou un libellé neutre. |
| EF-SUI-05 | Protection anti-abus : limitation de débit par IP, `numéro de suivi` non énumérable en pratique (composante ville + volume), CAPTCHA activable en cas d'abus détecté. |
| EF-SUI-06 | **Notifications automatiques au client à chaque changement de statut** (SMS, WhatsApp, e-mail — canal au choix du client, saisi à l'enregistrement). Contenu localisé dans la langue du client. |
| EF-SUI-07 | Lien profond : `…/suivi/OKP26070042FIH` affiche directement le colis (utile pour les notifications). |
| EF-SUI-08 | Page conforme RGPD : bannière cookies minimale (aucun traceur non essentiel par défaut), mentions légales, contact DPO. |

### 4.5 Module Tableau de bord Administration

| ID | Exigence |
|----|----------|
| EF-ADM-01 | Vue **consolidée multi-agences et multi-pays** : volumes traités, CA, colis en cours, impayés, retards. |
| EF-ADM-02 | **Filtres** : pays, ville, agence, statut colis, statut de paiement, devise, mode de transport, période, agent. |
| EF-ADM-03 | Indicateurs : nombre de colis par statut, CA par devise et consolidé, taux d'impayés, délai moyen par corridor, top destinations, encaissements par moyen de paiement. |
| EF-ADM-04 | **Rapports exportables Excel (.xlsx) et PDF** : volumes traités, chiffre d'affaires par devise, colis impayés / en retard, journal des paiements, journal d'audit. |
| EF-ADM-05 | Export comptable : écritures d'encaissement (date, pièce, colis, devise d'origine, montant, contre-valeur devise de référence, taux) au format CSV/Excel. |
| EF-ADM-06 | **Gestion des utilisateurs et des droits par agence / pays** (rôle Super-admin) : création, désactivation, réinitialisation MFA, attribution de rôles et de périmètres. |
| EF-ADM-07 | Toutes les données affichées respectent le périmètre du compte connecté (un DAF pays ne voit que ses pays si son périmètre est restreint). |

### 4.6 Module Configuration autonome

| ID | Exigence |
|----|----------|
| EF-CFG-01 | Interface permettant à la Direction de modifier **sans intervention technique** : logo, couleurs de marque, textes du site public, coordonnées (e-mail, téléphone), adresses des agences, liens réseaux sociaux, adresse du site web. |
| EF-CFG-02 | Ajout / modification / désactivation de **villes**, **pays**, **devises**, **corridors**, **grilles tarifaires**, **modèles de notification**. |
| EF-CFG-03 | Les textes du site public et les modèles de notification sont éditables **par langue** (fr / en / zh, extensible). |
| EF-CFG-04 | Les modifications de configuration sont **versionnées et tracées** (auteur, date, avant/après). Possibilité de prévisualiser avant publication. |
| EF-CFG-05 | Un jeu de valeurs par défaut (identité visuelle, pied de page, slogan) est fourni et restaurable. |
| EF-CFG-06 | Paramètres sensibles (clés d'API fournisseurs, secrets) : gérés hors interface publique, dans un coffre de secrets, jamais exposés en clair. |

### 4.7 Module Notifications

| ID | Exigence |
|----|----------|
| EF-NOT-01 | Canaux : **SMS**, **WhatsApp Business**, **e-mail**. Chaque colis porte le canal préféré du client et sa langue. |
| EF-NOT-02 | Déclencheurs : changement de statut du colis, réception d'un paiement, solde impayé à l'arrivée, relances programmées, livraison effectuée. |
| EF-NOT-03 | Modèles paramétrables par déclencheur, canal et langue, avec variables (`{{numero_suivi}}`, `{{statut}}`, `{{ville_destination}}`, `{{lien_suivi}}`…). |
| EF-NOT-04 | Journalisation de chaque envoi : destinataire, canal, modèle, statut (`FILE`, `ENVOYE`, `LIVRE`, `ECHEC`), fournisseur, référence externe, erreur éventuelle. |
| EF-NOT-05 | Ré-essai automatique en cas d'échec transitoire ; bascule vers un canal de repli configurable. |
| EF-NOT-06 | Respect des consentements et des désinscriptions ; mentions d'émetteur conformes par pays. |

### 4.8 Module Réseau et partenaires de livraison

Ajouté par l'addendum [`09-addendum-extension-reseau-permissions.md`](09-addendum-extension-reseau-permissions.md) —
couvre les 26 provinces de la RDC au-delà des seules villes en agence propre.

| ID | Exigence |
|----|----------|
| EF-RES-01 | Chaque ville porte un statut `HUB` (agence propre), `PARTNER` (livraison finale via un ou plusieurs partenaires tiers) ou `PLANNED` (pas encore de flux), gérable sans redéploiement depuis `/admin/cities`. |
| EF-RES-02 | Une ville `PARTNER` peut avoir plusieurs partenaires de livraison actifs, chacun avec sa zone de couverture et son tarif propre ; un partenaire `isPreferred` est proposé par défaut, modifiable par l'agent selon la zone exacte du destinataire. |
| EF-RES-03 | Le tarif facturé au client vers une ville `PARTNER` = tarif du trajet principal (grille ville→ville existante) + tarif de la dernière étape du partenaire retenu, affiché au client dès la création du colis. |
| EF-RES-04 | La confirmation d'arrivée (`parcel:arrival:confirm`) et la confirmation de livraison/encaissement (`parcel:deliver:confirm`) sont deux permissions distinctes de la transition générique ; un agent sans `payment:create` peut signaler une arrivée mais pas finaliser une livraison encaissée. |
| EF-RES-05 | Pour une ville `PARTNER`, l'agent du hub le plus proche consigne la remise au partenaire (`HANDED_TO_PARTNER`, avec référence du partenaire) puis, une fois la preuve de livraison/paiement reçue du partenaire, confirme la livraison pour son compte (option retenue pour la v1 — voir `00-registre-decisions.md`, D16). |
| EF-RES-06 | Le DAF/super-admin peut générer, par partenaire et par période, un règlement (`DRAFT`→`VALIDATED`→`PAID`) agrégeant les commissions dues sur les colis livrés, sans pointage manuel colis par colis. |

---

## 5. Exigences non fonctionnelles

### 5.1 Performance et capacité

| ID | Exigence |
|----|----------|
| ENF-PERF-01 | Enregistrement d'un colis (hors upload photo) : réponse serveur < 500 ms au 95e centile. |
| ENF-PERF-02 | Consultation du suivi public : < 1 s au 95e centile, page utilisable sur connexion 3G. |
| ENF-PERF-03 | Génération d'un rapport consolidé standard : < 5 s ; exports volumineux en tâche asynchrone avec lien de téléchargement. |
| ENF-PERF-04 | Dimensionnement cible an 1 : jusqu'à 50 agences, 300 utilisateurs internes, 20 000 colis/mois, 60 000 paiements/mois, pointes ×5. |
| ENF-PERF-05 | Upload photo : accepté jusqu'à 15 Mo, compressé côté client à ~1600 px / ~300 Ko avant envoi ; upload direct au stockage objet (presigned), sans transiter par l'API. |

### 5.2 Disponibilité et résilience

| ID | Exigence |
|----|----------|
| ENF-DISP-01 | Disponibilité cible 99,5 % / mois pour le back-office, 99,9 % pour la page publique de suivi. |
| ENF-DISP-02 | Sauvegardes BDD : PITR (point-in-time recovery) ≥ 7 jours, sauvegarde complète quotidienne conservée 30 jours, test de restauration trimestriel. |
| ENF-DISP-03 | RPO ≤ 15 min, RTO ≤ 4 h. |
| ENF-DISP-04 | Fonctionnement dégradé agence : si l'API est injoignable, l'agent peut continuer à **capturer** colis + photo en file locale (PWA) et **synchroniser** à la reconnexion. Le numéro de suivi définitif est attribué à la synchronisation (numéro provisoire local en attendant). *(Option v1.1 ; v1 = connexion requise.)* |

### 5.3 Sécurité

| ID | Exigence |
|----|----------|
| ENF-SEC-01 | Authentification par e-mail + mot de passe haché **Argon2id** ; politique de complexité ; verrouillage progressif après échecs répétés. |
| ENF-SEC-02 | **MFA TOTP obligatoire** pour les rôles DAF et Super-admin ; recommandé pour les agents. |
| ENF-SEC-03 | Jetons : access JWT courte durée (≤ 15 min), refresh rotatif à usage unique, révocation de session côté serveur. |
| ENF-SEC-04 | Autorisation **RBAC** par permissions nommées + **périmètre** (agence / pays) appliqué à chaque requête et à chaque requête SQL (scoping systématique ; option PostgreSQL RLS). |
| ENF-SEC-05 | Chiffrement en transit (TLS 1.2+ partout) et au repos (BDD, stockage objet, sauvegardes). |
| ENF-SEC-06 | **Journal d'audit** immuable des actions sensibles : connexions, paiements, remboursements, changements de tarifs / taux / droits / configuration, accès aux données personnelles, exports. Conservation ≥ 5 ans, horodatage, IP, avant/après. |
| ENF-SEC-07 | Secrets applicatifs dans un coffre (cloud KMS / Vault) ; aucun secret en clair dans le code ou la BDD ; rotation documentée. |
| ENF-SEC-08 | Stockage des photos : **aucun accès public direct**. Lecture uniquement par URL signée expirant (≤ 15 min interne, ≤ 60 min pour l'affichage client), générée après contrôle d'accès. |
| ENF-SEC-09 | Protection applicative : rate limiting, validation stricte des entrées, protection CSRF sur les sessions navigateur, en-têtes de sécurité (CSP, HSTS…), journalisation des anomalies. |
| ENF-SEC-10 | Tests de sécurité : SAST + audit de dépendances en CI, test d'intrusion avant la mise en production France. |

### 5.4 Internationalisation

| ID | Exigence |
|----|----------|
| ENF-I18N-01 | Interface back-office **et** page publique : **fr + en + zh dès la v1** (D14). Ajout d'une langue supplémentaire par fichiers de traduction + textes configurables, sans redéploiement pour les textes éditoriaux. |
| ENF-I18N-02 | Toutes les dates sont stockées en **UTC** et affichées dans le fuseau de l'agence / du contexte. |
| ENF-I18N-03 | Formats de nombres, de devises et de dates localisés (ICU). Les montants respectent les décimales de leur devise. |
| ENF-I18N-04 | Prise en charge de l'UTF-8 de bout en bout (noms chinois, caractères latins étendus). Encodage `citext` pour les e-mails. |
| ENF-I18N-05 | Contenus juridiques (mentions, RGPD, CGU) par pays et par langue. |

### 5.5 Accessibilité et compatibilité

| ID | Exigence |
|----|----------|
| ENF-A11Y-01 | Page publique conforme **WCAG 2.1 AA** (contrastes, navigation clavier, libellés). |
| ENF-COMPAT-01 | Compatible **mobile, tablette, ordinateur** pour les agents comme pour les clients ; navigateurs : 2 dernières versions majeures de Chrome, Firefox, Safari, Edge. |
| ENF-COMPAT-02 | Back-office utilisable sur tablette en agence ; capture photo via `getUserMedia` (caméra arrière par défaut sur mobile). |

### 5.6 Évolutivité et maintenabilité

| ID | Exigence |
|----|----------|
| ENF-EVOL-01 | Ajout d'un pays / d'une devise / d'une langue / d'un corridor / d'une grille tarifaire **sans déploiement de code**. |
| ENF-EVOL-02 | API **REST versionnée** (`/api/v1`), spécifiée en **OpenAPI 3.1**, pensée pour une future application mobile native des agents. |
| ENF-EVOL-03 | Architecture modulaire (modules métier découplés), migrations de base versionnées, tests automatisés (couverture cible ≥ 70 % back-end, ≥ 60 % front). |
| ENF-EVOL-04 | Documentation vivante : OpenAPI publiée, schéma BDD généré, ADR (décisions d'architecture) tenues à jour. |

### 5.7 Observabilité

| ID | Exigence |
|----|----------|
| ENF-OBS-01 | Logs structurés JSON corrélés par `request_id` ; pas de donnée personnelle en clair dans les logs. |
| ENF-OBS-02 | Métriques techniques et métier (colis/h, paiements/h, taux d'échec notifications, latence API) ; tableaux de bord et alertes. |
| ENF-OBS-03 | Suivi des erreurs (Sentry) avec regroupement et alerte ; traces distribuées (OpenTelemetry). |

---

## 6. Règles de gestion transverses

| ID | Règle |
|----|-------|
| RG-01 | **Numéro de suivi** : `OKP` + `AA` + `MM` + `NNNN` (séquentiel **par ville de destination**, **remis à zéro chaque mois**, base 10, complété à gauche par des zéros ; ≥ 5 chiffres si débordement) + `CCC` (code IATA ville destination). Unicité absolue, jamais réattribué, insensible à la casse en lecture. Ex. `OKP26070042FIH` = 42ᵉ colis à destination de Kinshasa en juillet 2026. |
| RG-02 | **Devise de facturation d'un colis** = devise par défaut de l'agence d'enregistrement, modifiable à l'enregistrement parmi les devises actives. Figée après le premier paiement confirmé. |
| RG-03 | **Statut de paiement** et **solde** sont dérivés, recalculés à chaque évènement de paiement (création, confirmation, remboursement) et matérialisés sur le colis pour le filtrage et l'affichage. |
| RG-04 | **Conversion** : `montant_reference = round(montant_origine × taux(devise_origine → devise_reference, date_transaction), decimales_reference)`. Le taux inverse est déduit ; les taux croisés passent par la devise de référence si le couple direct est absent. |
| RG-05 | **Taux applicable** : dernier taux dont `effective_from ≤ date_transaction`, pour le couple demandé ou via la devise pivot. À défaut : blocage + saisie manuelle possible (rôle habilité). |
| RG-06 | **Photo obligatoire** : ≥ 1 photo `is_primary` pour valider l'enregistrement. Immuable dès `EN_TRANSIT`. |
| RG-07 | **Transitions de statut colis autorisées** : `ENREGISTRE→EN_TRANSIT→ARRIVE→LIVRE` ; `ENREGISTRE→ANNULE` ; `EN_TRANSIT→RETOURNE→ARRIVE` ; `ARRIVE→RETOURNE`. Toute autre transition est refusée. Chaque transition = 1 évènement de suivi. |
| RG-08 | **Livraison avec impayé** : interdite sauf dérogation d'un rôle habilité avec motif ; paramétrable par pays (`strict` / `derogation`). |
| RG-09 | **Numérotation des pièces comptables** (reçus, factures, avoirs) : séquence continue par pays (ou agence), millésimée, sans trou. Générée à la création de la pièce, dans une transaction. |
| RG-10 | **Périmètre de données** : toute lecture/écriture est filtrée par le périmètre (`agency_id` ∈ périmètre, ou `country_id` ∈ périmètre) du compte, sauf rôles globaux. |
| RG-11 | **Horodatage** : toutes les dates en UTC en base ; `created_at` / `updated_at` sur toutes les tables ; suppression logique (`deleted_at`) sauf pièces immuables. |
| RG-12 | **Idempotence** : les créations de colis et de paiements acceptent une clé d'idempotence (`Idempotency-Key`) pour absorber les doubles soumissions (réseau agence instable). |
| RG-13 | **Valeur déclarée** : purement informative (litige / assurance), n'entre pas dans le calcul du prix sauf règle tarifaire ad hoc « ad valorem » activée par configuration. |
| RG-14 | **Consentement client** : à l'enregistrement, l'agent recueille le consentement du client pour l'usage de ses données (suivi, notifications) ; horodaté et conservé. |

---

## 7. Contraintes et conformité

### 7.1 RGPD (obligatoire pour l'ouverture France)

| Exigence | Mise en œuvre |
|----------|---------------|
| Base légale et registre des traitements | Registre tenu par le DPO ; finalités : exécution du contrat de transport, notifications, preuve en cas de litige, obligations comptables. |
| Consentement | Recueilli et horodaté à l'enregistrement (case explicite, non pré-cochée) ; preuve stockée (`consents`). |
| Information des personnes | Mentions d'information remises (reçu + page publique), version et date conservées. |
| Droit d'accès / rectification | Procédure outillée côté Super-admin / DPO : export des données d'une personne (colis, contacts, notifications). |
| Droit à l'effacement | **Anonymisation** du dossier : purge des champs identifiants des `parcel_contacts` et des coordonnées, conservation des données strictement nécessaires aux obligations légales (montants, devise, pièces comptables) sous forme non identifiante. Traçé dans `data_erasure_requests`. |
| Minimisation | La page publique n'expose aucune donnée personnelle directe ; les logs sont expurgés. |
| Durées de conservation | Paramétrables par catégorie : **dossiers colis 5 ans après livraison** (D15), pièces comptables ≥ 10 ans selon droit local, journaux d'audit ≥ 5 ans, notifications 13 mois. Purge / anonymisation automatique planifiée. |
| Résidence des données | Données du périmètre **France / UE hébergées dans l'UE** (voir architecture, § résidence des données). |
| Sous-traitants | DPA signés avec l'hébergeur, le stockage objet, les fournisseurs SMS/WhatsApp/e-mail et de taux de change ; liste tenue à jour. |
| Sécurité | Chiffrement, cloisonnement, audit, tests d'intrusion (cf. § 5.3). |
| Violation de données | Procédure de notification (72 h) documentée. |

### 7.2 Contraintes comptables et locales

- Numérotation des factures/reçus conforme et continue par pays.
- Mentions obligatoires sur les pièces (identité de l'émetteur, coordonnées, devise, taux appliqué le cas échéant).
- Export comptable exploitable par un cabinet local.
- TVA / taxes : champ prévu sur les pièces, taux paramétrable par pays (à préciser pays par pays lors du déploiement).

### 7.3 Contraintes techniques imposées

- **Back-end + base de données centralisée hébergée** — pas de solution locale type Excel / Google Sheets.
- **Séparation claire des accès** : agents vs administration vs public (réseaux, rôles, surfaces d'API distinctes).
- **Stockage des photos en cloud avec URL signées**, jamais d'accès direct non authentifié (sauf la photo affichée au client, via URL signée temporaire).
- **API REST** (ou GraphQL) pour permettre une future application mobile native — REST retenu.

### 7.4 Identité visuelle

| Élément | Valeur |
|---------|--------|
| Bleu marine | `#170655` |
| Orange | `#E47911` |
| Bleu turquoise | à préciser (proposition : `#1CA9C9`) |
| Gris anthracite | à préciser (proposition : `#2E3138`) |
| Pied de page | e-mail `contact.gokapi@gmail.com`, icônes réseaux sociaux « Okapi Logistics », slogan « Le futur du commerce africain » |

> Les couleurs turquoise et anthracite exactes sont à fournir par la Direction ; des valeurs
> par défaut sont proposées et modifiables via la configuration autonome.
> E-mail de contact : **`contact.gokapi@gmail.com`** au lancement (D1), remplaçable ensuite
> par une adresse de domaine propre depuis la configuration autonome sans redéploiement.

---

## 8. Hypothèses et questions ouvertes

> **Statut au 2026-09-03 — les 15 questions ont été tranchées par le client.** Les décisions
> font foi et sont consignées dans [`00-registre-decisions.md`](00-registre-decisions.md).
> Le tableau ci-dessous en donne le résumé ; il reste 6 points résiduels (O-1 à O-6) listés
> dans le registre (choix du fournisseur SMS, table ville→code exhaustive, grilles de prix
> réelles, corridors exacts, régimes de TVA, provisionnement des comptes fournisseurs).

| # | Sujet | Décision retenue |
|---|-------|------------------|
| Q1 | E-mail de contact officiel | `contact.gokapi@gmail.com` conservé ; bascule vers un e-mail de domaine propre plus tard, via `settings.contact.email` (sans redéploiement). |
| Q2 | Portée du séquentiel du numéro de suivi | **Par ville de destination**, réinitialisé le 1ᵉʳ de chaque mois. Les 4 chiffres comptabilisent les colis par destination et par mois. |
| Q3 | Devise de référence | **USD**. |
| Q4 | Devises XAF, ZAR, RWF, BIF, TZS | Ajoutées et **actives dès la v1** (corridors déjà exploités). GBP/CNY/NGN restent inactives jusqu'aux ouvertures. |
| Q5 | Code ville du numéro de suivi | **Codes IATA officiels** — code ville métropolitain si existant (`PAR`, `SHA`, `LOS`, `JNB`…), sinon aéroport principal (`FIH`, `COO`, `BZV`, `FBM`, `PNR`, `KGL`, `BJM`, `DAR`, `CAN`). |
| Q6 | Calcul du prix | **Champ « prix par kg » par destination**, éditable dans le back-office par l'administration. `frais_fixes` / `min` / `ad valorem` optionnels (0 par défaut). |
| Q7 | Fournisseurs de notification | WhatsApp = **API officielle Meta WhatsApp Business** ; e-mail = **Amazon SES** ; SMS = fournisseur à choisir (O-1). |
| Q8 | API de taux de change | **exchangerate.host** + saisie manuelle toujours possible. |
| Q9 | Intégrations de paiement | v1 : **saisie manuelle** + référence. v2 : intégration des autres modes (M-Pesa, Orange, Airtel, carte, virement). |
| Q10 | Paiement en ligne par le client | **Hors périmètre v1.** |
| Q11 | Mode hors-ligne agence | **v1.1**, immédiatement après le MVP. Back-office en **PWA dès la v1**. |
| Q12 | Hébergeur | **OVHcloud** (régions UE ; Managed PostgreSQL, Object Storage S3, Kubernetes managé). |
| Q13 | TVA / taxes par pays | **0 par défaut**, ajustable par pays au déploiement. |
| Q14 | Langues du back-office | **fr + en + zh dès la v1** (comme la page publique). |
| Q15 | Rétention des dossiers colis | **5 ans** par défaut, ajustable par pays. |

---

*Fin du document 01. Suite : [`02-architecture.md`](02-architecture.md).*
