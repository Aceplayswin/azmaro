import { createHash, createHmac, randomBytes, timingSafeEqual } from "node:crypto";

/** URL-safe random token (default 32 bytes ≈ 43 chars). */
export const randomToken = (bytes = 32) => randomBytes(bytes).toString("base64url");

/** SHA-256 hex – used to store tokens (refresh, reset, cart) without keeping the raw value. */
export const sha256 = (value: string) => createHash("sha256").update(value).digest("hex");

export const hmacSha256Hex = (secret: string, payload: string | Buffer) =>
  createHmac("sha256", secret).update(payload).digest("hex");

/** Constant-time string comparison (prevents timing attacks on signatures / tokens). */
export function safeEqual(a: string, b: string): boolean {
  const ab = Buffer.from(a);
  const bb = Buffer.from(b);
  if (ab.length !== bb.length) return false;
  return timingSafeEqual(ab, bb);
}

const ORDER_ALPHABET = "ABCDEFGHJKLMNPQRSTUVWXYZ23456789"; // no 0/O/1/I

export function orderNumber(): string {
  const bytes = randomBytes(7);
  let out = "";
  for (const b of bytes) out += ORDER_ALPHABET[b % ORDER_ALPHABET.length];
  return `AZM-${out}`;
}
