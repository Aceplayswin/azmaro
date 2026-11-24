import { z } from "zod";
import { moduleRouter } from "../../routes/router";
import { rateLimiters } from "../../middleware/security";
import { buildMeta, paginationQuery } from "../../utils/pagination";
import { ok, paginated } from "../../utils/response";
import { orderNumber } from "../../validators/common";
import { toOrderDto } from "./order.dto";
import { cancelOrder, findOrderForCustomer, listOrdersForUser } from "./order.service";

const lookupSchema = z.object({ orderNumber, contact: z.string().trim().min(5).max(191).describe("Email or phone used at checkout") });
const cancelSchema = z.object({
  reason: z.string().trim().min(3).max(255).default("Cancelled by customer"),
  contact: z.string().trim().max(191).optional().describe("Guests: email or phone used at checkout"),
});

export const ordersRoutes = moduleRouter("/orders", "Orders");
const formsLimiter = rateLimiters.forms();

ordersRoutes.get(
  "/",
  { summary: "Order history for the signed-in customer", auth: "customer", query: paginationQuery },
  async (req, res) => {
    const q = paginationQuery.parse(req.query);
    const { total, rows } = await listOrdersForUser(req.auth!.userId, q.page, q.pageSize);
    return paginated(res, rows.map(toOrderDto), buildMeta(q, total));
  },
);

ordersRoutes.post(
  "/lookup",
  { summary: "Guest order confirmation lookup (order number + email/phone)", body: lookupSchema, middleware: [formsLimiter] },
  async (req, res) => {
    const input = lookupSchema.parse(req.body);
    return ok(res, toOrderDto(await findOrderForCustomer(input.orderNumber, { contact: input.contact })));
  },
);

ordersRoutes.get("/:orderNumber", { summary: "Order details (owner only)", auth: "customer" }, async (req, res) => {
  const order = await findOrderForCustomer(orderNumber.parse(req.params.orderNumber), { userId: req.auth!.userId });
  return ok(res, toOrderDto(order));
});

ordersRoutes.post(
  "/:orderNumber/cancel",
  {
    summary: "Cancel an order (per the configured cancellation policy)",
    description: "Signed-in owners can cancel directly; guests must also send the email/phone used at checkout as `contact`.",
    auth: "optional",
    body: cancelSchema,
  },
  async (req, res) => {
    const number = orderNumber.parse(req.params.orderNumber);
    const input = cancelSchema.parse(req.body ?? {});
    await findOrderForCustomer(number, { userId: req.auth?.userId, contact: input.contact });
    const order = await cancelOrder(number, req.auth?.userId ?? "customer", input.reason);
    return ok(res, toOrderDto(order), "Order cancelled.");
  },
);
