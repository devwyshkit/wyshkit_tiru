'use client';

import { WyshkitItem } from '@/lib/types/item';

import Link from 'next/link';
import Image from 'next/image';
import { useMemo, useState, useEffect } from 'react';
import { Sparkles, TrendingUp } from 'lucide-react';
import { cn } from '@/lib/utils';


interface QuickAccessCardProps {
  item: WyshkitItem;
  variant?: 'default' | 'large';
}

function QuickAccessCard({ item, variant = 'default' }: QuickAccessCardProps) {
  const imageUrl = item.images?.[0] || '/images/logo.png';

  // WYSHKIT 2026: Swiggy pattern - always go to store with ?item= to open item sheet
  // When no partner_id, /item/[id] does not exist; fallback to search.
  const href = useMemo(() => {
    if (!item.partner_id) return `/search?q=${encodeURIComponent(item.name || '')}`;
    return `/partner/${item.partner_id}/item/${item.id}`;
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
      <div className="absolute top-0 right-0 p-12 opacity-[0.07] pointer-events-none group-hover:scale-110 transition-transform duration-700">
        <Sparkles className="size-48 text-[var(--primary)] rotate-12" />
      </div>
      <div className="absolute top-3 left-3 px-2 py-1 bg-white/90 backdrop-blur rounded-lg flex items-center gap-1.5 shadow-sm">
        <TrendingUp className="size-3 text-[var(--primary)]" />
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
  items: WyshkitItem[];
}

/**
 * WYSHKIT 2026: Client Component for BentoBanner UI
 * Data is fetched server-side and passed as props
 */
/** WYSHKIT 2026: Time-based greeting (Swiggy pattern) */
function useTimeContext(): string | null {
  const [greeting, setGreeting] = useState<string | null>(null);

  useEffect(() => {
    const hour = new Date().getHours();
    if (hour >= 5 && hour < 12) setGreeting('Good morning');
    else if (hour >= 12 && hour < 17) setGreeting('Good afternoon');
    else if (hour >= 17 && hour < 21) setGreeting('Good evening');
    else setGreeting('Late night');
  }, []);

  return greeting;
}

export function BentoBanner({ items }: BentoBannerProps) {
  const timeContext = useTimeContext();

  if (items.length === 0) {
    return null;
  }

  return (
    <section className="px-4 md:px-8 pt-2 pb-1">
      <div className="flex items-center gap-2 mb-3">
        <div className="size-12 bg-[var(--primary)]/10 backdrop-blur-md rounded-2xl flex items-center justify-center border border-[var(--primary)]/20">
          <Sparkles className="size-6 text-[var(--primary)]" />
        </div>
        <div>
          <h2 className="text-sm font-bold text-zinc-900">Trending now {timeContext ? `· ${timeContext}` : ''}</h2>
          <p className="text-[10px] font-black text-zinc-600 uppercase tracking-widest">Popular in your area</p>
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

