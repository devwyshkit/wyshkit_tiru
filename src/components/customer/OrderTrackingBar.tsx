'use client';

import { Package, Sparkles, ChevronRight, Clock, AlertCircle } from 'lucide-react';
import { useRouter, usePathname } from 'next/navigation';
import { useActiveOrders, type ActiveOrder } from '@/hooks/useActiveOrders';
import { useCart } from '@/components/customer/CartProvider';
import { ORDER_STATUS, getStatusConfig } from '@/lib/types/order-status';
import { cn } from '@/lib/utils';
import { triggerHaptic, HapticPattern } from '@/lib/utils/haptic';
import { useEffect } from 'react';

export function OrderTrackingBar() {
    const { activeOrders, loading } = useActiveOrders();
    const router = useRouter();
    const pathname = usePathname();

    // WYSHKIT 2026: Show all active orders, but highlight those needing action
    const needsAttention = activeOrders.filter(o =>
        (o.status === ORDER_STATUS.PLACED && o.has_personalization) ||
        o.status === ORDER_STATUS.PREVIEW_READY
    );

    // Prioritize "Needs Attention" orders, otherwise show most recent active order
    const orderToShow = needsAttention.length > 0 ? needsAttention[0] : activeOrders[0];

    // Don't show on checkout to avoid clutter. 
    // Show even on other order pages (Swiggy 2026: multi-order support), 
    // unless it's the IDENTICAL order being viewed.
    const isExcludedPage = pathname === '/checkout' || (orderToShow && pathname === `/orders/${orderToShow.id}`);

    const { draftOrder } = useCart();

    const isVisible = !loading && orderToShow && !isExcludedPage;

    useEffect(() => {
        const root = document.documentElement;
        if (isVisible) {
            root.style.setProperty('--tracking-bar-height', '72px');
        } else {
            root.style.setProperty('--tracking-bar-height', '0px');
        }
    }, [isVisible]);

    if (!isVisible) return null;

    const handleTrack = () => {
        triggerHaptic(HapticPattern.ACTION);
        const targetPath = `/orders/${orderToShow.id}`;
        if (pathname === targetPath) {
            // Already there, just a heartbeat
            return;
        }
        router.push(targetPath);
    };

    const config = getStatusConfig(orderToShow);
    const isUrgent = needsAttention.length > 0;

    return (
        <div
            className="fixed left-0 right-0 z-40 flex justify-center pointer-events-none px-4 animate-in slide-in-from-bottom-8 fade-in duration-500 ease-out"
            style={{ bottom: `calc(var(--bottom-nav-height, 0px) + 12px)` }}
        >
            <button
                onClick={handleTrack}
                className={cn(
                    "pointer-events-auto min-w-[320px] max-w-sm transition-all duration-500 ease-out",
                    "rounded-[2.5rem] shadow-2xl overflow-hidden flex items-center p-1.5 gap-4 active:scale-[0.96]",
                    isUrgent
                        ? "bg-[var(--primary)] ring-4 ring-rose-500/20 shadow-rose-900/40"
                        : "bg-zinc-950/95 backdrop-blur-2xl shadow-zinc-950/60 border border-white/5"
                )}
            >
                {/* Status Icon with Heartbeat */}
                <div className={cn(
                    "size-12 rounded-full flex items-center justify-center relative",
                    isUrgent ? "bg-white" : config.color
                )}>
                    {isUrgent && (
                        <div className="absolute inset-0 rounded-full bg-rose-500/30 animate-ping" />
                    )}
                    <div className={cn(
                        "relative z-10",
                        isUrgent ? "text-[var(--primary)]" : ""
                    )}>
                        {isUrgent ? <AlertCircle className="size-6" /> : config.icon}
                    </div>
                </div>

                {/* Content */}
                <div className="flex-1 text-left min-w-0 py-2">
                    <h4 className={cn(
                        "text-[14px] font-black truncate leading-tight tracking-tight",
                        isUrgent ? "text-white" : "text-white"
                    )}>
                        {isUrgent ? "Add Identity Now" : (orderToShow.partner_name || config.label)}
                    </h4>
                    <p className={cn(
                        "text-[10px] truncate uppercase font-bold tracking-widest mt-0.5 opacity-80",
                        isUrgent ? "text-rose-100" : "text-zinc-400"
                    )}>
                        {isUrgent ? config.label : config.subLabel}
                    </p>
                </div>

                {/* Tracking Pill / Action Pill */}
                <div className={cn(
                    "mr-3 px-4 py-2 rounded-full flex items-center gap-1.5 backdrop-blur-md transition-colors",
                    isUrgent ? "bg-white text-[#D91B24]" : "bg-zinc-800/50 text-white border border-white/10"
                )}>
                    <span className="text-[10px] font-black uppercase tracking-wider">
                        {isUrgent ? "Go" : "Live"}
                    </span>
                    {!isUrgent && <div className="size-1.5 rounded-full bg-emerald-500 animate-pulse" />}
                    {isUrgent && <ChevronRight className="size-3" />}
                </div>
            </button>
        </div>
    );
}
