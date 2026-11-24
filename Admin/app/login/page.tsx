"use client";

import { useRouter } from "next/navigation";
import { useState } from "react";
import { api, errorMessage } from "@/lib/api";
import type { User } from "@/lib/types";

export default function LoginPage() {
  const router = useRouter();
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);

  async function submit(e: React.FormEvent) {
    e.preventDefault();
    setBusy(true);
    setError(null);
    try {
      const { data } = await api<{ user: User }>("/auth/login", { method: "POST", body: { email, password } });
      if (!data.user.isAdmin) {
        await api("/auth/logout", { method: "POST" }).catch(() => undefined);
        setError("This account doesn't have admin access.");
        return;
      }
      router.replace("/dashboard");
    } catch (err) {
      setError(errorMessage(err));
    } finally {
      setBusy(false);
    }
  }

  return (
    <main className="grid min-h-dvh place-items-center px-4">
      <form onSubmit={submit} className="card w-full max-w-sm p-6 shadow-sm">
        <h1 className="mb-6 text-lg font-semibold">AZMARO Admin – Sign in</h1>
        <label className="label" htmlFor="email">Email</label>
        <input id="email" type="email" className="input mb-4" autoComplete="username" required value={email} onChange={(e) => setEmail(e.target.value)} />
        <label className="label" htmlFor="password">Password</label>
        <input id="password" type="password" className="input" autoComplete="current-password" required value={password} onChange={(e) => setPassword(e.target.value)} />
        {error && <p role="alert" className="mt-4 text-sm text-danger">{error}</p>}
        <button type="submit" className="btn btn-primary mt-6 w-full" disabled={busy}>
          {busy ? "Signing in…" : "Sign in"}
        </button>
      </form>
    </main>
  );
}
