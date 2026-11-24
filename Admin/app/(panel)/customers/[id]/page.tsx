"use client";

import { Pencil, Plus, Star, Trash2 } from "lucide-react";
import Link from "next/link";
import { useParams } from "next/navigation";
import { useState } from "react";
import { useAdmin } from "@/components/AdminShell";
import { BackLink, PageTitle, StatCard, StatGrid } from "@/components/Pager";
import { initialValues, SimpleForm, type FieldDef } from "@/components/SimpleForm";
import { NoticeBar, Section, type Notice } from "@/components/ui";
import { api, errorMessage, formatInr } from "@/lib/api";
import { formatDate, formatDateTime, ORDER_STATUS, PAYMENT_STATUS, StatusBadge } from "@/lib/format";
import { useApiResource } from "@/lib/useApiList";

interface Address {
  id: string;
  label: string | null;
  fullName: string;
  phone: string;
  line1: string;
  line2: string | null;
  landmark: string | null;
  city: string;
  state: string;
  pin: string;
  isDefault: boolean;
}

interface CustomerDetail {
  id: string;
  name: string;
  email: string;
  phone: string | null;
  role: string;
  isActive: boolean;
  emailVerifiedAt: string | null;
  lastLoginAt: string | null;
  createdAt: string;
  addresses: Address[];
  orders: Array<{ id: string; orderNumber: string; status: string; paymentStatus: string; total: number; createdAt: string; isTest: boolean }>;
}

const INDIAN_STATES = [
  "Andaman and Nicobar Islands", "Andhra Pradesh", "Arunachal Pradesh", "Assam", "Bihar", "Chandigarh", "Chhattisgarh",
  "Dadra and Nagar Haveli and Daman and Diu", "Delhi", "Goa", "Gujarat", "Haryana", "Himachal Pradesh", "Jammu and Kashmir",
  "Jharkhand", "Karnataka", "Kerala", "Ladakh", "Lakshadweep", "Madhya Pradesh", "Maharashtra", "Manipur", "Meghalaya", "Mizoram",
  "Nagaland", "Odisha", "Puducherry", "Punjab", "Rajasthan", "Sikkim", "Tamil Nadu", "Telangana", "Tripura", "Uttar Pradesh",
  "Uttarakhand", "West Bengal",
];

const PROFILE_FIELDS: FieldDef[] = [
  { key: "name", label: "Full name", required: true },
  { key: "phone", label: "Mobile number", placeholder: "10-digit mobile" },
];

const ADDRESS_FIELDS: FieldDef[] = [
  { key: "fullName", label: "Full name", required: true },
  { key: "phone", label: "Mobile number", required: true, placeholder: "10-digit mobile" },
  { key: "label", label: "Label", placeholder: "Home, Office…" },
  { key: "line1", label: "Address line 1", required: true, wide: true, placeholder: "House / street / locality" },
  { key: "line2", label: "Address line 2", wide: true },
  { key: "landmark", label: "Landmark" },
  { key: "city", label: "City", required: true },
  { key: "state", label: "State", type: "select", options: [{ value: "", label: "Select state" }, ...INDIAN_STATES.map((s) => ({ value: s, label: s }))], required: true },
  { key: "pin", label: "PIN code", required: true },
  { key: "isDefault", label: "Default address", type: "checkbox" },
];

export default function CustomerDetailPage() {
  const { id } = useParams<{ id: string }>();
  const me = useAdmin();
  const { data: c, error, reload } = useApiResource<CustomerDetail>(`/admin/customers/${id}`);
  const [notice, setNotice] = useState<Notice>(null);
  const [busy, setBusy] = useState(false);
  const [editingProfile, setEditingProfile] = useState(false);
  const [editingAddress, setEditingAddress] = useState<Address | "new" | null>(null);

  async function act(action: () => Promise<unknown>, done: string) {
    setBusy(true);
    try {
      await action();
      setNotice({ kind: "ok", text: done });
      reload();
    } catch (e) {
      setNotice({ kind: "error", text: errorMessage(e) });
    } finally {
      setBusy(false);
    }
  }

  if (error) return <p className="text-danger">{error}</p>;
  if (!c) return <p className="text-muted">Loading…</p>;

  const realOrders = c.orders.filter((o) => !o.isTest && o.status !== "CANCELLED");
  const spent = realOrders.reduce((s, o) => s + o.total, 0);
  const isMe = me.id === c.id;
  const sortedAddresses = [...c.addresses].sort((a, b) => Number(b.isDefault) - Number(a.isDefault));

  return (
    <div className="page-narrow">
      <BackLink href="/customers">Customers</BackLink>
      <PageTitle title={c.name} subtitle={`${c.email} · customer since ${formatDate(c.createdAt)}`}>
        <NoticeBar notice={notice} />
      </PageTitle>

      <StatGrid>
        <StatCard label="Orders" value={c.orders.length} sub={c.orders.length >= 20 ? "Latest 20 shown" : undefined} />
        <StatCard label="Total spent" value={formatInr(spent)} sub="Excl. cancelled & test orders" />
        <StatCard label="Average order" value={realOrders.length ? formatInr(Math.round((spent / realOrders.length) * 100) / 100) : "—"} />
        <StatCard label="Last order" value={c.orders[0] ? formatDate(c.orders[0].createdAt) : "—"} />
      </StatGrid>

      <div className="grid gap-4 lg:grid-cols-[1fr_20rem]">
        <div className="space-y-4">
          <Section
            title={`Addresses (${c.addresses.length})`}
            description="Saved automatically from the customer's orders. You can add, edit or remove them here."
            actions={
              <button className="btn btn-sm" onClick={() => setEditingAddress("new")} disabled={editingAddress === "new"}>
                <Plus size={13} /> Add address
              </button>
            }
          >
            {editingAddress && (
              <div className="mb-4 rounded border border-line p-3">
                <p className="mb-2 font-medium">{editingAddress === "new" ? "New address" : "Edit address"}</p>
                <SimpleForm
                  key={editingAddress === "new" ? "new" : editingAddress.id}
                  fields={ADDRESS_FIELDS}
                  initial={initialValues(ADDRESS_FIELDS, editingAddress === "new" ? { fullName: c.name, phone: c.phone ?? "" } : (editingAddress as unknown as Record<string, unknown>))}
                  creating={editingAddress === "new"}
                  submitLabel={editingAddress === "new" ? "Add address" : "Save address"}
                  onCancel={() => setEditingAddress(null)}
                  onSubmit={async (body) => {
                    if (editingAddress === "new") await api(`/admin/customers/${c.id}/addresses`, { method: "POST", body });
                    else await api(`/admin/customers/${c.id}/addresses/${editingAddress.id}`, { method: "PATCH", body });
                    setEditingAddress(null);
                    setNotice({ kind: "ok", text: "Address saved." });
                    reload();
                  }}
                />
              </div>
            )}
            {c.addresses.length === 0 ? (
              <p className="text-muted">No addresses yet. They are saved here when the customer places an order.</p>
            ) : (
              <div className="grid gap-3 sm:grid-cols-2">
                {sortedAddresses.map((a) => (
                  <div key={a.id} className={`rounded border p-3 ${a.isDefault ? "border-primary/40 bg-blue-50/40" : "border-line-soft"}`}>
                    <div className="mb-1 flex items-start justify-between gap-2">
                      <p className="font-medium">
                        {a.fullName}
                        {a.label && <span className="badge ml-1.5">{a.label}</span>}
                        {a.isDefault && <span className="badge badge-info ml-1.5">Default</span>}
                      </p>
                      <div className="flex shrink-0 gap-1">
                        {!a.isDefault && (
                          <button
                            className="btn btn-icon"
                            title="Make default"
                            aria-label="Make default"
                            disabled={busy}
                            onClick={() => act(() => api(`/admin/customers/${c.id}/addresses/${a.id}`, { method: "PATCH", body: { isDefault: true } }), "Default address changed.")}
                          >
                            <Star size={13} />
                          </button>
                        )}
                        <button className="btn btn-icon" title="Edit" aria-label="Edit address" onClick={() => setEditingAddress(a)}>
                          <Pencil size={13} />
                        </button>
                        <button
                          className="btn btn-icon btn-danger"
                          title="Delete"
                          aria-label="Delete address"
                          disabled={busy}
                          onClick={() => confirm("Remove this address?") && act(() => api(`/admin/customers/${c.id}/addresses/${a.id}`, { method: "DELETE" }), "Address removed.")}
                        >
                          <Trash2 size={13} />
                        </button>
                      </div>
                    </div>
                    <address className="leading-relaxed text-ink-2 not-italic">
                      {a.line1}
                      {a.line2 && <>, {a.line2}</>}
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
                  </div>
                ))}
              </div>
            )}
          </Section>

          <Section title="Orders">
            {c.orders.length === 0 ? (
              <p className="text-muted">No orders yet.</p>
            ) : (
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
                  {c.orders.map((o) => (
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
            )}
          </Section>
        </div>

        <div className="space-y-4">
          <Section
            title="Customer details"
            actions={
              !editingProfile && (
                <button className="btn btn-sm" onClick={() => setEditingProfile(true)}>
                  <Pencil size={13} /> Edit
                </button>
              )
            }
          >
            {editingProfile ? (
              <SimpleForm
                fields={PROFILE_FIELDS}
                initial={initialValues(PROFILE_FIELDS, c as unknown as Record<string, unknown>)}
                creating={false}
                submitLabel="Save"
                onCancel={() => setEditingProfile(false)}
                onSubmit={async (body) => {
                  await api(`/admin/customers/${c.id}`, { method: "PATCH", body });
                  setEditingProfile(false);
                  setNotice({ kind: "ok", text: "Customer details saved." });
                  reload();
                }}
              />
            ) : (
              <dl className="space-y-1.5">
                {[
                  ["Name", c.name],
                  ["Email", c.email],
                  ["Mobile", c.phone ?? "—"],
                  ["Email verified", c.emailVerifiedAt ? "Yes" : "No"],
                  ["Last sign-in", formatDateTime(c.lastLoginAt)],
                  ["Joined", formatDate(c.createdAt)],
                ].map(([k, v]) => (
                  <div key={k} className="flex justify-between gap-3">
                    <dt className="text-ink-2">{k}</dt>
                    <dd className="truncate text-right">{v}</dd>
                  </div>
                ))}
              </dl>
            )}
          </Section>

          <Section title="Access" description={isMe ? "You can't change your own access here." : "Changing access signs the person out everywhere."}>
            <label className="label" htmlFor="role">
              Role
            </label>
            <select
              id="role"
              className="input mb-3"
              value={c.role}
              disabled={busy || isMe}
              onChange={(e) => act(() => api(`/admin/customers/${c.id}`, { method: "PATCH", body: { role: e.target.value } }), "Role updated.")}
            >
              <option value="CUSTOMER">Customer</option>
              <option value="STAFF">Staff (store operations)</option>
              <option value="ADMIN">Admin (full access)</option>
            </select>
            <div className="mb-3 flex justify-between">
              <span className="text-ink-2">Status</span>
              <span className={`badge ${c.isActive ? "badge-ok" : "badge-bad"}`}>{c.isActive ? "Active" : "Disabled"}</span>
            </div>
            <button
              className={`btn w-full ${c.isActive ? "btn-danger" : ""}`}
              disabled={busy || isMe}
              onClick={() =>
                (c.isActive ? confirm(`Disable ${c.name}'s account? They will be signed out and can't sign in.`) : true) &&
                act(() => api(`/admin/customers/${c.id}`, { method: "PATCH", body: { isActive: !c.isActive } }), c.isActive ? "Account disabled." : "Account re-activated.")
              }
            >
              {c.isActive ? "Disable account" : "Re-activate account"}
            </button>
          </Section>
        </div>
      </div>
    </div>
  );
}
