import { afterAll, beforeAll, describe, expect, it } from "vitest";
import { updateSetting } from "../src/modules/settings/settings.service";
import type { UserRow } from "../src/db";
import { adminClient, client, countRows, findRow, priceProduct, registerCustomer, sql } from "./helpers";

beforeAll(async () => {
  await priceProduct("nebras-elixir", 100, "333.33", { mrp: "399.00" });
  await priceProduct("yara-moi", 100, "1250.50");
});

afterAll(async () => {
  await updateSetting("shipping", { flatFeeInr: null, freeAboveInr: null }, "test");
});

describe("shopping cart", () => {
  it("refuses products whose price is not confirmed", async () => {
    const c = await client();
    const res = await c.post("/api/v1/cart/items", { productSlug: "khamrah-qahwa", sizeMl: 100 });
    expect(res.status).toBe(409);
    expect(res.body.error.code).toBe("NOT_PURCHASABLE");
  });

  it("calculates subtotal, discount, delivery and total with exact decimals (no tax line)", async () => {
    const c = await client();
    let res = await c.post("/api/v1/cart/items", { productSlug: "nebras-elixir", sizeMl: 100, quantity: 3 });
    expect(res.status).toBe(200);
    expect(res.body.data.totals).toMatchObject({ subtotal: 999.99, discount: 0, delivery: null, deliveryStatus: "TO_BE_CONFIRMED", total: 999.99 });
    expect(res.body.data.totals).not.toHaveProperty("tax");

    res = await c.post("/api/v1/cart/items", { productSlug: "yara-moi", sizeMl: 100 });
    expect(res.body.data.totals.subtotal).toBe(2250.49);
    expect(res.body.data.itemCount).toBe(4);

    const variantId = res.body.data.items[0].variantId;
    res = await c.patch(`/api/v1/cart/items/${variantId}`, { quantity: 1 });
    expect(res.body.data.totals.subtotal).toBe(1583.83);

    res = await c.delete(`/api/v1/cart/items/${variantId}`);
    expect(res.body.data.items).toHaveLength(1);
    expect(res.body.data.totals.total).toBe(1250.5);
  });

  it("applies percentage and flat coupons with limits", async () => {
    const admin = await adminClient();
    expect((await admin.post("/api/v1/admin/coupons", { code: "TENOFF", type: "PERCENT", value: 10, maxDiscount: 100 })).status).toBe(201);
    expect((await admin.post("/api/v1/admin/coupons", { code: "MIN5K", type: "FLAT", value: 200, minSubtotal: 5000 })).status).toBe(201);

    const c = await client();
    await c.post("/api/v1/cart/items", { productSlug: "nebras-elixir", sizeMl: 100, quantity: 2 }); // 666.66
    let res = await c.post("/api/v1/cart/coupon", { code: "tenoff" });
    expect(res.status).toBe(200);
    expect(res.body.data.totals).toMatchObject({ subtotal: 666.66, discount: 66.67, total: 599.99 });

    const tooSmall = await c.post("/api/v1/cart/coupon", { code: "MIN5K" });
    expect(tooSmall.status).toBe(422);
    expect(tooSmall.body.error.code).toBe("COUPON_INVALID");
    const unknown = await c.post("/api/v1/cart/coupon", { code: "NOPE" });
    expect(unknown.status).toBe(422);

    res = await c.post("/api/v1/cart/items", { productSlug: "yara-moi", sizeMl: 100, quantity: 5 }); // +6252.50
    expect(res.body.data.totals.discount).toBe(100); // capped by maxDiscount
    res = await c.delete("/api/v1/cart/coupon");
    expect(res.body.data.totals.discount).toBe(0);
  });

  it("adds configured delivery charges and free-delivery thresholds", async () => {
    await updateSetting("shipping", { flatFeeInr: 99, freeAboveInr: 2000 }, "test");
    const c = await client();
    let res = await c.post("/api/v1/cart/items", { productSlug: "nebras-elixir", sizeMl: 100 });
    expect(res.body.data.totals).toMatchObject({ subtotal: 333.33, delivery: 99, deliveryStatus: "CONFIGURED", total: 432.33 });
    res = await c.post("/api/v1/cart/items", { productSlug: "yara-moi", sizeMl: 100, quantity: 2 });
    expect(res.body.data.totals).toMatchObject({ delivery: 0, deliveryStatus: "FREE" });
    await updateSetting("shipping", { flatFeeInr: null, freeAboveInr: null }, "test");
  });

  it("caps quantities and respects tracked stock", async () => {
    await priceProduct("amber-oud-gold", 120, "4200.00", { stock: 2 });
    const c = await client();
    const over = await c.post("/api/v1/cart/items", { productSlug: "amber-oud-gold", sizeMl: 120, quantity: 3 });
    expect(over.status).toBe(409);
    expect(over.body.error.code).toBe("INSUFFICIENT_STOCK");
    expect((await c.post("/api/v1/cart/items", { productSlug: "amber-oud-gold", sizeMl: 120, quantity: 2 })).status).toBe(200);
    const invalid = await c.post("/api/v1/cart/items", { productSlug: "amber-oud-gold", sizeMl: 120, quantity: 0 });
    expect(invalid.status).toBe(422);
  });

  it("checks delivery PIN serviceability without inventing estimates", async () => {
    const c = await client();
    const res = await c.put("/api/v1/cart/delivery-pin", { pin: "400001" });
    expect(res.status).toBe(200);
    expect(res.body.data.serviceability).toMatchObject({ status: "UNAVAILABLE", isTest: true, estimate: null, courier: null });
    expect((await c.put("/api/v1/cart/delivery-pin", { pin: "012345" })).status).toBe(422);
  });

  it("merges a guest cart into the customer's cart on sign-in", async () => {
    const { email, password } = await registerCustomer();
    const guest = await client();
    await guest.post("/api/v1/cart/items", { productSlug: "nebras-elixir", sizeMl: 100, quantity: 2 });
    const login = await guest.post("/api/v1/auth/login", { email, password });
    expect(login.status).toBe(200);
    const cart = await guest.get("/api/v1/cart");
    expect(cart.body.data.itemCount).toBe(2);
    const user = await findRow<UserRow>("users", sql`email = ${email}`);
    expect(await countRows("carts", sql`userId = ${user.id}`)).toBe(1);
  });
});
