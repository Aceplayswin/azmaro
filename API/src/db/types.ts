import type Decimal from "decimal.js";

/**
 * Row types for every table (db/migrations/*.sql), exactly as mysql2 returns
 * them: BOOLEAN → boolean, DECIMAL → Decimal, DATETIME → Date, JSON → parsed.
 */

// ─── Enums (MySQL ENUM columns) ───

export const ORDER_STATUSES = ["PENDING_PAYMENT", "PLACED", "CONFIRMED", "PROCESSING", "SHIPPED", "DELIVERED", "CANCELLED", "RETURNED"] as const;
export const SHIPMENT_STATUSES = ["PENDING", "BOOKED", "PICKED_UP", "IN_TRANSIT", "OUT_FOR_DELIVERY", "DELIVERED", "RETURN_TO_ORIGIN", "CANCELLED", "EXCEPTION"] as const;

export type AuthTokenType = "EMAIL_VERIFICATION" | "PASSWORD_RESET";
export type CategoryType = "SCENT_FAMILY" | "COLLECTION";
export type NoteBasis = "PUBLISHED" | "EDITORIAL_IMPRESSION";
export type Gender = "MEN" | "WOMEN" | "UNISEX";
export type Concentration = "EDP" | "EXTRAIT" | "EDT" | "ATTAR";
export type StockStatus = "IN_STOCK" | "LOW_STOCK" | "OUT_OF_STOCK" | "PREORDER";
export type ImageStatus = "APPROVED" | "PENDING_REVIEW" | "REJECTED";
export type OrderStatus = (typeof ORDER_STATUSES)[number];
export type PaymentMethod = "UPI" | "CARD" | "NETBANKING" | "COD";
export type PaymentStatus =
  | "NOT_COLLECTED"
  | "PENDING"
  | "AUTHORIZED"
  | "PAID"
  | "FAILED"
  | "COD_PENDING"
  | "REFUND_PENDING"
  | "REFUNDED"
  | "CANCELLED";
export type ShipmentStatus = (typeof SHIPMENT_STATUSES)[number];
export type EventSource = "COURIER" | "ADMIN" | "SYSTEM";
export type CouponType = "PERCENT" | "FLAT";
export type ContactStatus = "NEW" | "IN_PROGRESS" | "RESOLVED" | "SPAM";
export type SubscriberStatus = "SUBSCRIBED" | "UNSUBSCRIBED";

// ─── Identity ───

export interface RoleRow {
  id: number;
  name: string;
  description: string | null;
  permissions: unknown;
  createdAt: Date;
  updatedAt: Date;
}

export interface UserRow {
  id: string;
  email: string;
  passwordHash: string;
  name: string;
  phone: string | null;
  emailVerifiedAt: Date | null;
  isActive: boolean;
  tokenVersion: number;
  lastLoginAt: Date | null;
  roleId: number;
  createdAt: Date;
  updatedAt: Date;
}

export interface SessionRow {
  id: string;
  userId: string;
  refreshTokenHash: string;
  userAgent: string | null;
  ip: string | null;
  expiresAt: Date;
  revokedAt: Date | null;
  createdAt: Date;
}

export interface AuthTokenRow {
  id: string;
  userId: string;
  type: AuthTokenType;
  tokenHash: string;
  expiresAt: Date;
  usedAt: Date | null;
  createdAt: Date;
}

export interface AddressRow {
  id: string;
  userId: string;
  label: string | null;
  fullName: string;
  phone: string;
  line1: string;
  line2: string | null;
  landmark: string | null;
  city: string;
  state: string;
  pin: string;
  isDefault: boolean;
  createdAt: Date;
  updatedAt: Date;
}

// ─── Catalogue ───

export interface BrandRow {
  id: string;
  slug: string;
  name: string;
  description: string | null;
  imageUrl: string | null;
  isPublished: boolean;
  isFeatured: boolean;
  featuredRank: number | null;
  createdAt: Date;
  updatedAt: Date;
}

export interface CategoryRow {
  id: string;
  slug: string;
  name: string;
  shortName: string | null;
  description: string | null;
  type: CategoryType;
  sortOrder: number;
  imageUrl: string | null;
  isPublished: boolean;
  createdAt: Date;
  updatedAt: Date;
}

export interface ProductRow {
  id: string;
  slug: string;
  name: string;
  catalogueName: string;
  brandId: string;
  brandLabel: string;
  fragranceFamily: string;
  noteBasis: NoteBasis;
  topNotes: string;
  heartNotes: string;
  baseNotes: string;
  scentCharacter: string;
  description: string | null;
  occasions: string;
  season: string;
  targetAudience: string | null;
  gender: Gender | null;
  concentration: Concentration | null;
  concentrationNote: string | null;
  researchBasis: string | null;
  reviewNote: string | null;
  inventorySizeMl: number | null;
  isPublished: boolean;
  isFeatured: boolean;
  featuredRank: number | null;
  isNew: boolean;
  isBestseller: boolean;
  sortOrder: number;
  minPrice: Decimal | null;
  createdAt: Date;
  updatedAt: Date;
}

export interface ProductCategoryRow {
  productId: string;
  categoryId: string;
}

export interface ProductVariantRow {
  id: string;
  productId: string;
  sizeMl: number;
  sku: string | null;
  price: Decimal | null;
  mrp: Decimal | null;
  isActive: boolean;
  createdAt: Date;
  updatedAt: Date;
}

export interface InventoryRow {
  id: string;
  variantId: string;
  quantity: number | null;
  stockStatus: StockStatus | null;
  lowStockAt: number | null;
  updatedAt: Date;
}

export interface ProductImageRow {
  id: string;
  productId: string;
  url: string;
  alt: string;
  sortOrder: number;
  status: ImageStatus;
  sourceUrl: string | null;
  sourcePageUrl: string | null;
  workbookStatus: string | null;
  notes: string | null;
  createdAt: Date;
  updatedAt: Date;
}

// ─── Cart & wishlist ───

export interface CartRow {
  id: string;
  userId: string | null;
  guestTokenHash: string | null;
  couponCode: string | null;
  deliveryPin: string | null;
  expiresAt: Date | null;
  createdAt: Date;
  updatedAt: Date;
}

export interface CartItemRow {
  id: string;
  cartId: string;
  variantId: string;
  quantity: number;
  createdAt: Date;
  updatedAt: Date;
}

export interface WishlistRow {
  id: string;
  userId: string | null;
  guestTokenHash: string | null;
  createdAt: Date;
  updatedAt: Date;
}

export interface WishlistItemRow {
  id: string;
  wishlistId: string;
  productId: string;
  createdAt: Date;
}

// ─── Orders ───

export interface OrderRecord {
  id: string;
  orderNumber: string;
  idempotencyKey: string | null;
  userId: string | null;
  email: string;
  phone: string;
  status: OrderStatus;
  paymentMethod: PaymentMethod;
  paymentStatus: PaymentStatus;
  subtotal: Decimal;
  discountTotal: Decimal;
  deliveryFee: Decimal | null;
  total: Decimal;
  currency: string;
  couponCode: string | null;
  shipName: string;
  shipPhone: string;
  shipLine1: string;
  shipLine2: string | null;
  shipLandmark: string | null;
  shipCity: string;
  shipState: string;
  shipPin: string;
  customerNote: string | null;
  isTest: boolean;
  cancelledAt: Date | null;
  cancelReason: string | null;
  createdAt: Date;
  updatedAt: Date;
}

export interface OrderItemRow {
  id: string;
  orderId: string;
  productId: string | null;
  variantId: string | null;
  productSlug: string;
  productName: string;
  brandName: string;
  sizeMl: number;
  sku: string | null;
  unitPrice: Decimal;
  quantity: number;
  lineTotal: Decimal;
}

export interface OrderStatusHistoryRow {
  id: string;
  orderId: string;
  status: OrderStatus;
  note: string | null;
  actor: string;
  createdAt: Date;
}

// ─── Payments ───

export interface PaymentRow {
  id: string;
  orderId: string;
  provider: string;
  method: PaymentMethod;
  status: PaymentStatus;
  amount: Decimal;
  currency: string;
  providerOrderId: string | null;
  providerPaymentId: string | null;
  idempotencyKey: string;
  failureReason: string | null;
  providerStatus: string | null;
  isTest: boolean;
  createdAt: Date;
  updatedAt: Date;
}

export interface PaymentWebhookEventRow {
  id: string;
  provider: string;
  eventId: string;
  eventType: string;
  payload: unknown;
  processedAt: Date | null;
  error: string | null;
  createdAt: Date;
}

// ─── Shipping ───

export interface ShipmentRow {
  id: string;
  orderId: string;
  provider: string;
  courier: string | null;
  awb: string | null;
  status: ShipmentStatus;
  labelUrl: string | null;
  providerShipmentId: string | null;
  createdAt: Date;
  updatedAt: Date;
}

export interface ShipmentEventRow {
  id: string;
  shipmentId: string;
  status: ShipmentStatus;
  description: string;
  location: string | null;
  occurredAt: Date;
  source: EventSource;
  externalId: string | null;
  createdAt: Date;
}

// ─── Promotions ───

export interface CouponRow {
  id: string;
  code: string;
  description: string | null;
  type: CouponType;
  value: Decimal;
  minSubtotal: Decimal | null;
  maxDiscount: Decimal | null;
  startsAt: Date | null;
  endsAt: Date | null;
  usageLimit: number | null;
  usedCount: number;
  perUserLimit: number | null;
  isActive: boolean;
  createdAt: Date;
  updatedAt: Date;
}

export interface CouponRedemptionRow {
  id: string;
  couponId: string;
  orderId: string;
  email: string;
  amount: Decimal;
  createdAt: Date;
}

// ─── Support ───

export interface ContactMessageRow {
  id: string;
  name: string;
  email: string;
  phone: string | null;
  orderNumber: string | null;
  message: string;
  status: ContactStatus;
  adminNote: string | null;
  ipHash: string | null;
  createdAt: Date;
  updatedAt: Date;
}

export interface NewsletterSubscriberRow {
  id: string;
  email: string;
  status: SubscriberStatus;
  source: string | null;
  unsubscribeToken: string;
  subscribedAt: Date;
  unsubscribedAt: Date | null;
  updatedAt: Date;
}

export interface FaqRow {
  id: string;
  question: string;
  answer: string;
  category: string;
  sortOrder: number;
  isPublished: boolean;
  createdAt: Date;
  updatedAt: Date;
}

export interface SettingRow {
  key: string;
  value: unknown;
  updatedBy: string | null;
  updatedAt: Date;
}

export interface AuditLogRow {
  id: string;
  userId: string | null;
  action: string;
  entity: string;
  entityId: string | null;
  meta: unknown;
  createdAt: Date;
}
