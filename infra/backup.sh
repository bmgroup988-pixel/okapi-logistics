#!/bin/sh
# Sauvegarde quotidienne de la base PostgreSQL de production.
# Voir docs/10-guide-hebergement-ovhcloud.md §11.
#
# Installation (une fois, sur le VPS) :
#   sudo crontab -e
#   0 3 * * * /opt/okapi-logistics/infra/backup.sh >> /var/log/okapi-backup.log 2>&1
set -eu

REPO_DIR="/opt/okapi-logistics"
BACKUP_DIR="/opt/backups"
COMPOSE_FILE="$REPO_DIR/infra/docker-compose.prod.yml"
ENV_FILE="$REPO_DIR/infra/.env.prod"

mkdir -p "$BACKUP_DIR"

FILE="$BACKUP_DIR/okapi-$(date +%F).sql.gz"
docker compose -f "$COMPOSE_FILE" --env-file "$ENV_FILE" exec -T postgres \
  pg_dump -U okapi okapi | gzip > "$FILE"

echo "Sauvegarde créée : $FILE ($(du -h "$FILE" | cut -f1))"

# Purge des sauvegardes de plus de 30 jours.
find "$BACKUP_DIR" -name '*.sql.gz' -mtime +30 -delete
