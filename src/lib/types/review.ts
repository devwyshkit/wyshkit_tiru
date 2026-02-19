import type { Database } from '@/lib/supabase/database.types';

type Tables<T extends keyof Database['public']['Tables']> = Database['public']['Tables'][T]['Row'];

/**
 * Review Types - Wyshkit 2026: Zero Data Mismatch
 */

// ✅ UI-optimized types for review operations
export type ItemReview = Tables<'item_reviews'> & {
  user?: {
    full_name: string | null;
    avatar_url: string | null;
  };
};

export interface CreateReviewInput {
  item_id: string;
  rating: number;
  comment?: string;
  images?: string[];
}
