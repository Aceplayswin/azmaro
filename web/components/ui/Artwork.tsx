import Image from "next/image";
import { cn, initials } from "@/lib/utils";
import type { ScentFamilyId } from "@/types/catalogue";

/**
 * Branded placeholders used wherever approved photography has not been supplied.
 * They are deliberately typographic / geometric – never a stand-in bottle image.
 */

const SHOW_SLOT_LABELS = process.env.NODE_ENV === "development";

function Arch({ className }: { className?: string }) {
  return (
    <svg viewBox="0 0 120 160" fill="none" aria-hidden="true" className={className}>
      <path
        d="M10 158V72C10 38 32 14 60 4C88 14 110 38 110 72V158"
        stroke="currentColor"
        strokeWidth="0.9"
        strokeOpacity="0.55"
      />
      <path
        d="M18 158V75C18 45 37 24 60 15C83 24 102 45 102 75V158"
        stroke="currentColor"
        strokeWidth="0.6"
        strokeOpacity="0.3"
      />
    </svg>
  );
}

export function Star8({ className }: { className?: string }) {
  return (
    <svg viewBox="0 0 100 100" fill="none" aria-hidden="true" className={className}>
      <rect x="21" y="21" width="58" height="58" stroke="currentColor" strokeWidth="0.8" />
      <rect x="21" y="21" width="58" height="58" stroke="currentColor" strokeWidth="0.8" transform="rotate(45 50 50)" />
      <circle cx="50" cy="50" r="15" stroke="currentColor" strokeWidth="0.6" strokeOpacity="0.7" />
      <circle cx="50" cy="50" r="2" fill="currentColor" />
    </svg>
  );
}

interface ProductArtworkProps {
  brandName: string;
  name: string;
  size?: "thumb" | "card" | "large";
  className?: string;
}

export function ProductArtwork({ brandName, name, size = "card", className }: ProductArtworkProps) {
  return (
    <div
      role="img"
      aria-label={`${brandName} ${name} – product photograph coming soon`}
      className={cn(
        "az-glow relative flex h-full w-full items-center justify-center overflow-hidden text-gold",
        className,
      )}
    >
      <div className="az-lattice absolute inset-0 opacity-60" aria-hidden="true" />
      <Arch
        className={cn(
          "absolute bottom-0 left-1/2 -translate-x-1/2",
          size === "thumb" ? "h-[86%]" : "h-[84%]",
        )}
      />
      <div className="relative flex flex-col items-center px-4 text-center" aria-hidden="true">
        <span
          className={cn(
            "font-serif leading-none text-gold-light",
            size === "thumb" ? "text-2xl" : size === "large" ? "text-7xl md:text-8xl" : "text-4xl sm:text-5xl",
          )}
        >
          {initials(name)}
        </span>
        {size !== "thumb" && (
          <>
            <span className="mt-3 block h-px w-10 bg-gold/50" />
            <span
              className={cn(
                "mt-3 max-w-[14rem] font-serif text-ink/80",
                size === "large" ? "text-xl" : "text-[0.8rem] leading-snug sm:text-sm",
              )}
            >
              {name}
            </span>
            <span className="mt-1.5 text-[0.55rem] font-bold tracking-[0.24em] text-gold/70 uppercase">
              {brandName}
            </span>
          </>
        )}
      </div>
      {SHOW_SLOT_LABELS && size === "large" && <SlotLabel>Real product photo · awaiting approval</SlotLabel>}
    </div>
  );
}

function SlotLabel({ children }: { children: React.ReactNode }) {
  return (
    <span className="absolute right-2 bottom-2 rounded-sm border border-line-soft bg-bg/70 px-2 py-0.5 text-[0.55rem] tracking-[0.14em] text-muted uppercase">
      {children}
    </span>
  );
}

export interface EditorialImage {
  src: string;
  alt: string;
  /** CSS object-position, e.g. "50% 35%". */
  position?: string;
}

interface EditorialArtworkProps {
  /** What real photography belongs here (shown only in development). */
  slot: string;
  motif?: "arch" | "star" | "wordmark" | "none";
  className?: string;
  children?: React.ReactNode;
  label?: string;
  /** Real photography. One image fills the slot; several are shown side by side. */
  images?: EditorialImage[];
  /** `sizes` hint for each photo. */
  sizes?: string;
  priority?: boolean;
}

/** Atmospheric campaign / editorial image slot. */
export function EditorialArtwork({ slot, motif = "arch", className, children, label, images, sizes = "100vw", priority }: EditorialArtworkProps) {
  const photos = images?.filter(Boolean) ?? [];
  if (photos.length) {
    return (
      <div className={cn("relative isolate overflow-hidden bg-bg", className)}>
        <div className="absolute inset-0 flex">
          {photos.map((img, i) => (
            <div key={img.src} className={cn("relative h-full flex-1", i > 0 && "border-l border-bg/80")}>
              <Image
                src={img.src}
                alt={img.alt}
                fill
                priority={priority && i < 2}
                sizes={sizes}
                className="object-cover"
                style={img.position ? { objectPosition: img.position } : undefined}
              />
            </div>
          ))}
        </div>
        {/* Keeps photography inside the black-and-gold palette and any overlaid text legible. */}
        <div className="pointer-events-none absolute inset-0 bg-[radial-gradient(ellipse_at_center,transparent_45%,rgba(10,8,6,0.55)_100%)]" />
        <div className="pointer-events-none absolute inset-x-0 bottom-0 h-1/3 bg-gradient-to-t from-bg/70 to-transparent" />
        {children}
      </div>
    );
  }
  return (
    <div
      role={label ? "img" : undefined}
      aria-label={label}
      aria-hidden={label ? undefined : true}
      className={cn("az-glow relative isolate overflow-hidden text-gold", className)}
    >
      <div className="az-lattice absolute inset-0 opacity-70" />
      <div className="absolute inset-0 bg-[radial-gradient(circle_at_50%_120%,rgba(233,202,142,0.18),transparent_55%)]" />
      {motif === "arch" && (
        <Arch className="absolute bottom-0 left-1/2 h-[88%] -translate-x-1/2 text-gold" />
      )}
      {motif === "star" && (
        <Star8 className="absolute top-1/2 left-1/2 h-[55%] max-h-72 -translate-x-1/2 -translate-y-1/2 text-gold/60" />
      )}
      {motif === "wordmark" && (
        <div className="absolute inset-0 flex items-center justify-center">
          <span className="az-wordmark text-3xl text-gold/70 sm:text-4xl">Azmaro</span>
        </div>
      )}
      {children}
      {SHOW_SLOT_LABELS && <SlotLabel>{slot}</SlotLabel>}
    </div>
  );
}

/** Line-art motif per scent family, used on discovery cards until editorial crops are supplied. */
export function ScentMotif({ family, className }: { family: ScentFamilyId; className?: string }) {
  const common = { fill: "none", stroke: "currentColor", strokeWidth: 0.9, strokeLinecap: "round" as const };
  return (
    <svg viewBox="0 0 120 120" aria-hidden="true" className={className}>
      {family === "oud-woods" && (
        <g {...common}>
          {[0, 1, 2, 3, 4].map((i) => (
            <path key={i} d={`M${18 + i * 4} ${30 + i * 13}C45 ${22 + i * 13} 75 ${40 + i * 13} ${102 - i * 4} ${30 + i * 13}`} strokeOpacity={0.9 - i * 0.12} />
          ))}
          <ellipse cx="60" cy="60" rx="9" ry="5" strokeOpacity="0.6" />
        </g>
      )}
      {family === "amber-gourmand" && (
        <g {...common}>
          <path d="M60 18C60 18 34 52 34 72a26 26 0 0 0 52 0C86 52 60 18 60 18Z" />
          <path d="M60 36C60 36 44 58 44 72a16 16 0 0 0 32 0" strokeOpacity="0.55" />
          <circle cx="52" cy="72" r="3" strokeOpacity="0.7" />
        </g>
      )}
      {family === "musk-clean" && (
        <g {...common}>
          {[10, 20, 30, 40].map((r, i) => (
            <circle key={r} cx="60" cy="60" r={r} strokeOpacity={0.9 - i * 0.18} />
          ))}
        </g>
      )}
      {family === "rose-floral" && (
        <g {...common}>
          {[0, 45, 90, 135, 180, 225, 270, 315].map((a) => (
            <ellipse key={a} cx="60" cy="38" rx="9" ry="22" transform={`rotate(${a} 60 60)`} strokeOpacity="0.7" />
          ))}
          <circle cx="60" cy="60" r="7" />
        </g>
      )}
      {family === "fresh-aromatic" && (
        <g {...common}>
          <path d="M60 100V30" strokeOpacity="0.7" />
          {[0, 1, 2, 3].map((i) => (
            <g key={i}>
              <path d={`M60 ${88 - i * 16}C48 ${84 - i * 16} 38 ${74 - i * 16} 36 ${62 - i * 16}C48 ${64 - i * 16} 56 ${72 - i * 16} 60 ${82 - i * 16}`} />
              <path d={`M60 ${88 - i * 16}C72 ${84 - i * 16} 82 ${74 - i * 16} 84 ${62 - i * 16}C72 ${64 - i * 16} 64 ${72 - i * 16} 60 ${82 - i * 16}`} />
            </g>
          ))}
        </g>
      )}
    </svg>
  );
}
