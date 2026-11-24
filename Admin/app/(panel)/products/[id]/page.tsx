"use client";

import { BackLink } from "@/components/Pager";
import { ExternalLink } from "lucide-react";
import { useParams, useRouter } from "next/navigation";
import { useCallback, useEffect, useState } from "react";
import { ImagesEditor } from "@/components/ImagesEditor";
import { ProductForm, toFormValues, toPayload, type ProductFormValues } from "@/components/ProductForm";
import { NoticeBar, Section, type Notice } from "@/components/ui";
import { VariantsEditor } from "@/components/VariantsEditor";
import { api, ApiError, errorMessage } from "@/lib/api";
import type { Product } from "@/lib/types";
import { useCatalogueOptions } from "@/lib/useCatalogueOptions";

export default function EditProductPage() {
  const { id } = useParams<{ id: string }>();
  const router = useRouter();
  const { brands, categories } = useCatalogueOptions();
  const [product, setProduct] = useState<Product | null>(null);
  const [values, setValues] = useState<ProductFormValues | null>(null);
  const [errors, setErrors] = useState<Record<string, string>>({});
  const [notice, setNotice] = useState<Notice>(null);
  const [loadError, setLoadError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);

  const load = useCallback(async () => {
    try {
      const { data } = await api<Product>(`/admin/products/${id}`);
      setProduct(data);
      return data;
    } catch (e) {
      setLoadError(errorMessage(e));
      return null;
    }
  }, [id]);

  useEffect(() => {
    api<Product>(`/admin/products/${id}`)
      .then(({ data }) => {
        setProduct(data);
        setValues(toFormValues(data));
        if (new URLSearchParams(window.location.search).get("created")) setNotice({ kind: "ok", text: "Product created. Add sizes, prices and photos below." });
      })
      .catch((e) => setLoadError(errorMessage(e)));
  }, [id]);

  const reload = async () => {
    await load();
  };

  async function saveDetails(e: React.FormEvent) {
    e.preventDefault();
    if (!values) return;
    setBusy(true);
    setErrors({});
    try {
      const { data } = await api<Product>(`/admin/products/${id}`, { method: "PATCH", body: toPayload(values) });
      setProduct(data);
      setValues(toFormValues(data));
      setNotice({ kind: "ok", text: "Product details saved." });
    } catch (err) {
      if (err instanceof ApiError) setErrors(err.fieldErrors);
      setNotice({ kind: "error", text: err instanceof ApiError && err.code === "DUPLICATE" ? "Another product already uses this URL slug." : errorMessage(err) });
    } finally {
      setBusy(false);
    }
  }

  async function deleteProduct() {
    if (!product || !confirm(`Delete "${product.name}" permanently? This can't be undone.`)) return;
    try {
      await api(`/admin/products/${product.id}`, { method: "DELETE" });
      router.replace("/products");
    } catch (e) {
      setNotice({ kind: "error", text: errorMessage(e) });
    }
  }

  if (loadError) return <p className="text-danger">{loadError}</p>;
  if (!product || !values) return <p className="text-muted">Loading…</p>;

  const storefront = process.env.NEXT_PUBLIC_STOREFRONT_URL ?? "http://localhost:3000";
  const dirty = JSON.stringify(values) !== JSON.stringify(toFormValues(product));
  const purchasable = product.variants.some((v) => v.isPurchasable);

  return (
    <div className="page-narrow">
      <BackLink href="/products">Products</BackLink>

      <header className="sticky top-0 z-10 -mx-4 mb-4 flex flex-wrap items-center justify-between gap-3 border-b border-line-soft bg-bg/95 px-4 py-3 backdrop-blur md:-mx-6 md:px-6">
        <div className="min-w-0">
          <h1 className="truncate text-xl font-semibold">{product.name}</h1>
          <div className="mt-1 flex flex-wrap items-center gap-2">
            <span className={`badge ${product.isPublished ? "badge-ok" : ""}`}>{product.isPublished ? "Published" : "Hidden"}</span>
            <span className={`badge ${purchasable ? "badge-ok" : "badge-warn"}`}>{purchasable ? "Can be ordered" : "Not orderable – add a price"}</span>
            {product.isPublished && (
              <a href={`${storefront}/products/${product.slug}`} target="_blank" rel="noreferrer" className="inline-flex items-center gap-1 text-xs text-muted hover:text-ink">
                View on store <ExternalLink size={12} />
              </a>
            )}
          </div>
        </div>
        <div className="flex items-center gap-3">
          <NoticeBar notice={notice} />
          <button type="submit" form="product-details" className="btn btn-primary" disabled={busy || !dirty}>{busy ? "Saving…" : dirty ? "Save details" : "Saved"}</button>
        </div>
      </header>

      <div className="space-y-4">
        <VariantsEditor key={JSON.stringify(product.variants)} product={product} onChanged={reload} />
        <ImagesEditor key={JSON.stringify(product.images)} product={product} onChanged={reload} />
        <form id="product-details" onSubmit={saveDetails} noValidate>
          <ProductForm values={values} onChange={setValues} errors={errors} brands={brands} categories={categories} />
          <div className="mt-4 flex justify-end">
            <button type="submit" className="btn btn-primary" disabled={busy || !dirty}>{busy ? "Saving…" : dirty ? "Save details" : "Saved"}</button>
          </div>
        </form>
      </div>

      <div className="mt-4">
        <Section title="Delete product" description="Products that have been ordered can't be deleted – hide them instead (untick “Published on the store”).">
          <button type="button" className="btn btn-danger" onClick={deleteProduct}>Delete this product</button>
        </Section>
      </div>
    </div>
  );
}
