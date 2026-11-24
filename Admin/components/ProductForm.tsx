"use client";

import { useState } from "react";
import type { Brand, Category, Concentration, Gender, NoteBasis, Product } from "@/lib/types";
import { Field, Section, slugify, Toggle } from "./ui";

export interface ProductFormValues {
  name: string;
  slug: string;
  catalogueName: string;
  brandSlug: string;
  brandLabel: string;
  fragranceFamily: string;
  noteBasis: NoteBasis;
  topNotes: string;
  heartNotes: string;
  baseNotes: string;
  scentCharacter: string;
  description: string;
  occasions: string;
  season: string;
  targetAudience: string;
  gender: Gender | "";
  concentration: Concentration | "";
  concentrationNote: string;
  researchBasis: string;
  reviewNote: string;
  inventorySizeMl: string;
  isPublished: boolean;
  isFeatured: boolean;
  featuredRank: string;
  isNew: boolean;
  isBestseller: boolean;
  categorySlugs: string[];
}

export function toFormValues(p?: Product): ProductFormValues {
  return {
    name: p?.name ?? "",
    slug: p?.slug ?? "",
    catalogueName: p?.catalogueName ?? "",
    brandSlug: p?.brand.slug ?? "",
    brandLabel: p?.brandLabel ?? "",
    fragranceFamily: p?.fragranceFamily ?? "",
    noteBasis: p?.noteBasis ?? "PUBLISHED",
    topNotes: p?.topNotes ?? "",
    heartNotes: p?.heartNotes ?? "",
    baseNotes: p?.baseNotes ?? "",
    scentCharacter: p?.scentCharacter ?? "",
    description: p?.description ?? "",
    occasions: p?.occasions ?? "",
    season: p?.season ?? "",
    targetAudience: p?.targetAudience ?? "",
    gender: p?.gender ?? "",
    concentration: p?.concentration ?? "",
    concentrationNote: p?.concentrationNote ?? "",
    researchBasis: p?.researchBasis ?? "",
    reviewNote: p?.reviewNote ?? "",
    inventorySizeMl: p?.inventorySizeMl?.toString() ?? "",
    isPublished: p?.isPublished ?? false,
    isFeatured: p?.isFeatured ?? false,
    featuredRank: p?.featuredRank?.toString() ?? "",
    isNew: p?.isNew ?? false,
    isBestseller: p?.isBestseller ?? false,
    categorySlugs: p?.categories.map((c) => c.slug) ?? [],
  };
}

const orNull = (v: string) => (v.trim() ? v.trim() : null);
const intOrNull = (v: string) => (v.trim() ? Number(v) : null);

/** Request body for POST / PATCH /admin/products. */
export function toPayload(v: ProductFormValues) {
  return {
    name: v.name.trim(),
    slug: v.slug.trim(),
    catalogueName: v.catalogueName.trim() || undefined,
    brandSlug: v.brandSlug,
    brandLabel: v.brandLabel.trim() || undefined,
    fragranceFamily: v.fragranceFamily.trim(),
    noteBasis: v.noteBasis,
    topNotes: v.topNotes.trim(),
    heartNotes: v.heartNotes.trim(),
    baseNotes: v.baseNotes.trim(),
    scentCharacter: v.scentCharacter.trim(),
    description: orNull(v.description),
    occasions: v.occasions.trim(),
    season: v.season.trim(),
    targetAudience: orNull(v.targetAudience),
    gender: v.gender || null,
    concentration: v.concentration || null,
    concentrationNote: orNull(v.concentrationNote),
    researchBasis: orNull(v.researchBasis),
    reviewNote: orNull(v.reviewNote),
    inventorySizeMl: intOrNull(v.inventorySizeMl),
    isPublished: v.isPublished,
    isFeatured: v.isFeatured,
    featuredRank: v.isFeatured ? intOrNull(v.featuredRank) : null,
    isNew: v.isNew,
    isBestseller: v.isBestseller,
    categorySlugs: v.categorySlugs,
  };
}

interface Props {
  values: ProductFormValues;
  onChange: (v: ProductFormValues) => void;
  errors: Record<string, string>;
  brands: Brand[];
  categories: Category[];
  /** New products derive the slug from the name until it is edited by hand. */
  autoSlug?: boolean;
}

export function ProductForm({ values, onChange, errors, brands, categories, autoSlug = false }: Props) {
  const [slugTouched, setSlugTouched] = useState(!autoSlug);
  const set = <K extends keyof ProductFormValues>(key: K, value: ProductFormValues[K]) => onChange({ ...values, [key]: value });
  const text = (key: keyof ProductFormValues) => ({
    value: values[key] as string,
    "aria-invalid": Boolean(errors[key]) || undefined,
    onChange: (e: React.ChangeEvent<HTMLInputElement | HTMLTextAreaElement | HTMLSelectElement>) => set(key, e.target.value as never),
  });

  const families = categories.filter((c) => c.type === "SCENT_FAMILY");
  const collections = categories.filter((c) => c.type === "COLLECTION");
  const toggleCategory = (slug: string) =>
    set("categorySlugs", values.categorySlugs.includes(slug) ? values.categorySlugs.filter((s) => s !== slug) : [...values.categorySlugs, slug]);

  return (
    <div className="space-y-4">
      <Section title="Basics">
        <div className="grid gap-4 md:grid-cols-2">
          <Field label="Product name *" error={errors.name}>
            <input
              className="input"
              {...text("name")}
              onChange={(e) => onChange({ ...values, name: e.target.value, ...(slugTouched ? {} : { slug: slugify(e.target.value) }) })}
            />
          </Field>
          <Field label="URL slug *" error={errors.slug} hint="Used in the product link: /products/slug">
            <input
              className="input"
              {...text("slug")}
              onChange={(e) => {
                setSlugTouched(true);
                set("slug", slugify(e.target.value));
              }}
            />
          </Field>
          <Field label="Brand *" error={errors.brandSlug}>
            <select className="input" {...text("brandSlug")}>
              <option value="">Choose a brand…</option>
              {brands.map((b) => (
                <option key={b.id} value={b.slug}>{b.name}</option>
              ))}
            </select>
          </Field>
          <Field label="Brand line as printed" error={errors.brandLabel} hint='e.g. "Lattafa / Asdaaf" – defaults to the brand name'>
            <input className="input" {...text("brandLabel")} />
          </Field>
          <Field label="Catalogue / inventory name" error={errors.catalogueName} hint="Exactly as on the stock list – defaults to the product name" className="md:col-span-2">
            <input className="input" {...text("catalogueName")} />
          </Field>
        </div>
      </Section>

      <Section title="Scent profile">
        <div className="grid gap-4 md:grid-cols-2">
          <Field label="Fragrance family *" error={errors.fragranceFamily} hint='e.g. "Amber Vanilla"'>
            <input className="input" {...text("fragranceFamily")} />
          </Field>
          <Field label="Notes are…" error={errors.noteBasis}>
            <select className="input" {...text("noteBasis")}>
              <option value="PUBLISHED">Published by the brand (verified)</option>
              <option value="EDITORIAL_IMPRESSION">Our scent impression (not verified)</option>
            </select>
          </Field>
          <Field label="Top notes *" error={errors.topNotes}>
            <textarea className="input" rows={2} {...text("topNotes")} />
          </Field>
          <Field label="Heart notes *" error={errors.heartNotes}>
            <textarea className="input" rows={2} {...text("heartNotes")} />
          </Field>
          <Field label="Base notes *" error={errors.baseNotes}>
            <textarea className="input" rows={2} {...text("baseNotes")} />
          </Field>
          <Field label="Scent character *" error={errors.scentCharacter} hint="One or two lines shown on product cards">
            <textarea className="input" rows={2} {...text("scentCharacter")} />
          </Field>
          <Field label="Description" error={errors.description} className="md:col-span-2">
            <textarea className="input" rows={4} {...text("description")} />
          </Field>
        </div>
        {(families.length > 0 || collections.length > 0) && (
          <div className="mt-5">
            <p className="label">Scent families &amp; collections</p>
            <div className="flex flex-wrap gap-2">
              {[...families, ...collections].map((c) => {
                const on = values.categorySlugs.includes(c.slug);
                return (
                  <button
                    key={c.id}
                    type="button"
                    aria-pressed={on}
                    onClick={() => toggleCategory(c.slug)}
                    className={`badge cursor-pointer px-3 py-1.5 text-xs ${on ? "border-primary bg-primary/15 text-primary-hover" : "hover:text-ink"}`}
                  >
                    {c.name}
                    {c.type === "COLLECTION" && <span className="text-muted">· collection</span>}
                  </button>
                );
              })}
            </div>
            {errors.categorySlugs && <p className="mt-1 text-xs text-danger">{errors.categorySlugs}</p>}
          </div>
        )}
      </Section>

      <Section title="Details">
        <div className="grid gap-4 md:grid-cols-3">
          <Field label="Gender" error={errors.gender}>
            <select className="input" {...text("gender")}>
              <option value="">Not specified</option>
              <option value="MEN">Men</option>
              <option value="WOMEN">Women</option>
              <option value="UNISEX">Unisex</option>
            </select>
          </Field>
          <Field label="Concentration" error={errors.concentration}>
            <select className="input" {...text("concentration")}>
              <option value="">Not specified</option>
              <option value="EDP">Eau de Parfum</option>
              <option value="EXTRAIT">Extrait</option>
              <option value="EDT">Eau de Toilette</option>
              <option value="ATTAR">Attar</option>
            </select>
          </Field>
          <Field label="Bottle size on stock list (ml)" error={errors.inventorySizeMl}>
            <input className="input" type="number" min={1} {...text("inventorySizeMl")} />
          </Field>
          <Field label="Occasions *" error={errors.occasions} hint='e.g. "Evening, special occasions"'>
            <input className="input" {...text("occasions")} />
          </Field>
          <Field label="Season *" error={errors.season} hint='e.g. "Autumn, winter"'>
            <input className="input" {...text("season")} />
          </Field>
          <Field label="Target audience" error={errors.targetAudience}>
            <input className="input" {...text("targetAudience")} />
          </Field>
          <Field label="Concentration note" error={errors.concentrationNote} className="md:col-span-3">
            <input className="input" {...text("concentrationNote")} />
          </Field>
          <Field label="Research basis (internal)" error={errors.researchBasis} className="md:col-span-3">
            <textarea className="input" rows={2} {...text("researchBasis")} />
          </Field>
          <Field label="Review note (internal)" error={errors.reviewNote} hint="Things still to confirm, e.g. spelling on the box" className="md:col-span-3">
            <input className="input" {...text("reviewNote")} />
          </Field>
        </div>
      </Section>

      <Section title="Visibility" description="Hidden products don't appear anywhere on the storefront.">
        <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
          <Toggle label="Published on the store" checked={values.isPublished} onChange={(v) => set("isPublished", v)} />
          <Toggle label="New arrival" checked={values.isNew} onChange={(v) => set("isNew", v)} />
          <Toggle label="Bestseller" checked={values.isBestseller} onChange={(v) => set("isBestseller", v)} />
          <Toggle label="Featured on home page" checked={values.isFeatured} onChange={(v) => set("isFeatured", v)} />
        </div>
        {values.isFeatured && (
          <Field label="Featured position" error={errors.featuredRank} hint="Lower numbers show first" className="mt-4 max-w-48">
            <input className="input" type="number" min={0} {...text("featuredRank")} />
          </Field>
        )}
      </Section>
    </div>
  );
}
