'use client';

import Link from 'next/link';
import Image from 'next/image';
import { useMemo } from 'react';
import { Sparkles, TrendingUp } from 'lucide-react';
import { cn } from '@/lib/utils';

interface FeaturedItem {
  id: string;
  name: string;
  base_price: number;
  images: string[] | null;
  partner_id?: string | null;
  partner_name?: string;
}

interface QuickAccessCardProps {
  item: FeaturedItem;
  variant?: 'default' | 'large';
}

function QuickAccessCard({ item, variant = 'default' }: QuickAccessCardProps) {
  const imageUrl = item.images?.[0] || '/images/logo.png';

  // WYSHKIT 2026: Swiggy pattern - always go to store with ?item= to open item sheet
  // When no partner_id, /item/[id] does not exist; fallback to search.
  const href = useMemo(() => {
    if (!item.partner_id) return `/search?q=${encodeURIComponent(item.name || '')}`;
    return `/partner/${item.partner_id}?item=${item.id}`;
  }, [item.id, item.partner_id, item.name]);

  return (
    <Link
      href={href}
      className={cn(
        "relative overflow-hidden rounded-2xl group cursor-pointer border border-zinc-100 bg-zinc-50 shadow-sm",
        variant === 'large' ? "col-span-2 h-[160px]" : "h-[140px]"
      )}
    >
      <Image
        src={imageUrl}
        alt={item.name}
        fill
        className="object-cover transition-transform duration-200 group-hover:scale-105"
        sizes={variant === 'large' ? '(max-width: 768px) 100vw, 50vw' : '(max-width: 768px) 50vw, 33vw'}
        priority={variant === 'large'}
      />
      <div className="absolute inset-0 bg-gradient-to-t from-black/90 via-black/20 to-transparent flex flex-col justify-end p-4">
        <div className="space-y-1">
          <div className="flex items-center gap-1.5 overflow-hidden">
            <span className="text-[10px] font-bold text-white/80 uppercase tracking-wider truncate">
              {item.partner_name || 'Local store'}
            </span>
          </div>
          <div className="flex items-center justify-between gap-2">
            <h3 className="text-[15px] font-bold text-white tracking-tight leading-tight line-clamp-1 flex-1">{item.name}</h3>
            <span className="text-sm font-black text-white shrink-0">₹{item.base_price}</span>
          </div>
        </div>
      </div>
      <div className="absolute top-3 left-3 px-2 py-1 bg-white/90 backdrop-blur rounded-lg flex items-center gap-1.5 shadow-sm">
        <TrendingUp className="size-3 text-orange-600" />
        <span className="text-[10px] font-bold text-zinc-900">Trending</span>
      </div>
    </Link>
  );
}

function SkeletonCard({ variant = 'default' }: { variant?: 'default' | 'large' }) {
  return (
    <div className={cn(
      "rounded-2xl bg-zinc-100 animate-pulse",
      variant === 'large' ? "col-span-2 h-[160px]" : "h-[140px]"
    )} />
  );
}

interface BentoBannerProps {
  items: FeaturedItem[];
}

/**
 * WYSHKIT 2026: Client Component for BentoBanner UI
 * Data is fetched server-side and passed as props
 */
/** WYSHKIT 2026: Time-based greeting (Swiggy pattern) */
function useTimeContext(): string {
  return useMemo(() => {
    const hour = new Date().getHours();
    if (hour >= 5 && hour < 12) return 'Good morning';
    if (hour >= 12 && hour < 17) return 'Good afternoon';
    if (hour >= 17 && hour < 21) return 'Good evening';
    return 'Late night';
  }, []);
}

export function BentoBanner({ items }: BentoBannerProps) {
  const timeContext = useTimeContext();

  if (items.length === 0) {
    return null;
  }

  return (
    <section className="px-4 md:px-8 pt-2 pb-1">
      <div className="flex items-center gap-2 mb-3">
        <div className="size-7 rounded-lg bg-amber-100 flex items-center justify-center">
          <Sparkles className="size-3.5 text-amber-600" />
        </div>
        <div>
          <h2 className="text-sm font-bold text-zinc-900">Trending now · {timeContext}</h2>
          <p className="text-[10px] text-zinc-400">Popular in your area</p>
        </div>
      </div>

      <div className="grid grid-cols-2 gap-3">
        {items[0] && <QuickAccessCard item={items[0]} variant="large" />}
        {items[1] && <QuickAccessCard item={items[1]} />}
        {items[2] && <QuickAccessCard item={items[2]} />}
      </div>
    </section>
  );
}

