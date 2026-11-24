import { Router } from "express";
import { adminCatalogueRoutes } from "../modules/admin/admin.catalogue.routes";
import { adminOperationsRoutes } from "../modules/admin/admin.operations.routes";
import { adminInsightsRoutes } from "../modules/admin/admin.insights.routes";
import { adminSystemRoutes } from "../modules/admin/admin.system.routes";
import { authRoutes } from "../modules/auth/auth.routes";
import { cartRoutes } from "../modules/cart/cart.routes";
import { brandsRoutes, categoriesRoutes, productsRoutes } from "../modules/catalogue/catalogue.routes";
import { checkoutRoutes } from "../modules/checkout/checkout.routes";
import { customersRoutes } from "../modules/customers/customers.routes";
import { ordersRoutes } from "../modules/orders/orders.routes";
import { paymentsRoutes } from "../modules/payments/payments.routes";
import { shippingRoutes, trackingRoutes } from "../modules/shipping/shipping.routes";
import { configRoutes, contactRoutes, faqsRoutes, newsletterRoutes } from "../modules/support/support.routes";
import { wishlistRoutes } from "../modules/wishlist/wishlist.routes";
import { systemRoutes } from "./system.routes";

/** /api/v1 – every module router is mounted at its own base path. */
export function buildV1Router() {
  const v1 = Router();
  const modules = [
    systemRoutes,
    authRoutes,
    productsRoutes,
    brandsRoutes,
    categoriesRoutes,
    cartRoutes,
    wishlistRoutes,
    checkoutRoutes,
    ordersRoutes,
    paymentsRoutes,
    shippingRoutes,
    trackingRoutes,
    customersRoutes,
    contactRoutes,
    newsletterRoutes,
    faqsRoutes,
    configRoutes,
    adminCatalogueRoutes,
    adminOperationsRoutes,
    adminSystemRoutes,
    adminInsightsRoutes,
  ];
  for (const m of modules) v1.use(m.basePath, m.router);
  return v1;
}

