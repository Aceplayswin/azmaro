import supertest from "supertest";
import { describe, expect, it } from "vitest";
import { client, getApp } from "./helpers";

describe("platform", () => {
  it("reports database connectivity", async () => {
    const res = await supertest(await getApp()).get("/api/v1/health");
    expect(res.status).toBe(200);
    expect(res.body).toMatchObject({ success: true, data: { status: "ok", database: "connected" } });
  });

  it("serves a valid OpenAPI document covering every module", async () => {
    const res = await supertest(await getApp()).get("/api/v1/openapi.json");
    expect(res.status).toBe(200);
    expect(res.body.openapi).toBe("3.0.3");
    const paths = Object.keys(res.body.paths);
    for (const p of ["/api/v1/auth/login", "/api/v1/products", "/api/v1/cart", "/api/v1/checkout", "/api/v1/orders", "/api/v1/payments/webhooks/{provider}", "/api/v1/shipping/serviceability", "/api/v1/tracking/lookup", "/api/v1/admin/dashboard", "/api/v1/contact"]) {
      expect(paths).toContain(p);
    }
  });

  it("returns the error envelope for unknown routes", async () => {
    const res = await supertest(await getApp()).get("/api/v1/nope");
    expect(res.status).toBe(404);
    expect(res.body).toMatchObject({ success: false, data: null, error: { code: "ROUTE_NOT_FOUND" } });
  });

  it("rejects malformed JSON and oversized bodies", async () => {
    const c = await client();
    const bad = await c.agent.post("/api/v1/contact").set("X-CSRF-Token", c.csrf).set("Content-Type", "application/json").send("{bad");
    expect(bad.status).toBe(400);
    expect(bad.body.error.code).toBe("INVALID_JSON");
    const big = await c.post("/api/v1/contact", { message: "x".repeat(200_000) });
    expect(big.status).toBe(413);
  });

  it("requires a CSRF token for cookie-based mutations", async () => {
    const res = await supertest(await getApp()).post("/api/v1/cart/items").send({ productSlug: "khamrah-qahwa", sizeMl: 100 });
    expect(res.status).toBe(403);
    expect(res.body.error.code).toBe("CSRF_TOKEN_INVALID");
  });

  it("rejects mutations from foreign origins", async () => {
    const c = await client();
    const res = await c.post("/api/v1/contact", {}, { Origin: "https://evil.example" });
    expect(res.status).toBe(403);
    expect(res.body.error.code).toBe("ORIGIN_NOT_ALLOWED");
  });

  it("sends security headers", async () => {
    const res = await supertest(await getApp()).get("/api/v1/health");
    expect(res.headers["x-content-type-options"]).toBe("nosniff");
    expect(res.headers["x-powered-by"]).toBeUndefined();
  });
});
