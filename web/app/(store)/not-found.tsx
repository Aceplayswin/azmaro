import { ButtonLink } from "@/components/ui/Button";
import { EmptyState } from "@/components/ui/States";

export default function NotFound() {
  return (
    <div className="az-container">
      <EmptyState title="This page could not be found" description="The fragrance or page you were looking for may have moved.">
        <ButtonLink href="/shop">Shop all fragrances</ButtonLink>
        <ButtonLink href="/" variant="secondary">
          Return home
        </ButtonLink>
      </EmptyState>
    </div>
  );
}
