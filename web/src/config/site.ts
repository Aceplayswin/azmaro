/**
 * Central, editable site configuration.
 *
 * Contact details are read from environment variables so that real numbers and
 * addresses are never hard-coded. Anything left empty is hidden or shown as
 * "to be confirmed" in the UI – never replaced with an invented value.
 */

const clean = (value: string | undefined): string | null => (value && value.trim() ? value.trim() : null);

// NEXT_PUBLIC_* values must be referenced literally so Next.js can inline them in client bundles.

export const siteConfig = {
  name: "AZMARO",
  tagline: "The House of Fragrances",
  description:
    "Authentic Middle Eastern fragrances, thoughtfully curated and delivered across India.",
  url: clean(process.env.NEXT_PUBLIC_SITE_URL) ?? "http://localhost:3000",
  locale: "en_IN",
  currency: "INR",

  /**
   * Announcement bar items. Each one is shown only while `enabled` is true.
   * Defaults mirror the statements in the AZMARO wireframe; switch any of them
   * off here if the service is not yet live.
   */
  announcements: [
    { id: "authentic", label: "Authentic fragrances", enabled: true },
    { id: "delivery", label: "Pan-India delivery", enabled: true },
    { id: "cod", label: "COD available", enabled: true },
  ],

  /** Trust markers on the homepage. Same rule: only claims AZMARO supports. */
  trustMarkers: [
    { id: "sourcing", label: "Authentic sourcing", enabled: true },
    { id: "curation", label: "Curated discovery", enabled: true },
    { id: "delivery", label: "Pan-India delivery", enabled: true },
    { id: "support", label: "Personal support", enabled: true },
  ],

  contact: {
    /** E.164 digits without "+", e.g. 9198XXXXXXXX */
    whatsapp: clean(process.env.NEXT_PUBLIC_WHATSAPP_NUMBER),
    email: clean(process.env.NEXT_PUBLIC_SUPPORT_EMAIL),
    phone: clean(process.env.NEXT_PUBLIC_SUPPORT_PHONE),
    instagram: clean(process.env.NEXT_PUBLIC_INSTAGRAM_URL),
  },

  // Featured products / brands are merchandising data owned by the API (API/config/merchandising.ts).

  catalogue: {
    pageSize: 12,
  },
} as const;

export type SiteConfig = typeof siteConfig;

export const whatsappHref = (message?: string): string | null => {
  const number = siteConfig.contact.whatsapp;
  if (!number) return null;
  const digits = number.replace(/\D/g, "");
  return `https://wa.me/${digits}${message ? `?text=${encodeURIComponent(message)}` : ""}`;
};
