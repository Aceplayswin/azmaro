"use client";

import { BackLink } from "@/components/Pager";
import { Printer } from "lucide-react";
import Link from "next/link";
import { useParams } from "next/navigation";
import { useState } from "react";
import { Field, NoticeBar, Section, type Notice } from "@/components/ui";
import { api, errorMessage, formatInr } from "@/lib/api";
import { formatDateTime, ORDER_STATUS, ORDER_TRANSITIONS, PAYMENT_METHOD, PAYMENT_STATUS, SHIPMENT_STATUS, StatusBadge } from "@/lib/format";
import type { AdminOrder } from "@/lib/orders";
import { useApiResource } from "@/lib/useApiList";

export default function OrderDetailPage() {
  const { id } = useParams<{ id: string }>();
  const { data: order, error, setData } = useApiResource<AdminOrder>(`/admin/orders/${id}`);
  const [notice, setNotice] = useState<Notice>(null);
  const [busy, setBusy] = useState(false);
  const [nextStatus, setNextStatus] = useState("");
  const [statusNote, setStatusNote] = useState("");
  const [booking, setBooking] = useState({ courier: "", awb: "" });
  const [event, setEvent] = useState({ status: "IN_TRANSIT", description: "", location: "" });

  async function run(action: () => Promise<unknown>, done: string) {
    setBusy(true);
    try {
      await action();
      const { data } = await api<AdminOrder>(`/admin/orders/${id}`);
      setData(data);
      setNotice({ kind: "ok", text: done });
    } catch (e) {
      setNotice({ kind: "error", text: errorMessage(e) });
    } finally {
      setBusy(false);
    }
  }

  if (error) return <p className="text-danger">{error}</p>;
  if (!order) return <p className="text-muted">Loading…</p>;

  const allowed = ORDER_TRANSITIONS[order.status] ?? [];
  const activeShipment = order.shipments.find((s) => !["CANCELLED", "RETURN_TO_ORIGIN"].includes(s.status));
  const canShip = ["PLACED", "CONFIRMED", "PROCESSING"].includes(order.status) && !activeShipment;
  const paid = order.payments.find((p) => p.status === "PAID");
  const a = order.shippingAddress;
  const units = order.items.reduce((s, i) => s + i.quantity, 0);

  return (
    <div className="page-narrow">
      <BackLink href="/orders">Orders</BackLink>
      <header className="mb-4 flex flex-wrap items-start justify-between gap-3">
        <div>
          <h1 className="flex flex-wrap items-center gap-2 text-xl font-semibold">
            Order {order.orderNumber} {order.isTest && <span className="badge">Test order</span>}
          </h1>
          <p className="mt-1 flex flex-wrap items-center gap-2 text-muted">
            Placed {formatDateTime(order.createdAt)} · <StatusBadge map={ORDER_STATUS} value={order.status} /> <StatusBadge map={PAYMENT_STATUS} value={order.paymentStatus} />
          </p>
        </div>
        <div className="flex items-center gap-3">
          <NoticeBar notice={notice} />
          <button className="btn" onClick={() => window.print()}>
            <Printer size={14} /> Print
          </button>
        </div>
      </header>

      <div className="grid gap-4 lg:grid-cols-[1fr_20rem]">
        <div className="space-y-4">
          <Section title={`Items (${units})`}>
            <div className="overflow-x-auto">
              <table className="table">
                <thead>
                  <tr>
                    <th>Product</th>
                    <th>SKU</th>
                    <th className="text-right">Price</th>
                    <th className="text-right">Qty</th>
                    <th className="text-right">Total</th>
                  </tr>
                </thead>
                <tbody>
                  {order.items.map((i) => (
                    <tr key={`${i.productSlug}-${i.sizeMl}`}>
                      <td>
                        <div className="font-medium">{i.productName}</div>
                        <div className="text-xs text-muted">
                          {i.brandName} · {i.sizeMl} ml
                        </div>
                      </td>
                      <td className="text-ink-2">{i.sku ?? "—"}</td>
                      <td className="text-right tabular-nums">{formatInr(i.unitPrice)}</td>
                      <td className="text-right tabular-nums">{i.quantity}</td>
                      <td className="text-right font-medium tabular-nums">{formatInr(i.lineTotal)}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
            <dl className="mt-3 ml-auto max-w-xs space-y-1 text-sm">
              <div className="flex justify-between">
                <dt className="text-ink-2">Subtotal</dt>
                <dd className="tabular-nums">{formatInr(order.totals.subtotal)}</dd>
              </div>
              <div className="flex justify-between">
                <dt className="text-ink-2">Discount{order.couponCode ? ` (${order.couponCode})` : ""}</dt>
                <dd className="tabular-nums">− {formatInr(order.totals.discount)}</dd>
              </div>
              <div className="flex justify-between">
                <dt className="text-ink-2">Delivery</dt>
                <dd className="tabular-nums">{order.totals.delivery === null ? "Not configured" : formatInr(order.totals.delivery)}</dd>
              </div>
              <div className="flex justify-between border-t border-line-soft pt-1 font-semibold">
                <dt>Total</dt>
                <dd className="tabular-nums">{formatInr(order.totals.total)}</dd>
              </div>
            </dl>
          </Section>

          <Section title="Shipping">
            {order.shipments.length === 0 && <p className="mb-3 text-muted">No shipment booked yet.</p>}
            {order.shipments.map((s) => (
              <div key={s.id} className="mb-4 rounded border border-line-soft p-3">
                <div className="flex flex-wrap items-center justify-between gap-2">
                  <p>
                    <span className="font-medium">{s.courier ?? s.provider}</span> · AWB <span className="font-mono">{s.awb ?? "—"}</span>
                  </p>
                  <span className="badge badge-info">{SHIPMENT_STATUS[s.status] ?? s.status}</span>
                </div>
                {s.events.length > 0 && (
                  <ol className="mt-2 space-y-1 border-l border-line-soft pl-3 text-xs">
                    {s.events.map((e) => (
                      <li key={e.id}>
                        <span className="font-medium">{SHIPMENT_STATUS[e.status] ?? e.status}</span> – {e.description}
                        {e.location ? ` (${e.location})` : ""} <span className="text-muted">· {formatDateTime(e.occurredAt)} · {e.source.toLowerCase()}</span>
                      </li>
                    ))}
                  </ol>
                )}
                {s.id === activeShipment?.id && (
                  <form
                    className="mt-3 grid gap-2 sm:grid-cols-[10rem_1fr_9rem_auto]"
                    onSubmit={(e) => {
                      e.preventDefault();
                      void run(
                        () => api(`/admin/shipments/${s.id}/events`, { method: "POST", body: { ...event, location: event.location || undefined } }),
                        "Shipment update recorded.",
                      ).then(() => setEvent((v) => ({ ...v, description: "", location: "" })));
                    }}
                  >
                    <select className="input" value={event.status} onChange={(e) => setEvent({ ...event, status: e.target.value })} aria-label="Shipment status">
                      {Object.entries(SHIPMENT_STATUS).map(([k, v]) => (
                        <option key={k} value={k}>
                          {v}
                        </option>
                      ))}
                    </select>
                    <input className="input" placeholder="What happened (as confirmed by the courier)" value={event.description} onChange={(e) => setEvent({ ...event, description: e.target.value })} required minLength={3} />
                    <input className="input" placeholder="Location" value={event.location} onChange={(e) => setEvent({ ...event, location: e.target.value })} />
                    <button className="btn" disabled={busy}>Add update</button>
                  </form>
                )}
              </div>
            ))}
            {canShip && (
              <form
                className="grid gap-2 sm:grid-cols-[1fr_1fr_auto]"
                onSubmit={(e) => {
                  e.preventDefault();
                  void run(() => api(`/admin/orders/${order.id}/shipments`, { method: "POST", body: booking.courier || booking.awb ? booking : {} }), "Shipment booked.");
                }}
              >
                <Field label="Courier">
                  <input className="input" placeholder="e.g. Delhivery" value={booking.courier} onChange={(e) => setBooking({ ...booking, courier: e.target.value })} />
                </Field>
                <Field label="AWB / tracking number">
                  <input className="input" value={booking.awb} onChange={(e) => setBooking({ ...booking, awb: e.target.value })} />
                </Field>
                <div className="flex items-end">
                  <button className="btn btn-primary" disabled={busy}>Book shipment</button>
                </div>
                <p className="text-xs text-muted sm:col-span-3">Enter the courier and AWB of a shipment you booked yourself (or leave both empty to book through the connected courier).</p>
              </form>
            )}
          </Section>

          <Section title="Payments">
            {order.payments.length === 0 ? (
              <p className="text-muted">No payment attempts.</p>
            ) : (
              <table className="table">
                <thead>
                  <tr>
                    <th>Date</th>
                    <th>Method</th>
                    <th>Provider</th>
                    <th>Status</th>
                    <th className="text-right">Amount</th>
                  </tr>
                </thead>
                <tbody>
                  {order.payments.map((p) => (
                    <tr key={p.id}>
                      <td className="text-ink-2">{formatDateTime(p.createdAt)}</td>
                      <td>{PAYMENT_METHOD[p.method] ?? p.method}</td>
                      <td>
                        {p.provider}
                        {p.providerPaymentId && <div className="font-mono text-xs text-muted">{p.providerPaymentId}</div>}
                        {p.failureReason && <div className="text-xs text-danger">{p.failureReason}</div>}
                      </td>
                      <td>
                        <StatusBadge map={PAYMENT_STATUS} value={p.status} />
                      </td>
                      <td className="text-right tabular-nums">{formatInr(p.amount)}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            )}
            {paid && order.status === "CANCELLED" && (
              <button
                className="btn btn-danger mt-3"
                disabled={busy}
                onClick={() => confirm(`Refund ${formatInr(paid.amount)} through ${paid.provider}?`) && run(() => api(`/admin/orders/${order.id}/refund`, { method: "POST" }), "Refund requested.")}
              >
                Refund {formatInr(paid.amount)}
              </button>
            )}
          </Section>
        </div>

        <div className="space-y-4">
          <Section title="Update status">
            {allowed.length === 0 ? (
              <p className="text-muted">This order is {ORDER_STATUS[order.status]?.label.toLowerCase()} – no further changes.</p>
            ) : (
              <form
                className="space-y-2"
                onSubmit={(e) => {
                  e.preventDefault();
                  if (!nextStatus) return;
                  if (nextStatus === "CANCELLED" && !confirm("Cancel this order? Stock is restocked and any coupon use is released.")) return;
                  void run(() => api(`/admin/orders/${order.id}/status`, { method: "PATCH", body: { status: nextStatus, note: statusNote || undefined } }), "Status updated.").then(() => {
                    setNextStatus("");
                    setStatusNote("");
                  });
                }}
              >
                <select className="input" value={nextStatus} onChange={(e) => setNextStatus(e.target.value)} aria-label="New status">
                  <option value="">Choose new status…</option>
                  {allowed.map((s) => (
                    <option key={s} value={s}>
                      {ORDER_STATUS[s]?.label ?? s}
                    </option>
                  ))}
                </select>
                <input className="input" placeholder="Note (optional)" value={statusNote} onChange={(e) => setStatusNote(e.target.value)} />
                <button className={`btn w-full ${nextStatus === "CANCELLED" ? "btn-danger" : "btn-primary"}`} disabled={busy || !nextStatus}>
                  {nextStatus === "CANCELLED" ? "Cancel order" : "Update status"}
                </button>
              </form>
            )}
            {order.cancelReason && <p className="mt-2 text-xs text-danger">Cancelled: {order.cancelReason}</p>}
          </Section>

          <Section title="Customer">
            <p className="font-medium">{order.customer?.name ?? a.fullName}</p>
            <p className="text-ink-2">{order.email}</p>
            <p className="text-ink-2">{order.phone}</p>
            {order.customer ? (
              <Link href={`/customers/${order.customer.id}`} className="mt-1 inline-block text-primary hover:underline">
                View customer
              </Link>
            ) : (
              <p className="mt-1 text-xs text-muted">Guest checkout</p>
            )}
          </Section>

          <Section title="Delivery address">
            <address className="leading-relaxed text-ink-2 not-italic">
              <span className="text-ink">{a.fullName}</span>
              <br />
              {a.line1}
              {a.line2 && (
                <>
                  <br />
                  {a.line2}
                </>
              )}
              {a.landmark && (
                <>
                  <br />
                  Near {a.landmark}
                </>
              )}
              <br />
              {a.city}, {a.state} {a.pin}
              <br />
              {a.phone}
            </address>
            {order.customerNote && <p className="mt-2 rounded bg-elevated p-2 text-xs">Note: {order.customerNote}</p>}
          </Section>

          <Section title="History">
            <ol className="space-y-2 text-xs">
              {[...order.statusHistory].reverse().map((h) => (
                <li key={h.id}>
                  <span className="font-medium">{ORDER_STATUS[h.status]?.label ?? h.status}</span>
                  <span className="text-muted"> · {formatDateTime(h.createdAt)}</span>
                  {h.note && <div className="text-ink-2">{h.note}</div>}
                </li>
              ))}
            </ol>
          </Section>
        </div>
      </div>
    </div>
  );
}
