import Link from "next/link";
import { siteConfig, whatsappHref } from "@/config/site";

const columns = [
  {
    title: "Shop",
    links: [
      { label: "Shop all", href: "/shop" },
      { label: "Middle Eastern", href: "/middle-eastern" },
      { label: "Brands", href: "/brands" },
      { label: "New arrivals", href: "/shop?tag=new" },
      { label: "Bestsellers", href: "/shop?tag=bestseller" },
    ],
  },
  {
    title: "Help",
    links: [
      { label: "Track order", href: "/track-order" },
      { label: "Shipping", href: "/contact#shipping" },
      { label: "Returns", href: "/contact#returns" },
      { label: "FAQs", href: "/contact#faqs" },
    ],
  },
  {
    title: "Company",
    links: [
      { label: "About AZMARO", href: "/about" },
      { label: "Contact", href: "/contact" },
      { label: "Privacy", href: "/privacy" },
      { label: "Terms", href: "/terms" },
    ],
  },
];

export function Footer() {
  const { email, instagram } = siteConfig.contact;
  const wa = whatsappHref();
  const connect = [
    { label: "WhatsApp", href: wa ?? "/contact", external: Boolean(wa) },
    { label: "Instagram", href: instagram ?? "/contact", external: Boolean(instagram) },
    { label: "Email", href: email ? `mailto:${email}` : "/contact", external: false },
  ];
  const linkCls = "text-[0.8rem] tracking-[0.04em] text-ink-2 transition-colors hover:text-gold-light";

  return (
    <footer className="mt-24 border-t border-line-soft bg-bg-2">
      <div className="az-container grid grid-cols-2 gap-x-6 gap-y-10 py-14 sm:grid-cols-4 lg:grid-cols-[1.6fr_repeat(4,1fr)] lg:gap-8 lg:py-16">
        <div className="col-span-2 sm:col-span-4 lg:col-span-1">
          <Link href="/" className="az-wordmark text-3xl" aria-label="AZMARO home">
            Azmaro
          </Link>
          <p className="mt-4 max-w-xs text-[0.8rem] leading-relaxed text-ink-2">{siteConfig.description}</p>
        </div>

        {columns.map((col) => (
          <nav key={col.title} aria-label={col.title}>
            <h2 className="az-eyebrow mb-4 font-sans">{col.title}</h2>
            <ul className="space-y-2.5">
              {col.links.map((l) => (
                <li key={l.label}>
                  <Link href={l.href} className={linkCls}>
                    {l.label}
                  </Link>
                </li>
              ))}
            </ul>
          </nav>
        ))}

        <nav aria-label="Connect">
          <h2 className="az-eyebrow mb-4 font-sans">Connect</h2>
          <ul className="space-y-2.5">
            {connect.map((l) => (
              <li key={l.label}>
                {l.external ? (
                  <a href={l.href} target="_blank" rel="noopener noreferrer" className={linkCls}>
                    {l.label}
                  </a>
                ) : (
                  <Link href={l.href} className={linkCls}>
                    {l.label}
                  </Link>
                )}
              </li>
            ))}
          </ul>
        </nav>
      </div>
      <div className="border-t border-line-soft">
        <div className="az-container flex flex-col gap-2 py-5 text-[0.65rem] tracking-[0.14em] text-muted uppercase sm:flex-row sm:items-center sm:justify-between">
          <p>© {new Date().getFullYear()} AZMARO Perfumes</p>
          <p>Secure payments / Made for India</p>
        </div>
      </div>
    </footer>
  );
}
