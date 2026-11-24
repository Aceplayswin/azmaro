"use client";

import { usePathname, useRouter, useSearchParams } from "next/navigation";
import { useCallback, useMemo } from "react";
import type { CatalogueFilters, Concentration, Gender, ScentFamilyId, SortKey } from "@/types/catalogue";

const list = (v: string | null) => (v ? v.split(",").filter(Boolean) : []);
const num = (v: string | null) => (v && !Number.isNaN(Number(v)) ? Number(v) : null);

export interface CatalogueState extends CatalogueFilters {
  page: number;
}

/** Filters live in the URL so results are shareable and survive refresh / back. */
export function useCatalogueParams() {
  const params = useSearchParams();
  const router = useRouter();
  const pathname = usePathname();

  const state: CatalogueState = useMemo(
    () => ({
      q: params.get("q") ?? "",
      gender: list(params.get("gender")) as Gender[],
      family: list(params.get("family")) as ScentFamilyId[],
      concentration: list(params.get("conc")) as Concentration[],
      size: list(params.get("size")).map(Number).filter((n) => !Number.isNaN(n)),
      brand: list(params.get("brand")),
      priceMin: num(params.get("min")),
      priceMax: num(params.get("max")),
      tag: (params.get("tag") as CatalogueFilters["tag"]) ?? null,
      sort: (params.get("sort") as SortKey) ?? "featured",
      page: Math.max(1, num(params.get("page")) ?? 1),
    }),
    [params],
  );

  const update = useCallback(
    (patch: Partial<CatalogueState>, opts: { resetPage?: boolean; scroll?: boolean } = { resetPage: true }) => {
      const next = new URLSearchParams(params.toString());
      const set = (key: string, value: string | null | undefined) => {
        if (value === null || value === undefined || value === "") next.delete(key);
        else next.set(key, value);
      };
      if ("q" in patch) set("q", patch.q?.trim());
      if ("gender" in patch) set("gender", patch.gender?.join(","));
      if ("family" in patch) set("family", patch.family?.join(","));
      if ("concentration" in patch) set("conc", patch.concentration?.join(","));
      if ("size" in patch) set("size", patch.size?.join(","));
      if ("brand" in patch) set("brand", patch.brand?.join(","));
      if ("priceMin" in patch) set("min", patch.priceMin == null ? null : String(patch.priceMin));
      if ("priceMax" in patch) set("max", patch.priceMax == null ? null : String(patch.priceMax));
      if ("tag" in patch) set("tag", patch.tag ?? null);
      if ("sort" in patch) set("sort", patch.sort === "featured" ? null : patch.sort);
      if ("page" in patch) set("page", patch.page && patch.page > 1 ? String(patch.page) : null);
      else if (opts.resetPage !== false) next.delete("page");
      const qs = next.toString();
      router.replace(qs ? `${pathname}?${qs}` : pathname, { scroll: opts.scroll ?? false });
    },
    [params, pathname, router],
  );

  const clearAll = useCallback(() => {
    const next = new URLSearchParams();
    const q = params.get("q");
    if (q) next.set("q", q);
    const qs = next.toString();
    router.replace(qs ? `${pathname}?${qs}` : pathname, { scroll: false });
  }, [params, pathname, router]);

  const activeCount =
    (state.gender?.length ?? 0) +
    (state.family?.length ?? 0) +
    (state.concentration?.length ?? 0) +
    (state.size?.length ?? 0) +
    (state.brand?.length ?? 0) +
    (state.priceMin != null || state.priceMax != null ? 1 : 0);

  return { state, update, clearAll, activeCount };
}
