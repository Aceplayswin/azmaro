"use client";

import { useState } from "react";
import { PageTitle } from "@/components/Pager";
import { Field, NoticeBar, Section, Toggle, type Notice } from "@/components/ui";
import { api, ApiError, errorMessage } from "@/lib/api";
import { ORDER_STATUS } from "@/lib/format";
import { useApiResource } from "@/lib/useApiList";

interface Settings {
  shipping: { flatFeeInr: number | null; freeAboveInr: number | null; defaultWeightGrams: number };
  payments: { codEnabled: boolean; codMaxOrderInr: number | null; onlineMethods: Array<"UPI" | "CARD" | "NETBANKING"> };
  orders: { cancellableStatuses: string[]; maxQuantityPerLine: number };
  support: { whatsappNumber: string | null; supportEmail: string | null; supportPhone: string | null; instagramUrl: string | null };
}

const num = (v: string) => (v.trim() === "" ? null : Number(v));
const str = (v: string) => (v.trim() === "" ? null : v.trim());

function Group<K extends keyof Settings>({
  name,
  title,
  description,
  initial,
  children,
}: {
  name: K;
  title: string;
  description: string;
  initial: Settings[K];
  children: (value: Settings[K], set: (patch: Partial<Settings[K]>) => void) => React.ReactNode;
}) {
  const [value, setValue] = useState(initial);
  const [saved, setSaved] = useState(initial);
  const [notice, setNotice] = useState<Notice>(null);
  const [busy, setBusy] = useState(false);
  const dirty = JSON.stringify(value) !== JSON.stringify(saved);

  async function save() {
    setBusy(true);
    try {
      const { data } = await api<Settings[K]>(`/admin/settings/${name}`, { method: "PUT", body: value });
      setValue(data);
      setSaved(data);
      setNotice({ kind: "ok", text: "Saved." });
    } catch (e) {
      const field = e instanceof ApiError ? Object.entries(e.fieldErrors)[0] : undefined;
      setNotice({ kind: "error", text: field ? `${field[0]}: ${field[1]}` : errorMessage(e) });
    } finally {
      setBusy(false);
    }
  }

  return (
    <Section
      title={title}
      description={description}
      actions={
        <div className="flex items-center gap-3">
          <NoticeBar notice={notice} />
          <button className="btn btn-primary btn-sm" disabled={busy || !dirty} onClick={save}>
            {busy ? "Saving…" : "Save"}
          </button>
        </div>
      }
    >
      {children(value, (patch) => setValue((v) => ({ ...v, ...patch })))}
    </Section>
  );
}

export default function SettingsPage() {
  const { data, error } = useApiResource<Settings>("/admin/settings");
  if (error) return <p className="text-danger">{error}</p>;
  if (!data) return <p className="text-muted">Loading…</p>;

  return (
    <div className="page-narrow space-y-4">
      <PageTitle title="Store settings" subtitle="Business rules used by the bag and checkout. API keys and passwords are not stored here – they live in the API's .env file." />

      <Group name="shipping" title="Delivery charges" description="Leave the flat fee blank to show “To be confirmed” and charge nothing." initial={data.shipping}>
        {(v, set) => (
          <div className="grid gap-3 sm:grid-cols-3">
            <Field label="Flat delivery fee (₹)">
              <input className="input" inputMode="decimal" value={v.flatFeeInr ?? ""} onChange={(e) => set({ flatFeeInr: num(e.target.value) })} />
            </Field>
            <Field label="Free delivery above (₹)" hint="Blank = no free-delivery threshold">
              <input className="input" inputMode="decimal" value={v.freeAboveInr ?? ""} onChange={(e) => set({ freeAboveInr: num(e.target.value) })} />
            </Field>
            <Field label="Default parcel weight (g)">
              <input className="input" inputMode="numeric" value={v.defaultWeightGrams} onChange={(e) => set({ defaultWeightGrams: Number(e.target.value) || 0 })} />
            </Field>
          </div>
        )}
      </Group>

      <Group name="payments" title="Payments" description="Which payment options customers see at checkout." initial={data.payments}>
        {(v, set) => (
          <div className="space-y-3">
            <div className="flex flex-wrap gap-6">
              <Toggle label="Cash on delivery" checked={v.codEnabled} onChange={(x) => set({ codEnabled: x })} />
              {(["UPI", "CARD", "NETBANKING"] as const).map((m) => (
                <Toggle
                  key={m}
                  label={m === "CARD" ? "Cards" : m === "NETBANKING" ? "Net banking" : "UPI"}
                  checked={v.onlineMethods.includes(m)}
                  onChange={(on) => set({ onlineMethods: on ? [...v.onlineMethods, m] : v.onlineMethods.filter((x) => x !== m) })}
                />
              ))}
            </div>
            <Field label="Cash on delivery limit (₹)" hint="Blank = no limit" className="max-w-xs">
              <input className="input" inputMode="decimal" value={v.codMaxOrderInr ?? ""} onChange={(e) => set({ codMaxOrderInr: num(e.target.value) })} />
            </Field>
          </div>
        )}
      </Group>

      <Group name="orders" title="Orders & cancellation" description="Customers can cancel online only while an order is in one of these statuses (and before it ships)." initial={data.orders}>
        {(v, set) => (
          <div className="space-y-3">
            <div className="flex flex-wrap gap-6">
              {(["PENDING_PAYMENT", "PLACED", "CONFIRMED", "PROCESSING"] as const).map((s) => (
                <Toggle
                  key={s}
                  label={ORDER_STATUS[s]!.label}
                  checked={v.cancellableStatuses.includes(s)}
                  onChange={(on) => set({ cancellableStatuses: on ? [...v.cancellableStatuses, s] : v.cancellableStatuses.filter((x) => x !== s) })}
                />
              ))}
            </div>
            <Field label="Max quantity per item" className="max-w-xs">
              <input className="input" inputMode="numeric" value={v.maxQuantityPerLine} onChange={(e) => set({ maxQuantityPerLine: Number(e.target.value) || 0 })} />
            </Field>
          </div>
        )}
      </Group>

      <Group name="support" title="Support contacts" description="Shown on the store's contact page and footer." initial={data.support}>
        {(v, set) => (
          <div className="grid gap-3 sm:grid-cols-2">
            <Field label="WhatsApp number" hint="Digits with country code, e.g. 919876543210">
              <input className="input" value={v.whatsappNumber ?? ""} onChange={(e) => set({ whatsappNumber: str(e.target.value) })} />
            </Field>
            <Field label="Support phone">
              <input className="input" value={v.supportPhone ?? ""} onChange={(e) => set({ supportPhone: str(e.target.value) })} />
            </Field>
            <Field label="Support email">
              <input className="input" value={v.supportEmail ?? ""} onChange={(e) => set({ supportEmail: str(e.target.value) })} />
            </Field>
            <Field label="Instagram URL">
              <input className="input" value={v.instagramUrl ?? ""} onChange={(e) => set({ instagramUrl: str(e.target.value) })} />
            </Field>
          </div>
        )}
      </Group>
    </div>
  );
}
