import { Router, type NextFunction, type Request, type Response } from "express";
import { ZodError, z } from "zod";
import { env, integrations } from "../../config/env";
import { db, insert, isDatabaseUnavailable, join, raw, sql, type InventoryRow, type OrderRecord, type ProductVariantRow } from "../../db";
import { authenticate } from "../../middleware/auth";
import { originCheck, rateLimiters } from "../../middleware/security";
import { subscribe } from "../support/support.routes";
import { AppError } from "../../utils/errors";
import { money, round2, sum, toAmount } from "../../utils/money";
import { email as emailSchema, indianPhone, nonEmpty, password as passwordSchema, pin as pinSchema } from "../../validators/common";
import * as authService from "../auth/auth.service";
import { COOKIES, clearAuthCookies, setAccessCookie, setRefreshCookie, signAccessToken } from "../auth/tokens";
import { loadProducts, variantAvailability } from "../catalogue/catalogue.mapper";
import { publishedBrands } from "../catalogue/catalogue.controller";
import { countProducts, findProductCards, findProductIds, PRODUCT_ORDER, publicProductWhere, relatedProducts } from "../catalogue/products.service";
import { scoreProduct, searchTerms } from "../catalogue/search";
import { deliveryFeeFor, evaluateCoupon } from "../checkout/quote.service";
import * as cartService from "../cart/cart.service";
import { rememberCustomerDetails } from "../customers/address-book";
import { loadOrders } from "../orders/order.dto";
import { findOrderForCustomer, placeOrder } from "../orders/order.service";
import { getShippingProvider } from "../../integrations/shipping";
import { getSetting } from "../settings/settings.service";
import { LEGACY_STATUS_LABEL, legacyBrand, legacyEvents, legacyOrder, legacyProduct, legacySummary } from "./legacy.mappers";

/**
 * Legacy compatibility API (unversioned /api/*) used by the current web app.
 * Same request/response shapes as before, now backed by MySQL, real accounts,
 * real orders and the payment / shipping adapters. New clients should use /api/v1.
 * CSRF: protected by the Origin check + SameSite=Lax cookies.
 */
export const legacyRouter = Router();
legacyRouter.use(originCheck);
legacyRouter.use(authenticate);

type Handler = (req: Request, res: Response) => Promise<unknown>;
const h = (fn: Handler) => (req: Request, res: Response, next: NextFunction) => fn(req, res).catch(next);

const allProducts = () => findProductCards(publicProductWhere, PRODUCT_ORDER.catalogue);

legacyRouter.get("/health", h(async (_req, res) => {
  res.json({ ok: true, service: "azmaro-api", products: await countProducts(publicProductWhere), time: new Date().toISOString() });
}));

legacyRouter.get("/status", h(async (_req, res) => {
  const payments = await getSetting("payments");
  res.json({
    mode: env.INTEGRATION_MODE,
    payments: {
      configured: integrations.payments.razorpay,
      // Which methods checkout may offer: online needs a real gateway (or demo mode); COD follows admin settings.
      onlineAvailable: integrations.payments.razorpay || env.INTEGRATION_MODE === "demo",
      onlineMethods: payments.onlineMethods,
      codEnabled: payments.codEnabled,
      codMaxOrderInr: payments.codMaxOrderInr === null ? null : Number(payments.codMaxOrderInr),
    },
    shipping: { configured: integrations.shipping.shiprocket },
    auth: { configured: true },
  });
}));

legacyRouter.get("/products", h(async (req, res) => {
  const q = req.query as Record<string, string | undefined>;
  if (q.featured === "1") {
    const rows = await findProductCards(sql`${publicProductWhere} AND p.isFeatured = 1`, PRODUCT_ORDER["featured-rank"]);
    return res.json({ products: rows.map(legacySummary) });
  }
  let rows = await allProducts();
  if (q.brand) rows = rows.filter((p) => p.brand.slug === q.brand);
  if (q.slugs) {
    const wanted = new Set(q.slugs.split(","));
    rows = rows.filter((p) => wanted.has(p.slug));
  }
  res.json({ products: rows.map(legacySummary) });
}));

legacyRouter.get("/products/slugs", h(async (_req, res) => {
  const rows = await db.many<{ slug: string }>(sql`SELECT p.slug FROM products p JOIN brands b ON b.id = p.brandId WHERE ${publicProductWhere} ORDER BY p.sortOrder ASC`);
  res.json({ slugs: rows.map((r) => r.slug) });
}));

legacyRouter.get("/products/:slug", h(async (req, res) => {
  const [productId] = await findProductIds(sql`p.slug = ${String(req.params.slug)} AND ${publicProductWhere}`);
  const [product] = productId ? await loadProducts([productId], { images: "detail" }) : [];
  if (!product) return res.status(404).json({ ok: false, message: "Product not found." });
  const related = await relatedProducts(product, 4);
  const relatedRows = await loadProducts(related.map((r) => r.id));
  res.json({
    product: legacyProduct(product),
    summary: legacySummary(product),
    related: related.map((r) => legacySummary(relatedRows.find((x) => x.id === r.id)!)),
  });
}));

legacyRouter.get("/brands", h(async (req, res) => {
  const featured = req.query.featured === "1";
  const brands = await publishedBrands({ featured });
  res.json({ brands: brands.map((b) => legacyBrand(b, b.productCount)) });
}));

legacyRouter.get("/brands/:slug", h(async (req, res) => {
  const [brand] = await publishedBrands({ slug: String(req.params.slug) });
  if (!brand) return res.status(404).json({ ok: false, message: "Brand not found." });
  const rows = await findProductCards(sql`${publicProductWhere} AND p.brandId = ${brand.id}`, PRODUCT_ORDER.catalogue);
  res.json({ brand: legacyBrand(brand, brand.productCount), products: rows.map(legacySummary) });
}));

legacyRouter.get("/search", h(async (req, res) => {
  const query = String(req.query.q ?? "").slice(0, 80);
  const limit = Math.min(48, Math.max(1, Number(req.query.limit) || 12));
  if (!query.trim()) {
    const rows = await findProductCards(sql`${publicProductWhere} AND p.isFeatured = 1`, raw("ORDER BY p.featuredRank IS NULL, p.featuredRank ASC"), {
      skip: 0,
      take: Math.min(limit, 6),
    });
    return res.json({ query: "", total: rows.length, results: rows.map(legacySummary) });
  }
  const terms = searchTerms(query);
  const ranked = (await allProducts())
    .map((p) => ({ p, s: scoreProduct(p, terms) }))
    .filter((x) => x.s > 0)
    .sort((a, b) => b.s - a.s || a.p.name.localeCompare(b.p.name));
  res.json({ query, total: ranked.length, results: ranked.slice(0, limit).map((x) => legacySummary(x.p)) });
}));

// ─── Bag / checkout ───

const legacyLines = z.array(z.object({ slug: z.string().max(160), sizeMl: z.number().int().positive(), qty: z.number().int().min(1).max(50) })).max(30);

async function resolveLegacyLines(lines: z.infer<typeof legacyLines>) {
  const rows = lines.length
    ? await db.many<ProductVariantRow & { productSlug: string }>(sql`
        SELECT v.*, p.slug AS productSlug FROM product_variants v JOIN products p ON p.id = v.productId
        WHERE ${join(lines.map((l) => sql`(v.sizeMl = ${l.sizeMl} AND p.slug = ${l.slug})`), " OR ")}`)
    : [];
  const inventory = await db.many<InventoryRow>(sql`SELECT * FROM inventory WHERE variantId IN (${rows.map((v) => v.id)})`);
  const variants = rows.map((v) => ({ ...v, inventory: inventory.find((i) => i.variantId === v.id) ?? null }));
  return lines.map((l) => {
    const v = variants.find((x) => x.productSlug === l.slug && x.sizeMl === l.sizeMl);
    if (!v) throw new AppError(400, "ITEM_UNAVAILABLE", "An item in your bag is no longer available.");
    return { variant: v, qty: l.qty };
  });
}

legacyRouter.post("/shipping/serviceability", rateLimiters.lookups(), h(async (req, res) => {
  const body = z.object({ pin: pinSchema, subtotal: z.number().nonnegative().optional() }).parse(req.body);
  const { defaultWeightGrams } = await getSetting("shipping");
  const result = await getShippingProvider().checkServiceability(body.pin, { cod: false, weightGrams: defaultWeightGrams });
  const fee = await deliveryFeeFor(money(body.subtotal ?? 0));
  res.json({
    status: result.status.toLowerCase(),
    demo: result.isTest,
    message: result.message,
    fee: toAmount(fee.fee),
    estimate: result.estimate,
    courier: result.courier,
    codAvailable: result.codAvailable,
  });
}));

/**
 * Mirror the browser bag to the server (guest cookie or signed-in account) so the
 * admin panel can show cart activity. Unknown sizes are ignored; [] empties the cart.
 */
legacyRouter.post("/cart/sync", h(async (req, res) => {
  const body = z.object({ lines: legacyLines }).parse(req.body);
  if (req.auth) await cartService.mergeGuestCart(req, res, req.auth.userId);
  const owner = cartService.cartOwner(req, res, body.lines.length > 0);
  if (!owner) return res.json({ ok: true, lines: 0 });
  const rows = body.lines.length
    ? await db.many<{ id: string; slug: string; sizeMl: number }>(sql`
        SELECT v.id, p.slug, v.sizeMl FROM product_variants v JOIN products p ON p.id = v.productId
        WHERE ${join(body.lines.map((l) => sql`(v.sizeMl = ${l.sizeMl} AND p.slug = ${l.slug})`), " OR ")}`)
    : [];
  const lines = body.lines.flatMap((l) => {
    const v = rows.find((r) => r.slug === l.slug && r.sizeMl === l.sizeMl);
    return v ? [{ variantId: v.id, quantity: l.qty }] : [];
  });
  await cartService.replaceItems(owner, lines);
  res.json({ ok: true, lines: lines.length });
}));

legacyRouter.post("/discount", h(async (req, res) => {
  const body = z.object({ code: z.string().trim().min(1).max(40), lines: legacyLines }).parse(req.body);
  const lines = await resolveLegacyLines(body.lines);
  const subtotal = round2(sum(lines.filter((l) => variantAvailability(l.variant).isPurchasable).map((l) => money(l.variant.price).times(l.qty))));
  const result = await evaluateCoupon(body.code, subtotal);
  res.json({ valid: result.valid, code: result.code, amount: toAmount(result.discount), message: result.message });
}));

const legacyOrderSchema = z.object({
  email: emailSchema,
  phone: indianPhone,
  paymentMethod: z.enum(["upi", "card", "netbanking", "cod"]),
  discountCode: z.string().trim().max(40).nullable().optional(),
  lines: legacyLines.min(1, "Your bag is empty."),
  address: z.object({
    fullName: nonEmpty("Full name", 120),
    pin: pinSchema,
    addressLine: nonEmpty("Address", 255, 5),
    landmark: z.string().trim().max(120).optional(),
    city: nonEmpty("City", 80),
    state: nonEmpty("State", 80),
  }),
});

legacyRouter.post("/orders", h(async (req, res) => {
  const input = legacyOrderSchema.parse(req.body);
  const lines = await resolveLegacyLines(input.lines);
  const address = {
    label: undefined,
    fullName: input.address.fullName,
    phone: input.phone,
    line1: input.address.addressLine,
    line2: undefined,
    landmark: input.address.landmark || undefined,
    city: input.address.city,
    state: input.address.state,
    pin: input.address.pin,
  };
  const result = await placeOrder({
    lines: lines.map((l) => ({ variantId: l.variant.id, quantity: l.qty })),
    email: req.auth?.email ?? input.email,
    phone: input.phone,
    address,
    paymentMethod: input.paymentMethod.toUpperCase() as "UPI" | "CARD" | "NETBANKING" | "COD",
    couponCode: input.discountCode || null,
    userId: req.auth?.userId ?? null,
  });
  // Signed-in customers: keep their address book and phone up to date (never blocks the order).
  if (req.auth && !result.replayed) {
    await rememberCustomerDetails(req.auth.userId, address).catch((e) => console.error("[legacy-api] could not save address:", e));
  }
  res.status(201).json({ ok: true, order: legacyOrder(result.order), payment: result.payment });
}));

legacyRouter.get("/orders", h(async (req, res) => {
  if (!req.auth) return res.status(401).json({ ok: false, message: "Please sign in." });
  const orders = await loadOrders(
    await db.many<OrderRecord>(sql`SELECT * FROM orders WHERE userId = ${req.auth.userId} ORDER BY createdAt DESC, id DESC LIMIT 50`),
  );
  res.json({ ok: true, orders: orders.map((o) => legacyOrder(o)) });
}));

legacyRouter.post("/orders/track", rateLimiters.forms(), h(async (req, res) => {
  const body = z.object({ orderNumber: z.string().trim().max(20), contact: z.string().trim().max(191) }).parse(req.body);
  if (!body.contact) return res.status(400).json({ ok: false, message: "Please enter the email or phone used at checkout." });
  try {
    const order = await findOrderForCustomer(body.orderNumber.toUpperCase().replace(/^AZM(?!-)/, "AZM-"), { contact: body.contact });
    const shipment = order.shipments[0];
    res.json({
      found: true,
      demo: order.isTest,
      orderNumber: order.orderNumber,
      status: LEGACY_STATUS_LABEL[order.status] ?? order.status,
      courier: shipment?.courier ?? null,
      awb: shipment?.awb ?? null,
      events: legacyEvents(order),
    });
  } catch {
    res.json({
      found: false,
      demo: env.INTEGRATION_MODE === "demo",
      message: "We couldn't find an order with those details. Please check the order number and the email or phone used at checkout.",
    });
  }
}));

// ─── Accounts (real authentication) ───

const sessionUser = (u: { name: string; email: string }) => ({ name: u.name, email: u.email, demo: false });

async function legacyStartSession(req: Request, res: Response, user: NonNullable<Awaited<ReturnType<typeof authService.getUser>>>) {
  const refresh = await authService.createSession(user.id, { userAgent: req.get("user-agent"), ip: req.ip });
  setAccessCookie(res, signAccessToken({ id: user.id, role: user.role.name, tokenVersion: user.tokenVersion }));
  setRefreshCookie(res, refresh);
}

legacyRouter.get("/auth/session", (req, res) => {
  res.json({ user: req.auth ? sessionUser(req.auth) : null });
});

legacyRouter.post("/auth/sign-in", rateLimiters.auth(), h(async (req, res) => {
  const body = z.object({ email: emailSchema, password: z.string().min(1).max(128) }).parse(req.body);
  const user = await authService.verifyCredentials(body.email, body.password);
  await legacyStartSession(req, res, user);
  res.json({ ok: true, user: sessionUser(user) });
}));

legacyRouter.post("/auth/register", rateLimiters.auth(), h(async (req, res) => {
  const body = z.object({ name: nonEmpty("Full name", 120), email: emailSchema, password: passwordSchema }).parse(req.body);
  const user = await authService.register(body);
  await legacyStartSession(req, res, user);
  res.json({ ok: true, user: sessionUser(user) });
}));

legacyRouter.post("/auth/sign-out", h(async (req, res) => {
  await authService.revokeSession((req.cookies as Record<string, string | undefined>)?.[COOKIES.refresh]);
  clearAuthCookies(res);
  res.json({ ok: true });
}));

legacyRouter.post("/auth/reset", rateLimiters.auth(), h(async (req, res) => {
  const body = z.object({ email: emailSchema }).parse(req.body);
  await authService.forgotPassword(body.email);
  res.json({ ok: true, demo: false, message: "If an account exists for that email, a password-reset link has been sent." });
}));

// ─── Support ───

legacyRouter.post("/contact", rateLimiters.forms(), h(async (req, res) => {
  const body = z
    .object({
      name: nonEmpty("Name", 120),
      email: emailSchema,
      phone: z.string().trim().max(20).optional(),
      orderNumber: z.string().trim().max(20).optional(),
      message: nonEmpty("Message", 3000, 10),
    })
    .parse(req.body);
  await insert(db, "contact_messages", { name: body.name, email: body.email, phone: body.phone || null, orderNumber: body.orderNumber || null, message: body.message });
  res.json({ ok: true, demo: false, message: "Thank you – your message has been received. Our team will reply as soon as possible." });
}));

legacyRouter.post("/newsletter", rateLimiters.forms(), h(async (req, res) => {
  const { email } = z.object({ email: emailSchema }).parse(req.body);
  await subscribe(email, "website");
  res.json({ ok: true, demo: false, message: "Thank you – you're on the AZMARO list." });
}));

/** Legacy error format: { ok: false, message }. */
legacyRouter.use((err: unknown, _req: Request, res: Response, next: NextFunction) => {
  void next;
  if (err instanceof ZodError) return res.status(400).json({ ok: false, message: err.issues[0]?.message ?? "Invalid request." });
  if (err instanceof AppError) return res.status(err.status).json({ ok: false, message: err.message });
  const e = err as { type?: string };
  if (e?.type === "entity.parse.failed") return res.status(400).json({ ok: false, message: "Invalid request." });
  if (isDatabaseUnavailable(err)) {
    console.error("[legacy-api] database unreachable –", (err as Error).message);
    return res.status(503).json({ ok: false, message: "Our store is temporarily unavailable. Please try again in a few minutes." });
  }
  console.error("[legacy-api]", err);
  res.status(500).json({ ok: false, message: "Something went wrong. Please try again." });
});

legacyRouter.use((_req, res) => res.status(404).json({ ok: false, message: "Not found." }));
