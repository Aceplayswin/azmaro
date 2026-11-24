"use client";

import { useState } from "react";
import { PageTitle, Pager, TableMessage } from "@/components/Pager";
import { formatDateTime } from "@/lib/format";
import { useApiList } from "@/lib/useApiList";

interface AuditEntry {
  id: string;
  action: string;
  entity: string;
  entityId: string | null;
  meta: unknown;
  createdAt: string;
  user: { name: string; email: string } | null;
}

const ENTITIES = ["product", "variant", "pricing", "product_image", "brand", "category", "order", "shipment", "user", "coupon", "contact_message", "faq", "setting", "newsletter"];

export default function AuditLogPage() {
  const [filters, setFilters] = useState({ entity: "", page: 1, pageSize: 50 });
  const { rows, pagination, error } = useApiList<AuditEntry>("/admin/audit-log", filters);
  return (
    <div className="page">
      <PageTitle title="Audit log" subtitle="Every change made in the admin panel, newest first." />
      <div className="card">
        <div className="flex flex-wrap items-center gap-3 border-b border-line-soft p-3">
          <select className="input w-auto" value={filters.entity} onChange={(e) => setFilters((f) => ({ ...f, entity: e.target.value, page: 1 }))} aria-label="Area">
            <option value="">All areas</option>
            {ENTITIES.map((e) => (
              <option key={e} value={e}>
                {e.replace("_", " ")}
              </option>
            ))}
          </select>
          {error && <span className="text-danger">{error}</span>}
        </div>
        <div className="overflow-x-auto">
          <table className="table min-w-[860px]">
            <thead>
              <tr>
                <th>When</th>
                <th>Who</th>
                <th>Action</th>
                <th>Record</th>
                <th>Details</th>
              </tr>
            </thead>
            <tbody>
              {rows === null && <TableMessage cols={5}>Loading…</TableMessage>}
              {rows?.length === 0 && <TableMessage cols={5}>No activity yet.</TableMessage>}
              {rows?.map((a) => (
                <tr key={a.id}>
                  <td className="whitespace-nowrap text-ink-2">{formatDateTime(a.createdAt)}</td>
                  <td>{a.user ? a.user.name : <span className="text-muted">System / script</span>}</td>
                  <td className="font-mono text-xs">{a.action}</td>
                  <td className="text-xs">
                    {a.entity}
                    {a.entityId && <span className="block font-mono text-muted">{a.entityId}</span>}
                  </td>
                  <td className="max-w-md truncate font-mono text-xs text-ink-2" title={a.meta ? JSON.stringify(a.meta) : undefined}>
                    {a.meta ? JSON.stringify(a.meta) : "—"}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
        <Pager pagination={pagination} onPage={(page) => setFilters((f) => ({ ...f, page }))} />
      </div>
    </div>
  );
}
