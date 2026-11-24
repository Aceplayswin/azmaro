"use client";

import Link from "next/link";
import { PageTitle, StatCard, StatGrid, TableMessage } from "@/components/Pager";
import { Section } from "@/components/ui";
import { formatInr } from "@/lib/api";
import { formatDateTime, ORDER_STATUS, PAYMENT_STATUS, StatusBadge } from "@/lib/format";
import { useApiResource } from "@/lib/useApiList";

interface Dashboard {
  orders: { byStatus: Record<string, number>; last30Days: number; testOrders: number };
  revenue: { paidTotal: number; paidLast30Days: number };
  customers: { total: number; newLast30Days: number };
  catalogue: { products: number; withConfirmedPrice: number; awaitingPrice: number; withApprovedImage: number; imagesPendingReview: number };
  support: { newMessages: number; newsletterSubscribers: number };
  recentOrders: Array<{ id: string; orderNumber: string; status: string; paymentStatus: string; total: number; isTest: boolean; createdAt: string }>;
  lowStock: Array<{ variantId: string; product: string; slug: string; sizeMl: number; quantity: number }>;
}

interface CartSummary {
  activeCarts: number;
  value: number;
}

function Progress({ label, done, total, href, cta }: { label: string; done: number; total: number; href: string; cta: string }) {
  const pct = total ? Math.round((done / total) * 100) : 0;
  return (
    <div>
      <div className="mb-1 flex justify-between gap-3">
        <span>{label}</span>
        <span className="text-muted tabular-nums">
          {done} / {total}
        </span>
      </div>
      <div className="h-2 overflow-hidden rounded bg-elevated" role="progressbar" aria-valuenow={pct} aria-valuemin={0} aria-valuemax={100} aria-label={label}>
        <div className={`h-full ${done >= total ? "bg-success" : "bg-primary"}`} style={{ width: `${pct}%` }} />
      </div>
      {done < total && (
        <Link href={href} className="mt-1 inline-block text-xs text-primary hover:underline">
          {cta}
        </Link>
      )}
    </div>
  );
}

export default function DashboardPage() {
  const { data, error } = useApiResource<Dashboard>("/admin/dashboard");
  const carts = useApiResource<CartSummary>("/admin/carts/summary").data;

  if (error) return <p className="text-danger">{error}</p>;
  const c = data?.catalogue;
  const open = data ? ["PENDING_PAYMENT", "PLACED", "CONFIRMED", "PROCESSING"].reduce((s, k) => s + (data.orders.byStatus[k] ?? 0), 0) : 0;

  return (
    <div className="page">
      <PageTitle title="Dashboard" subtitle="Real orders only – test orders are excluded from these figures." />

      <StatGrid>
        <StatCard label="Revenue · last 30 days" value={data ? formatInr(data.revenue.paidLast30Days) : "–"} sub={data && `${formatInr(data.revenue.paidTotal)} all time (paid)`} href="/reports" />
        <StatCard label="Orders · last 30 days" value={data?.orders.last30Days ?? "–"} sub={data && `${open} open · ${data.orders.testOrders} test`} href="/orders" />
        <StatCard label="Customers" value={data?.customers.total ?? "–"} sub={data && `${data.customers.newLast30Days} new in 30 days`} href="/customers" />
        <StatCard label="Carts in progress" value={carts?.activeCarts ?? "–"} sub={carts && `${formatInr(carts.value)} in bags`} href="/carts" />
      </StatGrid>

      <div className="grid gap-4 lg:grid-cols-[1.4fr_1fr]">
        <Section title="Recent orders" actions={<Link href="/orders" className="text-xs text-primary hover:underline">All orders</Link>}>
          <table className="table">
            <thead>
              <tr>
                <th>Order</th>
                <th>Date</th>
                <th>Status</th>
                <th>Payment</th>
                <th className="text-right">Total</th>
              </tr>
            </thead>
            <tbody>
              {!data && <TableMessage cols={5}>Loading…</TableMessage>}
              {data?.recentOrders.length === 0 && <TableMessage cols={5}>No orders yet.</TableMessage>}
              {data?.recentOrders.map((o) => (
                <tr key={o.id}>
                  <td>
                    <Link href={`/orders/${o.id}`} className="font-medium text-primary hover:underline">
                      {o.orderNumber}
                    </Link>
                    {o.isTest && <span className="badge ml-1.5">Test</span>}
                  </td>
                  <td className="text-ink-2">{formatDateTime(o.createdAt)}</td>
                  <td>
                    <StatusBadge map={ORDER_STATUS} value={o.status} />
                  </td>
                  <td>
                    <StatusBadge map={PAYMENT_STATUS} value={o.paymentStatus} />
                  </td>
                  <td className="text-right tabular-nums">{formatInr(o.total)}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </Section>

        <div className="space-y-4">
          <Section title="Catalogue">
            {c ? (
              <div className="space-y-4">
                <Progress label="Products with a price" done={c.withConfirmedPrice} total={c.products} href="/products?tab=needs-price" cta={`Set prices for ${c.awaitingPrice} products`} />
                <Progress label="Products with a photo" done={c.withApprovedImage} total={c.products} href="/products?tab=no-photo" cta={`Add photos to ${c.products - c.withApprovedImage} products`} />
                {c.imagesPendingReview > 0 && <p className="text-xs text-warn">{c.imagesPendingReview} photos are waiting for review.</p>}
              </div>
            ) : (
              <p className="text-muted">Loading…</p>
            )}
          </Section>

          <Section title="Low stock" actions={<Link href="/inventory" className="text-xs text-primary hover:underline">Inventory</Link>}>
            {!data ? (
              <p className="text-muted">Loading…</p>
            ) : data.lowStock.length === 0 ? (
              <p className="text-muted">Nothing running low.</p>
            ) : (
              <ul className="divide-y divide-line-soft">
                {data.lowStock.map((s) => (
                  <li key={s.variantId} className="flex justify-between py-1.5">
                    <span>
                      {s.product} <span className="text-muted">· {s.sizeMl} ml</span>
                    </span>
                    <span className={`badge ${s.quantity === 0 ? "badge-bad" : "badge-warn"}`}>{s.quantity === 0 ? "Sold out" : `${s.quantity} left`}</span>
                  </li>
                ))}
              </ul>
            )}
          </Section>

          <Section title="Support">
            <div className="flex justify-between">
              <Link href="/messages" className="text-primary hover:underline">
                New messages
              </Link>
              <span className="tabular-nums">{data?.support.newMessages ?? "–"}</span>
            </div>
            <div className="mt-1 flex justify-between">
              <Link href="/newsletter" className="text-primary hover:underline">
                Newsletter subscribers
              </Link>
              <span className="tabular-nums">{data?.support.newsletterSubscribers ?? "–"}</span>
            </div>
          </Section>
        </div>
      </div>
    </div>
  );
}
