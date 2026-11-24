import { AccountView } from "@/components/account/AccountView";
import { Breadcrumbs } from "@/components/ui/Breadcrumbs";
import { pageMetadata } from "@/lib/seo";

export const metadata = pageMetadata({
  title: "My account",
  description: "View your AZMARO orders, addresses and account details.",
  path: "/account",
  noIndex: true,
});

export default function AccountPage() {
  return (
    <div className="az-container pt-8 pb-16 sm:pt-12">
      <Breadcrumbs items={[{ label: "Home", href: "/" }, { label: "My account" }]} />
      <header className="mb-8">
        <h1 className="az-h1">My account</h1>
      </header>
      <AccountView />
    </div>
  );
}
