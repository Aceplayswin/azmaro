import type { Metadata, Viewport } from "next";
import { Cormorant_Garamond, Manrope } from "next/font/google";
import { siteConfig } from "@/config/site";
import "./globals.css";

const cormorant = Cormorant_Garamond({
  subsets: ["latin"],
  weight: ["400", "500", "600"],
  style: ["normal", "italic"],
  variable: "--font-cormorant",
  display: "swap",
});

const manrope = Manrope({
  subsets: ["latin"],
  weight: ["400", "500", "600", "700", "800"],
  variable: "--font-manrope",
  display: "swap",
});

export const metadata: Metadata = {
  metadataBase: new URL(siteConfig.url),
  title: {
    default: "AZMARO – The House of Fragrances",
    template: "%s | AZMARO",
  },
  description:
    "AZMARO is a considered collection of authentic Middle Eastern perfumery – from everyday signatures to statement-making blends, delivered across India.",
  applicationName: "AZMARO",
  alternates: { canonical: "/" },
  openGraph: {
    type: "website",
    siteName: "AZMARO",
    locale: siteConfig.locale,
    title: "AZMARO – The House of Fragrances",
    description: "Authentic Middle Eastern fragrances, thoughtfully curated and delivered across India.",
  },
  twitter: { card: "summary_large_image" },
  robots: { index: true, follow: true },
};

export const viewport: Viewport = {
  themeColor: "#090807",
  colorScheme: "dark",
  width: "device-width",
  initialScale: 1,
};

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="en-IN" className={`${cormorant.variable} ${manrope.variable}`}>
      <body>{children}</body>
    </html>
  );
}
