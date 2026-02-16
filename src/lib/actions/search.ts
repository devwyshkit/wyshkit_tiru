import { createClient } from '@/lib/supabase/server';
import type { Item, Partner } from '@/lib/supabase/types';

interface SearchOptions {
  q?: string;
  category?: string;
  limit?: number;
}

/**
 * WYSHKIT 2026: Server-First Search (Swiggy Pattern)
 * Data comes to user - fetched server-side, streamed to client
 */
export async function searchFiltered(options: SearchOptions = {}) {
  const supabase = await createClient();
  const { q, category, limit = 20 } = options;

  // Build items query
  let itemsQuery = supabase
    .from('items')
    .select('id, name, slug, images, base_price, category, partner_id, partners!inner(name, display_name)')
    .eq('is_active', true)
    .eq('approval_status', 'approved')
    .limit(limit);

  // Apply search query
  if (q && q.length >= 2) {
    const searchPattern = `%${q}%`;
    itemsQuery = itemsQuery.or(`name.ilike.${searchPattern},category.ilike.${searchPattern}`);
  }

  // Apply category filter (Case-insensitive)
  if (category) {
    itemsQuery = itemsQuery.ilike('category', category);
  }

  // Build partners query
  let partnersQuery = supabase
    .from('partners')
    .select('id, name, slug, rating, city, display_name, image_url')
    .eq('status', 'active')
    .limit(Math.floor(limit / 2));

  // Apply search query to partners
  if (q && q.length >= 2) {
    partnersQuery = partnersQuery.ilike('name', `%${q}%`);
  }

  // WYSHKIT 2026: Parallel fetch (zero waterfall)
  const [itemsResponse, partnersResponse] = await Promise.all([
    itemsQuery,
    partnersQuery
  ]);

  return {
    items: (itemsResponse.data || []).map((item) => ({
      ...item as any,
      image: item.images?.[0] || '/images/logo.png',
      partner_name: (item as any).partners?.display_name || (item as any).partners?.name || 'Store',
      basePrice: item.base_price
    })),
    partners: (partnersResponse.data || []).map((p) => ({
      ...p as Partner,
      image: p.image_url || '/images/logo.png'
    })),
    total: (itemsResponse.data?.length || 0) + (partnersResponse.data?.length || 0)
  };
}
