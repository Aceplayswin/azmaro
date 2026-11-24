"use client";

import { Heart } from "lucide-react";
import { useState } from "react";
import { useWishlist } from "@/lib/wishlist";
import { useHydrated } from "@/lib/store/persistent-store";
import { toast } from "@/lib/toast";
import { cn } from "@/lib/utils";

export function WishlistButton({
  slug,
  name,
  variant = "icon",
  className,
}: {
  slug: string;
  name: string;
  variant?: "icon" | "boxed" | "text";
  className?: string;
}) {
  const hydrated = useHydrated();
  const { has, toggle } = useWishlist();
  const [pulse, setPulse] = useState(0);
  const saved = hydrated && has(slug);

  const onClick = (e: React.MouseEvent) => {
    e.preventDefault();
    e.stopPropagation();
    const added = toggle(slug);
    setPulse((n) => n + 1);
    toast({
      title: added ? `${name} saved to your wishlist` : `${name} removed from your wishlist`,
      action: added ? { label: "View wishlist", href: "/wishlist" } : undefined,
    });
  };

  const icon = (
    <Heart
      key={pulse}
      className={cn("size-4 transition-colors", pulse > 0 && "az-anim-pop", saved ? "fill-gold text-gold" : "text-ink")}
      aria-hidden
    />
  );

  if (variant === "text") {
    return (
      <button type="button" onClick={onClick} aria-pressed={saved} className={cn("az-link inline-flex items-center gap-2", className)}>
        {icon}
        {saved ? "Saved" : "Save to wishlist"}
      </button>
    );
  }

  return (
    <button
      type="button"
      onClick={onClick}
      aria-pressed={saved}
      aria-label={saved ? `Remove ${name} from wishlist` : `Save ${name} to wishlist`}
      className={cn(
        "grid place-items-center transition-colors",
        variant === "icon" && "size-10 rounded-full bg-bg/70 backdrop-blur-sm hover:bg-bg",
        variant === "boxed" && "size-12 shrink-0 border border-line-soft hover:border-gold",
        className,
      )}
    >
      {icon}
    </button>
  );
}
