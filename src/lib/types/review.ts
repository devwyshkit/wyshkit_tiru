/**
 * Review Types - Wyshkit 2026: Zero Data Mismatch
 * 
 * Note: If item_reviews table exists in Supabase, use Tables<'item_reviews'> instead.
 * For now, keeping minimal types for UI operations.
 */

// ✅ UI-only types for review operations
// TODO: Replace with Tables<'item_reviews'> when table is confirmed in database.types.ts
export interface ItemReview {
  id: string;
  item_id: string;
  user_id: string;
  rating: number;
  comment: string | null;
  images: string[] | null;
  created_at: string;
  updated_at: string;
  user?: {
    full_name: string | null;
    avatar_url: string | null;
  };
}

export interface CreateReviewInput {
  item_id: string;
  rating: number;
  comment?: string;
  images?: string[];
}
