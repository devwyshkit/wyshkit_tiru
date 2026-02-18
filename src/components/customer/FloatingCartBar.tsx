'use client';

import { useRef, useEffect, useState } from 'react';
import { ShoppingBag, ChevronRight, Sparkles } from 'lucide-react';
import Image from 'next/image';
import { useRouter, usePathname } from 'next/navigation';
import { useCart } from '@/components/customer/CartProvider';
import { useActiveOrders } from '@/hooks/useActiveOrders';
import { cn } from '@/lib/utils';
import { triggerHaptic, HapticPattern } from '@/lib/utils/haptic';
import { hasAnyPersonalization } from '@/lib/utils/personalization';

/**
 * WYSHKIT 2026: FloatingCartBar - CSS transitions (zero JS overhead)
 * Swiggy 2026 Pattern: Immediate visibility, smooth CSS animations
 * Keep in DOM for proper CSS transitions (no early return)
 */
export function FloatingCartBar() {
  const router = useRouter();
  const pathname = usePathname();
  const { draftOrder, loading } = useCart();

  // WYSHKIT 2026: Single source of truth - useDraftOrder
  const displayCart = draftOrder;

  const isCheckoutOpen = pathname.startsWith('/checkout');

  // WYSHKIT 2026: Smart Layering - Check for active orders to prevent visual collision
  const { activeOrders, loading: trackingLoading } = useActiveOrders();

  // Swiggy 2026: Lift cart if ANY active order is tracking, AND it's not excluded by the bar itself
  const orderToShow = activeOrders?.[0]; // Matching OrderTrackingBar's priority logic
  const isExcludedByTracker = pathname === '/checkout' || (orderToShow && pathname === `/orders/${orderToShow.id}`);
  const hasTrackingBar = activeOrders.length > 0 && !isExcludedByTracker && !trackingLoading;

  const hasItems = displayCart && displayCart.itemCount > 0;

  // WYSHKIT 2026: Visibility Logic
  // Show cart whenever there are items; don't hide for unrelated active orders.
  // If tracking bar is present, we LIFT the cart bar to stack above it.
  const isVisible = hasItems && !isCheckoutOpen;

  const handleCheckout = () => {
    // WYSHKIT 2026: Immediate haptic feedback for checkout initiation
    triggerHaptic(HapticPattern.ACTION);

    if (!displayCart || displayCart.itemCount === 0) return;

    // WYSHKIT 2026: Connected Experience
    // Both Auth and Guest users have their cart on the server (session-based for guests)
    // No more JSON serialization in URL
    router.push('/checkout');
  };

  const firstItemImage = displayCart?.items?.[0]?.itemImage;
  const hasPersonalization = hasAnyPersonalization(displayCart?.items || []);
  const displayCount = displayCart?.itemCount || 0;
  const displayTotal = displayCart?.total || 0;
  // WYSHKIT 2026: Loading state - show loading when fetching cart data
  const isLoading = loading;

  const [shouldPulse, setShouldPulse] = useState(false);
  // WYSHKIT 2026: Visual count for animation sync
  const [visualCount, setVisualCount] = useState(displayCount);
  const prevCount = useRef(displayCount);
  const prevLoading = useRef(loading);

  useEffect(() => {
    // WYSHKIT 2026: Instant status - satisfy "Badge pops instantly"
    setVisualCount(displayCount);
    if (displayCount > prevCount.current) {
      setShouldPulse(true);
      triggerHaptic(HapticPattern.ACTION);
      const timer = setTimeout(() => setShouldPulse(false), 300);
      return () => clearTimeout(timer);
    }
    prevCount.current = displayCount;
  }, [displayCount]);

  // WYSHKIT 2026: Sync state when loading completes to ensure server state is reflected
  useEffect(() => {
    if (prevLoading.current && !loading) {
      // Loading just completed - server state is now fresh
    }
    prevLoading.current = loading;
  }, [loading]);

  // WYSHKIT 2026: Always render the container to enable CSS transitions.
  // Toggle visibility using transform (translate-y) and opacity.
  return (
    <div
      role="region"
      aria-label="Floating cart summary"
      className={cn(
        "fixed z-50 transition-all duration-500 ease-in-out",
        "left-4 right-4 md:left-auto md:w-[420px] md:right-8", // Mobile: Full width; Desktop: Right aligned
        // Mobile: Safe area for BottomNav (approx 80px) + spacing
        // If tracking bar is active, we lift up by another ~80px to stack
        hasTrackingBar ? "bottom-[160px] md:bottom-24" : "bottom-[88px] md:bottom-8",
        isVisible ? "translate-y-0 opacity-100" : "translate-y-24 opacity-0 pointer-events-none"
      )}
    >
      <div
        className={cn(
          "bg-zinc-950/95 backdrop-blur-2xl rounded-[2.5rem] shadow-[0_32px_64px_-16px_rgba(0,0,0,0.6)] border border-white/5 overflow-hidden",
          "transition-all duration-500 cubic-bezier(0.34, 1.56, 0.64, 1)",
          shouldPulse && "scale-[1.04]"
        )}
      >
        <div className="flex items-center gap-3 p-3">
          <button
            onClick={handleCheckout}
            className="flex items-center gap-3 flex-1 min-w-0"
            disabled={isLoading}
          >
            <div className="relative">
              <div className="relative size-12 rounded-xl bg-zinc-800 overflow-hidden ring-2 ring-zinc-700">
                {firstItemImage ? (
                  <div className="relative size-full">
                    <Image
                      src={firstItemImage}
                      alt="Cart item"
                      fill
                      className="object-cover"
                      sizes="48px"
                    />
                  </div>
                ) : (
                  <div className="size-full flex items-center justify-center">
                    <ShoppingBag className="size-5 text-zinc-500" />
                  </div>
                )}
              </div>
              <div className="absolute -top-1 -right-1 size-5 rounded-full bg-[#D91B24] flex items-center justify-center">
                <span className="text-[10px] font-black text-white">{(visualCount).toString().padStart(2, '0')}</span>
              </div>
            </div>

            <div className="flex flex-col items-start min-w-0">
              <div className="flex items-center gap-1.5">
                <span className="text-sm font-black text-white tracking-tight">
                  {visualCount} {visualCount === 1 ? 'item' : 'items'}
                </span>
                {hasPersonalization && (
                  <span className="flex items-center gap-0.5 px-1.5 py-0.5 rounded-md bg-amber-500/20">
                    <Sparkles className="size-2.5 text-amber-400" />
                    <span className="text-[9px] font-black text-amber-400 uppercase tracking-tighter">Identity Available</span>
                  </span>
                )}
              </div>
              <span className="text-xs text-zinc-400 truncate max-w-[120px]">
                {displayCart?.items?.[0]?.partnerName || 'From local store'}
              </span>
            </div>
          </button>

          <button
            onClick={handleCheckout}
            aria-label="Proceed to checkout"
            disabled={isLoading}
            className={cn(
              "flex items-center gap-2 px-5 py-3 rounded-xl font-bold text-sm",
              "bg-orange-600 hover:bg-orange-700 active:scale-95 transition-all text-white",
              isLoading && "opacity-70 pointer-events-none"
            )}
          >
            {isLoading && displayTotal === 0 ? (
              <span className="h-4 w-8 bg-white/20 animate-pulse rounded" />
            ) : (
              <span className="tabular-nums">₹{displayTotal.toFixed(0)}</span>
            )}
            <ChevronRight className="size-4" />
          </button>
        </div>

        <div className="h-0.5 bg-gradient-to-r from-transparent via-zinc-700 to-transparent" />

        <div className="flex items-center justify-between px-3 py-2 gap-3">
          {displayCart?.partnerId && (
            <button
              onClick={() => router.push(`/partner/${displayCart.partnerId}`)}
              className="text-[10px] font-bold text-zinc-400 uppercase tracking-widest hover:text-zinc-200 transition-colors truncate flex-1 text-left min-w-0"
            >
              View {displayCart?.items?.[0]?.partnerName || 'Store'}
            </button>
          )}
          <button
            onClick={handleCheckout}
            disabled={isLoading}
            className="text-[10px] font-bold text-zinc-500 uppercase tracking-widest hover:text-zinc-300 transition-colors"
          >
            Tap to checkout
          </button>
        </div>
      </div>
    </div>
  );
}
