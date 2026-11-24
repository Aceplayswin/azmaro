"use client";

import { PageTitle } from "@/components/Pager";
import { useApiResource } from "@/lib/useApiList";

type Status = Record<string, unknown>;

const label = (k: string) => k.replace(/([A-Z])/g, " $1").replace(/^./, (c) => c.toUpperCase());

function Value({ v }: { v: unknown }) {
  if (typeof v === "boolean") return <span className={`badge ${v ? "badge-ok" : ""}`}>{v ? "Yes" : "No"}</span>;
  if (v === null || v === undefined || v === "") return <span className="text-muted">—</span>;
  if (Array.isArray(v)) return <>{v.join(", ") || "—"}</>;
  if (typeof v === "object")
    return (
      <dl className="space-y-0.5">
        {Object.entries(v as Status).map(([k, x]) => (
          <div key={k} className="flex gap-2">
            <dt className="text-ink-2">{label(k)}:</dt>
            <dd>
              <Value v={x} />
            </dd>
          </div>
        ))}
      </dl>
    );
  return <>{String(v)}</>;
}

export default function IntegrationsPage() {
  const { data, error } = useApiResource<Status>("/admin/integrations");
  return (
    <div className="page-narrow">
      <PageTitle
        title="Integrations"
        subtitle="Payment gateway, courier and email connections. These are configured in the API's .env file (keys are never shown here)."
      />
      {error && <p className="text-danger">{error}</p>}
      {data && (
        <div className="card">
          <table className="table">
            <tbody>
              {Object.entries(data).map(([k, v]) => (
                <tr key={k}>
                  <th className="w-48 bg-transparent align-top">{label(k)}</th>
                  <td>
                    <Value v={v} />
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
      {data?.mode === "demo" && (
        <p className="mt-3 text-sm text-warn">
          The store is in demo mode: online payments create clearly-marked test orders and no money is collected until a payment provider is connected.
        </p>
      )}
    </div>
  );
}
