#!/usr/bin/env bash
# Server setup – runs as root on every deploy and skips whatever is already done:
#   swap · Node.js · PM2 (+ boot service) · nginx · MySQL · certbot (nginx plugin)
#   MySQL remote access · database + user from the DB_* values in API/.env · upload watcher
set -euo pipefail
SCRIPT_DIR=$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)
# shellcheck source=config.sh
source "$SCRIPT_DIR/config.sh"
[ "$(id -u)" -eq 0 ] || exec sudo bash "$0" "$@"

export DEBIAN_FRONTEND=noninteractive NEEDRESTART_MODE=a
log() { printf '\n\033[1;34m==> %s\033[0m\n' "$*"; }
API_ENV="$APP_DIR/API/.env"
DEPLOY_HOME=$(getent passwd "$DEPLOY_USER" | cut -d: -f6)

# ── Swap ──────────────────────────────────────────────────────────────
log "Swap"
if [ -z "$(swapon --noheadings --show=NAME)" ]; then
  fallocate -l "$SWAP_SIZE" /swapfile
  chmod 600 /swapfile
  mkswap /swapfile >/dev/null
  swapon /swapfile
  grep -q '^/swapfile ' /etc/fstab || echo '/swapfile none swap sw 0 0' >> /etc/fstab
  echo 'vm.swappiness=10' > /etc/sysctl.d/99-azmaro-swap.conf
  sysctl -q -p /etc/sysctl.d/99-azmaro-swap.conf
  echo "created $SWAP_SIZE swap"
else
  echo "swap already enabled"
fi

# ── System packages ───────────────────────────────────────────────────
log "Packages: nginx, MySQL, certbot"
PACKAGES=(nginx mysql-server certbot python3-certbot-nginx rsync curl ca-certificates gnupg python3)
missing=()
for p in "${PACKAGES[@]}"; do
  dpkg-query -W -f='${Status}' "$p" 2>/dev/null | grep -q "install ok installed" || missing+=("$p")
done
if [ ${#missing[@]} -gt 0 ]; then
  apt-get update -q
  apt-get install -y -q "${missing[@]}"
else
  echo "all packages present"
fi

# ── Node.js + npm ─────────────────────────────────────────────────────
log "Node.js $NODE_MAJOR"
if ! command -v node >/dev/null || [ "$(node -p 'process.versions.node.split(".")[0]')" != "$NODE_MAJOR" ]; then
  curl -fsSL "https://deb.nodesource.com/setup_${NODE_MAJOR}.x" -o /tmp/nodesource_setup.sh
  bash /tmp/nodesource_setup.sh
  apt-get install -y -q nodejs
  rm -f /tmp/nodesource_setup.sh
fi
echo "node $(node -v) · npm $(npm -v)"

# ── PM2 ───────────────────────────────────────────────────────────────
log "PM2"
command -v pm2 >/dev/null || npm install -g pm2@latest --no-fund --no-audit
if [ ! -f "/etc/systemd/system/pm2-$DEPLOY_USER.service" ]; then
  # Resurrects the saved process list on boot.
  pm2 startup systemd -u "$DEPLOY_USER" --hp "$DEPLOY_HOME" >/dev/null
  pm2 kill >/dev/null 2>&1 || true   # stop the root daemon `pm2 startup` spawned
fi
echo "pm2 $(pm2 -v)"

# ── MySQL: remote access + small-instance tuning ──────────────────────
log "MySQL configuration"
CNF=/etc/mysql/mysql.conf.d/zz-azmaro.cnf
desired=$(cat <<'EOF'
[mysqld]
# Remote access: listen on every interface. Port 3306 must also be opened in the
# AWS security group – restrict it to your own IP address.
bind-address = 0.0.0.0
loose-mysqlx-bind-address = 127.0.0.1
# Sized for a ~2 GB instance that also runs three Node apps.
innodb_buffer_pool_size = 256M
performance_schema = OFF
max_connections = 80
character-set-server = utf8mb4
collation-server = utf8mb4_0900_ai_ci
EOF
)
systemctl enable --now mysql >/dev/null
if [ ! -f "$CNF" ] || [ "$(cat "$CNF")" != "$desired" ]; then
  printf '%s\n' "$desired" > "$CNF"
  systemctl restart mysql
  echo "updated $CNF and restarted MySQL"
else
  echo "configuration unchanged"
fi

log "MySQL database + user (DB_USER / DB_PASSWORD / DB_NAME from API/.env)"
[ -s "$API_ENV" ] || { echo "Missing $API_ENV – the workflow writes it from the API_ENV secret." >&2; exit 1; }
python3 "$SCRIPT_DIR/lib/dbconfig.py" "$API_ENV" sql | mysql --protocol=socket -uroot
echo "database '$(python3 "$SCRIPT_DIR/lib/dbconfig.py" "$API_ENV" name)' and its user are ready (localhost + remote)"

# ── Directories ───────────────────────────────────────────────────────
install -d -o "$DEPLOY_USER" -g "$DEPLOY_USER" -m 755 "$APP_DIR" "$APP_DIR/web/public/images/products"
install -d -o "$DEPLOY_USER" -g "$DEPLOY_USER" -m 700 "$BACKUP_DIR"
systemctl enable --now nginx >/dev/null

# ── Admin photo uploads → storefront ──────────────────────────────────
# Next.js only serves public/ files that existed when it started, so reload the storefront
# after an upload (debounced by 20 s so a batch of uploads causes one reload).
log "Upload watcher"
cat > /etc/systemd/system/azmaro-images.service <<EOF
[Unit]
Description=Publish AZMARO admin photo uploads to the storefront

[Service]
Type=oneshot
User=$DEPLOY_USER
Environment=PM2_HOME=$DEPLOY_HOME/.pm2
Environment=PATH=/usr/local/bin:/usr/bin:/bin
ExecStartPre=/bin/sleep 20
ExecStart=/bin/bash $APP_DIR/deploy/sync-images.sh
EOF
cat > /etc/systemd/system/azmaro-images.path <<EOF
[Unit]
Description=Watch AZMARO product photo uploads

[Path]
PathChanged=$APP_DIR/web/public/images/products
Unit=azmaro-images.service

[Install]
WantedBy=multi-user.target
EOF
systemctl daemon-reload
systemctl enable azmaro-images.path >/dev/null 2>&1

log "Provisioning complete"
printf '  %s\n' "$(nginx -v 2>&1)" "$(mysql --version)" "$(certbot --version 2>&1)"
