import { Suspense } from 'react';
import { getFilteredItems } from "@/lib/actions/item-actions";
import { getCategories, getFeaturedPartners, getFeaturedItems, getHomeDiscovery } from "@/lib/actions/discovery";
import { getServerLocation } from "@/lib/actions/location";
import { HomeSkeleton } from "@/components/customer/home/HomeSkeleton";
import { CategoryRail } from "@/components/customer/home/CategoryRail";
import { BentoBanner } from "@/components/customer/home/BentoBanner";
import { HeroCarousel } from "@/components/customer/home/HeroCarousel";
import { ReorderWidget } from "@/components/customer/home/ReorderWidget";
import { DiscoveryItemsGrid } from "@/components/customer/home/DiscoveryItemsGrid";
import { PartnerCard } from "@/components/customer/PartnerCard";
import { MappedPartner } from "@/lib/types/partner";

interface HomePageProps {
  searchParams: Promise<{ category?: string }>;
}

export const experimental_ppr = true;

export default async function HomePage({ searchParams }: HomePageProps) {
  const { category = null } = await searchParams;

  return (
    <div className="min-h-screen max-w-[1440px] mx-auto animate-in font-sans selection:bg-[#D91B24]/10">
      <main>
        {/* Categories Rail - Static Shell, Dynamic Items */}
        <Suspense fallback={<CategoryRail categories={[]} selectedCategory={category} />}>
          <AsyncCategoryRail category={category} />
        </Suspense>

        {/* Hero Banner - skip Suspense when category (component returns null) */}
        {category ? null : (
          <Suspense fallback={<div className="px-4 pb-3 md:px-8"><div className="w-full h-48 md:h-64 bg-zinc-50 rounded-3xl animate-pulse" /></div>}>
            <AsyncBentoBanner category={category} />
          </Suspense>
        )}

        {!category && <ReorderWidget />}

        {/* Stores near you - skip Suspense when category (component returns null) */}
        {category ? null : (
          <Suspense fallback={<div className="px-4 py-4 md:px-8"><div className="w-48 h-6 bg-zinc-100 rounded mb-6 animate-pulse" /><div className="flex gap-4 overflow-hidden"><div className="w-32 h-40 bg-zinc-50 rounded-xl" /><div className="w-32 h-40 bg-zinc-50 rounded-xl" /></div></div>}>
            <AsyncFeaturedPartners category={category} />
          </Suspense>
        )}

        {/* Items Grid - Suspense */}
        <Suspense fallback={<HomeSkeleton />}>
          <AsyncDiscoveryGrid category={category} />
        </Suspense>
      </main>
    </div>
  );
}

/**
 * WYSHKIT 2026: Async Components for PPR Streaming
 */

async function AsyncCategoryRail({ category }: { category: string | null }) {
  const categories = await getCategories();
  return <CategoryRail categories={categories} selectedCategory={category} />;
}

async function AsyncBentoBanner({ category }: { category: string | null }) {
  if (category) return null;
  const location = await getServerLocation();
  let items: { id: string; name: string; base_price: number; images: string[] | null; partner_id: string | null; partner_name?: string }[] = [];
  if (location.lat != null && location.lng != null) {
    const discovery = await getHomeDiscovery(location.lat, location.lng);
    items = (discovery.trendingItems || []).slice(0, 3).map((t) => ({
      id: t.id,
      name: t.name,
      base_price: t.base_price,
      images: t.images ?? null,
      partner_id: t.partner_id ?? null,
      partner_name: t.partner_name,
    }));
  }
  if (items.length === 0) {
    const featuredRes = await getFeaturedItems(3);
    items = featuredRes.items || [];
  }
  return (
    <>
      {items.length > 0 ? (
        <div className="slide-in-from-bottom-2 [animation-delay:0.05s]">
          <BentoBanner items={items} />
        </div>
      ) : (
        <HeroCarousel />
      )}
    </>
  );
}

async function AsyncFeaturedPartners({ category }: { category: string | null }) {
  if (category) return null;
  const partnersRes = await getFeaturedPartners(8);
  const partners = partnersRes.data || [];
  if (partners.length === 0) return null;

  return (
    <section className="px-4 pt-3 pb-4 md:px-8 bg-zinc-50/50 border-y border-zinc-100/50 slide-in-from-bottom-2 [animation-delay:0.1s]">
      <div className="flex flex-col mb-6">
        <h2 className="text-lg md:text-xl font-semibold text-zinc-900">Featured Stores</h2>
        <p className="text-xs text-zinc-500 mt-0.5">Local stores on WyshKit</p>
      </div>

      <div className="flex gap-4 md:gap-6 overflow-x-auto no-scrollbar -mx-4 px-4 pb-2">
        {partners.map((partner: MappedPartner) => (
          <PartnerCard
            key={partner.id}
            id={partner.id}
            name={partner.name}
            city={partner.city}
            imageUrl={partner.imageUrl}
            rating={partner.rating}
            className="w-[140px] md:w-[180px] shrink-0"
          />
        ))}
      </div>
    </section>
  );
}

async function AsyncDiscoveryGrid({ category }: { category: string | null }) {
  const location = await getServerLocation();
  const categoriesRes = await getCategories();
  const selectedCategoryName = category
    ? (categoriesRes.find((c: any) => c.slug === category) as any)?.name
    : null;

  let initialItems: any[] = [];
  if (location.lat != null && location.lng != null && !category) {
    const discovery = await getHomeDiscovery(location.lat, location.lng);
    initialItems = (discovery.trendingItems || []).slice(0, 12).map((t) => ({
      id: t.id,
      name: t.name,
      base_price: t.base_price,
      mrp: t.mrp,
      images: t.images,
      partner_id: t.partner_id,
      partner_name: t.partner_name,
      has_personalization: t.has_personalization,
      partners: t.partner_name ? { name: t.partner_name } : null,
    }));
  }
  if (initialItems.length === 0) {
    const itemsRes = await getFilteredItems({ limit: 12, category: category || undefined });
    initialItems = itemsRes.data?.items || [];
  }

  if (initialItems.length === 0) {
    return (
      <section className="px-4 py-16 md:px-8">
        <div className="flex flex-col items-center justify-center py-16 px-4">
          <div className="size-16 rounded-full bg-zinc-100 flex items-center justify-center mb-4">
            <svg className="size-6 text-zinc-300" fill="none" viewBox="0 0 24 24" stroke="currentColor">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M20 13V6a2 2 0 00-2-2H6a2 2 0 00-2 2v7m16 0v5a2 2 0 01-2 2H6a2 2 0 01-2-2v-5m16 0h-2.586a1 1 0 00-.707.293l-2.414 2.414a1 1 0 01-.707.293h-3.172a1 1 0 01-.707-.293l-2.414-2.414A1 1 0 006.586 13H4" />
            </svg>
          </div>
          <p className="text-sm text-zinc-500 text-center mb-2">No items found</p>
          <p className="text-xs text-zinc-400 text-center">Check back soon for new products</p>
        </div>
      </section>
    );
  }

  return (
    <DiscoveryItemsGrid
      initialItems={initialItems}
      category={category}
      categoryName={selectedCategoryName}
    />
  );
}

