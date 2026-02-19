import { Suspense } from "react";
import Script from "next/script";
import { FloatingCartBar } from "@/components/customer/FloatingCartBar";
import { OrderTrackingBar } from "@/components/customer/OrderTrackingBar";
import { RouteSlotGuard } from "@/components/layout/RouteSlotGuard";
import { CartProvider } from "@/components/customer/CartProvider";
import { CartErrorBoundary } from "@/components/error/CartErrorBoundary";
import { getCart } from "@/lib/actions/draft-order";
import { getServerLocation } from "@/lib/actions/location";
import { NavShell } from "@/components/layout/NavShell";

/**
 * WYSHKIT 2026: Customer Layout - Singleton State & Route-Based Navigation
 */

export default function CustomerLayout({
  children,
  sheet,
}: {
  children: React.ReactNode;
  sheet: React.ReactNode;
}) {
  return (
    <Suspense fallback={<LayoutSkeleton />}>
      <AsyncLayoutContent sheet={sheet}>
        {children}
      </AsyncLayoutContent>
    </Suspense>
  );
}

/**
 * WYSHKIT 2026: Parallel Hydration
 * This component fetches dynamic user data (Cart, Location) 
 * without blocking the static shell render.
 */
async function AsyncLayoutContent({
  children,
  sheet
}: {
  children: React.ReactNode;
  sheet: React.ReactNode;
}) {
  // Parallel fetch: No waterfall
  const [cartResult, location] = await Promise.all([
    getCart(),
    getServerLocation()
  ]);

  const initialCart = cartResult.cart || { items: [], partnerId: null, subtotal: 0, total: 0, itemCount: 0 };
  const cartIdentity = cartResult.cartIdentity ?? 'empty';
  const guestSessionId = cartResult.guestSessionId ?? null;

  return (
    <CartProvider key={cartIdentity} initialCart={initialCart} guestSessionId={guestSessionId}>
      <NavShell initialLocation={location}>
        <RouteSlotGuard sheet={sheet}>
          {children}
        </RouteSlotGuard>
      </NavShell>
      <CartErrorBoundary>
        <FloatingCartBar />
      </CartErrorBoundary>
      <OrderTrackingBar />
    </CartProvider>
  );
}

/**
 * WYSHKIT 2026: Static Shell Skeleton
 * Rendered during the initial stream. Must NOT render page children here —
 * they use useCart and require CartProvider, which only exists after AsyncLayoutContent loads.
 */
function LayoutSkeleton() {
  return (
    <div className="min-h-screen bg-white">
      <div className="fixed top-0 left-0 right-0 h-16 bg-white border-b border-zinc-50 z-30 flex items-center px-4 md:px-8">
        <div className="w-32 h-6 bg-zinc-100 rounded-lg animate-pulse" />
      </div>
      <div className="pt-16 px-4 py-8 md:px-8 space-y-6">
        <div className="w-48 h-6 bg-zinc-100 rounded animate-pulse" />
        <div className="flex gap-4 overflow-hidden">
          <div className="w-32 h-40 bg-zinc-50 rounded-xl animate-pulse" />
          <div className="w-32 h-40 bg-zinc-50 rounded-xl animate-pulse" />
          <div className="w-32 h-40 bg-zinc-50 rounded-xl animate-pulse" />
        </div>
      </div>
    </div>
  );
}
