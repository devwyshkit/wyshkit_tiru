/**
 * Delivery fee calculation utilities
 */

import { isHyperlocalCity } from './location';
import { calculateHaversineDistance } from './distance';

export interface DeliveryAddress {
  city?: string | null;
  latitude?: number | null;
  longitude?: number | null;
}

export interface PartnerLocation {
  latitude?: number | null;
  longitude?: number | null;
  base_delivery_charge?: number;
}

/**
 * Calculate delivery fee based on distance and hyperlocal status
 * Formula: baseCharge + (distanceKm * perKmRate) + surgeMultiplier
 */
export async function calculateDeliveryFee(
  address: DeliveryAddress | null,
  partnerLocation?: PartnerLocation | null,
  isHyperlocal?: boolean
): Promise<number> {
  // If no address, return standard fee
  if (!address) {
    return 120;
  }

  // Determine if hyperlocal (use provided value or calculate)
  const hyperlocal = isHyperlocal ?? isHyperlocalCity(address.city);

  // Base charges
  const baseCharge = partnerLocation?.base_delivery_charge ?? 30;
  const hyperlocalBaseCharge = 60;
  const standardBaseCharge = 120;

  // If hyperlocal, use fixed rate
  if (hyperlocal) {
    return hyperlocalBaseCharge;
  }

  // For non-hyperlocal, calculate distance-based fee if coordinates available
  if (partnerLocation?.latitude && partnerLocation?.longitude && address.latitude && address.longitude) {
    const distanceKm = calculateHaversineDistance(
      partnerLocation.latitude,
      partnerLocation.longitude,
      address.latitude,
      address.longitude
    );

    if (distanceKm !== null) {
      // Per km rate for standard delivery
      const perKmRate = 5;
      const distanceCharge = distanceKm * perKmRate;

      // Total: base + distance
      const total = baseCharge + distanceCharge;

      // Minimum charge is standard base
      return Math.max(total, standardBaseCharge);
    }
  }

  // Fallback to standard charge
  return standardBaseCharge;
}

/**
 * Synchronous version for client-side calculations (uses fixed rates)
 */
export function calculateDeliveryFeeSync(
  address: DeliveryAddress | null,
  isHyperlocal?: boolean
): number {
  if (!address) {
    return 120;
  }

  const hyperlocal = isHyperlocal ?? isHyperlocalCity(address.city);
  return hyperlocal ? 60 : 120;
}
