"use client";

import Link from "next/link";
import { X } from "lucide-react";
import { dismissToast, useToasts } from "@/lib/toast";
import { cn } from "@/lib/utils";

/** ToastNotification viewport – mounted once in the root layout. */
export function Toaster() {
  const toasts = useToasts();
  return (
    <div
      aria-live="polite"
      aria-atomic="false"
      className="pointer-events-none fixed inset-x-4 bottom-24 z-[90] flex flex-col items-center gap-2 sm:inset-x-auto sm:right-6 sm:bottom-6 sm:items-end lg:bottom-6"
    >
      {toasts.map((t) => (
        <div
          key={t.id}
          role="status"
          className={cn(
            "az-anim-rise pointer-events-auto flex w-full max-w-sm items-start gap-4 border bg-elevated px-5 py-4 shadow-[0_20px_50px_-20px_rgba(0,0,0,0.9)]",
            t.tone === "error" ? "border-danger/50" : "border-line",
          )}
        >
          <div className="min-w-0 flex-1">
            <p className="text-sm text-ink">{t.title}</p>
            {t.description && <p className="mt-0.5 text-xs text-ink-2">{t.description}</p>}
            {t.action && (
              <Link href={t.action.href} className="az-link mt-2 inline-block" onClick={() => dismissToast(t.id)}>
                {t.action.label}
              </Link>
            )}
          </div>
          <button
            type="button"
            onClick={() => dismissToast(t.id)}
            aria-label="Dismiss notification"
            className="-mt-1 -mr-2 grid size-8 place-items-center text-muted hover:text-ink"
          >
            <X className="size-4" aria-hidden />
          </button>
        </div>
      ))}
    </div>
  );
}
