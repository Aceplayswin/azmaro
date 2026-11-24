import { z } from "zod";
import { csvList, booleanQuery } from "../../validators/common";
import { paginationQuery } from "../../utils/pagination";

const upperList = <T extends string>(values: readonly [T, ...T[]]) =>
  csvList.transform((list, ctx) => {
    const out: T[] = [];
    for (const raw of list) {
      const v = raw.toUpperCase() as T;
      if (!values.includes(v)) {
        ctx.addIssue({ code: "custom", message: `Unknown value "${raw}". Use: ${values.join(", ")}` });
        return z.NEVER;
      }
      out.push(v);
    }
    return out;
  });

export const SORTS = ["featured", "relevance", "name-asc", "name-desc", "brand", "price-asc", "price-desc", "newest"] as const;

export const productListQuery = paginationQuery.extend({
  q: z.string().trim().max(80).optional(),
  brand: csvList.describe("Brand slugs, comma separated"),
  family: csvList.describe("Category (scent-family) slugs, comma separated"),
  gender: upperList(["MEN", "WOMEN", "UNISEX"] as const),
  concentration: upperList(["EDP", "EXTRAIT", "EDT", "ATTAR"] as const),
  size: csvList.transform((l) => l.map(Number).filter((n) => Number.isInteger(n) && n > 0)).describe("Sizes in ml"),
  minPrice: z.coerce.number().nonnegative().optional(),
  maxPrice: z.coerce.number().nonnegative().optional(),
  featured: booleanQuery.optional(),
  purchasable: booleanQuery.optional().describe("Only products with a confirmed price that can be ordered"),
  tag: z.enum(["new", "bestseller"]).optional(),
  sort: z.enum(SORTS).optional(),
});

export type ProductListQuery = z.infer<typeof productListQuery>;
