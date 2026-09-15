# 10 — Guide d'hébergement OVHcloud (pas à pas)

Version 1.0 — 2026-09-15
Complète [`08-plan-deploiement-multipays.md`](08-plan-deploiement-multipays.md) (choix d'hébergeur déjà
tranché §3) avec la procédure concrète de mise en ligne. Public : équipe technique / toute personne
sans compte cloud existant qui doit mettre l'application en ligne pour la première fois.

---

## 0. Ce que vous allez obtenir à la fin

Une instance OVHcloud unique (un seul VPS) qui héberge les trois applications (API, back-office,
suivi public) plus PostgreSQL et le stockage objet, avec HTTPS automatique, accessible sur vos
propres noms de domaine. C'est le **« démarrage simplifié »** décrit en docs/08 §3 : suffisant pour
un vrai lancement, migrable ensuite vers des services managés (base de données, stockage) sans
changer une ligne de code — seulement des variables d'environnement.

**Coût indicatif** (tarifs OVHcloud France vérifiés le 2026-09-15, gamme VPS 2027) : le **VPS-2**
(4 vCores / 8 Go RAM / 75 Go NVMe) coûte **7,21 € HT/mois (8,65 € TTC)** — suffisant pour les 3 apps +
PostgreSQL + MinIO en démarrage. Le **VPS-3** (6 vCores / 12 Go RAM / 100 Go NVMe, 10,40 € HT soit
12,48 € TTC/mois) donne davantage de marge si le volume grossit vite. Sauvegarde quotidienne et
anti-DDoS déjà inclus dans ces deux tarifs. Un nom de domaine coûte 10–15 €/an en plus.

---

## 1. Créer le compte OVHcloud

1. Aller sur **[auth.eu.ovhcloud.com](https://auth.eu.ovhcloud.com)** (Espace client OVHcloud —
   lien direct vérifié) et cliquer « **Créer un compte** ». **C'est vous qui créez le compte et
   entrez les informations de paiement, jamais un tiers.**
2. Activer la vérification en deux étapes sur le compte (sécurité minimale pour un compte qui gère
   de la production).

## 2. Réserver un nom de domaine (si vous n'en avez pas déjà un)

Chez OVHcloud ou tout autre registrar (Gandi, Namecheap...). Vous aurez besoin de 3 sous-domaines,
par exemple avec `okapilogistics.com` :
- `api.okapilogistics.com` → l'API
- `admin.okapilogistics.com` → le back-office
- `suivi.okapilogistics.com` → le site public de suivi

## 3. Commander le VPS

1. Aller sur **[ovhcloud.com/fr/vps/](https://www.ovhcloud.com/fr/vps/)** (page produit vérifiée) et
   cliquer « **Configurer** » sous **VPS-2** (4 vCores / 8 Go RAM / 75 Go NVMe, 8,65 € TTC/mois) —
   suffisant pour les 3 apps + PostgreSQL sur la même machine ; prendre **VPS-3** (12 Go RAM,
   12,48 € TTC/mois) si le budget le permet, pour plus de marge.
2. **Région : Gravelines (GRA) ou Strasbourg (SBG)** — région UE, cohérent avec la contrainte RGPD
   documentée en docs/08 §3, et bonne latence vers l'Afrique de l'Ouest/Centrale.
3. Image : **Ubuntu 24.04 LTS**.
4. Notez l'**adresse IP publique** fournie après provisioning (quelques minutes).

## 4. Pointer le DNS vers le VPS

Dans la zone DNS de votre domaine (OVHcloud ou votre registrar), créer 3 enregistrements **A** :

| Nom | Type | Valeur |
|-----|------|--------|
| `api` | A | (IP du VPS) |
| `admin` | A | (IP du VPS) |
| `suivi` | A | (IP du VPS) |

La propagation peut prendre de quelques minutes à quelques heures.

## 5. Préparer le serveur

Connexion SSH (identifiants reçus par e-mail à la commande) :

```bash
ssh ubuntu@<IP_DU_VPS>
```

Installer Docker :

```bash
curl -fsSL https://get.docker.com | sudo sh
sudo usermod -aG docker $USER
# se déconnecter / reconnecter pour que le groupe s'applique
```

Pare-feu minimal (ne laisser entrant que SSH, HTTP, HTTPS) :

```bash
sudo ufw allow OpenSSH
sudo ufw allow 80/tcp
sudo ufw allow 443/tcp
sudo ufw enable
```

## 6. Cloner le dépôt et configurer l'environnement

```bash
sudo mkdir -p /opt/okapi-logistics && sudo chown $USER /opt/okapi-logistics
git clone https://github.com/<votre-compte>/okapi-logistics.git /opt/okapi-logistics
cd /opt/okapi-logistics
cp infra/.env.prod.example infra/.env.prod
nano infra/.env.prod   # renseigner domaines, mots de passe, secrets JWT
```

Générer des secrets forts :

```bash
openssl rand -base64 48   # pour JWT_ACCESS_SECRET
openssl rand -base64 48   # pour JWT_REFRESH_SECRET (différent du premier !)
openssl rand -base64 24   # pour POSTGRES_PASSWORD
openssl rand -base64 24   # pour S3_ACCESS_KEY / S3_SECRET_KEY
```

## 7. Connecter les fournisseurs de notification (optionnel au démarrage)

Le code est déjà prêt à brancher (`apps/api/src/notifications/providers/`) — tant que ces variables
sont vides dans `infra/.env.prod`, les notifications restent en **mode journalisation locale**
(aucun envoi réel, rien ne casse). À faire quand vous êtes prêt :

- **E-mail (Amazon SES)** : créer un compte AWS, sortir SES du bac à sable (« sandbox »), vérifier
  votre domaine d'envoi (DKIM/SPF), créer une clé d'accès IAM avec la permission `ses:SendEmail`
  uniquement. Renseigner `SES_REGION`, `SES_ACCESS_KEY`, `SES_SECRET_KEY`, `SES_FROM_EMAIL`.
- **WhatsApp (Meta Business)** : créer une app Meta Business, activer l'API Cloud WhatsApp, obtenir
  un numéro de téléphone WhatsApp Business et un jeton d'accès permanent. Renseigner
  `WHATSAPP_PHONE_NUMBER_ID`, `WHATSAPP_ACCESS_TOKEN`.
- **SMS (Africa's Talking, recommandé)** : créer un compte sur
  [africastalking.com](https://africastalking.com), obtenir un nom d'utilisateur + une clé API.
  Renseigner `SMS_GATEWAY_USERNAME`, `SMS_GATEWAY_API_KEY`. (Pour un autre fournisseur, remplacer
  `apps/api/src/notifications/providers/sms.provider.ts` — c'est le seul fichier à changer.)

## 8. Premier déploiement

```bash
cd /opt/okapi-logistics
docker compose -f infra/docker-compose.prod.yml --env-file infra/.env.prod pull
docker compose -f infra/docker-compose.prod.yml --env-file infra/.env.prod up -d
```

Les images sont publiées par le pipeline CI/CD (`.github/workflows/deploy.yml`, voir §10) sur
**GitHub Container Registry** — gratuit, aucun compte supplémentaire (utilise votre compte GitHub
existant). Si vous déployez avant d'avoir configuré ce pipeline, buildez les images directement sur
le serveur :

```bash
docker compose -f infra/docker-compose.prod.yml --env-file infra/.env.prod build
docker compose -f infra/docker-compose.prod.yml --env-file infra/.env.prod up -d
```

## 9. Base de données : migrations, contraintes et données de référence

```bash
docker compose -f infra/docker-compose.prod.yml exec api npx prisma migrate deploy
docker compose -f infra/docker-compose.prod.yml exec api npm run db:constraints
```

Puis créer le **premier compte super-administrateur** (pas de seed de démo en production) —
directement en base ou via une petite commande dédiée à écrire si besoin (à ce stade, `seed.ts`
insère des données de démonstration : ne pas l'exécuter en production).

## 10. Automatiser les déploiements suivants (CI/CD)

Le pipeline `.github/workflows/deploy.yml` est prêt mais **déclenché uniquement à la main**
(`workflow_dispatch`) tant que ces secrets ne sont pas configurés dans GitHub
(Settings → Secrets and variables → Actions) :

| Secret | Valeur |
|--------|--------|
| `SSH_HOST` | IP du VPS |
| `SSH_USER` | `ubuntu` |
| `SSH_PRIVATE_KEY` | Clé privée SSH dédiée au déploiement (**pas votre clé personnelle** — en générer une : `ssh-keygen -t ed25519 -f deploy_key`, ajouter la publique dans `~/.ssh/authorized_keys` du VPS) |

Variables (Settings → Secrets and variables → Actions → **Variables**, pas secrets — valeurs non
sensibles) : `VITE_API_BASE=https://api.okapilogistics.com/api/v1`,
`NEXT_PUBLIC_API_BASE=https://api.okapilogistics.com/api/v1`.

Une fois configuré : `Actions` → `Deploy` → `Run workflow`. Pour un déploiement automatique à chaque
push sur `main`, ajouter `push: branches: [main]` au déclencheur du fichier (à faire seulement quand
vous êtes à l'aise avec le pipeline manuel).

## 11. Sauvegardes

```bash
# Sauvegarde quotidienne de la base (à placer en tâche cron)
docker compose -f infra/docker-compose.prod.yml exec -T postgres \
  pg_dump -U okapi okapi | gzip > /opt/backups/okapi-$(date +%F).sql.gz

# Purge des sauvegardes de plus de 30 jours
find /opt/backups -name "*.sql.gz" -mtime +30 -delete
```

Copier régulièrement `/opt/backups` hors du serveur (OVHcloud Object Storage, ou un simple
`rsync` vers un autre serveur) — une sauvegarde qui reste sur la même machine ne protège pas d'une
panne matérielle. **Tester la restauration** au moins une fois (critère de mise en service, docs/08
§12).

## 12. Observabilité minimale

```bash
docker compose -f infra/docker-compose.prod.yml logs -f api
docker stats
```

Pour aller plus loin sans compte supplémentaire : [OVHcloud Logs Data Platform](https://www.ovhcloud.com/fr/logs-data-platform/)
(offre managée OVHcloud) ou un simple `docker compose logs` redirigé vers un fichier avec rotation
(`logrotate`).

## 13. Faire évoluer vers des services managés (quand le volume le justifie)

| De | Vers | Changement |
|----|------|------------|
| PostgreSQL en conteneur | OVHcloud Managed PostgreSQL | Changer `DATABASE_URL` dans `infra/.env.prod` vers l'URL fournie par OVHcloud ; migrer les données (`pg_dump` / `pg_restore`). |
| MinIO en conteneur | OVHcloud Object Storage (S3) | Changer `S3_ENDPOINT`, `S3_ACCESS_KEY`, `S3_SECRET_KEY` vers les identifiants OVHcloud Object Storage ; copier les objets existants (`mc mirror`). |
| Un seul VPS | Plusieurs VPS / Kubernetes managé | Nécessaire seulement à forte charge — voir ENF-PERF de docs/01. |

Aucun changement de code applicatif dans aucun de ces trois cas : uniquement de la configuration.

---

## 14. Checklist de mise en service

Reprend les critères déjà définis en docs/08 §12, version opérationnelle :

- [ ] VPS provisionné, DNS propagé, HTTPS actif (certificat Let's Encrypt visible dans le navigateur)
- [ ] `GET https://api.okapilogistics.com/api/v1/health` répond `{"status":"ok"}`
- [ ] Migrations + contraintes SQL appliquées
- [ ] Premier compte super-administrateur créé, mot de passe fort, MFA activé
- [ ] Sauvegarde quotidienne active + restauration testée une fois
- [ ] Au moins un connecteur de notification réel branché et testé (sinon rester en mode
      « aucun envoi réel » en toute connaissance de cause)
- [ ] Secrets `infra/.env.prod` différents des valeurs d'exemple, jamais commités
- [ ] Pare-feu limité à SSH/80/443

---

*Fin du document 10.*
