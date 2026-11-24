# AZMARO Admin

Admin panel for the AZMARO store: products (details, scent notes, collections, visibility),
sizes with selling price / MRP / stock, product photos, and brands.

It is a small Next.js app that talks to the AZMARO API through a same-origin proxy (`/api/*` → `API_URL`),
using the API's admin endpoints and its cookie sign-in. Only accounts with admin access can use it.

## Admin login (local development only)

| | |
|---|---|
| URL | http://localhost:3001 |
| Email (ID) | `admin@azmaro.local` |
| Password | `Azmaro-JGt3qViQpXMj` |

> ⚠️ This account exists only in the **local development database** (`API/mysql-data`). Never reuse this
> password on a live server. For production, create a separate admin with its own strong password:
> `npm run admin:create -- you@yourdomain.com "new strong password"` (run in `API/`). The same command
> resets the password of an existing account.

## Run it

```bash
# 1. API (in ../API) – must be running
npm run db:migrate                     # once, if not done yet
npm run admin:create -- you@example.com "a strong password (12+ chars)" "Your Name"
npm run dev                            # http://localhost:4000

# 2. Admin panel (this folder)
npm install
npm run dev                            # http://localhost:3001
```

`../API/.env` must list the panel in `CORS_ORIGINS` (default: `http://localhost:3000,http://localhost:3001`).
Optional settings: copy `.env.example` to `.env.local` (`API_URL`, `NEXT_PUBLIC_STOREFRONT_URL`).

## Making a product orderable

A size can be added to the bag only when it has a **selling price** and isn't out of stock.
Open the product → *Sizes, prices & stock* → enter the price → **Save**. Leave *Stock qty* blank if you don't track stock.

## Photos

*Upload photos* saves the file into the storefront's `web/public/images/products/` folder (via the API's
`WEB_PUBLIC_DIR`) and attaches it to the product. In development the storefront serves new files right away;
a production storefront (`next start`) only serves files that existed when it was built, so rebuild/redeploy the
storefront – or host images on a CDN and add them by https URL – in production.
