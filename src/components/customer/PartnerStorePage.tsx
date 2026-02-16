'use client';

import React, { useState, useEffect, useRef } from 'react';
import { useSearchParams } from 'next/navigation';
import { Star, Clock, MapPin } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { MappedPartner } from '@/lib/types/partner';
import type { ItemListItem } from '@/lib/types/item';

/** Store page items: partial item shape from getPartnerStoreData select */
type StorePageItem = Pick<ItemListItem, 'id' | 'name' | 'base_price' | 'images' | 'category' | 'partner_id' | 'has_personalization' | 'approval_status'> & Partial<ItemListItem> & { variants?: Array<{ id: string; name: string | null; price: number | null; stock_quantity: number | null }> };
import { ItemCard } from '@/components/customer/ItemCard';
import { ContextualGrid } from '@/components/customer/ContextualGrid';
import { ShareButton } from '@/components/ui/ShareButton';
import Image from 'next/image';
import { useRouter } from 'next/navigation';
import { Sheet, SheetContent, SheetTitle } from '@/components/ui/sheet';
import { ItemDetailView } from '@/components/customer/item/ItemDetailView';
import { getItemWithFullSpec } from '@/lib/actions/item-actions';
import { ItemWithFullSpec } from '@/lib/supabase/types';

const FALLBACK_IMAGE = '/images/logo.png';

interface PartnerStorePageProps {
  partnerId: string;
  initialData?: MappedPartner;
  initialItems?: StorePageItem[]; // WYSHKIT 2026: Server-side fetched items (partial from getPartnerStoreData)
}

export function PartnerStorePage({ partnerId, initialData, initialItems }: PartnerStorePageProps) {
  const router = useRouter();
  const searchParams = useSearchParams();
  const itemParam = searchParams.get('item');

  // WYSHKIT 2026: Server-First - Data comes entirely from props
  const partner = initialData!;
  const items = initialItems || [];

  // Sheet state
  const [itemSheetData, setItemSheetData] = useState<ItemWithFullSpec | null>(null);
  const [itemSheetOpen, setItemSheetOpen] = useState(false);
  const [itemSheetLoading, setItemSheetLoading] = useState(false);
  const [itemSheetUnavailable, setItemSheetUnavailable] = useState(false);
  const latestItemParamRef = useRef<string | null>(null);
  latestItemParamRef.current = itemParam;

  useEffect(() => {
    if (!itemParam) {
      setItemSheetData(null);
      setItemSheetOpen(false);
      setItemSheetLoading(false);
      setItemSheetUnavailable(false);
      return;
    }
    setItemSheetOpen(true);
    setItemSheetLoading(true);
    setItemSheetUnavailable(false);
    const requestedId = itemParam;
    getItemWithFullSpec(itemParam)
      .then(({ data, error }) => {
        const currentItem = latestItemParamRef.current;
        if (currentItem !== requestedId) return;
        setItemSheetLoading(false);
        if (error || !data) {
          setItemSheetUnavailable(true);
          setItemSheetData(null);
          return;
        }
        setItemSheetUnavailable(false);
        setItemSheetData(data);
        if (process.env.NODE_ENV === 'development') {
          console.log('[PartnerStorePage] item sheet data received', {
            id: (data as any)?.id,
            variants: (data as any)?.variants?.length ?? 0,
            item_addons: (data as any)?.item_addons?.length ?? 0,
            hasDescription: !!(data as any)?.description,
          });
        }
      })
      .catch((err) => {
        if (latestItemParamRef.current !== requestedId) return;
        setItemSheetLoading(false);
        setItemSheetUnavailable(true);
        setItemSheetData(null);
        console.error('[PartnerStorePage] getItemWithFullSpec failed', err);
      });
  }, [itemParam]);

  const handleItemSheetClose = () => {
    setItemSheetOpen(false);
    router.replace(`/partner/${partnerId}`, { scroll: false });
  };

  const displayName = partner?.name || initialData?.name || 'Partner';
  const displayImage = partner?.imageUrl || initialData?.imageUrl || FALLBACK_IMAGE;
  const displayRating = partner?.rating || initialData?.rating;
  const displayCity = partner?.city || initialData?.city || 'Local Partner';

  // Note: v_partners_detailed doesn't have prepHours/deliveryFee, but the partners table does.
  // API returns them if joined or if it's returning PartnerFull.
  const displayPrepHours = (partner as any)?.prep_hours || initialData?.prepHours || 24;
  const displayDeliveryFee = (partner as any)?.delivery_fee ?? initialData?.deliveryFee ?? 0;
  const displayDescription = partner?.description || initialData?.description || 'Discover quality items from this local partner.';

  // WYSHKIT 2026: Server-First Data Fetching - Data MUST come from Server Component
  // Swiggy Pattern: "Data Should Come to User, Not User Go to Data"
  // Initialize state from server-provided data (no useEffect needed - use initial state)

  // WYSHKIT 2026: If data missing, show error (don't fetch client-side)
  // Server Component MUST provide data - this is a contract violation
  if (!initialData || !initialItems) {
    return (
      <div className="flex flex-col items-center justify-center h-[60vh] p-6 text-center bg-background">
        <p className="text-sm font-medium text-zinc-900">Partner data not available</p>
        <p className="text-xs text-zinc-500 mt-1">Please refresh the page</p>
        <Button onClick={() => router.back()} variant="link" className="text-xs mt-2">Go back</Button>
      </div>
    );
  }

  return (
    <div className="animate-in fade-in duration-500">
      <StoreContent
        displayName={displayName}
        displayImage={displayImage}
        displayRating={displayRating}
        displayCity={displayCity}
        displayPrepHours={displayPrepHours}
        displayDeliveryFee={displayDeliveryFee}
        displayDescription={displayDescription}
        items={items}
        itemsLoading={false} // Server-first => always loaded
        partnerId={partnerId}
      />
      <Sheet open={itemSheetOpen} onOpenChange={(open) => !open && handleItemSheetClose()}>
        <SheetContent
          side="bottom"
          hideClose
          className="h-[85dvh] rounded-t-[32px] border-x border-t border-zinc-100 p-0 gap-0 md:max-w-[520px] md:left-1/2 md:right-auto md:-translate-x-1/2 flex flex-col overflow-hidden"
        >
          <SheetTitle className="sr-only">{itemSheetData?.name || 'Product Details'}</SheetTitle>
          <div className="mt-4 flex justify-center">
            <div className="h-1 w-12 rounded-full bg-zinc-200" aria-hidden />
          </div>
          <div className="flex-1 relative min-h-0">
            {itemSheetLoading ? (
              <div className="flex flex-col items-center justify-center py-16 px-4">
                <div className="size-10 border-2 border-zinc-200 border-t-zinc-900 rounded-full animate-spin mb-4" />
                <p className="text-sm font-medium text-zinc-500">Loading product...</p>
              </div>
            ) : itemSheetUnavailable || !itemSheetData ? (
              <div className="flex flex-col items-center justify-center py-16 px-4 text-center">
                <p className="text-base font-semibold text-zinc-900">Product unavailable</p>
                <p className="text-sm text-zinc-500 mt-1">This item may be pending or no longer listed.</p>
                <Button onClick={handleItemSheetClose} variant="outline" className="mt-4 rounded-xl">
                  Close
                </Button>
              </div>
            ) : (
              <ItemDetailView item={itemSheetData} onBack={handleItemSheetClose} partnerId={partnerId} />
            )}
          </div>
        </SheetContent>
      </Sheet>
    </div>
  );
}

/**
 * WYSHKIT 2026: Internal StoreContent component (DRY)
 * Swiggy 2026 Pattern: Same content, different containers (Page vs Sheet)
 */
function StoreContent({
  displayName,
  displayImage,
  displayRating,
  displayCity,
  displayPrepHours,
  displayDeliveryFee,
  displayDescription,
  items,
  itemsLoading,
  partnerId,
}: {
  displayName: string;
  displayImage: string;
  displayRating?: number;
  displayCity: string;
  displayPrepHours: number;
  displayDeliveryFee: number;
  displayDescription: string;
  items: StorePageItem[];
  itemsLoading: boolean;
  partnerId: string;
}) {
  return (
    <>
      <div
        style={{ viewTransitionName: `partner-${partnerId}` }}
        className="relative aspect-[2.5/1] md:aspect-[3/1] w-full bg-zinc-100"
      >
        <Image
          src={displayImage}
          alt={displayName}
          fill
          className="object-cover"
          priority
          onError={(e) => {
            (e.target as any).src = FALLBACK_IMAGE;
          }}
        />
        <div className="absolute inset-0 bg-gradient-to-t from-black/60 via-black/10 to-transparent" />
      </div>

      <div className="px-3 -mt-12 relative z-10">
        <div className="bg-white rounded-[24px] p-4 shadow-[0_8px_32px_-8px_rgba(0,0,0,0.12)] border border-zinc-100/50 backdrop-blur-xl">
          <div className="flex items-start justify-between gap-3">
            <div className="flex-1 min-w-0">
              <h1 className="text-[22px] font-bold text-zinc-950 leading-tight tracking-tight line-clamp-2">
                {displayName}
              </h1>
              <div className="flex items-center gap-1.5 mt-1 text-[13px] font-medium text-zinc-500">
                <MapPin className="size-3.5 text-zinc-400 shrink-0" />
                <span className="truncate">{displayCity}</span>
              </div>
            </div>
            <div className="flex items-start gap-2 shrink-0">
              <ShareButton
                title={displayName}
                url={`/partner/${partnerId}`}
                className="bg-zinc-50 size-10 rounded-full flex items-center justify-center text-zinc-900 hover:bg-zinc-100 transition-all border border-zinc-100"
              />
              {displayRating && (
                <div className="flex flex-col items-center bg-zinc-900 px-2.5 py-1.5 rounded-[14px] shadow-sm min-w-[50px]">
                  <div className="flex items-center gap-0.5">
                    <span className="text-[14px] font-bold text-white leading-none">{displayRating.toFixed(1)}</span>
                    <Star className="size-3 fill-white text-white" />
                  </div>
                  <span className="text-[8px] font-bold text-zinc-400 uppercase tracking-wider mt-0.5">Rating</span>
                </div>
              )}
            </div>
          </div>

          <div className="flex items-center gap-3 mt-4 pt-4 border-t border-dashed border-zinc-100">
            <div className="flex items-center gap-1.5 text-[11px] font-bold text-zinc-700 uppercase tracking-wide bg-zinc-50 px-2 py-1 rounded-lg">
              <Clock className="size-3.5 text-zinc-400" />
              <span>{displayPrepHours}h prep</span>
            </div>
            <div className="flex items-center gap-1.5 text-[11px] font-bold text-zinc-700 uppercase tracking-wide bg-zinc-50 px-2 py-1 rounded-lg">
              <span>{displayDeliveryFee === 0 ? 'Free delivery' : `₹${displayDeliveryFee} fee`}</span>
            </div>
          </div>
        </div>
      </div>

      <div className="px-3 py-6">
        <div className="flex items-end justify-between mb-4 px-1">
          <h2 className="text-[18px] font-bold text-zinc-950 tracking-tight leading-none">Recommended ({items.length})</h2>
        </div>

        {itemsLoading ? (
          <div className="grid grid-cols-2 gap-3">
            {[1, 2, 3, 4].map((i) => (
              <div key={i} className="aspect-[4/5] bg-zinc-50 rounded-[20px] animate-pulse" />
            ))}
          </div>
        ) : items.length > 0 ? (
          <ContextualGrid variant="items">
            {items.map((item, index) => (
              <div
                key={item.id}
                className="animate-in fade-in slide-in-from-bottom-4 duration-500 fill-mode-backwards"
                style={{ animationDelay: `${index * 30}ms` }}
              >
                <ItemCard
                  item={item}
                  partnerId={partnerId}
                  priority={index < 4}
                />
              </div>
            ))}
          </ContextualGrid>
        ) : (
          <div className="py-12 text-center bg-zinc-50 rounded-[24px] border border-dashed border-zinc-200">
            <p className="text-[11px] font-bold text-zinc-400 uppercase tracking-widest">No items found</p>
          </div>
        )}
      </div>

      <div className="h-24" />
    </>
  );
}
