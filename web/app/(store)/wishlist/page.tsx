import { WishlistView } from "@/components/cart/WishlistView";
import { Breadcrumbs } from "@/components/ui/Breadcrumbs";
import { getProductSummaries } from "@/lib/api/server";
import { pageMetadata } from "@/lib/seo";

export const metadata = pageMetadata({
  title: "Your wishlist",
  description: "Your saved AZMARO fragrances.",
  path: "/wishlist",
  noIndex: true,
});

export default async function WishlistPage() {
  return (
    <div className="az-container pt-8 sm:pt-12">
      <Breadcrumbs items={[{ label: "Home", href: "/" }, { label: "Wishlist" }]} />
      <header className="mb-8">
        <h1 className="az-h1">Your wishlist</h1>
        <p className="mt-3 text-sm text-ink-2">Saved fragrances – kept on this device until you sign in.</p>
      </header>
      <WishlistView products={await getProductSummaries()} />
    </div>
  );
}
