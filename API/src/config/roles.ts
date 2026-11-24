/**
 * Role-based access control. Permissions are stored on the `roles` table by
 * the seed; `*` grants everything. Admin routes require `admin:access` plus
 * the route's specific permission.
 */
export const PERMISSIONS = [
  "admin:access",
  "dashboard:read",
  "products:read",
  "products:write",
  "brands:write",
  "categories:write",
  "pricing:write",
  "inventory:write",
  "orders:read",
  "orders:write",
  "shipping:write",
  "payments:write",
  "customers:read",
  "customers:write",
  "coupons:read",
  "coupons:write",
  "support:read",
  "support:write",
  "newsletter:read",
  "settings:read",
  "settings:write",
  "audit:read",
] as const;

export const ROLE_DEFINITIONS: Array<{ name: "CUSTOMER" | "STAFF" | "ADMIN"; description: string; permissions: string[] }> = [
  { name: "CUSTOMER", description: "Storefront customer", permissions: [] },
  {
    name: "STAFF",
    description: "Store operations – catalogue, orders, shipping and support (no settings, roles or refunds)",
    permissions: [
      "admin:access",
      "dashboard:read",
      "products:read",
      "products:write",
      "brands:write",
      "categories:write",
      "pricing:write",
      "inventory:write",
      "orders:read",
      "orders:write",
      "shipping:write",
      "customers:read",
      "coupons:read",
      "support:read",
      "support:write",
      "newsletter:read",
      "settings:read",
    ],
  },
  { name: "ADMIN", description: "Full administrator", permissions: ["*"] },
];
