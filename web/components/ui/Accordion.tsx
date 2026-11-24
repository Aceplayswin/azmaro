import { Plus } from "lucide-react";
import { cn } from "@/lib/utils";

interface AccordionItem {
  id: string;
  title: string;
  content: React.ReactNode;
  defaultOpen?: boolean;
}

/**
 * Accessible accordion built on native <details>/<summary>: keyboard and
 * screen-reader support for free, works without JavaScript.
 */
export function Accordion({
  items,
  className,
  variant = "rule",
}: {
  items: AccordionItem[];
  className?: string;
  variant?: "rule" | "boxed";
}) {
  return (
    <div className={cn(variant === "rule" ? "border-t border-line-soft" : "grid gap-3", className)}>
      {items.map((item) => (
        <details
          key={item.id}
          open={item.defaultOpen}
          className={cn(
            "group",
            variant === "rule" ? "border-b border-line-soft" : "az-panel transition-colors open:border-line",
          )}
        >
          <summary
            className={cn(
              "flex cursor-pointer list-none items-center justify-between gap-4 text-sm tracking-[0.04em] text-ink transition-colors hover:text-gold-light [&::-webkit-details-marker]:hidden",
              variant === "rule" ? "py-5" : "px-5 py-4",
            )}
          >
            <span>{item.title}</span>
            <Plus
              className="size-4 shrink-0 text-gold transition-transform duration-300 group-open:rotate-45"
              aria-hidden
            />
          </summary>
          <div
            className={cn(
              "az-anim-fade text-sm leading-relaxed text-ink-2",
              variant === "rule" ? "pb-6" : "px-5 pb-5",
            )}
          >
            {item.content}
          </div>
        </details>
      ))}
    </div>
  );
}
