"use client";

import { Minus, Plus } from "lucide-react";
import { cn } from "@/lib/utils";

interface QuantitySelectorProps {
  value: number;
  onChange: (value: number) => void;
  min?: number;
  max?: number;
  label?: string;
  size?: "md" | "sm";
  disabled?: boolean;
}

export function QuantitySelector({
  value,
  onChange,
  min = 1,
  max = 10,
  label = "Quantity",
  size = "md",
  disabled,
}: QuantitySelectorProps) {
  const btn =
    "grid h-full place-items-center text-ink-2 transition-colors hover:text-gold-light disabled:cursor-not-allowed disabled:opacity-30";
  return (
    <div
      role="group"
      aria-label={label}
      className={cn(
        "inline-flex items-stretch border border-line-soft bg-bg-2",
        size === "md" ? "h-12" : "h-10",
        disabled && "opacity-50",
      )}
    >
      <button
        type="button"
        className={cn(btn, size === "md" ? "w-11" : "w-9")}
        onClick={() => onChange(Math.max(min, value - 1))}
        disabled={disabled || value <= min}
        aria-label="Decrease quantity"
      >
        <Minus className="size-3.5" aria-hidden />
      </button>
      <output
        aria-live="polite"
        className={cn("grid place-items-center text-sm font-semibold tabular-nums", size === "md" ? "w-10" : "w-8")}
      >
        {value}
      </output>
      <button
        type="button"
        className={cn(btn, size === "md" ? "w-11" : "w-9")}
        onClick={() => onChange(Math.min(max, value + 1))}
        disabled={disabled || value >= max}
        aria-label="Increase quantity"
      >
        <Plus className="size-3.5" aria-hidden />
      </button>
    </div>
  );
}
