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
  GST_RATE: 0.18,
  PLATFORM_FEE: 10,
  // Flat Delivery Fees Vision 2026
  DELIVERY_FEE_3KM: 40,
  DELIVERY_FEE_5KM: 50,
  DELIVERY_FEE_ABOVE_5KM: 60,
  FREE_DELIVERY_THRESHOLD: 500,
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
