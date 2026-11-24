"use client";

import { ChevronDown, RefreshCw } from "lucide-react";
import Link from "next/link";
import { useState } from "react";
import { PageTitle, Pager, StatCard, StatGrid, TableMessage } from "@/components/Pager";
import { formatInr } from "@/lib/api";
import { formatDateTime } from "@/lib/format";
import { useApiList, useApiResource } from "@/lib/useApiList";

interface Cart {
  id: string;
  owner: { type: "customer"; id: string; name: string | null; email: string | null } | { type: "guest" };
  couponCode: string | null;
  deliveryPin: string | null;
  createdAt: string;
  lastActivity: string;
  lines: number;
  units: number;
  value: number;
  items: Array<{ slug: string; name: string; brand: string; sizeMl: number; quantity: number; unitPrice: number | null; addedAt: string }>;
}

interface CartSummary {
  activeCarts: number;
  customerCarts: number;
  guestCarts: number;
  units: number;
  value: number;
  topProducts: Array<{ slug: string; name: string; brand: string; units: number; carts: number }>;
}

export default function CartsPage() {
  const [filters, setFilters] = useState({ owner: "all", page: 1, pageSize: 25 });
  const [open, setOpen] = useState<string | null>(null);
  const { rows, pagination, error, reload } = useApiList<Cart>("/admin/carts", filters);
  const summary = useApiResource<CartSummary>("/admin/carts/summary");
  const s = summary.data;

  const refresh = () => {
    reload();
    summary.reload();
  };

  return (
    <div className="page">
      <PageTitle title="Carts" subtitle="What shoppers have added to their bag and not yet ordered (a bag empties once the order is placed).">
        <button className="btn" onClick={refresh}>
          <RefreshCw size={14} /> Refresh
        </button>
      </PageTitle>

      <StatGrid>
        <StatCard label="Active carts" value={s ? s.activeCarts : "–"} sub={s && `${s.customerCarts} customers · ${s.guestCarts} guests`} />
        <StatCard label="Items in carts" value={s ? s.units : "–"} />
        <StatCard label="Value in carts" value={s ? formatInr(s.value) : "–"} sub="At current prices" />
        <StatCard label="Average cart" value={s && s.activeCarts ? formatInr(Math.round((s.value / s.activeCarts) * 100) / 100) : "–"} />
      </StatGrid>

      {s && s.topProducts.length > 0 && (
        <div className="card mb-4 p-4">
          <h2 className="mb-2 text-sm font-semibold">Most added to bag</h2>
          <ol className="grid gap-x-6 gap-y-1 sm:grid-cols-2 lg:grid-cols-5">
            {s.topProducts.map((p, i) => (
              <li key={p.slug} className="truncate">
                <span className="text-muted">{i + 1}.</span> {p.name} <span className="text-muted">· {p.units} in {p.carts} cart{p.carts === 1 ? "" : "s"}</span>
              </li>
            ))}
          </ol>
        </div>
      )}

      <div className="card">
        <div className="flex flex-wrap items-center gap-2 border-b border-line-soft p-3">
          <select className="input w-auto" value={filters.owner} onChange={(e) => setFilters((f) => ({ ...f, owner: e.target.value, page: 1 }))} aria-label="Shopper type">
            <option value="all">All shoppers</option>
            <option value="customer">Signed-in customers</option>
            <option value="guest">Guests</option>
          </select>
          {error && <span className="text-danger">{error}</span>}
        </div>
        <div className="overflow-x-auto">
          <table className="table min-w-[860px]">
            <thead>
              <tr>
                <th className="w-8" />
                <th>Shopper</th>
                <th>Last activity</th>
                <th className="text-right">Products</th>
                <th className="text-right">Items</th>
                <th className="text-right">Value</th>
                <th>Coupon / PIN</th>
              </tr>
            </thead>
            <tbody>
              {rows === null && <TableMessage cols={7}>Loading…</TableMessage>}
              {rows?.length === 0 && <TableMessage cols={7}>No carts with items right now.</TableMessage>}
              {rows?.map((c) => {
                const expanded = open === c.id;
                return [
                  <tr key={c.id} className="cursor-pointer" onClick={() => setOpen(expanded ? null : c.id)}>
                    <td>
                      <ChevronDown size={14} className={`text-muted transition-transform ${expanded ? "" : "-rotate-90"}`} />
                    </td>
                    <td>
                      {c.owner.type === "customer" ? (
                        <>
                          <Link href={`/customers/${c.owner.id}`} onClick={(e) => e.stopPropagation()} className="font-medium text-primary hover:underline">
                            {c.owner.name}
                          </Link>
                          <div className="text-xs text-muted">{c.owner.email}</div>
                        </>
                      ) : (
                        <span className="text-ink-2">Guest shopper</span>
                      )}
                    </td>
                    <td className="text-ink-2">{formatDateTime(c.lastActivity)}</td>
                    <td className="text-right tabular-nums">{c.lines}</td>
                    <td className="text-right tabular-nums">{c.units}</td>
                    <td className="text-right font-medium tabular-nums">{formatInr(c.value)}</td>
                    <td className="text-ink-2">
                      {c.couponCode ?? "—"} / {c.deliveryPin ?? "—"}
                    </td>
                  </tr>,
                  expanded && (
                    <tr key={`${c.id}-items`}>
                      <td />
                      <td colSpan={6} className="bg-elevated/50">
                        <table className="w-full text-xs">
                          <tbody>
                            {c.items.map((i) => (
                              <tr key={`${i.slug}-${i.sizeMl}`}>
                                <td className="py-1">
                                  {i.brand} {i.name} · {i.sizeMl} ml
                                </td>
                                <td className="py-1 text-right tabular-nums">
                                  {i.quantity} × {formatInr(i.unitPrice)}
                                </td>
                                <td className="py-1 pl-6 text-right text-muted">added {formatDateTime(i.addedAt)}</td>
                              </tr>
                            ))}
                          </tbody>
                        </table>
                      </td>
                    </tr>
                  ),
                ];
              })}
            </tbody>
          </table>
        </div>
        <Pager pagination={pagination} onPage={(page) => setFilters((f) => ({ ...f, page }))} />
      </div>
    </div>
  );
}
