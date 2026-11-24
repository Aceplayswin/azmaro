# AZMARO API – Frontend Integration Guide

Base URL: `http://localhost:4000/api/v1` (production: `https://<api-host>/api/v1`).
Interactive docs: **`/api/docs`** (Swagger UI). Machine-readable spec: **`/api/v1/openapi.json`**
(also exported to [`docs/openapi.json`](./openapi.json) via `npm run docs:openapi`).

> The current Next.js app in `web/` talks to the **legacy** unversioned routes (`/api/products`,
> `/api/orders`, …), which keep their original response shapes and now run on the real database (see
> [Legacy routes](#legacy-routes-used-by-the-current-web-app)). New frontend work should use `/api/v1`.

---

## 1. Conventions

### Response envelope

Every `/api/v1` response has the same shape:

```json
{ "success": true, "message": "OK", "data": { … }, "meta": { "pagination": { "page": 1, "pageSize": 24, "total": 94, "totalPages": 4 } } }
```

Errors:

```json
{ "success": false, "message": "Enter a valid email address.", "data": null,
  "error": { "code": "VALIDATION_ERROR", "details": [{ "path": "email", "message": "Enter a valid email address." }] } }
```

| HTTP | Typical `error.code` | Meaning |
|---|---|---|
| 400 | `BAD_REQUEST`, `INVALID_JSON`, `TOKEN_INVALID`, `INVALID_SIGNATURE` | Malformed request |
| 401 | `UNAUTHORIZED`, `INVALID_CREDENTIALS`, `SESSION_EXPIRED`, `SESSION_REUSED` | Not signed in / bad credentials |
| 403 | `FORBIDDEN`, `CSRF_TOKEN_INVALID`, `ORIGIN_NOT_ALLOWED`, `ACCOUNT_DISABLED` | Not allowed |
| 404 | `NOT_FOUND`, `ROUTE_NOT_FOUND` | Missing resource (also used to avoid leaking other customers' orders) |
| 409 | `EMAIL_TAKEN`, `NOT_PURCHASABLE`, `INSUFFICIENT_STOCK`, `NOT_CANCELLABLE`, `DUPLICATE` | Conflicts with current state |
| 413 | `PAYLOAD_TOO_LARGE` | Body > 100 kB |
| 422 | `VALIDATION_ERROR`, `COUPON_INVALID`, `CART_EMPTY`, `INVALID_TRANSITION`, `COD_UNAVAILABLE` | Valid JSON, rejected by business rules |
| 429 | `RATE_LIMITED` | Too many requests (see `RateLimit` headers) |
| 502/503 | `PAYMENT_PROVIDER_ERROR`, `COURIER_NOT_CONFIGURED`, `DATABASE_UNAVAILABLE` | Upstream / integration unavailable |
| 500 | `INTERNAL_ERROR` | Unexpected – details hidden in production |

### Money, prices and unverified data

* Amounts are JSON numbers in **INR with 2 decimals** (computed server-side with decimal arithmetic).
* **`price`, `mrp` and `stockStatus` are `null` until AZMARO confirms them.** Show "Price to be confirmed";
  `isPurchasable` is `false` and the cart refuses such items (`409 NOT_PURCHASABLE`).
* `noteBasis: "EDITORIAL_IMPRESSION"` means the notes are a scent direction, not verified ingredients –
  display `notesLabel`.
* Order totals are always `subtotal`, `discount`, `delivery`, `total`. There is **no tax row**.
  `delivery: null` means "delivery charge not configured / to be confirmed".
* `isTest: true` marks orders or results produced by development adapters (no real payment / courier).

### Pagination

List endpoints accept `page` (default 1) and `pageSize` (default 24, max 100) and return `meta.pagination`.

---

## 2. Authentication & security

* **Sessions** use HTTP-only cookies: `azm_at` (15-minute JWT access token) and `azm_rt` (30-day refresh
  token, path `/api`, rotated on `POST /auth/refresh`; re-use of a rotated token revokes every session).
  If the access cookie expires, the API silently issues a new one from a valid refresh cookie.
* **CSRF (double-submit):** call `GET /auth/csrf` once, then send its `csrfToken` as the
  **`X-CSRF-Token`** header on every `POST/PUT/PATCH/DELETE`. Login / register / password change return
  a fresh `csrfToken` – use it from then on. Requests with `Authorization: Bearer <access token>` are exempt.
* **CORS** allows only origins in `CORS_ORIGINS` (with credentials). Recommended: proxy `/api/*` through
  Next.js (`web/next.config.ts` already does this) so cookies are first-party.
* **Roles:** `CUSTOMER`, `STAFF` (operations, no settings / refunds / roles), `ADMIN` (`*`). Admin routes
  require `admin:access` plus a specific permission (listed on each route in Swagger).
* **Rate limits:** global, auth (login/register/reset) and form (contact, newsletter, tracking) limiters.
* **Guest cart / wishlist:** opaque `azm_cart` / `azm_wl` cookies; merged into the account on sign-in.

### Example (browser, via the Next.js proxy)

```ts
async function api<T>(path: string, init: RequestInit = {}): Promise<T> {
  const res = await fetch(`/api/v1${path}`, {
    ...init,
    credentials: "include",
    headers: { "Content-Type": "application/json", "X-CSRF-Token": csrfToken, ...init.headers },
  });
  const body = await res.json();
  if (!body.success) throw Object.assign(new Error(body.message), { code: body.error?.code, details: body.error?.details, status: res.status });
  return body.data as T;
}

const { csrfToken } = (await (await fetch("/api/v1/auth/csrf", { credentials: "include" })).json()).data;
const { user, csrfToken: fresh } = await api("/auth/login", { method: "POST", body: JSON.stringify({ email, password }) });
```

### curl

```bash
curl -c jar -b jar http://localhost:4000/api/v1/auth/csrf          # → data.csrfToken
curl -c jar -b jar -H "X-CSRF-Token: $TOKEN" -H "Content-Type: application/json" \
     -d '{"email":"a@b.com","password":"Secret123"}' http://localhost:4000/api/v1/auth/login
```

---

## 3. Endpoints

Legend – **Auth**: `Public`, `Optional` (works for guests and customers), `Customer`, `Admin (permission)`.
All mutating requests need `X-CSRF-Token` unless noted.

### Auth – `/auth`

| Method | Path | Auth | Body | Returns |
|---|---|---|---|---|
| GET | `/auth/csrf` | Public | – | `{ csrfToken }` |
| POST | `/auth/register` | Public | `{ name, email, password, phone? }` (password ≥ 8, letter + digit) | `201 { user, csrfToken }` + cookies |
| POST | `/auth/login` | Public | `{ email, password }` | `{ user, csrfToken }` + cookies |
| POST | `/auth/refresh` | Public (refresh cookie) | – | `{ user }` |
| POST | `/auth/logout` · `/auth/logout-all` | Optional · Customer | – | `null` |
| GET | `/auth/me` | Customer | – | user |
| POST | `/auth/verify-email` | Public | `{ token }` | `null` |
| POST | `/auth/resend-verification` | Customer | – | `null` |
| POST | `/auth/forgot-password` | Public | `{ email }` (same response for unknown emails) | `null` |
| POST | `/auth/reset-password` | Public | `{ token, password }` | `null` (all sessions revoked) |
| POST | `/auth/change-password` | Customer | `{ currentPassword, newPassword }` | `{ csrfToken }` |

`user` = `{ id, name, email, phone, emailVerified, role, isAdmin, permissions, createdAt }`.
Email links point to `${APP_URL}/account/verify-email?token=…` and `${APP_URL}/account/reset-password?token=…`
(those web pages still need to be built).

### Catalogue

| Method | Path | Notes |
|---|---|---|
| GET | `/products` | Query: `q`, `brand` (slugs, CSV), `family` (scent-family slugs, CSV), `gender` (`men,women,unisex`), `concentration` (`edp,extrait,edt,attar`), `size` (ml, CSV), `minPrice`, `maxPrice`, `featured`, `purchasable`, `tag` (`new`/`bestseller`), `sort` (`featured`, `relevance`, `name-asc`, `name-desc`, `brand`, `price-asc`, `price-desc`, `newest`), `page`, `pageSize` |
| GET | `/products/facets` | Brands, families, genders, concentrations, sizes, price range – from live data |
| GET | `/products/:slug` | `{ product, related }` – product detail incl. notes, `notesLabel`, variants, approved images |
| GET | `/brands` (`?featured=true`) · `/brands/:slug` · `/brands/:slug/products` | Only brands with published products |
| GET | `/categories` (`?type=SCENT_FAMILY|COLLECTION`) · `/categories/:slug` | Scent families are filters within the Middle Eastern collection |

Product card: `{ id, slug, name, brand{slug,name}, brandLabel, scentFamilies[], noteBasis, gender, concentration, price, mrp, priceStatus, availableSizes[], variants[{ id, sizeMl, sku, price, mrp, stockStatus, isPurchasable, unavailableReason }], isPurchasable, isFeatured, isNew, isBestseller, image{url,alt}|null }`.

### Cart – `/cart` (Optional)

| Method | Path | Body |
|---|---|---|
| GET | `/cart` | – |
| POST | `/cart/items` | `{ variantId }` or `{ productSlug, sizeMl }`, `quantity` (default 1) |
| PATCH | `/cart/items/:variantId` | `{ quantity }` |
| DELETE | `/cart/items/:variantId` · `/cart` | – |
| POST / DELETE | `/cart/coupon` | `{ code }` / – |
| PUT | `/cart/delivery-pin` | `{ pin }` → `{ cart, serviceability }` |

Cart = `{ id, items[{ variantId, slug, name, brandName, sizeMl, quantity, unitPrice, lineTotal, isPurchasable, unavailableReason, image }], itemCount, couponCode, coupon{code,valid,message}, deliveryPin, totals{ subtotal, discount, delivery, deliveryStatus, total, currency, note }, hasUnavailableItems }`.

### Wishlist – `/wishlist` (Optional)

`GET /wishlist` · `POST /wishlist/items { productSlug }` · `DELETE /wishlist/items/:productSlug` ·
`POST /wishlist/items/:productSlug/move-to-cart { sizeMl? }` · `POST /wishlist/move-all-to-cart` → `{ wishlist, moved[], skipped[{slug,reason}] }`.

### Checkout & orders

| Method | Path | Auth | Body / notes |
|---|---|---|---|
| GET | `/checkout/options` | Optional | Payment methods (availability, `isTest`), delivery rules |
| POST | `/checkout` | Optional | `{ email, phone, address{ fullName, phone, line1, line2?, landmark?, city, state, pin } \| addressId, paymentMethod: UPI\|CARD\|NETBANKING\|COD, couponCode?, note?, saveAddress? }`. **Send `Idempotency-Key: <unique per attempt>`** – a retry returns the same order (`replayed: true`). Returns `201 { order, payment }` |
| GET | `/orders` | Customer | Paginated history |
| GET | `/orders/:orderNumber` | Customer (owner) | Order |
| POST | `/orders/lookup` | Public | `{ orderNumber, contact }` (email or phone used at checkout) – guest confirmation |
| POST | `/orders/:orderNumber/cancel` | Optional | `{ reason?, contact? }` – allowed per the configured policy, before shipment |

`payment` = `{ provider, status, isTest, message, clientAction }`. When `clientAction.type === "razorpay_checkout"`,
open Razorpay Checkout with `keyId`, `providerOrderId`, `amountPaise`, `prefill`; on success call
`POST /payments/razorpay/verify`. Without a provider (`INTEGRATION_MODE=demo`) the order is a test order with
`paymentStatus: NOT_COLLECTED` – **it is never shown as paid**.

### Payments – `/payments`

| Method | Path | Notes |
|---|---|---|
| POST | `/payments/razorpay/verify` | `{ orderNumber, razorpay_order_id, razorpay_payment_id, razorpay_signature }` – HMAC verified |
| POST | `/payments/retry` | `{ orderNumber, contact? }` + `Idempotency-Key` – new attempt for an unpaid order |
| POST | `/payments/webhooks/razorpay` | Provider → API. No CSRF; **`X-Razorpay-Signature`** (HMAC-SHA256 of the raw body) verified; replayed `X-Razorpay-Event-Id`s ignored; amount checked; statuses never downgrade |

### Shipping & tracking

| Method | Path | Notes |
|---|---|---|
| POST | `/shipping/serviceability` | `{ pin, cod? }` → `status SERVICEABLE\|UNSERVICEABLE\|UNAVAILABLE`, `courier`, `estimate`, `courierRate` – values come only from the courier |
| POST | `/shipping/webhooks/courier` | Courier → API with **`X-Courier-Token`**. Body `{ awb, status, description?, location?, occurredAt?, eventId? }` |
| POST | `/tracking/lookup` | `{ orderNumber, contact }` → `{ orderStatus, shipments[{ courier, awb, status, events[] }], timeline[] }` |
| GET | `/tracking/orders/:orderNumber` | Customer (owner) |

### Customers – `/customers/me` (Customer)

`GET/PATCH /customers/me { name?, phone? }` · `GET/POST /customers/me/addresses` · `PATCH/DELETE /customers/me/addresses/:id`.

### Support

`POST /contact { name, email, phone?, orderNumber?, message }` · `POST /newsletter/subscribe { email }` ·
`POST /newsletter/unsubscribe { token }` · `GET /faqs` · `GET /config/public` (support contacts incl. WhatsApp URL,
integration modes). `GET /health` – liveness + DB connectivity.

### Admin – `/admin/*` (Admin; permission per route)

| Area | Endpoints |
|---|---|
| Dashboard | `GET /admin/dashboard` |
| Products | `GET/POST /admin/products`, `GET/PATCH/DELETE /admin/products/:id`, `POST /admin/products/:id/variants`, `PATCH/DELETE /admin/variants/:id` |
| Pricing | `PUT /admin/pricing { items: [{ variantId \| productSlug+sizeMl, price, mrp? }] }` (null withdraws a price) |
| Inventory | `GET /admin/inventory`, `PUT /admin/inventory/:variantId { quantity\|null, stockStatus?, lowStockAt? }` |
| Images | `POST /admin/products/:id/images`, `PATCH/DELETE /admin/images/:id` (only `APPROVED` images are public) |
| Brands / categories | `GET/POST /admin/brands`, `PATCH/DELETE /admin/brands/:id`, same for `/admin/categories` |
| Orders | `GET /admin/orders`, `GET /admin/orders/:id`, `PATCH /admin/orders/:id/status`, `POST /admin/orders/:id/refund`, `POST /admin/orders/maintenance/release-stale` |
| Shipments | `POST /admin/orders/:id/shipments` (courier API, or `{ courier, awb }` manual), `PATCH /admin/shipments/:id`, `POST /admin/shipments/:id/events`, `POST /admin/shipments/:id/refresh` |
| Customers | `GET /admin/customers`, `GET/PATCH /admin/customers/:id { isActive?, role? }` |
| Coupons | `GET/POST /admin/coupons`, `PATCH/DELETE /admin/coupons/:id` |
| Support | `GET/PATCH /admin/contact-messages`, `GET /admin/newsletter-subscribers?format=json\|csv`, `GET/POST/PATCH/DELETE /admin/faqs` |
| Settings | `GET /admin/settings`, `PUT /admin/settings/:key` (`shipping`, `payments`, `orders`, `support`), `GET /admin/integrations` |
| Audit | `GET /admin/audit-log` |

Full request schemas for every endpoint are in Swagger.

---

## 4. Legacy routes used by the current web app

Mounted at `/api/*` (disable with `LEGACY_API_ENABLED=false` once the web app moves to v1). They keep the exact
shapes in `web/src/types/*.ts` and return `{ ok: false, message }` on errors. CSRF protection: Origin check +
`SameSite=Lax` cookies.

`GET /api/health` · `GET /api/status` · `GET /api/products` (`?featured=1`, `?brand=`, `?slugs=`) · `GET /api/products/slugs` ·
`GET /api/products/:slug` · `GET /api/brands` (`?featured=1`) · `GET /api/brands/:slug` · `GET /api/search` ·
`POST /api/shipping/serviceability` · `POST /api/discount` · `POST /api/orders` · `GET /api/orders` ·
`POST /api/orders/track` · `GET /api/auth/session` · `POST /api/auth/{sign-in,register,sign-out,reset}` ·
`POST /api/contact` · `POST /api/newsletter`.

They now create **real accounts, real orders and real stock reservations** in MySQL.

---

## 5. Order & payment status reference

* `OrderStatus`: `PENDING_PAYMENT → PLACED → CONFIRMED → PROCESSING → SHIPPED → DELIVERED`, plus `CANCELLED`, `RETURNED`.
* `PaymentStatus`: `NOT_COLLECTED` (development adapter), `PENDING`, `AUTHORIZED`, `PAID`, `FAILED`, `COD_PENDING`,
  `REFUND_PENDING`, `REFUNDED`, `CANCELLED`.
* `ShipmentStatus`: `PENDING`, `BOOKED`, `PICKED_UP`, `IN_TRANSIT`, `OUT_FOR_DELIVERY`, `DELIVERED`, `RETURN_TO_ORIGIN`,
  `CANCELLED`, `EXCEPTION`. Courier pickup moves the order to `SHIPPED`; delivery moves it to `DELIVERED` and settles COD.
