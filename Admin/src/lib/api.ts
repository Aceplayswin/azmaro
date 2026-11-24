/**
 * Browser client for the AZMARO API (/api/v1, proxied by next.config.ts).
 * Auth uses the API's HTTP-only cookies; every write sends the CSRF token.
 */

export interface Pagination {
  page: number;
  pageSize: number;
  total: number;
  totalPages: number;
}

export interface Envelope<T> {
  success: boolean;
  message: string;
  data: T;
  error?: { code: string; details?: unknown };
  meta?: { pagination?: Pagination };
}

export class ApiError extends Error {
  constructor(
    readonly status: number,
    readonly code: string,
    message: string,
    readonly details?: unknown,
  ) {
    super(message);
  }

  /** Field → message map from a validation error ({ path, message }[]). */
  get fieldErrors(): Record<string, string> {
    if (!Array.isArray(this.details)) return {};
    const out: Record<string, string> = {};
    for (const d of this.details as Array<{ path?: string; message?: string }>) {
      if (d.path && d.message && !out[d.path]) out[d.path] = d.message;
    }
    return out;
  }
}

let csrf: Promise<string> | null = null;

function csrfToken(): Promise<string> {
  csrf ??= fetch("/api/v1/auth/csrf", { credentials: "include" })
    .then((r) => r.json())
    .then((j: Envelope<{ csrfToken: string }>) => j.data.csrfToken)
    .catch((e) => {
      csrf = null;
      throw e;
    });
  return csrf;
}

type Method = "GET" | "POST" | "PUT" | "PATCH" | "DELETE";

interface RequestOptions {
  method?: Method;
  /** JSON body */
  body?: unknown;
  /** Raw file body (image upload) */
  file?: File;
  query?: Record<string, string | number | boolean | undefined | null>;
}

export async function api<T>(path: string, opts: RequestOptions = {}, retried = false): Promise<Envelope<T>> {
  const method = opts.method ?? "GET";
  const headers: Record<string, string> = { Accept: "application/json" };
  let body: BodyInit | undefined;
  if (opts.file) {
    headers["Content-Type"] = opts.file.type || "application/octet-stream";
    body = opts.file;
  } else if (opts.body !== undefined) {
    headers["Content-Type"] = "application/json";
    body = JSON.stringify(opts.body);
  }
  if (method !== "GET") headers["X-CSRF-Token"] = await csrfToken();

  const qs = new URLSearchParams();
  for (const [k, v] of Object.entries(opts.query ?? {})) if (v !== undefined && v !== null && v !== "") qs.set(k, String(v));
  const url = `/api/v1${path}${qs.size ? `?${qs}` : ""}`;

  let res: Response;
  try {
    res = await fetch(url, { method, headers, body, credentials: "include" });
  } catch {
    throw new ApiError(0, "NETWORK_ERROR", "Can't reach the AZMARO API. Is it running on port 4000?");
  }
  const json = (await res.json().catch(() => null)) as Envelope<T> | null;

  if (!res.ok || !json?.success) {
    const code = json?.error?.code ?? "HTTP_ERROR";
    if (code === "CSRF_TOKEN_INVALID" && !retried) {
      csrf = null;
      return api<T>(path, opts, true);
    }
    throw new ApiError(res.status, code, json?.message ?? `Request failed (${res.status}).`, json?.error?.details);
  }
  const fresh = (json.data as { csrfToken?: string } | null)?.csrfToken;
  if (fresh) csrf = Promise.resolve(fresh);
  return json;
}

export const errorMessage = (e: unknown) => (e instanceof Error ? e.message : "Something went wrong.");

/** Absolute URL for a product photo (relative paths live in the storefront's /public folder). */
export function imageSrc(url: string) {
  if (/^https?:\/\//.test(url)) return url;
  const base = (process.env.NEXT_PUBLIC_STOREFRONT_URL ?? "http://localhost:3000").replace(/\/$/, "");
  return `${base}${url}`;
}

export const formatInr = (v: number | null | undefined) =>
  v === null || v === undefined ? "—" : `₹${v.toLocaleString("en-IN", { maximumFractionDigits: 2 })}`;
