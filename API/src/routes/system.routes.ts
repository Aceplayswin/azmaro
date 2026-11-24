import { db, sql } from "../db";
import { fail, ok } from "../utils/response";
import { moduleRouter } from "./router";

export const systemRoutes = moduleRouter("/health", "System");

systemRoutes.get("/", { summary: "Liveness + database connectivity check" }, async (_req, res) => {
  try {
    await db.one(sql`SELECT 1`);
    return ok(res, { status: "ok", database: "connected", time: new Date().toISOString() });
  } catch {
    return fail(res, 503, "DATABASE_UNAVAILABLE", "Database is not reachable.");
  }
});
