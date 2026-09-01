#!/usr/bin/env bash
# db-push-safe.sh — backup-before-migrate habit, one command.
#
# Snapshots the linked Supabase project's schema + data BEFORE applying
# pending migrations, so any migration can be rolled back:
#
#   npm run db:push          # backup, then supabase db push
#   npm run db:push -- --dry # backup + show pending migrations, push skipped
#
# Restore (worst case):
#   psql "$DATABASE_URL" -f backups/<timestamp>/schema.sql
#   psql "$DATABASE_URL" -f backups/<timestamp>/data.sql
#
# Requirements: supabase CLI logged in and project linked
# (supabase link --project-ref uynoykcratwbcdzmsxfw)

set -euo pipefail

cd "$(dirname "$0")/.."

STAMP="$(date +%Y-%m-%d_%H%M%S)"
DEST="backups/${STAMP}"
mkdir -p "$DEST"

echo "==> [1/3] Dumping schema to ${DEST}/schema.sql"
supabase db dump --linked -f "${DEST}/schema.sql"

echo "==> [2/3] Dumping data to ${DEST}/data.sql (this can take a while)"
supabase db dump --linked --data-only -f "${DEST}/data.sql"

echo "==> Backup complete:"
du -h "${DEST}"/*.sql

# Keep only the 5 most recent backups to cap disk usage.
ls -1dt backups/*/ 2>/dev/null | tail -n +6 | xargs -r rm -rf

if [[ "${1:-}" == "--dry" ]]; then
  echo "==> [3/3] DRY RUN — pending migrations:"
  supabase db push --dry-run
  echo "==> Push skipped. Run 'npm run db:push' to apply."
  exit 0
fi

echo "==> [3/3] Applying migrations (supabase db push)"
supabase db push

echo "==> Done. Rollback snapshot: ${DEST}/"
