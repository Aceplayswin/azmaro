"use client";

import { CrudPage } from "@/components/CrudPage";

interface Faq {
  id: string;
  question: string;
  answer: string;
  category: string;
  sortOrder: number;
  isPublished: boolean;
}

export default function FaqsPage() {
  return (
    <CrudPage<Faq>
      title="FAQs"
      subtitle="Questions and answers shown on the store's help pages."
      path="/admin/faqs"
      noun="FAQ"
      fields={[
        { key: "question", label: "Question", required: true, wide: true },
        { key: "answer", label: "Answer", type: "textarea", required: true, wide: true },
        { key: "category", label: "Category", required: true, placeholder: "Orders, Delivery, Products…" },
        { key: "sortOrder", label: "Sort order", type: "number", nullable: false, defaultValue: "0" },
        { key: "isPublished", label: "Published", type: "checkbox", defaultValue: true },
      ]}
      columns={[
        { header: "Question", cell: (f) => <span className="font-medium">{f.question}</span> },
        { header: "Category", cell: (f) => f.category },
        { header: "Order", cell: (f) => f.sortOrder, className: "text-right tabular-nums" },
        { header: "Status", cell: (f) => <span className={`badge ${f.isPublished ? "badge-ok" : ""}`}>{f.isPublished ? "Published" : "Hidden"}</span> },
      ]}
    />
  );
}
