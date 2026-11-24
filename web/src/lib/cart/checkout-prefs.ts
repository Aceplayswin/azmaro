"use client";

import { createPersistentStore, useStore } from "@/lib/store/persistent-store";

/** Discount code + delivery PIN carried from the bag to checkout. No personal or payment data. */
interface CheckoutPrefs {
  discountCode: string | null;
  pin: string | null;
}

const store = createPersistentStore<CheckoutPrefs>("azmaro.checkout-prefs.v1", { discountCode: null, pin: null }, (v) => {
  const o = (v ?? {}) as Partial<CheckoutPrefs>;
  return {
    discountCode: typeof o.discountCode === "string" ? o.discountCode : null,
    pin: typeof o.pin === "string" && /^\d{6}$/.test(o.pin) ? o.pin : null,
  };
});

export function useCheckoutPrefs() {
  const prefs = useStore(store);
  return {
    ...prefs,
    setDiscountCode: (discountCode: string | null) => store.set((p) => ({ ...p, discountCode })),
    setPin: (pin: string | null) => store.set((p) => ({ ...p, pin })),
  };
}
