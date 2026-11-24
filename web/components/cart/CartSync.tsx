"use client";

import { useEffect, useRef } from "react";
import { useCart } from "@/lib/cart";
import { useSession } from "@/lib/session";
import { useHydrated } from "@/lib/store/persistent-store";

/**
 * Mirrors the browser bag to the server (guest cookie or the signed-in account)
 * so the admin panel can see cart activity. Renders nothing; failures are ignored –
 * the bag itself always lives in the browser.
 */
export function CartSync() {
  const hydrated = useHydrated();
  const { lines } = useCart();
  const user = useSession();
  const last = useRef<string | null>(null);

  const payload = JSON.stringify(lines.map(({ slug, sizeMl, qty }) => ({ slug, sizeMl, qty })));
  const owner = user === undefined ? null : (user?.email ?? "guest");

  useEffect(() => {
    if (!hydrated || owner === null) return;
    const key = `${owner}|${payload}`;
    if (key === last.current) return;
    // Nothing to tell the server about a guest who has never had anything in the bag.
    if (last.current === null && payload === "[]" && owner === "guest") {
      last.current = key;
      return;
    }
    const t = setTimeout(() => {
      last.current = key;
      fetch("/api/cart/sync", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ lines: JSON.parse(payload) }),
        keepalive: true,
      }).catch(() => undefined);
    }, 500);
    return () => clearTimeout(t);
  }, [hydrated, owner, payload]);

  return null;
}
