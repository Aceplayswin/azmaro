"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { MessageCircle, Search } from "lucide-react";
import { Modal } from "@/components/ui/Modal";
import { whatsappHref } from "@/config/site";
import { cn } from "@/lib/utils";
import { MOBILE_NAV_PRIMARY, MOBILE_NAV_SECONDARY, isActive } from "./nav-links";

export function MobileMenuDrawer({
  open,
  onClose,
  pathname,
}: {
  open: boolean;
  onClose: () => void;
  pathname: string;
}) {
  const router = useRouter();
  const wa = whatsappHref("Hello AZMARO, I have a question.");

  return (
    <Modal open={open} onClose={onClose} title="Menu" hideTitle placement="left" className="bg-card">
      <div className="flex min-h-full flex-col px-6 pt-6 pb-8">
        <span className="az-wordmark text-2xl">Azmaro</span>

        <form
          role="search"
          className="relative mt-8"
          onSubmit={(e) => {
            e.preventDefault();
            const q = new FormData(e.currentTarget).get("q")?.toString().trim();
            onClose();
            router.push(q ? `/search?q=${encodeURIComponent(q)}` : "/search");
          }}
        >
          <label htmlFor="drawer-search" className="sr-only">
            Search fragrances and brands
          </label>
          <input id="drawer-search" name="q" type="search" placeholder="Search fragrances, brands" className="az-input pr-11" />
          <button type="submit" aria-label="Search" className="absolute inset-y-0 right-0 grid w-11 place-items-center text-gold">
            <Search className="size-4" aria-hidden />
          </button>
        </form>

        <nav aria-label="Mobile" className="mt-6">
          <ul>
            {MOBILE_NAV_PRIMARY.map((item) => (
              <li key={item.href} className="border-b border-line-soft">
                <Link
                  href={item.href}
                  onClick={onClose}
                  aria-current={isActive(pathname, item.href) && !item.href.includes("?") ? "page" : undefined}
                  className={cn(
                    "block py-4 font-serif text-xl transition-colors hover:text-gold-light",
                    isActive(pathname, item.href) && !item.href.includes("?") ? "text-gold" : "text-ink",
                  )}
                >
                  {item.label}
                </Link>
              </li>
            ))}
            {MOBILE_NAV_SECONDARY.map((item) => (
              <li key={item.href} className="border-b border-line-soft">
                <Link
                  href={item.href}
                  onClick={onClose}
                  className={cn(
                    "block py-3.5 text-sm tracking-[0.04em] transition-colors hover:text-gold-light",
                    isActive(pathname, item.href) ? "text-gold" : "text-ink-2",
                  )}
                >
                  {item.label}
                </Link>
              </li>
            ))}
          </ul>
        </nav>

        <div className="mt-auto pt-10">
          {wa ? (
            <a href={wa} target="_blank" rel="noopener noreferrer" className="az-btn az-btn-secondary w-full">
              <MessageCircle className="size-4" aria-hidden />
              Chat on WhatsApp
            </a>
          ) : (
            <Link href="/contact" onClick={onClose} className="az-btn az-btn-secondary w-full">
              <MessageCircle className="size-4" aria-hidden />
              Contact support
            </Link>
          )}
        </div>
      </div>
    </Modal>
  );
}
