#!/usr/bin/env bash
# Run by azmaro-images.service when the admin panel uploads a product photo:
# copies shared uploads into the live release and reloads the storefront so Next.js serves them.
set -euo pipefail
source "$(dirname "$(readlink -f "$0")")/config.sh"

rsync -a "$APP_DIR/shared/public/images/" "$APP_DIR/current/web/public/images/"
pm2 reload azmaro-web >/dev/null
echo "published new product photos"
