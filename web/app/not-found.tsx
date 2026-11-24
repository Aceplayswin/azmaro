import StoreLayout from "./(store)/layout";
import StoreNotFound from "./(store)/not-found";

/** Global 404 for unmatched URLs – rendered inside the normal storefront chrome. */
export default function NotFound() {
  return (
    <StoreLayout>
      <StoreNotFound />
    </StoreLayout>
  );
}
