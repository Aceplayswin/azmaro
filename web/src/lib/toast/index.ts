"use client";

import { useSyncExternalStore } from "react";

export interface Toast {
  id: number;
  title: string;
  description?: string;
  action?: { label: string; href: string };
  tone?: "default" | "error";
}

let toasts: Toast[] = [];
let nextId = 1;
const listeners = new Set<() => void>();
const emit = () => listeners.forEach((l) => l());
const EMPTY: Toast[] = [];

export function toast(t: Omit<Toast, "id">, durationMs = 4200) {
  const id = nextId++;
  toasts = [...toasts.slice(-2), { ...t, id }];
  emit();
  window.setTimeout(() => dismissToast(id), durationMs);
}

export function dismissToast(id: number) {
  toasts = toasts.filter((t) => t.id !== id);
  emit();
}

export function useToasts(): Toast[] {
  return useSyncExternalStore(
    (l) => {
      listeners.add(l);
      return () => listeners.delete(l);
    },
    () => toasts,
    () => EMPTY,
  );
}
