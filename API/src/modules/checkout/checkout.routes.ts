import { z } from "zod";
import { env, integrations } from "../../config/env";
import { db, sql, type AddressRow, type OrderRecord } from "../../db";
import { moduleRouter } from "../../routes/router";
import { badRequest, notFound, unprocessable } from "../../utils/errors";
import { created, ok } from "../../utils/response";
import { addressInput, email, id, indianPhone, optionalText, paymentMethod } from "../../validators/common";
import * as cartService from "../cart/cart.service";
import { rememberCustomerDetails } from "../customers/address-book";
import { loadOrder, toOrderDto } from "../orders/order.dto";
import { placeOrder } from "../orders/order.service";
import { getSetting } from "../settings/settings.service";

export const checkoutSchema = z
  .object({
    email,
    phone: indianPhone,
    /** New delivery address (required unless addressId is given). */
    address: addressInput.optional(),
    /** Saved address id (signed-in customers). */
    addressId: id.optional(),
    saveAddress: z.boolean().default(false),
    paymentMethod,
    /** Overrides the code stored on the cart. */
    couponCode: z.string().trim().max(40).optional(),
    note: optionalText(500),
  })
  .refine((v) => v.address || v.addressId, { message: "Provide a delivery address.", path: ["address"] });

export const checkoutRoutes = moduleRouter("/checkout", "Checkout");

checkoutRoutes.get(
  "/options",
  { summary: "Payment methods and delivery-charge rules available at checkout", auth: "optional" },
  async (_req, res) => {
    const [payments, shipping] = await Promise.all([getSetting("payments"), getSetting("shipping")]);
    const online = integrations.payments.razorpay || env.INTEGRATION_MODE === "demo";
    return ok(res, {
      paymentMethods: [
        ...payments.onlineMethods.map((m) => ({ method: m, available: online, isTest: !integrations.payments.razorpay })),
        { method: "COD", available: payments.codEnabled, maxOrderInr: payments.codMaxOrderInr, isTest: false },
      ],
      delivery: { flatFeeInr: shipping.flatFeeInr, freeAboveInr: shipping.freeAboveInr },
      integrationMode: env.INTEGRATION_MODE,
      guestCheckout: true,
    });
  },
);

checkoutRoutes.post(
  "/",
  {
    summary: "Place an order from the current cart (guest or customer)",
    description:
      "Send an `Idempotency-Key` header (any unique string per checkout attempt) – retries with the same key return the original order instead of creating a duplicate. " +
      "For online methods the response `payment.clientAction` tells the frontend how to complete payment (e.g. open Razorpay Checkout). Without a configured provider the order is a clearly-marked test order with payment NOT_COLLECTED.",
    auth: "optional",
    body: checkoutSchema,
    successStatus: 201,
  },
  async (req, res) => {
    const input = checkoutSchema.parse(req.body);
    const idem = req.get("idempotency-key")?.trim();
    if (idem && !/^[A-Za-z0-9_\-:.]{8,80}$/.test(idem)) throw badRequest("Idempotency-Key must be 8–80 safe characters.");

    // Idempotent replay first: the cart is already empty after the original checkout.
    if (idem) {
      const row = await db.one<OrderRecord>(sql`SELECT * FROM orders WHERE idempotencyKey = ${idem}`);
      const existing = row ? await loadOrder(row) : null;
      if (existing) {
        const sameCustomer = req.auth ? existing.userId === req.auth.userId : existing.email === input.email;
        if (!sameCustomer) throw badRequest("This Idempotency-Key has already been used.", undefined, "IDEMPOTENCY_KEY_REUSED");
        return ok(res, { order: toOrderDto(existing), payment: null, replayed: true }, "Order already placed (idempotent replay).");
      }
    }

    let address = input.address;
    if (input.addressId) {
      if (!req.auth) throw badRequest("Sign in to use a saved address.");
      const saved = await db.one<AddressRow>(sql`SELECT * FROM addresses WHERE id = ${input.addressId} AND userId = ${req.auth.userId}`);
      if (!saved) throw notFound("Address");
      address = { label: saved.label ?? undefined, fullName: saved.fullName, phone: saved.phone, line1: saved.line1, line2: saved.line2 ?? undefined, landmark: saved.landmark ?? undefined, city: saved.city, state: saved.state, pin: saved.pin };
    }

    const owner = cartService.cartOwner(req, res, false);
    const cart = owner ? await cartService.findCart(owner) : null;
    if (!cart || !cart.items.length) throw unprocessable("Your bag is empty.", undefined, "CART_EMPTY");

    const result = await placeOrder({
      lines: cart.items.map((i) => ({ variantId: i.variantId, quantity: i.quantity })),
      email: req.auth?.email ?? input.email,
      phone: input.phone,
      address: address!,
      paymentMethod: input.paymentMethod,
      couponCode: input.couponCode ?? cart.couponCode,
      note: input.note,
      userId: req.auth?.userId ?? null,
      idempotencyKey: idem ?? null,
    });

    if (!result.replayed) {
      await cartService.clearCart(owner!);
      if (req.auth && input.saveAddress && input.address) await rememberCustomerDetails(req.auth.userId, input.address);
    }

    return created(
      res,
      { order: toOrderDto(result.order), payment: result.payment, replayed: result.replayed },
      result.replayed ? "Order already placed (idempotent replay)." : result.order.isTest ? "Test order placed." : "Order placed.",
    );
  },
);
