/**
 * Partner Types - Wyshkit 2026: Zero Data Mismatch
 * 
 * All types derive directly from Supabase database types.
 */

import type { Tables } from '@/lib/supabase/database.types';

// ✅ Use Supabase table type for partner data (zero data mismatch)
export type Partner = Tables<'partners'>;

export interface MappedPartner {
  id: string;
  name: string;
  imageUrl: string;
  rating?: number;
  city?: string | null;
  prepHours?: number | null;
  deliveryFee?: number | null;
  description?: string | null;
  slug?: string | null;
  businessType?: string | null;
  isOnline?: boolean;
}

// ✅ Use Supabase table type for full partner data
export type PartnerFull = Tables<'partners'>;

// ✅ UI-only list item (subset of table)
export type PartnerListItem = Tables<'partners'>;
