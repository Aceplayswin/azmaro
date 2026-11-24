import bcrypt from "bcryptjs";
import { env } from "../../config/env";
import { db, insert, sql, transaction, update, type AuthTokenRow, type AuthTokenType, type RoleRow, type SessionRow, type UserRow } from "../../db";
import { sendEmail } from "../../integrations/messaging";
import { randomToken, sha256 } from "../../utils/crypto";
import { AppError, conflict, unauthorized } from "../../utils/errors";
import { refreshTtlMs } from "./tokens";

/**
 * Authentication service – bcrypt password hashing, refresh sessions with
 * rotation + reuse detection, one-time email verification / reset tokens.
 * Only token hashes are stored.
 */

const EMAIL_TOKEN_TTL_MS = 24 * 3_600_000;
const RESET_TOKEN_TTL_MS = 60 * 60_000;
// Used to keep login timing similar whether or not the email exists.
const DUMMY_HASH = bcrypt.hashSync("timing-equaliser-not-a-password", 10);

export const hashPassword = (plain: string) => bcrypt.hash(plain, env.BCRYPT_ROUNDS);

export interface SessionMeta {
  userAgent?: string;
  ip?: string;
}

export type UserWithRole = UserRow & { role: RoleRow };

const findUser = (by: { id: string } | { email: string }) =>
  db.one<UserRow>("id" in by ? sql`SELECT * FROM users WHERE id = ${by.id}` : sql`SELECT * FROM users WHERE email = ${by.email}`);

/** A user (by id or email) with their role, or null. */
export async function findUserWithRole(by: { id: string } | { email: string }): Promise<UserWithRole | null> {
  const user = await findUser(by);
  if (!user) return null;
  const role = await db.one<RoleRow>(sql`SELECT * FROM roles WHERE id = ${user.roleId}`);
  return { ...user, role: role! };
}

export function toUserDto(user: UserWithRole) {
  const permissions = Array.isArray(user.role.permissions) ? (user.role.permissions as string[]) : [];
  return {
    id: user.id,
    name: user.name,
    email: user.email,
    phone: user.phone,
    emailVerified: Boolean(user.emailVerifiedAt),
    role: user.role.name,
    isAdmin: permissions.includes("*") || permissions.includes("admin:access"),
    permissions: user.role.name === "CUSTOMER" ? [] : permissions,
    createdAt: user.createdAt,
  };
}

async function issueOneTimeToken(userId: string, type: AuthTokenType, ttlMs: number) {
  // Invalidate earlier unused tokens of the same type.
  await update(db, "auth_tokens", { usedAt: new Date() }, sql`userId = ${userId} AND type = ${type} AND usedAt IS NULL`);
  const raw = randomToken(32);
  await insert(db, "auth_tokens", { userId, type, tokenHash: sha256(raw), expiresAt: new Date(Date.now() + ttlMs) });
  return raw;
}

async function consumeOneTimeToken(raw: string, type: AuthTokenType) {
  const token = await db.one<AuthTokenRow>(sql`SELECT * FROM auth_tokens WHERE tokenHash = ${sha256(raw)}`);
  if (!token || token.type !== type || token.usedAt || token.expiresAt < new Date()) {
    throw new AppError(400, "TOKEN_INVALID", "This link is invalid or has expired. Please request a new one.");
  }
  // Atomic single use: only one request can flip usedAt from null.
  const count = await update(db, "auth_tokens", { usedAt: new Date() }, sql`id = ${token.id} AND usedAt IS NULL`);
  if (count !== 1) throw new AppError(400, "TOKEN_INVALID", "This link has already been used.");
  return token;
}

export async function sendVerificationEmail(user: { id: string; email: string; name: string }) {
  const raw = await issueOneTimeToken(user.id, "EMAIL_VERIFICATION", EMAIL_TOKEN_TTL_MS);
  const link = `${env.APP_URL}/account/verify-email?token=${encodeURIComponent(raw)}`;
  await sendEmail({
    to: user.email,
    subject: "Verify your AZMARO email",
    template: "verify-email",
    text: `Hello ${user.name}, please verify your email: ${link}`,
    data: { name: user.name, link, token: raw },
  });
}

export async function register(input: { name: string; email: string; password: string; phone?: string }) {
  const existing = await findUser({ email: input.email });
  if (existing) throw conflict("An account with this email already exists. Please sign in.", undefined, "EMAIL_TAKEN");
  const role = await db.one<RoleRow>(sql`SELECT * FROM roles WHERE name = 'CUSTOMER'`);
  if (!role) throw new Error("CUSTOMER role missing – run the seed.");
  const id = await insert(db, "users", {
    name: input.name,
    email: input.email,
    phone: input.phone ?? null,
    passwordHash: await hashPassword(input.password),
    roleId: role.id,
  });
  const user = (await findUserWithRole({ id }))!;
  await sendVerificationEmail(user);
  return user;
}

export async function verifyCredentials(email: string, password: string) {
  const user = await findUserWithRole({ email });
  const valid = await bcrypt.compare(password, user?.passwordHash ?? DUMMY_HASH);
  if (!user || !valid) throw unauthorized("Incorrect email or password.", "INVALID_CREDENTIALS");
  if (!user.isActive) throw new AppError(403, "ACCOUNT_DISABLED", "This account has been disabled. Please contact support.");
  await update(db, "users", { lastLoginAt: new Date() }, sql`id = ${user.id}`);
  return user;
}

export async function createSession(userId: string, meta: SessionMeta) {
  const raw = randomToken(48);
  await insert(db, "sessions", {
    userId,
    refreshTokenHash: sha256(raw),
    userAgent: meta.userAgent?.slice(0, 255),
    ip: meta.ip?.slice(0, 64),
    expiresAt: new Date(Date.now() + refreshTtlMs()),
  });
  return raw;
}

/**
 * Refresh-token rotation. Presenting a token that was already rotated/revoked
 * is treated as theft: every session for that user is revoked and access
 * tokens are invalidated via tokenVersion.
 */
export async function rotateSession(rawRefresh: string, meta: SessionMeta) {
  const session = await db.one<SessionRow>(sql`SELECT * FROM sessions WHERE refreshTokenHash = ${sha256(rawRefresh)}`);
  if (!session) throw unauthorized("Your session has expired. Please sign in again.", "SESSION_INVALID");
  if (session.revokedAt) {
    await revokeAllSessions(session.userId);
    throw unauthorized("Your session is no longer valid. Please sign in again.", "SESSION_REUSED");
  }
  if (session.expiresAt < new Date()) throw unauthorized("Your session has expired. Please sign in again.", "SESSION_EXPIRED");
  const user = await findUserWithRole({ id: session.userId });
  if (!user || !user.isActive) throw unauthorized("Your session is no longer valid.", "SESSION_INVALID");

  const count = await update(db, "sessions", { revokedAt: new Date() }, sql`id = ${session.id} AND revokedAt IS NULL`);
  if (count !== 1) throw unauthorized("Your session is no longer valid. Please sign in again.", "SESSION_REUSED");
  const newRaw = await createSession(user.id, meta);
  return { user, refreshToken: newRaw };
}

export async function revokeSession(rawRefresh: string | undefined) {
  if (!rawRefresh) return;
  await update(db, "sessions", { revokedAt: new Date() }, sql`refreshTokenHash = ${sha256(rawRefresh)} AND revokedAt IS NULL`);
}

export async function revokeAllSessions(userId: string) {
  await transaction(async (tx) => {
    await update(tx, "sessions", { revokedAt: new Date() }, sql`userId = ${userId} AND revokedAt IS NULL`);
    await tx.run(sql`UPDATE users SET tokenVersion = tokenVersion + 1 WHERE id = ${userId}`);
  });
}

export async function verifyEmail(raw: string) {
  const token = await consumeOneTimeToken(raw, "EMAIL_VERIFICATION");
  await update(db, "users", { emailVerifiedAt: new Date() }, sql`id = ${token.userId}`);
}

/** Always resolves the same way whether or not the email exists (no account enumeration). */
export async function forgotPassword(email: string) {
  const user = await findUser({ email });
  if (!user || !user.isActive) return;
  const raw = await issueOneTimeToken(user.id, "PASSWORD_RESET", RESET_TOKEN_TTL_MS);
  const link = `${env.APP_URL}/account/reset-password?token=${encodeURIComponent(raw)}`;
  await sendEmail({
    to: user.email,
    subject: "Reset your AZMARO password",
    template: "password-reset",
    text: `Hello ${user.name}, reset your password within 60 minutes: ${link}`,
    data: { name: user.name, link, token: raw },
  });
}

export async function resetPassword(raw: string, newPassword: string) {
  const token = await consumeOneTimeToken(raw, "PASSWORD_RESET");
  await update(db, "users", { passwordHash: await hashPassword(newPassword) }, sql`id = ${token.userId}`);
  await revokeAllSessions(token.userId);
}

export async function changePassword(userId: string, current: string, next: string) {
  const user = await findUser({ id: userId });
  if (!user) throw unauthorized();
  if (!(await bcrypt.compare(current, user.passwordHash))) {
    throw new AppError(400, "INVALID_CURRENT_PASSWORD", "Your current password is incorrect.");
  }
  await update(db, "users", { passwordHash: await hashPassword(next) }, sql`id = ${userId}`);
  await revokeAllSessions(userId);
}

export const getUser = (id: string) => findUserWithRole({ id });
