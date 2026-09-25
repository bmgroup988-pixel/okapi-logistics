# 06 — Manuel de l'agent fret

Version 1.1 — 2026-09-23
Public : agent fret et assistant fret en agence.
Vous n'avez besoin d'aucune connaissance technique pour utiliser ce manuel.

---

## Sommaire

1. [Se connecter](#1-se-connecter)
2. [L'écran du back-office](#2-lecran-du-back-office)
3. [Enregistrer un colis](#3-enregistrer-un-colis)
4. [La photo du colis (obligatoire)](#4-la-photo-du-colis-obligatoire)
5. [Le numéro de suivi et l'étiquette](#5-le-numero-de-suivi-et-letiquette)
6. [Encaisser un paiement](#6-encaisser-un-paiement)
7. [Faire avancer un colis (changer le statut)](#7-faire-avancer-un-colis)
8. [Consulter la fiche d'un colis](#8-consulter-la-fiche-dun-colis)
9. [Rechercher un colis](#9-rechercher-un-colis)
10. [Cas particuliers](#10-cas-particuliers)
11. [Ce que voit le client](#11-ce-que-voit-le-client)
12. [Bonnes pratiques et erreurs fréquentes](#12-bonnes-pratiques-et-erreurs-frequentes)
13. [Groupages (suivi de transit par lot)](#13-groupages-suivi-de-transit-par-lot)
14. [Enregistrer un colis pour un fournisseur](#14-enregistrer-un-colis-pour-un-fournisseur)
15. [Aide](#15-aide)

---

## 1. Se connecter

1. Ouvrez le back-office dans votre navigateur (adresse fournie par votre administration).
2. Saisissez votre **e-mail** et votre **mot de passe**, puis « Se connecter ».
3. Si la vérification en deux étapes est activée sur votre compte, saisissez le **code à
   6 chiffres** de votre application d'authentification.

> **Sécurité.** Après 5 tentatives de mot de passe erronées, le compte est bloqué pendant
> 15 minutes. En cas d'oubli, contactez votre administration : elle réinitialise votre
> mot de passe ou votre code de vérification.

Pour vous déconnecter : bouton **« Déconnexion »** en haut à droite. Faites-le toujours
sur un poste partagé.

---

## 2. L'écran du back-office

- **Barre du haut** : le nom de l'application, le sélecteur de **langue** (Français /
  English / 中文), votre nom, le bouton « Déconnexion ».
- **Menu de gauche** : vous ne voyez que ce que votre rôle autorise. Un agent voit
  généralement :
  - **Tableau de bord** — chiffres du jour de votre agence ;
  - **＋ Nouveau colis** — enregistrer un colis ;
  - **Colis** — retrouver et suivre les colis.
- **Zone centrale** : le contenu de l'écran choisi.

Le **tableau de bord** affiche : colis du jour, colis en transit, colis arrivés à
retirer, colis impayés, et la liste des derniers colis enregistrés. Cliquez sur un
numéro de suivi pour ouvrir sa fiche.

---

## 3. Enregistrer un colis

Cliquez sur **« ＋ Nouveau colis »**. L'enregistrement se fait en **3 étapes**.

### Étape 1 — Parties et trajet

| Champ | Ce qu'il faut saisir |
|-------|----------------------|
| **Expéditeur — Nom** *(obligatoire)* | Nom de la personne qui envoie. |
| Expéditeur — Téléphone | Numéro au format international (`+229…`). Recommandé. |
| **Destinataire — Nom** *(obligatoire)* | Nom de la personne qui reçoit. |
| Destinataire — Téléphone | Numéro du destinataire. Sert à l'envoi des notifications. |
| **Ville de départ** *(obligatoire)* | Choisissez dans la liste (villes actives seulement). |
| **Ville de destination** *(obligatoire)* | Choisissez dans la liste. Détermine le **code** du numéro de suivi. |
| **Mode** | Aérien ou Maritime. Change le tarif et les délais. |
| **Poids (kg)** *(obligatoire)* | Poids réel, jusqu'à 2 décimales (ex. `12,40`). |
| **Nature du contenu** *(obligatoire)* | Description courte (ex. « pièces détachées »). |
| Valeur déclarée | Facultative. Sert en cas de litige, **n'entre pas** dans le calcul du prix. |
| Ajustement agent | Facultatif. Réduction/majoration exprimée en proportion : `-0.1` = −10 %, `0.05` = +5 %. Doit rester **dans la fourchette autorisée** (sinon l'enregistrement est refusé et une dérogation est nécessaire). |
| Canal client | Comment prévenir le client : WhatsApp, SMS ou e-mail. |
| Langue client | Langue des notifications reçues par le client. |

Dès que ville de départ, ville de destination et poids sont renseignés, un **aperçu du
prix** s'affiche : « Tarif : X /kg · Montant estimé : Y ».

> Si le message **« Aucun tarif défini pour cette destination »** apparaît, prévenez votre
> administration : le prix par kg de cette destination doit être saisi côté configuration.

Cochez enfin la case **« Le client accepte les mentions d'information »** (consentement du
client pour le suivi et les notifications). Sans cette case, on ne peut pas continuer.

Cliquez sur **« Suivant : Photo du colis › »**. Le colis est alors **créé** et reçoit son
numéro de suivi.

### Étape 2 — Photo du colis

Voir le [chapitre 4](#4-la-photo-du-colis-obligatoire). L'enregistrement **n'est pas
terminé** tant qu'une photo n'a pas été prise.

### Étape 3 — Confirmation

L'écran affiche :

- le **numéro de suivi** (ex. `OKP2209260043FIH`) ;
- le **montant dû** et le statut **« IMPAYÉ »** ;
- les boutons : **Ouvrir la fiche** (pour imprimer les documents ou encaisser) et
  **＋ Enregistrer un autre colis**.

---

## 4. La photo du colis (obligatoire)

La photo est une **preuve** en cas de litige. Elle est **liée définitivement** au colis
et devient **non modifiable** dès que le colis part (statut « En transit »).

1. À l'étape 2, cliquez sur le champ **« Choisir une photo »**.
2. Sur mobile ou tablette, la **caméra arrière** s'ouvre : cadrez le colis et prenez la
   photo. Sur ordinateur, sélectionnez une image ou utilisez la webcam.
3. L'envoi se fait automatiquement. Patientez jusqu'au passage à l'étape 3.

Conseils :

- Photographiez le **colis entier**, avec l'étiquette si elle est déjà collée.
- Évitez le flou et le contre-jour.
- La position GPS de la photo est **retirée** automatiquement ; l'heure enregistrée est
  celle du serveur.

Si le message **« Upload refusé »** apparaît, réessayez ; si cela persiste, prévenez
votre administration (problème de stockage).

---

## 5. Le numéro de suivi et l'étiquette

Le numéro de suivi a la forme **`OKP` + jour + mois + année + numéro + code ville** :
`OKP` `22` `09` `26` `0043` `FIH` = 43ᵉ colis à destination de Kinshasa, enregistré le
22 septembre 2026. Le numéro d'ordre repart à `0001` au début de chaque mois (pas chaque
jour) — le 43ᵉ colis peut aussi bien être le premier de la journée que le dernier.

Il est **unique** et n'est **jamais réattribué**. Les numéros enregistrés avant le
22/09/2026 (sans le jour, ex. `OKP26090043FIH`) restent valables tels quels.

Documents disponibles depuis la fiche du colis, onglet **« Documents »** :

| Document | Quand |
|----------|-------|
| **Étiquette** (100 × 150 mm, QR code + n° de suivi) | dès l'enregistrement |
| **Reçu d'enregistrement** | dès l'enregistrement |
| **Reçu de paiement** | à chaque paiement confirmé |
| **Facture** | quand le colis est entièrement payé |

Cliquez sur **« Télécharger »** puis imprimez. Collez l'étiquette sur le colis. Le QR
code renvoie le client vers la page publique de suivi.

---

## 6. Encaisser un paiement

Un colis peut être payé **en une ou plusieurs fois**, et dans **une devise différente**
de celle de facturation.

1. Ouvrez la fiche du colis → onglet **« Paiements »**.
2. En haut : **Dû**, **Encaissé**, **Solde** restant.
3. Cliquez sur **« Encaisser un paiement »**.
4. Renseignez :
   - **Montant** reçu et **devise** (par défaut, la devise de facturation) ;
   - **Moyen de paiement** : Espèces, Mobile Money, Carte bancaire, Virement ;
   - pour Mobile Money : le **fournisseur** (M-Pesa, Orange Money, Airtel Money) ;
   - **Référence de transaction** (fortement recommandée pour Mobile Money, carte,
     virement).
5. Cliquez sur **« Enregistrer le paiement »**.

Ce qui se passe ensuite :

| Moyen | État du paiement |
|-------|------------------|
| **Espèces** | **Confirmé** immédiatement. |
| Mobile Money / Carte / Virement | **En attente**. Quand vous avez la **confirmation de réception des fonds**, cliquez sur **« Confirmer »** dans la liste des paiements. |

Seuls les paiements **confirmés** réduisent le solde. Le **statut de paiement** du colis
se met à jour tout seul : `Impayé` → `Partiel` → `Payé`. Un **reçu** est généré à chaque
paiement confirmé.

> Si vous saisissez une devise différente de la devise de facturation, la plateforme
> **fige le taux de change** utilisé ; il apparaît sur le reçu.

### Remboursement

Le remboursement d'un paiement est **réservé à l'administration**. Faites-en la demande
en indiquant le motif ; l'administration produit un **avoir**.

---

## 7. Faire avancer un colis (changer le statut)

Le colis suit un parcours : **Enregistré → En transit → Arrivé → Livré**, avec les
branches **Annulé** et **Retourné**.

1. Ouvrez la fiche du colis.
2. Cliquez sur **« Changer le statut »**.
3. Choisissez le **nouveau statut** (seuls les statuts possibles sont proposés).
4. Renseignez éventuellement le **lieu**, un **commentaire**, et laissez cochée
   « Visible par le client » si l'étape doit apparaître dans son suivi.
5. Confirmez.

Chaque changement crée une **étape** horodatée et **envoie une notification** au client
(selon son canal et sa langue).

Statuts et effets :

| Passage à… | Effet |
|------------|-------|
| **En transit** | Les photos deviennent **verrouillées** (non modifiables). |
| **Arrivé** | Le client reçoit automatiquement un rappel : délai de retrait de **72h (3 jours) maximum**, au-delà des **frais d'entreposage de 5$/jour** s'appliquent. Si le colis est impayé ou partiellement payé, une **relance** est envoyée en plus. |
| **Livré** | Notification de livraison au client. **Voir la règle « impayé » ci-dessous.** |

### Livrer un colis non soldé

- Dans les pays en politique **stricte** (France, Chine) : **interdit**. Le solde doit
  être réglé avant la livraison.
- Dans les autres pays : possible **avec une justification obligatoire**, saisie dans le
  champ prévu. Cette dérogation est **tracée**.

---

## 8. Consulter la fiche d'un colis

Ouvrez un colis depuis le tableau de bord, la liste ou la recherche. La fiche affiche en
haut le **statut** et le **statut de paiement + solde**, puis quatre onglets :

| Onglet | Contenu |
|--------|---------|
| **Suivi** | Historique des étapes, coordonnées expéditeur/destinataire, détails (trajet, poids, contenu, canal, langue). |
| **Paiements** | Solde, historique des paiements (montant, devise, moyen, référence, état, agent), bouton « Encaisser », « Confirmer » pour les paiements en attente. |
| **Photos** | Photos du colis (la première est la **principale**, affichée au client). Indique si elles sont verrouillées. |
| **Documents** | Étiquette, reçus, facture — à télécharger et imprimer. |

---

## 9. Rechercher un colis

Écran **« Colis »** :

- **Recherche** par numéro de suivi (complet ou partiel), nom ou téléphone d'une partie.
- **Filtres** : statut, statut de paiement.
- Vous ne voyez que les colis de **votre agence** (ou de vos pays si vous avez un
  périmètre élargi).

Cliquez sur une ligne pour ouvrir la fiche.

---

## 10. Cas particuliers

| Situation | Que faire |
|-----------|-----------|
| **Erreur de saisie avant expédition** | Ouvrez la fiche : tant que le colis est au statut « Enregistré », l'administration peut le modifier. Après « En transit », ce n'est plus possible. |
| **Annulation d'un colis** | Réservé selon les droits. Le colis passe à « Annulé » **avec un motif**. Il **garde son numéro de suivi** et son historique. |
| **Colis retourné** | Depuis « En transit » ou « Arrivé », choisissez « Retourné ». Vous pourrez ensuite le repasser à « Arrivé » si besoin. |
| **Client conteste le contenu ou l'état** | La **photo d'enregistrement** fait foi. Elle est dans l'onglet Photos. |
| **Double enregistrement par erreur réseau** | La plateforme empêche la création en double du même colis (clé d'unicité). En cas de doute, cherchez le numéro de suivi avant de recommencer. |

---

## 11. Ce que voit le client

Le client suit son colis sur la **page publique**, en saisissant son numéro de suivi
(ou en scannant le QR de l'étiquette), **sans compte**. Il voit :

- le **statut** du colis et la frise Enregistré → En transit → Arrivé → Livré ;
- la **photo** du colis ;
- un **statut de paiement simplifié** : « Payé », « Paiement partiel » ou « En attente de
  paiement » — **sans aucun montant** ;
- l'**historique** des étapes marquées « visibles par le client », avec dates.

Il **ne voit jamais** : les montants, les moyens de paiement, les références de
transaction, les adresses, les téléphones.

---

## 12. Bonnes pratiques et erreurs fréquentes

- **Toujours prendre une photo nette** : c'est votre protection en cas de litige.
- **Saisir la référence** des paiements Mobile Money / carte / virement : indispensable
  pour le rapprochement.
- **Confirmer** les paiements Mobile Money seulement après réception réelle des fonds.
- **Vérifier la ville de destination** : elle détermine le code du numéro de suivi et le
  tarif.
- Ne pas forcer un **ajustement de prix** hors fourchette : demandez une dérogation.
- Se **déconnecter** en fin de service sur un poste partagé.
- En cas de **panne réseau** : notez les informations sur papier et enregistrez le colis
  dès le retour de la connexion (le mode hors-ligne complet est prévu en version 1.1).

### Messages d'erreur courants

| Message | Signification | Action |
|---------|---------------|--------|
| « Aucun tarif défini pour cette destination » | Le prix/kg n'est pas configuré. | Prévenir l'administration. |
| « L'ajustement de tarif dépasse la fourchette autorisée » | Remise/majoration trop importante. | Demander une dérogation. |
| « Aucun taux de change disponible » | Le taux devise → devise de référence manque. | Prévenir l'administration (saisie d'un taux). |
| « Livraison interdite avec un solde impayé » | Pays en politique stricte. | Encaisser le solde avant de livrer. |
| « Une justification est requise pour livrer avec un solde impayé » | Pays en dérogation. | Renseigner le motif dans le champ prévu. |
| « Le colis ne peut plus être modifié après expédition » | Colis déjà « En transit ». | Contacter l'administration. |

---

## 13. Groupages (suivi de transit par lot)

Un **groupage** rassemble plusieurs colis (d'un même fournisseur ou déposés au comptoir)
qui voyagent ensemble vers une **agence de destination** commune. Ça sert uniquement au
**suivi de transit par lot** — ce n'est pas de la facturation : chaque colis garde son
propre montant dû et son propre statut de paiement.

1. Menu **« Groupages »** → **« Nouveau groupage »**.
2. Choisissez l'**agence de destination** dans le menu déroulant.
3. Ajoutez les colis : tapez dans le champ de recherche un numéro de suivi (complet ou
   partiel, ex. « 0043 FIH ») ou un nom — seuls les colis **pas déjà dans un autre
   groupage ouvert** apparaissent.
4. Une fois tous les colis ajoutés, enregistrez.

Le groupage garde un **statut global** (ouvert, en transit, arrivé) qui vient s'ajouter
au statut individuel de chaque colis — faire avancer le groupage ne change **pas**
automatiquement le statut de chaque colis un par un, c'est un suivi de lot séparé.

---

## 14. Enregistrer un colis pour un fournisseur

Un fournisseur dépose parfois ses colis **physiquement à l'agence** sans passer par son
propre portail en ligne. Dans ce cas, c'est vous qui enregistrez pour lui :

1. Menu **« Colis fournisseur »** (visible seulement si votre compte a ce droit).
2. Choisissez le **fournisseur** concerné dans la liste.
3. Enregistrez le colis comme d'habitude (§3) — il est automatiquement rattaché à
   l'expédition en cours de ce fournisseur.
4. C'est toujours le fournisseur (ou l'administration en son nom) qui **clôture**
   l'expédition et déclenche la facturation groupée, pas vous.

> Cet outil est réservé au personnel interne. Un compte fournisseur ne peut jamais
> l'atteindre, même par erreur — l'ajout de colis et la clôture depuis le portail
> fournisseur en libre-service sont volontairement désactivés (docs/11 §6.2) : c'est
> l'agence qui enregistre pour lui.

---

## 15. Aide

- Problème de compte (mot de passe, code de vérification) : votre **administration**.
- Problème technique persistant (upload, page qui ne charge pas) : signalez-le à
  l'administration en précisant le **numéro de suivi** et l'heure.
- Contact général : `contact.gokapi@gmail.com`.

---

*Fin du document 06. Voir aussi : [`07-manuel-administration.md`](07-manuel-administration.md),
[`04-wireframes.md`](04-wireframes.md).*
