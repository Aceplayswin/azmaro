import type { Request, Response } from "express";
import { z } from "zod";
import { moduleRouter } from "../../routes/router";
import { ok } from "../../utils/response";
import { id, pin, slug } from "../../validators/common";
import * as cart from "./cart.service";

export const addItemSchema = z
  .object({
    variantId: id.optional(),
    productSlug: slug.optional(),
    sizeMl: z.number().int().positive().optional(),
    quantity: z.number().int().min(1).max(50).default(1),
  })
  .refine((v) => v.variantId || (v.productSlug && v.sizeMl), "Provide variantId, or productSlug and sizeMl.");

const quantitySchema = z.object({ quantity: z.number().int().min(1).max(50) });
const couponSchema = z.object({ code: z.string().trim().min(2).max(40) });
const pinSchema = z.object({ pin });

const respond = async (req: Request, res: Response, c: Awaited<ReturnType<typeof cart.findCart>>, message = "OK") =>
  ok(res, await cart.cartDto(c, req.auth?.email), message);

export const cartRoutes = moduleRouter("/cart", "Cart");

cartRoutes.get(
  "/",
  { summary: "Get the current cart (guest or customer) with subtotal, discount, delivery and total", auth: "optional" },
  async (req, res) => {
    const owner = cart.cartOwner(req, res, false);
    return respond(req, res, owner ? await cart.findCart(owner) : null);
  },
);

cartRoutes.post(
  "/items",
  { summary: "Add a product variant to the cart", auth: "optional", body: addItemSchema, successStatus: 200 },
  async (req, res) => {
    const input = addItemSchema.parse(req.body);
    return respond(req, res, await cart.addItem(cart.cartOwner(req, res, true)!, input), "Added to bag.");
  },
);

cartRoutes.patch(
  "/items/:variantId",
  { summary: "Update the quantity of a cart line", auth: "optional", body: quantitySchema },
  async (req, res) => {
    const { quantity } = quantitySchema.parse(req.body);
    const owner = cart.cartOwner(req, res, true)!;
    return respond(req, res, await cart.updateItem(owner, id.parse(req.params.variantId), quantity), "Quantity updated.");
  },
);

cartRoutes.delete(
  "/items/:variantId",
  { summary: "Remove a line from the cart", auth: "optional" },
  async (req, res) => {
    const owner = cart.cartOwner(req, res, true)!;
    return respond(req, res, await cart.removeItem(owner, id.parse(req.params.variantId)), "Removed from bag.");
  },
);

cartRoutes.delete("/", { summary: "Empty the cart", auth: "optional" }, async (req, res) => {
  const owner = cart.cartOwner(req, res, true)!;
  return respond(req, res, await cart.clearCart(owner), "Bag cleared.");
});

cartRoutes.post(
  "/coupon",
  { summary: "Apply a discount code", auth: "optional", body: couponSchema },
  async (req, res) => {
    const { code } = couponSchema.parse(req.body);
    const owner = cart.cartOwner(req, res, true)!;
    return respond(req, res, await cart.applyCoupon(owner, code, req.auth?.email), "Discount applied.");
  },
);

cartRoutes.delete("/coupon", { summary: "Remove the discount code", auth: "optional" }, async (req, res) => {
  const owner = cart.cartOwner(req, res, true)!;
  return respond(req, res, await cart.removeCoupon(owner), "Discount removed.");
});

cartRoutes.put(
  "/delivery-pin",
  { summary: "Set delivery PIN and check serviceability", auth: "optional", body: pinSchema },
  async (req, res) => {
    const { pin: value } = pinSchema.parse(req.body);
    const owner = cart.cartOwner(req, res, true)!;
    const result = await cart.setDeliveryPin(owner, value);
    return ok(res, { cart: await cart.cartDto(result.cart, req.auth?.email), serviceability: result.serviceability });
  },
);
