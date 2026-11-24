"use client";

import { useEffect, useState } from "react";

export function Field({
  label,
  error,
  hint,
  children,
  className = "",
}: {
  label: string;
  error?: string;
  hint?: string;
  children: React.ReactNode;
  className?: string;
}) {
  return (
    <div className={className}>
      <label className="label">{label}</label>
      {children}
      {error ? <p className="mt-1 text-xs text-danger">{error}</p> : hint ? <p className="mt-1 text-xs text-muted">{hint}</p> : null}
    </div>
  );
}

export function Toggle({ checked, onChange, label }: { checked: boolean; onChange: (v: boolean) => void; label: string }) {
  return (
    <label className="flex cursor-pointer items-center gap-3 select-none">
      <input type="checkbox" className="peer sr-only" checked={checked} onChange={(e) => onChange(e.target.checked)} />
      <span className="relative h-5 w-9 rounded-full border border-line bg-elevated transition-colors peer-checked:border-primary peer-checked:bg-primary peer-focus-visible:outline-2 peer-focus-visible:outline-primary after:absolute after:top-0.5 after:left-0.5 after:h-3.5 after:w-3.5 after:rounded-full after:bg-white after:shadow after:transition-transform peer-checked:after:translate-x-4 " />
      <span className="text-ink">{label}</span>
    </label>
  );
}

export function Section({ title, description, actions, children }: { title: string; description?: string; actions?: React.ReactNode; children: React.ReactNode }) {
  return (
    <section className="card p-4">
      <div className="mb-3 flex flex-wrap border-b border-line-soft pb-3 items-start justify-between gap-3">
        <div>
          <h2 className="text-sm font-semibold text-ink">{title}</h2>
          {description && <p className="mt-1 text-xs text-muted">{description}</p>}
        </div>
        {actions}
      </div>
      {children}
    </section>
  );
}

export type Notice = { kind: "ok" | "error"; text: string } | null;

/** Inline status message that fades after a few seconds (errors stay). */
export function NoticeBar({ notice }: { notice: Notice }) {
  const [dismissed, setDismissed] = useState<Notice>(null);
  useEffect(() => {
    if (notice?.kind !== "ok") return;
    const t = setTimeout(() => setDismissed(notice), 3500);
    return () => clearTimeout(t);
  }, [notice]);
  const shown = notice && notice !== dismissed ? notice : null;
  if (!shown) return null;
  return (
    <p role={shown.kind === "error" ? "alert" : "status"} className={`text-sm ${shown.kind === "ok" ? "text-success" : "text-danger"}`}>
      {shown.text}
    </p>
  );
}

export const slugify = (v: string) =>
  v
    .normalize("NFKD")
    .replace(/[̀-ͯ]/g, "")
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "")
    .slice(0, 160);
