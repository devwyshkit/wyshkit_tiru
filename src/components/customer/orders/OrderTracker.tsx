'use client';

import React, { useState, useEffect } from 'react';
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
  Download
} from 'lucide-react';
import Image from 'next/image';
import { useOrderRealtime } from '@/hooks/useOrderRealtime';
import { ORDER_STATUS } from '@/lib/types/order-status';
import { cn } from '@/lib/utils';
import { Skeleton } from '@/components/ui/skeleton';
import { PersonalizationForm } from './PersonalizationForm';
import { PreviewApproval } from './PreviewApproval';
import { approvePreview, requestChange } from '@/lib/actions/orders';
import { generateEstimatePDF, generateTaxInvoicePDF } from '@/lib/services/pdf-service';
import { toast } from 'sonner';
import { useRouter } from 'next/navigation';
import { FeedbackStep } from './FeedbackStep';

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
 * WYSHKIT 2026: The "Order Heartbeat" Component
 * Shows real-time status updates and acts as the gatekeeper 
 * for the "Commitment Before Creativity" workflow.
 */
export function OrderTracker({ orderId, isSheet }: OrderTrackerProps) {
  const { order, timelineEvents, previews, isConnected, error, refetch } = useOrderRealtime({ orderId });
  const [expandedTimeline, setExpandedTimeline] = useState(false);
  const [isApproving, setIsApproving] = useState(false);
  const [isRequestingChange, setIsRequestingChange] = useState(false);
  const router = useRouter();

  const handlePersonalizationSubmitted = () => {
    toast.success("Details shared with partner!");
    // WYSHKIT 2026: Stateless Intent. Real-time hook will pick up the 'submitted' state automatically.
  };

  const events = (timelineEvents || []).map(e => ({
    id: e.id,
    title: e.title,
    description: e.description,
    createdAt: e.created_at,
    type: e.type
  }));

  const getStatusIcon = (status: string) => {
    switch (status) {
      case ORDER_STATUS.PLACED: return <Clock className="size-5" />;
      case ORDER_STATUS.DETAILS_RECEIVED: return <Package className="size-5" />;
      case ORDER_STATUS.PREVIEW_READY: return <Camera className="size-5" />;
      case ORDER_STATUS.APPROVED: return <CheckCircle2 className="size-5" />;
      case ORDER_STATUS.DELIVERED: return <CheckCircle2 className="size-5" />;
      default: return <Clock className="size-5" />;
    }
  };

  function getStatusText(status: string) {
    const map: Record<string, string> = {
      [ORDER_STATUS.PLACED]: 'Order placed',
      [ORDER_STATUS.CONFIRMED]: 'Accepted',
      [ORDER_STATUS.DETAILS_RECEIVED]: 'Preparing',
      [ORDER_STATUS.PREVIEW_READY]: 'Preview ready',
      [ORDER_STATUS.REVISION_REQUESTED]: 'Revision requested',
      [ORDER_STATUS.APPROVED]: 'Ready to prepare',
      [ORDER_STATUS.IN_PRODUCTION]: 'Preparing',
      [ORDER_STATUS.PACKED]: 'Ready',
      [ORDER_STATUS.DISPATCHED]: 'Dispatched',
      [ORDER_STATUS.OUT_FOR_DELIVERY]: 'Out for delivery',
      [ORDER_STATUS.DELIVERED]: 'Delivered',
    };
    return map[status] || status.replace(/_/g, ' ').toLowerCase();
  }

  function getNextStep(status: string, hasPersonalization: boolean = false) {
    switch (status) {
      case ORDER_STATUS.PLACED:
        return hasPersonalization ? 'Add your personalization details' : 'Waiting for partner to accept';
      case ORDER_STATUS.CONFIRMED:
        return hasPersonalization ? 'Add your personalization details' : 'Partner is preparing your order';
      case ORDER_STATUS.DETAILS_RECEIVED: return 'Partner is reviewing your details';
      case ORDER_STATUS.PREVIEW_READY: return 'Review and approve your preview';
      case ORDER_STATUS.APPROVED: return 'Starting production';
      case ORDER_STATUS.IN_PRODUCTION: return 'Your order is being prepared';
      case ORDER_STATUS.PACKED: return 'Order is ready for pickup';
      case ORDER_STATUS.OUT_FOR_DELIVERY: return 'Arriving shortly';
      case ORDER_STATUS.DELIVERED: return 'Order completed';
      default: return 'Processing your order';
    }
  }

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

  // WYSHKIT 2026: Allow immediate input after payment (PLACED) for Swiggy 2026 "Stateless Intent".
  // Fixed: Stop showing form once details are submitted even if status is still PLACED.
  const isPersonalizationPending = (order.status === ORDER_STATUS.PLACED || order.status === ORDER_STATUS.CONFIRMED) &&
    order.has_personalization &&
    order.personalization_status !== 'submitted';



  // WYSHKIT 2026: One order = one delivery (hyperlocal). Item-level badge only for "Design Needed".
  const getItemStatus = (item: any) => {
    const hasLegacyPersonalization = item.is_personalized || (item.personalization && item.personalization.enabled);
    const hasAddonPersonalization = item.selected_addons?.some((addon: any) => addon.requires_preview);
    if ((hasLegacyPersonalization || hasAddonPersonalization) && !item.personalization_details) return 'WAITING_FOR_INPUT';
    return order.status;
  };

  const getItemStatusConfig = (status: string) => {
    if (status === 'WAITING_FOR_INPUT') {
      return { label: 'Design Needed', color: 'text-amber-600 bg-amber-50 border-amber-100', icon: Sparkles };
    }
    return { label: getStatusText(status), color: 'text-zinc-500 bg-zinc-50 border-zinc-100', icon: Clock };
  };

  const renderItemStatus = (item: any) => {
    const status = getItemStatus(item);
    const config = getItemStatusConfig(status);
    const Icon = config.icon;

    return (
      <div className={cn("flex items-center gap-1.5 px-2 py-0.5 rounded-full border text-[10px] font-bold uppercase tracking-wider", config.color)}>
        <Icon className="size-3" />
        <span>{config.label}</span>
      </div>
    );
  };



  // WYSHKIT 2026: Countdown Timer for Personalization
  const DeadlineTimer = ({ deadline }: { deadline?: string }) => {
    // Debugging: Log the deadline received by the timer
    useEffect(() => {
      if (deadline) {
        console.log('[DeadlineTimer] Received deadline:', deadline, 'Current Time:', new Date().toISOString());
      } else {
        console.warn('[DeadlineTimer] No deadline provided!');
      }
    }, [deadline]);

    const [timeLeft, setTimeLeft] = useState<string>('');
    const [isDeadlineUrgent, setIsDeadlineUrgent] = useState<boolean>(false);

    useEffect(() => {
      if (!deadline) {
        setTimeLeft('');
        return;
      }
      const target = new Date(deadline).getTime();

      const update = () => {
        const now = Date.now();
        const diff = target - now;
        if (diff <= 0) {
          setTimeLeft('EXPIRED');
          return;
        }
        const hours = Math.floor(diff / (1000 * 60 * 60));
        const mins = Math.floor((diff % (1000 * 60 * 60)) / (1000 * 60));
        const secs = Math.floor((diff % (1000 * 60)) / 1000);
        setTimeLeft(`${hours}h ${mins}m ${secs}s`);
        setIsDeadlineUrgent(hours < 1);
      };

      update();
      const interval = setInterval(update, 1000);
      return () => clearInterval(interval);
    }, [deadline]);

    if (!deadline) return null;

    return (
      <div className={cn(
        "border rounded-2xl p-4 flex items-center justify-between mb-4 transition-all duration-500",
        isDeadlineUrgent ? "bg-rose-50 border-rose-100 shadow-[0_0_15px_rgba(225,29,72,0.1)]" : "bg-amber-50 border-amber-100"
      )}>
        <div className="flex items-center gap-3">
          <div className={cn(
            "size-9 rounded-xl flex items-center justify-center transition-colors",
            isDeadlineUrgent ? "bg-rose-100 text-rose-600" : "bg-amber-100 text-amber-600"
          )}>
            <Timer className={cn("size-4", isDeadlineUrgent && "animate-pulse")} />
          </div>
          <div>
            <p className={cn(
              "text-[10px] font-black uppercase tracking-widest mb-0.5",
              isDeadlineUrgent ? "text-rose-500" : "text-amber-500"
            )}>
              {isDeadlineUrgent ? 'Expiring Soon' : 'Submission Deadline'}
            </p>
            <p className={cn(
              "text-base font-black tabular-nums leading-none",
              isDeadlineUrgent ? "text-rose-700" : "text-amber-700"
            )}>
              {timeLeft === 'EXPIRED' ? '00h 00m 00s' : timeLeft}
            </p>
          </div>
        </div>
        <div className={cn(
          "text-[10px] font-bold max-w-[100px] text-right leading-tight",
          isDeadlineUrgent ? "text-rose-400" : "text-amber-400"
        )}>
          Submit details before auto-cancellation
        </div>
      </div>
    );
  };


  // Standard Tracking View (Post-Action)
  return (
    <div className="max-w-md mx-auto min-h-screen bg-zinc-50/50 pb-safe">
      <div className="flex flex-col gap-4 p-4 pb-20">

        {/* 1. Master Status Header */}
        <section className="bg-white rounded-3xl border border-zinc-100 p-6 shadow-sm">
          <div className="flex items-start gap-4">
            <div className={cn(
              "size-14 rounded-2xl flex items-center justify-center shrink-0",
              order.status === ORDER_STATUS.PREVIEW_READY
                ? "bg-rose-50 text-[#D91B24]"
                : order.status === ORDER_STATUS.DELIVERED ? "bg-emerald-50 text-emerald-600" : "bg-zinc-100 text-zinc-600"
            )}>
              {getStatusIcon(order.status)}
            </div>
            <div className="flex-1">
              <h2 className="text-lg font-black text-zinc-900 uppercase tracking-tight leading-tight">
                {isPersonalizationPending ? 'Design Input Needed' : getStatusText(order.status)}
              </h2>
              <p className="text-xs font-medium text-zinc-500 mt-1">{getNextStep(order.status, order.has_personalization)}</p>
            </div>
          </div>

          <div className="mt-6 flex gap-1.5">
            {[0, 1, 2, 3].map((i) => {
              const stepStatuses: Record<string, number> = {
                [ORDER_STATUS.PLACED]: 0,
                [ORDER_STATUS.CONFIRMED]: 0,
                [ORDER_STATUS.DETAILS_RECEIVED]: 1,
                [ORDER_STATUS.PREVIEW_READY]: 1,
                [ORDER_STATUS.REVISION_REQUESTED]: 1,
                [ORDER_STATUS.APPROVED]: 1,
                [ORDER_STATUS.IN_PRODUCTION]: 1,
                [ORDER_STATUS.PACKED]: 2,
                [ORDER_STATUS.DISPATCHED]: 3,
                [ORDER_STATUS.OUT_FOR_DELIVERY]: 3,
                [ORDER_STATUS.DELIVERED]: 4,
              };
              const currentStep = stepStatuses[order.status] ?? 0;
              const isActive = i < currentStep;
              const isCurrent = i === currentStep;

              return (
                <div key={i} className="flex-1 h-1 rounded-full bg-zinc-100 relative overflow-hidden">
                  {(isActive || isCurrent) && (
                    <div className={cn(
                      "absolute inset-0 bg-zinc-900 transition-all duration-1000",
                      isCurrent && "animate-pulse shadow-[0_0_12px_rgba(0,0,0,0.2)]"
                    )} />
                  )}
                </div>
              );
            })}
          </div>

          {/* WYSHKIT 2026: B2B Documents (Estimate/Invoice) */}
          <div className="mt-6 flex flex-wrap gap-2 pt-5 border-t border-zinc-50">
            <button
              onClick={() => {
                const orderData = order as any;
                generateEstimatePDF({
                  orderNumber: orderData.order_number,
                  date: new Date(orderData.created_at || Date.now()).toLocaleDateString(),
                  order_items: orderData.order_items,
                  customerName: (orderData.delivery_address as any)?.name,
                  billingAddress: orderData.delivery_address,
                  gstin: orderData.gstin,
                  partner: orderData.partner?.[0] || { name: 'Partner', address: 'Bangalore' },
                  totals: {
                    itemTotal: Number(orderData.subtotal) || 0,
                    deliveryFee: Number(orderData.delivery_fee) || 0,
                    platformFee: 10,
                    gstAmount: (Number(orderData.total) || 0) * 0.18,
                    grandTotal: Number(orderData.total) || 0
                  }
                });
              }}
              className="flex-1 flex items-center justify-center gap-2 px-4 py-3 bg-zinc-50 border border-zinc-100 rounded-2xl text-[11px] font-bold text-zinc-600 hover:bg-zinc-100 active:scale-95 transition-all"
            >
              <FileText className="size-3.5" />
              Download Estimate
            </button>
            {order.status === ORDER_STATUS.DELIVERED && (
              <button
                onClick={() => {
                  const orderData = order as any;
                  generateTaxInvoicePDF({
                    orderNumber: orderData.order_number,
                    date: new Date().toLocaleDateString(),
                    order_items: orderData.order_items,
                    customerName: (orderData.delivery_address as any)?.name,
                    billingAddress: orderData.delivery_address,
                    gstin: orderData.gstin,
                    partner: orderData.partner?.[0] || { name: 'Partner', address: 'Bangalore' },
                    totals: {
                      itemTotal: Number(orderData.subtotal) || 0,
                      deliveryFee: Number(orderData.delivery_fee) || 0,
                      platformFee: 10,
                      gstAmount: (Number(orderData.total) || 0) * 0.18,
                      grandTotal: Number(orderData.total) || 0
                    }
                  });
                }}
                className="flex-1 flex items-center justify-center gap-2 px-4 py-3 bg-emerald-50 border border-emerald-100 rounded-2xl text-[11px] font-bold text-emerald-600 hover:bg-emerald-100 active:scale-95 transition-all"
              >
                <Download className="size-3.5" />
                Tax Invoice
              </button>
            )}
          </div>
        </section>

        {/* 1.5. Control Room Action Zone (Personalization) */}
        {isPersonalizationPending && (
          <section className="bg-white rounded-[32px] border-2 border-amber-100 p-1 shadow-md overflow-hidden animate-in fade-in slide-in-from-bottom-4 duration-500">
            <div className="p-4 border-b border-amber-50 bg-amber-50/30">
              <div className="flex items-center justify-between mb-4">
                <div className="flex items-center gap-2">
                  <Sparkles className="size-4 text-amber-500" />
                  <h3 className="text-xs font-black text-amber-900 uppercase tracking-widest">Input Needed</h3>
                </div>
                <div className="px-2 py-0.5 rounded-full bg-amber-100/50 text-[10px] font-bold text-amber-600 uppercase">Action Required</div>
              </div>
              <p className="text-xs text-amber-700/70 font-medium mb-4 leading-relaxed">
                {order.status === ORDER_STATUS.PLACED
                  ? "Order placed! Share your design details now to help the partner start early."
                  : "Partner has accepted your order! Please share your personalization details to start production."}
              </p>
              <DeadlineTimer deadline={(order as any).design_deadline_at} />
            </div>
            <div className="p-4">
              <PersonalizationForm order={order} onSubmitted={handlePersonalizationSubmitted} />
            </div>
          </section>
        )}

        {/* 1.6. Order Items */}

        <section className="bg-white rounded-3xl border border-zinc-100 overflow-hidden">
          <div className="px-5 py-3 border-b border-zinc-50 bg-zinc-50/50 flex items-center justify-between">
            <h3 className="text-xs font-bold text-zinc-400 uppercase tracking-widest">Items ({order.order_items?.length || 0})</h3>
            <span className="text-[10px] font-bold text-zinc-300">#{order.order_number}</span>
          </div>
          <div className="divide-y divide-zinc-50">
            {((order.order_items || [])).map((item: any) => (
              <div key={item.id} className="p-4 flex gap-4">
                <div className="size-16 bg-zinc-50 rounded-xl relative overflow-hidden border border-zinc-100 shrink-0">
                  {(item.item_image_url || item.image_url) ? (
                    <Image
                      src={item.item_image_url || item.image_url}
                      alt={item.item_name || item.name}
                      fill
                      className="object-cover"
                    />
                  ) : (
                    <div className="size-full flex items-center justify-center">
                      <ShoppingBag className="size-6 text-zinc-200" />
                    </div>
                  )}
                </div>
                <div className="flex-1 min-w-0">
                  <div className="flex items-start justify-between gap-2 mb-1">
                    <p className="text-sm font-bold text-zinc-900 line-clamp-2 leading-tight">{item.item_name || item.name}</p>
                    <p className="text-xs font-bold text-zinc-900 tabular-nums">x{item.quantity}</p>
                  </div>
                  {/* Add-ons List */}
                  {item.selected_addons && Array.isArray(item.selected_addons) && item.selected_addons.length > 0 && (
                    <div className="flex flex-wrap gap-1 mb-2">
                      {/* ... existing code ... */}
                    </div>
                  )}
                  <div className="flex items-center justify-between mt-2">
                    {renderItemStatus(item)}
                    <span className="text-xs font-bold text-zinc-900">₹{item.total_price}</span>
                  </div>
                </div>
              </div>
            ))}
          </div>
        </section>

        {/* 1.7. Post-Delivery Feedback */}
        {order.status === ORDER_STATUS.DELIVERED && (
          <FeedbackStep
            orderId={orderId}
            items={order.order_items?.map((item: any) => ({ id: item.item_id, name: item.item_name || item.name })) || []}
            onComplete={() => {
              // Optionally refresh
            }}
          />
        )}

        {/* 2. Action Zone (Preview Approval, etc) */}
        {order.status === ORDER_STATUS.PREVIEW_READY && previews[0] ? (
          <section className="bg-white rounded-[32px] border border-zinc-100 p-8 shadow-sm">
            <PreviewApproval
              preview={previews[0]}
              onApprove={async () => {
                setIsApproving(true);
                try {
                  const result = await approvePreview(previews[0].id, orderId);
                  if (result.success) {
                    toast.success('Preview approved. Production has started.');
                  } else {
                    toast.error(result.error ?? 'Failed to approve');
                  }
                } catch {
                  toast.error('Something went wrong');
                } finally {
                  setIsApproving(false);
                }
              }}
              onRequestChange={async (feedback: string) => {
                setIsRequestingChange(true);
                try {
                  const result = await requestChange(previews[0].id, orderId, feedback);
                  if (result.success) {
                    toast.success('Feedback sent. Partner will upload a new preview.');
                  } else {
                    toast.error(result.error ?? 'Failed to send feedback');
                  }
                } catch {
                  toast.error('Something went wrong');
                } finally {
                  setIsRequestingChange(false);
                }
              }}
              isApproving={isApproving || isRequestingChange}
              maxChanges={order.max_change_requests ?? 2}
              changeCount={order.change_request_count ?? 0}
            />
          </section>
        ) : null}

        {/* 3. Tracking & Address */}
        {order.awb_number && (
          <div className="bg-white rounded-2xl border border-zinc-100 p-4 flex items-center gap-3">
            <div className="size-10 bg-zinc-50 rounded-lg flex items-center justify-center">
              <Package className="size-5 text-zinc-400" />
            </div>
            <div>
              <p className="text-[10px] font-bold text-zinc-400 uppercase tracking-wider">Tracking ID</p>
              <p className="text-sm font-bold text-zinc-900">{order.courier_partner || 'Shadowfax'} • {order.awb_number}</p>
            </div>
          </div>
        )}

        {order.delivery_address && (
          <div className="bg-white rounded-2xl border border-zinc-100 p-4 flex items-start gap-3">
            <div className="size-10 bg-zinc-50 rounded-lg flex items-center justify-center shrink-0">
              <MapPin className="size-5 text-zinc-400" />
            </div>
            <div>
              <p className="text-[10px] font-bold text-zinc-400 uppercase tracking-wider mb-0.5">Delivery Address</p>
              <p className="text-xs font-medium text-zinc-600 line-clamp-2">
                {typeof order.delivery_address === 'object'
                  ? `${(order.delivery_address as Record<string, any>).name || ''} • ${(order.delivery_address as Record<string, any>).address_line1 || (order.delivery_address as Record<string, any>).line1 || ''}`
                  : 'Address on file'}
              </p>
              {((order as any).gstin || (order.delivery_address as any)?.gstin) && (
                <div className="mt-2 flex items-center gap-1.5 px-2 py-0.5 rounded-md bg-zinc-50 border border-zinc-100 w-fit">
                  <span className="text-[10px] font-bold text-zinc-400 uppercase tracking-wider">GSTIN:</span>
                  <span className="text-[10px] font-bold text-zinc-600 uppercase">{(order as any).gstin || (order.delivery_address as any).gstin}</span>
                </div>
              )}
            </div>
          </div>
        )}

        {/* 4. Order Details (Timeline) */}
        <section className="bg-white rounded-2xl border border-zinc-100 overflow-hidden">
          <button
            onClick={() => setExpandedTimeline(!expandedTimeline)}
            className="w-full px-5 py-4 flex items-center justify-between hover:bg-zinc-50/50 transition-colors"
          >
            <span className="text-xs font-bold text-zinc-900 uppercase tracking-widest">Order Updates</span>
            {expandedTimeline ? <ChevronUp className="size-4" /> : <ChevronDown className="size-4" />}
          </button>
          {expandedTimeline && (
            <div className="px-5 pb-5 pt-2">
              <div className="space-y-6 relative ml-2">
                <div className="absolute left-0 top-2 bottom-2 w-px bg-zinc-100" />
                {events.map((event, i) => (
                  <div key={event.id} className="relative pl-6">
                    <div className={cn("absolute left-[-4px] top-1.5 size-2 rounded-full border-2 border-white", i === 0 ? "bg-zinc-900" : "bg-zinc-200")} />
                    <div>
                      <h4 className={cn("text-xs", i === 0 ? "font-bold text-zinc-900" : "font-medium text-zinc-500")}>{event.title}</h4>
                      {event.description && <p className="text-[10px] text-zinc-400 mt-0.5">{event.description}</p>}
                      <span className="text-[9px] font-medium text-zinc-300 tabular-nums uppercase mt-1 block">
                        {new Date(event.createdAt).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
                      </span>
                    </div>
                  </div>
                ))}
              </div>
            </div>
          )}
        </section>

        {/* 5. Support */}
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
    </div>
  );
}
