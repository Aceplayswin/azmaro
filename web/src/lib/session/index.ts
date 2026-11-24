"use client";

import { useEffect, useSyncExternalStore } from "react";
import type { SessionUser } from "@/types/api";

/**
 * Signed-in customer, shared by the header, account and checkout.
 * `undefined` = still checking, `null` = signed out.
 */
type SessionState = SessionUser | null | undefined;

let current: SessionState = undefined;
let inflight: Promise<void> | null = null;
const listeners = new Set<() => void>();

const emit = () => listeners.forEach((l) => l());

export function setSessionUser(user: SessionUser | null) {
  current = user;
  emit();
}

/** Ask the API who is signed in (deduplicated across components). */
export function refreshSession(): Promise<void> {
  inflight ??= fetch("/api/auth/session", { cache: "no-store" })
    .then((r) => r.json())
    .then((d: { user: SessionUser | null }) => setSessionUser(d.user ?? null))
    .catch(() => setSessionUser(null))
    .finally(() => {
      inflight = null;
    });
  return inflight;
}

export async function signOut() {
  await fetch("/api/auth/sign-out", { method: "POST" }).catch(() => undefined);
  setSessionUser(null);
}

const subscribe = (l: () => void) => {
  listeners.add(l);
  return () => listeners.delete(l);
};

export function useSession(): SessionState {
  const user = useSyncExternalStore(
    subscribe,
    () => current,
    () => undefined,
  );
  useEffect(() => {
    if (current === undefined) void refreshSession();
  }, []);
  return user;
}

/** Only same-site paths are allowed as post-login destinations. */
export function safeNext(value: string | null | undefined, fallback = "/account") {
  return value && value.startsWith("/") && !value.startsWith("//") && !value.startsWith("/\\") ? value : fallback;
}

export const loginHref = (next: string) => `/login?next=${encodeURIComponent(next)}`;
