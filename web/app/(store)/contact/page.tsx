import Link from "next/link";
import { Mail, MessageCircle, Phone } from "lucide-react";
import { ContactForm } from "@/components/forms/ContactForm";
import { Accordion } from "@/components/ui/Accordion";
import { Breadcrumbs } from "@/components/ui/Breadcrumbs";
import { SectionHeading } from "@/components/ui/SectionHeading";
import { siteConfig, whatsappHref } from "@/config/site";
import { content } from "@/data/content";
import { pageMetadata } from "@/lib/seo";

export const metadata = pageMetadata({
  title: "Contact & help",
  description: "Get in touch with AZMARO about a fragrance, an order or delivery. Shipping, returns, payments and FAQs.",
  path: "/contact",
});

function PolicyText({ paragraphs, pending }: { paragraphs: string[] | null; pending: string }) {
  return paragraphs ? (
    <div className="space-y-3">
      {paragraphs.map((p) => (
        <p key={p.slice(0, 30)}>{p}</p>
      ))}
    </div>
  ) : (
    <p>{pending}</p>
  );
}

export default function ContactPage() {
  const { whatsapp, email, phone } = siteConfig.contact;
  const wa = whatsappHref("Hello AZMARO, I have a question.");

  const methods = [
    {
      id: "whatsapp",
      label: "WhatsApp",
      icon: MessageCircle,
      detail: whatsapp ? "Message our team on WhatsApp." : "WhatsApp support details will be published here soon.",
      cta: "Chat on WhatsApp",
      href: wa,
      external: true,
    },
    {
      id: "email",
      label: "Email",
      icon: Mail,
      detail: email ?? "Support email to be confirmed.",
      cta: "Send an email",
      href: email ? `mailto:${email}` : null,
      external: false,
    },
    {
      id: "phone",
      label: "Phone",
      icon: Phone,
      detail: phone ?? "Business number to be confirmed.",
      cta: "Call us",
      href: phone ? `tel:${phone.replace(/[^\d+]/g, "")}` : null,
      external: false,
    },
  ];

  const faqs = [
    {
      id: "authenticity",
      title: "Authenticity and product details",
      content: (
        <p>
          AZMARO focuses on Middle Eastern fragrance houses. Product details on each page are drawn from brand and specialist
          listings. Where a brand has not published a verified note pyramid we label the notes as a scent impression, so you always
          know what is confirmed. For questions about a specific bottle, send us a message.
        </p>
      ),
    },
    {
      id: "shipping",
      title: "Shipping and delivery",
      content: (
        <PolicyText
          paragraphs={content.policies.shipping}
          pending="We deliver across India. Serviceability, delivery charges and estimated timelines for your PIN code are confirmed by our courier partner at checkout. Our full shipping policy will be published here before launch."
        />
      ),
    },
    {
      id: "returns",
      title: "Returns and refunds",
      content: (
        <PolicyText
          paragraphs={content.policies.returns}
          pending="Our returns and refunds policy is being finalised and will be published here before launch. If you have a question about an order, please contact our team."
        />
      ),
    },
    {
      id: "payments",
      title: "Payment methods",
      content: (
        <p>
          Checkout supports UPI, credit and debit cards, net banking and cash on delivery (subject to eligibility). Card and bank
          details are entered only with our payment partner – AZMARO never stores them.
        </p>
      ),
    },
    {
      id: "tracking",
      title: "Order tracking",
      content: (
        <p>
          Use{" "}
          <Link href="/track-order" className="text-gold underline-offset-4 hover:underline">
            Track order
          </Link>{" "}
          with your order number and the email or phone used at checkout. Shipment updates appear once our courier partner
          records them.
        </p>
      ),
    },
  ];

  return (
    <div className="az-container pt-8 sm:pt-12">
      <Breadcrumbs items={[{ label: "Home", href: "/" }, { label: "Contact & help" }]} />
      <header className="mb-10">
        <h1 className="az-h1">How can we help?</h1>
        <p className="mt-3 text-sm text-ink-2">Get in touch about a fragrance, an order or delivery. Choose the quickest support route.</p>
      </header>

      <div className="grid gap-8 lg:grid-cols-[minmax(0,24rem)_1fr] lg:gap-12">
        <ul className="grid gap-4 self-start">
          {methods.map((m) => {
            const Icon = m.icon;
            return (
              <li key={m.id} className="az-panel p-6">
                <div className="flex items-center gap-3">
                  <Icon className="size-4 text-gold" strokeWidth={1.5} aria-hidden />
                  <h2 className="az-label text-gold">{m.label}</h2>
                </div>
                <p className="mt-3 text-sm break-words text-ink-2">{m.detail}</p>
                {m.href ? (
                  <a
                    href={m.href}
                    {...(m.external ? { target: "_blank", rel: "noopener noreferrer" } : {})}
                    className="az-btn az-btn-secondary az-btn-sm mt-5"
                  >
                    {m.cta}
                  </a>
                ) : (
                  <p className="mt-5 text-[0.62rem] font-bold tracking-[0.2em] text-muted uppercase">Coming soon · use the form</p>
                )}
              </li>
            );
          })}
        </ul>
        <ContactForm />
      </div>

      <section id="faqs" className="scroll-mt-28 pt-20" aria-labelledby="faq-title">
        <SectionHeading id="faq-title" eyebrow="Quick answers" title="Frequently asked questions" />
        <div className="grid gap-x-8 lg:grid-cols-2">
          {faqs.map((f) => (
            <div key={f.id} id={f.id} className="scroll-mt-28">
              <Accordion items={[f]} className="border-t-0" />
            </div>
          ))}
        </div>
      </section>
    </div>
  );
}
