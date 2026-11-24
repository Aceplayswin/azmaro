"use client";

import { useState } from "react";
import { validateEmail } from "@/lib/validation";
import { cn } from "@/lib/utils";

type Status = { tone: "success" | "error" | "demo"; message: string } | null;

export function NewsletterForm() {
  const [email, setEmail] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [status, setStatus] = useState<Status>(null);
  const [pending, setPending] = useState(false);

  const onSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    const err = validateEmail(email);
    setError(err);
    setStatus(null);
    if (err) return;
    setPending(true);
    try {
      const res = await fetch("/api/newsletter", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ email }),
      });
      const data = (await res.json()) as { ok: boolean; demo?: boolean; message: string };
      // Only report success when the backend confirms it.
      setStatus({ tone: data.ok ? (data.demo ? "demo" : "success") : "error", message: data.message });
      if (data.ok && !data.demo) setEmail("");
    } catch {
      setStatus({ tone: "error", message: "We couldn't reach the server. Please try again." });
    } finally {
      setPending(false);
    }
  };

  return (
    <section aria-labelledby="newsletter-title" className="az-container pt-16 sm:pt-20">
      <div className="az-lattice relative border border-line-soft bg-bg-2 px-6 py-12 text-center sm:px-10 sm:py-16">
        <p className="az-eyebrow">Join the AZMARO list</p>
        <h2 id="newsletter-title" className="az-h2 mx-auto mt-4 max-w-xl">
          A more considered fragrance wardrobe.
        </h2>
        <p className="mx-auto mt-4 max-w-md text-sm text-ink-2">
          Hear about new houses and additions to the collection. No spam – unsubscribe at any time.
        </p>
        <form onSubmit={onSubmit} noValidate className="mx-auto mt-8 flex max-w-lg flex-col gap-3 sm:flex-row">
          <div className="flex-1 text-left">
            <label htmlFor="newsletter-email" className="sr-only">
              Email address
            </label>
            <input
              id="newsletter-email"
              type="email"
              autoComplete="email"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              placeholder="Your email address"
              aria-invalid={error ? true : undefined}
              aria-describedby={error ? "newsletter-error" : undefined}
              className="az-input"
            />
            {error && (
              <p id="newsletter-error" className="mt-1.5 text-xs text-danger">
                {error}
              </p>
            )}
          </div>
          <button type="submit" className="az-btn az-btn-primary" disabled={pending}>
            {pending ? "Subscribing…" : "Subscribe"}
          </button>
        </form>
        {status && (
          <p
            role="status"
            className={cn(
              "mx-auto mt-4 max-w-lg text-xs",
              status.tone === "error" ? "text-danger" : status.tone === "demo" ? "text-gold-light" : "text-success",
            )}
          >
            {status.message}
          </p>
        )}
      </div>
    </section>
  );
}
