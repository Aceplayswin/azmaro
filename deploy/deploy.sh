#!/usr/bin/env bash
# Builds a new release from $APP_DIR/source and switches traffic to it.
#   1. copy source -> releases/<id>, add env files and product photos
#   2. npm ci + build API, web, Admin
#   3. database: import deploy/database/*.sql (or migrate + seed) when empty,
#      otherwise back up and apply pending migrations
#   4. point `current` at the release, reload PM2, health-check, roll back on failure
# Runs as $DEPLOY_USER:  bash deploy/deploy.sh <git-sha>
set -euo pipefail
SCRIPT_DIR=$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)
# shellcheck source=config.sh
source "$SCRIPT_DIR/config.sh"

log() { printf '\n\033[1;34m==> %s\033[0m\n' "$*"; }
warn() { printf '\033[1;33mWARN: %s\033[0m\n' "$*" >&2; }
fail() { printf '\033[1;31mERROR: %s\033[0m\n' "$*" >&2; exit 1; }

[ "$(id -un)" = "$DEPLOY_USER" ] || fail "run as $DEPLOY_USER, not $(id -un)"

SHA=${1:-manual}
RELEASE_ID="$(date -u +%Y%m%d%H%M%S)-${SHA:0:7}"
RELEASES="$APP_DIR/releases"
SHARED="$APP_DIR/shared"
CURRENT="$APP_DIR/current"
RELEASE="$RELEASES/$RELEASE_ID"
API_ENV="$SHARED/env/api.env"
PREVIOUS=$(readlink -e "$CURRENT" 2>/dev/null || true)   # empty on the very first deploy
LIVE=0   # 1 once traffic is on the new release

[ -s "$API_ENV" ] || fail "$API_ENV is missing – the workflow uploads it from the API_ENV secret"

on_exit() {
  local code=$?
  if [ "$code" -ne 0 ] && [ "$LIVE" -eq 0 ] && [ -d "$RELEASE" ]; then
    warn "deploy failed – removing unfinished release $RELEASE_ID (the site keeps running the previous release)"
    rm -rf "$RELEASE"
  fi
  sudo systemctl start azmaro-images.path 2>/dev/null || true
}
trap on_exit EXIT
sudo systemctl stop azmaro-images.path 2>/dev/null || true   # no upload reloads mid-deploy

switch_to() {
  ln -sfn "$1" "$APP_DIR/current.tmp"
  mv -Tf "$APP_DIR/current.tmp" "$CURRENT"
}

# ── 1. Release directory ──────────────────────────────────────────────
log "Release $RELEASE_ID"
mkdir -p "$RELEASES"
rsync -a --exclude node_modules/ "$APP_DIR/source/" "$RELEASE/"

install -m 600 "$API_ENV" "$RELEASE/API/.env"
install -m 644 "$RELEASE/deploy/env/web.env" "$RELEASE/web/.env.production"
install -m 644 "$RELEASE/deploy/env/admin.env" "$RELEASE/Admin/.env.production"

# Product photos: repo images -> shared (where admin uploads live), then all of them -> release.
mkdir -p "$SHARED/public/images/products"
rsync -a "$RELEASE/web/public/images/" "$SHARED/public/images/"
rsync -a "$SHARED/public/images/" "$RELEASE/web/public/images/"

# ── 2. Install + build ────────────────────────────────────────────────
export NEXT_TELEMETRY_DISABLED=1 npm_config_fund=false npm_config_audit=false npm_config_update_notifier=false
for app in API web Admin; do
  log "npm ci – $app"
  (cd "$RELEASE/$app" && npm ci --loglevel=error)
done
for app in API web Admin; do
  log "Build – $app"
  (cd "$RELEASE/$app" && NODE_OPTIONS="--max-old-space-size=$BUILD_MEMORY_MB" npm run build)
done

# ── 3. Database ───────────────────────────────────────────────────────
DB_NAME=$(python3 "$RELEASE/deploy/lib/dbconfig.py" "$API_ENV" name)
TABLES=$(sudo mysql -N -B -e "SELECT COUNT(*) FROM information_schema.tables WHERE table_schema = '$DB_NAME'")

import_dump() {
  local src=$1 tmp
  tmp=$(mktemp)
  if [[ $src == *.gz ]]; then gzip -dc "$src" > "$tmp"; else cp "$src" "$tmp"; fi
  # A dump redirected with Windows PowerShell's '>' is UTF-16 – convert it; drop a UTF-8 BOM.
  if [ "$(head -c2 "$tmp" | od -An -tx1 | tr -d ' ')" = "fffe" ]; then
    iconv -f UTF-16 -t UTF-8 "$tmp" > "$tmp.utf8" && mv "$tmp.utf8" "$tmp"
  fi
  sed -i '1s/^\xEF\xBB\xBF//' "$tmp"
  sudo mysql --default-character-set=utf8mb4 "$DB_NAME" < "$tmp"
  rm -f "$tmp"
}

if [ "$TABLES" -eq 0 ]; then
  DUMP=$(find "$RELEASE/deploy/database" -maxdepth 1 -type f \( -name '*.sql' -o -name '*.sql.gz' \) 2>/dev/null | sort | head -1 || true)
  if [ -n "$DUMP" ]; then
    log "Database '$DB_NAME' is empty – importing $(basename "$DUMP")"
    import_dump "$DUMP"
  else
    log "Database '$DB_NAME' is empty and deploy/database has no dump – creating schema + seeding the catalogue"
    (cd "$RELEASE/API" && npm run db:deploy && npm run db:seed)
    (cd "$RELEASE/API" && npm run import:pricing) || warn "pricing import failed – set prices in the admin panel"
  fi
else
  log "Backing up '$DB_NAME' ($TABLES tables)"
  sudo mysqldump --single-transaction --no-tablespaces --default-character-set=utf8mb4 "$DB_NAME" \
    | gzip > "$SHARED/backups/$DB_NAME-$RELEASE_ID.sql.gz"
  ls -1t "$SHARED/backups/"*.sql.gz | tail -n +$((DB_BACKUPS_KEEP + 1)) | xargs -r rm -f
fi

log "Migrations"
(cd "$RELEASE/API" && npm run db:deploy)

# ── 4. Go live ────────────────────────────────────────────────────────
log "Switching to $RELEASE_ID"
switch_to "$RELEASE"
LIVE=1
pm2 startOrReload "$RELEASE/deploy/ecosystem.config.cjs" --update-env || warn "pm2 reported an error"

wait_for() {
  local name=$1 url=$2
  for _ in $(seq 1 45); do
    if curl -fsS -o /dev/null --max-time 5 "$url"; then echo "  ok   $name"; return 0; fi
    sleep 2
  done
  echo "  FAIL $name ($url)"
  return 1
}

log "Health checks"
healthy=1
wait_for "API"        "http://127.0.0.1:$API_PORT/api/v1/health" || healthy=0
wait_for "Storefront" "http://127.0.0.1:$WEB_PORT/"              || healthy=0
wait_for "Admin"      "http://127.0.0.1:$ADMIN_PORT/"            || healthy=0

if [ "$healthy" -ne 1 ]; then
  pm2 logs --nostream --lines 40 || true
  if [ -n "$PREVIOUS" ] && [ -d "$PREVIOUS" ]; then
    warn "rolling back to $(basename "$PREVIOUS")"
    switch_to "$PREVIOUS"
    pm2 startOrReload "$PREVIOUS/deploy/ecosystem.config.cjs" --update-env || true
    pm2 save >/dev/null || true
    LIVE=0   # lets on_exit delete the broken release
  fi
  fail "health checks failed"
fi
pm2 save >/dev/null

if ! pm2 describe pm2-logrotate >/dev/null 2>&1; then
  { pm2 install pm2-logrotate && pm2 set pm2-logrotate:max_size 10M && pm2 set pm2-logrotate:retain 7; } >/dev/null \
    || warn "could not install pm2-logrotate"
fi

# ── Cleanup: keep `current` + the newest (KEEP_RELEASES - 1) others ───
live=$(readlink -f "$CURRENT")
kept=1
for dir in $(ls -1d "$RELEASES"/*/ 2>/dev/null | sed 's:/$::' | sort -r); do
  [ "$dir" = "$live" ] && continue
  if [ "$kept" -lt "$KEEP_RELEASES" ]; then kept=$((kept + 1)); else rm -rf "$dir"; fi
done

log "Deployed $RELEASE_ID"
pm2 ls
