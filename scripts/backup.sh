#!/usr/bin/env bash
# Usage: DATABASE_URL=postgresql://... ./scripts/backup.sh
# Creates a compressed dump. Copy it somewhere OTHER than the database host.
set -euo pipefail
: "${DATABASE_URL:?Set DATABASE_URL first}"
OUT="gym_backup_$(date +%Y%m%d_%H%M%S).dump"
pg_dump --format=custom --no-owner --file="$OUT" "$DATABASE_URL"
echo "Backup written to $OUT"
