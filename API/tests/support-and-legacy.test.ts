import supertest from "supertest";
import { beforeAll, describe, expect, it } from "vitest";
import type { BrandRow, NewsletterSubscriberRow, ProductRow } from "../src/db";
import { adminClient, client, countRows, findRow, getApp, priceProduct, sql, uniqueEmail } from "./helpers";

beforeAll(async () => {
  await priceProduct("hawas-gold-digger", 100, "1800.00");
});

describe("customer support", () => {
  it("validates and stores contact messages", async () => {
    const c = await client();
    const bad = await c.post("/api/v1/contact", { name: "", email: "nope", message: "hi" });
    expect(bad.status).toBe(422);
    expect(bad.body.error.details.map((d: { path: string }) => d.path)).toEqual(expect.arrayContaining(["name", "email", "message"]));
    const ok = await c.post("/api/v1/contact", { name: "Asha", email: "asha@example.com", message: "Is Khamrah Qahwa available in 50 ml?" });
    expect(ok.status).toBe(201);
    const admin = await adminClient();
    const inbox = await admin.get("/api/v1/admin/contact-messages?status=NEW");
    expect(inbox.body.data.some((m: { email: string }) => m.email === "asha@example.com")).toBe(true);
    expect(JSON.stringify(inbox.body)).not.toContain("ipHash");
  });

  it("subscribes to the newsletter idempotently and exports CSV for admins", async () => {
    const c = await client();
    const email = uniqueEmail("news");
    expect((await c.post("/api/v1/newsletter/subscribe", { email })).status).toBe(200);
    expect((await c.post("/api/v1/newsletter/subscribe", { email })).status).toBe(200);
    expect(await countRows("newsletter_subscribers", sql`email = ${email}`)).toBe(1);
    const admin = await adminClient();
    const csv = await admin.get("/api/v1/admin/newsletter-subscribers?format=csv");
    expect(csv.headers["content-type"]).toMatch(/text\/csv/);
    expect(csv.text).toContain(email);
    const sub = await findRow<NewsletterSubscriberRow>("newsletter_subscribers", sql`email = ${email}`);
    expect((await c.post("/api/v1/newsletter/unsubscribe", { token: sub.unsubscribeToken })).status).toBe(200);
  });

  it("serves FAQs and public support configuration", async () => {
    const api = supertest(await getApp());
    expect((await api.get("/api/v1/faqs")).body.data).toHaveLength(5);
    const cfg = await api.get("/api/v1/config/public");
    expect(cfg.body.data.support).toMatchObject({ whatsappNumber: null, whatsappUrl: null });
    const admin = await adminClient();
    await admin.put("/api/v1/admin/settings/support", { whatsappNumber: "919800000000" });
    expect((await api.get("/api/v1/config/public")).body.data.support.whatsappUrl).toBe("https://wa.me/919800000000");
    await admin.put("/api/v1/admin/settings/support", { whatsappNumber: null });
    expect((await admin.put("/api/v1/admin/settings/support", { whatsappNumber: "abc" })).status).toBe(422);
  });

  it("writes an audit log for admin changes", async () => {
    const admin = await adminClient();
    await admin.put("/api/v1/admin/settings/orders", { maxQuantityPerLine: 10 });
    const log = await admin.get("/api/v1/admin/audit-log?entity=setting");
    expect(log.body.data[0]).toMatchObject({ action: "settings.update", entity: "setting" });
  });
});

describe("admin catalogue management", () => {
  it("sets verified prices in bulk and keeps minPrice in sync", async () => {
    const admin = await adminClient();
    const res = await admin.put("/api/v1/admin/pricing", { items: [{ productSlug: "khamrah-qahwa", sizeMl: 100, price: 1499, mrp: 1699 }] });
    expect(res.status).toBe(200);
    const product = await findRow<ProductRow>("products", sql`slug = 'khamrah-qahwa'`);
    expect(product.minPrice?.toString()).toBe("1499");
    const mrpBelow = await admin.put("/api/v1/admin/pricing", { items: [{ productSlug: "khamrah-qahwa", sizeMl: 100, price: 2000, mrp: 1000 }] });
    expect(mrpBelow.status).toBe(422);
    await admin.put("/api/v1/admin/pricing", { items: [{ productSlug: "khamrah-qahwa", sizeMl: 100, price: null, mrp: null }] });
    expect((await findRow<ProductRow>("products", sql`slug = 'khamrah-qahwa'`)).minPrice).toBeNull();
  });

  it("creates, updates and deletes products, variants, images and brands", async () => {
    const admin = await adminClient();
    const created = await admin.post("/api/v1/admin/products", {
      slug: "test-oud-noir",
      name: "Test Oud Noir",
      brandSlug: "lattafa",
      fragranceFamily: "Woody",
      noteBasis: "EDITORIAL_IMPRESSION",
      topNotes: "Warm spice",
      heartNotes: "Woods",
      baseNotes: "Musk",
      scentCharacter: "Warm and woody",
      occasions: "Evenings",
      season: "Winter",
      categorySlugs: ["oud-woods", "middle-eastern"],
      variants: [{ sizeMl: 50 }],
    });
    expect(created.status).toBe(201);
    const id = created.body.data.id;
    expect(created.body.data.variants[0]).toMatchObject({ sizeMl: 50, price: null });
    const image = await admin.post(`/api/v1/admin/products/${id}/images`, { url: "/images/products/test.webp", alt: "Test bottle" });
    expect(image.body.data.status).toBe("PENDING_REVIEW");
    const pub = await supertest(await getApp()).get("/api/v1/products/test-oud-noir");
    expect(pub.body.data.product.image).toBeNull(); // pending images are never public
    await admin.patch(`/api/v1/admin/images/${image.body.data.id}`, { status: "APPROVED" });
    expect((await supertest(await getApp()).get("/api/v1/products/test-oud-noir")).body.data.product.image.url).toBe("/images/products/test.webp");
    await admin.patch(`/api/v1/admin/products/${id}`, { isPublished: false });
    expect((await supertest(await getApp()).get("/api/v1/products/test-oud-noir")).status).toBe(404);
    expect((await admin.delete(`/api/v1/admin/products/${id}`)).status).toBe(200);
    expect((await admin.post("/api/v1/admin/brands", { slug: "lattafa", name: "Dup" })).status).toBe(409);
    expect((await admin.delete(`/api/v1/admin/brands/${(await findRow<BrandRow>("brands", sql`slug = 'lattafa'`)).id}`)).status).toBe(409);
  });
});

describe("legacy /api compatibility (current web app)", () => {
  it("serves products, brands and search in the web app's shapes", async () => {
    const api = supertest(await getApp());
    const products = await api.get("/api/products");
    expect(products.body.products).toHaveLength(94);
    expect(products.body.products[0]).toHaveProperty("brandId");
    expect(products.body.products[0]).toHaveProperty("noteBasis");
    const detail = await api.get("/api/products/khamrah-qahwa");
    expect(detail.body.product.slug).toBe("khamrah-qahwa");
    expect(detail.body.related).toHaveLength(4);
    expect((await api.get("/api/brands?featured=1")).body.brands[0].slug).toBe("lattafa");
    expect((await api.get("/api/search?q=oud")).body.total).toBeGreaterThan(0);
  });

  it("creates real orders and accounts through the legacy routes", async () => {
    const app = await getApp();
    const agent = supertest.agent(app);
    const email = uniqueEmail("legacy");
    const reg = await agent.post("/api/auth/register").send({ name: "Legacy User", email, password: "Legacy1234" });
    expect(reg.body).toMatchObject({ ok: true, user: { email, demo: false } });
    expect((await agent.get("/api/auth/session")).body.user.email).toBe(email);

    const order = await agent.post("/api/orders").send({
      email,
      phone: "9876543210",
      paymentMethod: "cod",
      lines: [{ slug: "hawas-gold-digger", sizeMl: 100, qty: 2 }],
      address: { fullName: "Legacy User", pin: "400001", addressLine: "1 Legacy Road", city: "Mumbai", state: "Maharashtra" },
    });
    expect(order.status).toBe(201);
    expect(order.body.order).toMatchObject({ subtotal: 3600, total: 3600, paymentMethod: "cod", paymentStatus: "cod_pending", status: "placed" });
    const mine = await agent.get("/api/orders");
    expect(mine.body.orders).toHaveLength(1);
    const track = await agent.post("/api/orders/track").send({ orderNumber: order.body.order.orderNumber, contact: email });
    expect(track.body).toMatchObject({ found: true, status: "Order placed" });

    const unpriced = await agent.post("/api/orders").send({ email, phone: "9876543210", paymentMethod: "cod", lines: [{ slug: "jasoor", sizeMl: 100, qty: 1 }], address: { fullName: "X Y", pin: "400001", addressLine: "1 Legacy Road", city: "Mumbai", state: "Maharashtra" } });
    expect(unpriced.body.ok).toBe(false);
    expect((await agent.post("/api/orders").set("Origin", "https://evil.example").send({})).status).toBe(403);
  });
});
