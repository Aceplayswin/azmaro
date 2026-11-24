import type { CookieOptions, Response } from "express";
import jwt from "jsonwebtoken";
import { env } from "../../config/env";

/**
 * Cookie + token primitives.
 *  - azm_at   access JWT (HS256, short-lived), httpOnly
 *  - azm_rt   opaque refresh token (hash stored in `sessions`), httpOnly
 *  - azm_csrf CSRF double-submit token, readable by the frontend
 *  - azm_cart / azm_wl  opaque guest cart / wishlist tokens (hash stored), httpOnly
 */
export const COOKIES = {
  access: "azm_at",
  refresh: "azm_rt",
  csrf: "azm_csrf",
  cart: "azm_cart",
  wishlist: "azm_wl",
} as const;

export interface AccessTokenPayload {
  sub: string;
  role: string;
  /** token version – bumping it on the user invalidates all access tokens */
  tv: number;
  typ: "access";
}

const base = (): CookieOptions => ({
  httpOnly: true,
  secure: env.COOKIE_SECURE,
  sameSite: "lax",
  domain: env.COOKIE_DOMAIN,
  path: "/",
});

export const accessTtlMs = () => env.ACCESS_TOKEN_TTL_MINUTES * 60_000;
export const refreshTtlMs = () => env.REFRESH_TOKEN_TTL_DAYS * 86_400_000;

export function signAccessToken(user: { id: string; role: string; tokenVersion: number }): string {
  const payload: AccessTokenPayload = { sub: user.id, role: user.role, tv: user.tokenVersion, typ: "access" };
  return jwt.sign(payload, env.JWT_ACCESS_SECRET, {
    algorithm: "HS256",
    expiresIn: env.ACCESS_TOKEN_TTL_MINUTES * 60,
    issuer: "azmaro-api",
    audience: "azmaro",
  });
}

export function verifyAccessToken(token: string): AccessTokenPayload | null {
  try {
    const p = jwt.verify(token, env.JWT_ACCESS_SECRET, {
      algorithms: ["HS256"],
      issuer: "azmaro-api",
      audience: "azmaro",
    }) as AccessTokenPayload;
    return p.typ === "access" && typeof p.sub === "string" ? p : null;
  } catch {
    return null;
  }
}

export function setAccessCookie(res: Response, token: string) {
  res.cookie(COOKIES.access, token, { ...base(), maxAge: accessTtlMs() });
}

/** Refresh cookie is scoped to /api so it is sent to both /api/v1 and the legacy /api routes. */
export function setRefreshCookie(res: Response, token: string) {
  res.cookie(COOKIES.refresh, token, { ...base(), path: "/api", maxAge: refreshTtlMs() });
}

export function clearAuthCookies(res: Response) {
  res.clearCookie(COOKIES.access, { ...base() });
  res.clearCookie(COOKIES.refresh, { ...base(), path: "/api" });
}

export function setCsrfCookie(res: Response, token: string) {
  res.cookie(COOKIES.csrf, token, { ...base(), httpOnly: false, maxAge: refreshTtlMs() });
}

export function setGuestCookie(res: Response, name: typeof COOKIES.cart | typeof COOKIES.wishlist, token: string) {
  res.cookie(name, token, { ...base(), maxAge: 60 * 86_400_000 });
}

export function clearGuestCookie(res: Response, name: typeof COOKIES.cart | typeof COOKIES.wishlist) {
  res.clearCookie(name, { ...base() });
}
