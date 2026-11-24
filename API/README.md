# AZMARO API

Production-oriented REST backend for the AZMARO fragrance storefront.

**Stack:** Node.js ≥ 20.12 · Express 5 · TypeScript (strict) · MySQL 8+/9 via mysql2 (hand-written, parameterised SQL) ·
Zod validation · JWT access tokens + rotating refresh sessions in HTTP-only cookies · bcrypt (bcryptjs) ·
Helmet · express-rate-limit · OpenAPI 3 / Swagger UI · Vitest + Supertest.

* API: `http://localhost:4000/api/v1` · Swagger UI: `/api/docs` · spec: `/api/v1/openapi.json`
* Frontend integration guide: [`docs/API.md`](docs/API.md) · exported spec: [`docs/openapi.json`](docs/openapi.json)

## Folder structure

```
API/
├── src/
│   ├── app.ts / server.ts          Express app (security middleware, /api/v1, legacy /api) / entry point
│   ├── config/                     env.ts (Zod-validated env), roles.ts (RBAC permissions)
│   ├── middleware/                 auth (JWT + sliding refresh), security (CSRF, origin check, rate limits), error handler
│   ├── routes/                     router.ts (route + OpenAPI registration), index.ts (v1 assembly), health
│   ├── modules/                    one folder per domain – routes, controllers/services, schemas
│   │   ├── auth/                   register, login, refresh rotation, logout, email verification, reset/change password
│   │   ├── catalogue/              products, search, filters, facets, brands, categories
│   │   ├── cart/ · wishlist/       guest + customer carts / wishlists, merge on sign-in
│   │   ├── checkout/               quote engine (subtotal − discount + delivery = total), checkout
│   │   ├── orders/                 order creation (transactional), history, lookup, cancellation, status transitions
│   │   ├── payments/               payment orchestration, Razorpay verify, signed idempotent webhooks, refunds
│   │   ├── shipping/               serviceability, shipments/AWB, courier webhooks, tracking
│   │   ├── customers/ · support/   profile + addresses · contact, FAQs, newsletter, public config
│   │   ├── settings/               admin-editable business settings (delivery charges, COD, policy, WhatsApp)
│   │   ├── admin/                  catalogue, pricing, inventory, orders, customers, coupons, support, settings, dashboard, audit
│   │   └── legacy/                 compatibility layer for the current web app (/api/*)
│   ├── integrations/               payments/ (Razorpay, COD, development), shipping/ (Shiprocket, development), messaging/
│   ├── db/                         mysql2 pool + transactions (client.ts), `sql` template builder (sql.ts), row types + enums (types.ts)
│   └── validators/ · utils/ · types/ · docs/
├── db/
│   ├── migrations/                 numbered SQL files (0001_init.sql …) – 30 tables, DECIMAL money, FKs, indexes, unique constraints
│   ├── seed.ts                     idempotent seed from the AZMARO catalogue
│   └── seed-data/                  94 catalogue profiles, brands, scent families, FAQs, merchandising
├── scripts/                        migrate.ts, pricing import, image-workbook reconciliation, image download, data validation, OpenAPI export
├── tests/                          integration tests (real MySQL)
├── docs/                           API.md, openapi.json
├── data/                           pricing.csv (input) + script working files
├── tsconfig*.json · eslint.config.mjs · vitest.config.mts
└── .env.example · .env.test.example
```

## Database setup (MySQL)

### Quick start – private local database (development)

```bash
npm run db:start     # first run: creates API/.env + .env.test (random secrets), API/mysql-data, DB + user
npm run db:deploy && npm run db:seed
npm run dev
npm run db:stop      # / db:status
```

`db:start` runs a **separate** `mysqld` on `127.0.0.1:3307` with its data in `API/mysql-data` (git-ignored), using the
installed MySQL server binaries (`MYSQL_BIN` to override). It never touches an existing MySQL service. Start it again
after a reboot. For production, use a managed/real MySQL server as below.

### Your own MySQL server

1. Create a database and a least-privilege application user (run as a MySQL admin):

   ```sql
   CREATE DATABASE azmaro CHARACTER SET utf8mb4 COLLATE utf8mb4_0900_ai_ci;
   CREATE USER 'azmaro_app'@'localhost' IDENTIFIED BY '<strong password>';
   GRANT ALL PRIVILEGES ON azmaro.* TO 'azmaro_app'@'localhost';
   ```

2. `cp .env.example .env`, then set `DATABASE_URL`, `JWT_ACCESS_SECRET`, `JWT_REFRESH_SECRET`
   (and `SEED_ADMIN_EMAIL` / `SEED_ADMIN_PASSWORD` for the first admin).

3. Apply migrations and seed:

   ```bash
   npm install
   npm run db:migrate       # apply pending migrations (db:deploy is an alias)
   npm run db:seed          # 94 products, 15 brands, 6 categories, roles, FAQs, settings, optional admin
   ```

   `npm run db:migrate:status` lists applied / pending files. To change the schema, add the next numbered file to
   `db/migrations/` (e.g. `0003_add_gift_notes.sql`) and update the matching row type in `src/db/types.ts`. Each file
   runs once and is recorded in the `schema_migrations` table in MySQL.

### Writing queries

All database access goes through `src/db`: `db.many / db.one / db.run` for single statements, `transaction(async (tx) => …)`
for atomic work, and `insert / update` helpers that skip `undefined` fields. Values are always interpolated through the
`sql` tag, which turns them into `?` placeholders:

```ts
const order = await db.one<OrderRecord>(sql`SELECT * FROM orders WHERE orderNumber = ${orderNumber}`);
await db.run(sql`UPDATE inventory SET quantity = quantity - ${qty} WHERE id = ${id} AND quantity >= ${qty}`);
```

BOOLEAN columns come back as `boolean`, DECIMAL as `Decimal` (decimal.js – never a float), DATETIME as UTC `Date` and
JSON as parsed values. `updatedAt` columns are maintained by MySQL.

## Local development

```bash
npm run dev               # http://localhost:4000 (tsx watch)
npm run build && npm start
npm run typecheck · npm run lint · npm test
npm run docs:openapi      # regenerate docs/openapi.json
```

The web app (`../web`) proxies `/api/*` to `API_URL` (default `http://localhost:4000`), so run both.

## Catalogue data rules

* **Canonical products = the 94 catalogue profiles** (`db/seed-data/catalogue.ts`). The seed is idempotent and
  never overwrites admin-managed prices, stock, images, flags or settings.
* **Prices, MRP and stock are `NULL` until approved.** Set them via `PUT /api/v1/admin/pricing`,
  `PUT /api/v1/admin/inventory/:variantId`, or `npm run import:pricing` (CSV:
  `slug,size_ml,price_inr,mrp_inr,sku,stock_status,stock_qty`). Unpriced variants can't be added to the cart.
* Only 13 products have a size in their inventory name, so only those have a variant after seeding; the pricing
  import (or admin API) creates variants with sizes as they are confirmed.
* Editorial scent impressions (67 of 94 profiles) are flagged `EDITORIAL_IMPRESSION` and labelled as such.
* No ratings, reviews, bestseller ranks or delivery promises exist anywhere in the data model.

### Product photography

The supplied image kit (`AZMARO/image source/` + its `image_sources.json`, 98 rows) is imported with:

```bash
npm run import:local-images -- "../image source" "<path>/image_sources.json"
npm run import:local-images -- "../image source" "<path>/image_sources.json" --approve coco,alpha   # publish held rows
```

It maps rows to the 94 catalogue products (4 duplicate rows skipped), checks each file's image signature, copies it to
`web/public/images/products/<slug>.<ext>` and regenerates `db/seed-data/product-images.ts`; `npm run db:seed` loads
that into `product_images`. Current state: **72 photos approved** (sourcing status Matched or spelling-only differences),
**7 held for review** in `images/products/review/` and hidden (ameerat-al-arab-red-lt, ajwad-pink, island-bliss,
faris-al-arab, alpha, hooke-azure, coco), **15 products without a photo** (branded placeholder shown). Re-seeding only
adds missing image rows – it never changes an image an admin has edited.

### Image-source workbook (94 profiles vs 98 records)

```bash
npm run import:images -- "../reference/AZMARO_Perfume_Image_Sources.xlsx"   # map rows → products + reconciliation report
npm run download:images                                                      # download; all PENDING_REVIEW
npm run download:images -- --confirm-rights                                  # approve eligible "Matched" rows
```

Workbook rows never create products. `data/image-reconciliation.json` lists products with several rows (duplicates /
variants), products with no source and unmatched rows. Only workbook status **Matched** + exact name match +
agreeing brand can be approved, and only once usage rights are confirmed. Images land in `web/public/images/products`.
This workbook route is an alternative to the local image kit above (it downloads from the source URLs).

## Security

bcrypt password hashing · Zod validation on every input · parameterised SQL via the `sql` tag (no user input is ever concatenated into SQL) ·
HTTP-only `SameSite=Lax` cookies (`Secure` enforced in production) · refresh-token rotation with reuse detection ·
token versioning (logout-everywhere, password change, deactivation) · double-submit CSRF tokens + Origin check ·
CORS restricted to `CORS_ORIGINS` · Helmet headers · global / auth / form rate limits · 100 kB body limit ·
HMAC-verified, de-duplicated payment webhooks · token-authenticated courier webhooks · RBAC with per-route permissions ·
audit log for admin actions · no secrets in code (env validated at startup; production refuses dev secrets) ·
PII only via authenticated customer/admin endpoints.

## Tests

`npm test` runs 74 integration tests against a **real MySQL database** from `TEST_DATABASE_URL` (copy
`.env.test.example` → `.env.test`). Global setup **drops and recreates** that database (the name must end in `_test`),
applies migrations and seeds the catalogue. Areas covered: database connectivity, OpenAPI document, error envelope, CSRF,
origin check, security headers, registration/login/logout, refresh rotation and reuse detection, email verification,
password reset/change, RBAC (anonymous, customer, staff, admin, deactivation), product search/filters/sort/facets, brands,
categories, cart decimal maths, coupons (percent/flat/min/max/usage limit), delivery charges, stock limits, guest-cart and
wishlist merge, wishlist moves, checkout validation, COD and online orders, idempotency, atomic stock decrement,
order lookup and history, cancellation (restock + coupon release), status transitions, Razorpay order creation (network
mocked), webhook signature / replay / amount / monotonic status, checkout signature verification, refund flagging,
serviceability, manual shipments, courier webhooks, tracking, COD settlement, support, newsletter CSV, admin catalogue
CRUD, image approval, and the legacy routes used by `web/`.

## Integrations requiring credentials

| Integration | Status without credentials | To go live |
|---|---|---|
| **Razorpay** (UPI, cards, net banking) | Development adapter: test orders, `NOT_COLLECTED`, never marked paid | `PAYMENT_PROVIDER=razorpay`, `RAZORPAY_KEY_ID/SECRET`, `RAZORPAY_WEBHOOK_SECRET`; configure webhook `/api/v1/payments/webhooks/razorpay`; test end-to-end in Razorpay test mode |
| **Shiprocket** (serviceability, AWB, tracking) | `UNAVAILABLE` serviceability, manual courier + AWB booking, staff-recorded events | `SHIPPING_PROVIDER=shiprocket`, `SHIPROCKET_*`; test with a real account |
| Courier status webhooks | Rejected (401) | `COURIER_WEBHOOK_SECRET` |
| Transactional email (verify / reset / order) | Kept in a development outbox – nothing sent | `EMAIL_WEBHOOK_URL` (email service or automation endpoint) |
| Contact / newsletter forwarding | Stored in MySQL only | `CONTACT_WEBHOOK_URL`, `NEWSLETTER_WEBHOOK_URL` |
| WhatsApp / support contacts | `null` (hidden) | `PUT /api/v1/admin/settings/support` |
| Delivery charges | `null` → "to be confirmed" | `PUT /api/v1/admin/settings/shipping` |

The Razorpay and Shiprocket adapters are implemented against their documented APIs but have **not been exercised
against live accounts** – no real payment or shipment has been processed.
