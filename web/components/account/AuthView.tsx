"use client";

import Link from "next/link";
import { useRouter, useSearchParams } from "next/navigation";
import { useEffect, useState } from "react";
import { Field } from "@/components/forms/Field";
import { LoadingState, Notice } from "@/components/ui/States";
import { safeNext, setSessionUser, useSession } from "@/lib/session";
import type { SessionUser } from "@/types/api";
import { validateEmail, validatePassword, validateRequired } from "@/lib/validation";

export type AuthMode = "sign-in" | "register" | "reset";

const TITLES: Record<AuthMode, string> = { "sign-in": "Sign in", register: "Create your account", reset: "Reset your password" };

/** Sign-in / register / forgotten-password page. Returns the shopper to `?next=` afterwards. */
export function AuthView({ mode }: { mode: AuthMode }) {
  const router = useRouter();
  const params = useSearchParams();
  const next = safeNext(params.get("next"));
  const user = useSession();
  const [values, setValues] = useState({ name: "", email: "", password: "", confirm: "" });
  const [errors, setErrors] = useState<Record<string, string | null>>({});
  const [message, setMessage] = useState<{ tone: "error" | "success"; text: string } | null>(null);
  const [pending, setPending] = useState(false);

  // Already signed in → go straight on.
  useEffect(() => {
    if (user && mode !== "reset") router.replace(next);
  }, [user, mode, next, router]);

  const set = (k: keyof typeof values) => (e: React.ChangeEvent<HTMLInputElement>) => {
    setValues((v) => ({ ...v, [k]: e.target.value }));
    setErrors((er) => ({ ...er, [k]: null }));
  };

  const submit = async (e: React.FormEvent) => {
    e.preventDefault();
    setMessage(null);
    const passwordError = mode === "reset" ? null : validatePassword(values.password);
    const errs: Record<string, string | null> = {
      email: validateEmail(values.email),
      password:
        passwordError ??
        (mode === "register" && !(/[A-Za-z]/.test(values.password) && /\d/.test(values.password)) ? "Use at least one letter and one number." : null),
      name: mode === "register" ? validateRequired(values.name, "full name") : null,
      confirm: mode === "register" && values.confirm !== values.password ? "Passwords don't match." : null,
    };
    setErrors(errs);
    if (Object.values(errs).some(Boolean)) return;

    setPending(true);
    const url = mode === "sign-in" ? "/api/auth/sign-in" : mode === "register" ? "/api/auth/register" : "/api/auth/reset";
    const body = mode === "register" ? { name: values.name, email: values.email, password: values.password } : { email: values.email, password: values.password };
    try {
      const res = await fetch(url, { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify(body) });
      const data = (await res.json().catch(() => ({}))) as { user?: SessionUser; message?: string };
      if (!res.ok) return setMessage({ tone: "error", text: data.message ?? "Something went wrong. Please try again." });
      if (mode === "reset") return setMessage({ tone: "success", text: data.message ?? "If an account exists for that email, a reset link has been sent." });
      if (data.user) {
        setSessionUser(data.user);
        router.replace(next);
      }
    } catch {
      setMessage({ tone: "error", text: "We couldn't reach the server. Please check your connection and try again." });
    } finally {
      setPending(false);
    }
  };

  if (user === undefined) return <LoadingState label="Loading" />;

  const withNext = (path: string) => (next !== "/account" ? `${path}?next=${encodeURIComponent(next)}` : path);
  const forCheckout = next.startsWith("/checkout");

  return (
    <div className="mx-auto w-full max-w-md">
      <h1 className="az-h1 text-center">{TITLES[mode]}</h1>
      {forCheckout && mode !== "reset" && (
        <Notice className="mt-6">Please sign in or create an account to check out. Your bag is saved.</Notice>
      )}

      <form onSubmit={submit} noValidate className="az-panel mt-8 space-y-5 p-6 sm:p-8">
        {mode === "register" && (
          <Field label="Full name" name="name" autoComplete="name" value={values.name} onChange={set("name")} error={errors.name} required />
        )}
        <Field label="Email" name="email" type="email" autoComplete="email" placeholder="you@example.com" value={values.email} onChange={set("email")} error={errors.email} required />
        {mode !== "reset" && (
          <div>
            <Field
              label="Password"
              name="password"
              type="password"
              autoComplete={mode === "register" ? "new-password" : "current-password"}
              value={values.password}
              onChange={set("password")}
              error={errors.password}
              hint={mode === "register" ? "At least 8 characters, with a letter and a number." : undefined}
              required
            />
            {mode === "sign-in" && (
              <Link href={withNext("/forgot-password")} className="mt-2 inline-block text-xs text-ink-2 underline-offset-4 hover:text-gold-light hover:underline">
                Forgot your password?
              </Link>
            )}
          </div>
        )}
        {mode === "register" && (
          <Field label="Confirm password" name="confirm" type="password" autoComplete="new-password" value={values.confirm} onChange={set("confirm")} error={errors.confirm} required />
        )}

        {message && <Notice tone={message.tone}>{message.text}</Notice>}

        <button type="submit" className="az-btn az-btn-primary w-full" disabled={pending}>
          {pending ? "Please wait…" : mode === "sign-in" ? "Sign in" : mode === "register" ? "Create account" : "Send reset link"}
        </button>
      </form>

      <p className="mt-6 text-center text-sm text-ink-2">
        {mode === "sign-in" ? (
          <>
            New to AZMARO?{" "}
            <Link href={withNext("/register")} className="text-gold underline-offset-4 hover:underline">
              Create an account
            </Link>
          </>
        ) : (
          <>
            {mode === "register" ? "Already have an account?" : "Remembered it?"}{" "}
            <Link href={withNext("/login")} className="text-gold underline-offset-4 hover:underline">
              Sign in
            </Link>
          </>
        )}
      </p>
    </div>
  );
}
