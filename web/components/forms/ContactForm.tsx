"use client";

import { useState } from "react";
import { Notice } from "@/components/ui/States";
import { validateEmail, validatePhone, validateRequired } from "@/lib/validation";
import { Field, TextAreaField } from "./Field";

const EMPTY = { name: "", email: "", phone: "", orderNumber: "", message: "" };

export function ContactForm() {
  const [values, setValues] = useState(EMPTY);
  const [errors, setErrors] = useState<Record<string, string | null>>({});
  const [status, setStatus] = useState<{ tone: "success" | "error" | "demo"; text: string } | null>(null);
  const [pending, setPending] = useState(false);

  const set = (k: keyof typeof EMPTY) => (e: React.ChangeEvent<HTMLInputElement | HTMLTextAreaElement>) => {
    setValues((v) => ({ ...v, [k]: e.target.value }));
    setErrors((er) => ({ ...er, [k]: null }));
  };

  const submit = async (e: React.FormEvent) => {
    e.preventDefault();
    setStatus(null);
    const errs = {
      name: validateRequired(values.name, "name"),
      email: validateEmail(values.email),
      phone: validatePhone(values.phone, false),
      message: validateRequired(values.message, "message", 10),
    };
    setErrors(errs);
    if (Object.values(errs).some(Boolean)) return;
    setPending(true);
    try {
      const res = await fetch("/api/contact", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(values),
      });
      const data = (await res.json()) as { ok: boolean; demo?: boolean; message: string };
      setStatus({ tone: data.ok ? (data.demo ? "demo" : "success") : "error", text: data.message });
      if (data.ok && !data.demo) setValues(EMPTY);
    } catch {
      setStatus({ tone: "error", text: "We couldn't send your message. Please try again." });
    } finally {
      setPending(false);
    }
  };

  return (
    <form onSubmit={submit} noValidate className="az-panel p-6 sm:p-8" aria-labelledby="contact-form-title">
      <h2 id="contact-form-title" className="font-serif text-3xl">
        Send us a message
      </h2>
      <div className="mt-6 grid gap-5 sm:grid-cols-2">
        <Field label="Name" name="name" autoComplete="name" placeholder="Your name" value={values.name} onChange={set("name")} error={errors.name} required />
        <Field label="Email" name="email" type="email" autoComplete="email" placeholder="you@example.com" value={values.email} onChange={set("email")} error={errors.email} required />
        <Field label="Phone (optional)" name="phone" type="tel" prefix="+91" autoComplete="tel-national" value={values.phone} onChange={set("phone")} error={errors.phone} />
        <Field label="Order number (optional)" name="orderNumber" placeholder="AZM-0000000" value={values.orderNumber} onChange={set("orderNumber")} />
        <div className="sm:col-span-2">
          <TextAreaField label="Message" name="message" placeholder="How can we help?" value={values.message} onChange={set("message")} error={errors.message} required />
        </div>
      </div>
      {status && (
        <Notice tone={status.tone} className="mt-5">
          {status.text}
        </Notice>
      )}
      <button type="submit" className="az-btn az-btn-primary mt-6 w-full sm:w-auto" disabled={pending}>
        {pending ? "Sending…" : "Send message"}
      </button>
    </form>
  );
}
