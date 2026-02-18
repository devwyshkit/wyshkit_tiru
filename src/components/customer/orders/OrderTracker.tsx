'use client';

import React, { useState, useEffect } from 'react';
import { Confetti } from '@/components/ui/Confetti';
import { triggerHaptic, HapticPattern } from '@/lib/utils/haptic';
import {
  Clock,
  CheckCircle2,
  Package,
  ChevronDown,
  ChevronUp,
  AlertCircle,
  MapPin,
  Camera,
  MessageSquare,
  Timer,
  ShoppingBag,
  Info,
  Sparkles,
  FileText,
  Download,
  X
} from 'lucide-react';
import { Sheet, SheetContent } from '@/components/ui/sheet';
import Image from 'next/image';
import { useOrderRealtime } from '@/hooks/useOrderRealtime';
import { ORDER_STATUS } from '@/lib/types/order-status';
import { cn } from '@/lib/utils';
import { Skeleton } from '@/components/ui/skeleton';
import { IdentityForm } from './IdentityForm';
import { PreviewApproval } from './PreviewApproval';
import { approvePreview, requestChange } from '@/lib/actions/orders';
import { generateEstimatePDF, generateTaxInvoicePDF } from '@/lib/services/pdf-service';
import { toast } from 'sonner';
import { useRouter, useSearchParams } from 'next/navigation';
import { FeedbackStep } from './FeedbackStep';
import { formatCurrency } from '@/lib/utils/pricing';
import { hasItemPersonalization } from '@/lib/utils/personalization';

import { StatusCard } from './tracking/StatusCard';
import { OrderTimeline } from './tracking/OrderTimeline';
import { ActionBanner } from './tracking/ActionBanner';
import { DeliveryInfo } from './tracking/DeliveryInfo';
import { OrderItemsList } from './tracking/OrderItemsList';
import { BillSummary } from './tracking/BillSummary';

interface OrderTimelineEvent {
  id: string;
  title: string;
  description: string;
  createdAt: string;
  type: string;
}

interface OrderTrackerProps {
  orderId: string;
  isSheet?: boolean;
}

/**
 * WYSHKIT 2026: The "Order Heartbeat" Component (REFACTORED)
 * Shows real-time status updates and acts as the gatekeeper 
 * for the "Commitment Before Creativity" workflow.
 */
export function OrderTracker({ orderId, isSheet }: OrderTrackerProps) {
  const { order, timelineEvents, previews, isConnected, error, refetch } = useOrderRealtime({ orderId });
  const router = useRouter();
  const searchParams = useSearchParams();
  const showSuccess = searchParams.get('success') === 'true';
  const [showCelebration, setShowCelebration] = useState(showSuccess);
  const [proactivePersonalizationOpen, setProactivePersonalizationOpen] = useState(false);
  const [hasAutoOpened, setHasAutoOpened] = useState(false);

  useEffect(() => {
    if (showSuccess) {
      triggerHaptic(HapticPattern.SUCCESS);
      const timer = setTimeout(() => setShowCelebration(false), 5000);
      return () => clearTimeout(timer);
    }
  }, [showSuccess]);

  if (error) {
    return (
      <div className="p-8 text-center bg-rose-50 rounded-[32px] border border-rose-100">
        <AlertCircle className="size-12 text-[#D91B24] mx-auto mb-4" />
        <h3 className="text-lg font-bold text-rose-900 mb-2">Something went wrong</h3>
        <p className="text-sm text-rose-600 mb-4">{error}</p>
        <button onClick={() => router.refresh()} className="px-6 py-2 bg-[#D91B24] text-white rounded-full font-bold">
          Try Again
        </button>
      </div>
    );
  }

  if (!order) {
    return (
      <div className="p-8 space-y-4">
        <Skeleton className="h-20 w-full rounded-3xl" />
        <Skeleton className="h-40 w-full rounded-full" />
        <Skeleton className="h-20 w-full rounded-2xl" />
      </div>
    );
  }

  // Map events
  const events = (timelineEvents || []).map(e => ({
    id: e.id,
    title: e.title,
    description: e.description,
    createdAt: e.created_at,
    type: e.type
  }));

  // Personalization State
  // Personalization State - inclusive of various initial statuses
  const personalizedItemsPending = order.order_items?.filter((item: any) => {
    if (!item.is_personalized) return false;
    // blocked statuses
    const s = (item.status || 'pending').toLowerCase();
    if (s === 'preview_ready' || s === 'approved' || s === 'in_production' || s === 'packed' || s === 'shipped' || s === 'delivered' || s === 'cancelled') return false;

    // Explicitly allow pending/placed/awaiting_details/confirmed/paid
    return true;
  }) || [];

  const itemPreviews = (previews || []).reduce((acc: any, p: any) => {
    if (p.order_item_id) {
      acc[p.order_item_id] = p;
    }
    return acc;
  }, {});

  const handlePersonalizationSubmitted = () => {
    toast.success("Details shared with partner!");
    setProactivePersonalizationOpen(false);
    // Real-time hook picks up the update
  };

  // WYSHKIT 2026: Proactive Identity Push
  // If we land via success and have pending items, open the sheet immediately
  useEffect(() => {
    if (showSuccess && personalizedItemsPending.length > 0 && !hasAutoOpened) {
      // Delay slightly to allow success celebration to breathe
      const timer = setTimeout(() => {
        setProactivePersonalizationOpen(true);
        setHasAutoOpened(true);
      }, 1500);
      return () => clearTimeout(timer);
    }
  }, [showSuccess, personalizedItemsPending.length, hasAutoOpened]);


  return (
    <div className={cn(
      "mx-auto bg-zinc-50/50 pb-safe",
      isSheet ? "w-full min-h-[50vh]" : "max-w-md min-h-screen"
    )}>
      {showCelebration && <Confetti />}
      <div className={cn(
        "flex flex-col gap-4 p-4",
        !isSheet && "pb-20"
      )}>
        {showSuccess && (
          <div className="bg-zinc-950 rounded-[2.5rem] p-6 text-white shadow-2xl shadow-zinc-200 animate-in slide-in-from-top-4 duration-500 border border-white/10">
            <div className="flex items-center gap-3 mb-2">
              <div className="size-10 rounded-2xl bg-orange-600 flex items-center justify-center">
                <CheckCircle2 className="size-6 text-white" />
              </div>
              <h3 className="text-lg font-black uppercase tracking-tight">Order Confirmed</h3>
            </div>
            <p className="text-xs font-medium text-zinc-400 leading-snug">
              Order #{order.order_number} is being prepared. Partner will start as soon as identity is added.
            </p>
          </div>
        )}

        {/* 1. Master Status Header */}
        <StatusCard order={order} />

        {/* 2. Control Room Action Zone (Personalization) */}
        <ActionBanner
          personalizedItemsCount={personalizedItemsPending.length}
          deadline={(order as any).design_deadline_at}
        />

        {/* 3. Order Items Section */}
        <OrderItemsList
          order={order}
          itemPreviews={itemPreviews}
          onPersonalizationSubmitted={handlePersonalizationSubmitted}
        />

        {/* 4. Post-Delivery Feedback */}
        {order.status === ORDER_STATUS.DELIVERED && (
          <FeedbackStep
            orderId={orderId}
            items={order.order_items?.map((item: any) => ({
              id: item.item_id,
              name: item.item_name || item.name
            })) || []}
            onComplete={() => { }}
          />
        )}

        {/* 5. Tracking & Address & Bill */}
        <div className="space-y-4">
          <DeliveryInfo order={order} />
          <BillSummary order={order} />
        </div>

        {/* 6. Order Timeline */}
        <OrderTimeline events={events} />

        {/* 7. Support */}
        <div className="mt-4 text-center">
          <p className="text-[10px] font-bold text-zinc-300 uppercase tracking-widest mb-4">Support</p>
          <div className="flex gap-2">
            <button className="flex-1 h-14 rounded-2xl bg-white border border-zinc-100 flex items-center justify-center gap-2 text-xs font-bold text-zinc-600 active:scale-95 transition-all">
              <MessageSquare className="size-4" />
              Chat
            </button>
            <button className="flex-1 h-14 rounded-2xl bg-white border border-zinc-100 flex items-center justify-center gap-2 text-xs font-bold text-zinc-600 active:scale-95 transition-all">
              Call
            </button>
          </div>
        </div>
      </div>

      {/* WYSHKIT 2026: Proactive Identity Sheet (Data Comes to User) */}
      <Sheet open={proactivePersonalizationOpen} onOpenChange={setProactivePersonalizationOpen}>
        <SheetContent side="bottom" className="p-0 h-[85dvh] rounded-t-[32px] border-none overflow-hidden outline-none bg-zinc-50">
          <div className="h-full overflow-y-auto overscroll-contain pb-safe">
            <div className="p-6 sticky top-0 bg-white/80 backdrop-blur-md z-10 border-b border-zinc-100 flex items-center justify-between">
              <div>
                <h3 className="text-xl font-black text-zinc-900 tracking-tight flex items-center gap-2">
                  <Sparkles className="size-5 text-amber-500" />
                  Add Identity
                </h3>
                <p className="text-[11px] font-bold text-zinc-400 uppercase tracking-widest">Designing {personalizedItemsPending.length} items</p>
              </div>
              <button
                onClick={() => setProactivePersonalizationOpen(false)}
                className="size-10 bg-zinc-100 rounded-full flex items-center justify-center hover:bg-zinc-200 transition-colors"
              >
                <X className="size-5 text-zinc-500" />
              </button>
            </div>
            <div className="p-6">
              <IdentityForm
                order={order}
                onSubmitted={handlePersonalizationSubmitted}
              />
            </div>
          </div>
        </SheetContent>
      </Sheet>
    </div>
  );
}
