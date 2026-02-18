/**
 * Transaction Surface Types
 * Wyshkit 2026 Model - Block-based architecture
 */

import type { SelectedPersonalization } from '@/lib/types/cart';
import type { SelectedAddon } from '@/lib/types/personalization';
import type { Address } from '@/lib/types/address';
import type { PricingBreakdown } from '@/lib/constants/pricing';

export type { PricingBreakdown };

/**
 * Draft item (in-memory, before order creation)
 */
export interface DraftItem {
  itemId: string;
  variantId: string | null;
  personalization: SelectedPersonalization;
  selectedAddons?: SelectedAddon[];
  quantity: number;
}

/**
 * Draft item with display data (hydrated)
 */
export interface HydratedDraftItem extends DraftItem {
  name: string;
  image: string;
  basePrice: number;
  variantPrice: number;
  variantName?: string;
  personalizationPrice: number;
  partnerId?: string | null;
  partnerName?: string;
}

/**
 * Identity state
 */
export type IdentityState = 'checking' | 'logged-in' | 'not-logged-in' | 'verifying';

/**
 * Address commit state
 */
export interface AddressCommitState {
  address: Address | null;
  committed: boolean;
}

/**
 * Payment method
 */
export type PaymentMethod = 'upi' | 'card' | 'netbanking';
