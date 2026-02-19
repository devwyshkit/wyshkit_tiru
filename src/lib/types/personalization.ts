/**
 * Personalization Types - Wyshkit 2026
 * 
 * Hyperlocal Item Marketplace with Optional Personalization
 * Like Apple engraving - this IS personalization, NOT customization (we don't customize items, we personalize them)
 * 
 * This file contains ONLY personalization-related types.
 * Draft transaction types are in @/surfaces-customer/transaction/types.ts
 */

export interface PersonalizationConfig {
  allow_text?: boolean;
  text_required?: boolean;
  text_label?: string;
  char_limit?: number;
  placeholder?: string;
  allow_image?: boolean;
  image_required?: boolean;
  instructions?: string;
}

export interface SelectedPersonalization {
  enabled: boolean;
  optionId?: string;
  text?: string;
  fileUrl?: string;
  instructions?: string;
  price?: number;
}

export interface SelectedAddon {
  id: string;
  name: string;
  price: number;
  requires_preview?: boolean;
}

export interface DraftLineItem {
  id: string;
  itemId: string;
  itemName: string;
  itemImage?: string | null;
  quantity: number;
  unitPrice: number;
  totalPrice: number;
  selectedVariantId: string | null;
  personalization?: SelectedPersonalization;
  selectedAddons?: SelectedAddon[];
  partnerName?: string;
  partnerId?: string | null;
  partnerLatitude?: number | null;
  partnerLongitude?: number | null;
  // WYSHKIT 2026: Hydration fields for Checkout
  basePrice?: number;
  variantPrice?: number;
  variantName?: string;
  personalizationPrice?: number;
  addonsPrice?: number;
  // WYSHKIT 2026: Metadata for hasItemPersonalization and IdentityForm
  personalization_options?: any[];
  item_addons?: any[];
  is_personalized?: boolean;
  personalization_details?: any;
}

export interface DraftTransaction {
  items: DraftLineItem[];
  partnerId: string | null;
  subtotal: number;
  total: number;
  itemCount: number;
}
