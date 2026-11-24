import bcrypt from "bcryptjs";
import { describe, expect, it } from "vitest";
import { insert, type RoleRow } from "../src/db";
import { adminClient, client, db, findRow, registerCustomer, sql, uniqueEmail } from "./helpers";

async function staffClient() {
  const email = uniqueEmail("staff");
  const role = await findRow<RoleRow>("roles", sql`name = 'STAFF'`);
  await insert(db, "users", { email, name: "Staff", passwordHash: await bcrypt.hash("StaffPass123", 4), roleId: role.id });
  const c = await client();
  await c.post("/api/v1/auth/login", { email, password: "StaffPass123" });
  return c;
}

describe("authorization", () => {
  it("rejects anonymous access to admin and customer endpoints", async () => {
    const c = await client();
    expect((await c.get("/api/v1/admin/dashboard")).status).toBe(401);
    expect((await c.get("/api/v1/customers/me")).status).toBe(401);
    expect((await c.get("/api/v1/orders")).status).toBe(401);
  });

  it("forbids customers from admin endpoints", async () => {
    const { client: c } = await registerCustomer();
    const res = await c.get("/api/v1/admin/dashboard");
    expect(res.status).toBe(403);
    expect((await c.get("/api/v1/admin/customers")).status).toBe(403);
  });

  it("lets admins in and returns dashboard statistics", async () => {
    const c = await adminClient();
    const res = await c.get("/api/v1/admin/dashboard");
    expect(res.status).toBe(200);
    expect(res.body.data.catalogue.products).toBe(94);
    expect(res.body.data.revenue).toHaveProperty("paidTotal");
  });

  it("enforces fine-grained permissions for staff", async () => {
    const c = await staffClient();
    expect((await c.get("/api/v1/admin/orders")).status).toBe(200);
    const denied = await c.put("/api/v1/admin/settings/shipping", { flatFeeInr: 50 });
    expect(denied.status).toBe(403);
    expect(denied.body.message).toContain("settings:write");
  });

  it("never exposes password hashes or tokens via admin customer endpoints", async () => {
    const { user } = await registerCustomer();
    const c = await adminClient();
    const res = await c.get(`/api/v1/admin/customers/${user.id}`);
    expect(res.status).toBe(200);
    expect(JSON.stringify(res.body)).not.toMatch(/passwordHash|tokenVersion|\$2[aby]\$/);
  });

  it("revokes access immediately when an admin deactivates a customer", async () => {
    const { client: customer, user } = await registerCustomer();
    const admin = await adminClient();
    expect((await admin.patch(`/api/v1/admin/customers/${user.id}`, { isActive: false })).status).toBe(200);
    expect((await customer.get("/api/v1/auth/me")).status).toBe(401);
  });
});
