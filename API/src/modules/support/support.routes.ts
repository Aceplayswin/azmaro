import { z } from "zod";
import { env, integrations } from "../../config/env";
import { forwardContactMessage, forwardNewsletterSignup } from "../../integrations/messaging";
import { paymentIntegrationStatus } from "../../integrations/payments";
import { shippingIntegrationStatus } from "../../integrations/shipping";
import { db, insert, newId, sql, update } from "../../db";
import { rateLimiters } from "../../middleware/security";
import { moduleRouter } from "../../routes/router";
import { randomToken, sha256 } from "../../utils/crypto";
import { badRequest } from "../../utils/errors";
import { created, ok } from "../../utils/response";
import { email, indianPhone, nonEmpty, optionalText } from "../../validators/common";
import { getSetting } from "../settings/settings.service";

export const contactSchema = z.object({
  name: nonEmpty("Name", 120),
  email,
  phone: indianPhone.optional().or(z.literal("").transform(() => undefined)),
  orderNumber: optionalText(20),
  message: nonEmpty("Message", 3000, 10),
  /** Honeypot – must stay empty (bots fill every field). */
  website: z.string().max(0).optional(),
});
const newsletterSchema = z.object({ email, source: optionalText(60) });
const unsubscribeSchema = z.object({ token: z.string().length(64) });

/** Subscribe (or re-activate) an email. Idempotent. */
export async function subscribe(email: string, source: string) {
  await db.run(sql`
    INSERT INTO newsletter_subscribers (id, email, source, unsubscribeToken) VALUES (${newId()}, ${email}, ${source}, ${sha256(randomToken())})
    ON DUPLICATE KEY UPDATE status = 'SUBSCRIBED', unsubscribedAt = NULL`);
}

export const contactRoutes = moduleRouter("/contact", "Support");
contactRoutes.post(
  "/",
  { summary: "Submit the contact form", body: contactSchema, successStatus: 201, middleware: [rateLimiters.forms()] },
  async (req, res) => {
    const input = contactSchema.parse(req.body);
    const msgId = await insert(db, "contact_messages", {
      name: input.name,
      email: input.email,
      phone: input.phone ?? null,
      orderNumber: input.orderNumber ?? null,
      message: input.message,
      ipHash: req.ip ? sha256(req.ip) : null,
    });
    const { forwarded } = await forwardContactMessage({ id: msgId, ...input });
    return created(res, { id: msgId, forwarded }, "Thank you – your message has been received. Our team will reply as soon as possible.");
  },
);

export const newsletterRoutes = moduleRouter("/newsletter", "Support");
newsletterRoutes.post(
  "/subscribe",
  {
    summary: "Subscribe to the newsletter",
    description: "Idempotent: re-subscribing an existing email re-activates it. Responds identically for new and existing emails.",
    body: newsletterSchema,
    middleware: [rateLimiters.forms()],
  },
  async (req, res) => {
    const input = newsletterSchema.parse(req.body);
    await subscribe(input.email, input.source ?? "website");
    await forwardNewsletterSignup({ email: input.email, source: input.source ?? "website" });
    return ok(res, null, "Thank you – you're on the AZMARO list.");
  },
);
newsletterRoutes.post(
  "/unsubscribe",
  { summary: "Unsubscribe using the token from a newsletter email", body: unsubscribeSchema },
  async (req, res) => {
    const { token } = unsubscribeSchema.parse(req.body);
    const count = await update(db, "newsletter_subscribers", { status: "UNSUBSCRIBED", unsubscribedAt: new Date() }, sql`unsubscribeToken = ${token}`);
    if (!count) throw badRequest("This unsubscribe link is invalid.");
    return ok(res, null, "You have been unsubscribed.");
  },
);

export const faqsRoutes = moduleRouter("/faqs", "Support");
faqsRoutes.get("/", { summary: "Published FAQs" }, async (_req, res) => {
  const faqs = await db.many(sql`SELECT id, question, answer, category, sortOrder FROM faqs WHERE isPublished = 1 ORDER BY category ASC, sortOrder ASC`);
  return ok(res, faqs);
});

export const configRoutes = moduleRouter("/config", "Support");
configRoutes.get(
  "/public",
  { summary: "Public storefront configuration (support contacts incl. WhatsApp, integration status)" },
  async (_req, res) => {
    const support = await getSetting("support");
    return ok(res, {
      support: {
        ...support,
        whatsappUrl: support.whatsappNumber ? `https://wa.me/${support.whatsappNumber}` : null,
      },
      integrations: {
        mode: env.INTEGRATION_MODE,
        payments: paymentIntegrationStatus().provider,
        shipping: shippingIntegrationStatus().provider,
        email: integrations.email ? "webhook" : "development",
      },
    });
  },
);
