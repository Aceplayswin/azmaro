import type { NextFunction, Request, Response } from "express";
import rateLimit, { type Options } from "express-rate-limit";
import { corsOrigins, env } from "../config/env";
import { COOKIES } from "../modules/auth/tokens";
import { safeEqual } from "../utils/crypto";
import { AppError, forbidden } from "../utils/errors";

const SAFE = new Set(["GET", "HEAD", "OPTIONS"]);

/**
 * CSRF protection (double-submit cookie) for cookie-authenticated requests.
 * Mutating requests must send `X-CSRF-Token` equal to the `azm_csrf` cookie
 * (obtain both from GET /api/v1/auth/csrf). Requests authenticated with a
 * Bearer token carry no ambient credentials and are exempt, as are signed webhooks.
 */
export function csrfProtection(exemptPrefixes: string[] = []) {
  return (req: Request, _res: Response, next: NextFunction) => {
    if (SAFE.has(req.method)) return next();
    if (exemptPrefixes.some((p) => req.originalUrl.startsWith(p))) return next();
    if (req.headers.authorization?.startsWith("Bearer ")) return next();
    const cookie = (req.cookies as Record<string, string | undefined> | undefined)?.[COOKIES.csrf];
    const header = req.get("x-csrf-token");
    if (!cookie || !header || !safeEqual(cookie, header)) {
      return next(new AppError(403, "CSRF_TOKEN_INVALID", "Missing or invalid CSRF token. Fetch one from GET /api/v1/auth/csrf."));
    }
    next();
  };
}

/**
 * Origin check for state-changing requests: browsers always send `Origin` on
 * cross-site POSTs, so rejecting unknown origins blocks CSRF from other sites.
 * Server-to-server calls without an Origin header are allowed.
 */
export function originCheck(req: Request, _res: Response, next: NextFunction) {
  if (SAFE.has(req.method)) return next();
  const origin = req.get("origin");
  if (!origin) return next();
  const normalised = origin.replace(/\/$/, "");
  const selfOrigin = `${req.protocol}://${req.get("host")}`;
  if (corsOrigins.includes(normalised) || normalised === selfOrigin) return next();
  next(forbidden("Request origin is not allowed.", "ORIGIN_NOT_ALLOWED"));
}

const limiter = (max: number, message: string, extra: Partial<Options> = {}) =>
  rateLimit({
    windowMs: env.RATE_LIMIT_WINDOW_MINUTES * 60_000,
    limit: max,
    standardHeaders: "draft-8",
    legacyHeaders: false,
    handler: (_req, res) => {
      res.status(429).json({ success: false, message, data: null, error: { code: "RATE_LIMITED" } });
    },
    ...extra,
  });

export const rateLimiters = {
  global: () => limiter(env.RATE_LIMIT_MAX, "Too many requests. Please slow down."),
  auth: () => limiter(env.RATE_LIMIT_AUTH_MAX, "Too many attempts. Please wait a few minutes and try again."),
  forms: () => limiter(env.RATE_LIMIT_FORMS_MAX, "Too many submissions. Please try again later."),
  /** Read-only lookups the bag/checkout repeat as the shopper edits (delivery checks). */
  lookups: () => limiter(Math.max(120, env.RATE_LIMIT_FORMS_MAX), "Too many delivery checks. Please wait a moment and try again."),
};
