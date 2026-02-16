"use client";

import { useCart } from "@/components/customer/CartProvider";

/**
 * WYSHKIT 2026: useDraftOrder (Singleton Consumer)
 * 
 * Refactored to consume CartProvider context.
 * All state is now shared across the entire app.
 */
export function useDraftOrder() {
  const {
    draftOrder,
    loading,
    isPending,
    addToDraftOrder,
    removeFromDraftOrder,
    updateQuantity,
    clearDraftOrder,
    refreshDraftOrder,
    isGuest,
  } = useCart();

  return {
    draftOrder,
    loading,
    isPending,
    addToDraftOrder,
    removeFromDraftOrder,
    updateQuantity,
    clearDraftOrder,
    refreshDraftOrder,
    isGuest,
  };
}
