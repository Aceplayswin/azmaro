import type { Request, Response } from "express";
import { rateLimiters } from "../../middleware/security";
import { moduleRouter } from "../../routes/router";
import { randomToken } from "../../utils/crypto";
import { unauthorized } from "../../utils/errors";
import { created, ok } from "../../utils/response";
import { mergeGuestCart } from "../cart/cart.service";
import { mergeGuestWishlist } from "../wishlist/wishlist.service";
import * as schemas from "./auth.schemas";
import * as auth from "./auth.service";
import {
  COOKIES,
  clearAuthCookies,
  setAccessCookie,
  setCsrfCookie,
  setRefreshCookie,
  signAccessToken,
} from "./tokens";

const meta = (req: Request) => ({ userAgent: req.get("user-agent"), ip: req.ip });

/** Issue access + refresh cookies, rotate the CSRF token and merge guest cart / wishlist. */
async function startSession(req: Request, res: Response, user: NonNullable<Awaited<ReturnType<typeof auth.getUser>>>) {
  const refresh = await auth.createSession(user.id, meta(req));
  setAccessCookie(res, signAccessToken({ id: user.id, role: user.role.name, tokenVersion: user.tokenVersion }));
  setRefreshCookie(res, refresh);
  const csrf = randomToken(24);
  setCsrfCookie(res, csrf);
  await mergeGuestCart(req, res, user.id);
  await mergeGuestWishlist(req, res, user.id);
  return csrf;
}

export const authRoutes = moduleRouter("/auth", "Auth");
const authLimiter = rateLimiters.auth();

authRoutes.get(
  "/csrf",
  {
    summary: "Get a CSRF token",
    description:
      "Sets the `azm_csrf` cookie and returns the same token. Send it as `X-CSRF-Token` on every cookie-authenticated POST/PUT/PATCH/DELETE.",
  },
  (req, res) => {
    const existing = (req.cookies as Record<string, string | undefined>)?.[COOKIES.csrf];
    const token = existing && existing.length >= 20 ? existing : randomToken(24);
    setCsrfCookie(res, token);
    return ok(res, { csrfToken: token });
  },
);

authRoutes.post(
  "/register",
  { summary: "Create a customer account", body: schemas.registerSchema, successStatus: 201, middleware: [authLimiter] },
  async (req, res) => {
    const input = schemas.registerSchema.parse(req.body);
    const user = await auth.register(input);
    const csrfToken = await startSession(req, res, user);
    return created(res, { user: auth.toUserDto(user), csrfToken }, "Account created. Please verify your email.");
  },
);

authRoutes.post(
  "/login",
  { summary: "Sign in (customer or admin)", body: schemas.loginSchema, middleware: [authLimiter] },
  async (req, res) => {
    const { email, password } = schemas.loginSchema.parse(req.body);
    const user = await auth.verifyCredentials(email, password);
    const csrfToken = await startSession(req, res, user);
    return ok(res, { user: auth.toUserDto(user), csrfToken }, "Signed in.");
  },
);

authRoutes.post(
  "/refresh",
  { summary: "Rotate the refresh token and issue a new access token", middleware: [authLimiter] },
  async (req, res) => {
    const raw = (req.cookies as Record<string, string | undefined>)?.[COOKIES.refresh];
    if (!raw) throw unauthorized("Your session has expired. Please sign in again.", "SESSION_MISSING");
    try {
      const { user, refreshToken } = await auth.rotateSession(raw, meta(req));
      setAccessCookie(res, signAccessToken({ id: user.id, role: user.role.name, tokenVersion: user.tokenVersion }));
      setRefreshCookie(res, refreshToken);
      return ok(res, { user: auth.toUserDto(user) }, "Session refreshed.");
    } catch (e) {
      clearAuthCookies(res);
      throw e;
    }
  },
);

authRoutes.post("/logout", { summary: "Sign out of this device", auth: "optional" }, async (req, res) => {
  await auth.revokeSession((req.cookies as Record<string, string | undefined>)?.[COOKIES.refresh]);
  clearAuthCookies(res);
  return ok(res, null, "Signed out.");
});

authRoutes.post("/logout-all", { summary: "Sign out of every device", auth: "customer" }, async (req, res) => {
  await auth.revokeAllSessions(req.auth!.userId);
  clearAuthCookies(res);
  return ok(res, null, "Signed out of all devices.");
});

authRoutes.get("/me", { summary: "Current signed-in user", auth: "customer" }, async (req, res) => {
  const user = await auth.getUser(req.auth!.userId);
  return ok(res, auth.toUserDto(user!));
});

authRoutes.post(
  "/verify-email",
  { summary: "Confirm an email address with the emailed token", body: schemas.tokenSchema, middleware: [authLimiter] },
  async (req, res) => {
    await auth.verifyEmail(schemas.tokenSchema.parse(req.body).token);
    return ok(res, null, "Email verified. Thank you.");
  },
);

authRoutes.post(
  "/resend-verification",
  { summary: "Send a new verification email", auth: "customer", middleware: [authLimiter] },
  async (req, res) => {
    const user = await auth.getUser(req.auth!.userId);
    if (user && !user.emailVerifiedAt) await auth.sendVerificationEmail(user);
    return ok(res, null, user?.emailVerifiedAt ? "Your email is already verified." : "Verification email sent.");
  },
);

authRoutes.post(
  "/forgot-password",
  {
    summary: "Request a password-reset email",
    description: "Always returns the same response whether or not the email is registered.",
    body: schemas.forgotPasswordSchema,
    middleware: [authLimiter],
  },
  async (req, res) => {
    await auth.forgotPassword(schemas.forgotPasswordSchema.parse(req.body).email);
    return ok(res, null, "If an account exists for that email, a reset link has been sent.");
  },
);

authRoutes.post(
  "/reset-password",
  { summary: "Set a new password with the emailed token (signs out all devices)", body: schemas.resetPasswordSchema, middleware: [authLimiter] },
  async (req, res) => {
    const { token, password } = schemas.resetPasswordSchema.parse(req.body);
    await auth.resetPassword(token, password);
    clearAuthCookies(res);
    return ok(res, null, "Password updated. Please sign in with your new password.");
  },
);

authRoutes.post(
  "/change-password",
  { summary: "Change password (signs out other sessions)", auth: "customer", body: schemas.changePasswordSchema, middleware: [authLimiter] },
  async (req, res) => {
    const { currentPassword, newPassword } = schemas.changePasswordSchema.parse(req.body);
    await auth.changePassword(req.auth!.userId, currentPassword, newPassword);
    const user = await auth.getUser(req.auth!.userId);
    const csrfToken = await startSession(req, res, user!);
    return ok(res, { csrfToken }, "Password changed.");
  },
);
