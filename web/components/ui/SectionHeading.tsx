import Link from "next/link";
import { ArrowRight } from "lucide-react";
import { cn } from "@/lib/utils";

interface SectionHeadingProps {
  eyebrow?: string;
  title?: string;
  description?: string;
  action?: { label: string; href: string };
  as?: "h1" | "h2" | "h3";
  className?: string;
  ruled?: boolean;
  id?: string;
}

export function SectionHeading({
  eyebrow,
  title,
  description,
  action,
  as: Tag = "h2",
  className,
  ruled = true,
  id,
}: SectionHeadingProps) {
  return (
    <div className={cn("mb-6 sm:mb-8", className)}>
      <div className="flex items-end justify-between gap-6">
        <div className="min-w-0">
          {eyebrow && <p className="az-eyebrow mb-2">{eyebrow}</p>}
          {title && <Tag id={id} className={Tag === "h1" ? "az-h1" : "az-h2"}>{title}</Tag>}
          {description && <p className="mt-3 max-w-2xl text-sm text-ink-2 sm:text-[0.95rem]">{description}</p>}
        </div>
        {action && (
          <Link href={action.href} className="az-link group hidden shrink-0 items-center gap-2 sm:inline-flex">
            {action.label}
            <ArrowRight className="size-3.5 transition-transform duration-300 group-hover:translate-x-1" aria-hidden />
          </Link>
        )}
      </div>
      {ruled && <div className="az-rule mt-4" />}
    </div>
  );
}
