/**
 * Environment configuration – validated once at startup with Zod.
 * Secrets come only from the environment (API/.env locally, the host's secret
 * store in production). Never commit real values.
 */
import { z } from "zod";

const bool = (def: boolean) =>
  z
    .enum(["true", "false", "1", "0", ""])
    .optional()
    .transform((v) => (v === undefined || v === "" ? def : v === "true" || v === "1"));

const optionalString = z
  .string()
  .optional()
  .transform((v) => (v && v.trim() ? v.trim() : undefined));

const optionalNumber = z
  .string()
  .optional()
  .transform((v, ctx) => {
    if (v === undefined || v.trim() === "") return undefined;
    const n = Number(v);
    if (Number.isNaN(n)) {
      ctx.addIssue({ code: "custom", message: "must be a number" });
      return z.NEVER;
    }
    return n;
  });

const schema = z.object({
  NODE_ENV: z.enum(["development", "test", "production"]).default("development"),
  PORT: z.coerce.number().int().positive().default(4000),
  DATABASE_URL: z.string().min(1, "DATABASE_URL is required"),

  /** Comma-separated frontend origins allowed by CORS and the CSRF origin check. */
  CORS_ORIGINS: z.string().default("http://localhost:3000"),
  /** Public storefront URL – used for links in emails (verify email, reset password). */
  APP_URL: z.string().url().default("http://localhost:3000"),
  TRUST_PROXY: z.coerce.number().int().min(0).default(1),

  JWT_ACCESS_SECRET: z.string().min(32, "JWT_ACCESS_SECRET must be at least 32 characters"),
  JWT_REFRESH_SECRET: z.string().min(32, "JWT_REFRESH_SECRET must be at least 32 characters"),
  ACCESS_TOKEN_TTL_MINUTES: z.coerce.number().int().positive().default(15),
  REFRESH_TOKEN_TTL_DAYS: z.coerce.number().int().positive().default(30),
  COOKIE_SECURE: bool(false),
  COOKIE_DOMAIN: optionalString,
  BCRYPT_ROUNDS: z.coerce.number().int().min(4).max(15).default(12),

  /** demo = clearly labelled development adapters; live = refuse anything without real credentials */
  INTEGRATION_MODE: z.enum(["demo", "live"]).default("demo"),

  PAYMENT_PROVIDER: z.enum(["none", "razorpay"]).default("none"),
  RAZORPAY_KEY_ID: optionalString,
  RAZORPAY_KEY_SECRET: optionalString,
  RAZORPAY_WEBHOOK_SECRET: optionalString,

  SHIPPING_PROVIDER: z.enum(["none", "shiprocket"]).default("none"),
  SHIPROCKET_EMAIL: optionalString,
  SHIPROCKET_PASSWORD: optionalString,
  SHIPROCKET_PICKUP_LOCATION: optionalString,
  SHIPROCKET_PICKUP_PIN: optionalString,
  /** Shared secret couriers must send in the X-Courier-Token header on status webhooks. */
  COURIER_WEBHOOK_SECRET: optionalString,

  /** Optional webhooks that deliver emails / form submissions to an email service, CRM or automation tool. */
  EMAIL_WEBHOOK_URL: optionalString,
  CONTACT_WEBHOOK_URL: optionalString,
  NEWSLETTER_WEBHOOK_URL: optionalString,

  RATE_LIMIT_WINDOW_MINUTES: z.coerce.number().positive().default(15),
  RATE_LIMIT_MAX: z.coerce.number().int().positive().default(600),
  RATE_LIMIT_AUTH_MAX: z.coerce.number().int().positive().default(20),
  RATE_LIMIT_FORMS_MAX: z.coerce.number().int().positive().default(10),

  /** Keep the unversioned /api/* routes used by the current web app. */
  LEGACY_API_ENABLED: bool(true),
  /** Serve Swagger UI at /api/docs. */
  API_DOCS_ENABLED: bool(true),
  /** Where product images are downloaded (served by the web app). */
  WEB_PUBLIC_DIR: z.string().default("../web/public"),

  SEED_ADMIN_EMAIL: optionalString,
  SEED_ADMIN_PASSWORD: optionalString,
  SEED_ADMIN_NAME: optionalString,

  /** Optional delivery-fee seed values (admins can change them later via /admin/settings). */
  DELIVERY_FLAT_FEE_INR: optionalNumber,
  DELIVERY_FREE_ABOVE_INR: optionalNumber,
});

export type Env = z.infer<typeof schema>;

function load(): Env {
  const parsed = schema.safeParse(process.env);
  if (!parsed.success) {
    const issues = parsed.error.issues.map((i) => `  - ${i.path.join(".")}: ${i.message}`).join("\n");
    throw new Error(`Invalid environment configuration:\n${issues}\nSee API/.env.example.`);
  }
  const env = parsed.data;
  if (env.NODE_ENV === "production") {
    if (!env.COOKIE_SECURE) throw new Error("COOKIE_SECURE must be true in production.");
    if (/dev-only|change-me/i.test(env.JWT_ACCESS_SECRET + env.JWT_REFRESH_SECRET))
      throw new Error("Replace the development JWT secrets before running in production.");
  }
  return env;
}

export const env: Env = load();

export const corsOrigins = env.CORS_ORIGINS.split(",")
  .map((o) => o.trim().replace(/\/$/, ""))
  .filter(Boolean);

export const isTest = env.NODE_ENV === "test";
export const isProduction = env.NODE_ENV === "production";

export const integrations = {
  payments: {
    razorpay:
      env.PAYMENT_PROVIDER === "razorpay" && Boolean(env.RAZORPAY_KEY_ID && env.RAZORPAY_KEY_SECRET),
    webhookSecretConfigured: Boolean(env.RAZORPAY_WEBHOOK_SECRET),
  },
  shipping: {
    shiprocket:
      env.SHIPPING_PROVIDER === "shiprocket" && Boolean(env.SHIPROCKET_EMAIL && env.SHIPROCKET_PASSWORD),
    webhookSecretConfigured: Boolean(env.COURIER_WEBHOOK_SECRET),
  },
  email: Boolean(env.EMAIL_WEBHOOK_URL),
};
