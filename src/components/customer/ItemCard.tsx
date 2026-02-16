"use client";

import React, { useMemo, useCallback } from 'react';
import Image from 'next/image';
import { Star, Sparkles, Flame } from 'lucide-react';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { cn } from '@/lib/utils';
import { AddToCartButton } from './AddToCartButton';
import { useCart } from '@/components/customer/CartProvider';

const FALLBACK_IMAGE = '/images/logo.png';

interface ItemCardProps {
  item: any;
  className?: string;
  variant?: 'default' | 'compact' | 'cart';
  onQuickAdd?: () => void;
  partnerId?: string;
  priority?: boolean;
  /** Swiggy pattern: after add from discovery, navigate to store with item sheet open */
  navigateToStoreOnAdd?: boolean;
}

export function ItemCard({
  item,
  className,
  variant = 'default',
  partnerId,
  priority = false,
  navigateToStoreOnAdd = false,
}: ItemCardProps) {
  const router = useRouter();
  const { draftOrder } = useCart();

  const handleAfterAdd = useCallback(
    (pid: string | undefined, itemId: string) => {
      if (pid) router.push(`/partner/${pid}?item=${itemId}`);
    },
    [router]
  );
  const {
    id,
    name,
    base_price,
    price,
    mrp,
    rating,
    images,
    image_url,
    partners,
    partner_id,
    has_personalization,
    is_promoted,
    is_sponsored,
  } = item;

  const isPersonalizable = has_personalization;
  const displayPrice = price || base_price || 0;
  const displayMrp = mrp || 0;
  // WYSHKIT 2026: Extract partner data with fallbacks (Direct Supabase alignment)
  const itemPartnerId = partnerId || partner_id || (partners as any)?.id;
  const partnerName = item.partner_name || partners?.name || (partners as any)?.display_name || 'Local Store';
  const imageUrl = (images && Array.isArray(images) && images[0]) || image_url || FALLBACK_IMAGE;
  const stockQuantity = item.stock_quantity;
  const hasVariants = item.variants?.length > 0;

  // WYSHKIT 2026: Check if item is in cart (reactive to draftOrder changes)
  const cartItems = draftOrder?.items || [];
  const isInCart = useMemo(() => {
    return cartItems.some((cartItem: any) => cartItem.itemId === id) || false;
  }, [cartItems, id]);

  // WYSHKIT 2026: Store-First Navigation (Swiggy Pattern)
  // Card links to store page with ?item= for auto-open sheet. Store is the page; item is content within.
  const href = itemPartnerId
    ? `/partner/${itemPartnerId}?item=${id}`
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
            <span className="text-sm font-bold text-zinc-900 tabular-nums">₹{displayPrice}</span>
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
      <div className="relative aspect-square overflow-hidden bg-zinc-50 rounded-2xl border border-zinc-100">
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
          {is_promoted && (
            <div className="bg-white/90 backdrop-blur px-1.5 py-0.5 rounded-md shadow-sm">
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
          <div className="absolute bottom-2 left-2 max-w-[calc(100%-4rem)]">
            <div className="bg-white/90 backdrop-blur px-1.5 py-0.5 rounded-md flex items-center gap-1 shadow-sm">
              <Sparkles className="size-2.5 text-zinc-900" />
              <span className="text-[9px] font-bold text-zinc-900">Personalizable</span>
            </div>
          </div>
        )}

        {/* WYSHKIT 2026: Prevent Link navigation when clicking AddToCartButton */}
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
            isPersonalizable={isPersonalizable}
            hasVariants={hasVariants}
            onAfterAdd={navigateToStoreOnAdd ? handleAfterAdd : undefined}
          />
        </div>
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
            <Flame className={cn("size-3", urgencySignal.type === 'scarcity' ? "text-orange-500" : "text-emerald-500")} />
            <span className={cn(
              "text-[10px] font-bold",
              urgencySignal.type === 'scarcity' ? "text-orange-600" : "text-emerald-600"
            )}>
              {urgencySignal.text}
            </span>
          </div>
        )}

        <div className="flex items-center gap-1.5 mt-1.5">
          <span className="text-sm font-bold text-zinc-900 tabular-nums">₹{displayPrice}</span>
          {displayMrp > displayPrice && (
            <span className="text-[10px] text-zinc-400 line-through font-medium">₹{displayMrp}</span>
          )}
        </div>
      </div>
    </>
  );

  return (
    <Link
      href={href}
      className={cardClassName}
      prefetch={false}
      scroll={false}
    >
      {cardContent}
    </Link>
  );
}
