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

export type Variant = Tables<'variants'>;

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
