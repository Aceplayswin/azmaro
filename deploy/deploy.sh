#!/usr/bin/env bash
# Installs, builds and (re)starts the apps in place in /var/www/azmaro:
#   env files -> npm ci (when package-lock.json changed) + build of API, web, Admin
#   -> database (import / seed when empty, otherwise backup + migrations) -> PM2 -> health checks
# Runs as $DEPLOY_USER:  bash /var/www/azmaro/deploy/deploy.sh
set -euo pipefail
SCRIPT_DIR=$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)
# shellcheck source=config.sh
source "$SCRIPT_DIR/config.sh"

log() { printf '\n\033[1;34m==> %s\033[0m\n' "$*"; }
warn() { printf '\033[1;33mWARN: %s\033[0m\n' "$*" >&2; }
fail() { printf '\033[1;31mERROR: %s\033[0m\n' "$*" >&2; exit 1; }

[ "$(id -un)" = "$DEPLOY_USER" ] || fail "run as $DEPLOY_USER, not $(id -un)"
cd "$APP_DIR"
[ -s API/.env ] || fail "$APP_DIR/API/.env is missing – the workflow writes it from the API_ENV secret"

# No upload-triggered reloads while building; re-enabled however the script ends.
sudo systemctl stop azmaro-images.path 2>/dev/null || true
trap 'sudo systemctl start azmaro-images.path 2>/dev/null || true' EXIT

# ── Env files for the Next.js apps ────────────────────────────────────
install -m 644 deploy/env/web.env web/.env.production
install -m 644 deploy/env/admin.env Admin/.env.production

# ── Install + build ───────────────────────────────────────────────────
export NEXT_TELEMETRY_DISABLED=1 npm_config_fund=false npm_config_audit=false npm_config_update_notifier=false
for app in API web Admin; do
  hash=$(sha256sum "$app/package-lock.json" | cut -d' ' -f1)
  if [ -d "$app/node_modules" ] && [ "$(cat "$app/node_modules/.lock-hash" 2>/dev/null)" = "$hash" ]; then
    log "npm ci – $app (dependencies unchanged, skipped)"
  else
    log "npm ci – $app"
    (cd "$app" && npm ci --loglevel=error)
    echo "$hash" > "$app/node_modules/.lock-hash"
  fi
done
for app in API web Admin; do
  log "Build – $app"
  (cd "$app" && NODE_OPTIONS="--max-old-space-size=$BUILD_MEMORY_MB" npm run build)
done

# ── Database ──────────────────────────────────────────────────────────
DB_NAME=$(python3 deploy/lib/dbconfig.py API/.env name)
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
  DUMP=$(find deploy/database -maxdepth 1 -type f \( -name '*.sql' -o -name '*.sql.gz' \) 2>/dev/null | sort | head -1 || true)
  if [ -n "$DUMP" ]; then
    log "Database '$DB_NAME' is empty – importing $DUMP"
    import_dump "$DUMP"
  else
    log "Database '$DB_NAME' is empty and deploy/database has no dump – creating schema + seeding the catalogue"
    (cd API && npm run db:deploy && npm run db:seed)
    (cd API && npm run import:pricing) || warn "pricing import failed – set prices in the admin panel"
  fi
else
  log "Backing up '$DB_NAME' ($TABLES tables) to $BACKUP_DIR"
  sudo mysqldump --single-transaction --no-tablespaces --default-character-set=utf8mb4 "$DB_NAME" \
    | gzip > "$BACKUP_DIR/$DB_NAME-$(date -u +%Y%m%d%H%M%S).sql.gz"
  ls -1t "$BACKUP_DIR/"*.sql.gz | tail -n +$((DB_BACKUPS_KEEP + 1)) | xargs -r rm -f
fi

log "Migrations"
(cd API && npm run db:deploy)

# ── Start / reload with PM2 ───────────────────────────────────────────
log "PM2"
pm2 startOrReload deploy/ecosystem.config.cjs --update-env

wait_for() {
  local name=$1 url=$2 err=""
  # Apps are still booting right after a PM2 reload, so early "connection refused"
  # errors are expected – only show curl's last error if the service never comes up.
  for _ in $(seq 1 45); do
    if err=$(curl -fsS -o /dev/null --max-time 5 "$url" 2>&1); then echo "  ok   $name"; return 0; fi
    sleep 2
  done
  echo "  FAIL $name ($url): $err"
  return 1
}

log "Health checks"
healthy=1
wait_for "API"        "http://127.0.0.1:$API_PORT/api/v1/health" || healthy=0
wait_for "Storefront" "http://127.0.0.1:$WEB_PORT/"              || healthy=0
wait_for "Admin"      "http://127.0.0.1:$ADMIN_PORT/"            || healthy=0
if [ "$healthy" -ne 1 ]; then
  pm2 logs --nostream --lines 60 || true
  fail "health checks failed"
fi
pm2 save >/dev/null

if ! pm2 describe pm2-logrotate >/dev/null 2>&1; then
  { pm2 install pm2-logrotate && pm2 set pm2-logrotate:max_size 10M && pm2 set pm2-logrotate:retain 7; } >/dev/null \
    || warn "could not install pm2-logrotate"
fi

log "Deployed"
pm2 ls
