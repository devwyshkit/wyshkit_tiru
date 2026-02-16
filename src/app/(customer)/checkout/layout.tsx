import { Suspense } from "react";
import Script from "next/script";
import { CheckoutLayoutWrapper } from "@/components/customer/checkout/CheckoutLayoutWrapper";
import { getCheckoutData } from "@/lib/actions/checkout";
import { CheckoutErrorBoundaryWithRouter } from "@/components/error/CheckoutErrorBoundary";

/**
 * WYSHKIT 2026: Checkout Layout
 * Immersive checkout experience - no global chrome, focused on the transaction.
 * 
 * Swiggy 2026 Pattern: Server-side data hydration
 * - Fetches all checkout data in a single "One-Trip" server action.
 * - Eliminates client-side waterfall and hydration jitter.
 */
export const experimental_ppr = true;

/**
 * WYSHKIT 2026: Checkout Layout
 * Immersive checkout experience - no global chrome, focused on the transaction.
 */
export default function CheckoutLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <CheckoutErrorBoundaryWithRouter>
      <div className="min-h-screen bg-white">
        <Script
          src="https://checkout.razorpay.com/v1/checkout.js"
          strategy="afterInteractive"
        />
        <Suspense fallback={<CheckoutSkeleton />}>
          <AsyncCheckoutContent>
            {children}
          </AsyncCheckoutContent>
        </Suspense>
      </div>
    </CheckoutErrorBoundaryWithRouter>
  );
}

/**
 * WYSHKIT 2026: Parallel Hydration for Checkout
 */
async function AsyncCheckoutContent({
  children,
}: {
  children: React.ReactNode;
}) {
  const checkoutData = await getCheckoutData();

  return (
    <CheckoutLayoutWrapper
      checkoutData={checkoutData}
    >
      <Suspense fallback={null}>
        {children}
      </Suspense>
    </CheckoutLayoutWrapper>
  );
}

/**
 * WYSHKIT 2026: Checkout Shell Skeleton
 */
function CheckoutSkeleton() {
  return (
    <div className="h-full flex flex-col bg-white overflow-hidden relative">
      <header className="flex items-center h-16 px-5 border-b border-zinc-50">
        <div className="size-9 bg-zinc-100 rounded-lg animate-pulse" />
        <div className="ml-3 space-y-2">
          <div className="w-32 h-4 bg-zinc-100 rounded animate-pulse" />
          <div className="w-20 h-2 bg-zinc-50 rounded animate-pulse" />
        </div>
      </header>
      <main className="flex-1 p-5 space-y-8">
        {[1, 2, 3].map(i => (
          <div key={i} className="space-y-3">
            <div className="w-24 h-3 bg-zinc-100 rounded animate-pulse" />
            <div className="w-full h-32 bg-zinc-50 rounded-2xl animate-pulse" />
          </div>
        ))}
      </main>
    </div>
  );
}
