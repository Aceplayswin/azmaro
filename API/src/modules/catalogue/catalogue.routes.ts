import { moduleRouter } from "../../routes/router";
import * as c from "./catalogue.controller";
import { productListQuery } from "./products.schemas";

export const productsRoutes = moduleRouter("/products", "Products");
productsRoutes.get(
  "/",
  {
    summary: "List / search / filter products",
    description:
      "Search matches name, brand, scent family and (only for verified pyramids) notes. Prices are null until confirmed; `priceStatus` says which. Sorts: featured, relevance, name-asc, name-desc, brand, price-asc, price-desc, newest.",
    query: productListQuery,
    response: "Array of product cards, with pagination meta",
  },
  c.listProductsHandler,
);
productsRoutes.get("/facets", { summary: "Filter facets derived from live catalogue data" }, c.facetsHandler);
productsRoutes.get("/:slug", { summary: "Product details + related products" }, c.productDetailHandler);

export const brandsRoutes = moduleRouter("/brands", "Brands");
brandsRoutes.get("/", { summary: "Brand directory (brands with published products)", query: c.brandListQuery }, c.listBrandsHandler);
brandsRoutes.get("/:slug", { summary: "Brand details" }, c.brandDetailHandler);
brandsRoutes.get(
  "/:slug/products",
  { summary: "Products of a brand", query: c.brandProductsQuery },
  c.brandProductsHandler,
);

export const categoriesRoutes = moduleRouter("/categories", "Categories");
categoriesRoutes.get(
  "/",
  { summary: "Fragrance categories and scent-family filters", query: c.categoryListQuery },
  c.listCategoriesHandler,
);
categoriesRoutes.get("/:slug", { summary: "Category details" }, c.categoryDetailHandler);
