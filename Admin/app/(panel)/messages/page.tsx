"use client";

import { ChevronDown } from "lucide-react";
import { useState } from "react";
import { PageTitle, Pager, TableMessage } from "@/components/Pager";
import { NoticeBar, type Notice } from "@/components/ui";
import { api, errorMessage } from "@/lib/api";
import { formatDateTime } from "@/lib/format";
import { useApiList } from "@/lib/useApiList";

interface Message {
  id: string;
  name: string;
  email: string;
  phone: string | null;
  orderNumber: string | null;
  message: string;
  status: "NEW" | "IN_PROGRESS" | "RESOLVED" | "SPAM";
  adminNote: string | null;
  createdAt: string;
}

const STATUS: Record<Message["status"], { label: string; cls: string }> = {
  NEW: { label: "New", cls: "badge-info" },
  IN_PROGRESS: { label: "In progress", cls: "badge-warn" },
  RESOLVED: { label: "Resolved", cls: "badge-ok" },
  SPAM: { label: "Spam", cls: "" },
};

function MessageActions({ m, onSaved }: { m: Message; onSaved: (n: Notice) => void }) {
  const [status, setStatus] = useState(m.status);
  const [note, setNote] = useState(m.adminNote ?? "");
  const [busy, setBusy] = useState(false);
  async function save() {
    setBusy(true);
    try {
      await api(`/admin/contact-messages/${m.id}`, { method: "PATCH", body: { status, adminNote: note.trim() || null } });
      onSaved({ kind: "ok", text: "Message updated." });
    } catch (e) {
      onSaved({ kind: "error", text: errorMessage(e) });
    } finally {
      setBusy(false);
    }
  }
  return (
    <div className="grid gap-2 sm:grid-cols-[10rem_1fr_auto]">
      <select className="input" value={status} onChange={(e) => setStatus(e.target.value as Message["status"])} aria-label="Status">
        {Object.entries(STATUS).map(([k, v]) => (
          <option key={k} value={k}>
            {v.label}
          </option>
        ))}
      </select>
      <input className="input" placeholder="Internal note" value={note} onChange={(e) => setNote(e.target.value)} />
      <button className="btn btn-primary" disabled={busy} onClick={save}>
        Save
      </button>
    </div>
  );
}

export default function MessagesPage() {
  const [filters, setFilters] = useState({ status: "", page: 1, pageSize: 25 });
  const [open, setOpen] = useState<string | null>(null);
  const [notice, setNotice] = useState<Notice>(null);
  const { rows, pagination, error, reload } = useApiList<Message>("/admin/contact-messages", filters);

  return (
    <div className="page">
      <PageTitle title="Messages" subtitle="Contact-form submissions from the store. Reply by email, then mark them resolved." />
      <div className="card">
        <div className="flex flex-wrap items-center gap-3 border-b border-line-soft p-3">
          <select className="input w-auto" value={filters.status} onChange={(e) => setFilters((f) => ({ ...f, status: e.target.value, page: 1 }))} aria-label="Status">
            <option value="">All messages</option>
            {Object.entries(STATUS).map(([k, v]) => (
              <option key={k} value={k}>
                {v.label}
              </option>
            ))}
          </select>
          <NoticeBar notice={error ? { kind: "error", text: error } : notice} />
        </div>
        <div className="overflow-x-auto">
          <table className="table min-w-[860px]">
            <thead>
              <tr>
                <th className="w-8" />
                <th>From</th>
                <th>Message</th>
                <th>Order</th>
                <th>Received</th>
                <th>Status</th>
              </tr>
            </thead>
            <tbody>
              {rows === null && <TableMessage cols={6}>Loading…</TableMessage>}
              {rows?.length === 0 && <TableMessage cols={6}>No messages.</TableMessage>}
              {rows?.map((m) => {
                const expanded = open === m.id;
                return [
                  <tr key={m.id} className="cursor-pointer" onClick={() => setOpen(expanded ? null : m.id)}>
                    <td>
                      <ChevronDown size={14} className={`text-muted transition-transform ${expanded ? "" : "-rotate-90"}`} />
                    </td>
                    <td>
                      <div className="font-medium">{m.name}</div>
                      <div className="text-xs text-muted">{m.email}</div>
                    </td>
                    <td className="max-w-md truncate text-ink-2">{m.message}</td>
                    <td>{m.orderNumber ?? "—"}</td>
                    <td className="whitespace-nowrap text-ink-2">{formatDateTime(m.createdAt)}</td>
                    <td>
                      <span className={`badge ${STATUS[m.status].cls}`}>{STATUS[m.status].label}</span>
                    </td>
                  </tr>,
                  expanded && (
                    <tr key={`${m.id}-detail`}>
                      <td />
                      <td colSpan={5} className="bg-elevated/50">
                        <p className="mb-2 whitespace-pre-wrap">{m.message}</p>
                        <p className="mb-3 text-xs text-ink-2">
                          <a className="text-primary hover:underline" href={`mailto:${m.email}?subject=${encodeURIComponent("Re: your message to AZMARO")}`}>
                            Reply to {m.email}
                          </a>
                          {m.phone && ` · ${m.phone}`}
                        </p>
                        <MessageActions
                          m={m}
                          onSaved={(n) => {
                            setNotice(n);
                            if (n?.kind === "ok") reload();
                          }}
                        />
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
