#!/usr/bin/env bash
# Run by azmaro-images.service after the admin panel uploads a product photo into
# web/public/images/products. Next.js only serves public/ files that existed when it
# started, so reload the storefront to publish the new photo.
set -euo pipefail
pm2 reload azmaro-web >/dev/null
echo "storefront reloaded – new product photos are live"
