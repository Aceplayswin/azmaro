"use client";

import { useState } from "react";
import { ApiError, errorMessage } from "@/lib/api";
import { Field, slugify, Toggle } from "./ui";

export interface FieldDef {
  key: string;
  label: string;
  type?: "text" | "textarea" | "number" | "money" | "select" | "checkbox" | "date" | "slug";
  options?: Array<{ value: string; label: string }>;
  hint?: string;
  placeholder?: string;
  required?: boolean;
  /** Fill a slug field from this field while creating. */
  slugFrom?: string;
  wide?: boolean;
  /** Blank means "clear" (null). Set false for fields the API only accepts as a value or omitted. */
  nullable?: boolean;
  /** Initial value when creating (checkboxes default to off). */
  defaultValue?: string | boolean;
}

export type FormValues = Record<string, string | boolean>;

/** Convert form strings to the JSON the API expects (blank optional → null). */
function toBody(fields: FieldDef[], values: FormValues) {
  const body: Record<string, unknown> = {};
  for (const f of fields) {
    const v = values[f.key];
    if (f.type === "checkbox") body[f.key] = Boolean(v);
    else if (typeof v === "string" && v.trim() === "") {
      if (f.required) body[f.key] = "";
      else if (f.nullable !== false) body[f.key] = null;
    }
    else if (f.type === "number") body[f.key] = Number(v);
    else if (f.type === "date") body[f.key] = new Date(String(v)).toISOString();
    else body[f.key] = typeof v === "string" ? v.trim() : v;
  }
  return body;
}

export function initialValues(fields: FieldDef[], row?: Record<string, unknown> | null): FormValues {
  return Object.fromEntries(
    fields.map((f) => {
      const v = row?.[f.key];
      if (f.type === "checkbox") return [f.key, v === undefined ? Boolean(f.defaultValue) : Boolean(v)];
      if (v === undefined && f.defaultValue !== undefined) return [f.key, String(f.defaultValue)];
      if (v === null || v === undefined) return [f.key, f.type === "select" ? (f.options?.[0]?.value ?? "") : ""];
      if (f.type === "date") return [f.key, String(v).slice(0, 10)];
      return [f.key, String(v)];
    }),
  );
}

export function SimpleForm({
  fields,
  initial,
  creating,
  submitLabel,
  onSubmit,
  onCancel,
}: {
  fields: FieldDef[];
  initial: FormValues;
  creating: boolean;
  submitLabel: string;
  onSubmit: (body: Record<string, unknown>) => Promise<unknown>;
  onCancel: () => void;
}) {
  const [values, setValues] = useState(initial);
  const [errors, setErrors] = useState<Record<string, string>>({});
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);

  const set = (key: string, value: string | boolean) =>
    setValues((v) => {
      const next = { ...v, [key]: value };
      if (creating) for (const f of fields) if (f.slugFrom === key && typeof value === "string") next[f.key] = slugify(value);
      return next;
    });

  async function submit(e: React.FormEvent) {
    e.preventDefault();
    setBusy(true);
    setErrors({});
    setError(null);
    try {
      await onSubmit(toBody(fields, values));
    } catch (err) {
      if (err instanceof ApiError) setErrors(err.fieldErrors);
      setError(err instanceof ApiError && err.code === "DUPLICATE" ? "Something with this code / slug already exists." : errorMessage(err));
    } finally {
      setBusy(false);
    }
  }

  return (
    <form onSubmit={submit} noValidate className="grid gap-3 md:grid-cols-2 xl:grid-cols-3">
      {fields.map((f) => {
        const value = values[f.key];
        if (f.type === "checkbox")
          return (
            <div key={f.key} className="flex items-end pb-2">
              <Toggle label={f.label} checked={Boolean(value)} onChange={(v) => set(f.key, v)} />
            </div>
          );
        const common = {
          id: `f-${f.key}`,
          className: "input",
          value: String(value ?? ""),
          placeholder: f.placeholder,
          "aria-invalid": Boolean(errors[f.key]) || undefined,
        };
        return (
          <Field key={f.key} label={`${f.label}${f.required ? " *" : ""}`} error={errors[f.key]} hint={f.hint} className={f.wide ? "md:col-span-2 xl:col-span-3" : ""}>
            {f.type === "textarea" ? (
              <textarea {...common} rows={3} onChange={(e) => set(f.key, e.target.value)} />
            ) : f.type === "select" ? (
              <select {...common} onChange={(e) => set(f.key, e.target.value)}>
                {f.options!.map((o) => (
                  <option key={o.value} value={o.value}>
                    {o.label}
                  </option>
                ))}
              </select>
            ) : (
              <input
                {...common}
                type={f.type === "date" ? "date" : "text"}
                inputMode={f.type === "number" || f.type === "money" ? "decimal" : undefined}
                onChange={(e) => set(f.key, f.type === "slug" ? slugify(e.target.value) : e.target.value)}
              />
            )}
          </Field>
        );
      })}
      {error && <p role="alert" className="text-danger md:col-span-2 xl:col-span-3">{error}</p>}
      <div className="flex gap-2 md:col-span-2 xl:col-span-3">
        <button className="btn btn-primary" disabled={busy}>
          {busy ? "Saving…" : submitLabel}
        </button>
        <button type="button" className="btn" onClick={onCancel}>
          Cancel
        </button>
      </div>
    </form>
  );
}
