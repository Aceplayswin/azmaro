import { randomUUID } from "node:crypto";
import supertest from "supertest";
import type { Express } from "express";
import { db, ident, insert, newId, sql, update, type ProductRow, type ProductVariantRow, type Sql } from "../src/db";
import { recomputeMinPrice } from "../src/modules/catalogue/products.service";

let appPromise: Promise<Express> | null = null;

/** App instance (imported lazily so per-file env tweaks apply first). */
export async function getApp(): Promise<Express> {
  appPromise ??= import("../src/app").then((m) => m.createApp());
  return appPromise;
}

type Method = "get" | "post" | "put" | "patch" | "delete";

/** Cookie-persisting client that automatically sends the CSRF header. */
export async function client() {
  const app = await getApp();
  const agent = supertest.agent(app);
  const res = await agent.get("/api/v1/auth/csrf");
  let csrf: string = res.body.data.csrfToken;
  const call = (method: Method) => (url: string, body?: unknown, headers: Record<string, string> = {}) => {
    const req = agent[method](url).set("X-CSRF-Token", csrf).set(headers);
    return (body === undefined ? req : req.send(body as object)).then((r) => {
      if (r.body?.data?.csrfToken) csrf = r.body.data.csrfToken;
      return r;
    });
  };
  return {
    agent,
    get: (url: string) => agent.get(url),
    post: call("post"),
    put: call("put"),
    patch: call("patch"),
    delete: call("delete"),
    get csrf() {
      return csrf;
    },
  };
}

export type Client = Awaited<ReturnType<typeof client>>;

export const uniqueEmail = (prefix = "user") => `${prefix}.${randomUUID().slice(0, 8)}@example.com`;

export async function registerCustomer(c?: Client, overrides: Partial<{ name: string; email: string; password: string }> = {}) {
  const cl = c ?? (await client());
  const email = overrides.email ?? uniqueEmail();
  const password = overrides.password ?? "Customer123";
  const res = await cl.post("/api/v1/auth/register", { name: overrides.name ?? "Test Customer", email, password });
  if (res.status !== 201) throw new Error(`register failed: ${res.status} ${JSON.stringify(res.body)}`);
  return { client: cl, email, password, user: res.body.data.user };
}

export async function adminClient() {
  const c = await client();
  const res = await c.post("/api/v1/auth/login", { email: "admin@azmaro.test", password: "AdminPassw0rd!2026" });
  if (res.status !== 200) throw new Error(`admin login failed: ${res.status} ${JSON.stringify(res.body)}`);
  return c;
}

/** The single row of `table` matching `condition` (throws when missing). */
export async function findRow<T = Record<string, unknown>>(table: string, condition: Sql): Promise<T> {
  const row = await db.one<T>(sql`SELECT * FROM ${ident(table)} WHERE ${condition}`);
  if (!row) throw new Error(`No ${table} row matches ${condition.text}`);
  return row;
}

export async function countRows(table: string, condition: Sql): Promise<number> {
  return (await db.one<{ n: number }>(sql`SELECT COUNT(*) AS n FROM ${ident(table)} WHERE ${condition}`))!.n;
}

/** Give a product a priced variant directly in the DB (test fixture). */
export async function priceProduct(slug: string, sizeMl: number, price: string, opts: { mrp?: string; stock?: number | null } = {}) {
  const product = await findRow<ProductRow>("products", sql`slug = ${slug}`);
  await db.run(sql`
    INSERT INTO product_variants (id, productId, sizeMl, price, mrp) VALUES (${newId()}, ${product.id}, ${sizeMl}, ${price}, ${opts.mrp ?? null}) AS incoming
    ON DUPLICATE KEY UPDATE price = incoming.price, mrp = incoming.mrp, isActive = 1`);
  const variant = await findRow<ProductVariantRow>("product_variants", sql`productId = ${product.id} AND sizeMl = ${sizeMl}`);
  const matched = await update(db, "inventory", { quantity: opts.stock ?? null, stockStatus: null }, sql`variantId = ${variant.id}`);
  if (!matched) await insert(db, "inventory", { variantId: variant.id, quantity: opts.stock ?? null });
  await recomputeMinPrice(product.id);
  return variant;
}

export const address = {
  fullName: "Test Customer",
  phone: "9876543210",
  line1: "12 Test Street, Fort",
  city: "Mumbai",
  state: "Maharashtra",
  pin: "400001",
};

export { db, sql };
