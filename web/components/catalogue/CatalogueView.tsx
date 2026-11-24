"use client";

import { ChevronLeft, ChevronRight, Search, SlidersHorizontal, X } from "lucide-react";
import { useEffect, useMemo, useRef, useState } from "react";
import { ProductGrid } from "@/components/products/ProductCard";
import { Modal } from "@/components/ui/Modal";
import { EmptyState } from "@/components/ui/States";
import { SCENT_FAMILIES, SCENT_FAMILY_MAP } from "@/data/scent-families";
import { applyFilters, CONCENTRATION_LABELS, GENDER_LABELS, getFacets } from "@/lib/catalogue/filter";
import type { ProductSummary } from "@/lib/catalogue/summary";
import { useDebouncedValue } from "@/lib/useDebouncedValue";
import { cn, pluralise } from "@/lib/utils";
import { FilterPanel } from "./FilterPanel";
import { SortDropdown } from "./SortDropdown";
import { useCatalogueParams } from "./useCatalogueParams";

type HideKey = "gender" | "family" | "concentration" | "size" | "brand" | "price";

interface CatalogueViewProps {
  products: ProductSummary[];
  /** sidebar: Shop All layout · chips: collection layout with scent-family chips · compact: brand / search pages */
  layout?: "sidebar" | "chips" | "compact";
  pageSize?: number;
  showSearch?: boolean;
  hide?: HideKey[];
  emptyMessage?: string;
}

export function CatalogueView({
  products,
  layout = "sidebar",
  pageSize = 12,
  showSearch = false,
  hide = [],
  emptyMessage,
}: CatalogueViewProps) {
  const { state, update, clearAll, activeCount } = useCatalogueParams();
  const [sheetOpen, setSheetOpen] = useState(false);

  // Live search: the input updates instantly, the URL (and results) once typing pauses.
  const urlQuery = state.q ?? "";
  const [term, setTerm] = useState(urlQuery);
  const debouncedTerm = useDebouncedValue(term, 350);
  const lastPushed = useRef(urlQuery);
  const updateRef = useRef(update);
  useEffect(() => {
    updateRef.current = update;
  }, [update]);

  const pushQuery = (value: string) => {
    const next = value.trim();
    if (next === lastPushed.current) return;
    lastPushed.current = next;
    updateRef.current({ q: next });
  };

  useEffect(() => {
    pushQuery(debouncedTerm);
  }, [debouncedTerm]);

  // Keep the input in sync when q changes from elsewhere (e.g. "View all fragrances", back button).
  useEffect(() => {
    if (urlQuery !== lastPushed.current) {
      lastPushed.current = urlQuery;
      setTerm(urlQuery);
    }
  }, [urlQuery]);
  const facets = useMemo(() => getFacets(products), [products]);
  const results = useMemo(() => applyFilters(products, state), [products, state]);

  const totalPages = Math.max(1, Math.ceil(results.length / pageSize));
  const page = Math.min(state.page, totalPages);
  const visible = results.slice((page - 1) * pageSize, page * pageSize);
  const hideInSheet: HideKey[] = layout === "chips" ? [...hide] : hide;

  const chips = activeFilterChips(state, facets.brands);

  const goToPage = (p: number) => {
    update({ page: p }, { scroll: false });
    document.getElementById("catalogue-results")?.scrollIntoView({ behavior: "smooth", block: "start" });
  };

  return (
    <div className={cn(layout === "sidebar" && "lg:grid lg:grid-cols-[15.5rem_1fr] lg:gap-10 xl:gap-14")}>
      {layout === "sidebar" && (
        <aside aria-label="Filters" className="hidden lg:block">
          <div className="az-panel sticky top-[calc(var(--az-header-h)+1.5rem)] max-h-[calc(100dvh-var(--az-header-h)-3rem)] overflow-y-auto p-6">
            <div className="mb-5 flex items-center justify-between">
              <h2 className="az-eyebrow font-sans">Filter by</h2>
              {activeCount > 0 && (
                <span className="text-[0.65rem] text-muted">{activeCount} active</span>
              )}
            </div>
            <FilterPanel facets={facets} state={state} onChange={(patch) => update(patch)} hide={hide} />
            <button type="button" onClick={clearAll} disabled={activeCount === 0} className="az-btn az-btn-secondary az-btn-sm mt-6 w-full">
              Clear all filters
            </button>
          </div>
        </aside>
      )}

      <div id="catalogue-results" className="min-w-0 scroll-mt-28">
        {showSearch && (
          <form
            role="search"
            className="relative mb-6"
            onSubmit={(e) => {
              e.preventDefault();
              pushQuery(term); // Enter / button applies immediately, skipping the debounce
            }}
          >
            <label htmlFor="catalogue-search" className="sr-only">
              Search the collection
            </label>
            <Search className="pointer-events-none absolute top-1/2 left-4 size-4 -translate-y-1/2 text-gold" aria-hidden />
            <input
              id="catalogue-search"
              name="q"
              type="search"
              autoComplete="off"
              value={term}
              onChange={(e) => setTerm(e.target.value)}
              placeholder="Name, brand or note"
              className="az-input pr-24 pl-11"
            />
            <button type="submit" className="az-link absolute inset-y-0 right-4">
              Search
            </button>
          </form>
        )}

        {layout === "chips" && !hide.includes("family") && (
          <div className="-mx-4 mb-6 overflow-x-auto px-4 no-scrollbar sm:mx-0 sm:px-0">
            <div className="flex gap-2" role="group" aria-label="Scent family">
              <button type="button" className="az-chip" aria-pressed={!state.family?.length} onClick={() => update({ family: [] })}>
                All
              </button>
              {SCENT_FAMILIES.filter((f) => facets.families.includes(f.id)).map((f) => (
                <button
                  key={f.id}
                  type="button"
                  className="az-chip"
                  aria-pressed={state.family?.length === 1 && state.family[0] === f.id}
                  onClick={() => update({ family: [f.id] })}
                >
                  {f.shortLabel}
                </button>
              ))}
            </div>
          </div>
        )}

        <div className="mb-5 flex flex-wrap items-center justify-between gap-3">
          <p className="text-[0.75rem] font-semibold tracking-[0.06em] text-ink" aria-live="polite">
            {pluralise(results.length, "fragrance")}
            {state.q ? (
              <span className="font-normal text-ink-2"> for “{state.q}”</span>
            ) : null}
          </p>
          <div className="flex items-center gap-2">
            <button
              type="button"
              onClick={() => setSheetOpen(true)}
              className={cn("az-btn az-btn-ghost az-btn-sm", layout === "sidebar" && "lg:hidden")}
              aria-haspopup="dialog"
            >
              <SlidersHorizontal className="size-3.5" aria-hidden />
              Filters{activeCount > 0 ? ` (${activeCount})` : ""}
            </button>
            <SortDropdown
              value={state.sort ?? "featured"}
              onChange={(sort) => update({ sort })}
              pricesAvailable={facets.price !== null}
            />
          </div>
        </div>

        {chips.length > 0 && (
          <div className="mb-6 flex flex-wrap items-center gap-2">
            {chips.map((chip) => (
              <button
                key={chip.key}
                type="button"
                className="az-chip min-h-8 gap-2 px-3 text-[0.6rem]"
                data-active="true"
                onClick={() => update(chip.remove(state))}
              >
                {chip.label}
                <X className="size-3" aria-hidden />
                <span className="sr-only">Remove filter</span>
              </button>
            ))}
            <button type="button" className="az-link ml-1 text-[0.6rem]" onClick={clearAll}>
              Clear all
            </button>
          </div>
        )}

        {visible.length ? (
          <ProductGrid products={visible} priorityCount={4} className={layout === "sidebar" ? "lg:grid-cols-3 xl:grid-cols-4" : undefined} />
        ) : (
          <EmptyState
            title={state.tag ? "Nothing to show here yet" : "No fragrances match"}
            description={
              emptyMessage ??
              (state.tag === "new"
                ? "New arrivals will appear here once AZMARO flags them in the catalogue."
                : state.tag === "bestseller"
                  ? "Our bestsellers will appear here soon. In the meantime, explore the full collection."
                  : "Try removing a filter or searching for a brand, note or scent family.")
            }
          >
            {(activeCount > 0 || state.tag || state.q) && (
              <button type="button" className="az-btn az-btn-secondary" onClick={() => update({ q: "", tag: null, gender: [], family: [], concentration: [], size: [], brand: [], priceMin: null, priceMax: null })}>
                View all fragrances
              </button>
            )}
          </EmptyState>
        )}

        {totalPages > 1 && (
          <nav aria-label="Pagination" className="mt-14 flex flex-col items-center justify-between gap-4 sm:flex-row">
            <p className="text-[0.7rem] tracking-[0.06em] text-muted">
              Showing {(page - 1) * pageSize + 1}–{Math.min(page * pageSize, results.length)} of {results.length}
            </p>
            <ul className="flex items-center gap-1.5">
              <li>
                <button type="button" className="az-chip min-h-10 px-3" disabled={page === 1} onClick={() => goToPage(page - 1)} aria-label="Previous page">
                  <ChevronLeft className="size-3.5" aria-hidden />
                </button>
              </li>
              {pageWindow(page, totalPages).map((p, i) =>
                p === null ? (
                  <li key={`gap-${i}`} aria-hidden="true" className="px-1 text-muted">…</li>
                ) : (
                <li key={p}>
                  <button
                    type="button"
                    className="az-chip min-h-10 min-w-10 justify-center px-0"
                    aria-current={p === page ? "page" : undefined}
                    onClick={() => goToPage(p)}
                  >
                    {p}
                  </button>
                </li>
                ),
              )}
              <li>
                <button type="button" className="az-chip min-h-10 px-3" disabled={page === totalPages} onClick={() => goToPage(page + 1)} aria-label="Next page">
                  <ChevronRight className="size-3.5" aria-hidden />
                </button>
              </li>
            </ul>
          </nav>
        )}
      </div>

      <Modal open={sheetOpen} onClose={() => setSheetOpen(false)} title="Filters" placement="bottom" className="lg:inset-x-auto lg:top-0 lg:right-0 lg:bottom-0 lg:w-[26rem] lg:rounded-none lg:border-l">
        <div className="flex-1 overflow-y-auto px-5 pt-5 pb-4 sm:px-7">
          <FilterPanel facets={facets} state={state} onChange={(patch) => update(patch)} hide={hideInSheet} />
        </div>
        <div className="az-safe-bottom sticky bottom-0 grid grid-cols-[auto_1fr] gap-3 border-t border-line-soft bg-bg-2 px-5 pt-3 sm:px-7">
          <button type="button" className="az-btn az-btn-ghost" onClick={clearAll} disabled={activeCount === 0}>
            Reset
          </button>
          <button type="button" className="az-btn az-btn-primary" onClick={() => setSheetOpen(false)}>
            Show {pluralise(results.length, "result")}
          </button>
        </div>
      </Modal>
    </div>
  );
}

/** First, last and current ±1 pages, with gaps – keeps pagination narrow on phones. */
function pageWindow(page: number, total: number): Array<number | null> {
  const pages = new Set([1, total, page - 1, page, page + 1].filter((p) => p >= 1 && p <= total));
  const sorted = [...pages].sort((a, b) => a - b);
  const out: Array<number | null> = [];
  sorted.forEach((p, i) => {
    if (i > 0 && p - sorted[i - 1]! > 1) out.push(null);
    out.push(p);
  });
  return out;
}

function activeFilterChips(
  state: ReturnType<typeof useCatalogueParams>["state"],
  brands: Array<{ id: string; name: string }>,
) {
  const chips: Array<{ key: string; label: string; remove: (s: typeof state) => Partial<typeof state> }> = [];
  state.gender?.forEach((g) =>
    chips.push({ key: `g-${g}`, label: GENDER_LABELS[g], remove: (s) => ({ gender: s.gender?.filter((x) => x !== g) }) }),
  );
  state.family?.forEach((f) =>
    chips.push({
      key: `f-${f}`,
      label: SCENT_FAMILY_MAP[f]?.label ?? f,
      remove: (s) => ({ family: s.family?.filter((x) => x !== f) }),
    }),
  );
  state.concentration?.forEach((c) =>
    chips.push({
      key: `c-${c}`,
      label: CONCENTRATION_LABELS[c] ?? c,
      remove: (s) => ({ concentration: s.concentration?.filter((x) => x !== c) }),
    }),
  );
  state.size?.forEach((z) =>
    chips.push({ key: `s-${z}`, label: `${z} ml`, remove: (s) => ({ size: s.size?.filter((x) => x !== z) }) }),
  );
  state.brand?.forEach((b) =>
    chips.push({
      key: `b-${b}`,
      label: brands.find((x) => x.id === b)?.name ?? b,
      remove: (s) => ({ brand: s.brand?.filter((x) => x !== b) }),
    }),
  );
  if (state.priceMin != null || state.priceMax != null)
    chips.push({
      key: "price",
      label: `₹${state.priceMin ?? 0} – ${state.priceMax != null ? `₹${state.priceMax}` : "any"}`,
      remove: () => ({ priceMin: null, priceMax: null }),
    });
  if (state.tag)
    chips.push({ key: "tag", label: state.tag === "new" ? "New arrivals" : "Bestsellers", remove: () => ({ tag: null }) });
  return chips;
}
