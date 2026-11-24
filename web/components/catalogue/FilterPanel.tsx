"use client";

import { Check } from "lucide-react";
import { useState } from "react";
import { SCENT_FAMILY_MAP } from "@/data/scent-families";
import { CONCENTRATION_LABELS, GENDER_LABELS, type FacetOptions } from "@/lib/catalogue/filter";
import { cn, formatPrice } from "@/lib/utils";
import type { CatalogueState } from "./useCatalogueParams";

type Patch = Partial<CatalogueState>;

function toggle<T>(list: T[] | undefined, value: T): T[] {
  const current = list ?? [];
  return current.includes(value) ? current.filter((v) => v !== value) : [...current, value];
}

function CheckOption({ label, checked, onChange, count }: { label: string; checked: boolean; onChange: () => void; count?: number }) {
  return (
    <label className="group flex cursor-pointer items-center gap-3 py-1.5 text-[0.8125rem] text-ink-2 hover:text-ink">
      <input type="checkbox" className="peer sr-only" checked={checked} onChange={onChange} />
      <span
        className={cn(
          "grid size-4 shrink-0 place-items-center border transition-colors peer-focus-visible:outline peer-focus-visible:outline-1 peer-focus-visible:outline-offset-2 peer-focus-visible:outline-gold",
          checked ? "border-gold bg-gold text-bg" : "border-line group-hover:border-gold",
        )}
        aria-hidden="true"
      >
        {checked && <Check className="size-3" strokeWidth={3} />}
      </span>
      <span className={cn("flex-1", checked && "text-ink")}>{label}</span>
      {typeof count === "number" && <span className="text-[0.7rem] text-muted tabular-nums">{count}</span>}
    </label>
  );
}

function Group({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <fieldset className="border-b border-line-soft py-5 first:pt-0 last:border-b-0">
      <legend className="az-label mb-3 text-gold">{title}</legend>
      {children}
    </fieldset>
  );
}

interface FilterPanelProps {
  facets: FacetOptions;
  state: CatalogueState;
  onChange: (patch: Patch) => void;
  hide?: Array<"gender" | "family" | "concentration" | "size" | "brand" | "price">;
}

/** Shared filter controls – rendered in the desktop sidebar and the mobile sheet. */
export function FilterPanel({ facets, state, onChange, hide = [] }: FilterPanelProps) {
  const [showAllBrands, setShowAllBrands] = useState(false);
  const brands = showAllBrands ? facets.brands : facets.brands.slice(0, 8);

  return (
    <div>
      {!hide.includes("gender") && facets.genders.length > 0 && (
        <Group title="Gender">
          {facets.genders.map((g) => (
            <CheckOption
              key={g}
              label={GENDER_LABELS[g]}
              checked={state.gender?.includes(g) ?? false}
              onChange={() => onChange({ gender: toggle(state.gender, g) })}
            />
          ))}
          <p className="mt-2 text-[0.7rem] leading-snug text-muted">Shown only where the audience is specified in the catalogue.</p>
        </Group>
      )}

      {!hide.includes("family") && facets.families.length > 0 && (
        <Group title="Scent family">
          {facets.families.map((f) => (
            <CheckOption
              key={f}
              label={SCENT_FAMILY_MAP[f].label}
              checked={state.family?.includes(f) ?? false}
              onChange={() => onChange({ family: toggle(state.family, f) })}
            />
          ))}
        </Group>
      )}

      {!hide.includes("concentration") && facets.concentrations.length > 0 && (
        <Group title="Concentration">
          {facets.concentrations.map((c) => (
            <CheckOption
              key={c}
              label={CONCENTRATION_LABELS[c]}
              checked={state.concentration?.includes(c) ?? false}
              onChange={() => onChange({ concentration: toggle(state.concentration, c) })}
            />
          ))}
        </Group>
      )}

      {!hide.includes("size") && facets.sizes.length > 0 && (
        <Group title="Size">
          <div className="flex flex-wrap gap-2">
            {facets.sizes.map((s) => (
              <button
                key={s}
                type="button"
                className="az-chip min-h-9 px-3"
                aria-pressed={state.size?.includes(s) ?? false}
                onClick={() => onChange({ size: toggle(state.size, s) })}
              >
                {s} ml
              </button>
            ))}
          </div>
        </Group>
      )}

      {!hide.includes("brand") && facets.brands.length > 1 && (
        <Group title="Brand">
          {brands.map((b) => (
            <CheckOption
              key={b.id}
              label={b.name}
              count={b.count}
              checked={state.brand?.includes(b.id) ?? false}
              onChange={() => onChange({ brand: toggle(state.brand, b.id) })}
            />
          ))}
          {facets.brands.length > 8 && (
            <button type="button" className="az-link mt-2" onClick={() => setShowAllBrands((v) => !v)}>
              {showAllBrands ? "Show fewer" : `Show all ${facets.brands.length}`}
            </button>
          )}
        </Group>
      )}

      {!hide.includes("price") && facets.price && (
        <Group title="Price range">
          <PriceRange
            key={`${state.priceMin}-${state.priceMax}`}
            bounds={facets.price}
            min={state.priceMin ?? null}
            max={state.priceMax ?? null}
            onApply={(priceMin, priceMax) => onChange({ priceMin, priceMax })}
          />
        </Group>
      )}
    </div>
  );
}

function PriceRange({
  bounds,
  min,
  max,
  onApply,
}: {
  bounds: { min: number; max: number };
  min: number | null;
  max: number | null;
  onApply: (min: number | null, max: number | null) => void;
}) {
  const [lo, setLo] = useState(min?.toString() ?? "");
  const [hi, setHi] = useState(max?.toString() ?? "");
  return (
    <form
      onSubmit={(e) => {
        e.preventDefault();
        onApply(lo ? Number(lo) : null, hi ? Number(hi) : null);
      }}
    >
      <div className="grid grid-cols-2 gap-2">
        <label className="text-[0.7rem] text-muted">
          Min (₹)
          <input type="number" inputMode="numeric" min={0} value={lo} onChange={(e) => setLo(e.target.value)} placeholder={String(bounds.min)} className="az-input mt-1 min-h-10 text-sm" />
        </label>
        <label className="text-[0.7rem] text-muted">
          Max (₹)
          <input type="number" inputMode="numeric" min={0} value={hi} onChange={(e) => setHi(e.target.value)} placeholder={String(bounds.max)} className="az-input mt-1 min-h-10 text-sm" />
        </label>
      </div>
      <p className="mt-2 text-[0.7rem] text-muted">
        {formatPrice(bounds.min)} – {formatPrice(bounds.max)} · priced items only
      </p>
      <button type="submit" className="az-btn az-btn-ghost az-btn-sm mt-3 w-full">
        Apply price
      </button>
    </form>
  );
}
