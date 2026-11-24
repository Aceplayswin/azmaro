"use client";

import { useSearchParams } from "next/navigation";
import { useState } from "react";
import { Field } from "@/components/forms/Field";
import { Notice } from "@/components/ui/States";
import type { ShipmentEvent, TrackingResult } from "@/types/api";
import { cn, formatDateTime } from "@/lib/utils";
import { validateOrderNumber } from "@/lib/validation";

const STAGES: Array<{ key: ShipmentEvent["status"]; label: string }> = [
  { key: "placed", label: "Order placed" },
  { key: "picked_up", label: "Picked up" },
  { key: "in_transit", label: "In transit" },
  { key: "out_for_delivery", label: "Out for delivery" },
  { key: "delivered", label: "Delivered" },
];

export function TrackOrderForm() {
  const params = useSearchParams();
  const [orderNumber, setOrderNumber] = useState(params.get("order") ?? "");
  const [contact, setContact] = useState("");
  const [errors, setErrors] = useState<{ order?: string | null; contact?: string | null }>({});
  const [result, setResult] = useState<TrackingResult | null>(null);
  const [failure, setFailure] = useState<string | null>(null);
  const [pending, setPending] = useState(false);

  const submit = async (e: React.FormEvent) => {
    e.preventDefault();
    const errs = {
      order: validateOrderNumber(orderNumber),
      contact: contact.trim() ? null : "Please enter the email or phone used at checkout.",
    };
    setErrors(errs);
    setResult(null);
    setFailure(null);
    if (errs.order || errs.contact) return;
    setPending(true);
    try {
      const res = await fetch("/api/orders/track", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ orderNumber, contact }),
      });
      const data = (await res.json()) as TrackingResult & { message?: string };
      if (!res.ok) setFailure(data.message ?? "Please check your details.");
      else setResult(data);
    } catch {
      setFailure("We couldn't reach the server. Please try again.");
    } finally {
      setPending(false);
    }
  };

  const reached = new Set(result?.events?.map((e) => e.status) ?? []);
  const lastReached = STAGES.reduce((acc, s, i) => (reached.has(s.key) ? i : acc), -1);

  return (
    <>
      <form onSubmit={submit} noValidate className="az-panel max-w-3xl p-6 sm:p-8">
        <div className="grid gap-5 sm:grid-cols-2">
          <Field label="Order number" name="order" placeholder="AZM-0000000" autoComplete="off" value={orderNumber} onChange={(e) => setOrderNumber(e.target.value.toUpperCase())} error={errors.order} required />
          <Field label="Email or phone" name="contact" placeholder="Used at checkout" autoComplete="email" value={contact} onChange={(e) => setContact(e.target.value)} error={errors.contact} required />
        </div>
        <button type="submit" className="az-btn az-btn-primary mt-6 w-full" disabled={pending}>
          {pending ? "Looking up…" : "Track order"}
        </button>
      </form>

      <div aria-live="polite" className="mt-8 max-w-5xl">
        {failure && <Notice tone="error">{failure}</Notice>}
        {result && !result.found && <Notice tone="error">{result.message}</Notice>}
        {result?.found && (
          <section className="az-panel p-6 sm:p-8" aria-labelledby="tracking-title">
            <div className="flex flex-wrap items-start justify-between gap-4">
              <div>
                <h2 id="tracking-title" className="text-sm font-bold tracking-[0.14em] uppercase">
                  Order {result.orderNumber}
                </h2>
                <p className="mt-2 text-xs tracking-[0.1em] text-ink-2 uppercase">
                  {result.courier && result.awb ? `${result.courier} / AWB ${result.awb}` : "Courier and AWB will appear once the shipment is booked."}
                </p>
              </div>
              <span className="border border-gold px-4 py-2 text-[0.62rem] font-bold tracking-[0.2em] text-gold-light uppercase">
                {result.status}
              </span>
            </div>
            {result.demo && (
              <Notice tone="demo" className="mt-6">
                Test order – courier tracking is not connected, so only events recorded by AZMARO are shown.
              </Notice>
            )}

            <ol className="mt-10 grid gap-6 sm:grid-cols-5 sm:gap-0" aria-label="Shipment progress">
              {STAGES.map((s, i) => {
                const done = i <= lastReached;
                return (
                  <li key={s.key} className="relative flex items-center gap-4 sm:flex-col sm:gap-3 sm:text-center">
                    {i > 0 && (
                      <span aria-hidden className={cn("absolute top-[0.4rem] right-1/2 hidden h-px w-full sm:block", done ? "bg-gold" : "bg-line")} />
                    )}
                    <span
                      aria-hidden
                      className={cn("relative z-10 size-3.5 shrink-0 rounded-full border", done ? "border-gold bg-gold" : "border-line bg-card")}
                    />
                    <span className={cn("text-[0.62rem] font-bold tracking-[0.18em] uppercase", done ? "text-gold" : "text-muted")}>
                      {s.label}
                      <span className="sr-only">{done ? " – completed" : " – not yet confirmed"}</span>
                    </span>
                  </li>
                );
              })}
            </ol>

            <h3 className="az-label mt-10 mb-3 text-gold">Shipment updates</h3>
            <ul className="divide-y divide-line-soft border-t border-line-soft">
              {[...(result.events ?? [])].reverse().map((e) => (
                <li key={`${e.at}-${e.status}`} className="grid gap-1 py-3 text-sm sm:grid-cols-[12rem_1fr]">
                  <span className="text-xs text-muted">{formatDateTime(e.at)}</span>
                  <span className="text-ink-2">
                    {e.description}
                    {e.location ? ` – ${e.location}` : ""}
                  </span>
                </li>
              ))}
            </ul>
          </section>
        )}
      </div>
    </>
  );
}
