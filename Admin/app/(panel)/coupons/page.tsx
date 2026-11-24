"use client";

import { CrudPage } from "@/components/CrudPage";
import { formatInr } from "@/lib/api";
import { formatDate } from "@/lib/format";

interface Coupon {
  id: string;
  code: string;
  description: string | null;
  type: "PERCENT" | "FLAT";
  value: number;
  minSubtotal: number | null;
  maxDiscount: number | null;
  startsAt: string | null;
  endsAt: string | null;
  usageLimit: number | null;
  usedCount: number;
  perUserLimit: number | null;
  isActive: boolean;
}

function couponState(c: Coupon) {
  const now = Date.now();
  if (!c.isActive) return { label: "Inactive", cls: "" };
  if (c.startsAt && new Date(c.startsAt).getTime() > now) return { label: "Scheduled", cls: "badge-info" };
  if (c.endsAt && new Date(c.endsAt).getTime() < now) return { label: "Expired", cls: "badge-bad" };
  if (c.usageLimit !== null && c.usedCount >= c.usageLimit) return { label: "Used up", cls: "badge-bad" };
  return { label: "Active", cls: "badge-ok" };
}

export default function CouponsPage() {
  return (
    <CrudPage<Coupon>
      title="Coupons"
      subtitle="Discount codes customers enter in the bag. A used coupon can't be deleted – make it inactive instead."
      path="/admin/coupons"
      noun="coupon"
      deleteLabel={(c) => `Delete coupon ${c.code}?`}
      fields={[
        { key: "code", label: "Code", required: true, placeholder: "WELCOME10", hint: "Letters, numbers, _ or -" },
        {
          key: "type",
          label: "Discount type",
          type: "select",
          options: [
            { value: "PERCENT", label: "Percentage (%)" },
            { value: "FLAT", label: "Flat amount (₹)" },
          ],
        },
        { key: "value", label: "Value", type: "money", required: true, hint: "e.g. 10 = 10% or ₹10" },
        { key: "minSubtotal", label: "Minimum order (₹)", type: "money" },
        { key: "maxDiscount", label: "Maximum discount (₹)", type: "money", hint: "Caps percentage discounts" },
        { key: "usageLimit", label: "Total uses allowed", type: "number", hint: "Blank = unlimited" },
        { key: "perUserLimit", label: "Uses per customer", type: "number", hint: "Blank = unlimited" },
        { key: "startsAt", label: "Starts on", type: "date" },
        { key: "endsAt", label: "Ends on", type: "date" },
        { key: "description", label: "Description (internal)", wide: true },
        { key: "isActive", label: "Active", type: "checkbox", defaultValue: true },
      ]}
      columns={[
        { header: "Code", cell: (c) => <span className="font-mono font-medium">{c.code}</span> },
        { header: "Discount", cell: (c) => (c.type === "PERCENT" ? `${c.value}%${c.maxDiscount ? ` (max ${formatInr(c.maxDiscount)})` : ""}` : formatInr(c.value)) },
        { header: "Min. order", cell: (c) => (c.minSubtotal ? formatInr(c.minSubtotal) : "—") },
        { header: "Used", cell: (c) => `${c.usedCount}${c.usageLimit !== null ? ` / ${c.usageLimit}` : ""}`, className: "tabular-nums" },
        { header: "Valid", cell: (c) => (c.startsAt || c.endsAt ? `${formatDate(c.startsAt)} – ${formatDate(c.endsAt)}` : "Always") },
        {
          header: "Status",
          cell: (c) => {
            const s = couponState(c);
            return <span className={`badge ${s.cls}`}>{s.label}</span>;
          },
        },
      ]}
    />
  );
}
