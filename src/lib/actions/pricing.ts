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
    item_id: string;
    quantity: number;
    variant_id?: string | null;
    personalization_option_id?: string | null;
    has_personalization?: boolean;
    selected_addons?: any[];
  }>,
  deliveryFeeOverride: number = PRICING.DELIVERY_FEE_3KM,
  addressId?: string | null,
  couponCode?: string | null,
  distanceKmParam?: number | null,
  useWallet: boolean = false,
  userId?: string | null
): Promise<{ data: PricingBreakdown | null; error?: string }> {
  try {
    const supabase = await createClient();

    // WYSHKIT 2026: Authority moves to RPC, but we can hydrate local vars for logging/overrides
    let finalDeliveryFee = deliveryFeeOverride;
    let finalDistanceKm = distanceKmParam;

    // Call Postgres RPC with standardized Swiggy 2026 parameters
    const { data, error } = await supabase.rpc('calculate_order_total', {
      p_cart_items: cartItems.map(item => ({
        item_id: item.item_id,
        quantity: item.quantity,
        variant_id: item.variant_id ?? null,
        personalization_option_id: item.personalization_option_id ?? ((item as any).personalization?.option_id || null),
        has_personalization: item.has_personalization ?? false,
        selected_addons: item.selected_addons ?? []
      })) as unknown as Json,
      p_delivery_fee_override: finalDeliveryFee,
      p_address_id: addressId || undefined,
      p_coupon_code: couponCode || undefined,
      p_distance_km: finalDistanceKm || undefined,
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
    if ('error' in data && (data as any).error) {
      return { data: null, error: (data as any).error as string };
    }

    // Return pricing breakdown with inclusive GST logic (Wyshkit 2026 Audit Fix)
    const result = data as any;
    const subtotalValue = Number(result.subtotal) || 0;
    const personalizationValue = Number(result.personalizationCharges) || 0;
    const deliveryValue = Number(result.deliveryFee) || 0;
    const platformValue = Number(result.platformFee) || 0;
    const discountValue = Number(result.discount) || 0;
    const walletValue = Number(result.walletUsed) || 0;

    // Total is simply the sum of all components minus discounts
    // In inclusive GST, GST is ALREADY part of the subtotal/charges.
    const calculatedTotal = subtotalValue + personalizationValue + deliveryValue + platformValue - discountValue - walletValue;

    return {
      data: {
        subtotal: subtotalValue,
        personalizationCharges: personalizationValue,
        deliveryFee: deliveryValue,
        platformFee: platformValue,
        gst: Number(result.gst) || 0, // Keep for display, but it's part of the items
        discount: discountValue,
        walletDiscount: walletValue,
        total: calculatedTotal,
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
