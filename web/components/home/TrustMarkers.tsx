import { Compass, Headphones, ShieldCheck, Truck } from "lucide-react";
import { siteConfig } from "@/config/site";

const ICONS = { sourcing: ShieldCheck, curation: Compass, delivery: Truck, support: Headphones } as const;

export function TrustMarkers() {
  const items = siteConfig.trustMarkers.filter((t) => t.enabled);
  if (!items.length) return null;
  return (
    <section aria-label="Why AZMARO" className="border-b border-line-soft bg-bg-2">
      <ul className="az-container grid grid-cols-2 lg:grid-cols-4">
        {items.map((item, i) => {
          const Icon = ICONS[item.id as keyof typeof ICONS] ?? ShieldCheck;
          return (
            <li
              key={item.id}
              className={[
                "flex items-center gap-3 py-5 sm:justify-center sm:gap-4 lg:py-6",
                i % 2 === 1 ? "pl-4 sm:pl-0" : "",
                i > 0 ? "lg:border-l lg:border-line-soft" : "",
                i % 2 === 1 ? "border-l border-line-soft lg:border-l" : "",
                i > 1 ? "border-t border-line-soft lg:border-t-0" : "",
              ].join(" ")}
            >
              <Icon className="size-5 shrink-0 text-gold" strokeWidth={1.3} aria-hidden />
              <span className="text-[0.62rem] font-bold tracking-[0.2em] text-ink uppercase sm:text-[0.65rem]">
                <span className="mr-1.5 font-serif text-sm font-normal tracking-normal text-gold lg:hidden">0{i + 1}</span>
                {item.label}
              </span>
            </li>
          );
        })}
      </ul>
    </section>
  );
}
