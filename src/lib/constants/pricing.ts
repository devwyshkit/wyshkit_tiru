/**
 * Wyshkit 2026 Unified Pricing Constants
 * Hyperlocal Item Marketplace with Optional Personalization
 * 
 * CONSTRAINTS:
 * - 100% advance payment (no COD)
 * - Flat delivery fee for non-personalized items
 * - Shadowfax handles all delivery
 */
export const PRICING = {
  PLATFORM_FEE: 10,
  // Wyshkit 2026: Unified Slab-Based Delivery Fees
  DELIVERY_FEE_3KM: 40,
  DELIVERY_FEE_5KM: 60,
  DELIVERY_FEE_ABOVE_5KM: 80,
  HIGH_VALUE_INSURANCE: 20,
  HIGH_VALUE_THRESHOLD: 50000,
  PERSONALIZATION_FEE: 50,
} as const;


export interface PricingBreakdown {
  subtotal: number;
  personalizationCharges: number;
  deliveryFee: number;
  platformFee: number;
  gst: number;
  discount: number;         // Added for coupons
  walletDiscount: number;   // Added for wallet
  total: number;
}
