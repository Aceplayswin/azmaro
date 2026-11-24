import { z } from "zod";
import { moduleRouter } from "../../routes/router";
import { ok } from "../../utils/response";
import { slug } from "../../validators/common";
import * as w from "./wishlist.service";

const addSchema = z.object({ productSlug: slug });
const moveSchema = z.object({ sizeMl: z.number().int().positive().optional() });

export const wishlistRoutes = moduleRouter("/wishlist", "Wishlist");

wishlistRoutes.get("/", { summary: "Get the wishlist (guest or customer)", auth: "optional" }, async (req, res) => {
  const owner = w.wishlistOwner(req, res, false);
  return ok(res, w.wishlistDto(owner ? await w.findWishlist(owner) : null));
});

wishlistRoutes.post(
  "/items",
  { summary: "Save a product to the wishlist", auth: "optional", body: addSchema },
  async (req, res) => {
    const { productSlug } = addSchema.parse(req.body);
    return ok(res, w.wishlistDto(await w.addProduct(w.wishlistOwner(req, res, true)!, productSlug)), "Saved to wishlist.");
  },
);

wishlistRoutes.delete("/items/:productSlug", { summary: "Remove a product from the wishlist", auth: "optional" }, async (req, res) => {
  const owner = w.wishlistOwner(req, res, true)!;
  return ok(res, w.wishlistDto(await w.removeProduct(owner, slug.parse(req.params.productSlug))), "Removed from wishlist.");
});

wishlistRoutes.post(
  "/items/:productSlug/move-to-cart",
  { summary: "Move one product to the cart", auth: "optional", body: moveSchema },
  async (req, res) => {
    const { sizeMl } = moveSchema.parse(req.body ?? {});
    const owner = w.wishlistOwner(req, res, true)!;
    return ok(res, w.wishlistDto(await w.moveToCart(req, res, owner, slug.parse(req.params.productSlug), sizeMl)), "Moved to bag.");
  },
);

wishlistRoutes.post(
  "/move-all-to-cart",
  { summary: "Move all purchasable products to the cart", auth: "optional" },
  async (req, res) => {
    const owner = w.wishlistOwner(req, res, true)!;
    const result = await w.moveAllToCart(req, res, owner);
    return ok(
      res,
      { wishlist: w.wishlistDto(result.wishlist), moved: result.moved, skipped: result.skipped },
      result.moved.length ? `${result.moved.length} moved to bag.` : "Nothing could be moved yet.",
    );
  },
);
