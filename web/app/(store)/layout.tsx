import { CartSync } from "@/components/cart/CartSync";
import { AnnouncementBar } from "@/components/layout/AnnouncementBar";
import { Footer } from "@/components/layout/Footer";
import { Header } from "@/components/layout/Header";
import { Toaster } from "@/components/ui/Toaster";

/**
 * Store pages read catalogue data from the AZMARO API at request time (cached for 60s in
 * production, live in development – see src/lib/api/server.ts), so the web app builds without the API running.
 */
export const dynamic = "force-dynamic";

export default function StoreLayout({ children }: { children: React.ReactNode }) {
  return (
    <>
      <a
        href="#main"
        className="sr-only focus:not-sr-only focus:fixed focus:top-3 focus:left-3 focus:z-[100] focus:bg-gold focus:px-4 focus:py-2 focus:text-bg"
      >
        Skip to content
      </a>
      <AnnouncementBar />
      <Header />
      <main id="main" className="min-h-[60vh]">
        {children}
      </main>
      <Footer />
      <Toaster />
      <CartSync />
    </>
  );
}
