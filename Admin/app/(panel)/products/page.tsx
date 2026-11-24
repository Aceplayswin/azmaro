"use client";

import { ArrowDown, ArrowUp, ArrowUpDown, Download, ImageOff, Pencil, Plus, RefreshCw, Search, Trash2 } from "lucide-react";
import Link from "next/link";
import { useRouter, useSearchParams } from "next/navigation";
import { Suspense, useCallback, useEffect, useMemo, useState } from "react";
import { PageTitle } from "@/components/Pager";
import { PriceCell } from "@/components/PriceCell";
import { NoticeBar, type Notice } from "@/components/ui";
import { api, errorMessage, imageSrc, type Pagination } from "@/lib/api";
import type { Brand, Product } from "@/lib/types";
import { useDebouncedValue } from "@/lib/useDebouncedValue";

const STATUS_FILTERS = {
  all: { label: "All statuses", query: {} },
  live: { label: "Active (orderable)", query: { published: "true", priced: "true" } },
  "needs-price": { label: "Needs price", query: { priced: "false" } },
  hidden: { label: "Hidden", query: { published: "false" } },
  "no-photo": { label: "No photo", query: { imageStatus: "missing" } },
} as const;
type StatusFilter = keyof typeof STATUS_FILTERS;

type SortKey = "name" | "brand" | "price" | "updated";
const SORT_PARAM: Record<SortKey, [asc: string, desc: string]> = {
  name: ["name-asc", "name-desc"],
  brand: ["brand", "brand-desc"],
  price: ["price-asc", "price-desc"],
  updated: ["updated-asc", "updated-desc"],
};

function status(p: Product) {
  if (!p.isPublished) return { label: "Hidden", cls: "" };
  if (p.variants.some((v) => v.isPurchasable)) return { label: "Active", cls: "badge-ok" };
  return { label: "Needs price", cls: "badge-warn" };
}

function stockText(p: Product) {
  const tracked = p.variants.filter((v) => v.inventory?.quantity !== null && v.inventory?.quantity !== undefined);
  if (!p.variants.length) return "—";
  if (!tracked.length) return "Not tracked";
  return String(tracked.reduce((s, v) => s + (v.inventory?.quantity ?? 0), 0));
}

const formatDate = (iso: string) => new Date(iso).toLocaleDateString("en-IN", { day: "2-digit", month: "short", year: "numeric" });

const csvCell = (v: unknown) => `"${String(v ?? "").replace(/"/g, '""')}"`;

function ProductsView() {
  const router = useRouter();
  const params = useSearchParams();
  const statusFilter = (params.get("tab") && params.get("tab")! in STATUS_FILTERS ? params.get("tab") : "all") as StatusFilter;

  const [search, setSearch] = useState("");
  const q = useDebouncedValue(search.trim(), 300);
  const [brand, setBrand] = useState("");
  const [sort, setSort] = useState<{ key: SortKey | null; dir: "asc" | "desc" }>({ key: null, dir: "asc" });
  const [page, setPage] = useState(1);
  const [pageSize, setPageSize] = useState(25);
  const [rows, setRows] = useState<Product[] | null>(null);
  const [pagination, setPagination] = useState<Pagination | null>(null);
  const [brands, setBrands] = useState<Brand[]>([]);
  const [selected, setSelected] = useState<Set<string>>(new Set());
  const [notice, setNotice] = useState<Notice>(null);
  const [busy, setBusy] = useState(false);
  const [version, setVersion] = useState(0);

  const query = useMemo(
    () => ({
      ...STATUS_FILTERS[statusFilter].query,
      q,
      brand,
      sort: sort.key ? SORT_PARAM[sort.key][sort.dir === "asc" ? 0 : 1] : "catalogue",
    }),
    [statusFilter, q, brand, sort],
  );

  useEffect(() => {
    api<Brand[]>("/admin/brands").then(({ data }) => setBrands(data)).catch(() => undefined);
  }, []);

  // New search term → back to the first page. Done during render (not in an effect)
  // so the list is fetched once with the new term and page 1, not twice.
  const [pageForQ, setPageForQ] = useState(q);
  if (pageForQ !== q) {
    setPageForQ(q);
    setPage(1);
  }

  useEffect(() => {
    let cancelled = false;
    api<Product[]>("/admin/products", { query: { ...query, page, pageSize } })
      .then((r) => {
        if (cancelled) return;
        setRows(r.data);
        setPagination(r.meta?.pagination ?? null);
        setSelected(new Set());
      })
      .catch((e) => !cancelled && setNotice({ kind: "error", text: errorMessage(e) }));
    return () => {
      cancelled = true;
    };
  }, [query, page, pageSize, version]);

  const reload = () => setVersion((v) => v + 1);

  const refreshRow = useCallback(async (id: string) => {
    const { data } = await api<Product>(`/admin/products/${id}`);
    setRows((rs) => rs?.map((r) => (r.id === id ? data : r)) ?? rs);
  }, []);

  function toggleSort(key: SortKey) {
    setSort((s) => (s.key === key ? { key, dir: s.dir === "asc" ? "desc" : "asc" } : { key, dir: key === "updated" ? "desc" : "asc" }));
    setPage(1);
  }

  const allOnPage = rows?.length ? rows.every((r) => selected.has(r.id)) : false;
  const toggleAll = () => setSelected(allOnPage ? new Set() : new Set(rows?.map((r) => r.id)));
  const toggleOne = (id: string) =>
    setSelected((s) => {
      const next = new Set(s);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });

  /** Run an action for each selected product; report how many succeeded. */
  async function bulk(label: string, action: (id: string) => Promise<unknown>) {
    const ids = [...selected];
    setBusy(true);
    const results = await Promise.allSettled(ids.map(action));
    const failed = results.filter((r): r is PromiseRejectedResult => r.status === "rejected");
    setBusy(false);
    setNotice(
      failed.length
        ? { kind: "error", text: `${label}: ${ids.length - failed.length} done, ${failed.length} failed – ${errorMessage(failed[0]!.reason)}` }
        : { kind: "ok", text: `${label}: ${ids.length} product(s) updated.` },
    );
    reload();
  }

  const setPublished = (value: boolean) => bulk(value ? "Publish" : "Unpublish", (id) => api(`/admin/products/${id}`, { method: "PATCH", body: { isPublished: value } }));

  function bulkDelete() {
    if (!confirm(`Delete ${selected.size} product(s)? Products that have been ordered can't be deleted.`)) return;
    void bulk("Delete", (id) => api(`/admin/products/${id}`, { method: "DELETE" }));
  }

  async function deleteOne(p: Product) {
    if (!confirm(`Delete "${p.name}"? This can't be undone.`)) return;
    try {
      await api(`/admin/products/${p.id}`, { method: "DELETE" });
      setNotice({ kind: "ok", text: `${p.name} deleted.` });
      reload();
    } catch (e) {
      setNotice({ kind: "error", text: errorMessage(e) });
    }
  }

  /** Export every product matching the current filters. */
  async function exportCsv() {
    setBusy(true);
    try {
      const all: Product[] = [];
      for (let p = 1; ; p++) {
        const r = await api<Product[]>("/admin/products", { query: { ...query, page: p, pageSize: 100 } });
        all.push(...r.data);
        if (p >= (r.meta?.pagination?.totalPages ?? 1)) break;
      }
      const header = ["Name", "Slug", "Brand", "Status", "Published", "Sizes (ml)", "Prices (INR)", "MRP (INR)", "SKUs", "Stock", "Updated"];
      const lines = all.map((p) =>
        [
          p.name,
          p.slug,
          p.brand.name,
          status(p).label,
          p.isPublished ? "Yes" : "No",
          p.variants.map((v) => v.sizeMl).join(" | "),
          p.variants.map((v) => v.price ?? "").join(" | "),
          p.variants.map((v) => v.mrp ?? "").join(" | "),
          p.variants.map((v) => v.sku ?? "").join(" | "),
          stockText(p),
          p.updatedAt,
        ]
          .map(csvCell)
          .join(","),
      );
      const blob = new Blob([`﻿${[header.map(csvCell).join(","), ...lines].join("\r\n")}`], { type: "text/csv;charset=utf-8" });
      const a = document.createElement("a");
      a.href = URL.createObjectURL(blob);
      a.download = `azmaro-products-${new Date().toISOString().slice(0, 10)}.csv`;
      a.click();
      URL.revokeObjectURL(a.href);
    } catch (e) {
      setNotice({ kind: "error", text: errorMessage(e) });
    } finally {
      setBusy(false);
    }
  }

  const sortHeader = (k: SortKey, children: React.ReactNode, className = "") => {
    const active = sort.key === k;
    const Icon = !active ? ArrowUpDown : sort.dir === "asc" ? ArrowUp : ArrowDown;
    return (
      <th className={className} aria-sort={active ? (sort.dir === "asc" ? "ascending" : "descending") : "none"}>
        <button type="button" onClick={() => toggleSort(k)} className="inline-flex items-center gap-1 hover:text-ink">
          {children}
          <Icon size={12} className={active ? "text-primary" : "text-muted"} />
        </button>
      </th>
    );
  };

  const from = pagination && pagination.total ? (pagination.page - 1) * pagination.pageSize + 1 : 0;
  const to = pagination ? Math.min(pagination.page * pagination.pageSize, pagination.total) : 0;

  return (
    <div className="page">
      <PageTitle title="Products" subtitle="Click a price to change it. Open a product for photos, stock and full details.">
          <button className="btn" onClick={exportCsv} disabled={busy}>
            <Download size={14} /> Export CSV
          </button>
          <Link href="/products/new" className="btn btn-primary">
            <Plus size={14} /> New product
          </Link>
        </PageTitle>

      <div className="card">
        {/* Toolbar */}
        <div className="flex flex-wrap items-center gap-2 border-b border-line-soft p-3">
          <div className="relative min-w-56 flex-1">
            <Search size={14} className="pointer-events-none absolute top-1/2 left-2.5 -translate-y-1/2 text-muted" />
            <input className="input pl-8" placeholder="Search name or slug" value={search} onChange={(e) => setSearch(e.target.value)} aria-label="Search products" />
          </div>
          <select
            className="input w-auto"
            aria-label="Status"
            value={statusFilter}
            onChange={(e) => {
              setPage(1);
              router.replace(e.target.value === "all" ? "/products" : `/products?tab=${e.target.value}`, { scroll: false });
            }}
          >
            {Object.entries(STATUS_FILTERS).map(([k, f]) => (
              <option key={k} value={k}>
                {f.label}
              </option>
            ))}
          </select>
          <select
            className="input w-auto"
            aria-label="Brand"
            value={brand}
            onChange={(e) => {
              setBrand(e.target.value);
              setPage(1);
            }}
          >
            <option value="">All brands</option>
            {brands.map((b) => (
              <option key={b.id} value={b.slug}>
                {b.name}
              </option>
            ))}
          </select>
          <button className="btn btn-icon h-[2.125rem] w-[2.125rem]" onClick={reload} aria-label="Refresh" title="Refresh">
            <RefreshCw size={14} />
          </button>
        </div>

        {/* Bulk actions */}
        {selected.size > 0 && (
          <div className="flex flex-wrap items-center gap-2 border-b border-line-soft bg-blue-50 px-3 py-2">
            <span className="mr-2 font-medium">{selected.size} selected</span>
            <button className="btn btn-sm" disabled={busy} onClick={() => setPublished(true)}>Publish</button>
            <button className="btn btn-sm" disabled={busy} onClick={() => setPublished(false)}>Unpublish</button>
            <button className="btn btn-sm btn-danger" disabled={busy} onClick={bulkDelete}>
              <Trash2 size={12} /> Delete
            </button>
            <button className="btn btn-sm ml-auto" onClick={() => setSelected(new Set())}>Clear selection</button>
          </div>
        )}

        {notice && (
          <div className="border-b border-line-soft px-3 py-2">
            <NoticeBar notice={notice} />
          </div>
        )}

        <div className="overflow-x-auto">
          <table className="table min-w-[1050px]">
            <thead>
              <tr>
                <th className="w-8">
                  <input type="checkbox" aria-label="Select all on this page" checked={allOnPage} onChange={toggleAll} />
                </th>
                <th className="w-12">Image</th>
                {sortHeader("name", "Product")}
                {sortHeader("brand", "Brand")}
                {sortHeader("price", "Sizes / price (click to edit)")}
                <th className="w-24">Stock</th>
                <th className="w-28">Status</th>
                {sortHeader("updated", "Updated", "w-28")}
                <th className="w-20 text-right">Actions</th>
              </tr>
            </thead>
            <tbody>
              {rows === null && (
                <tr>
                  <td colSpan={9} className="py-10 text-center text-muted">Loading…</td>
                </tr>
              )}
              {rows?.length === 0 && (
                <tr>
                  <td colSpan={9} className="py-10 text-center text-muted">No products found.</td>
                </tr>
              )}
              {rows?.map((p) => {
                const photo = p.images.find((i) => i.status === "APPROVED") ?? p.images[0];
                const st = status(p);
                return (
                  <tr key={p.id} aria-selected={selected.has(p.id)}>
                    <td>
                      <input type="checkbox" aria-label={`Select ${p.name}`} checked={selected.has(p.id)} onChange={() => toggleOne(p.id)} />
                    </td>
                    <td>
                      <span className="block h-9 w-9 overflow-hidden rounded border border-line-soft bg-elevated">
                        {photo ? (
                          // eslint-disable-next-line @next/next/no-img-element
                          <img src={imageSrc(photo.url)} alt="" className="h-full w-full object-cover" loading="lazy" />
                        ) : (
                          <span className="grid h-full place-items-center text-muted" title="No photo">
                            <ImageOff size={14} />
                          </span>
                        )}
                      </span>
                    </td>
                    <td>
                      <Link href={`/products/${p.id}`} className="font-medium text-primary hover:underline">
                        {p.name}
                      </Link>
                      <div className="text-xs text-muted">{p.slug}</div>
                    </td>
                    <td>{p.brand.name}</td>
                    <td>
                      <PriceCell product={p} onSaved={() => refreshRow(p.id)} />
                    </td>
                    <td className="tabular-nums">{stockText(p)}</td>
                    <td>
                      <span className={`badge ${st.cls}`}>{st.label}</span>
                      {p.isFeatured && <span className="badge ml-1">Featured</span>}
                    </td>
                    <td className="text-ink-2">{formatDate(p.updatedAt)}</td>
                    <td>
                      <div className="flex justify-end gap-1">
                        <Link href={`/products/${p.id}`} className="btn btn-icon" aria-label={`Edit ${p.name}`} title="Edit">
                          <Pencil size={13} />
                        </Link>
                        <button className="btn btn-icon btn-danger" aria-label={`Delete ${p.name}`} title="Delete" onClick={() => deleteOne(p)}>
                          <Trash2 size={13} />
                        </button>
                      </div>
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>

        {/* Footer: count, page size, paging */}
        <div className="flex flex-wrap items-center justify-between gap-3 border-t border-line-soft px-3 py-2 text-ink-2">
          <span>{pagination ? `Showing ${from}–${to} of ${pagination.total}` : ""}</span>
          <div className="flex items-center gap-2">
            <label className="flex items-center gap-2">
              Rows per page
              <select
                className="input w-auto py-0"
                value={pageSize}
                onChange={(e) => {
                  setPageSize(Number(e.target.value));
                  setPage(1);
                }}
              >
                {[25, 50, 100].map((n) => (
                  <option key={n}>{n}</option>
                ))}
              </select>
            </label>
            <button className="btn btn-sm" disabled={!pagination || pagination.page <= 1} onClick={() => setPage(1)}>
              First
            </button>
            <button className="btn btn-sm" disabled={!pagination || pagination.page <= 1} onClick={() => setPage((n) => n - 1)}>
              Prev
            </button>
            <span className="px-1">
              Page {pagination?.page ?? 1} / {pagination?.totalPages ?? 1}
            </span>
            <button className="btn btn-sm" disabled={!pagination || pagination.page >= pagination.totalPages} onClick={() => setPage((n) => n + 1)}>
              Next
            </button>
            <button className="btn btn-sm" disabled={!pagination || pagination.page >= pagination.totalPages} onClick={() => setPage(pagination!.totalPages)}>
              Last
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}

export default function ProductsPage() {
  return (
    <Suspense fallback={<p className="text-muted">Loading…</p>}>
      <ProductsView />
    </Suspense>
  );
}
