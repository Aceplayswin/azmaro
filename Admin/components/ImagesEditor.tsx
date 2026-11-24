"use client";

import { ArrowDown, ArrowUp, Link2, Trash2, Upload } from "lucide-react";
import { useRef, useState } from "react";
import { api, errorMessage, imageSrc } from "@/lib/api";
import type { ImageStatus, Product, ProductImage } from "@/lib/types";
import { NoticeBar, Section, type Notice } from "./ui";

const STATUS: Record<ImageStatus, { label: string; badge: string }> = {
  APPROVED: { label: "Shown on store", badge: "badge-ok" },
  PENDING_REVIEW: { label: "Awaiting review", badge: "badge-warn" },
  REJECTED: { label: "Rejected", badge: "badge-bad" },
};

const MAX_BYTES = 8 * 1024 * 1024;

export function ImagesEditor({ product, onChanged }: { product: Product; onChanged: () => Promise<void> }) {
  const fileInput = useRef<HTMLInputElement>(null);
  const [busy, setBusy] = useState(false);
  const [notice, setNotice] = useState<Notice>(null);
  const [url, setUrl] = useState("");
  const images = [...product.images].sort((a, b) => a.sortOrder - b.sortOrder);

  async function run(action: () => Promise<unknown>, done: string) {
    setBusy(true);
    try {
      await action();
      setNotice({ kind: "ok", text: done });
      await onChanged();
    } catch (e) {
      setNotice({ kind: "error", text: errorMessage(e) });
    } finally {
      setBusy(false);
    }
  }

  async function upload(files: FileList | null) {
    const list = Array.from(files ?? []);
    if (!list.length) return;
    const tooBig = list.find((f) => f.size > MAX_BYTES);
    if (tooBig) return setNotice({ kind: "error", text: `${tooBig.name} is larger than 8 MB.` });
    await run(async () => {
      for (const file of list) await api(`/admin/products/${product.id}/images/upload`, { method: "POST", file, query: { status: "APPROVED" } });
    }, list.length === 1 ? "Photo uploaded." : `${list.length} photos uploaded.`);
    if (fileInput.current) fileInput.current.value = "";
  }

  async function addByUrl(e: React.FormEvent) {
    e.preventDefault();
    const value = url.trim();
    if (!value) return;
    await run(
      () =>
        api(`/admin/products/${product.id}/images`, {
          method: "POST",
          body: { url: value, alt: `${product.brand.name} ${product.name} bottle`, status: "APPROVED", sortOrder: images.length },
        }),
      "Photo added.",
    );
    setUrl("");
  }

  const patch = (img: ProductImage, body: Partial<ProductImage>, done: string) =>
    run(() => api(`/admin/images/${img.id}`, { method: "PATCH", body }), done);

  /** Swap positions with the neighbour (sort orders are renumbered 0…n). */
  function move(index: number, dir: -1 | 1) {
    const order = [...images];
    const target = index + dir;
    if (target < 0 || target >= order.length) return;
    [order[index], order[target]] = [order[target]!, order[index]!];
    return run(
      () => Promise.all(order.map((img, i) => (img.sortOrder === i ? null : api(`/admin/images/${img.id}`, { method: "PATCH", body: { sortOrder: i } })))),
      "Order updated.",
    );
  }

  return (
    <Section
      title="Photos"
      description="The first photo shown on the store is the main product image. JPEG, PNG, WebP or AVIF, up to 8 MB."
      actions={
        <>
          <input ref={fileInput} type="file" accept="image/jpeg,image/png,image/webp,image/avif" multiple className="sr-only" onChange={(e) => upload(e.target.files)} />
          <button type="button" className="btn btn-primary btn-sm" disabled={busy} onClick={() => fileInput.current?.click()}>
            <Upload size={14} /> Upload photos
          </button>
        </>
      }
    >
      {images.length === 0 ? (
        <button
          type="button"
          className="grid w-full place-items-center rounded-md border border-dashed border-line py-12 text-muted hover:text-ink"
          onClick={() => fileInput.current?.click()}
          onDragOver={(e) => e.preventDefault()}
          onDrop={(e) => {
            e.preventDefault();
            void upload(e.dataTransfer.files);
          }}
        >
          <Upload size={20} className="mb-2" />
          No photos yet – click or drop images here
        </button>
      ) : (
        <ul className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4">
          {images.map((img, i) => (
            <li key={img.id} className="overflow-hidden rounded-md border border-line-soft bg-bg-2">
              <div className="relative aspect-square bg-bg">
                {/* eslint-disable-next-line @next/next/no-img-element */}
                <img src={imageSrc(img.url)} alt={img.alt} className="h-full w-full object-contain" loading="lazy" />
                <span className={`badge absolute top-2 left-2 bg-bg/80 ${STATUS[img.status].badge}`}>{STATUS[img.status].label}</span>
              </div>
              <div className="space-y-2 p-3">
                <input
                  className="input"
                  aria-label="Alt text"
                  defaultValue={img.alt}
                  onBlur={(e) => e.target.value.trim() && e.target.value !== img.alt && patch(img, { alt: e.target.value.trim() }, "Alt text saved.")}
                />
                <div className="flex items-center gap-2">
                  <select
                    className="input flex-1"
                    aria-label="Photo status"
                    value={img.status}
                    disabled={busy}
                    onChange={(e) => patch(img, { status: e.target.value as ImageStatus }, "Status updated.")}
                  >
                    {(Object.keys(STATUS) as ImageStatus[]).map((s) => (
                      <option key={s} value={s}>{STATUS[s].label}</option>
                    ))}
                  </select>
                  <button type="button" className="btn btn-icon" aria-label="Move earlier" disabled={busy || i === 0} onClick={() => move(i, -1)}>
                    <ArrowUp size={14} />
                  </button>
                  <button type="button" className="btn btn-icon" aria-label="Move later" disabled={busy || i === images.length - 1} onClick={() => move(i, 1)}>
                    <ArrowDown size={14} />
                  </button>
                  <button
                    type="button"
                    className="btn btn-danger btn-icon"
                    aria-label="Delete photo"
                    disabled={busy}
                    onClick={() => confirm("Remove this photo from the product?") && run(() => api(`/admin/images/${img.id}`, { method: "DELETE" }), "Photo removed.")}
                  >
                    <Trash2 size={14} />
                  </button>
                </div>
              </div>
            </li>
          ))}
        </ul>
      )}

      <form onSubmit={addByUrl} className="mt-5 flex flex-col gap-2 sm:flex-row">
        <div className="relative flex-1">
          <Link2 size={15} className="pointer-events-none absolute top-1/2 left-3 -translate-y-1/2 text-muted" />
          <input
            className="input pl-9"
            placeholder="…or add by path / URL: /images/products/name.webp or https://…"
            aria-label="Image path or URL"
            value={url}
            onChange={(e) => setUrl(e.target.value)}
          />
        </div>
        <button type="submit" className="btn" disabled={busy || !url.trim()}>Add photo</button>
      </form>
      <div className="mt-3 min-h-5">
        <NoticeBar notice={notice} />
      </div>
    </Section>
  );
}
