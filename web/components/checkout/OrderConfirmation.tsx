"use client";

import { useSearchParams } from "next/navigation";
import { useSyncExternalStore } from "react";
import { ButtonLink } from "@/components/ui/Button";
import { EmptyState, Notice } from "@/components/ui/States";
import { Star8 } from "@/components/ui/Artwork";
import type { Order } from "@/types/api";
import { formatDateTime, formatPrice } from "@/lib/utils";
import { LAST_ORDER_KEY } from "./CheckoutView";

const PAYMENT_LABEL: Record<Order["paymentMethod"], string> = {
  upi: "UPI",
  card: "Card",
  netbanking: "Net banking",
  cod: "Cash on delivery",
};

const PAYMENT_STATUS: Record<Order["paymentStatus"], string> = {
  not_collected: "Not collected (test order)",
  pending: "Awaiting payment",
  cod_pending: "Pay on delivery",
  paid: "Paid",
  failed: "Payment failed",
};

const readOrder = () => sessionStorage.getItem(LAST_ORDER_KEY);

export function OrderConfirmation() {
  const params = useSearchParams();
  const raw = useSyncExternalStore(
    () => () => {},
    readOrder,
    () => null,
  );
  const orderNumber = params.get("order");
  let order: Order | null = null;
  try {
    order = raw ? (JSON.parse(raw) as Order) : null;
  } catch {
    order = null;
  }

  if (!order || order.orderNumber !== orderNumber) {
    return (
      <EmptyState
        title="Order details unavailable"
        description="We can only show confirmation details in the browser session that placed the order. Use Track order with your order number and contact details."
      >
        <ButtonLink href="/track-order">Track an order</ButtonLink>
        <ButtonLink href="/shop" variant="secondary">
          Continue shopping
        </ButtonLink>
      </EmptyState>
    );
  }

  return (
    <div className="mx-auto max-w-3xl">
      <div className="text-center">
        <Star8 className="mx-auto size-14 text-gold" />
        <p className="az-eyebrow mt-6">{order.demo ? "Test order received" : "Order received"}</p>
        <h1 className="az-h1 mt-3">Thank you, {order.address.fullName.split(" ")[0]}.</h1>
        <p className="mt-4 text-sm text-ink-2">
          Order <span className="font-semibold text-ink">{order.orderNumber}</span> · {formatDateTime(order.createdAt)}
        </p>
      </div>

      {order.demo && (
        <Notice tone="demo" title="Test mode" className="mt-8">
          This is a test order. Payment and courier integrations are not connected, so no payment was taken and nothing will be
          shipped.
        </Notice>
      )}

      <div className="mt-10 grid gap-5 md:grid-cols-2">
        <section className="az-panel p-6" aria-labelledby="conf-payment">
          <h2 id="conf-payment" className="az-label text-gold">
            Payment
          </h2>
          <p className="mt-3 text-sm">{PAYMENT_LABEL[order.paymentMethod]}</p>
          <p className="mt-1 text-xs text-ink-2">Status: {PAYMENT_STATUS[order.paymentStatus]}</p>
        </section>
        <section className="az-panel p-6" aria-labelledby="conf-address">
          <h2 id="conf-address" className="az-label text-gold">
            Delivery address
          </h2>
          <address className="mt-3 text-sm leading-relaxed not-italic text-ink-2">
            <span className="text-ink">{order.address.fullName}</span>
            <br />
            {order.address.addressLine}
            {order.address.landmark ? `, ${order.address.landmark}` : ""}
            <br />
            {order.address.city}, {order.address.state} {order.address.pin}
          </address>
        </section>
      </div>

      <section className="az-panel mt-5 p-6" aria-labelledby="conf-summary">
        <h2 id="conf-summary" className="az-label text-gold">
          Order summary
        </h2>
        <ul className="mt-4 divide-y divide-line-soft">
          {order.lines.map((l) => (
            <li key={`${l.slug}-${l.sizeMl}`} className="flex justify-between gap-4 py-3 text-sm">
              <span>
                <span className="text-[0.6rem] font-bold tracking-[0.2em] text-gold uppercase">{l.brandName}</span>
                <br />
                {l.name} · {l.sizeMl} ml × {l.qty}
              </span>
              <span className="font-semibold tabular-nums">{formatPrice(l.lineTotal)}</span>
            </li>
          ))}
        </ul>
        <dl className="mt-4 space-y-2 border-t border-line-soft pt-4 text-sm">
          <div className="flex justify-between">
            <dt className="text-ink-2">Subtotal</dt>
            <dd className="tabular-nums">{formatPrice(order.subtotal)}</dd>
          </div>
          <div className="flex justify-between">
            <dt className="text-ink-2">Discount</dt>
            <dd className="tabular-nums">{order.discount ? `– ${formatPrice(order.discount)}` : formatPrice(0)}</dd>
          </div>
          <div className="flex justify-between">
            <dt className="text-ink-2">Delivery</dt>
            <dd className="tabular-nums">{order.delivery === null ? "To be confirmed" : order.delivery === 0 ? "Free" : formatPrice(order.delivery)}</dd>
          </div>
          <div className="flex justify-between pt-2 text-base font-bold">
            <dt>Total</dt>
            <dd className="tabular-nums">{formatPrice(order.total)}</dd>
          </div>
        </dl>
      </section>

      <div className="mt-8 flex flex-col justify-center gap-3 sm:flex-row">
        <ButtonLink href={`/track-order?order=${encodeURIComponent(order.orderNumber)}`}>Track order</ButtonLink>
        <ButtonLink href="/shop" variant="secondary">
          Continue shopping
        </ButtonLink>
      </div>
    </div>
  );
}
