import type { NextFunction, Request, Response } from "express";
import { db, sql, type SessionRow } from "../db";
import { findUserWithRole } from "../modules/auth/auth.service";
import { COOKIES, setAccessCookie, signAccessToken, verifyAccessToken } from "../modules/auth/tokens";
import { sha256 } from "../utils/crypto";
import { forbidden, unauthorized } from "../utils/errors";

export interface AuthContext {
  userId: string;
  email: string;
  name: string;
  role: string;
  permissions: string[];
  tokenVersion: number;
  emailVerified: boolean;
  /** "bearer" requests are not subject to CSRF checks (no ambient credentials). */
  via: "cookie" | "bearer";
}


async function loadContext(userId: string, tokenVersion: number | null, via: AuthContext["via"]): Promise<AuthContext | null> {
  const user = await findUserWithRole({ id: userId });
  if (!user || !user.isActive) return null;
  if (tokenVersion !== null && user.tokenVersion !== tokenVersion) return null;
  return {
    userId: user.id,
    email: user.email,
    name: user.name,
    role: user.role.name,
    permissions: Array.isArray(user.role.permissions) ? (user.role.permissions as string[]) : [],
    tokenVersion: user.tokenVersion,
    emailVerified: Boolean(user.emailVerifiedAt),
    via,
  };
}

/**
 * Optional authentication: attaches `req.auth` when a valid access token is
 * present (cookie or Bearer header). If the access cookie has expired but a
 * valid refresh session exists, a new access token is issued transparently
 * (sliding session, no refresh-token rotation here – that happens only on
 * POST /auth/refresh to avoid races between parallel requests).
 */
export async function authenticate(req: Request, res: Response, next: NextFunction) {
  const header = req.headers.authorization;
  const bearer = header?.startsWith("Bearer ") ? header.slice(7).trim() : null;
  const cookies = (req.cookies ?? {}) as Record<string, string | undefined>;
  const token = bearer ?? cookies[COOKIES.access];

  if (token) {
    const payload = verifyAccessToken(token);
    if (payload) {
      const ctx = await loadContext(payload.sub, payload.tv, bearer ? "bearer" : "cookie");
      if (ctx) {
        req.auth = ctx;
        return next();
      }
    }
    if (bearer) return next(); // invalid bearer: stay anonymous (requireAuth will 401)
  }

  const refresh = cookies[COOKIES.refresh];
  if (refresh) {
    const session = await db.one<SessionRow>(sql`SELECT * FROM sessions WHERE refreshTokenHash = ${sha256(refresh)}`);
    if (session && !session.revokedAt && session.expiresAt > new Date()) {
      const ctx = await loadContext(session.userId, null, "cookie");
      if (ctx) {
        setAccessCookie(res, signAccessToken({ id: ctx.userId, role: ctx.role, tokenVersion: ctx.tokenVersion }));
        req.auth = ctx;
      }
    }
  }
  next();
}

export function requireAuth(req: Request, _res: Response, next: NextFunction) {
  if (!req.auth) return next(unauthorized());
  next();
}

export const hasPermission = (ctx: AuthContext | undefined, permission: string) =>
  Boolean(ctx && (ctx.permissions.includes("*") || ctx.permissions.includes(permission)));

/** Admin area guard: requires sign-in, `admin:access` and (optionally) a specific permission. */
export const requirePermission =
  (permission?: string) => (req: Request, _res: Response, next: NextFunction) => {
    if (!req.auth) return next(unauthorized());
    if (!hasPermission(req.auth, "admin:access")) return next(forbidden("Administrator access required."));
    if (permission && !hasPermission(req.auth, permission))
      return next(forbidden(`Missing permission: ${permission}.`));
    next();
  };
