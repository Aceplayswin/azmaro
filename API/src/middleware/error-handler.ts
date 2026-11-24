import type { NextFunction, Request, Response } from "express";
import { ZodError } from "zod";
import { isProduction } from "../config/env";
import { isDatabaseUnavailable, isDuplicateKey, isForeignKeyViolation } from "../db";
import { AppError } from "../utils/errors";
import { fail } from "../utils/response";

export function notFoundHandler(req: Request, res: Response) {
  fail(res, 404, "ROUTE_NOT_FOUND", `No route for ${req.method} ${req.path}.`);
}

/** Centralised error → JSON envelope mapping. Internal details never leak in production. */
export function errorHandler(err: unknown, req: Request, res: Response, next: NextFunction) {
  void next;
  if (res.headersSent) return;

  if (err instanceof AppError) return fail(res, err.status, err.code, err.message, err.details);

  if (err instanceof ZodError) {
    const details = err.issues.map((i) => ({ path: i.path.join("."), message: i.message }));
    return fail(res, 422, "VALIDATION_ERROR", details[0]?.message ?? "Validation failed.", details);
  }

  if (isDatabaseUnavailable(err)) {
    console.error(`[api] ${req.method} ${req.originalUrl}: database unreachable –`, (err as Error).message);
    return fail(res, 503, "DATABASE_UNAVAILABLE", "Our store is temporarily unavailable. Please try again in a few minutes.");
  }
  if (isDuplicateKey(err)) {
    const key = /for key '([^']+)'/.exec((err as Error).message)?.[1];
    return fail(res, 409, "DUPLICATE", "A record with these details already exists.", { target: key?.split(".").pop() });
  }
  if (isForeignKeyViolation(err)) return fail(res, 409, "RELATION_CONSTRAINT", "This record is referenced by other data.");

  const e = err as { type?: string; status?: number; message?: string };
  if (e?.type === "entity.parse.failed") return fail(res, 400, "INVALID_JSON", "Request body is not valid JSON.");
  if (e?.type === "entity.too.large") return fail(res, 413, "PAYLOAD_TOO_LARGE", "Request body is too large.");

  console.error(`[api] ${req.method} ${req.originalUrl} failed:`, err);
  return fail(
    res,
    500,
    "INTERNAL_ERROR",
    "Something went wrong. Please try again.",
    isProduction ? undefined : { error: e?.message },
  );
}
