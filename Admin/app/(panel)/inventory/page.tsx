"use client";

import Link from "next/link";
import { useState } from "react";
import { PageTitle, Pager, TableMessage } from "@/components/Pager";
import { NoticeBar, type Notice } from "@/components/ui";
import { api, errorMessage } from "@/lib/api";
import { STOCK_LABEL, type StockStatus } from "@/lib/types";
import { useApiList } from "@/lib/useApiList";

interface InventoryRow {
  variantId: string;
  productId: string;
  product: string;
  brand: string;
  slug: string;
  sizeMl: number;
  sku: string | null;
  quantity: number | null;
  stockStatus: StockStatus | null;
  lowStockAt: number | null;
  tracked: boolean;
}

function StockEditor({ row, onSaved }: { row: InventoryRow; onSaved: (n: Notice) => void }) {
  const [qty, setQty] = useState(row.quantity?.toString() ?? "");
  const [status, setStatus] = useState<StockStatus | "">(row.stockStatus ?? "");
  const [low, setLow] = useState(row.lowStockAt?.toString() ?? "");
  const [busy, setBusy] = useState(false);
  const dirty = qty !== (row.quantity?.toString() ?? "") || status !== (row.stockStatus ?? "") || low !== (row.lowStockAt?.toString() ?? "");

  async function save() {
    if (qty.trim() && !/^\d+$/.test(qty.trim())) return onSaved({ kind: "error", text: "Stock must be a whole number (or blank = not tracked)." });
    setBusy(true);
    try {
      await api(`/admin/inventory/${row.variantId}`, {
        method: "PUT",
        body: { quantity: qty.trim() ? Number(qty) : null, stockStatus: status || null, lowStockAt: low.trim() ? Number(low) : null },
      });
      onSaved({ kind: "ok", text: `${row.product} ${row.sizeMl} ml saved.` });
    } catch (e) {
      onSaved({ kind: "error", text: errorMessage(e) });
    } finally {
      setBusy(false);
    }
  }

  const lowNow = row.quantity !== null && row.quantity <= (row.lowStockAt ?? 5);
  return (
    <>
      <td>
        <input className={`input w-20 ${lowNow ? "border-warn" : ""}`} inputMode="numeric" placeholder="—" value={qty} onChange={(e) => setQty(e.target.value)} aria-label="Quantity" />
      </td>
      <td>
        <input className="input w-16" inputMode="numeric" placeholder="5" value={low} onChange={(e) => setLow(e.target.value)} aria-label="Low-stock alert at" />
      </td>
      <td>
        <select className="input w-36" value={status} onChange={(e) => setStatus(e.target.value as StockStatus | "")} aria-label="Stock status">
          <option value="">Automatic</option>
          {(Object.keys(STOCK_LABEL) as StockStatus[]).map((s) => (
            <option key={s} value={s}>
              {STOCK_LABEL[s]}
            </option>
          ))}
        </select>
      </td>
      <td className="text-right">
        <button className="btn btn-sm btn-primary" disabled={busy || !dirty} onClick={save}>
          {busy ? "Saving…" : "Save"}
        </button>
      </td>
    </>
  );
}

export default function InventoryPage() {
  const [filters, setFilters] = useState({ lowStock: "", page: 1, pageSize: 50 });
  const [notice, setNotice] = useState<Notice>(null);
  const { rows, pagination, error, reload } = useApiList<InventoryRow>("/admin/inventory", filters);

  return (
    <div className="page">
      <PageTitle title="Inventory" subtitle="Stock per size. Leave quantity blank when stock isn't tracked; tracked stock is reduced automatically on every order." />
      <div className="card">
        <div className="flex flex-wrap items-center gap-3 border-b border-line-soft p-3">
          <select className="input w-auto" value={filters.lowStock} onChange={(e) => setFilters((f) => ({ ...f, lowStock: e.target.value, page: 1 }))} aria-label="Filter">
            <option value="">All sizes</option>
            <option value="true">Low stock only</option>
          </select>
          <NoticeBar notice={error ? { kind: "error", text: error } : notice} />
        </div>
        <div className="overflow-x-auto">
          <table className="table min-w-[900px]">
            <thead>
              <tr>
                <th>Product</th>
                <th>Size</th>
                <th>SKU</th>
                <th>In stock</th>
                <th>Alert at</th>
                <th>Status shown</th>
                <th />
              </tr>
            </thead>
            <tbody>
              {rows === null && <TableMessage cols={7}>Loading…</TableMessage>}
              {rows?.length === 0 && <TableMessage cols={7}>Nothing here.</TableMessage>}
              {rows?.map((r) => (
                <tr key={`${r.variantId}-${r.quantity}-${r.stockStatus}-${r.lowStockAt}`}>
                  <td>
                    <Link href={`/products/${r.productId}`} className="font-medium text-primary hover:underline">
                      {r.product}
                    </Link>
                    <div className="text-xs text-muted">{r.brand}</div>
                  </td>
                  <td>{r.sizeMl} ml</td>
                  <td className="text-ink-2">{r.sku ?? "—"}</td>
                  <StockEditor
                    row={r}
                    onSaved={(n) => {
                      setNotice(n);
                      if (n?.kind === "ok") reload();
                    }}
                  />
                </tr>
              ))}
            </tbody>
          </table>
        </div>
        <Pager pagination={pagination} onPage={(page) => setFilters((f) => ({ ...f, page }))} pageSize={filters.pageSize} onPageSize={(pageSize) => setFilters((f) => ({ ...f, pageSize, page: 1 }))} />
      </div>
    </div>
  );
}
