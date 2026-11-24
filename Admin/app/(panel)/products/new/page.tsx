"use client";

import { BackLink } from "@/components/Pager";
import { useRouter } from "next/navigation";
import { useState } from "react";
import { ProductForm, toFormValues, toPayload } from "@/components/ProductForm";
import { Field, Section } from "@/components/ui";
import { api, ApiError, errorMessage } from "@/lib/api";
import type { Product } from "@/lib/types";
import { useCatalogueOptions } from "@/lib/useCatalogueOptions";

export default function NewProductPage() {
  const router = useRouter();
  const { brands, categories } = useCatalogueOptions();
  const [values, setValues] = useState(() => ({ ...toFormValues(), isPublished: true }));
  const [size, setSize] = useState({ sizeMl: "100", price: "", mrp: "" });
  const [errors, setErrors] = useState<Record<string, string>>({});
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);

  async function submit(e: React.FormEvent) {
    e.preventDefault();
    setBusy(true);
    setErrors({});
    setError(null);
    try {
      const variants = size.sizeMl.trim()
        ? [{ sizeMl: Number(size.sizeMl), price: size.price.trim() || null, mrp: size.mrp.trim() || null }]
        : [];
      const { data } = await api<Product>("/admin/products", { method: "POST", body: { ...toPayload(values), variants } });
      router.replace(`/products/${data.id}?created=1`);
    } catch (err) {
      if (err instanceof ApiError) setErrors(err.fieldErrors);
      setError(err instanceof ApiError && err.code === "DUPLICATE" ? "A product with this slug already exists – choose another URL slug." : errorMessage(err));
      window.scrollTo({ top: 0, behavior: "smooth" });
    } finally {
      setBusy(false);
    }
  }

  return (
    <form onSubmit={submit} className="page-narrow" noValidate>
      <BackLink href="/products">Products</BackLink>
      <header className="mb-4 flex flex-wrap items-center justify-between gap-3">
        <h1 className="text-xl font-semibold">New product</h1>
        <button type="submit" className="btn btn-primary" disabled={busy}>{busy ? "Creating…" : "Create product"}</button>
      </header>
      {error && <p role="alert" className="mb-4 text-danger">{error}</p>}

      <div className="space-y-4">
        <ProductForm values={values} onChange={setValues} errors={errors} brands={brands} categories={categories} autoSlug />
        <Section title="First size & price" description="Optional – you can add more sizes, stock and photos after creating the product.">
          <div className="grid gap-4 sm:grid-cols-3">
            <Field label="Size (ml)">
              <input className="input" inputMode="numeric" value={size.sizeMl} onChange={(e) => setSize({ ...size, sizeMl: e.target.value })} />
            </Field>
            <Field label="Selling price (₹)" hint="Leave blank if not confirmed yet">
              <input className="input" inputMode="decimal" value={size.price} onChange={(e) => setSize({ ...size, price: e.target.value })} />
            </Field>
            <Field label="MRP (₹)" hint="Optional">
              <input className="input" inputMode="decimal" value={size.mrp} onChange={(e) => setSize({ ...size, mrp: e.target.value })} />
            </Field>
          </div>
          {Object.entries(errors)
            .filter(([k]) => k.startsWith("variants"))
            .map(([k, m]) => (
              <p key={k} className="mt-2 text-xs text-danger">{m}</p>
            ))}
        </Section>
        <div className="flex justify-end">
          <button type="submit" className="btn btn-primary" disabled={busy}>{busy ? "Creating…" : "Create product"}</button>
        </div>
      </div>
    </form>
  );
}
