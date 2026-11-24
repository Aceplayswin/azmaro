import type { Response } from "express";

/**
 * Consistent JSON envelope for every /api/v1 response:
 *   { success, message, data, error?, meta? }
 */
export interface PaginationMeta {
  page: number;
  pageSize: number;
  total: number;
  totalPages: number;
}

export interface ApiEnvelope<T> {
  success: boolean;
  message: string;
  data: T | null;
  error?: { code: string; details?: unknown };
  meta?: { pagination?: PaginationMeta } & Record<string, unknown>;
}

export function ok<T>(res: Response, data: T, message = "OK", status = 200, meta?: ApiEnvelope<T>["meta"]) {
  const body: ApiEnvelope<T> = { success: true, message, data };
  if (meta) body.meta = meta;
  return res.status(status).json(body);
}

export const created = <T>(res: Response, data: T, message = "Created") => ok(res, data, message, 201);

export function paginated<T>(res: Response, items: T[], pagination: PaginationMeta, message = "OK") {
  return ok(res, items, message, 200, { pagination });
}

export function fail(res: Response, status: number, code: string, message: string, details?: unknown) {
  const body: ApiEnvelope<null> = { success: false, message, data: null, error: { code } };
  if (details !== undefined) body.error!.details = details;
  return res.status(status).json(body);
}
