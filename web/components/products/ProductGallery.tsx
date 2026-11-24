"use client";

import Image from "next/image";
import { useState } from "react";
import { ProductArtwork } from "@/components/ui/Artwork";
import type { ProductImage } from "@/types/catalogue";
import { cn } from "@/lib/utils";

/** Main image + thumbnails with a subtle hover zoom. Falls back to branded artwork. */
export function ProductGallery({ images, brandName, name }: { images: ProductImage[]; brandName: string; name: string }) {
  const [active, setActive] = useState(0);
  const [zoom, setZoom] = useState<{ x: number; y: number } | null>(null);
  const current = images[active];

  return (
    <div>
      <div
        className="relative aspect-[4/5] overflow-hidden border border-line-soft bg-card sm:aspect-square lg:aspect-[4/5]"
        onMouseMove={(e) => {
          if (!current) return;
          const r = e.currentTarget.getBoundingClientRect();
          setZoom({ x: ((e.clientX - r.left) / r.width) * 100, y: ((e.clientY - r.top) / r.height) * 100 });
        }}
        onMouseLeave={() => setZoom(null)}
      >
        {current ? (
          <Image
            src={current.src}
            alt={current.alt}
            fill
            priority
            sizes="(min-width: 768px) 50vw, 100vw"
            className="object-cover transition-transform duration-300"
            style={zoom ? { transform: "scale(1.6)", transformOrigin: `${zoom.x}% ${zoom.y}%` } : undefined}
          />
        ) : (
          <ProductArtwork brandName={brandName} name={name} size="large" />
        )}
      </div>

      {images.length > 1 && (
        <ul className="mt-3 grid grid-cols-4 gap-3" aria-label="Product images">
          {images.map((img, i) => (
            <li key={img.src}>
              <button
                type="button"
                onClick={() => setActive(i)}
                aria-label={`Show image ${i + 1} of ${images.length}`}
                aria-current={i === active}
                className={cn(
                  "relative block aspect-square w-full overflow-hidden border transition-colors",
                  i === active ? "border-gold" : "border-line-soft hover:border-line",
                )}
              >
                <Image src={img.src} alt="" fill sizes="120px" className="object-cover" />
              </button>
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}
