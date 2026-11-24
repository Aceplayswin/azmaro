"use client";

import { Truck } from "lucide-react";
import { useState } from "react";
import { validatePin } from "@/lib/validation";
import type { ServiceabilityResult } from "@/types/api";
import { cn, formatPrice } from "@/lib/utils";

export async function checkServiceability(pin: string): Promise<ServiceabilityResult> {
  const res = await fetch("/api/shipping/serviceability", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ pin }),
  });
  return (await res.json()) as ServiceabilityResult;
}

/** PIN-code serviceability. Delivery estimates come only from the courier integration. */
export function DeliveryCheck({ compact }: { compact?: boolean }) {
  const [pin, setPin] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [result, setResult] = useState<ServiceabilityResult | null>(null);
  const [pending, setPending] = useState(false);

  const onSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    const err = validatePin(pin);
    setError(err);
    setResult(null);
    if (err) return;
    setPending(true);
    try {
      setResult(await checkServiceability(pin.trim()));
    } catch {
      setError("We couldn't check this PIN code right now. Please try again.");
    } finally {
      setPending(false);
    }
  };

  return (
    <form onSubmit={onSubmit} noValidate className={cn(!compact && "border-t border-line-soft pt-6")}>
      <label htmlFor="pdp-pin" className="az-field-label flex items-center gap-2">
        <Truck className="size-3.5" aria-hidden /> Check delivery
      </label>
      <div className="flex gap-2">
        <input
          id="pdp-pin"
          inputMode="numeric"
          autoComplete="postal-code"
          maxLength={6}
          value={pin}
          onChange={(e) => setPin(e.target.value.replace(/\D/g, ""))}
          placeholder="Enter PIN code"
          aria-invalid={error ? true : undefined}
          aria-describedby="pdp-pin-status"
          className="az-input"
        />
        <button type="submit" className="az-btn az-btn-secondary shrink-0 px-5" disabled={pending}>
          {pending ? "Checking" : "Check"}
        </button>
      </div>
      <div id="pdp-pin-status" aria-live="polite" className="mt-2 text-xs">
        {error && <p className="text-danger">{error}</p>}
        {result && (
          <p className={result.status === "unserviceable" ? "text-danger" : result.status === "serviceable" ? "text-success" : "text-ink-2"}>
            {result.demo && <span className="mr-1 font-bold text-gold">[Test mode]</span>}
            {result.message}
            {result.status === "serviceable" && result.fee !== null && ` Delivery: ${result.fee === 0 ? "Free" : formatPrice(result.fee)}.`}
            {result.status === "serviceable" && result.estimate && ` Estimated: ${result.estimate}.`}
          </p>
        )}
        {!error && !result && <p className="text-muted">Delivery estimate and serviceability are confirmed by our courier partner.</p>}
      </div>
    </form>
  );
}
