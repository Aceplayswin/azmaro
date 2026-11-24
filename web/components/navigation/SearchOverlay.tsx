"use client";

import Image from "next/image";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { ArrowLeft, ArrowRight, Search } from "lucide-react";
import { useEffect, useRef, useState } from "react";
import { Modal } from "@/components/ui/Modal";
import { ProductArtwork } from "@/components/ui/Artwork";
import { PriceDisplay } from "@/components/ui/PriceDisplay";
import { LoadingState } from "@/components/ui/States";
import { QuickViewContent } from "@/components/products/QuickViewContent";
import type { ProductSummary } from "@/lib/catalogue/summary";
import { useDebouncedValue } from "@/lib/useDebouncedValue";

const SUGGESTED = ["Oud", "Amber", "Rose", "Musk", "Fresh", "Saffron", "Lattafa", "Armaf"];

interface SearchResponse {
  query: string;
  total: number;
  results: ProductSummary[];
}

export function SearchOverlay({ open, onClose }: { open: boolean; onClose: () => void }) {
  const router = useRouter();
  const [query, setQuery] = useState("");
  const [data, setData] = useState<SearchResponse | null>(null);
  const [loading, setLoading] = useState(false);
  const [quick, setQuick] = useState<ProductSummary | null>(null);
  const inputRef = useRef<HTMLInputElement>(null);
  // Only hit /api/search once the shopper pauses typing.
  const debouncedQuery = useDebouncedValue(query, 250);

  useEffect(() => {
    if (!open) return;
    const controller = new AbortController();
    (async () => {
      setLoading(true);
      try {
        const res = await fetch(`/api/search?q=${encodeURIComponent(debouncedQuery)}&limit=8`, { signal: controller.signal });
        if (res.ok) setData((await res.json()) as SearchResponse);
      } catch {
        /* aborted */
      } finally {
        if (!controller.signal.aborted) setLoading(false);
      }
    })();
    // Cancel an in-flight request if a newer query arrives or the overlay closes.
    return () => controller.abort();
  }, [debouncedQuery, open]);

  const close = () => {
    setQuick(null);
    onClose();
  };

  const submit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!query.trim()) return;
    close();
    router.push(`/search?q=${encodeURIComponent(query.trim())}`);
  };

  const hasQuery = query.trim().length > 0;

  return (
    <Modal open={open} onClose={close} title="Search AZMARO" hideTitle placement="top" className="bg-bg">
      <div className="az-container py-6 sm:py-10">
        {quick ? (
          <div className="az-anim-fade">
            <button type="button" onClick={() => setQuick(null)} className="az-link mb-2 inline-flex items-center gap-2">
              <ArrowLeft className="size-3.5" aria-hidden /> Back to results
            </button>
            <div className="az-panel border-line">
              <QuickViewContent product={quick} onNavigate={close} />
            </div>
          </div>
        ) : (
          <>
            <form role="search" onSubmit={submit} className="az-panel border-line p-5 pr-14 sm:p-7 sm:pr-16">
              <label htmlFor="site-search" className="az-eyebrow mb-3 block">
                Search AZMARO
              </label>
              <div className="relative">
                <Search className="pointer-events-none absolute top-1/2 left-4 size-4 -translate-y-1/2 text-gold" aria-hidden />
                <input
                  ref={inputRef}
                  id="site-search"
                  data-autofocus
                  type="search"
                  autoComplete="off"
                  value={query}
                  onChange={(e) => setQuery(e.target.value)}
                  placeholder="Search fragrances, brands or notes"
                  className="az-input h-14 pl-11 text-base"
                />
              </div>
            </form>

            {!hasQuery && (
              <div className="mt-8">
                <p className="az-eyebrow mb-3">Suggested searches</p>
                <div className="flex flex-wrap gap-2">
                  {SUGGESTED.map((s) => (
                    <button
                      key={s}
                      type="button"
                      className="az-chip normal-case tracking-[0.08em]"
                      onClick={() => {
                        setQuery(s);
                        inputRef.current?.focus();
                      }}
                    >
                      {s}
                    </button>
                  ))}
                </div>
              </div>
            )}

            <div className="mt-10" aria-live="polite">
              <div className="mb-4 flex items-end justify-between gap-4">
                <p className="az-eyebrow">
                  {hasQuery ? (data ? `${data.total} ${data.total === 1 ? "match" : "matches"}` : "Searching") : "Suggested fragrances"}
                </p>
                {hasQuery && data && data.total > 0 && (
                  <Link href={`/search?q=${encodeURIComponent(query.trim())}`} onClick={close} className="az-link inline-flex items-center gap-2">
                    View all <ArrowRight className="size-3.5" aria-hidden />
                  </Link>
                )}
              </div>
              <div className="az-rule mb-6" />

              {loading && !data && <LoadingState label="Searching" />}

              {data && hasQuery && data.total === 0 && (
                <div className="py-10 text-center">
                  <p className="font-serif text-2xl">No fragrances match “{query.trim()}”.</p>
                  <p className="mt-2 text-sm text-ink-2">Try a brand name, a note such as saffron or vanilla, or a scent family.</p>
                </div>
              )}

              {data && data.results.length > 0 && (
                <ul className="grid gap-x-6 gap-y-2 sm:grid-cols-2">
                  {data.results.map((p) => (
                    <li key={p.slug} className="flex items-center gap-4 border-b border-line-soft py-3">
                      <Link href={`/product/${p.slug}`} onClick={close} className="relative block aspect-[4/5] w-16 shrink-0 overflow-hidden border border-line-soft">
                        {p.image ? (
                          <Image src={p.image.src} alt="" fill sizes="64px" className="object-cover" />
                        ) : (
                          <ProductArtwork brandName={p.brandName} name={p.name} size="thumb" />
                        )}
                      </Link>
                      <div className="min-w-0 flex-1">
                        <p className="text-[0.6rem] font-bold tracking-[0.2em] text-gold uppercase">{p.brandName}</p>
                        <Link href={`/product/${p.slug}`} onClick={close} className="block truncate font-serif text-lg hover:text-gold-light">
                          {p.name}
                        </Link>
                        <PriceDisplay price={p.price} mrp={p.mrp} size="sm" />
                      </div>
                      <button type="button" className="az-link shrink-0" onClick={() => setQuick(p)}>
                        Quick view
                      </button>
                    </li>
                  ))}
                </ul>
              )}
            </div>
          </>
        )}
      </div>
    </Modal>
  );
}
