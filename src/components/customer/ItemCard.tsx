"use client";

import React, { useMemo } from 'react';
import Image from 'next/image';
import { Star, Sparkles, Flame } from 'lucide-react';
import Link from 'next/link';
import { cn } from '@/lib/utils';
import { AddToCartButton } from './AddToCartButton';
import { useCart } from '@/components/customer/CartProvider';
import { triggerHaptic, HapticPattern } from '@/lib/utils/haptic';
import { calculateTravelTime } from '@/lib/utils/distance';
import { formatCurrency } from '@/lib/utils/pricing';
import { hasItemPersonalization } from '@/lib/utils/personalization';

import { ItemListItem } from '@/lib/types/item';

const FALLBACK_IMAGE = '/images/logo.png';

interface ItemCardProps {
  item: any; // Relaxed for flexible store/search/home usage in Swiggy 2026 Shift
  className?: string;
  variant?: 'default' | 'compact' | 'cart';
  onQuickAdd?: () => void;
  partnerId?: string;
  priority?: boolean;
}

export function ItemCard({
  item,
  className,
  variant = 'default',
  partnerId,
  priority = false,
}: ItemCardProps) {
  const { draftOrder } = useCart();

  const {
    id,
    name,
    base_price,
    mrp,
    rating,
    images,
  } = item;

  const isPersonalizable = hasItemPersonalization(item);
  const displayPrice = item.price || base_price || 0;
  const displayMrp = mrp || 0;

  const itemPartnerId = partnerId || item.partner_id || item.partners?.id;
  const partnerName = item.partner_name || item.partners?.display_name || item.partners?.name || 'Local Store';
  const imageUrl = (images && Array.isArray(images) && images[0]) || item.image_url || FALLBACK_IMAGE;
  const stockQuantity = item.stock_quantity;
  const hasVariants = (item.variants?.length ?? 0) > 0;

  const cartItems = draftOrder?.items || [];
  const isInCart = useMemo(() => {
    return cartItems.some((cartItem: any) => cartItem.itemId === id) || false;
  }, [cartItems, id]);

  const href = itemPartnerId
    ? `/partner/${itemPartnerId}/item/${id}`
    : `/search?q=${encodeURIComponent(name)}`;

  const deliverySignal = (() => {
    if (item.category?.toLowerCase() === 'flowers' || item.category?.toLowerCase() === 'cakes') {
      return { type: 'fast', text: 'Perishable: Fast SLA', icon: <Flame className="size-3 text-orange-500" /> };
    }
    if (item.production_time_minutes && item.production_time_minutes <= 45) {
      return { type: 'fast', text: `${item.production_time_minutes} mins prep`, icon: <Sparkles className="size-3 text-emerald-500" /> };
    }
    return null;
  })();

  const urgencySignal = (() => {
    if (typeof stockQuantity === 'number' && stockQuantity > 0 && stockQuantity <= 3) {
      return { type: 'scarcity', text: `Only ${stockQuantity} left` };
    }
    return null;
  })();

  if (variant === 'cart') {
    return (
      <div className={cn("flex gap-3 p-2 bg-zinc-50 rounded-xl", className)}>
        <div className="relative size-14 bg-white rounded-lg overflow-hidden shrink-0">
          <Image src={imageUrl} alt={name} fill className="object-cover" sizes="56px" />
        </div>
        <div className="flex-1 flex flex-col min-w-0 py-0.5">
          <h3 className="text-[13px] font-semibold text-zinc-900 truncate leading-tight tracking-tight">{name}</h3>
          <p className="text-[11px] font-medium text-zinc-400 mt-0.5">{partnerName}</p>
          <div className="mt-auto">
            <span className="text-sm font-bold text-zinc-900 tabular-nums">{formatCurrency(displayPrice)}</span>
          </div>
        </div>
      </div>
    );
  }

  const cardClassName = cn(
    "flex flex-col group font-sans relative transition-transform duration-300 ease-out hover:scale-[1.02] active:scale-[0.99]",
    className
  );

  const cardContent = (
    <>
      <div className="relative aspect-square overflow-hidden bg-muted/30 rounded-2xl border border-border/50">
        <div className="relative size-full">
          <Image
            src={imageUrl}
            alt={name}
            fill
            className="object-cover transition-transform duration-300 group-hover:scale-105"
            loading={priority ? undefined : "lazy"}
            priority={priority}
            sizes="(max-width: 640px) 50vw, (max-width: 1024px) 33vw, 20vw"
          />
        </div>

        <div className="absolute top-2 left-2 flex flex-col gap-1 items-start max-w-[calc(100%-4rem)]">
          {item.is_promoted && (
            <div className="bg-white/70 backdrop-blur-md px-1.5 py-0.5 rounded-md shadow-sm border border-white/20">
              <span className="text-[9px] font-bold text-amber-600">Featured</span>
            </div>
          )}
          {rating && rating >= 4.0 && (
            <div className="flex items-center gap-0.5 bg-green-600 px-1.5 py-0.5 rounded-md shadow-sm">
              <span className="text-[11px] font-bold text-white">{rating.toFixed(1)}</span>
              <Star className="size-2.5 fill-white text-white" />
            </div>
          )}
        </div>

        {isPersonalizable && (
          <div className="absolute bottom-2 left-2 max-w-[calc(100%-4rem)] animate-in slide-in-from-left-2 duration-500">
            <div className="bg-[#D91B24]/10 backdrop-blur-md px-2 py-0.5 rounded-md flex items-center gap-1 shadow-sm border border-[#D91B24]/20">
              <Sparkles className="size-2.5 text-[#D91B24]" />
              <span className="text-[9px] font-black text-[#D91B24] uppercase tracking-tighter">Identity Enabled</span>
            </div>
          </div>
        )}

        {((typeof stockQuantity === 'number' && stockQuantity <= 0) || item.stock_status === 'out_of_stock') ? (
          <div className="absolute bottom-2 right-2 z-10 bg-white/90 backdrop-blur px-2 py-1 rounded-lg border border-zinc-100 shadow-sm">
            <span className="text-[10px] font-black text-zinc-400 uppercase tracking-tight">Out of Stock</span>
          </div>
        ) : (
          <div
            className="absolute bottom-2 right-2 z-10"
            onClick={(e) => e.stopPropagation()}
            onMouseDown={(e) => e.stopPropagation()}
          >
            <AddToCartButton
              itemId={id}
              itemName={name}
              itemImage={imageUrl}
              unitPrice={displayPrice}
              partnerId={itemPartnerId}
              partnerName={partnerName}
              isIdentityAvailable={isPersonalizable}
              hasVariants={hasVariants}
            />
          </div>
        )}
      </div>

      <div className="mt-1.5 px-0.5">
        <h3 className="text-[13px] font-semibold text-zinc-900 line-clamp-2 leading-tight tracking-tight group-hover:text-zinc-600 transition-colors">
          {name}
        </h3>
        <p className="text-[10px] font-medium text-zinc-400 truncate mt-0.5">
          {partnerName || 'Local store'}
        </p>

        {deliverySignal && (
          <div className="flex items-center gap-1 mt-1">
            {deliverySignal.icon}
            <span className={cn(
              "text-[10px] font-bold",
              deliverySignal.type === 'fast' ? "text-orange-600" : "text-emerald-600"
            )}>
              {deliverySignal.text}
            </span>
          </div>
        )}

        {urgencySignal && (
          <div className="flex items-center gap-1 mt-1">
            <Flame className={cn("size-3", urgencySignal.type === 'scarcity' ? "text-amber-500" : "text-emerald-500")} />
            <span className={cn(
              "text-[10px] font-bold",
              urgencySignal.type === 'scarcity' ? "text-amber-600" : "text-emerald-600"
            )}>
              {urgencySignal.text}
            </span>
          </div>
        )}

        {(() => {
          const travelTime = calculateTravelTime(item.distance_km || (item.distance_meters ? item.distance_meters / 1000 : undefined));
          if (!travelTime) return null;
          return (
            <div className="flex items-center gap-1.5 mt-1.5 px-0.5">
              <Clock className="size-3 text-zinc-400" />
              <span className="text-[9px] font-black text-zinc-500 uppercase tracking-widest">
                {travelTime.min}-{travelTime.max} mins
              </span>
            </div>
          );
        })()}

        <div className="flex items-center gap-2 mt-2 px-0.5 flex-wrap">
          <span className="text-sm font-black text-foreground tabular-nums tracking-tighter">{formatCurrency(displayPrice)}</span>
          {displayMrp > displayPrice && (
            <div className="flex items-center gap-1.5">
              <span className="text-[10px] text-muted-foreground line-through font-bold opacity-30">{formatCurrency(displayMrp)}</span>
              <span className="text-[10px] font-black text-emerald-600 uppercase tracking-tighter bg-emerald-50 px-1.5 py-0.5 rounded-md">
                {Math.round(((displayMrp - displayPrice) / displayMrp) * 100)}% OFF
              </span>
            </div>
          )}
        </div>
      </div>
    </>
  );

  return (
    <Link
      href={href}
      className={cardClassName}
      prefetch={true}
      scroll={false}
      onClick={() => {
        // WYSHKIT 2026: Momentum Haptic
        triggerHaptic(HapticPattern.ACTION);
      }}
    >
      {cardContent}
    </Link>
  );
}
