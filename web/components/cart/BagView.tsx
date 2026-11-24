"use client";

import Image from "next/image";
import Link from "next/link";
import { useState } from "react";
import { ProductArtwork } from "@/components/ui/Artwork";
import { ButtonLink } from "@/components/ui/Button";
import { DiscountBadge, PriceDisplay } from "@/components/ui/PriceDisplay";
import { mrpSavings } from "@/lib/cart/pricing";
import { QuantitySelector } from "@/components/ui/QuantitySelector";
import { EmptyState, LoadingState } from "@/components/ui/States";
import { MAX_QTY } from "@/lib/cart";
import type { ProductSummary } from "@/lib/catalogue/summary";
import { CONCENTRATION_LABELS } from "@/lib/catalogue/filter";
import { loginHref, useSession } from "@/lib/session";
import { useHydrated } from "@/lib/store/persistent-store";
import { toast } from "@/lib/toast";
import { formatPrice } from "@/lib/utils";
import { validatePin } from "@/lib/validation";
import { wishlistActions } from "@/lib/wishlist";
import { OrderSummaryRows } from "./OrderSummary";
import { useOrderQuote } from "./useOrderQuote";

export function BagView({ products }: { products: ProductSummary[] }) {
  const hydrated = useHydrated();
  const quote = useOrderQuote(products);
  const user = useSession();
  const { lines, totals } = quote;

  if (!hydrated) return <LoadingState label="Loading your bag" />;

  if (!lines.length) {
    return (
      <EmptyState title="Your bag is empty" description="Discover authentic Middle Eastern perfumery and add your next signature.">
        <ButtonLink href="/shop">Shop all fragrances</ButtonLink>
        <ButtonLink href="/wishlist" variant="secondary">
          View wishlist
        </ButtonLink>
      </EmptyState>
    );
  }

  const canCheckout = lines.some((l) => l.available);

  return (
    <div className="grid gap-10 lg:grid-cols-[minmax(0,1fr)_23rem] lg:gap-14">
      <section aria-label="Items in your bag">
        <div className="hidden grid-cols-[1fr_9rem_7rem] gap-6 border-b border-line-soft pb-3 text-[0.62rem] font-bold tracking-[0.2em] text-gold uppercase md:grid">
          <span>Product</span>
          <span>Quantity</span>
          <span className="text-right">Price</span>
        </div>
        <ul>
          {lines.map((line) => (
            <li
              key={`${line.slug}-${line.sizeMl}`}
              className="grid grid-cols-[5.5rem_1fr] gap-x-4 gap-y-4 border-b border-line-soft py-6 md:grid-cols-[1fr_9rem_7rem] md:items-center md:gap-6"
            >
              <div className="col-span-2 flex gap-4 md:col-span-1">
                <Link href={`/product/${line.slug}`} className="relative aspect-[4/5] w-[5.5rem] shrink-0 overflow-hidden border border-line-soft">
                  {line.product.image ? (
                    <Image src={line.product.image.src} alt={line.product.image.alt} fill sizes="88px" className="object-cover" />
                  ) : (
                    <ProductArtwork brandName={line.product.brandName} name={line.product.name} size="thumb" />
                  )}
                </Link>
                <div className="min-w-0">
                  <p className="text-[0.6rem] font-bold tracking-[0.2em] text-gold uppercase">{line.product.brandName}</p>
                  <Link href={`/product/${line.slug}`} className="mt-1 block font-serif text-xl leading-tight hover:text-gold-light">
                    {line.product.name}
                  </Link>
                  <p className="mt-1 text-xs text-ink-2">
                    {line.sizeMl} ml
                    {line.product.concentration ? ` / ${CONCENTRATION_LABELS[line.product.concentration]}` : ""}
                  </p>
                  {!line.available && <p className="mt-1 text-xs text-danger">No longer available to order – remove or save for later.</p>}
                  <div className="mt-3 flex gap-4 text-[0.6rem] font-bold tracking-[0.18em] text-muted uppercase">
                    <button type="button" className="hover:text-danger" onClick={() => quote.remove(line)}>
                      Remove
                    </button>
                    <span aria-hidden>•</span>
                    <button
                      type="button"
                      className="hover:text-gold-light"
                      onClick={() => {
                        wishlistActions.add(line.slug);
                        quote.remove(line);
                        toast({ title: `${line.product.name} saved for later`, action: { label: "View wishlist", href: "/wishlist" } });
                      }}
                    >
                      Save for later
                    </button>
                  </div>
                </div>
              </div>
              <div className="col-start-2 md:col-start-auto">
                <QuantitySelector
                  size="sm"
                  value={line.qty}
                  max={MAX_QTY}
                  onChange={(qty) => quote.setQty(line, qty)}
                  label={`Quantity for ${line.product.name}`}
                  disabled={!line.available}
                />
              </div>
              <div className="col-start-2 -mt-2 md:col-start-auto md:mt-0 md:text-right">
                {line.lineTotal !== null ? (
                  <p className="text-sm font-bold tabular-nums">{formatPrice(line.lineTotal)}</p>
                ) : (
                  <PriceDisplay price={null} />
                )}
                {line.qty > 1 && line.unitPrice !== null && (
                  <p className="text-[0.7rem] text-muted tabular-nums">{formatPrice(line.unitPrice)} each</p>
                )}
                {line.available && line.unitMrp !== null && (
                  <p className="text-[0.7rem] text-muted tabular-nums">
                    <s>{formatPrice(line.unitMrp * line.qty)}</s> <DiscountBadge price={line.unitPrice} mrp={line.unitMrp} className="ml-1 text-[0.7rem]" />
                  </p>
                )}
              </div>
            </li>
          ))}
        </ul>
        <Link href="/shop" className="az-link mt-6 inline-block">
          ← Continue shopping
        </Link>
      </section>

      <aside aria-labelledby="summary-title" className="lg:sticky lg:top-[calc(var(--az-header-h)+1.5rem)] lg:self-start">
        <div className="az-panel p-6 sm:p-7">
          <h2 id="summary-title" className="font-serif text-2xl">
            Order summary
          </h2>
          <div className="mt-6 space-y-5">
            <DiscountCodeForm quote={quote} />
            <PinForm quote={quote} />
          </div>
          <div className="az-rule my-6" />
          <OrderSummaryRows totals={totals} mrpSavings={mrpSavings(lines)} />
        </div>
        <ButtonLink
          href={user === null ? loginHref("/checkout") : "/checkout"}
          block
          className="mt-4"
          aria-disabled={!canCheckout}
          onClick={(e) => !canCheckout && e.preventDefault()}
        >
          {user === null ? "Sign in to checkout" : "Proceed to checkout"}
        </ButtonLink>
        <p className="mt-3 text-center text-[0.7rem] text-muted">
          {user ? `Signed in as ${user.email}` : "An account is needed to place an order"} · Secure payments
        </p>
      </aside>
    </div>
  );
}

type Quote = ReturnType<typeof useOrderQuote>;

function DiscountCodeForm({ quote }: { quote: Quote }) {
  const [code, setCode] = useState(quote.prefs.discountCode ?? "");
  const applied = quote.prefs.discountCode;
  return (
    <form
      onSubmit={(e) => {
        e.preventDefault();
        quote.prefs.setDiscountCode(code.trim() ? code.trim().toUpperCase() : null);
      }}
    >
      <label htmlFor="discount-code" className="az-field-label">
        Discount code
      </label>
      <div className="flex gap-2">
        <input
          id="discount-code"
          value={code}
          onChange={(e) => setCode(e.target.value)}
          placeholder="Enter code"
          autoComplete="off"
          className="az-input min-h-11 uppercase placeholder:normal-case"
        />
        {applied ? (
          <button
            type="button"
            className="az-btn az-btn-ghost az-btn-sm shrink-0"
            onClick={() => {
              setCode("");
              quote.prefs.setDiscountCode(null);
            }}
          >
            Remove
          </button>
        ) : (
          <button type="submit" className="az-btn az-btn-secondary az-btn-sm shrink-0">
            Apply
          </button>
        )}
      </div>
      {applied && quote.discount && (
        <p role="status" className={`mt-1.5 text-xs ${quote.discount.valid ? "text-success" : "text-danger"}`}>
          {quote.discount.message}
        </p>
      )}
    </form>
  );
}

function PinForm({ quote }: { quote: Quote }) {
  const [pin, setPin] = useState(quote.prefs.pin ?? "");
  const [error, setError] = useState<string | null>(null);
  const d = quote.delivery;
  return (
    <form
      noValidate
      onSubmit={(e) => {
        e.preventDefault();
        const err = validatePin(pin);
        setError(err);
        if (!err) quote.prefs.setPin(pin.trim());
      }}
    >
      <label htmlFor="bag-pin" className="az-field-label">
        Delivery PIN code
      </label>
      <div className="flex gap-2">
        <input
          id="bag-pin"
          inputMode="numeric"
          maxLength={6}
          value={pin}
          onChange={(e) => setPin(e.target.value.replace(/\D/g, ""))}
          placeholder="Enter PIN"
          aria-invalid={error ? true : undefined}
          className="az-input min-h-11"
        />
        <button type="submit" className="az-btn az-btn-secondary az-btn-sm shrink-0">
          Check
        </button>
      </div>
      <div aria-live="polite" className="mt-1.5 text-xs">
        {error && <p className="text-danger">{error}</p>}
        {!error && d && (
          <p className={d.status === "unserviceable" ? "text-danger" : "text-ink-2"}>
            {d.demo && <span className="mr-1 font-bold text-gold">[Test mode]</span>}
            {d.message}
          </p>
        )}
      </div>
    </form>
  );
}
