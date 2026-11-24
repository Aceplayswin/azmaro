import { Info, LoaderCircle } from "lucide-react";
import { Star8 } from "./Artwork";
import { cn } from "@/lib/utils";

export function EmptyState({
  title,
  description,
  children,
  className,
}: {
  title: string;
  description?: string;
  children?: React.ReactNode;
  className?: string;
}) {
  return (
    <div className={cn("flex flex-col items-center px-4 py-16 text-center sm:py-24", className)}>
      <Star8 className="mb-6 size-16 text-gold/60" />
      <h2 className="az-h2">{title}</h2>
      {description && <p className="mt-3 max-w-md text-sm text-ink-2">{description}</p>}
      {children && <div className="mt-8 flex flex-wrap justify-center gap-3">{children}</div>}
    </div>
  );
}

export function LoadingState({ label = "Loading", className }: { label?: string; className?: string }) {
  return (
    <div role="status" className={cn("flex items-center justify-center gap-3 py-10 text-sm text-ink-2", className)}>
      <LoaderCircle className="size-4 animate-spin text-gold" aria-hidden />
      {label}…
    </div>
  );
}

/** Honest status banner for integrations that are not yet connected, or demo mode. */
export function Notice({
  children,
  tone = "info",
  className,
  title,
}: {
  children: React.ReactNode;
  tone?: "info" | "demo" | "error" | "success";
  className?: string;
  title?: string;
}) {
  return (
    <div
      role={tone === "error" ? "alert" : "status"}
      className={cn(
        "flex gap-3 border px-4 py-3 text-[0.8125rem] leading-relaxed",
        tone === "info" && "border-line-soft bg-card text-ink-2",
        tone === "demo" && "border-gold/40 bg-gold/[0.06] text-ink-2",
        tone === "error" && "border-danger/50 bg-danger/[0.07] text-ink",
        tone === "success" && "border-success/50 bg-success/[0.07] text-ink",
        className,
      )}
    >
      <Info
        className={cn("mt-0.5 size-4 shrink-0", tone === "error" ? "text-danger" : tone === "success" ? "text-success" : "text-gold")}
        aria-hidden
      />
      <div>
        {title && <p className="az-label mb-1 text-gold">{title}</p>}
        {children}
      </div>
    </div>
  );
}
