#!/usr/bin/env bash
# Backs up the database and the uploaded images into ~/backups and deletes
# backups older than 14 days. Run it daily from cron (see the deploy guide).
# Copy the backups off the server regularly: a backup on the same disk is lost with it.
set -euo pipefail

cd "$(dirname "$0")/.." # the folder with compose.yaml
backup_dir="${BACKUP_DIR:-$HOME/backups}"
keep_days="${KEEP_DAYS:-14}"
stamp="$(date +%Y-%m-%d_%H%M)"
mkdir -p "$backup_dir"
trap 'rm -f "$backup_dir"/*.tmp' EXIT

# Written to .tmp first, so a failed run never leaves a half file that looks complete
db_file="$backup_dir/db-$stamp.dump"
docker compose exec -T db sh -c 'pg_dump -U "$POSTGRES_USER" -d "$POSTGRES_DB" --format=custom' \
  > "$db_file.tmp"
mv "$db_file.tmp" "$db_file"

uploads_file="$backup_dir/uploads-$stamp.tar.gz"
docker compose exec -T api tar -czf - -C /app uploads > "$uploads_file.tmp"
mv "$uploads_file.tmp" "$uploads_file"

find "$backup_dir" -maxdepth 1 -type f \( -name 'db-*.dump' -o -name 'uploads-*.tar.gz' \) \
  -mtime +"$keep_days" -delete

echo "$(date -Is) backup ok: $db_file ($(du -h "$db_file" | cut -f1)), $uploads_file ($(du -h "$uploads_file" | cut -f1))"
