# Production deployment (CI/CD)

Every push to `main` runs [`.github/workflows/deploy.yml`](../.github/workflows/deploy.yml) against the EC2 server
`35.154.146.177` (Ubuntu, user `ubuntu`). The first run turns a fresh instance into a working server. Later runs
release the new code. Every step is idempotent. You can also run it by hand: **Actions → Deploy → Run workflow**.

| Domain | App | Local port |
|---|---|---|
| https://azmaro.dollara.tech | storefront (`web/`) | 3000 |
| https://admin.azmaro.dollara.tech | admin panel (`Admin/`) | 3001 |
| https://api.azmaro.dollara.tech | API (`API/`), Swagger at `/api/docs` | 4000 |

## One-time setup

1. **DNS:** at the registrar (Namecheap), create **A records** pointing to `35.154.146.177`:
   `azmaro`, `admin.azmaro` and `api.azmaro`. `azmaro` is currently a CNAME to `www.dollara.tech`
   (another server), so replace it. SSL is issued automatically on the first deploy after DNS points here.
2. **AWS security group (inbound):** 22 (SSH), 80 and 443 (web) from anywhere. For remote MySQL, open 3306
   **only to your own IP**.
3. **GitHub → Settings → Secrets and variables → Actions:**
   - Secret `SSH_PRIVATE_KEY`: the full contents of `Azmaro.pem`
   - Secret `API_ENV`: the full contents of `API/.env.production` (git-ignored, never commit it)
   - Variable `CERTBOT_EMAIL` (optional): email for Let's Encrypt expiry notices
4. **Database to import (optional):** put a dump at `deploy/database/azmaro.sql` (or `.sql.gz`). It is imported
   **only when the server database is empty**, so it never overwrites live data. To dump the local dev database
   (`npm run db:start` in `API/` first):
   ```powershell
   mkdir deploy\database -Force
   & "C:\Program Files\MySQL\MySQL Server 9.7\bin\mysqldump.exe" -h127.0.0.1 -P3307 -uazmaro_app -p `
     --single-transaction --no-tablespaces --set-gtid-purged=OFF --default-character-set=utf8mb4 `
     --result-file=deploy\database\azmaro.sql azmaro
   ```
   The dump contains customer accounts and orders, so committing it puts them in git history.
   With no dump, the pipeline creates the schema, seeds the 94-product catalogue and imports `API/data/pricing.csv`.
   In that case set `SEED_ADMIN_EMAIL` and `SEED_ADMIN_PASSWORD` in `API_ENV` so an admin login exists.
5. Push to `main`.

## What a deploy does

| Step | Script | Runs as |
|---|---|---|
| Upload `API_ENV` → `/var/www/azmaro/shared/env/api.env`, rsync code → `/var/www/azmaro/source` | workflow | – |
| Swap (3 GB), Node.js 24, npm, PM2 + boot service, nginx, MySQL, certbot. MySQL listens on `0.0.0.0` (remote access). DB + user (`localhost` and `%`) created from `DB_USER` / `DB_PASSWORD` / `DB_NAME` | [`provision.sh`](provision.sh) | root |
| New release dir, env files, `npm ci` + build of API / web / Admin, DB import or seed (empty DB) or backup + migrations, switch `current`, `pm2 reload`, health checks, **automatic rollback** on failure | [`deploy.sh`](deploy.sh) | ubuntu |
| nginx sites for the three domains, Let's Encrypt certificates (webroot, auto-renew), HTTP → HTTPS redirect | [`nginx-ssl.sh`](nginx-ssl.sh) | root |

Server layout:

```
/var/www/azmaro/
├── source/                 latest code from GitHub
├── releases/<time>-<sha>/  built releases (current + 1 previous)
├── current -> releases/…   what PM2 runs
└── shared/
    ├── env/api.env         API secrets (from the API_ENV secret)
    ├── public/images/      product photos incl. admin uploads (survive deploys)
    └── backups/            DB dump taken before each deploy's migrations (last 10)
```

Settings (domains, ports, Node version, swap) are in [`config.sh`](config.sh). Public settings for the storefront
and admin panel are in [`env/web.env`](env/web.env) and [`env/admin.env`](env/admin.env).

## Day-to-day

```bash
ssh -i Azmaro.pem ubuntu@35.154.146.177
pm2 ls                                   # azmaro-api, azmaro-web, azmaro-admin
pm2 logs azmaro-api --lines 100
pm2 restart azmaro-web
ls /var/www/azmaro/releases              # roll back by hand:
ln -sfn /var/www/azmaro/releases/<id> /var/www/azmaro/current && pm2 reload all
sudo certbot certificates                # SSL status
```

Remote MySQL: host `35.154.146.177`, port `3306`, plus `DB_USER`, `DB_PASSWORD` and `DB_NAME` from `API_ENV`.
Changing `DB_PASSWORD` in `API_ENV` updates the MySQL user on the next deploy.
