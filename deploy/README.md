# Production deployment (CI/CD)

Every push to `main` runs [`.github/workflows/deploy.yml`](../.github/workflows/deploy.yml) against the EC2 server
`35.154.146.177` (Ubuntu, user `ubuntu`). The first run turns a fresh instance into a working server. Later runs
deploy the new code. Every step is idempotent. You can also run it by hand: **Actions → Deploy → Run workflow**.

| Domain | App | Port |
|---|---|---|
| https://azmaro.dollara.tech | storefront (`web/`) | 3000 |
| https://admin.azmaro.dollara.tech | admin panel (`Admin/`) | 3001 |
| https://api.azmaro.dollara.tech | API (`API/`), Swagger at `/api/docs` | 4000 |

## One-time setup

1. **DNS:** create **A records** pointing to `35.154.146.177` for `azmaro`, `admin.azmaro` and `api.azmaro`.
   SSL is issued on the first deploy after DNS points here.
2. **AWS security group (inbound):** 22, 80 and 443 from anywhere. For remote MySQL, open 3306 **only to your IP**.
3. **GitHub → Settings → Secrets and variables → Actions:**
   - Secret `SSH_PRIVATE_KEY`: the contents of `Azmaro.pem`
   - Secret `API_ENV`: the contents of `API/.env.production` (git-ignored, never commit it)
   - Variable `CERTBOT_EMAIL` (optional): email for Let's Encrypt expiry notices
4. **Database to import (optional):** put a dump at `deploy/database/azmaro.sql` (or `.sql.gz`). It is imported
   **only when the server database is empty**. To dump the local dev database (`npm run db:start` in `API/` first):
   ```powershell
   mkdir deploy\database -Force
   & "C:\Program Files\MySQL\MySQL Server 9.7\bin\mysqldump.exe" -h127.0.0.1 -P3307 -uazmaro_app -p `
     --single-transaction --no-tablespaces --set-gtid-purged=OFF --default-character-set=utf8mb4 `
     --result-file=deploy\database\azmaro.sql azmaro
   ```
   With no dump, the pipeline creates the schema, seeds the catalogue and imports `API/data/pricing.csv`.
   In that case set `SEED_ADMIN_EMAIL` and `SEED_ADMIN_PASSWORD` in `API_ENV` so an admin login exists.
5. Push to `main`.

## Server layout

The repo is deployed as-is:

```
/var/www/azmaro/
├── API/      .env (from the API_ENV secret), dist/, node_modules/   → PM2 "azmaro-api"
├── Admin/    .env.production (from deploy/env/admin.env), .next/    → PM2 "azmaro-admin"
├── web/      .env.production (from deploy/env/web.env), .next/      → PM2 "azmaro-web"
│             public/images/products/ also holds admin photo uploads
└── deploy/   the scripts below

/etc/nginx/sites-available/azmaro.conf   ← deploy/nginx/azmaro.conf, plus the SSL parts certbot adds
/var/backups/azmaro/                     ← DB dump before each deploy's migrations (last 10)
```

## What a deploy does

| Step | Script | Runs as |
|---|---|---|
| rsync the repo to `/var/www/azmaro` (node_modules, builds, `.env` files and uploads are kept). Write `API/.env` from `API_ENV` | workflow | – |
| Swap, Node.js 24, npm, PM2 + boot service, nginx, MySQL, certbot. MySQL listens on `0.0.0.0` (remote access). DB + user (`localhost` and `%`) from `DB_USER` / `DB_PASSWORD` / `DB_NAME` | [`provision.sh`](provision.sh) | root |
| `npm ci` (only when `package-lock.json` changed) and `npm run build` in API, web and Admin. DB import or seed when empty, else backup + migrations. `pm2 startOrReload`, health checks | [`deploy.sh`](deploy.sh) | ubuntu |
| Copy [`nginx/azmaro.conf`](nginx/azmaro.conf) → `/etc/nginx/sites-available/azmaro.conf`, enable it, then `certbot --nginx --redirect` per domain (auto-renews) | [`nginx-ssl.sh`](nginx-ssl.sh) | root |

The storefront and admin panel are briefly unavailable while `npm run build` runs on each deploy.

Settings (domains, ports, Node version, swap) are in [`config.sh`](config.sh). Public settings for the storefront
and admin panel are in [`env/web.env`](env/web.env) and [`env/admin.env`](env/admin.env). To change nginx, edit
[`nginx/azmaro.conf`](nginx/azmaro.conf), not the server copy, which is replaced on every deploy.

## Day-to-day

```bash
ssh -i Azmaro.pem ubuntu@35.154.146.177
pm2 ls                              # azmaro-api, azmaro-web, azmaro-admin
pm2 logs azmaro-api --lines 100
pm2 restart azmaro-web
sudo nginx -t && sudo systemctl reload nginx
sudo certbot certificates           # SSL status
```

Remote MySQL: host `35.154.146.177`, port `3306`, plus `DB_USER`, `DB_PASSWORD` and `DB_NAME` from `API_ENV`.
