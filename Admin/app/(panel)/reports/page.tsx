"use client";

import { useState } from "react";
import { PageTitle, StatCard } from "@/components/Pager";
import { formatInr } from "@/lib/api";
import { ORDER_STATUS, PAYMENT_METHOD } from "@/lib/format";
import { useApiResource } from "@/lib/useApiList";

interface SalesReport {
  days: number;
  totals: { orders: number; cancelled: number; orderedValue: number; paidRevenue: number; discounts: number; averageOrderValue: number; customers: number };
  series: Array<{ day: string; orders: number; ordered: number; paid: number }>;
  topProducts: Array<{ slug: string; name: string; brand: string; units: number; revenue: number }>;
  paymentMethods: Array<{ method: string; orders: number; amount: number }>;
  statuses: Record<string, number>;
}

const shortDay = (d: string) => new Date(`${d}T00:00:00`).toLocaleDateString("en-IN", { day: "numeric", month: "short" });

export default function ReportsPage() {
  const [days, setDays] = useState(30);
  const [includeTest, setIncludeTest] = useState(false);
  const { data, error } = useApiResource<SalesReport>(`/admin/reports/sales?days=${days}&includeTest=${includeTest}`);
  const max = Math.max(1, ...(data?.series.map((s) => s.ordered) ?? [1]));

  return (
    <div className="page">
      <PageTitle title="Sales report" subtitle="Order value excludes cancelled orders. Revenue counts only paid orders.">
        <select className="input w-auto" value={days} onChange={(e) => setDays(Number(e.target.value))} aria-label="Period">
          {[7, 30, 90, 365].map((d) => (
            <option key={d} value={d}>
              Last {d} days
            </option>
          ))}
        </select>
        <label className="flex items-center gap-2 text-ink-2">
          <input type="checkbox" checked={includeTest} onChange={(e) => setIncludeTest(e.target.checked)} /> Include test orders
        </label>
      </PageTitle>
      {error && <p className="mb-4 text-danger">{error}</p>}
      {!data ? (
        <p className="text-muted">Loading…</p>
      ) : (
        <div className="space-y-4">
          <div className="grid gap-3 sm:grid-cols-3 lg:grid-cols-6">
            <StatCard label="Orders" value={data.totals.orders} />
            <StatCard label="Order value" value={formatInr(data.totals.orderedValue)} />
            <StatCard label="Paid revenue" value={formatInr(data.totals.paidRevenue)} />
            <StatCard label="Avg. order value" value={formatInr(data.totals.averageOrderValue)} />
            <StatCard label="Customers" value={data.totals.customers} />
            <StatCard label="Cancelled" value={data.totals.cancelled} />
          </div>

          <section className="card p-4">
            <h2 className="mb-3 text-sm font-semibold">Order value per day</h2>
            <div className="flex h-44 items-end gap-px border-b border-line" role="img" aria-label="Order value per day">
              {data.series.map((s) => (
                <div key={s.day} className="group relative flex h-full flex-1 items-end" title={`${shortDay(s.day)}: ${s.orders} orders · ${formatInr(s.ordered)}`}>
                  <div className="w-full rounded-t-sm bg-primary/80 group-hover:bg-primary" style={{ height: `${(s.ordered / max) * 100}%`, minHeight: s.ordered ? 2 : 0 }} />
                </div>
              ))}
            </div>
            <div className="mt-1 flex justify-between text-xs text-muted">
              <span>{shortDay(data.series[0]!.day)}</span>
              <span>{shortDay(data.series[data.series.length - 1]!.day)}</span>
            </div>
          </section>

          <div className="grid gap-4 lg:grid-cols-[1.4fr_1fr]">
            <section className="card">
              <h2 className="border-b border-line-soft p-3 text-sm font-semibold">Best sellers</h2>
              <table className="table">
                <thead>
                  <tr>
                    <th>Product</th>
                    <th className="text-right">Units</th>
                    <th className="text-right">Revenue</th>
                  </tr>
                </thead>
                <tbody>
                  {data.topProducts.length === 0 && (
                    <tr>
                      <td colSpan={3} className="py-6 text-center text-muted">
                        No sales in this period.
                      </td>
                    </tr>
                  )}
                  {data.topProducts.map((p) => (
                    <tr key={p.slug}>
                      <td>
                        {p.name} <span className="text-xs text-muted">· {p.brand}</span>
                      </td>
                      <td className="text-right tabular-nums">{p.units}</td>
                      <td className="text-right tabular-nums">{formatInr(p.revenue)}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </section>

            <div className="space-y-4">
              <section className="card">
                <h2 className="border-b border-line-soft p-3 text-sm font-semibold">Payment methods</h2>
                <table className="table">
                  <tbody>
                    {data.paymentMethods.length === 0 && (
                      <tr>
                        <td className="py-4 text-center text-muted">No orders.</td>
                      </tr>
                    )}
                    {data.paymentMethods.map((m) => (
                      <tr key={m.method}>
                        <td>{PAYMENT_METHOD[m.method] ?? m.method}</td>
                        <td className="text-right tabular-nums">{m.orders} orders</td>
                        <td className="text-right tabular-nums">{formatInr(m.amount)}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </section>
              <section className="card">
                <h2 className="border-b border-line-soft p-3 text-sm font-semibold">Orders by status</h2>
                <table className="table">
                  <tbody>
                    {Object.entries(data.statuses).map(([status, n]) => (
                      <tr key={status}>
                        <td>{ORDER_STATUS[status]?.label ?? status}</td>
                        <td className="text-right tabular-nums">{n}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </section>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
