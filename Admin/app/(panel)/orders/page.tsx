"use client";

import { Download, RefreshCw, Search } from "lucide-react";
import Link from "next/link";
import { useState } from "react";
import { PageTitle, Pager, TableMessage } from "@/components/Pager";
import { NoticeBar, type Notice } from "@/components/ui";
import { api, errorMessage, formatInr } from "@/lib/api";
import { formatDateTime, ORDER_STATUS, PAYMENT_METHOD, PAYMENT_STATUS, StatusBadge } from "@/lib/format";
import type { AdminOrder } from "@/lib/orders";
import { useApiList } from "@/lib/useApiList";
import { useDebouncedValue } from "@/lib/useDebouncedValue";

const csvCell = (v: unknown) => `"${String(v ?? "").replace(/"/g, '""')}"`;

export default function OrdersPage() {
  const [search, setSearch] = useState("");
  const [filters, setFilters] = useState({ q: "", status: "", isTest: "", from: "", to: "", page: 1, pageSize: 25 });
  const [notice, setNotice] = useState<Notice>(null);
  const [busy, setBusy] = useState(false);
  const { rows, pagination, error, reload } = useApiList<AdminOrder>("/admin/orders", {
    ...filters,
    to: filters.to ? `${filters.to}T23:59:59` : "",
  });

  // Debounced search term → filters (and back to page 1), applied during render so only one request fires.
  const debouncedSearch = useDebouncedValue(search.trim(), 300);
  if (filters.q !== debouncedSearch) setFilters((f) => ({ ...f, q: debouncedSearch, page: 1 }));

  const set = (k: keyof typeof filters) => (e: React.ChangeEvent<HTMLSelectElement | HTMLInputElement>) => setFilters((f) => ({ ...f, [k]: e.target.value, page: 1 }));

  async function releaseStale() {
    if (!confirm("Cancel unpaid online orders older than 60 minutes? Their reserved stock is released.")) return;
    setBusy(true);
    try {
      const { data } = await api<{ cancelled: string[] }>("/admin/orders/maintenance/release-stale", { method: "POST", body: { olderThanMinutes: 60 } });
      setNotice({ kind: "ok", text: data.cancelled.length ? `Cancelled ${data.cancelled.join(", ")}.` : "No unpaid orders older than 60 minutes." });
      reload();
    } catch (e) {
      setNotice({ kind: "error", text: errorMessage(e) });
    } finally {
      setBusy(false);
    }
  }

  async function exportCsv() {
    setBusy(true);
    try {
      const all: AdminOrder[] = [];
      for (let p = 1; ; p++) {
        const r = await api<AdminOrder[]>("/admin/orders", { query: { ...filters, to: filters.to ? `${filters.to}T23:59:59` : "", page: p, pageSize: 100 } });
        all.push(...r.data);
        if (p >= (r.meta?.pagination?.totalPages ?? 1)) break;
      }
      const header = ["Order", "Date", "Customer", "Email", "Phone", "Items", "Subtotal", "Discount", "Delivery", "Total", "Payment method", "Payment status", "Order status", "City", "State", "PIN", "Test"];
      const lines = all.map((o) =>
        [
          o.orderNumber,
          o.createdAt,
          o.shippingAddress.fullName,
          o.email,
          o.phone,
          o.items.reduce((s, i) => s + i.quantity, 0),
          o.totals.subtotal,
          o.totals.discount,
          o.totals.delivery ?? "",
          o.totals.total,
          PAYMENT_METHOD[o.paymentMethod] ?? o.paymentMethod,
          PAYMENT_STATUS[o.paymentStatus]?.label ?? o.paymentStatus,
          ORDER_STATUS[o.status]?.label ?? o.status,
          o.shippingAddress.city,
          o.shippingAddress.state,
          o.shippingAddress.pin,
          o.isTest ? "Yes" : "No",
        ]
          .map(csvCell)
          .join(","),
      );
      const blob = new Blob([`﻿${[header.map(csvCell).join(","), ...lines].join("\r\n")}`], { type: "text/csv;charset=utf-8" });
      const a = document.createElement("a");
      a.href = URL.createObjectURL(blob);
      a.download = `azmaro-orders-${new Date().toISOString().slice(0, 10)}.csv`;
      a.click();
      URL.revokeObjectURL(a.href);
    } catch (e) {
      setNotice({ kind: "error", text: errorMessage(e) });
    } finally {
      setBusy(false);
    }
  }

  return (
    <div className="page">
      <PageTitle title="Orders" subtitle="Every order placed on the store. Click an order to manage it.">
        <button className="btn" onClick={releaseStale} disabled={busy} title="Cancel unpaid online orders and release their stock">
          Release unpaid orders
        </button>
        <button className="btn" onClick={exportCsv} disabled={busy}>
          <Download size={14} /> Export CSV
        </button>
      </PageTitle>

      <div className="card">
        <div className="flex flex-wrap items-center gap-2 border-b border-line-soft p-3">
          <div className="relative min-w-56 flex-1">
            <Search size={14} className="pointer-events-none absolute top-1/2 left-2.5 -translate-y-1/2 text-muted" />
            <input className="input pl-8" placeholder="Order number or customer email" value={search} onChange={(e) => setSearch(e.target.value)} aria-label="Search orders" />
          </div>
          <select className="input w-auto" value={filters.status} onChange={set("status")} aria-label="Order status">
            <option value="">All statuses</option>
            {Object.entries(ORDER_STATUS).map(([k, v]) => (
              <option key={k} value={k}>
                {v.label}
              </option>
            ))}
          </select>
          <select className="input w-auto" value={filters.isTest} onChange={set("isTest")} aria-label="Order type">
            <option value="">Real &amp; test</option>
            <option value="false">Real orders</option>
            <option value="true">Test orders</option>
          </select>
          <label className="flex items-center gap-1.5 text-ink-2">
            From <input type="date" className="input w-auto" value={filters.from} onChange={set("from")} />
          </label>
          <label className="flex items-center gap-1.5 text-ink-2">
            To <input type="date" className="input w-auto" value={filters.to} onChange={set("to")} />
          </label>
          <button className="btn btn-icon h-[2.125rem] w-[2.125rem]" onClick={reload} aria-label="Refresh" title="Refresh">
            <RefreshCw size={14} />
          </button>
        </div>
        {(notice || error) && (
          <div className="border-b border-line-soft px-3 py-2">
            <NoticeBar notice={error ? { kind: "error", text: error } : notice} />
          </div>
        )}
        <div className="overflow-x-auto">
          <table className="table min-w-[1000px]">
            <thead>
              <tr>
                <th>Order</th>
                <th>Date</th>
                <th>Customer</th>
                <th className="text-right">Items</th>
                <th className="text-right">Total</th>
                <th>Payment</th>
                <th>Status</th>
                <th>Ship to</th>
              </tr>
            </thead>
            <tbody>
              {rows === null && <TableMessage cols={8}>Loading…</TableMessage>}
              {rows?.length === 0 && <TableMessage cols={8}>No orders found.</TableMessage>}
              {rows?.map((o) => (
                <tr key={o.id}>
                  <td>
                    <Link href={`/orders/${o.id}`} className="font-medium text-primary hover:underline">
                      {o.orderNumber}
                    </Link>
                    {o.isTest && <span className="badge ml-1.5">Test</span>}
                  </td>
                  <td className="whitespace-nowrap text-ink-2">{formatDateTime(o.createdAt)}</td>
                  <td>
                    <div>{o.customer?.name ?? o.shippingAddress.fullName}</div>
                    <div className="text-xs text-muted">{o.customer ? o.email : `${o.email} · guest`}</div>
                  </td>
                  <td className="text-right tabular-nums">{o.items.reduce((s, i) => s + i.quantity, 0)}</td>
                  <td className="text-right font-medium tabular-nums">{formatInr(o.totals.total)}</td>
                  <td>
                    <div className="text-xs text-ink-2">{PAYMENT_METHOD[o.paymentMethod] ?? o.paymentMethod}</div>
                    <StatusBadge map={PAYMENT_STATUS} value={o.paymentStatus} />
                  </td>
                  <td>
                    <StatusBadge map={ORDER_STATUS} value={o.status} />
                  </td>
                  <td className="text-ink-2">
                    {o.shippingAddress.city}, {o.shippingAddress.pin}
                  </td>
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
