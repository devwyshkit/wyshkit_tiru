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
export type ItemListItem = Tables<'items'>;

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
