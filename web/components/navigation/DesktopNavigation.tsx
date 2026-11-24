import Link from "next/link";
import { cn } from "@/lib/utils";
import { PRIMARY_NAV, isActive } from "./nav-links";

export function DesktopNavigation({ pathname }: { pathname: string }) {
  return (
    <nav aria-label="Primary" className="hidden lg:block">
      <ul className="flex items-center gap-6 xl:gap-10 2xl:gap-12">
        {PRIMARY_NAV.map((item) => {
          const active = isActive(pathname, item.href);
          return (
            <li key={item.href}>
              <Link
                href={item.href}
                aria-current={active ? "page" : undefined}
                className={cn(
                  "group relative py-2 text-[0.65rem] font-bold tracking-[0.16em] whitespace-nowrap uppercase transition-colors xl:tracking-[0.2em]",
                  active ? "text-gold" : "text-ink-2 hover:text-gold-light",
                )}
              >
                {item.label}
                <span
                  className={cn(
                    "absolute -bottom-0.5 left-0 h-px bg-gold transition-all duration-500",
                    active ? "w-full" : "w-0 group-hover:w-full",
                  )}
                />
              </Link>
            </li>
          );
        })}
      </ul>
    </nav>
  );
}
