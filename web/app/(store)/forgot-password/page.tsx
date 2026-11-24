import { Suspense } from "react";
import { AuthView } from "@/components/account/AuthView";
import { LoadingState } from "@/components/ui/States";
import { pageMetadata } from "@/lib/seo";

export const metadata = pageMetadata({
  title: "Reset your password",
  description: "Reset the password for your AZMARO account.",
  path: "/forgot-password",
  noIndex: true,
});

export default function Page() {
  return (
    <div className="az-container pt-10 pb-16 sm:pt-16">
      <Suspense fallback={<LoadingState label="Loading" />}>
        <AuthView mode="reset" />
      </Suspense>
    </div>
  );
}
