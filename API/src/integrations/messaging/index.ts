import { env, isProduction, isTest } from "../../config/env";

/**
 * Outbound messaging. With EMAIL_WEBHOOK_URL / CONTACT_WEBHOOK_URL /
 * NEWSLETTER_WEBHOOK_URL configured, payloads are POSTed to your email service
 * or automation tool. Without them, development mode keeps messages in an
 * in-memory outbox (and logs a one-line notice) – nothing is claimed as sent.
 */
export interface OutboundEmail {
  to: string;
  subject: string;
  template: "verify-email" | "password-reset" | "order-confirmation" | "order-cancelled";
  text: string;
  data: Record<string, unknown>;
}

const outbox: Array<OutboundEmail & { at: string }> = [];

/** Development / test inspection of emails that would have been sent. */
export const devOutbox = () => outbox;

async function postJson(url: string, payload: unknown): Promise<boolean> {
  try {
    const res = await fetch(url, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(payload),
      signal: AbortSignal.timeout(8000),
    });
    return res.ok;
  } catch {
    return false;
  }
}

export async function sendEmail(email: OutboundEmail): Promise<{ delivered: boolean; mode: "webhook" | "development" }> {
  if (env.EMAIL_WEBHOOK_URL) {
    return { delivered: await postJson(env.EMAIL_WEBHOOK_URL, { type: "email", ...email }), mode: "webhook" };
  }
  outbox.push({ ...email, at: new Date().toISOString() });
  if (outbox.length > 200) outbox.shift();
  if (!isTest && !isProduction) console.info(`[email:dev] ${email.template} → ${email.to} (not sent – no EMAIL_WEBHOOK_URL)`);
  return { delivered: false, mode: "development" };
}

export async function forwardContactMessage(payload: Record<string, unknown>) {
  if (!env.CONTACT_WEBHOOK_URL) return { forwarded: false };
  return { forwarded: await postJson(env.CONTACT_WEBHOOK_URL, { type: "contact", ...payload }) };
}

export async function forwardNewsletterSignup(payload: Record<string, unknown>) {
  if (!env.NEWSLETTER_WEBHOOK_URL) return { forwarded: false };
  return { forwarded: await postJson(env.NEWSLETTER_WEBHOOK_URL, { type: "newsletter", ...payload }) };
}
