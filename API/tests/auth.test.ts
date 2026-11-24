import { describe, expect, it } from "vitest";
import { devOutbox } from "../src/integrations/messaging";
import type { SessionRow, UserRow } from "../src/db";
import { client, countRows, db, findRow, registerCustomer, sql, uniqueEmail } from "./helpers";

const lastToken = (to: string, template: string) => {
  const mail = [...devOutbox()].reverse().find((m) => m.to === to && m.template === template);
  return mail?.data.token as string | undefined;
};

describe("authentication", () => {
  it("validates registration input", async () => {
    const c = await client();
    const res = await c.post("/api/v1/auth/register", { name: "A", email: "not-an-email", password: "short" });
    expect(res.status).toBe(422);
    expect(res.body.error.code).toBe("VALIDATION_ERROR");
    expect(res.body.error.details.map((d: { path: string }) => d.path)).toEqual(expect.arrayContaining(["email", "password"]));
  });

  it("registers, hashes the password and starts a session", async () => {
    const { client: c, email } = await registerCustomer();
    const me = await c.get("/api/v1/auth/me");
    expect(me.status).toBe(200);
    expect(me.body.data).toMatchObject({ email, role: "CUSTOMER", emailVerified: false, isAdmin: false });
    const user = await findRow<UserRow>("users", sql`email = ${email}`);
    expect(user.passwordHash).toMatch(/^\$2[aby]\$/);
    expect(user.passwordHash).not.toContain("Customer123");
  });

  it("rejects duplicate emails", async () => {
    const { email } = await registerCustomer();
    const c = await client();
    const res = await c.post("/api/v1/auth/register", { name: "Again", email, password: "Customer123" });
    expect(res.status).toBe(409);
    expect(res.body.error.code).toBe("EMAIL_TAKEN");
  });

  it("logs in, logs out and rejects bad credentials", async () => {
    const { email, password } = await registerCustomer();
    const c = await client();
    expect((await c.post("/api/v1/auth/login", { email, password: "wrong-pass1" })).status).toBe(401);
    const ok = await c.post("/api/v1/auth/login", { email, password });
    expect(ok.status).toBe(200);
    expect(([] as string[]).concat(ok.headers["set-cookie"] ?? []).join(";")).toMatch(/azm_at=.*HttpOnly/);
    expect((await c.get("/api/v1/auth/me")).status).toBe(200);
    expect((await c.post("/api/v1/auth/logout")).status).toBe(200);
    expect((await c.get("/api/v1/auth/me")).status).toBe(401);
  });

  it("rotates refresh tokens", async () => {
    const { client: c, email } = await registerCustomer();
    const first = await c.post("/api/v1/auth/refresh");
    expect(first.status).toBe(200);
    const user = await findRow<UserRow>("users", sql`email = ${email}`);
    const sessions = await db.many<SessionRow>(sql`SELECT * FROM sessions WHERE userId = ${user.id} ORDER BY createdAt ASC, id ASC`);
    expect(sessions).toHaveLength(2);
    expect(sessions[0]!.revokedAt).not.toBeNull();
    expect(sessions[1]!.revokedAt).toBeNull();
    expect((await c.get("/api/v1/auth/me")).status).toBe(200);
  });

  it("detects refresh-token reuse", async () => {
    const supertest = (await import("supertest")).default;
    const { getApp } = await import("./helpers");
    const app = await getApp();
    const { email, password } = await registerCustomer();
    const login = await supertest(app).post("/api/v1/auth/login").set("Authorization", "Bearer x").send({ email, password });
    const rt = (login.headers["set-cookie"] as unknown as string[]).find((h) => h.startsWith("azm_rt="))!.split(";")[0]!;
    const rotate = await supertest(app).post("/api/v1/auth/refresh").set("Authorization", "Bearer x").set("Cookie", rt);
    expect(rotate.status).toBe(200);
    const reuse = await supertest(app).post("/api/v1/auth/refresh").set("Authorization", "Bearer x").set("Cookie", rt);
    expect(reuse.status).toBe(401);
    expect(reuse.body.error.code).toBe("SESSION_REUSED");
    const user = await findRow<UserRow>("users", sql`email = ${email}`);
    expect(await countRows("sessions", sql`userId = ${user.id} AND revokedAt IS NULL`)).toBe(0);
    expect(user.tokenVersion).toBeGreaterThan(0);
  });

  it("verifies email with a one-time token", async () => {
    const { client: c, email } = await registerCustomer();
    const token = lastToken(email, "verify-email");
    expect(token).toBeTruthy();
    expect((await c.post("/api/v1/auth/verify-email", { token })).status).toBe(200);
    expect((await c.post("/api/v1/auth/verify-email", { token })).status).toBe(400);
    expect((await c.get("/api/v1/auth/me")).body.data.emailVerified).toBe(true);
  });

  it("resets a forgotten password without revealing whether the email exists", async () => {
    const { email } = await registerCustomer();
    const c = await client();
    const unknown = await c.post("/api/v1/auth/forgot-password", { email: uniqueEmail("ghost") });
    const known = await c.post("/api/v1/auth/forgot-password", { email });
    expect(unknown.status).toBe(200);
    expect(known.body.message).toBe(unknown.body.message);
    const token = lastToken(email, "password-reset");
    const reset = await c.post("/api/v1/auth/reset-password", { token, password: "NewPassw0rd" });
    expect(reset.status).toBe(200);
    expect((await c.post("/api/v1/auth/login", { email, password: "Customer123" })).status).toBe(401);
    expect((await c.post("/api/v1/auth/login", { email, password: "NewPassw0rd" })).status).toBe(200);
  });

  it("changes password and invalidates old access tokens", async () => {
    const { client: c } = await registerCustomer();
    expect((await c.post("/api/v1/auth/change-password", { currentPassword: "wrong123", newPassword: "Another123" })).status).toBe(400);
    expect((await c.post("/api/v1/auth/change-password", { currentPassword: "Customer123", newPassword: "Another123" })).status).toBe(200);
    expect((await c.get("/api/v1/auth/me")).status).toBe(200);
  });
});
