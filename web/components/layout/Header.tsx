"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { Heart, Menu, Search, ShoppingBag, User } from "lucide-react";
import { useEffect, useState } from "react";
import { DesktopNavigation } from "@/components/navigation/DesktopNavigation";
import { MobileMenuDrawer } from "@/components/navigation/MobileMenuDrawer";
import { SearchOverlay } from "@/components/navigation/SearchOverlay";
import { useCart } from "@/lib/cart";
import { useSession } from "@/lib/session";
import { useWishlist } from "@/lib/wishlist";
import { useHydrated } from "@/lib/store/persistent-store";
import { cn } from "@/lib/utils";

export function Header() {
  const pathname = usePathname();
  const hydrated = useHydrated();
  const { count: bagCount } = useCart();
  const { count: wishCount } = useWishlist();
  const user = useSession();
  const [menuOpen, setMenuOpen] = useState(false);
  const [searchOpen, setSearchOpen] = useState(false);
  const [scrolled, setScrolled] = useState(false);
  const [lastPath, setLastPath] = useState(pathname);

  // close overlays on navigation
  if (lastPath !== pathname) {
    setLastPath(pathname);
    setMenuOpen(false);
    setSearchOpen(false);
  }

  useEffect(() => {
    const onScroll = () => setScrolled(window.scrollY > 24);
    onScroll();
    window.addEventListener("scroll", onScroll, { passive: true });
    return () => window.removeEventListener("scroll", onScroll);
  }, []);

  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "/" && !(e.target instanceof HTMLInputElement || e.target instanceof HTMLTextAreaElement)) {
        e.preventDefault();
        setSearchOpen(true);
      }
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, []);

  const bag = hydrated ? bagCount : 0;
  const wish = hydrated ? wishCount : 0;
  const iconLink =
    "items-center gap-2 text-[0.65rem] font-bold tracking-[0.18em] uppercase text-ink-2 transition-colors hover:text-gold-light";

  return (
    <>
      <header
        className={cn(
          "sticky top-0 z-50 border-b transition-[background-color,border-color,backdrop-filter] duration-500",
          scrolled ? "border-line-soft bg-bg/90 backdrop-blur-md" : "border-line-soft/60 bg-bg",
        )}
      >
        {/* Phones/tablets: [menu search] AZMARO [account bag] — two icons a side keeps the wordmark centred down to 320px. */}
        <div className="az-container grid h-[var(--az-header-h)] grid-cols-[1fr_auto_1fr] items-center gap-1 sm:gap-4">
          {/* Left */}
          <div className="flex items-center">
            <button
              type="button"
              className="-ml-2 grid size-10 place-items-center text-ink-2 hover:text-gold-light min-[380px]:size-11 lg:hidden"
              aria-label="Open menu"
              aria-expanded={menuOpen}
              onClick={() => setMenuOpen(true)}
            >
              <Menu className="size-5" aria-hidden />
            </button>
            <button
              type="button"
              onClick={() => setSearchOpen(true)}
              className={cn(iconLink, "inline-flex size-10 justify-center min-[380px]:size-11 lg:hidden")}
              aria-label="Search"
            >
              <Search className="size-[1.05rem]" aria-hidden />
            </button>
            <DesktopNavigation pathname={pathname} />
          </div>

          {/* Centre */}
          <Link
            href="/"
            className="az-wordmark text-[1.1rem] leading-none tracking-[0.3em] max-[379px]:mr-[-0.3em] min-[380px]:text-[1.45rem] min-[380px]:tracking-[0.42em] sm:text-[1.75rem] xl:text-[2rem]"
            aria-label="AZMARO home"
          >
            Azmaro
          </Link>

          {/* Right */}
          <div className="flex items-center justify-end gap-0 lg:gap-1 xl:gap-6">
            <button type="button" onClick={() => setSearchOpen(true)} className={cn(iconLink, "hidden lg:inline-flex lg:size-10 lg:justify-center xl:size-auto")} aria-label="Search">
              <span className="hidden xl:inline">Search</span>
              <Search className="size-4 xl:size-3.5" aria-hidden />
            </button>
            <Link
              href="/wishlist"
              className={cn(iconLink, "hidden lg:inline-flex lg:size-10 lg:justify-center xl:size-auto", pathname === "/wishlist" && "text-gold")}
              aria-label={`Wishlist, ${wish} saved`}
            >
              <span className="hidden xl:inline">Wishlist</span>
              <span className="relative">
                <Heart className="size-4 xl:size-3.5" aria-hidden />
                {wish > 0 && <span className="absolute -top-1.5 -right-1.5 size-1.5 rounded-full bg-gold" />}
              </span>
            </Link>
            <Link
              href="/bag"
              className={cn(iconLink, "relative order-last inline-flex max-lg:-mr-2 max-lg:size-10 max-lg:justify-center min-[380px]:max-lg:size-11 lg:order-none lg:mr-0 lg:size-10 lg:justify-center xl:size-auto", pathname === "/bag" && "text-gold")}
              aria-label={`Shopping bag, ${bag} ${bag === 1 ? "item" : "items"}`}
            >
              <span className="hidden xl:inline">Bag ({bag})</span>
              <ShoppingBag className="size-[1.05rem] lg:size-4 xl:size-3.5" aria-hidden />
              {bag > 0 && (
                <span className="absolute top-1.5 right-1 grid min-w-4 place-items-center rounded-full bg-gold px-1 text-[0.55rem] leading-4 font-extrabold text-bg xl:hidden">
                  {bag}
                </span>
              )}
            </Link>
            {/* Sign in / account – far right corner */}
            <Link
              href={user ? "/account" : "/login"}
              aria-label={user ? `My account (${user.email})` : "Sign in"}
              title={user ? user.email : undefined}
              className={cn(
                iconLink,
                "inline-flex max-w-44 max-xl:size-10 max-xl:justify-center min-[380px]:max-lg:size-11 xl:border xl:border-line xl:px-3 xl:py-2 xl:hover:border-gold",
                (pathname.startsWith("/account") || pathname === "/login") && "text-gold xl:border-gold",
              )}
            >
              <User className="size-[1.05rem] shrink-0 lg:size-4 xl:size-3.5" aria-hidden />
              <span className="hidden truncate xl:inline">{user ? `Hi, ${user.name.split(" ")[0]}` : "Sign in"}</span>
            </Link>
          </div>
        </div>
      </header>

      <MobileMenuDrawer open={menuOpen} onClose={() => setMenuOpen(false)} pathname={pathname} />
      <SearchOverlay open={searchOpen} onClose={() => setSearchOpen(false)} />
    </>
  );
}
