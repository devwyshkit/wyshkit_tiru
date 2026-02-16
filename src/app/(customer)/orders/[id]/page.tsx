import { createClient } from "@/lib/supabase/server";
import { redirect } from "next/navigation";
import { Suspense } from "react";
import { OrderDetailsPageClient } from "@/components/customer/orders/OrderDetailsPageClient";
import { ErrorBoundary } from "@/components/ErrorBoundary";

/**
 * WYSHKIT 2026: Order Details Page
 * Route: /orders/[id]
 * 
 * Swiggy 2026 Pattern: URL-addressable order details
 * - Shareable order links
 * - Browser back/forward works
 * - Intent-based navigation
 */
export default async function OrderDetailsPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();

  if (!user) {
    const { id } = await params;
    redirect(`/auth?intent=signin&returnUrl=/orders/${id}`);
  }

  return (
    <div className="min-h-screen">
      <ErrorBoundary>
        <Suspense fallback={
          <div className="flex items-center justify-center py-20">
            <div className="text-sm text-zinc-500">Loading order...</div>
          </div>
        }>
          <OrderDetailsPageClient params={params} />
        </Suspense>
      </ErrorBoundary>
    </div>
  );
}
