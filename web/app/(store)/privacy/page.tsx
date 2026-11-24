import { PolicyPage } from "@/components/layout/PolicyPage";
import { content } from "@/data/content";
import { pageMetadata } from "@/lib/seo";

export const metadata = pageMetadata({ title: "Privacy policy", description: "How AZMARO handles your personal information.", path: "/privacy" });

export default function PrivacyPage() {
  return <PolicyPage title="Privacy policy" paragraphs={content.policies.privacy} />;
}
