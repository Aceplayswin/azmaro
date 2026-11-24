"use client";

import { Check, Plus, X } from "lucide-react";
import { useState } from "react";
import { api, errorMessage, formatInr } from "@/lib/api";
import type { Product, Variant } from "@/lib/types";

const validAmount = (v: string) => /^\d{1,8}(\.\d{1,2})?$/.test(v) && Number(v) > 0;

/** Small inline form: Enter saves, Escape cancels. */
function InlineInput({
  fields,
  onSave,
  onCancel,
}: {
  fields: Array<{ key: string; label: string; prefix?: string; suffix?: string; initial: string; width: string }>;
  onSave: (values: Record<string, string>) => Promise<void>;
  onCancel: () => void;
}) {
  const [values, setValues] = useState(() => Object.fromEntries(fields.map((f) => [f.key, f.initial])));
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function save() {
    setBusy(true);
    setError(null);
    try {
      await onSave(values);
    } catch (e) {
      setError(errorMessage(e));
      setBusy(false);
    }
  }

  return (
    <div>
      <div
        className="flex items-center gap-1.5"
        onKeyDown={(e) => {
          if (e.key === "Enter") {
            e.preventDefault();
            void save();
          }
          if (e.key === "Escape") onCancel();
        }}
      >
        {fields.map((f, i) => (
          <label key={f.key} className="flex h-8 items-center rounded-md border border-primary/60 bg-bg-2 px-2 focus-within:border-primary">
            {f.prefix && <span className="mr-1 text-muted">{f.prefix}</span>}
            <input
              autoFocus={i === 0}
              aria-label={f.label}
              inputMode="decimal"
              className={`${f.width} bg-transparent text-ink outline-none`}
              value={values[f.key]}
              onChange={(e) => setValues((v) => ({ ...v, [f.key]: e.target.value }))}
            />
            {f.suffix && <span className="ml-1 text-muted">{f.suffix}</span>}
          </label>
        ))}
        <button type="button" className="btn btn-primary btn-icon" aria-label="Save" disabled={busy} onClick={save}>
          <Check size={14} />
        </button>
        <button type="button" className="btn btn-icon" aria-label="Cancel" disabled={busy} onClick={onCancel}>
          <X size={14} />
        </button>
      </div>
      {error && <p className="mt-1 text-xs text-danger">{error}</p>}
    </div>
  );
}

/** Sizes with their prices; any price can be set or changed in place. */
export function PriceCell({ product, onSaved }: { product: Product; onSaved: () => Promise<void> }) {
  const [editing, setEditing] = useState<string | "new" | null>(null);

  async function savePrice(v: Variant, price: string) {
    const value = price.trim().replace(/[₹,\s]/g, "");
    if (value && !validAmount(value)) throw new Error("Enter a price like 1499 or 1499.50.");
    if (value && v.mrp !== null && Number(value) > v.mrp) throw new Error(`Price can't be above the MRP (${formatInr(v.mrp)}).`);
    await api(`/admin/variants/${v.id}`, { method: "PATCH", body: { price: value || null } });
    setEditing(null);
    await onSaved();
  }

  async function addSize(sizeMl: string, price: string) {
    const value = price.trim().replace(/[₹,\s]/g, "");
    if (!/^\d+$/.test(sizeMl.trim()) || Number(sizeMl) <= 0) throw new Error("Enter the size in ml.");
    if (value && !validAmount(value)) throw new Error("Enter a price like 1499.");
    await api(`/admin/products/${product.id}/variants`, { method: "POST", body: { sizeMl: Number(sizeMl), price: value || null } });
    setEditing(null);
    await onSaved();
  }

  return (
    <div className="flex flex-col items-start gap-1.5">
      {product.variants.map((v) =>
        editing === v.id ? (
          <InlineInput
            key={v.id}
            fields={[{ key: "price", label: `Price for ${v.sizeMl} ml`, prefix: "₹", initial: v.price?.toString() ?? "", width: "w-20" }]}
            onSave={(vals) => savePrice(v, vals.price ?? "")}
            onCancel={() => setEditing(null)}
          />
        ) : (
          <button
            key={v.id}
            type="button"
            onClick={() => setEditing(v.id)}
            title={v.price === null ? "Set a price" : "Change price"}
            className={`group inline-flex h-7 items-center gap-2 rounded-md border px-2.5 text-xs transition-colors ${
              v.price === null ? "border-dashed border-warn/50 text-warn hover:border-warn" : "border-line-soft text-ink hover:border-primary"
            } ${v.isActive ? "" : "opacity-50"}`}
          >
            <span className="text-ink-2">{v.sizeMl} ml</span>
            {v.price === null ? (
              <span className="font-semibold">Set price</span>
            ) : (
              <span className="font-semibold tabular-nums">{formatInr(v.price)}</span>
            )}
          </button>
        ),
      )}
      {editing === "new" ? (
        <InlineInput
          fields={[
            { key: "size", label: "Size in ml", suffix: "ml", initial: product.inventorySizeMl?.toString() ?? "100", width: "w-10" },
            { key: "price", label: "Price", prefix: "₹", initial: "", width: "w-20" },
          ]}
          onSave={(vals) => addSize(vals.size ?? "", vals.price ?? "")}
          onCancel={() => setEditing(null)}
        />
      ) : (
        product.variants.length === 0 && (
          <button
            type="button"
            onClick={() => setEditing("new")}
            className="inline-flex h-7 items-center gap-1.5 rounded-md border border-dashed border-warn/50 px-2.5 text-xs font-semibold text-warn hover:border-warn"
          >
            <Plus size={12} /> Add size &amp; price
          </button>
        )
      )}
    </div>
  );
}
