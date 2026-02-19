'use client';

import { Suspense, use } from "react";
import { OrderDetailsPageClient } from "@/components/customer/orders/OrderDetailsPageClient";
import { Sheet, SheetContent, SheetTitle } from "@/components/ui/sheet";
import { useRouter } from "next/navigation";

/**
 * WYSHKIT 2026: Intercepted Order Details Route
 * This allows the order tracking view to be opened as a contextual sheet
 * from the OrderTrackingBar or storefront.
 */
export default function InterceptedOrderDetailsPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const router = useRouter();

  return (
    <Sheet
      open={true}
      onOpenChange={(open) => {
        if (!open) {
          router.back();
        }
      }}
    >
      <SheetContent
        side="bottom"
        hideClose
        className="h-auto max-h-[85dvh] rounded-t-[32px] border-x border-t border-zinc-100 p-0 gap-0 flex flex-col"
      >
        <SheetTitle className="sr-only">Order Details</SheetTitle>
        <div className="pt-2 pb-4 flex justify-center shrink-0">
          <div className="h-1.5 w-12 rounded-full bg-zinc-200" aria-hidden />
        </div>
        <div className="flex-1 overflow-y-auto relative outline-none">
          <div className="flex flex-col min-h-full">
            <OrderDetailsPageClient params={params} isSheet={true} />
          </div>
        </div>
      </SheetContent>
    </Sheet>
  );
}
