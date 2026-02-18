'use server';

import { createClient } from '@/lib/supabase/server';
import type { Database, Json } from '@/lib/supabase/database.types';
import { PRICING, type PricingBreakdown } from '@/lib/constants/pricing';
import { logger } from '@/lib/logging/logger';

/**
 * WYSHKIT 2026: Server Action for Atomic Order Total Calculation
 * 
 * Swiggy 2026 Pattern: Database-Level Business Logic
 * Calls Postgres RPC to calculate order totals atomically.
 * Prevents tampering and ensures consistency between UI and order records.
 * 
 * @param cartItems - Array of cart items with pricing details
 * @param deliveryFee - Base delivery fee (default: PRICING.DELIVERY_FEE)
 * @param addressId - Address ID for hyperlocal check (optional)
 * @returns Pricing breakdown from database calculation
 */
export async function calculateOrderTotalRPC(
  cartItems: Array<{
    itemId: string;
    quantity: number;
    variantId?: string | null;
    personalizationOptionId?: string | null;
    hasPersonalization?: boolean;
    selectedAddons?: any[];
  }>,
  deliveryFee: number = PRICING.DELIVERY_FEE_3KM,
  addressId?: string | null,
  couponCode?: string | null,
  distanceKm?: number | null,
  useWallet: boolean = false,
  userId?: string | null
): Promise<{ data: PricingBreakdown | null; error?: string }> {
  try {
    const supabase = await createClient();

    // Call Postgres RPC with standardized Swiggy 2026 parameters
    const { data, error } = await supabase.rpc('calculate_order_total', {
      p_cart_items: cartItems.map(item => ({
        itemId: item.itemId,
        quantity: item.quantity,
        variantId: item.variantId ?? null,
        personalizationOptionId: item.personalizationOptionId ?? null,
        hasPersonalization: item.hasPersonalization ?? false,
        selectedAddons: item.selectedAddons ?? []
      })) as unknown as Json,
      p_delivery_fee_override: deliveryFee,
      p_address_id: addressId || undefined,
      p_coupon_code: couponCode || undefined,
      p_distance_km: distanceKm || undefined,
      p_use_wallet: useWallet,
      p_user_id: userId || undefined
    } as any);

    if (error) {
      logger.error('Postgres RPC error in calculateOrderTotalRPC', error);
      return { data: null, error: error.message };
    }

    if (!data || typeof data !== 'object') {
      return { data: null, error: 'Invalid response from pricing calculation' };
    }

    // Handle error response from RPC
    if ('error' in data && data.error) {
      return { data: null, error: data.error as string };
    }

    // Return pricing breakdown
    const result = data as any;
    return {
      data: {
        subtotal: Number(result.subtotal) || 0,
        personalizationCharges: Number(result.personalizationCharges) || 0,
        deliveryFee: Number(result.deliveryFee) || 0,
        platformFee: Number(result.platformFee) || 0,
        gst: Number(result.gst) || 0,
        discount: Number(result.discount) || 0,
        walletDiscount: Number(result.walletUsed) || 0,
        total: Number(result.total) || 0,
      },
    };
  } catch (error) {
    logger.error('Unexpected error in calculateOrderTotalRPC', error);
    return {
      data: null,
      error: error instanceof Error ? error.message : 'Failed to calculate order total',
    };
  }
}
