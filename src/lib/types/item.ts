/**
 * Item Types - Wyshkit 2026: Zero Data Mismatch
 * 
 * All types derive directly from Supabase database types.
 * UI-only types are kept for display transformations.
 * 
 * Hyperlocal Item Marketplace with Optional Personalization
 * (Like Apple engraving - this IS personalization, NOT customization)
 */

import type { Tables } from '@/lib/supabase/database.types';
import type { ItemWithFullSpec, PersonalizationOption as DBPersonalizationOption, Variant as DBVariant, ItemAddon as DBItemAddon } from '@/lib/supabase/types';

export type Item = Tables<'items'>;
export type ItemListItem = Tables<'items'> & {
  price?: number;
  image_url?: string;
  partner_name?: string;
  partners?: { id: string; name: string; display_name?: string } | null;
  variants?: Array<{ id: string; name: string | null; price: number | null; stock_quantity: number | null }>;
  stock_quantity?: number;
  production_time_minutes?: number;
};

export type Variant = DBVariant;
export type ItemAddon = DBItemAddon;

/**
 * WyshkitItem: The standard item shape for all discovery components.
 * Extends DB types with joined data and UI computed fields.
 */
export interface WyshkitItem extends Omit<ItemWithFullSpec, 'variants'> {
  // UI Computed & Joined fields
  price?: number;
  image_url?: string | null;
  partner_name?: string | null;
  distance_km?: number | null;
  distance_meters?: number | null;
  is_online?: boolean | null;
  is_promoted: boolean | null;
  has_personalization: boolean | null;

  // Refined types for already present fields (if needed for frontend convenience)
  variants: (DBVariant & { price: number | null; stock_quantity: number | null })[];
}

export interface PersonalizationOption {
  id: string;
  name: string;
  label?: string;
  price: number;
  description?: string;
  previewTimeMinutes?: number;
  productionTimeMinutes?: number;
  productionTimeHours?: number;
  type: 'text' | 'image' | 'both';
  required?: boolean;
  placeholder?: string;
}
