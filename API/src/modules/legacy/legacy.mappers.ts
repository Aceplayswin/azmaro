import type { Concentration, PaymentMethod, PaymentStatus, ShipmentStatus } from "../../db";
import { toAmount } from "../../utils/money";
import { variantAvailability, type ProductCardRow } from "../catalogue/catalogue.mapper";
import type { OrderRow } from "../orders/order.dto";

/**
 * Maps database rows onto the response shapes the existing web app (web/)
 * was built against (its src/types/catalogue.ts and src/types/api.ts), so the
 * storefront keeps working unchanged while running on the real backend.
 */

const CONCENTRATION: Record<Concentration, string> = { EDP: "EDP", EXTRAIT: "Extrait", EDT: "EDT", ATTAR: "Attar" };

export function legacyVariants(p: ProductCardRow) {
  return p.variants.map((v) => {
    const a = variantAvailability(v);
    return {
      sizeMl: v.sizeMl,
      sku: v.sku,
      price: toAmount(v.price),
      mrp: toAmount(v.mrp),
      stockStatus: a.stockStatus ? a.stockStatus.toLowerCase() : null,
      _purchasable: a.isPurchasable,
    };
  });
}

export function legacySummary(p: ProductCardRow) {
  const variants = legacyVariants(p);
  const priced = variants.filter((v) => v.price !== null).sort((a, b) => a.price! - b.price!);
  const cheapest = priced[0] ?? null;
  return {
    slug: p.slug,
    name: p.name,
    brandId: p.brand.slug,
    brandName: p.brand.name,
    brandLabel: p.brandLabel,
    scentFamilies: p.categories
      .filter((c) => c.category.type === "SCENT_FAMILY")
      .sort((a, b) => a.category.sortOrder - b.category.sortOrder)
      .map((c) => c.category.slug),
    gender: p.gender ? p.gender.toLowerCase() : null,
    concentration: p.concentration ? CONCENTRATION[p.concentration] : null,
    availableSizes: variants.map((v) => v.sizeMl),
    variants: variants.map(({ _purchasable, ...v }) => {
      void _purchasable;
      return v;
    }),
    price: cheapest?.price ?? null,
    mrp: cheapest?.mrp ?? null,
    stockStatus: cheapest?.stockStatus ?? null,
    isPurchasable: variants.some((v) => v._purchasable),
    isNew: p.isNew,
    isBestseller: p.isBestseller,
    isFeatured: p.isFeatured,
    noteBasis: p.noteBasis === "PUBLISHED" ? "published" : "editorial-impression",
    topNotes: p.topNotes,
    heartNotes: p.heartNotes,
    baseNotes: p.baseNotes,
    fragranceFamily: p.fragranceFamily,
    scentCharacter: p.scentCharacter,
    image: p.images[0] ? { src: p.images[0].url, alt: p.images[0].alt } : null,
    order: p.sortOrder,
  };
}

export function legacyProduct(p: ProductCardRow & { images: Array<{ url: string; alt: string }> }) {
  const s = legacySummary(p);
  return {
    ...s,
    id: p.slug,
    catalogueName: p.catalogueName,
    inventorySizeMl: p.inventorySizeMl,
    description: p.description,
    occasions: p.occasions,
    season: p.season,
    targetAudience: p.targetAudience,
    concentrationNote: p.concentrationNote,
    researchBasis: p.researchBasis,
    reviewNote: p.reviewNote,
    sku: s.variants.find((v) => v.price === s.price)?.sku ?? null,
    images: p.images.map((i) => ({ src: i.url, alt: i.alt })),
    imageSource: null,
    imageReviewStatus: p.images.length ? "approved" : "missing",
    isPublished: p.isPublished,
  };
}

export function legacyBrand(b: { id: string; slug: string; name: string; description: string | null; imageUrl: string | null; isPublished: boolean; isFeatured: boolean }, productCount: number) {
  return { id: b.slug, slug: b.slug, name: b.name, description: b.description, image: b.imageUrl, isPublished: b.isPublished, productCount, isFeatured: b.isFeatured };
}

const PAYMENT_STATUS: Partial<Record<PaymentStatus, string>> = {
  NOT_COLLECTED: "not_collected",
  PENDING: "pending",
  COD_PENDING: "cod_pending",
  PAID: "paid",
  AUTHORIZED: "paid",
  FAILED: "failed",
};

const SHIPMENT_EVENT: Partial<Record<ShipmentStatus, string>> = {
  BOOKED: "placed",
  PICKED_UP: "picked_up",
  IN_TRANSIT: "in_transit",
  OUT_FOR_DELIVERY: "out_for_delivery",
  DELIVERED: "delivered",
};

export function legacyEvents(o: OrderRow) {
  const placed = o.statusHistory[0];
  return [
    ...(placed ? [{ at: placed.createdAt.toISOString(), status: "placed", description: o.isTest ? "Test order created on the AZMARO storefront." : "Order received." }] : []),
    ...o.shipments.flatMap((s) =>
      s.events.map((e) => ({
        at: e.occurredAt.toISOString(),
        status: SHIPMENT_EVENT[e.status] ?? "exception",
        description: e.description,
        location: e.location,
      })),
    ),
  ];
}

export function legacyOrder(o: OrderRow, paymentRedirectUrl: string | null = null) {
  return {
    orderNumber: o.orderNumber,
    createdAt: o.createdAt.toISOString(),
    demo: o.isTest,
    email: o.email,
    phone: o.phone,
    address: {
      fullName: o.shipName,
      pin: o.shipPin,
      addressLine: o.shipLine1,
      landmark: o.shipLandmark ?? "",
      city: o.shipCity,
      state: o.shipState,
    },
    lines: o.items.map((i) => ({
      slug: i.productSlug,
      name: i.productName,
      brandName: i.brandName,
      sizeMl: i.sizeMl,
      qty: i.quantity,
      unitPrice: toAmount(i.unitPrice)!,
      lineTotal: toAmount(i.lineTotal)!,
    })),
    subtotal: toAmount(o.subtotal)!,
    discount: toAmount(o.discountTotal)!,
    delivery: toAmount(o.deliveryFee),
    total: toAmount(o.total)!,
    paymentMethod: o.paymentMethod.toLowerCase() as Lowercase<PaymentMethod>,
    paymentStatus: PAYMENT_STATUS[o.paymentStatus] ?? "pending",
    status: o.status === "PENDING_PAYMENT" ? "awaiting_payment" : "placed",
    paymentRedirectUrl,
    events: legacyEvents(o),
  };
}

export const LEGACY_STATUS_LABEL: Record<string, string> = {
  PENDING_PAYMENT: "Awaiting payment",
  PLACED: "Order placed",
  CONFIRMED: "Confirmed",
  PROCESSING: "Processing",
  SHIPPED: "Shipped",
  DELIVERED: "Delivered",
  CANCELLED: "Cancelled",
  RETURNED: "Returned",
};
