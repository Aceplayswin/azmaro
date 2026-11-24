import { PolicyPage } from "@/components/layout/PolicyPage";
import { content } from "@/data/content";
import { pageMetadata } from "@/lib/seo";

export const metadata = pageMetadata({ title: "Terms of service", description: "Terms for shopping with AZMARO.", path: "/terms" });

export default function TermsPage() {
  return <PolicyPage title="Terms of service" paragraphs={content.policies.terms} />;
}
