"use client";

import { X } from "lucide-react";
import { useEffect, useId, useRef } from "react";
import { createPortal } from "react-dom";
import { cn } from "@/lib/utils";
import { useHydrated } from "@/lib/store/persistent-store";

interface ModalProps {
  open: boolean;
  onClose: () => void;
  title: string;
  /** Visually hide the title (it is still announced to screen readers). */
  hideTitle?: boolean;
  placement?: "center" | "left" | "bottom" | "top";
  className?: string;
  children: React.ReactNode;
}

const FOCUSABLE =
  'a[href], button:not([disabled]), input:not([disabled]), select:not([disabled]), textarea:not([disabled]), [tabindex]:not([tabindex="-1"])';

/**
 * Accessible dialog: focus is moved in and trapped, Escape and backdrop close it,
 * background scroll is locked, and focus returns to the trigger on close.
 */
export function Modal({ open, onClose, title, hideTitle, placement = "center", className, children }: ModalProps) {
  const hydrated = useHydrated();
  const panelRef = useRef<HTMLDivElement>(null);
  const titleId = useId();
  const onCloseRef = useRef(onClose);

  useEffect(() => {
    onCloseRef.current = onClose;
  }, [onClose]);

  useEffect(() => {
    if (!open) return;
    const previouslyFocused = document.activeElement as HTMLElement | null;
    document.body.classList.add("az-scroll-locked");
    const panel = panelRef.current;
    const first = panel?.querySelector<HTMLElement>("[data-autofocus]") ?? panel?.querySelector<HTMLElement>(FOCUSABLE);
    first?.focus();

    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") {
        e.preventDefault();
        onCloseRef.current();
        return;
      }
      if (e.key !== "Tab" || !panel) return;
      const nodes = Array.from(panel.querySelectorAll<HTMLElement>(FOCUSABLE)).filter((n) => n.offsetParent !== null);
      if (!nodes.length) return;
      const firstNode = nodes[0]!;
      const lastNode = nodes[nodes.length - 1]!;
      if (e.shiftKey && document.activeElement === firstNode) {
        e.preventDefault();
        lastNode.focus();
      } else if (!e.shiftKey && document.activeElement === lastNode) {
        e.preventDefault();
        firstNode.focus();
      }
    };
    document.addEventListener("keydown", onKey);
    return () => {
      document.removeEventListener("keydown", onKey);
      document.body.classList.remove("az-scroll-locked");
      previouslyFocused?.focus?.();
    };
  }, [open]);

  if (!hydrated || !open) return null;

  return createPortal(
    <div className="fixed inset-0 z-[80]">
      <div className="az-anim-fade absolute inset-0 bg-black/75 backdrop-blur-[2px]" onClick={onClose} aria-hidden="true" />
      <div
        ref={panelRef}
        role="dialog"
        aria-modal="true"
        aria-labelledby={titleId}
        className={cn(
          "absolute flex flex-col border-line bg-bg-2 shadow-[0_30px_80px_-20px_rgba(0,0,0,0.9)]",
          placement === "center" &&
            "az-anim-rise top-1/2 left-1/2 max-h-[90dvh] w-[min(56rem,calc(100vw-2rem))] -translate-x-1/2 -translate-y-1/2 overflow-y-auto border",
          placement === "left" &&
            "az-anim-drawer inset-y-0 left-0 w-[min(24rem,88vw)] overflow-y-auto border-r",
          placement === "bottom" &&
            "az-anim-sheet inset-x-0 bottom-0 max-h-[92dvh] overflow-y-auto rounded-t-md border-t",
          placement === "top" && "az-anim-fade inset-x-0 top-0 max-h-[100dvh] overflow-y-auto border-b",
          className,
        )}
      >
        <div className={cn("flex items-center justify-between gap-4 px-5 pt-5 sm:px-7", hideTitle && "sr-only")}>
          <h2 id={titleId} className="font-serif text-2xl">
            {title}
          </h2>
        </div>
        <button
          type="button"
          onClick={onClose}
          aria-label="Close"
          className="absolute top-3.5 right-3.5 z-10 grid size-10 place-items-center text-ink-2 transition-colors hover:text-gold-light"
        >
          <X className="size-5" aria-hidden />
        </button>
        {children}
      </div>
    </div>,
    document.body,
  );
}
