import Link from "next/link";
import { Accordion } from "@/components/ui/Accordion";
import { SCENT_FAMILY_MAP } from "@/data/scent-families";
import { CONCENTRATION_LABELS } from "@/lib/catalogue/filter";
import type { Product } from "@/types/catalogue";

function Row({ label, value }: { label: string; value: React.ReactNode }) {
  return (
    <div className="grid grid-cols-[8.5rem_1fr] gap-4 border-b border-line-soft py-2.5 last:border-b-0 sm:grid-cols-[10rem_1fr]">
      <dt className="text-[0.65rem] font-bold tracking-[0.16em] text-muted uppercase">{label}</dt>
      <dd className="text-ink-2">{value}</dd>
    </div>
  );
}

/** Description, notes, details and shipping – only verified catalogue data, clearly labelled. */
export function ProductInfo({ product }: { product: Product }) {
  const isImpression = product.noteBasis === "editorial-impression";

  const notes = (
    <div>
      {isImpression && (
        <p className="mb-4 border-l-2 border-gold/60 pl-3 text-xs leading-relaxed text-muted">
          Scent impression – the brand has not published a verified note pyramid for this exact product, so these
          describe the overall direction rather than specific ingredients. Please confirm with a tester.
        </p>
      )}
      <dl>
        <Row label={isImpression ? "Opening" : "Top notes"} value={product.topNotes} />
        <Row label={isImpression ? "Heart" : "Heart notes"} value={product.heartNotes} />
        <Row label={isImpression ? "Dry-down" : "Base notes"} value={product.baseNotes} />
      </dl>
    </div>
  );

  const details = (
    <dl>
      <Row label="Brand" value={product.brandLabel} />
      <Row label="Fragrance family" value={product.fragranceFamily} />
      <Row label="Scent family" value={product.scentFamilies.map((f) => SCENT_FAMILY_MAP[f].label).join(", ")} />
      <Row
        label="Concentration"
        value={product.concentration ? CONCENTRATION_LABELS[product.concentration] : <span className="text-muted">To be confirmed from packaging</span>}
      />
      <Row label="Audience" value={product.targetAudience ?? <span className="text-muted">To be confirmed from packaging</span>} />
      {product.availableSizes.length > 0 && <Row label="Size" value={product.availableSizes.map((s) => `${s} ml`).join(" / ")} />}
      <Row label="Occasions" value={product.occasions} />
      <Row label="Season" value={product.season} />
    </dl>
  );

  return (
    <Accordion
      items={[
        {
          id: "description",
          title: "Description",
          defaultOpen: true,
          content: (
            <div className="space-y-3">
              {product.description ? (
                <p>{product.description}</p>
              ) : (
                <>
                  <p>
                    <span className="text-ink">Scent direction: </span>
                    {product.scentCharacter}
                  </p>
                  <p>A full, verified product description for {product.name} is awaiting approval.</p>
                </>
              )}
              <p className="text-xs text-muted">
                Suggested for: {product.occasions.toLowerCase()}. Best season: {product.season.toLowerCase()}. Occasion and
                season notes are editorial guidance.
              </p>
            </div>
          ),
        },
        { id: "notes", title: isImpression ? "Scent impression" : "Fragrance notes", content: notes },
        { id: "details", title: "Details & origin", content: details },
        {
          id: "shipping",
          title: "Shipping & returns",
          content: (
            <div className="space-y-3">
              <p>
                Delivery charges, serviceability and timelines are confirmed by our courier partner for your PIN code at
                checkout.
              </p>
              <p>
                Our full shipping and returns policy is being finalised. For any question about this fragrance or an order,{" "}
                <Link href="/contact" className="text-gold underline-offset-4 hover:underline">
                  contact our team
                </Link>
                .
              </p>
            </div>
          ),
        },
      ]}
    />
  );
}
