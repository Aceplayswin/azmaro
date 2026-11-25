# Shared settings for the server scripts (sourced by provision.sh, deploy.sh, nginx-ssl.sh).
# Change a value here, push, and the next deploy applies it.

APP_DIR=/var/www/azmaro          # source/, releases/, current -> releases/<id>, shared/
DEPLOY_USER=ubuntu               # owns the app and runs PM2

WEB_DOMAIN=azmaro.dollara.tech
ADMIN_DOMAIN=admin.azmaro.dollara.tech
API_DOMAIN=api.azmaro.dollara.tech

# Local ports (bound to 127.0.0.1 – only nginx is public). Keep in sync with ecosystem.config.cjs.
WEB_PORT=3000
ADMIN_PORT=3001
API_PORT=4000

NODE_MAJOR=24                    # Node.js LTS line installed from NodeSource
SWAP_SIZE=3G                     # the instance has ~2 GB RAM; Next.js builds need headroom
BUILD_MEMORY_MB=1536             # V8 heap limit for builds
KEEP_RELEASES=2                  # current + 1 previous (for rollback)
DB_BACKUPS_KEEP=10               # gzipped dumps taken before each deploy's migrations
