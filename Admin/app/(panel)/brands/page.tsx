"use client";

import { CrudPage } from "@/components/CrudPage";
import type { Brand } from "@/lib/types";

export default function BrandsPage() {
  return (
    <CrudPage<Brand>
      title="Brands"
      subtitle="Perfume houses. A brand can be deleted only when it has no products."
      path="/admin/brands"
      noun="brand"
      deleteLabel={(b) => `Delete the brand "${b.name}"?`}
      fields={[
        { key: "name", label: "Name", required: true },
        { key: "slug", label: "URL slug", type: "slug", required: true, slugFrom: "name" },
        { key: "imageUrl", label: "Image", hint: "/images/… path or https URL" },
        { key: "featuredRank", label: "Featured position", type: "number", hint: "Lower shows first (when featured)" },
        { key: "description", label: "Description", type: "textarea", wide: true, hint: "Approved brand copy only" },
        { key: "isPublished", label: "Published", type: "checkbox", defaultValue: true },
        { key: "isFeatured", label: "Featured on home page", type: "checkbox" },
      ]}
      columns={[
        { header: "Name", cell: (b) => <span className="font-medium">{b.name}</span> },
        { header: "Slug", cell: (b) => <span className="text-ink-2">{b.slug}</span> },
        { header: "Products", cell: (b) => b.productCount, className: "text-right tabular-nums" },
        {
          header: "Status",
          cell: (b) => (
            <>
              <span className={`badge ${b.isPublished ? "badge-ok" : ""}`}>{b.isPublished ? "Published" : "Hidden"}</span>
              {b.isFeatured && <span className="badge badge-info ml-1">Featured{b.featuredRank !== null ? ` #${b.featuredRank}` : ""}</span>}
            </>
          ),
        },
      ]}
    />
  );
}
