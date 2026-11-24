import { Suspense } from "react";
import { AuthView } from "@/components/account/AuthView";
import { LoadingState } from "@/components/ui/States";
import { pageMetadata } from "@/lib/seo";

export const metadata = pageMetadata({
  title: "Create an account",
  description: "Create an AZMARO account to check out and track your orders.",
  path: "/register",
  noIndex: true,
});

export default function Page() {
  return (
    <div className="az-container pt-10 pb-16 sm:pt-16">
      <Suspense fallback={<LoadingState label="Loading" />}>
        <AuthView mode="register" />
      </Suspense>
    </div>
  );
}
