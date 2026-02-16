'use client';

import { useMemo, useState } from "react";
import { useRouter } from "next/navigation";
import { DraftSummaryBlock } from "@/components/customer/checkout/blocks/DraftSummaryBlock";
import { useCart } from '@/components/customer/CartProvider';
import type { HydratedDraftItem } from "@/components/customer/checkout/types";
import { toast } from "sonner";

interface CartSlotProps {
  initialHydratedItems?: HydratedDraftItem[];
}

/**
 * WYSHKIT 2026: Cart Slot Component
 * Displays cart summary with edit capabilities
 * 
 * Swiggy 2026 Pattern: Stateless & Seamless
 * - Data injected via props
 * - Mutations via Server Actions + router.refresh()
 */
export function CartSlot({ initialHydratedItems = [] }: CartSlotProps) {
  const router = useRouter();
  const { updateQuantity, removeFromDraftOrder } = useCart();

  // Local state for optimistic updates if needed, but for now server-first
  const displayItems = initialHydratedItems;

  const handleUpdateQuantity = async (itemId: string, variantId: string | null, quantity: number) => {
    try {
      await updateQuantity(itemId, variantId, quantity);
      router.refresh();
    } catch (e) {
      toast.error("Failed to update quantity");
    }
  };

  const handleRemoveItem = async (itemId: string, variantId: string | null) => {
    try {
      await removeFromDraftOrder(itemId, variantId);
      router.refresh();
    } catch (e) {
      toast.error("Failed to remove item");
    }
  };

  if (displayItems.length === 0) {
    return (
      <div className="py-8 text-center">
        <p className="text-sm text-zinc-400">Your cart is empty</p>
      </div>
    );
  }

  return (
    <DraftSummaryBlock
      items={displayItems}
      onUpdateQuantity={handleUpdateQuantity}
      onRemoveItem={handleRemoveItem}
      editable={true}
    />
  );
}
