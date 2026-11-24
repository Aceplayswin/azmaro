import type { Request } from "express";
import { db, insert } from "../../db";

/** Record an admin action. Never store secrets or full customer PII in `meta`. */
export async function audit(req: Request, action: string, entity: string, entityId?: string | null, meta?: Record<string, unknown>) {
  await insert(db, "audit_logs", {
    userId: req.auth?.userId ?? null,
    action,
    entity,
    entityId: entityId ?? null,
    meta: meta === undefined ? null : JSON.stringify(meta),
  });
}
