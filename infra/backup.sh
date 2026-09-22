#!/bin/sh
# Sauvegarde quotidienne — PostgreSQL + MinIO (photos/PDF) + copie hors
# serveur (OVHcloud Object Storage via rclone, si configuré).
# Voir docs/10-guide-hebergement-ovhcloud.md §11.
#
# Installation (une fois, sur le VPS) :
#   sudo crontab -e
#   0 3 * * * /opt/okapi-logistics/infra/backup.sh >> /var/log/okapi-backup.log 2>&1
#
# Copie hors serveur (optionnelle mais fortement recommandée — une
# sauvegarde qui reste sur ce disque ne protège d'aucune panne matérielle
# ni piratage du serveur) : configurer un remote rclone nommé "okapi-offsite"
# (ex. `rclone config`, type S3, endpoint OVHcloud Object Storage) — tant
# qu'il n'existe pas, cette étape est silencieusement sautée.
set -eu

REPO_DIR="/opt/okapi-logistics"
BACKUP_DIR="/opt/backups"
COMPOSE_FILE="$REPO_DIR/infra/docker-compose.prod.yml"
ENV_FILE="$REPO_DIR/infra/.env.prod"
RCLONE_REMOTE="okapi-offsite"
RCLONE_BUCKET_PATH="${RCLONE_REMOTE}:okapi-backups"

mkdir -p "$BACKUP_DIR"
DATE="$(date +%F)"

# ---------------------------------------------------------------- PostgreSQL
PG_FILE="$BACKUP_DIR/okapi-pg-$DATE.sql.gz"
docker compose -f "$COMPOSE_FILE" --env-file "$ENV_FILE" exec -T postgres \
  pg_dump -U okapi okapi | gzip > "$PG_FILE"
echo "Sauvegarde PostgreSQL créée : $PG_FILE ($(du -h "$PG_FILE" | cut -f1))"

# --------------------------------------------------------------------- MinIO
# Archive le volume Docker nommé (photos de colis, PDF de factures/documents)
# — un conteneur Alpine jetable monte le même volume en lecture seule.
MINIO_FILE="$BACKUP_DIR/okapi-minio-$DATE.tar.gz"
docker run --rm \
  -v okapi-minio:/data:ro \
  -v "$BACKUP_DIR":/backup \
  alpine:latest \
  tar czf "/backup/okapi-minio-$DATE.tar.gz" -C /data .
echo "Sauvegarde MinIO créée : $MINIO_FILE ($(du -h "$MINIO_FILE" | cut -f1))"

# ------------------------------------------------------- Copie hors serveur
if command -v rclone >/dev/null 2>&1 && rclone listremotes | grep -q "^${RCLONE_REMOTE}:$"; then
  rclone copy "$PG_FILE" "$RCLONE_BUCKET_PATH/" --quiet
  rclone copy "$MINIO_FILE" "$RCLONE_BUCKET_PATH/" --quiet
  echo "Copiées vers $RCLONE_BUCKET_PATH (hors serveur)."
else
  echo "AVERTISSEMENT : remote rclone '$RCLONE_REMOTE' non configuré — sauvegardes conservées uniquement sur ce serveur (voir docs/10 §11)."
fi

# ----------------------------------------------------------------- Purge
# 30 jours en local (le serveur a un disque limité) ; la copie hors serveur,
# elle, n'est jamais purgée automatiquement par ce script.
find "$BACKUP_DIR" -name '*.sql.gz' -mtime +30 -delete
find "$BACKUP_DIR" -name '*.tar.gz' -mtime +30 -delete
