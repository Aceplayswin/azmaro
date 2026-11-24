"use client";

import { useId } from "react";
import { SORT_OPTIONS } from "@/lib/catalogue/filter";
import type { SortKey } from "@/types/catalogue";

export function SortDropdown({
  value,
  onChange,
  pricesAvailable,
}: {
  value: SortKey;
  onChange: (value: SortKey) => void;
  pricesAvailable: boolean;
}) {
  const id = useId();
  const options = SORT_OPTIONS.filter((o) => !o.needsPrice || pricesAvailable);
  return (
    <div className="flex items-center gap-2">
      <label htmlFor={id} className="hidden text-[0.62rem] font-bold tracking-[0.2em] text-muted uppercase sm:block">
        Sort by
      </label>
      <select
        id={id}
        value={value}
        onChange={(e) => onChange(e.target.value as SortKey)}
        className="h-10 cursor-pointer appearance-none border border-line-soft bg-bg-2 bg-[length:10px] bg-[right_0.75rem_center] bg-no-repeat pr-8 pl-3 text-[0.65rem] font-bold tracking-[0.16em] text-ink uppercase hover:border-line focus:border-gold focus:outline-none"
        style={{
          backgroundImage:
            "url(\"data:image/svg+xml,%3Csvg xmlns='http://www.w3.org/2000/svg' viewBox='0 0 12 8'%3E%3Cpath d='M1 1l5 5 5-5' fill='none' stroke='%23d2ad70' stroke-width='1.4'/%3E%3C/svg%3E\")",
        }}
      >
        {options.map((o) => (
          <option key={o.value} value={o.value}>
            {o.label}
          </option>
        ))}
      </select>
    </div>
  );
}
