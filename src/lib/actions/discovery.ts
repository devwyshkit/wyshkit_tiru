'use server';

import { createClient } from '@/lib/supabase/server';
import { logger } from '@/lib/logging/logger';
import { logError } from '@/lib/utils/error-handler';
import { DBPartner, DBItem } from '@/lib/supabase/types';
import { Database } from '@/lib/supabase/database.types';
import { MappedPartner } from '@/lib/types/partner';

// Define explicit types for Tables and Queries
interface TrendingItemView {
  id: string;
  name: string;
  basePrice: number | null;
  images: string[] | null;
  partnerId: string | null;
  businessName: string | null;
  // properties to allow safe discrimination
  base_price?: never;
}

type ItemWithPartner = Pick<DBItem, 'id' | 'name' | 'base_price' | 'mrp' | 'images' | 'partner_id' | 'has_personalization'> & {
  partners: Pick<DBPartner, 'id' | 'name' | 'display_name'> | null;
  is_online?: boolean; // From join or view
  rating?: number; // From view or join
  // properties to allow safe discrimination
  basePrice?: never;
};

// WYSHKIT 2026: Centralized mapping helpers to prevent schema leaks
function mapTrendingItem(item: ItemWithPartner | TrendingItemView) {
  // Guard for View type
  if ('basePrice' in item && item.basePrice !== undefined) {
    const viewItem = item as TrendingItemView;
    return {
      id: viewItem.id,
      name: viewItem.name || 'Product',
      base_price: viewItem.basePrice || 0,
      mrp: 0,
      images: viewItem.images || [],
      partner_id: viewItem.partnerId,
      partner_name: viewItem.businessName || 'Local Store',
      rating: 0,
      is_online: true,
      has_personalization: false,
    };
  }

  // DB Item Type
  const dbItem = item as ItemWithPartner;
  return {
    id: dbItem.id,
    name: dbItem.name || 'Product',
    base_price: dbItem.base_price || 0,
    mrp: dbItem.mrp || 0,
    images: dbItem.images || [],
    partner_id: dbItem.partner_id || (dbItem.partners?.id),
    partner_name: dbItem.partners?.display_name || dbItem.partners?.name || 'Local Store',
    rating: dbItem.rating || 0,
    is_online: dbItem.is_online ?? true,
    has_personalization: dbItem.has_personalization || false,
  };
}

interface DBRowPartner extends Pick<DBPartner, 'id' | 'name' | 'display_name' | 'rating' | 'city' | 'is_online'> {
  image_url?: string | null;
  logo_url?: string | null;
  prep_hours?: number | null;
  prepHours?: number | null;
  delivery_fee?: number | null;
  deliveryFee?: number | null;
  slug?: string | null;
  business_type?: string | null;
  description?: string | null;
}

function mapPartner(p: DBRowPartner): MappedPartner {
  return {
    id: p.id,
    name: p.display_name || p.name || 'Local Store',
    imageUrl: p.image_url || p.logo_url || '/images/logo.png',
    rating: p.rating || 0,
    city: p.city,
    // WYSHKIT 2026: Hyperlocal first. 24h is a legacy anti-pattern. 
    // Defaulting to 45 mins (0.75h) if not specified.
    prepHours: p.prep_hours || p.prepHours || 0.75,
    deliveryFee: p.delivery_fee || p.deliveryFee || 40,
    slug: p.slug,
    businessType: p.business_type || 'Store',
    isOnline: p.is_online ?? true,
    description: p.description,
  };
}

export async function getNearbyDiscovery(lat: number, lng: number, radiusKm: number = 5) {
  const supabase = await createClient();

  // WYSHKIT 2026: Bypass generated type issue for RPC with arguments
  const { data: nearbyItems, error } = await (supabase as any).rpc('get_nearby_items', {
    user_lat: lat,
    user_lng: lng,
    radius_km: radiusKm
  });

  if (error) {
    logger.error('Failed to get nearby items in getNearbyDiscovery', error);
    return { items: [], error: error.message };
  }

  // RPC returns any (Json), so we map it safely
  // RPC result structure needs to be handled ad-hoc since it's a function result
  const items = (nearbyItems as any[] || []).map((item: any) => ({
    id: item.item_id,
    name: item.item_name,
    base_price: item.base_price,
    mrp: 0,
    images: item.images,
    partner_id: item.partner_id,
    partner_name: item.businessName || item.partner_name,
    rating: item.rating,
    is_online: (item as any).is_online,
    has_personalization: (item as any).has_personalization,
    distance_km: item.distance_km
  }));
  return { items, error: null };
}

export async function getHomeDiscovery(lat?: number, lng?: number) {
  try {
    const supabase = await createClient();

    // Categories
    const { data: categories, error: catError } = await (supabase as any)
      .from('categories')
      .select('id, name, slug, image_url, display_order')
      .eq('is_active', true)
      .order('display_order');

    if (catError) {
      logError(catError, 'GetHomeDiscoveryCategories');
    }

    const hour = new Date().getHours();
    let timeContext = 'Fresh';

    if (hour >= 5 && hour < 12) timeContext = 'Morning';
    else if (hour >= 12 && hour < 17) timeContext = 'Daylight';
    else if (hour >= 17 && hour < 21) timeContext = 'Evening';
    else if (hour >= 21 || hour < 5) timeContext = 'Night';

    let trendingItems: any[] | undefined;

    if (lat && lng) {
      const { data: nearbyItems, error: nearbyError } = await (supabase as any).rpc('get_nearby_items', {
        user_lat: lat,
        user_lng: lng,
        radius_km: 10
      });

      if (nearbyError) {
        logError(nearbyError, 'GetHomeDiscoveryNearby');
      } else if (nearbyItems && (nearbyItems as any[]).length > 0) {
        trendingItems = (nearbyItems as any[]).map((item: any) => ({
          id: item.item_id,
          name: item.item_name,
          base_price: item.base_price,
          mrp: 0,
          images: item.images,
          partner_id: item.partner_id,
          partner_name: item.partner_name,
          has_personalization: item.has_personalization,
          is_online: item.is_online,
          rating: item.rating,
          distance_km: item.distance_km,
        }));
      }
    }

    if (!trendingItems) {
      trendingItems = [];
    }

    return {
      categories: categories || [],
      trendingItems: trendingItems || [],
      timeContext
    };
  } catch (error) {
    logError(error, 'GetHomeDiscovery');
    return {
      categories: [],
      trendingItems: [],
      error: error instanceof Error ? error.message : 'Failed to fetch discovery data',
      timeContext: 'Fresh'
    };
  }
}

export async function getCategories() {
  const supabase = await createClient();
  const { data } = await (supabase as any)
    .from('categories')
    .select('id, name, slug, image_url')
    .eq('is_active', true)
    .order('display_order');
  return data || [];
}

export async function getTrendingItems() {
  const supabase = await createClient();
  // WYSHKIT 2026: Cast to any because v_trending_items is missing in types
  const { data } = await (supabase as any)
    .from('v_trending_items')
    .select('id, name, "basePrice", images, "partnerId", "businessName"')
    .limit(15);

  return ((data as unknown as TrendingItemView[]) || []).map(mapTrendingItem);
}

export async function getFeaturedPartners(limit: number = 8) {
  const supabase = await createClient();

  const { data, error } = await supabase
    .from('partners')
    .select('id, name, display_name, image_url, rating, city, prep_hours, delivery_fee, slug, business_type, is_online, description')
    .eq('status', 'active')
    .limit(limit);

  if (error) {
    logger.error('Failed to get featured partners', error);
    return { data: [], error: error.message };
  }

  // WYSHKIT 2026: Strict deduplication by ID to prevent repeated store cards
  const uniquePartnersMap = new Map<string, MappedPartner>();

  if (data) {
    (data as any[]).forEach((p) => {
      if (!uniquePartnersMap.has(p.id)) {
        uniquePartnersMap.set(p.id, mapPartner(p as DBRowPartner));
      }
    });
  }

  return { data: Array.from(uniquePartnersMap.values()), error: null };
}

export async function getFeaturedItems(limit: number = 3) {
  try {
    const supabase = await createClient();

    const { data, error } = await supabase
      .from('items')
      .select(`
        id,
        name,
        base_price,
        images,
        partner_id,
        partners:partners(name, display_name)
      `)
      .eq('is_active', true)
      .eq('approval_status', 'approved')
      .order('created_at', { ascending: false })
      .limit(limit);

    if (error) {
      logger.error('Failed to get featured items', error, { limit });
      return { items: [], error: error.message };
    }

    const items = (data as unknown as ItemWithPartner[] || []).map((item) => ({
      id: item.id,
      name: item.name,
      base_price: item.base_price || 0,
      images: item.images,
      partner_id: item.partner_id,
      partner_name: item.partners?.display_name || item.partners?.name,
    }));

    return { items, error: null };
  } catch (error) {
    logger.error('Unexpected error in getFeaturedItems', error);
    return { items: [], error: 'Failed to fetch featured items' };
  }
}

export async function getPartnerStoreData(partnerId: string, includeInactive = false) {
  try {
    const supabase = await createClient();

    const [partnerRes, itemsRes] = await Promise.all([
      supabase
        .from('partners')
        .select(`
          id,
          name,
          display_name,
          description,
          image_url,
          rating,
          city,
          prep_hours,
          delivery_fee,
          status,
          is_active,
          slug,
          business_type,
          is_online
        `)
        .eq('id', partnerId)
        .maybeSingle(),
      (async () => {
        let itemsQuery = supabase
          .from('items')
          .select(`
            id,
            name,
            description,
            base_price,
            images,
            category,
            is_active,
            approval_status,
            partner_id,
            has_personalization,
            personalization_options(*),
            production_time_minutes,
            variants(id, name, price, stock_quantity)
          `)
          .eq('partner_id', partnerId)
          .eq('approval_status', 'approved')
          .order('category');

        if (!includeInactive) {
          itemsQuery = itemsQuery.eq('is_active', true);
        }

        return itemsQuery.order('category');
      })()
    ]);

    const { data: partnerData, error: partnerError } = partnerRes;
    const { data: itemsData, error: itemsError } = await itemsRes;

    if (partnerError) {
      logger.error('Partner fetch failed in getPartnerStoreData', partnerError, { partnerId });
      return { partner: null, items: [], error: partnerError.message };
    }

    if (!partnerData) {
      return { partner: null, items: [], error: 'Partner not found' };
    }

    if (itemsError) {
      logger.error('Items fetch failed in getPartnerStoreData', itemsError, { partnerId });
    }

    const partner = mapPartner(partnerData as unknown as DBRowPartner);
    const items = itemsData || [];

    return {
      partner,
      items,
      error: null
    };
  } catch (error) {
    logger.error('Unexpected error in getPartnerStoreData', error, { partnerId });
    return { partner: null, items: [], error: 'Failed to fetch partner store data' };
  }
}
