/**
 * Storefront discovery filters within the single Middle Eastern collection
 * (not separate business categories). Slugs match the web app's identifiers.
 */
export const SCENT_FAMILIES = [
  { slug: "oud-woods", name: "Oud & Woods", shortName: "Oud", description: "Resinous oud, smoky incense and polished woods." },
  { slug: "amber-gourmand", name: "Amber & Gourmand", shortName: "Amber", description: "Warm amber, vanilla, coffee and dessert-like sweetness." },
  { slug: "musk-clean", name: "Musk & Clean", shortName: "Musk", description: "Soft musks and clean, skin-close dry-downs." },
  { slug: "rose-floral", name: "Rose & Floral", shortName: "Rose", description: "Rose, white florals and fruity-floral bouquets." },
  { slug: "fresh-aromatic", name: "Fresh & Aromatic", shortName: "Fresh", description: "Citrus, aromatic herbs and airy, watery accords." },
];

export const COLLECTIONS = [
  {
    slug: "middle-eastern",
    name: "Middle Eastern fragrances",
    shortName: "Middle Eastern",
    description: "Oud, amber, musk, rose, woods and modern aromatic compositions from Middle Eastern fragrance houses.",
  },
];

/** FAQ answers mirror the copy already published on the storefront – no invented policy. */
export const FAQS = [
  {
    category: "Products",
    question: "How do I know my fragrance is authentic?",
    answer:
      "AZMARO focuses on Middle Eastern fragrance houses. Product details are drawn from brand and specialist listings. Where a brand has not published a verified note pyramid we label the notes as a scent impression, so you always know what is confirmed. For questions about a specific bottle, send us a message.",
  },
  {
    category: "Delivery",
    question: "How long does delivery take?",
    answer:
      "We deliver across India. Serviceability, delivery charges and estimated timelines for your PIN code are confirmed by our courier partner at checkout. Our full shipping policy will be published here before launch.",
  },
  {
    category: "Orders",
    question: "Can I cancel or return an order?",
    answer:
      "Orders can be cancelled online before they are shipped. Our returns and refunds policy is being finalised and will be published here before launch. If you have a question about an order, please contact our team.",
  },
  {
    category: "Payments",
    question: "Which payment methods can I use?",
    answer:
      "Checkout supports UPI, credit and debit cards, net banking and cash on delivery (subject to eligibility). Card and bank details are entered only with our payment partner – AZMARO never stores them.",
  },
  {
    category: "Orders",
    question: "How do I track my shipment?",
    answer:
      "Use Track order with your order number and the email or phone used at checkout. Shipment updates appear once our courier partner records them.",
  },
];
