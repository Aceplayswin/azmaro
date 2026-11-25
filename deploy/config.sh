# Shared settings for the server scripts (sourced by provision.sh, deploy.sh, nginx-ssl.sh).
# Change a value here, push, and the next deploy applies it.

APP_DIR=/var/www/azmaro          # the repo as-is: API/, Admin/, web/, deploy/
DEPLOY_USER=ubuntu               # owns the app and runs PM2
BACKUP_DIR=/var/backups/azmaro   # DB dump taken before each deploy's migrations

WEB_DOMAIN=azmaro.dollara.tech
ADMIN_DOMAIN=admin.azmaro.dollara.tech
API_DOMAIN=api.azmaro.dollara.tech

# Local ports (bound to 127.0.0.1 – only nginx is public).
# Keep in sync with ecosystem.config.cjs and nginx/azmaro.conf.
WEB_PORT=3000
ADMIN_PORT=3001
API_PORT=4000

NODE_MAJOR=24                    # Node.js LTS line installed from NodeSource
SWAP_SIZE=3G                     # the instance has ~2 GB RAM; Next.js builds need headroom
BUILD_MEMORY_MB=1536             # V8 heap limit for builds
DB_BACKUPS_KEEP=10
