"use client";

import { useSyncExternalStore } from "react";

/**
 * Tiny external store persisted to localStorage, shared by cart and wishlist.
 * The server snapshot is always the empty fallback so hydration is stable.
 * Never put payment data or secrets in here.
 */
export interface PersistentStore<T> {
  subscribe: (listener: () => void) => () => void;
  getSnapshot: () => T;
  getServerSnapshot: () => T;
  set: (updater: (prev: T) => T) => void;
}

export function createPersistentStore<T>(
  key: string,
  fallback: T,
  validate: (value: unknown) => T,
): PersistentStore<T> {
  let state = fallback;
  let loaded = false;
  const listeners = new Set<() => void>();

  const load = () => {
    if (loaded || typeof window === "undefined") return;
    loaded = true;
    try {
      const raw = window.localStorage.getItem(key);
      if (raw) state = validate(JSON.parse(raw));
    } catch {
      state = fallback;
    }
  };

  const emit = () => listeners.forEach((l) => l());

  return {
    subscribe(listener) {
      load();
      listeners.add(listener);
      const onStorage = (event: StorageEvent) => {
        if (event.key !== key) return;
        loaded = false;
        load();
        emit();
      };
      window.addEventListener("storage", onStorage);
      return () => {
        listeners.delete(listener);
        window.removeEventListener("storage", onStorage);
      };
    },
    getSnapshot() {
      load();
      return state;
    },
    getServerSnapshot() {
      return fallback;
    },
    set(updater) {
      load();
      state = updater(state);
      try {
        window.localStorage.setItem(key, JSON.stringify(state));
      } catch {
        /* storage full or blocked – keep in-memory state */
      }
      emit();
    },
  };
}

export function useStore<T>(store: PersistentStore<T>): T {
  return useSyncExternalStore(store.subscribe, store.getSnapshot, store.getServerSnapshot);
}

const noopSubscribe = () => () => {};

/** True only after hydration – use to avoid flashing stale counts from SSR. */
export function useHydrated(): boolean {
  return useSyncExternalStore(
    noopSubscribe,
    () => true,
    () => false,
  );
}
