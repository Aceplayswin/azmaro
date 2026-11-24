# AZMARO – The House of Fragrances

Luxury storefront for AZMARO, a multi-brand Middle Eastern fragrance retailer serving India.

The repository holds two independent apps:

| Folder | What | Stack | Port |
|---|---|---|---|
| `web/` | Storefront UI | Next.js 16 (App Router), React 19, TypeScript, Tailwind CSS 4 | 3000 |
| `Admin/` | Admin panel: products, prices, stock, photos, brands | Next.js 16, React 19, TypeScript, Tailwind CSS 4 | 3001 |
| `API/` | Backend REST API (`/api/v1`): catalogue, cart, wishlist, checkout, orders, payments, shipping, accounts, admin | Node.js, Express 5, TypeScript, MySQL (mysql2) | 4000 |

```
AZMARO/
├── Admin/                   admin panel – see Admin/README.md
├── API/                     backend – see API/README.md
│   ├── src/                 app, config, middleware, routes, modules/<domain>, integrations/{payments,shipping}
│   ├── db/                  migrations/ (SQL), seed.ts, seed-data/ (94 catalogue profiles)
│   ├── tests/ · docs/       integration tests (MySQL) · API.md + openapi.json
│   ├── scripts/ · data/     pricing import, image workbook reconciliation / download
│   └── package.json
├── web/                     frontend
│   ├── app/                 routes – app/(store)/… pages, layout, sitemap, robots
│   ├── components/          layout, navigation, home, products, catalogue, brands, cart,
│   │                        checkout, account, tracking, forms, ui (design system)
│   ├── src/                 config/site.ts, data/ (content, scent families), lib/ (API client,
│   │                        cart, wishlist, filters, validation, SEO), types/ (API contract)
│   ├── public/              images, icons
│   └── package.json
├── reference/               source documents (wireframe, catalogue, visual reference)
├── README.md
└── .gitignore
```

## Running locally

Each app has its own dependencies and environment file. Run them in two terminals:

```bash
# 1 – backend
cd API
npm install
cp .env.example .env          # set DATABASE_URL + JWT secrets (see API/README.md)
npm run db:deploy && npm run db:seed
npm run dev                   # http://localhost:4000/api/v1/health · docs: /api/docs

# 2 – frontend
cd web
npm install
cp .env.example .env.local    # optional – API_URL defaults to http://localhost:4000
npm run dev                   # http://localhost:3000
```

Production: `npm run build && npm start` in each folder. The API compiles to `API/dist`.

### How the two talk

- **Server Components** in `web` fetch catalogue data from the API through `web/src/lib/api/server.ts`.
  Responses are cached for 60 seconds.
- **Browser requests** (search, bag, checkout, accounts, forms) still call relative `/api/...` URLs.
  `web/next.config.ts` rewrites them to `API_URL`, so cookies stay first-party and CORS isn't needed.
  The API also allows direct calls from `CORS_ORIGINS`.
- The web app builds and starts without the API. Content pages such as About and Contact render normally,
  and catalogue pages show a branded "temporarily unavailable" state until the API is reachable.
- Product images are files in `web/public/images`. The API stores only their public paths, and its image
  script downloads into `WEB_PUBLIC_DIR` (default `../web/public`).

### API

The versioned REST API lives under `/api/v1` (Swagger UI at `/api/docs`; integration guide in
[`API/docs/API.md`](API/docs/API.md)). The current web app still uses the unversioned legacy routes
(`/api/products`, `/api/orders`, `/api/auth/*`, …), which keep their original shapes but now run on MySQL with real
accounts, orders and stock.

### Commands

| Folder | Command | What it does |
|---|---|---|
| web | `npm run dev` / `build` / `start` | Next.js dev server / production build / serve |
| web | `npm run lint` · `npm run typecheck` | ESLint · route types + `tsc` |
| API | `npm run dev` / `build` / `start` | Watch mode (tsx) / compile to `dist` / run compiled server |
| API | `npm run typecheck` · `npm run lint` · `npm test` | Types · ESLint · integration tests (real MySQL) |
| API | `npm run db:deploy` · `db:migrate` · `db:seed` | Apply migrations · create migrations · seed catalogue |
| API | `npm run validate:data` | Checks catalogue, pricing and image mapping (use in CI) |
| API | `npm run import:pricing [file.csv]` | Imports verified prices / sizes / stock into MySQL |
| API | `npm run import:images [file.xlsx]` | Maps the image-source workbook → `data/image-sources.json` |
| API | `npm run download:images [--confirm-rights]` | Downloads workbook images → `web/public/images/products` |

## Pages

`/` home · `/shop` · `/middle-eastern` · `/brands` · `/brands/[slug]` · `/product/[slug]` · `/search` ·
`/wishlist` · `/bag` · `/checkout` · `/checkout/confirmation` · `/account` · `/track-order` · `/about` ·
`/contact` (help, FAQs, shipping/returns anchors) · `/privacy` · `/terms` · 404 · `sitemap.xml` · `robots.txt`.

Design tokens (colours, type, buttons, inputs, chips) live in `web/app/globals.css`. Every page uses the same
`ProductCard`, buttons and form controls. Fonts: Cormorant Garamond (editorial) + Manrope (interface).

## Data rules (important)

- **Canonical products** come from `AZMARO_Website_Perfume_Catalogue_Final.pdf` → `API/db/seed-data/catalogue.ts` (94 profiles), seeded into MySQL.
  Display names drop the size suffix and repeated brand prefix; the original is kept as `catalogueName`.
- **Scent impressions**: 67 of the 94 profiles have no verified note pyramid (27 do). They are stored with
  `noteBasis: "editorial-impression"` and the site labels their notes as a "Scent impression", never as ingredients.
- **Scent families** (Oud & Woods, Amber & Gourmand, Musk & Clean, Rose & Floral, Fresh & Aromatic) are discovery
  filters inside the single Middle Eastern collection. AZMARO assigned them from each profile's fragrance-family line.
- **No prices, MRP, stock, ratings, reviews or bestseller data were supplied**, so none are shown. Unpriced products
  display "Price to be confirmed" and cannot be added to the bag. "New arrivals" and "Bestsellers" show an honest
  empty state until those flags exist.
- **Sizes** shown are those printed in the inventory names (e.g. "Khamrah Qahwa 100ml"). Confirm them against the packaging.
- Structured product data (JSON-LD) is emitted only when a product has a verified price, stock status and approved image.

### Adding prices

1. Fill in `API/data/pricing.csv` (`slug,size_ml,price_inr,mrp_inr,sku,stock_status,stock_qty`), or use the admin
   API (`PUT /api/v1/admin/pricing`, `PUT /api/v1/admin/inventory/:variantId`).
2. In `API/`, run `npm run import:pricing`. The storefront picks up the change within 60 seconds.

### Adding product images

1. Copy `AZMARO_Perfume_Image_Sources.xlsx` into `reference/`, then run `npm run import:images` in `API/`.
   Review the detected columns and the unmatched rows it prints.
2. Run `npm run download:images`. Everything downloads as **pending-review** and nothing is published.
3. Once AZMARO confirms commercial permission, run `npm run download:images -- --confirm-rights`.
   Only rows with workbook status **Matched**, an exact catalogue name match and an agreeing brand are approved.
   All other statuses (Review name, Variant check, Brand mismatch…) stay in `web/public/images/products/review/`.
4. Products without an approved image use the branded arch/monogram placeholder. Stand-in bottles are never used.

Campaign, scent-family, brand and editorial photography slots use decorative placeholders. Add approved files
under `web/public/images/…` and set the `image` fields in `web/src/data/scent-families.ts` and
brands via `PATCH /api/v1/admin/brands/:id`.

## Integrations

Payments (Razorpay: UPI, cards, net banking; COD), courier (Shiprocket), email and form forwarding sit behind adapters
in `API/src/integrations/`. Without credentials they run as clearly labelled development adapters: test orders with
payment `NOT_COLLECTED`, no invented delivery estimates or scan events. See the credentials table in
[`API/README.md`](API/README.md#integrations-requiring-credentials). Card, UPI and bank details are never collected
or stored by AZMARO.

## Content awaiting approval

- Contact details: WhatsApp, email, phone, Instagram (`NEXT_PUBLIC_*` in `web/.env.local`)
- Founder brand story (`web/src/data/content.ts → about.story`)
- Shipping, returns, privacy and terms policies (`content.policies`)
- Brand descriptions and artwork (admin API: `/api/v1/admin/brands`)
- Delivery charges, COD limits, cancellation policy, WhatsApp number (`/api/v1/admin/settings`)
- Announcement bar and trust-marker claims (`web/src/config/site.ts`). Disable any that are not yet true.
- Catalogue review notes (see the warnings from `npm run validate:data` in `API/`): Pinaace/Pinnace, Balase/Balas Rose,
  Ana Abiyath/Abiyad, Pacif Aura, "Lattaf" Eclaire Pistache, Amber Oud Gold 120ml.
  Also note that the catalogue classes *Odyssey Dubai Chocolate* as a fresh/aromatic impression, which seems
  unlikely from the name. Worth confirming with a tester.
