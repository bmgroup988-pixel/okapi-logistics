# 00 — Registre des décisions

Version 1.0 — 2026-09-03
Décisions du client sur les 15 questions ouvertes du document
[`01-specifications-techniques.md` §8](01-specifications-techniques.md#8-hypotheses-et-questions-ouvertes).
Ce registre fait foi ; les autres documents sont alignés sur ces réponses.

| # | Sujet | Décision (2026-09-03) | Impact |
|---|-------|-----------------------|--------|
| **D1** | E-mail de contact officiel | On conserve `contact.gokapi@gmail.com` pour l'instant. Passage à une adresse de domaine propre après acquisition du nom de domaine, via la configuration autonome (`settings.contact.email`) — sans redéploiement. | `settings` scope GLOBAL, clé `contact.email`. Pied de page + pièces + notifications lisent cette clé. |
| **D2** | Portée du séquentiel du numéro de suivi | Séquentiel **par ville de destination**, **réinitialisé au 1ᵉʳ de chaque mois**. Les 4 chiffres servent à identifier et **comptabiliser le nombre de colis par destination et par mois**. | `settings.tracking.sequence_scope = "DESTINATION_CITY"` (défaut). `sequences.scope_key` = code IATA ville destination ; `period` = `AAMM`. Un compteur `OKP26070042FIH` = 42ᵉ colis à destination de Kinshasa en juillet 2026. |
| **D3** | Devise de référence (consolidation siège) | **USD**. | `currencies.is_reference = true` sur `USD`. `settings.fx.reference_currency = "USD"`. |
| **D4** | Devises des pays actuels hors liste native | Ajouter **XAF, ZAR, RWF, BIF, TZS**. Comme ces corridors sont **exploités aujourd'hui**, ces devises sont **actives dès la v1** (même mécanisme générique que GBP/CNY/NGN, qui restent inactives jusqu'aux ouvertures). | `currencies` : `XOF, CDF, USD, EUR, XAF, ZAR, RWF, BIF, TZS` actives ; `GBP, CNY, NGN` inactives. |
| **D5** | Code ville dans le numéro de suivi | **Réutiliser les codes IATA officiels.** Code **ville (métropolitain)** IATA quand il existe (ex. `PAR` Paris, `SHA` Shanghai, `LOS` Lagos, `JNB` Johannesburg) ; à défaut, code de l'aéroport principal (ex. `FIH` Kinshasa, `COO` Cotonou, `BZV` Brazzaville, `FBM` Lubumbashi, `PNR` Pointe-Noire, `KGL` Kigali, `BJM` Bujumbura, `DAR` Dar es Salaam, `CAN` Guangzhou). | `cities.code` = code IATA. Voir table mise à jour au §14 du doc 03. |
| **D6** | Grilles tarifaires | Pas de grille figée. Le back-office expose un **champ « prix par kg » par destination**, éditable par l'administration. `fixed_fee`, `min_charge`, `ad valorem` restent disponibles mais optionnels (0 par défaut). | Écran admin « Tarifs — Prix par kg par destination » (cf. wireframes W-ADM-04). Table `tariffs` : au minimum `destination_city_id` + `price_per_kg` + `currency` + `mode`. |
| **D7** | Fournisseurs de notification | **WhatsApp** : API officielle **Meta WhatsApp Business**. **E-mail** : **Amazon SES**. **SMS** : fournisseur non encore choisi (le canal SMS reste prévu dans l'architecture ; décision différée — voir O-1 ci-dessous). | `NotificationProvider` : implémentations `MetaWhatsAppProvider`, `AmazonSesProvider`. Secrets dans le coffre. |
| **D8** | API de taux de change | **exchangerate.host**, avec **saisie manuelle** d'un taux toujours possible (prioritaire si présente et plus récente). | Job `fx-sync` → `provider = "exchangerate.host"`. `exchange_rates.source ∈ {API, MANUAL}`. |
| **D9** | Intégrations Mobile Money / carte / virement | **v1** : **saisie manuelle** du paiement + référence de transaction. **v2** : intégration directe des autres modes de paiement (M-Pesa Daraja, Orange, Airtel, TPE, virement). | Pas de connecteur de paiement en v1. Modèle de données déjà prêt (`payments.external_ref`, `state`). |
| **D10** | Paiement en ligne par le client (page publique) | **Hors périmètre v1.** | La page publique reste en lecture seule. |
| **D11** | Mode hors-ligne agence (PWA + file de synchronisation) | **Priorité v1.1**, à livrer **immédiatement après le MVP** (pas en backlog lointain). | Back-office construit en **PWA dès la v1** (socle) ; file de synchronisation + numéro de suivi provisoire → définitif ajoutés en v1.1. |
| **D12** | Hébergeur | **OVHcloud** (régions UE : Gravelines / Roubaix / Strasbourg). Managed Databases for PostgreSQL, Object Storage S3-compatible, Managed Kubernetes / instances. | IaC Terraform cible OVHcloud. Résidence UE native pour le périmètre France. |
| **D13** | TVA / taxes par pays | **0 par défaut** (`countries.tax_rate = 0`), ajustable par pays lors du déploiement. | Champ conservé sur les pièces. |
| **D14** | Langues du back-office | **fr + en + zh dès la v1** (comme la page publique). | i18next back-office : `fr`, `en`, `zh`. Tous les libellés traduits en v1. |
| **D15** | Rétention des dossiers colis | **5 ans** par défaut (à ajuster par pays si besoin). | `retention_policies.parcel_dossier = 60 mois`, action `ANONYMIZE`. Pièces comptables : conservées selon droit local (≥ 10 ans). |

## Décisions — addendum 08 (extension réseau, tarification, permissions)

Intégré le 2026-09-10. Voir [`09-addendum-extension-reseau-permissions.md`](09-addendum-extension-reseau-permissions.md)
pour le document source ; ces décisions arbitrent les points qu'il laissait ouverts.

| # | Sujet | Décision (2026-09-10) | Impact |
|---|-------|-----------------------|--------|
| **D16** | Rôle `AGENT_PARTENAIRE` (addendum §4.3, option B) | **Différé.** L'option A (l'agent du hub le plus proche gère la remise et la livraison pour le compte du partenaire) est retenue pour la v1. La scission `parcel:arrival:confirm`/`parcel:deliver:confirm` (déjà nécessaire pour l'option A) rend l'ajout ultérieur du rôle sans migration de permissions — seulement une nouvelle ligne `roles`. | Aucun compte partenaire en v1. Réévaluer si le volume par partenaire le justifie (même logique que O-1, SMS différé). |
| **D17** | Table `RouteTariff` de l'addendum (§2.2) | **Pas de nouvelle table.** Le modèle `tariffs` existant (D6) couvre déjà une paire `(origin_city_id, destination_city_id)` + mode, sens explicite, versionnée par date — c'est exactement le besoin décrit. Seule la dernière étape partenaire (`partner_tariffs`) est nouvelle. | `docs/03` §4, note sous `tariffs`. Aucun impact sur le modèle de données au-delà de `delivery_partners`/`partner_tariffs`/`partner_settlements`. |
| **D18** | Statut réseau des villes hors RDC | Les villes du réseau international actuel (Cotonou, Brazzaville, Pointe-Noire, Johannesburg, Kigali, Bujumbura, Dar es Salaam, Paris, Shanghai, Guangzhou, Lagos) sont classées `HUB` par défaut — le modèle partenaire cible le dernier kilomètre domestique RDC, pas le fret international classique. | `cities.status = HUB` pour ces villes au seed. Modifiable depuis `/admin/cities` si un mode partenaire y est introduit plus tard. |
| **D19** | Résolution de tarif — ordre | L'implémentation existante (ville→ville exact → destination seule toutes origines → corridor pays → erreur) est conservée telle quelle ; elle couvre et affine l'ordre proposé par l'addendum (§2.3 : exact → corridor → erreur). | `pricing.service.ts`, inchangé par l'addendum. |
| **D20** | Devise du règlement partenaire (`partner_settlements`) | **v1 : devise unique par partenaire**, celle de son `partner_tariffs` actif (ou du dernier colis inclus à défaut). Pas de conversion multi-devises dans le calcul de réconciliation. | Limite documentée dans `docs/03` §4 (`partner_settlements`) et dans le service `PartnerSettlementsService`. À lever si un partenaire facture dans plusieurs devises. |
| **D21** | Détail des colis inclus dans un règlement (addendum §5.2, `GET .../{id}`) | Pas de table de liaison règlement↔colis en v1 : le détail est **recalculé à la demande** avec les mêmes critères que la génération (`deliveryPartnerId` + `LIVRE` + `deliveredAt` dans la période). Une régularisation après génération repasse donc par une nouvelle génération plutôt qu'une correction manuelle du brouillon. | `PartnerSettlementsService.get()`. À réévaluer si des colis sont corrigés/réattribués après la génération d'un règlement `VALIDATED`. |

## Questions résiduelles ouvertes

| # | Sujet | Attendu |
|---|-------|---------|
| **O-1** | Fournisseur **SMS** | Choisir un agrégateur SMS couvrant les corridors (ex. Twilio, Vonage, Africa's Talking, MTN/Orange en direct). Le canal SMS est prévu partout dans l'architecture ; seul le connecteur reste à trancher. À défaut de SMS au lancement, WhatsApp + e-mail assurent la couverture. |
| **O-2** | Table officielle **ville → code IATA** exhaustive | Fournir la liste définitive des villes desservies avec leur code (la table du doc 03 §14 est une proposition conforme à D5). |
| **O-3** | **Grilles de prix par kg** réelles par destination et par mode | À saisir dans le back-office par l'administration avant la mise en production (D6). |
| **O-4** | **Corridors** actifs exacts et délais indicatifs par corridor | Compléter la liste du doc 03 §14. |
| **O-5** | Régimes de **TVA/taxe** par pays (quand ≠ 0) | Fournir au fil des déploiements (D13). |
| **O-6** | Comptes fournisseurs (Meta WhatsApp Business, AWS SES, exchangerate.host, OVHcloud) et identités d'émetteur / expéditeurs vérifiés | À provisionner par le client. |
| **O-7** | Partenaires de livraison réels pour les 23 villes RDC en statut `PARTNER` | Seuls Goma et Bukavu ont un partenaire de démonstration en seed (`seedDeliveryPartners`, addendum 08). Fournir raison sociale, zone de couverture, contact et tarif/kg par ville pour les saisir depuis `/admin/delivery-partners` avant mise en production. |
