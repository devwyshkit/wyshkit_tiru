'use client';

import { useRouter } from "next/navigation";
import { UpsellGrid } from "@/components/features/UpsellGrid";
import { useCart } from '@/components/customer/CartProvider';
import { toast } from 'sonner';
import { ShieldCheck } from "lucide-react";
import { logger } from '@/lib/logging/logger';
import { CheckoutData } from "@/lib/actions/checkout";

interface CheckoutContentProps {
  data: CheckoutData;
}

/**
 * WYSHKIT 2026: Checkout Content Component
 * 
 * Swiggy 2026 Pattern: Stateless UI
 * - Receives data as props from server-driven wrapper
 * - Uses Server Actions and router.refresh() for mutations
 */
export function CheckoutContent({ data }: CheckoutContentProps) {
  const router = useRouter();
  const { addToDraftOrder: addToCartAction } = useCart();

  const upsellItems = data.upsellItems;

  return (
    <>
      {/* Upsells */}
      {upsellItems.length > 0 && (
        <div className="bg-white px-2 py-1 rounded-xl">
          <UpsellGrid
            items={upsellItems}
            title="Add more from this store"
            onAdd={async (item) => {
              try {
                const result = await addToCartAction(item.id, null, { enabled: false }, [], 1);
                if (result.success) {
                  toast.success(`Added ${item.name}`);
                  // WYSHKIT 2026: Server-driven refresh
                  router.refresh();
                } else if (result.error) {
                  toast.error(result.error || 'Failed to add item');
                }
              } catch (error) {
                toast.error('Failed to add item. Please try again.');
                logger.error('Unexpected error adding item from upsell', error, { itemId: item.id });
              }
            }}
          />
        </div>
      )}

      {/* Security badge */}
      <div className="px-3 py-1.5 flex items-center justify-center gap-2 opacity-30">
        <ShieldCheck className="size-3 text-zinc-400" />
        <span className="text-[9px] font-bold text-zinc-400 uppercase tracking-widest">Secured by Razorpay</span>
      </div>
    </>
  );
}
