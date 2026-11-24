/**
 * AZMARO canonical product profiles.
 *
 * Source: AZMARO_Website_Perfume_Catalogue_Final.pdf (2026 edition, 94 profiles).
 * Order follows the catalogue. Wording of notes, character, occasions and
 * seasons is taken from the catalogue. `scentFamilies` is AZMARO's storefront
 * discovery grouping, derived from the catalogue's fragrance-family line.
 *
 * Profiles marked `editorial-impression` do NOT have a verified note pyramid.
 * Their opening / heart / dry-down text is a scent impression and must be
 * labelled as such in the UI.
 */
import type { CatalogueEntry, Concentration, Gender, ScentFamilyId } from "./types";

type ImpressionKind = "aromatic" | "fresh" | "floral" | "warm" | "sweet";

const IMPRESSIONS: Record<
  ImpressionKind,
  Pick<
    CatalogueEntry,
    "fragranceFamily" | "topNotes" | "heartNotes" | "baseNotes" | "scentCharacter" | "occasions" | "season" | "scentFamilies"
  >
> = {
  aromatic: {
    fragranceFamily: "Aromatic / blended fragrance (editorial category)",
    topNotes: "Citrus and fresh aromatic accords",
    heartNotes: "Airy aromatic and watery accords",
    baseNotes: "Musk and clean woods",
    scentCharacter: "Fresh, clean and versatile",
    occasions: "Office, daytime and casual outings",
    season: "Year-round, subject to personal preference",
    scentFamilies: ["fresh-aromatic", "musk-clean"],
  },
  fresh: {
    fragranceFamily: "Fresh / aquatic-leaning (editorial category)",
    topNotes: "Citrus and fresh aromatic accords",
    heartNotes: "Airy aromatic and watery accords",
    baseNotes: "Musk and clean woods",
    scentCharacter: "A fresher, lighter direction is suggested by the product naming; exact notes are not confirmed.",
    occasions: "Office, daytime and casual outings",
    season: "Spring and summer",
    scentFamilies: ["fresh-aromatic"],
  },
  floral: {
    fragranceFamily: "Floral / fruity-floral (editorial category)",
    topNotes: "Fruity and fresh accords",
    heartNotes: "Floral and soft sweet accords",
    baseNotes: "Musk and smooth woods",
    scentCharacter:
      "A floral-led direction is suggested by the product naming or range; confirm the exact scent profile with a tester.",
    occasions: "Daywear, brunch, dates and social occasions",
    season: "Spring and mild autumn weather",
    scentFamilies: ["rose-floral"],
  },
  warm: {
    fragranceFamily: "Warm woody / amber-leaning (editorial category)",
    topNotes: "Warm spice and aromatic accords",
    heartNotes: "Woody, amber and resinous accords",
    baseNotes: "Musk and deep smooth woods",
    scentCharacter:
      "Likely positioned in a richer, warmer fragrance style; exact accords depend on the specific release.",
    occasions: "Evenings, dinners and formal occasions",
    season: "Autumn and winter",
    scentFamilies: ["oud-woods", "amber-gourmand"],
  },
  sweet: {
    fragranceFamily: "Sweet / gourmand-leaning (editorial category)",
    topNotes: "Sweet and aromatic accords",
    heartNotes: "Creamy gourmand and warm accords",
    baseNotes: "Vanilla-like sweetness, musk and woods",
    scentCharacter: "A sweet or gourmand direction is suggested by the name; the detailed note pyramid is not confirmed.",
    occasions: "Dates, evenings and special occasions",
    season: "Autumn and winter; use lightly in warm weather",
    scentFamilies: ["amber-gourmand"],
  },
};

const UNCONFIRMED_CONCENTRATION = "Check bottle/box; public listings vary or omit concentration";
const UNCONFIRMED_BASIS =
  "No reliable exact-match note pyramid confirmed in the sources checked; verify the exact variant and packaging.";

interface Base {
  slug: string;
  name: string;
  catalogueName: string;
  brandId: string;
  brandLabel: string;
  size?: number | null;
  reviewNote?: string | null;
}

/** Profile without a verified pyramid – uses the catalogue's editorial impression wording. */
function impression(base: Base, kind: ImpressionKind): CatalogueEntry {
  return {
    slug: base.slug,
    name: base.name,
    catalogueName: base.catalogueName,
    brandId: base.brandId,
    brandLabel: base.brandLabel,
    inventorySizeMl: base.size ?? null,
    ...IMPRESSIONS[kind],
    noteBasis: "editorial-impression",
    description: null,
    targetAudience: null,
    gender: null,
    concentration: null,
    concentrationNote: UNCONFIRMED_CONCENTRATION,
    researchBasis: UNCONFIRMED_BASIS,
    reviewNote: base.reviewNote ?? null,
  };
}

interface Published extends Base {
  family: string;
  scent: ScentFamilyId[];
  top: string;
  heart: string;
  base: string;
  character: string;
  description: string;
  occasions: string;
  season: string;
  audience: string | null;
  gender: Gender | null;
  concentration: Concentration | null;
  concentrationNote?: string | null;
  research: string;
}

/** Profile with a published note pyramid cited in the catalogue. */
function published(p: Published): CatalogueEntry {
  return {
    slug: p.slug,
    name: p.name,
    catalogueName: p.catalogueName,
    brandId: p.brandId,
    brandLabel: p.brandLabel,
    inventorySizeMl: p.size ?? null,
    fragranceFamily: p.family,
    scentFamilies: p.scent,
    noteBasis: "published",
    topNotes: p.top,
    heartNotes: p.heart,
    baseNotes: p.base,
    scentCharacter: p.character,
    description: p.description,
    occasions: p.occasions,
    season: p.season,
    targetAudience: p.audience,
    gender: p.gender,
    concentration: p.concentration,
    concentrationNote: p.concentrationNote ?? null,
    researchBasis: p.research,
    reviewNote: p.reviewNote ?? null,
  };
}

const L = { brandId: "lattafa", brandLabel: "Lattafa" };
const LA = { brandId: "lattafa", brandLabel: "Lattafa / Asdaaf" };
const AS = { brandId: "asdaaf", brandLabel: "Asdaaf" };
const AR = { brandId: "armaf", brandLabel: "Armaf" };
const AH = { brandId: "al-haramain", brandLabel: "Al Haramain" };
const RA = { brandId: "rasasi", brandLabel: "Rasasi" };
const IQ = { brandId: "ibrahim-al-qurashi", brandLabel: "Ibrahim Al Qurashi" };
const MA = { brandId: "maison-asrar", brandLabel: "Maison Asrar" };
const FA = { brandId: "french-avenue", brandLabel: "French Avenue" };
const LU = { brandId: "luscious", brandLabel: "Luscious" };
const AX = { brandId: "aromatix", brandLabel: "Aromatix" };
const ZI = { brandId: "zimaya", brandLabel: "Zimaya" };
const AZ = { brandId: "ard-al-zaafaran", brandLabel: "Ard Al Zaafaran" };
const MH = { brandId: "maison-alhambra", brandLabel: "Maison Alhambra" };
const AF = { brandId: "afnan", brandLabel: "Afnan" };
const RY = { brandId: "rayhaan", brandLabel: "Rayhaan" };

const DAY_SOCIAL = "Daywear, brunch, dates and social occasions";
const DATES_EVENINGS = "Dates, evenings and special occasions";
const EVENING_FORMAL = "Evenings, dinners and formal occasions";
const OFFICE_DAY = "Office, daytime and casual outings";

export const CATALOGUE: CatalogueEntry[] = [
  impression({ slug: "ameerat-al-arab-red-lt", name: "Ameerat Al Arab Red LT", catalogueName: "Ameerat Al Arab Red LT", ...LA }, "aromatic"),
  published({
    slug: "ameerat-al-arab-prive-rose", name: "Ameerat Al Arab Privé Rose", catalogueName: "Ameerat Al Arab Prive Rose 100ml", ...LA, size: 100,
    family: "Floral fruity", scent: ["rose-floral"],
    top: "Strawberry, grapes, orange",
    heart: "Rose, white musk, gardenia, jasmine, lily, ylang-ylang",
    base: "Tonka bean, amber, sandalwood",
    character: "Fruity opening with a rich rose-and-white-floral heart and a warm, creamy finish",
    description: "A bright fruit-led opening gives way to a lush floral bouquet. Tonka, amber and sandalwood soften the dry-down with a warm, elegant sweetness.",
    occasions: DAY_SOCIAL, season: "Spring and autumn", audience: "Women", gender: "women", concentration: "EDP",
    research: "Lattafa official product page; cross-checked against FragrancesDB.",
  }),
  published({
    slug: "khamrah-qahwa", name: "Khamrah Qahwa", catalogueName: "Khamrah Qahwa 100ml", ...L, size: 100,
    family: "Gourmand, spicy amber", scent: ["amber-gourmand"],
    top: "Ginger, cinnamon, cardamom",
    heart: "Praline, candied fruits, white flowers",
    base: "Arabica coffee, tonka bean, musk, benzoin, vanilla",
    character: "Sweet, spicy, coffee-rich, warm and indulgent",
    description: "A rich gourmand fragrance that layers aromatic spices over a sweet praline-and-fruit heart. Roasted coffee, tonka, benzoin and vanilla create a deep, comforting finish.",
    occasions: DATES_EVENINGS, season: "Autumn and winter", audience: "Unisex", gender: "unisex", concentration: "EDP",
    research: "Catalogue's cited retailer research; note profile retained and occasion/season guidance added editorially.",
  }),
  published({
    slug: "nebras-elixir", name: "Nebras Elixir", catalogueName: "Nebras Elixir", ...L,
    family: "Oriental vanilla / gourmand", scent: ["amber-gourmand"],
    top: "Milk candy, whipped cream",
    heart: "Sugar cane, heliotrope",
    base: "Vanilla, ambroxan, musk",
    character: "Creamy, sweet, powdery and softly musky",
    description: "A dessert-like creamy opening moves into soft heliotrope and sugar cane. Vanilla, ambroxan and musk leave a smooth, sweet and powdery trail.",
    occasions: DATES_EVENINGS, season: "Autumn and winter; use lightly in warm weather", audience: "Unisex", gender: "unisex", concentration: "EDP",
    research: "Lattafa official product page; Fragrantica listing.",
  }),
  published({
    slug: "yara-moi", name: "Yara Moi", catalogueName: "Yara Moi Lattafa", ...L,
    family: "Floral, fruity, creamy woody", scent: ["rose-floral"],
    top: "Pear, pink pepper, blackcurrant",
    heart: "Tuberose, jasmine, almond",
    base: "Vanilla, cashmeran, patchouli",
    character: "Softly fruity, creamy floral, warm and feminine",
    description: "Juicy pear and blackcurrant meet a creamy white-floral heart. Almond adds a soft gourmand nuance, while vanilla, cashmeran and patchouli create a warm, polished finish.",
    occasions: DAY_SOCIAL, season: "Autumn, winter and mild spring days", audience: "Women", gender: "women", concentration: "EDP",
    research: "Lattafa official product page; Lattafa India product page.",
  }),
  published({
    slug: "yara-tous-lt", name: "Yara Tous LT", catalogueName: "Yara Tous LT", ...L,
    family: "Tropical fruity floral", scent: ["rose-floral"],
    top: "Coconut, mango, passionfruit",
    heart: "Jasmine, heliotrope, orange blossom",
    base: "Cashmeran, vanilla, musk",
    character: "Tropical, creamy, fruity, floral and sweet",
    description: "A tropical fruit accord of mango, coconut and passionfruit leads into a soft floral heart. Vanilla, musk and cashmeran round it out with a creamy finish.",
    occasions: DAY_SOCIAL, season: "Spring and summer", audience: "Women", gender: "women", concentration: "EDP",
    research: "Lattafa official Yara collection page.",
  }),
  published({
    slug: "ameer-al-oud-intense", name: "Ameer Al Oud Intense", catalogueName: "Ameer Al Oud Intense", ...L,
    family: "Woody amber / oud gourmand", scent: ["oud-woods", "amber-gourmand"],
    top: "Saffron, nutmeg",
    heart: "Geranium, woody notes, labdanum",
    base: "Oud, vanilla, leather",
    character: "Rich, resinous, spicy, smoky-woody and sweet",
    description: "A bold oud composition opening with saffron and nutmeg. Resinous labdanum and woods deepen the heart before oud, leather and vanilla create a warm, luxurious finish.",
    occasions: DATES_EVENINGS, season: "Autumn and winter", audience: "Unisex", gender: "unisex", concentration: "EDP",
    research: "Lattafa India official product page.",
  }),
  impression({ slug: "ajwad-pink", name: "Ajwad Pink", catalogueName: "Ajwad Pink 60ml", ...L, size: 60 }, "floral"),
  impression({ slug: "ramz-gold", name: "Ramz Gold", catalogueName: "Ramz Gold 100ml", ...L, size: 100 }, "warm"),
  impression({ slug: "velvet-rose", name: "Velvet Rose", catalogueName: "Velvet Rose", ...L }, "floral"),
  impression({ slug: "mayar-cherry-intense", name: "Mayar Cherry Intense", catalogueName: "Mayar Cherry Intense", ...L }, "warm"),
  impression({ slug: "jasoor", name: "Jasoor", catalogueName: "Jasoor", ...L }, "aromatic"),
  impression({ slug: "oud-mood-elixir", name: "Oud Mood Elixir", catalogueName: "Oud Mood Elixir", ...L }, "warm"),
  impression({ slug: "dirham-oud", name: "Dirham Oud", catalogueName: "Dirham Oud 100ml", ...L, size: 100 }, "warm"),
  impression({ slug: "andaleeb", name: "Andaleeb", catalogueName: "Andaleeb Asdaaf", ...AS }, "aromatic"),
  impression({ slug: "ana-abiyad-coral", name: "Ana Abiyad Coral", catalogueName: "Ana Abiyad Coral", ...L }, "aromatic"),
  impression(
    { slug: "ana-abiyath-scarlet", name: "Ana Abiyath Scarlet", catalogueName: "Ana Abiyath Scarlet", ...L, reviewNote: "Spelling differs from 'Ana Abiyad' – confirm against the box." },
    "aromatic",
  ),
  impression({ slug: "fire-on-ice", name: "Fire On Ice", catalogueName: "Fire On Ice", ...L }, "fresh"),
  impression({ slug: "dynasty", name: "Dynasty", catalogueName: "Dynasty", ...L }, "aromatic"),
  impression({ slug: "arabian-sky", name: "Arabian Sky", catalogueName: "Armaf Arabian Sky", ...AR }, "fresh"),
  published({
    slug: "club-de-nuit-urban-man-elixir", name: "Club De Nuit Urban Man Elixir", catalogueName: "Club De Nuit Urban Man Elixir", ...AR,
    family: "Amber aromatic", scent: ["fresh-aromatic", "amber-gourmand"],
    top: "Bergamot, pink pepper, orange blossom, jasmine",
    heart: "Lavender, tagetes, geranium, vetiver, elemi, saffron",
    base: "Ambroxan, amber, patchouli, cedar, labdanum",
    character: "Fresh-spicy opening with aromatic florals and a warm amber-woody base",
    description: "Citrus and pepper introduce a complex aromatic heart of lavender, geranium and vetiver. Ambroxan, amber, cedar and labdanum give the dry-down depth and presence.",
    occasions: OFFICE_DAY, season: "Autumn and winter; versatile in moderate weather", audience: "Men", gender: "men", concentration: "EDP",
    research: "Armaf official product page.",
  }),
  published({
    slug: "club-de-nuit-untold", name: "Club De Nuit Untold", catalogueName: "Club De Nuit Untold 105ml", ...AR, size: 105,
    family: "Amber woody", scent: ["amber-gourmand", "oud-woods"],
    top: "Saffron, jasmine",
    heart: "Amberwood, ambergris",
    base: "Fir resin, cedar",
    character: "Airy amber, woody, warm and modern",
    description: "Saffron and jasmine introduce a radiant amberwood heart. Fir resin and cedar bring a dry, resinous finish that balances the smooth amber character.",
    occasions: EVENING_FORMAL, season: "Autumn, winter and cooler evenings", audience: "Unisex", gender: "unisex", concentration: "EDP",
    research: "Catalogue research citing Aar Fragrances and Intense Oud.",
  }),
  published({
    slug: "club-de-nuit-maleka", name: "Club De Nuit Maleka", catalogueName: "Club De Nuit Maleka", ...AR,
    family: "Floral fruity amber", scent: ["rose-floral"],
    top: "Lychee, bergamot, pink pepper",
    heart: "Orris",
    base: "Praline, ambroxan, sandalwood",
    character: "Fruity, powdery, creamy, softly sweet and woody",
    description: "Juicy lychee and bright bergamot lead into an elegant powdery orris heart. Praline, ambroxan and sandalwood give the fragrance a smooth, sweet-woody finish.",
    occasions: DAY_SOCIAL, season: "Spring and autumn", audience: "Women", gender: "women", concentration: "EDP",
    research: "Fragrantica; corroborated by Armaf's product-family information.",
  }),
  published({
    slug: "club-de-nuit-sillage", name: "Club De Nuit Sillage", catalogueName: "Club De Nuit Sillage 105ml", ...AR, size: 105,
    family: "Fresh woody / citrus", scent: ["fresh-aromatic", "musk-clean"],
    top: "Bergamot, lemon, lime, blackcurrant, violet leaf",
    heart: "Rose, iris, jasmine",
    base: "Musk, ambroxan, sandalwood, cedarwood",
    character: "Fresh, metallic-citrus, floral and woody",
    description: "A crisp citrus opening develops into a cool floral heart, supported by a clean musky-woody base. A versatile option for daytime wear.",
    occasions: OFFICE_DAY, season: "Spring and summer", audience: "Unisex", gender: "unisex", concentration: "EDP",
    research: "Armaf product-family listings and fragrance databases; exact note presentation varies by retailer.",
  }),
  impression({ slug: "club-de-nuit-women", name: "Club De Nuit Women", catalogueName: "Club De Nuit Women 105ml", ...AR, size: 105 }, "aromatic"),
  impression({ slug: "club-de-nuit-intense-women", name: "Club De Nuit Intense Women", catalogueName: "Club De Nuit Intense Women", ...AR }, "warm"),
  impression({ slug: "odyssey-spectra", name: "Odyssey Spectra", catalogueName: "Odyssey Spectra", ...AR }, "aromatic"),
  impression({ slug: "odyssey-aqua", name: "Odyssey Aqua", catalogueName: "Odyssey Aqua", ...AR }, "fresh"),
  impression({ slug: "odyssey-dubai-chocolate", name: "Odyssey Dubai Chocolate", catalogueName: "Odyssey Dubai Chocolate", ...AR }, "aromatic"),
  impression({ slug: "island-bliss", name: "Island Bliss", catalogueName: "Island Bliss", ...AR }, "aromatic"),
  published({
    slug: "island-breeze", name: "Island Breeze", catalogueName: "Island Breeze", ...AR,
    family: "Fruity floral amber musk", scent: ["rose-floral", "musk-clean"],
    top: "Pink peach, bergamot, wild berries",
    heart: "Rose, davana, vanilla",
    base: "White musk, floral musk, powdery notes, amber",
    character: "Tropical, airy, fruity, floral and softly warm",
    description: "Juicy peach, bergamot and wild berries create a bright opening. Rose and davana add a floral-fruity heart, while vanilla, musk and amber give a soft powdery finish.",
    occasions: DAY_SOCIAL, season: "Spring and summer", audience: "Unisex", gender: "unisex", concentration: "EDP",
    research: "Armaf official UAE product listing.",
  }),
  published({
    slug: "amber-oud-gold", name: "Amber Oud Gold", catalogueName: "Amber Oud Gold 120ml", ...AH, size: 120,
    family: "Amber vanilla / fruity sweet", scent: ["amber-gourmand"],
    top: "Bergamot, green notes",
    heart: "Melon, sweet notes, pineapple, amber",
    base: "Musk, vanilla, woody notes",
    character: "Fruity, sweet, musky and warm",
    description: "Bright citrus and green notes open into juicy melon and pineapple with a warm amber centre. Vanilla, musk and woods create a smooth, sweet finish.",
    occasions: DAY_SOCIAL, season: "Spring and summer evenings; moderate year-round use", audience: "Unisex", gender: "unisex", concentration: "EDP",
    research: "Al Haramain product information; catalogue research cites Perfume Network and Kiwla.",
    reviewNote: "Confirm the 120ml size against the bottle.",
  }),
  published({
    slug: "amber-oud-ruby-edition", name: "Amber Oud Ruby Edition", catalogueName: "Amber Oud Ruby Edition", ...AH,
    family: "Woody floral amber", scent: ["oud-woods", "amber-gourmand"],
    top: "Bitter almond, saffron",
    heart: "Egyptian jasmine, cedarwood",
    base: "Ambergris, woody notes, musk",
    character: "Warm spicy, almond-like, woody, musky and elegant",
    description: "Bitter almond and saffron create a distinctive opening, followed by jasmine and cedarwood. Ambergris, woods and musk form a warm, smooth and refined base.",
    occasions: DAY_SOCIAL, season: "Autumn and spring; cooler evenings", audience: "Unisex", gender: "unisex", concentration: "EDP",
    research: "Al Haramain official product page; Fragrantica.",
  }),
  published({
    slug: "amber-oud-future-dubai", name: "Amber Oud Future Dubai", catalogueName: "Amber Oud Future Dubai", ...AH,
    family: "Sweet fruity floral", scent: ["rose-floral"],
    top: "Bergamot, mandarin, mango, plum",
    heart: "Orange blossom, pink lotus, styrax",
    base: "Moss, patchouli, white musk",
    character: "Creamy fruity, sweet, floral and softly earthy",
    description: "A tropical fruit opening blends into a floral heart with a balsamic nuance. Moss, patchouli and white musk provide a soft earthy finish.",
    occasions: DAY_SOCIAL, season: "Spring and summer evenings; year-round in moderation", audience: "Unisex", gender: "unisex", concentration: "Extrait",
    research: "Parfumo fragrance profile.",
  }),
  published({
    slug: "amber-oud-imagine-dubai", name: "Amber Oud Imagine Dubai", catalogueName: "Amber Oud Imagine Dubai", ...AH,
    family: "Sweet floral gourmand", scent: ["rose-floral", "amber-gourmand"],
    top: "Neroli, bergamot, pink pepper, coriander",
    heart: "Orange blossom, honeysuckle, jasmine, iris, marshmallow, rose",
    base: "Sugar, vanilla, caramel, musk, civet, labdanum",
    character: "Sweet, floral, creamy, gourmand and warm",
    description: "Citrus, neroli and pink pepper open into a generous floral bouquet. Marshmallow, caramel, vanilla and musk create a sweet, creamy and enveloping dry-down.",
    occasions: DAY_SOCIAL, season: "Autumn and winter; spring evenings", audience: "Unisex", gender: "unisex", concentration: "Extrait",
    research: "Al Haramain official product page; Parfumo.",
  }),
  impression({ slug: "raqm-musk", name: "Raqm Musk", catalogueName: "Raqm Musk", ...AH }, "aromatic"),
  impression({ slug: "hawas-rough", name: "Hawas Rough", catalogueName: "Hawas Rough", ...RA }, "aromatic"),
  impression({ slug: "shuhrah-men", name: "Shuhrah Men", catalogueName: "Shuhrah Men", ...RA }, "aromatic"),
  impression({ slug: "hawas-lava-gold", name: "Hawas Lava Gold", catalogueName: "Hawas Lava Gold", ...RA }, "warm"),
  impression({ slug: "hawas-elixir", name: "Hawas Elixir", catalogueName: "Hawas Elixir", ...RA }, "warm"),
  impression({ slug: "hawas-thunder", name: "Hawas Thunder", catalogueName: "Hawas Thunder", ...RA }, "aromatic"),
  published({
    slug: "hawas-gold-digger", name: "Hawas Gold Digger", catalogueName: "Hawas Gold Digger", ...RA,
    family: "Woody aromatic", scent: ["fresh-aromatic", "oud-woods"],
    top: "Pear, lavender, mint, bergamot",
    heart: "Cinnamon, sage",
    base: "Vanilla, amber, cedarwood, patchouli",
    character: "Fresh aromatic, sweet, warm spicy and woody",
    description: "Pear and aromatic lavender are lifted by mint and bergamot. Cinnamon and sage add warmth before vanilla, amber, cedar and patchouli settle into a sweet woody base.",
    occasions: OFFICE_DAY, season: "Autumn and spring", audience: "Men", gender: "men", concentration: "EDP",
    research: "Fragrantica; Fragrantica news report dated 14 August 2026.",
  }),
  impression({ slug: "hawas-diva", name: "Hawas Diva", catalogueName: "Hawas Diva", ...RA }, "floral"),
  impression({ slug: "hawas-la-mer", name: "Hawas La Mer", catalogueName: "Hawas La Mer", ...RA }, "aromatic"),
  impression({ slug: "hawas-majestic", name: "Hawas Majestic", catalogueName: "Hawas Majestic", ...RA }, "aromatic"),
  impression({ slug: "hawas-chrome", name: "Hawas Chrome", catalogueName: "Hawas Chrome", ...RA }, "aromatic"),
  published({
    slug: "black-carbon-diamond", name: "Black Carbon Diamond", catalogueName: "Black Carbon Diamond", ...IQ,
    family: "Oriental woody", scent: ["oud-woods"],
    top: "Bergamot, saffron",
    heart: "Rose, patchouli, apple",
    base: "Frankincense, sandalwood, musk",
    character: "Woody, rosy, warm spicy, amber-like and fresh-spicy",
    description: "A bright bergamot-and-saffron opening leads to rose, apple and patchouli. Frankincense, sandalwood and musk create a warm, polished woody finish.",
    occasions: EVENING_FORMAL, season: "Autumn and winter", audience: "Unisex", gender: "unisex", concentration: null,
    concentrationNote: "Not consistently specified in the sources checked; confirm on box",
    research: "Fragrantica.",
  }),
  published({
    slug: "cuban-tobacco", name: "Cuban Tobacco", catalogueName: "Cuban Tobacco", ...IQ,
    family: "Tobacco gourmand", scent: ["amber-gourmand"],
    top: "Cocoa, Cuban tobacco",
    heart: "Sandalwood, leather, vanilla",
    base: "Honey, coconut",
    character: "Sweet tobacco, creamy, leathery and warm",
    description: "A rich tobacco-and-cocoa opening is softened by sandalwood, leather and vanilla. Honey and coconut add a sweet, rounded finish.",
    occasions: DATES_EVENINGS, season: "Autumn and winter", audience: "Unisex", gender: "unisex", concentration: null,
    concentrationNote: "Confirm on bottle/box",
    research: "Ibrahim Al Qurashi notes referenced in fragrance community submission; verify against current packaging.",
  }),
  published({
    slug: "balase-rose", name: "Balase Rose", catalogueName: "Balase Rose", ...IQ,
    family: "Rose woody leather", scent: ["rose-floral", "oud-woods"],
    top: "Rose, saffron, raspberry",
    heart: "Suede, jasmine, vanilla",
    base: "Cedarwood, musk, birchwood",
    character: "Rich rose, saffron-spiced, suede-like and woody",
    description: "A regal rose opening is brightened by raspberry and saffron. Suede, jasmine and vanilla create a plush heart, while birchwood, cedar and musk add depth.",
    occasions: EVENING_FORMAL, season: "Autumn and winter", audience: "Unisex", gender: "unisex", concentration: null,
    concentrationNote: "Confirm on bottle/box",
    research: "Ibrahim Al Qurashi official product page (Balas Rose).",
    reviewNote: "Official listing spells the name 'Balas Rose'.",
  }),
  published({
    slug: "cullinan-diamond-iris", name: "Cullinan Diamond Iris", catalogueName: "Cullinan Diamond Iris 150ml", ...IQ, size: 150,
    family: "Floral fruity woody", scent: ["rose-floral"],
    top: "Pineapple, grapefruit",
    heart: "Bergamot, jasmine, patchouli",
    base: "Iris, cedarwood, oakmoss, pine",
    character: "Citrusy, fruity, woody, green and softly powdery",
    description: "Pineapple and grapefruit create a bright fruity opening. Jasmine and patchouli add aromatic depth before iris, cedarwood, oakmoss and pine settle into a clean woody finish.",
    occasions: DAY_SOCIAL, season: "Spring and autumn", audience: "Unisex", gender: "unisex", concentration: null,
    concentrationNote: "Confirm on bottle/box",
    research: "Ibrahim Al Qurashi official product page; Fragrantica.",
  }),
  published({
    slug: "faris-al-arab", name: "Faris Al Arab", catalogueName: "Faris Al Arab", ...MA,
    family: "Oriental balsamic woody spicy", scent: ["amber-gourmand", "oud-woods"],
    top: "Oriental accord, cashmere wood, vanilla wood, liqueur accord",
    heart: "Cedarwood, amber, cane sugar",
    base: "Musk, tonka bean, labdanum, sandalwood",
    character: "Sweet, spicy, creamy, amber-rich and woody",
    description: "A smooth, warm opening combines cashmere woods, vanilla and a liqueur-like nuance. Amber, cedar and cane sugar add richness, while tonka, labdanum and sandalwood create a lasting, resinous finish.",
    occasions: EVENING_FORMAL, season: "Autumn and winter", audience: "Men (some databases list unisex)", gender: "men", concentration: "EDP",
    research: "Maison Asrar official product page; Fragrantica and Parfumo.",
  }),
  impression({ slug: "thriller", name: "Thriller", catalogueName: "Thriller", ...MA }, "aromatic"),
  impression({ slug: "alpha", name: "Alpha", catalogueName: "Maison Asrar Alpha", ...MA }, "aromatic"),
  published({
    slug: "vulcan-feu", name: "Vulcan Feu", catalogueName: "Vulcan Feu", ...FA,
    family: "Oriental woody", scent: ["oud-woods"],
    top: "Mango, ginger, lemon, red berries",
    heart: "Coumarin, jasmine, cedar",
    base: "Musk, amber, oud, cypriol oil",
    character: "Bold, fruity-spicy, smoky-resinous and woody",
    description: "Juicy mango, ginger, lemon and red berries create a vivid opening. A heart of jasmine, cedar and coumarin leads into a smoky, resinous base of oud, amber, musk and cypriol.",
    occasions: EVENING_FORMAL, season: "Autumn and winter; cooler evenings", audience: "Retail listings vary: men / unisex", gender: null, concentration: "EDP",
    research: "Catalogue research citing Perfume Network and Fragrance Hub.",
  }),
  published({
    slug: "liquid-brun", name: "Liquid Brun", catalogueName: "Liquid Brun 100ml", ...FA, size: 100,
    family: "Oriental woody gourmand", scent: ["amber-gourmand", "oud-woods"],
    top: "Citrus and aromatic spices (retailer note lists vary)",
    heart: "Warm amber, smooth woods",
    base: "Musk, vanilla, leather",
    character: "Warm, rich, sweet-spicy and woody",
    description: "A bright spicy-citrus introduction moves into warm amber and smooth woods. Vanilla, musk and a leather nuance create a rich, enveloping finish. Retail note pyramids differ, so the precise top-note list should be treated cautiously.",
    occasions: DATES_EVENINGS, season: "Autumn and winter", audience: "Unisex listings; check exact market packaging", gender: "unisex", concentration: "EDP",
    research: "Catalogue research citing Perfume Network and Belvish blog.",
  }),
  impression({ slug: "amber-emperor", name: "Amber Emperor", catalogueName: "Amber Emperor", brandId: "french-avenue", brandLabel: "French Avenue / Fragrance World" }, "warm"),
  published({
    slug: "pinaace", name: "Pinaace", catalogueName: "Pinaace", ...FA,
    family: "Aromatic musky", scent: ["fresh-aromatic", "musk-clean"],
    top: "Orange, grapefruit",
    heart: "Mint, blackcurrant",
    base: "Ambroxan, musk",
    character: "Fresh citrus, aromatic, clean and musky",
    description: "Orange and grapefruit give a bright citrus opening, followed by refreshing mint and blackcurrant. Ambroxan and musk leave a clean, modern aromatic trail.",
    occasions: OFFICE_DAY, season: "Spring and summer", audience: "Men", gender: "men", concentration: "EDP",
    research: "French Avenue official product page (Pinnace; catalogue spelling appears as Pinaace).",
    reviewNote: "Official spelling is 'Pinnace'.",
  }),
  impression({ slug: "vulcan-sable", name: "Vulcan Sable", catalogueName: "Vulcan Sable", ...LU }, "aromatic"),
  impression({ slug: "naughty-dates", name: "Naughty Dates", catalogueName: "Naughty Dates", ...LU }, "sweet"),
  impression({ slug: "veneno-scarlet", name: "Veneno Scarlet", catalogueName: "Veneno Scarlet", ...LU }, "aromatic"),
  impression({ slug: "tease-me", name: "Tease Me", catalogueName: "Tease Me", ...AX }, "aromatic"),
  impression({ slug: "sun-kisses", name: "Sun Kisses", catalogueName: "Sun Kisses", ...AX }, "aromatic"),
  impression({ slug: "carnal-desire", name: "Carnal Desire", catalogueName: "Carnal Desire", ...AX }, "aromatic"),
  impression({ slug: "fatima", name: "Fatima", catalogueName: "Fatima 100ml", ...ZI, size: 100 }, "floral"),
  published({
    slug: "fatima-velvet-love", name: "Fatima Velvet Love", catalogueName: "Fatima Velvet Love 100ml", ...ZI, size: 100,
    family: "Floral fruity gourmand", scent: ["rose-floral", "amber-gourmand"],
    top: "Passionfruit, peach, pear, aquatic notes, leafy notes, amber",
    heart: "Lily of the valley, jasmine, ylang-ylang",
    base: "Musk, sandalwood, caramel",
    character: "Fruity, sweet, tropical, floral, creamy and musky",
    description: "A lively tropical fruit opening leads into a soft white-floral heart. Creamy sandalwood, musk and caramel give the fragrance a sweet, smooth finish.",
    occasions: DAY_SOCIAL, season: "Spring and summer; mild autumn days", audience: "Women", gender: "women", concentration: "Extrait",
    research: "Zimaya official product page; Fragrantica.",
  }),
  impression({ slug: "nyla-suede", name: "Nyla Suede", catalogueName: "Nyla Suede", ...ZI }, "floral"),
  impression({ slug: "nyla-sherbet", name: "Nyla Sherbet", catalogueName: "Nyla Sherbet", ...ZI }, "floral"),
  impression({ slug: "turati-brown", name: "Turati Brown", catalogueName: "Turati Brown", ...ZI }, "aromatic"),
  impression({ slug: "bint-hooran-rose-passion", name: "Bint Hooran Rose Passion", catalogueName: "Bint Hooran Rose Passion", ...AZ }, "floral"),
  impression({ slug: "velvet-musk", name: "Velvet Musk", catalogueName: "Velvet Musk", ...AZ }, "floral"),
  impression({ slug: "najdia-intense", name: "Najdia Intense", catalogueName: "Najdia Intense", ...AZ }, "warm"),
  impression({ slug: "tarwa-silver", name: "Tarwa Silver", catalogueName: "Tarwa Silver", ...AZ }, "fresh"),
  impression({ slug: "riffs-ateeq", name: "Riffs Ateeq", catalogueName: "Riffs Ateeq", ...AZ }, "warm"),
  impression({ slug: "noble-ameer", name: "Noble Ameer", catalogueName: "Lattafa Noble Ameer", ...L }, "aromatic"),
  impression({ slug: "oud-mood-reminiscence", name: "Oud Mood Reminiscence", catalogueName: "Lattafa Oud Mood Reminiscence", ...L }, "warm"),
  impression({ slug: "honor-and-glory", name: "Honor and Glory", catalogueName: "Lattafa Honor and Glory", ...L }, "sweet"),
  impression({ slug: "teriaq", name: "Teriaq", catalogueName: "Lattafa Teriaq", ...L }, "aromatic"),
  impression({ slug: "mayar-natural-intense", name: "Mayar Natural Intense", catalogueName: "Lattafa Mayar Natural Intense", ...L }, "warm"),
  impression(
    { slug: "eclaire-pistache", name: "Eclaire Pistache", catalogueName: "Lattaf Eclaire Pistache", ...L, reviewNote: "Catalogue prints the brand as 'Lattaf'." },
    "sweet",
  ),
  impression({ slug: "smoky", name: "Smoky", catalogueName: "Maison Alhambra smoky", ...MH }, "warm"),
  impression({ slug: "philos-noir", name: "Philos Noir", catalogueName: "Maison Alhambra philos noir", ...MH }, "warm"),
  impression({ slug: "philos-rosso", name: "Philos Rosso", catalogueName: "Maison Alhambra Philos Rosso", ...MH }, "aromatic"),
  impression({ slug: "pink-velvet", name: "Pink Velvet", catalogueName: "Maison Alhambra Pink Velvet", ...MH }, "floral"),
  impression({ slug: "hooke-azure", name: "Hooke Azure", catalogueName: "Zimaya Hooke Azure", ...ZI }, "fresh"),
  impression({ slug: "tiramisu-caramel", name: "Tiramisu Caramel", catalogueName: "Zimaya Tiramisu Caramel", ...ZI }, "sweet"),
  impression({ slug: "coco", name: "Coco", catalogueName: "Zimaya Coco", ...ZI }, "sweet"),
  impression({ slug: "daarej-passion", name: "Daarej Passion", catalogueName: "Daarej Passion", ...RA }, "floral"),
  published({
    slug: "tribute-blue", name: "Tribute Blue", catalogueName: "Afnan Tribute Blue", ...AF,
    family: "Oriental fougère", scent: ["oud-woods", "fresh-aromatic"],
    top: "Nutmeg, pimento seeds, bergamot",
    heart: "Amber, cashmere wood",
    base: "Incense, musk, vetiver, white wood",
    character: "Woody, amber, smoky, fresh-spicy and aromatic",
    description: "Bergamot and warm spices introduce a smooth amber-and-cashmere-wood heart. Incense, musk, vetiver and pale woods create a dry, smoky and refined finish.",
    occasions: EVENING_FORMAL, season: "Autumn and winter", audience: "Unisex", gender: "unisex", concentration: null,
    concentrationNote: "Confirm exact concentration on packaging",
    research: "Fragrantica.",
  }),
  impression({ slug: "9am-pour-femme", name: "9am Pour Femme", catalogueName: "Afnan 9am Pour Femme", ...AF }, "floral"),
  published({
    slug: "tropical-vibes", name: "Tropical Vibes", catalogueName: "Rayhaan Tropical Vibes", ...RY,
    family: "Tropical fruity aquatic woody", scent: ["fresh-aromatic"],
    top: "Mango, pineapple, bergamot, rum",
    heart: "Coconut, white flowers, marine notes",
    base: "Musk, amber, sandalwood, vetiver",
    character: "Tropical, juicy, creamy, aquatic and woody",
    description: "Mango and pineapple create a juicy tropical opening with a hint of rum. Coconut, white florals and marine notes add a breezy heart, while woods and musk ground the finish.",
    occasions: DAY_SOCIAL, season: "Spring and summer", audience: "Unisex", gender: "unisex", concentration: null,
    concentrationNote: "Confirm on bottle/box",
    research: "Fragrantica.",
  }),
  impression({ slug: "ocean-rush", name: "Ocean Rush", catalogueName: "Rayhaan Ocean Rush", ...RY }, "fresh"),
  impression(
    { slug: "pacif-aura", name: "Pacif Aura", catalogueName: "Rayhaan Pacif Aura", ...RY, reviewNote: "Spelling may be 'Pacific Aura' – confirm against the box." },
    "fresh",
  ),
  impression({ slug: "imperia", name: "Imperia", catalogueName: "Rayhaan Imperia", ...RY }, "aromatic"),
  impression({ slug: "rayhaan-elixir", name: "Rayhaan Elixir", catalogueName: "Rayhaan Elixir", ...RY }, "warm"),
];
