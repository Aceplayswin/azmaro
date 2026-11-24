"use client";

import { useEffect } from "react";
import { ButtonLink } from "@/components/ui/Button";
import { EmptyState } from "@/components/ui/States";

/** Shown when a page can't load its data (e.g. the AZMARO API is unreachable). */
export default function StoreError({ error, reset }: { error: Error & { digest?: string }; reset: () => void }) {
  useEffect(() => {
    console.error(error);
  }, [error]);

  return (
    <div className="az-container">
      <EmptyState
        title="We couldn't load this page"
        description="The collection is temporarily unavailable. Please try again in a moment."
      >
        <button type="button" className="az-btn az-btn-primary" onClick={reset}>
          Try again
        </button>
        <ButtonLink href="/contact" variant="secondary">
          Contact us
        </ButtonLink>
      </EmptyState>
    </div>
  );
}
