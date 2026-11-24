"use client";

import { CrudPage } from "@/components/CrudPage";

interface Category {
  id: string;
  slug: string;
  name: string;
  shortName: string | null;
  description: string | null;
  type: "SCENT_FAMILY" | "COLLECTION";
  sortOrder: number;
  imageUrl: string | null;
  isPublished: boolean;
  productCount: number;
}

export default function CategoriesPage() {
  return (
    <CrudPage<Category>
      title="Categories"
      subtitle="Scent families (used as shop filters) and collections. Assign products to them on each product's page."
      path="/admin/categories"
      noun="category"
      deleteLabel={(c) => `Delete "${c.name}"? ${c.productCount} product(s) will be unlinked from it.`}
      fields={[
        { key: "name", label: "Name", required: true },
        { key: "slug", label: "URL slug", type: "slug", required: true, slugFrom: "name" },
        {
          key: "type",
          label: "Type",
          type: "select",
          options: [
            { value: "SCENT_FAMILY", label: "Scent family" },
            { value: "COLLECTION", label: "Collection" },
          ],
        },
        { key: "shortName", label: "Short name", hint: "Shown on filter chips" },
        { key: "sortOrder", label: "Sort order", type: "number", nullable: false, hint: "Lower shows first" },
        { key: "imageUrl", label: "Image", hint: "/images/… path or https URL" },
        { key: "description", label: "Description", type: "textarea", wide: true },
        { key: "isPublished", label: "Published", type: "checkbox", defaultValue: true },
      ]}
      columns={[
        { header: "Name", cell: (c) => <span className="font-medium">{c.name}</span> },
        { header: "Slug", cell: (c) => <span className="text-ink-2">{c.slug}</span> },
        { header: "Type", cell: (c) => (c.type === "SCENT_FAMILY" ? "Scent family" : "Collection") },
        { header: "Products", cell: (c) => c.productCount, className: "text-right tabular-nums" },
        { header: "Order", cell: (c) => c.sortOrder, className: "text-right tabular-nums" },
        { header: "Status", cell: (c) => <span className={`badge ${c.isPublished ? "badge-ok" : ""}`}>{c.isPublished ? "Published" : "Hidden"}</span> },
      ]}
    />
  );
}
