"use client";

import { Pencil, Plus, Trash2 } from "lucide-react";
import { useCallback, useEffect, useState } from "react";
import { PageTitle, TableMessage } from "./Pager";
import { initialValues, SimpleForm, type FieldDef } from "./SimpleForm";
import { NoticeBar, Section, type Notice } from "./ui";
import { api, errorMessage } from "@/lib/api";

export interface Column<T> {
  header: string;
  cell: (row: T) => React.ReactNode;
  className?: string;
}

/**
 * List + create / edit / delete for simple admin resources
 * (GET path, POST path, PATCH path/:id, DELETE path/:id).
 */
export function CrudPage<T extends { id: string }>({
  title,
  subtitle,
  path,
  noun,
  fields,
  columns,
  deleteLabel = () => `Delete this ${noun}?`,
  toolbar,
}: {
  title: string;
  subtitle?: string;
  path: string;
  noun: string;
  fields: FieldDef[];
  columns: Array<Column<T>>;
  deleteLabel?: (row: T) => string;
  toolbar?: React.ReactNode;
}) {
  const [rows, setRows] = useState<T[] | null>(null);
  const [editing, setEditing] = useState<T | "new" | null>(null);
  const [notice, setNotice] = useState<Notice>(null);

  const load = useCallback(() => api<T[]>(path).then(({ data }) => setRows(data)), [path]);

  useEffect(() => {
    api<T[]>(path)
      .then(({ data }) => setRows(data))
      .catch((e) => setNotice({ kind: "error", text: errorMessage(e) }));
  }, [path]);

  async function save(body: Record<string, unknown>) {
    if (editing === "new") await api(path, { method: "POST", body });
    else if (editing) await api(`${path}/${editing.id}`, { method: "PATCH", body });
    setNotice({ kind: "ok", text: editing === "new" ? `${noun[0]!.toUpperCase()}${noun.slice(1)} created.` : "Changes saved." });
    setEditing(null);
    await load();
  }

  async function remove(row: T) {
    if (!confirm(deleteLabel(row))) return;
    try {
      await api(`${path}/${row.id}`, { method: "DELETE" });
      setNotice({ kind: "ok", text: `${noun[0]!.toUpperCase()}${noun.slice(1)} deleted.` });
      await load();
    } catch (e) {
      setNotice({ kind: "error", text: errorMessage(e) });
    }
  }

  return (
    <div className="page">
      <PageTitle title={title} subtitle={subtitle}>
        {toolbar}
        <button className="btn btn-primary" onClick={() => setEditing("new")} disabled={editing === "new"}>
          <Plus size={14} /> New {noun}
        </button>
      </PageTitle>
      <div className="mb-3 min-h-5">
        <NoticeBar notice={notice} />
      </div>

      {editing && (
        <div className="mb-4">
          <Section title={editing === "new" ? `New ${noun}` : `Edit ${noun}`}>
            <SimpleForm
              key={editing === "new" ? "new" : editing.id}
              fields={fields}
              initial={initialValues(fields, editing === "new" ? null : (editing as unknown as Record<string, unknown>))}
              creating={editing === "new"}
              submitLabel={editing === "new" ? `Create ${noun}` : "Save changes"}
              onSubmit={save}
              onCancel={() => setEditing(null)}
            />
          </Section>
        </div>
      )}

      <div className="card overflow-x-auto">
        <table className="table min-w-[760px]">
          <thead>
            <tr>
              {columns.map((c) => (
                <th key={c.header} className={c.className}>
                  {c.header}
                </th>
              ))}
              <th className="w-20 text-right">Actions</th>
            </tr>
          </thead>
          <tbody>
            {rows === null && <TableMessage cols={columns.length + 1}>Loading…</TableMessage>}
            {rows?.length === 0 && <TableMessage cols={columns.length + 1}>Nothing here yet.</TableMessage>}
            {rows?.map((r) => (
              <tr key={r.id} aria-selected={editing !== "new" && editing?.id === r.id}>
                {columns.map((c) => (
                  <td key={c.header} className={c.className}>
                    {c.cell(r)}
                  </td>
                ))}
                <td>
                  <div className="flex justify-end gap-1">
                    <button className="btn btn-icon" aria-label="Edit" title="Edit" onClick={() => setEditing(r)}>
                      <Pencil size={13} />
                    </button>
                    <button className="btn btn-icon btn-danger" aria-label="Delete" title="Delete" onClick={() => remove(r)}>
                      <Trash2 size={13} />
                    </button>
                  </div>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );
}
