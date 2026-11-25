#!/usr/bin/env bash
# 1. Installs deploy/nginx/azmaro.conf as /etc/nginx/sites-available/azmaro.conf (+ sites-enabled link).
# 2. Runs certbot (nginx plugin) for each domain, which adds HTTPS + the HTTP -> HTTPS redirect to that file.
#    Existing certificates are re-installed without contacting Let's Encrypt; new ones are requested only
#    when the domain's DNS already points at this server.
# Runs as root. CERTBOT_EMAIL (optional) receives Let's Encrypt expiry notices.
set -euo pipefail
SCRIPT_DIR=$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)
# shellcheck source=config.sh
source "$SCRIPT_DIR/config.sh"
[ "$(id -u)" -eq 0 ] || exec sudo bash "$0" "$@"

log() { printf '\n\033[1;34m==> %s\033[0m\n' "$*"; }
warn() { printf '\033[1;33mWARN: %s\033[0m\n' "$*" >&2; }

SRC="$SCRIPT_DIR/nginx/azmaro.conf"
SITE=/etc/nginx/sites-available/azmaro.conf
DOMAINS=("$WEB_DOMAIN" "$ADMIN_DOMAIN" "$API_DOMAIN")

# ── nginx site ────────────────────────────────────────────────────────
log "nginx: $SITE"
[ -f "$SITE" ] && cp "$SITE" "$SITE.bak"
cp "$SRC" "$SITE"
ln -sfn "$SITE" /etc/nginx/sites-enabled/azmaro.conf
rm -f /etc/nginx/sites-enabled/default
if ! nginx -t; then
  warn "nginx config test failed – restoring the previous config"
  if [ -f "$SITE.bak" ]; then mv "$SITE.bak" "$SITE"; else rm -f "$SITE" /etc/nginx/sites-enabled/azmaro.conf; fi
  exit 1
fi
rm -f "$SITE.bak"
systemctl reload-or-restart nginx
# leftovers from the earlier generated setup
rm -f /etc/nginx/snippets/azmaro-proxy.conf /etc/nginx/snippets/azmaro-ssl.conf \
      /etc/letsencrypt/renewal-hooks/deploy/reload-nginx.sh

# ── SSL (certbot) ─────────────────────────────────────────────────────
log "SSL certificates (certbot)"
ip=$(curl -fsS --max-time 10 https://checkip.amazonaws.com 2>/dev/null | tr -d '[:space:]' || true)
if [ -n "${CERTBOT_EMAIL:-}" ]; then email_args=(--email "$CERTBOT_EMAIL"); else email_args=(--register-unsafely-without-email); fi

for d in "${DOMAINS[@]}"; do
  args=(--nginx --non-interactive --agree-tos --redirect --cert-name "$d" -d "$d" "${email_args[@]}")
  renewal="/etc/letsencrypt/renewal/$d.conf"

  if [ -f "$renewal" ] && ! grep -q '^authenticator = webroot' "$renewal"; then
    args+=(--keep-until-expiring)          # have a certificate: just put it back into the config
  else
    resolved=$(getent ahostsv4 "$d" 2>/dev/null | awk '{print $1}' | sort -u | tr '\n' ' ' || true)
    if [ -z "$ip" ] || ! grep -qwF -- "$ip" <<<"$resolved"; then
      warn "$d resolves to [${resolved:-nothing}], this server is ${ip:-unknown} – add an A record for $d -> ${ip:-this server}. Skipping SSL for now."
      continue
    fi
    # A certificate from the earlier webroot setup is re-issued once through the nginx plugin.
    [ -f "$renewal" ] && args+=(--force-renewal) || args+=(--keep-until-expiring)
  fi

  certbot "${args[@]}" || warn "certbot failed for $d (are ports 80 and 443 open in the AWS security group?)"
done

# The webroot folder of the earlier setup is no longer used once no certificate renews through it.
grep -qs '^authenticator = webroot' /etc/letsencrypt/renewal/*.conf || rm -rf /var/www/letsencrypt
systemctl enable --now certbot.timer >/dev/null 2>&1 || true   # auto-renewal

log "Live URLs"
for d in "${DOMAINS[@]}"; do
  if grep -q "/etc/letsencrypt/live/$d/" "$SITE"; then echo "  https://$d"; else echo "  http://$d   (no SSL yet – check DNS)"; fi
done
