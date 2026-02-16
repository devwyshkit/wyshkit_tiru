/**
 * Address Types - Wyshkit 2026: Zero Data Mismatch
 * 
 * Uses Supabase table types directly.
 */

import type { Tables } from '@/lib/supabase/database.types';

// ✅ Use Supabase table type directly (zero data mismatch)
// ✅ Use Supabase table type directly (zero data mismatch)
export type Address = Tables<'addresses'> & {
    gstin?: string | null;
};
