import React from 'react';
import Image from 'next/image';
import { Star, MapPin } from 'lucide-react';
import { cn } from '@/lib/utils';
import { MorphLink } from '@/components/ui/MorphLink';

const FALLBACK_IMAGE = '/images/logo-horizontal.png';

interface PartnerCardProps {
  id: string;
  name: string;
  rating?: number;
  city?: string | null;
  imageUrl: string | null;
  className?: string;
  variant?: 'portrait' | 'landscape' | 'row';
  priority?: boolean;
}

/**
 * WYSHKIT 2026: Unified Partner Surface
 * Swiggy 2026 Pattern: One component, multiple variants (DRY)
 */
export function PartnerCard({
  id,
  name,
  rating,
  city,
  imageUrl,
  className,
  variant = 'portrait',
  priority = false,
}: PartnerCardProps) {
  const isPortrait = variant === 'portrait';
  const isLandscape = variant === 'landscape';
  const isRow = variant === 'row';

  const content = (
    <div
      style={{ viewTransitionName: `partner-${id}` }}
      className={cn(
        "relative rounded-2xl overflow-hidden shadow-sm border border-zinc-100 bg-zinc-50 transition-all group-hover:shadow-md",
        isPortrait && "aspect-[4/5]",
        isLandscape && "aspect-[16/9] w-full",
        isRow && "flex items-center gap-3 p-3 w-full"
      )}
    >
      <div className={cn(
        "relative",
        isRow ? "size-14 shrink-0 rounded-lg overflow-hidden" : "inset-0 absolute"
      )}>
        <Image
          src={imageUrl || FALLBACK_IMAGE}
          alt={name}
          fill
          className="object-cover group-hover:scale-105 transition-transform duration-700"
          loading={priority ? undefined : "lazy"}
          priority={priority}
          sizes={isRow ? "56px" : "(max-width: 640px) 200px, 300px"}
        />
        {!isRow && <div className="absolute inset-0 bg-gradient-to-t from-black/80 via-black/20 to-transparent" />}
      </div>

      <div className={cn(
        isRow ? "flex-1 min-w-0" : "absolute bottom-3 left-3 right-3"
      )}>
        <div className="space-y-0.5">
          <div className="flex items-center gap-1.5 flex-wrap">
            <span className={cn(
              "text-[9px] font-bold uppercase tracking-wider",
              isRow ? "text-zinc-500" : "text-white/80"
            )}>
              {city || 'Local Store'}
            </span>
            {rating && (
              <div className="flex items-center gap-0.5 bg-amber-400 px-1 rounded-sm">
                <Star className="size-2 fill-zinc-950 text-zinc-950" />
                <span className="text-[9px] font-black text-zinc-950">{rating.toFixed(1)}</span>
              </div>
            )}
          </div>
          <h4 className={cn(
            "font-bold leading-tight line-clamp-1",
            isRow ? "text-sm text-zinc-900" : "text-xs text-white"
          )}>
            {name}
          </h4>
        </div>
      </div>
    </div>
  );

  return (
    <MorphLink
      href={`/partner/${id}`}
      className={cn("flex flex-col cursor-pointer group transition-all", className)}
      prefetch={false}
      morphId={id}
      morphName="partner"
    >
      {content}
    </MorphLink>
  );
}
