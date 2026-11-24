"use client";

import { Download } from "lucide-react";
import { useState } from "react";
import { PageTitle, Pager, TableMessage } from "@/components/Pager";
import { formatDateTime } from "@/lib/format";
import { useApiList } from "@/lib/useApiList";

interface Subscriber {
  id: string;
  email: string;
  status: "SUBSCRIBED" | "UNSUBSCRIBED";
  source: string | null;
  subscribedAt: string;
  unsubscribedAt: string | null;
}

export default function NewsletterPage() {
  const [filters, setFilters] = useState({ status: "", page: 1, pageSize: 50 });
  const [error, setError] = useState<string | null>(null);
  const { rows, pagination, error: loadError } = useApiList<Subscriber>("/admin/newsletter-subscribers", filters);

  async function exportCsv() {
    setError(null);
    const res = await fetch(`/api/v1/admin/newsletter-subscribers?format=csv${filters.status ? `&status=${filters.status}` : ""}`, { credentials: "include" });
    if (!res.ok) return setError("Export failed.");
    const a = document.createElement("a");
    a.href = URL.createObjectURL(await res.blob());
    a.download = `azmaro-newsletter-${new Date().toISOString().slice(0, 10)}.csv`;
    a.click();
    URL.revokeObjectURL(a.href);
  }

  return (
    <div className="page-narrow">
      <PageTitle title="Newsletter" subtitle="People who signed up for AZMARO emails.">
        <button className="btn" onClick={exportCsv}>
          <Download size={14} /> Export CSV
        </button>
      </PageTitle>
      <div className="card">
        <div className="flex flex-wrap items-center gap-3 border-b border-line-soft p-3">
          <select className="input w-auto" value={filters.status} onChange={(e) => setFilters((f) => ({ ...f, status: e.target.value, page: 1 }))} aria-label="Status">
            <option value="">Everyone</option>
            <option value="SUBSCRIBED">Subscribed</option>
            <option value="UNSUBSCRIBED">Unsubscribed</option>
          </select>
          {(error || loadError) && <span className="text-danger">{error ?? loadError}</span>}
        </div>
        <table className="table">
          <thead>
            <tr>
              <th>Email</th>
              <th>Source</th>
              <th>Signed up</th>
              <th>Status</th>
            </tr>
          </thead>
          <tbody>
            {rows === null && <TableMessage cols={4}>Loading…</TableMessage>}
            {rows?.length === 0 && <TableMessage cols={4}>No subscribers yet.</TableMessage>}
            {rows?.map((s) => (
              <tr key={s.id}>
                <td className="font-medium">{s.email}</td>
                <td className="text-ink-2">{s.source ?? "—"}</td>
                <td className="text-ink-2">{formatDateTime(s.subscribedAt)}</td>
                <td>
                  <span className={`badge ${s.status === "SUBSCRIBED" ? "badge-ok" : ""}`}>{s.status === "SUBSCRIBED" ? "Subscribed" : `Unsubscribed ${formatDateTime(s.unsubscribedAt)}`}</span>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
        <Pager pagination={pagination} onPage={(page) => setFilters((f) => ({ ...f, page }))} />
      </div>
    </div>
  );
}
