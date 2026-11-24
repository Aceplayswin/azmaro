export const PRIMARY_NAV = [
  { label: "Shop", href: "/shop" },
  { label: "Middle Eastern", href: "/middle-eastern" },
  { label: "Brands", href: "/brands" },
  { label: "About", href: "/about" },
] as const;

export const MOBILE_NAV_PRIMARY = [
  { label: "Shop all", href: "/shop" },
  { label: "Middle Eastern", href: "/middle-eastern" },
  { label: "Brands", href: "/brands" },
  { label: "New arrivals", href: "/shop?tag=new" },
  { label: "Bestsellers", href: "/shop?tag=bestseller" },
] as const;

export const MOBILE_NAV_SECONDARY = [
  { label: "About AZMARO", href: "/about" },
  { label: "My account", href: "/account" },
  { label: "Wishlist", href: "/wishlist" },
  { label: "Track order", href: "/track-order" },
  { label: "Contact us", href: "/contact" },
] as const;

export function isActive(pathname: string, href: string): boolean {
  const path = href.split("?")[0]!;
  return path === "/" ? pathname === "/" : pathname === path || pathname.startsWith(`${path}/`);
}
