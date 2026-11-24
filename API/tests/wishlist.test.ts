import { beforeAll, describe, expect, it } from "vitest";
import { client, priceProduct, registerCustomer } from "./helpers";

beforeAll(async () => {
  await priceProduct("yara-tous-lt", 100, "899.00");
});

describe("wishlist", () => {
  it("adds, lists, de-duplicates and removes products (guest)", async () => {
    const c = await client();
    expect((await c.post("/api/v1/wishlist/items", { productSlug: "jasoor" })).status).toBe(200);
    await c.post("/api/v1/wishlist/items", { productSlug: "jasoor" });
    const res = await c.post("/api/v1/wishlist/items", { productSlug: "yara-tous-lt" });
    expect(res.body.data.count).toBe(2);
    expect((await c.post("/api/v1/wishlist/items", { productSlug: "unknown-thing" })).status).toBe(404);
    const removed = await c.delete("/api/v1/wishlist/items/jasoor");
    expect(removed.body.data.count).toBe(1);
  });

  it("moves a purchasable product to the cart and refuses unpriced ones", async () => {
    const c = await client();
    await c.post("/api/v1/wishlist/items", { productSlug: "yara-tous-lt" });
    await c.post("/api/v1/wishlist/items", { productSlug: "dynasty" });
    const blocked = await c.post("/api/v1/wishlist/items/dynasty/move-to-cart", {});
    expect(blocked.status).toBe(409);
    const moved = await c.post("/api/v1/wishlist/items/yara-tous-lt/move-to-cart", {});
    expect(moved.status).toBe(200);
    expect(moved.body.data.count).toBe(1);
    const cart = await c.get("/api/v1/cart");
    expect(cart.body.data.items.map((i: { slug: string }) => i.slug)).toEqual(["yara-tous-lt"]);
  });

  it("moves all purchasable items and reports the skipped ones", async () => {
    const c = await client();
    await c.post("/api/v1/wishlist/items", { productSlug: "yara-tous-lt" });
    await c.post("/api/v1/wishlist/items", { productSlug: "thriller" });
    const res = await c.post("/api/v1/wishlist/move-all-to-cart");
    expect(res.body.data.moved).toEqual(["yara-tous-lt"]);
    expect(res.body.data.skipped.map((s: { slug: string }) => s.slug)).toEqual(["thriller"]);
    expect(res.body.data.wishlist.count).toBe(1);
  });

  it("merges a guest wishlist into the account on sign-in", async () => {
    const { email, password } = await registerCustomer();
    const c = await client();
    await c.post("/api/v1/wishlist/items", { productSlug: "teriaq" });
    await c.post("/api/v1/auth/login", { email, password });
    const res = await c.get("/api/v1/wishlist");
    expect(res.body.data.items.map((i: { product: { slug: string } }) => i.product.slug)).toContain("teriaq");
  });
});
