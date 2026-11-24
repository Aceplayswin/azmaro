import { z } from "zod";
import { env } from "../../config/env";
import { rateLimiters } from "../../middleware/security";
import { moduleRouter } from "../../routes/router";
import { safeEqual } from "../../utils/crypto";
import { AppError } from "../../utils/errors";
import { ok } from "../../utils/response";
import { orderNumber, pin } from "../../validators/common";
import { checkServiceability, handleCourierWebhook, trackOrder } from "./shipping.service";

const serviceabilitySchema = z.object({ pin, cod: z.boolean().default(false) });
const courierWebhookSchema = z.object({
  awb: z.string().trim().min(3).max(64),
  status: z.string().trim().min(2).max(60),
  description: z.string().max(500).optional(),
  location: z.string().max(160).optional(),
  occurredAt: z.string().max(40).optional(),
  eventId: z.string().max(120).optional(),
});
const trackSchema = z.object({ orderNumber, contact: z.string().trim().min(5).max(191).describe("Email or phone used at checkout") });

export const shippingRoutes = moduleRouter("/shipping", "Shipping");

shippingRoutes.post(
  "/serviceability",
  {
    summary: "Check PIN-code serviceability",
    description: "Returns courier data only when a courier is connected; otherwise status UNAVAILABLE with isTest=true. No estimates are invented.",
    body: serviceabilitySchema,
    middleware: [rateLimiters.forms()],
  },
  async (req, res) => {
    const input = serviceabilitySchema.parse(req.body);
    return ok(res, await checkServiceability(input.pin, input.cod));
  },
);

shippingRoutes.post(
  "/webhooks/courier",
  {
    summary: "Courier status webhook",
    description:
      "Authenticated with the shared secret in the `X-Courier-Token` header (COURIER_WEBHOOK_SECRET). Body: { awb, status, description?, location?, occurredAt?, eventId? }. Events are de-duplicated by eventId.",
    body: courierWebhookSchema,
  },
  async (req, res) => {
    const token = req.get("x-courier-token") ?? "";
    if (!env.COURIER_WEBHOOK_SECRET || !safeEqual(token, env.COURIER_WEBHOOK_SECRET)) {
      throw new AppError(401, "INVALID_SIGNATURE", "Courier webhook authentication failed.");
    }
    const result = await handleCourierWebhook(courierWebhookSchema.parse(req.body));
    return ok(res, { duplicate: result.duplicate }, result.duplicate ? "Duplicate event ignored." : "Event recorded.");
  },
);

export const trackingRoutes = moduleRouter("/tracking", "Tracking");

trackingRoutes.post(
  "/lookup",
  { summary: "Track an order with order number + email/phone", body: trackSchema, middleware: [rateLimiters.forms()] },
  async (req, res) => {
    const input = trackSchema.parse(req.body);
    return ok(res, await trackOrder(input.orderNumber, { contact: input.contact }));
  },
);

trackingRoutes.get("/orders/:orderNumber", { summary: "Track one of my orders", auth: "customer" }, async (req, res) => {
  return ok(res, await trackOrder(orderNumber.parse(req.params.orderNumber), { userId: req.auth!.userId }));
});
