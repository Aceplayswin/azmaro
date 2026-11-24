"use client";

import { Plus, Trash2 } from "lucide-react";
import { useState } from "react";
import { api, ApiError, errorMessage } from "@/lib/api";
import type { Product, StockStatus, Variant } from "@/lib/types";
import { STOCK_LABEL } from "@/lib/types";
import { NoticeBar, Section, type Notice } from "./ui";

interface Row {
  key: string;
  id: string | null;
  sizeMl: string;
  sku: string;
  price: string;
  mrp: string;
  isActive: boolean;
  quantity: string;
  stockStatus: StockStatus | "";
}

const toRow = (v: Variant): Row => ({
  key: v.id,
  id: v.id,
  sizeMl: String(v.sizeMl),
  sku: v.sku ?? "",
  price: v.price?.toString() ?? "",
  mrp: v.mrp?.toString() ?? "",
  isActive: v.isActive,
  quantity: v.inventory?.quantity?.toString() ?? "",
  stockStatus: v.inventory?.stockStatus ?? "",
});

const blankRow = (): Row => ({ key: `new-${Math.random()}`, id: null, sizeMl: "", sku: "", price: "", mrp: "", isActive: true, quantity: "", stockStatus: "" });

const same = (a: Row, b: Row) => JSON.stringify({ ...a, key: "" }) === JSON.stringify({ ...b, key: "" });

/** Sizes, selling prices, MRP and stock. A size can be ordered only once it has a price. */
export function VariantsEditor({ product, onChanged }: { product: Product; onChanged: () => Promise<void> }) {
  const original = product.variants.map(toRow);
  const [rows, setRows] = useState<Row[]>(original.length ? original : [blankRow()]);
  const [busy, setBusy] = useState<string | null>(null);
  const [notice, setNotice] = useState<Notice>(null);
  const [rowErrors, setRowErrors] = useState<Record<string, string>>({});

  const update = (key: string, patch: Partial<Row>) => setRows((rs) => rs.map((r) => (r.key === key ? { ...r, ...patch } : r)));
  const dirty = (r: Row) => {
    const o = original.find((x) => x.key === r.key);
    return !o || !same(o, r);
  };

  async function save(r: Row) {
    setBusy(r.key);
    setRowErrors((e) => ({ ...e, [r.key]: "" }));
    try {
      if (!/^\d+$/.test(r.sizeMl) || Number(r.sizeMl) <= 0) throw new Error("Enter the size in ml.");
      const body = { sizeMl: Number(r.sizeMl), sku: r.sku.trim() || null, price: r.price.trim() || null, mrp: r.mrp.trim() || null, isActive: r.isActive };
      let variantId = r.id;
      if (variantId) await api(`/admin/variants/${variantId}`, { method: "PATCH", body });
      else variantId = (await api<Variant>(`/admin/products/${product.id}/variants`, { method: "POST", body })).data.id;

      const o = original.find((x) => x.key === r.key);
      if (!o || o.quantity !== r.quantity || o.stockStatus !== r.stockStatus) {
        await api(`/admin/inventory/${variantId}`, {
          method: "PUT",
          body: { quantity: r.quantity.trim() === "" ? null : Number(r.quantity), stockStatus: r.stockStatus || null },
        });
      }
      setNotice({ kind: "ok", text: `${r.sizeMl} ml saved.` });
      await onChanged();
    } catch (e) {
      const msg = e instanceof ApiError ? (Object.values(e.fieldErrors)[0] ?? e.message) : errorMessage(e);
      setRowErrors((x) => ({ ...x, [r.key]: msg }));
    } finally {
      setBusy(null);
    }
  }

  async function remove(r: Row) {
    if (!r.id) return setRows((rs) => rs.filter((x) => x.key !== r.key));
    if (!confirm(`Delete the ${r.sizeMl} ml size?`)) return;
    setBusy(r.key);
    try {
      await api(`/admin/variants/${r.id}`, { method: "DELETE" });
      setNotice({ kind: "ok", text: `${r.sizeMl} ml deleted.` });
      await onChanged();
    } catch (e) {
      setRowErrors((x) => ({ ...x, [r.key]: errorMessage(e) }));
    } finally {
      setBusy(null);
    }
  }

  return (
    <Section
      title="Sizes, prices & stock"
      description="Customers can add a size to their bag only after it has a selling price. Leave stock quantity blank if you don't track it."
      actions={
        <button type="button" className="btn btn-sm" onClick={() => setRows((rs) => [...rs, blankRow()])}>
          <Plus size={14} /> Add size
        </button>
      }
    >
      <div className="overflow-x-auto">
        <table className="table min-w-[900px]">
          <thead>
            <tr>
              <th className="w-24">Size (ml)</th>
              <th className="w-32">Price (₹)</th>
              <th className="w-32">MRP (₹)</th>
              <th>SKU</th>
              <th className="w-24">Stock qty</th>
              <th className="w-36">Stock status</th>
              <th className="w-20">Active</th>
              <th className="w-40" />
            </tr>
          </thead>
          <tbody>
            {rows.map((r) => (
              <tr key={r.key}>
                <td>
                  <input className="input" inputMode="numeric" aria-label="Size in ml" value={r.sizeMl} onChange={(e) => update(r.key, { sizeMl: e.target.value })} />
                </td>
                <td>
                  <input className="input" inputMode="decimal" aria-label="Selling price" placeholder="Not set" value={r.price} onChange={(e) => update(r.key, { price: e.target.value })} />
                </td>
                <td>
                  <input className="input" inputMode="decimal" aria-label="MRP" placeholder="Optional" value={r.mrp} onChange={(e) => update(r.key, { mrp: e.target.value })} />
                </td>
                <td>
                  <input className="input" aria-label="SKU" placeholder="Optional" value={r.sku} onChange={(e) => update(r.key, { sku: e.target.value })} />
                </td>
                <td>
                  <input className="input" inputMode="numeric" aria-label="Stock quantity" placeholder="—" value={r.quantity} onChange={(e) => update(r.key, { quantity: e.target.value })} />
                </td>
                <td>
                  <select className="input" aria-label="Stock status" value={r.stockStatus} onChange={(e) => update(r.key, { stockStatus: e.target.value as StockStatus | "" })}>
                    <option value="">Automatic</option>
                    {(Object.keys(STOCK_LABEL) as StockStatus[]).map((s) => (
                      <option key={s} value={s}>{STOCK_LABEL[s]}</option>
                    ))}
                  </select>
                </td>
                <td>
                  <input type="checkbox" className="h-4 w-4 accent-[var(--c-primary)]" aria-label="Size available" checked={r.isActive} onChange={(e) => update(r.key, { isActive: e.target.checked })} />
                </td>
                <td>
                  <div className="flex items-center justify-end gap-2">
                    <button type="button" className="btn btn-primary btn-sm" disabled={busy !== null || !dirty(r)} onClick={() => save(r)}>
                      {busy === r.key ? "Saving…" : r.id ? "Save" : "Add"}
                    </button>
                    <button type="button" className="btn btn-danger btn-icon" aria-label={`Delete ${r.sizeMl || "new"} ml`} disabled={busy !== null} onClick={() => remove(r)}>
                      <Trash2 size={14} />
                    </button>
                  </div>
                  {rowErrors[r.key] && <p className="mt-1 text-right text-xs text-danger">{rowErrors[r.key]}</p>}
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
      <div className="mt-3 min-h-5">
        <NoticeBar notice={notice} />
      </div>
    </Section>
  );
}
