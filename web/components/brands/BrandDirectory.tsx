"use client";

import { Search } from "lucide-react";
import { useMemo, useState } from "react";
import { EmptyState } from "@/components/ui/States";
import type { BrandWithCount } from "@/types/catalogue";
import { normalise } from "@/lib/catalogue/filter";
import { useDebouncedValue } from "@/lib/useDebouncedValue";
import { BrandTile } from "./BrandTile";

const LETTERS = "ABCDEFGHIJKLMNOPQRSTUVWXYZ".split("");

/** Searchable, alphabetical brand directory generated from active brand records. */
export function BrandDirectory({ brands }: { brands: BrandWithCount[] }) {
  const [query, setQuery] = useState("");
  const debouncedQuery = useDebouncedValue(query, 200);
  const filtered = useMemo(
    () => brands.filter((b) => normalise(b.name).includes(normalise(debouncedQuery.trim()))),
    [brands, debouncedQuery],
  );
  const groups = useMemo(() => {
    const map = new Map<string, BrandWithCount[]>();
    for (const b of filtered) {
      const letter = b.name[0]!.toUpperCase();
      map.set(letter, [...(map.get(letter) ?? []), b]);
    }
    return [...map.entries()].sort(([a], [b]) => a.localeCompare(b));
  }, [filtered]);
  const available = new Set(brands.map((b) => b.name[0]!.toUpperCase()));

  return (
    <div>
      <div className="relative max-w-md">
        <label htmlFor="brand-search" className="sr-only">
          Search brands
        </label>
        <Search className="pointer-events-none absolute top-1/2 left-4 size-4 -translate-y-1/2 text-gold" aria-hidden />
        <input
          id="brand-search"
          type="search"
          value={query}
          onChange={(e) => setQuery(e.target.value)}
          placeholder="Search brands"
          className="az-input pl-11"
        />
      </div>

      <nav aria-label="Brands A to Z" className="mt-6">
        <ul className="grid grid-cols-9 gap-1.5 sm:grid-cols-[repeat(13,minmax(0,1fr))] lg:flex lg:flex-wrap">
          {LETTERS.map((l) => {
            const enabled = available.has(l);
            return (
              <li key={l}>
                {enabled ? (
                  <a
                    href={`#letter-${l}`}
                    className="grid h-9 place-items-center border border-line-soft text-[0.7rem] font-bold text-ink-2 transition-colors hover:border-gold hover:text-gold-light lg:w-9"
                  >
                    {l}
                  </a>
                ) : (
                  <span className="grid h-9 place-items-center border border-line-soft/40 text-[0.7rem] font-bold text-muted/40 lg:w-9" aria-hidden="true">
                    {l}
                  </span>
                )}
              </li>
            );
          })}
        </ul>
      </nav>

      <div className="mt-12 space-y-10" aria-live="polite">
        {groups.length === 0 && <EmptyState title="No brands found" description="Try a different spelling, or browse the full list A–Z." />}
        {groups.map(([letter, items]) => (
          <section key={letter} id={`letter-${letter}`} aria-labelledby={`letter-${letter}-title`} className="scroll-mt-28">
            <div className="mb-4 flex items-center gap-4">
              <h3 id={`letter-${letter}-title`} className="font-serif text-3xl text-gold">
                {letter}
              </h3>
              <div className="az-rule flex-1" />
            </div>
            <div className="grid grid-cols-2 gap-3 sm:gap-4 md:grid-cols-3 lg:grid-cols-4">
              {items.map((b) => (
                <BrandTile key={b.id} brand={b} />
              ))}
            </div>
          </section>
        ))}
      </div>
    </div>
  );
}
