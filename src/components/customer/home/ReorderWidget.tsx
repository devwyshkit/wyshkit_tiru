'use client';

import { useState, useEffect } from 'react';
import Image from 'next/image';
import { RotateCcw, ChevronRight, Sparkles, Clock, Check } from 'lucide-react';
import { useAuth } from '@/hooks/useAuth';
import { useCart } from '@/components/customer/CartProvider';
import { createClient } from '@/lib/supabase/client';
import { toast } from 'sonner';
import { cn } from '@/lib/utils';
import { logger } from '@/lib/logging/logger';

interface RecentOrder {
  id: string;
  orderNumber: string;
  items: Array<{
    item_id: string;
    item_name: string;
    quantity: number;
    images?: string[];
    variant_id?: string;
    personalization?: {
      enabled: boolean;
      optionId?: string;
    };
  }>;
  total: number;
  createdAt: string;
  partnerName?: string;
}

export function ReorderWidget() {
  const { user } = useAuth();
  const { addToDraftOrder, clearDraftOrder, isPending } = useCart();

  const [recentOrders, setRecentOrders] = useState<RecentOrder[]>([]);
  const [loading, setLoading] = useState(true);
  const [reorderingId, setReorderingId] = useState<string | null>(null);

  useEffect(() => {
    if (!user) {
      setLoading(false);
      return;
    }

    const fetchRecentOrders = async () => {
      const supabase = createClient();
      const { data, error } = await supabase
        .from('v_orders_detailed')
        .select('id, order_number, items, total, created_at, partner_name')
        .eq('user_id', user.id)
        .in('status', ['DELIVERED', 'DISPATCHED', 'PACKED', 'APPROVED', 'IN_PRODUCTION'])
        .order('created_at', { ascending: false })
        .limit(3);

      if (!error && data) {
        // Map snake_case from DB to camelCase for component
        const mapped = (data as any[]).map(d => ({
          id: d.id,
          orderNumber: d.order_number,
          items: d.items,
          total: Number(d.total),
          createdAt: d.created_at,
          partnerName: d.partner_name
        }));
        setRecentOrders(mapped as RecentOrder[]);
      }
      setLoading(false);
    };

    fetchRecentOrders();
  }, [user]);

  const handleReorder = async (order: RecentOrder) => {
    if (!order.items || order.items.length === 0) return;

    setReorderingId(order.id);

    try {
      for (const item of order.items) {
        await addToDraftOrder(
          item.item_id,
          item.variant_id || null,
          item.personalization || { enabled: false },
          [],
          item.quantity,
          {
            itemName: item.item_name,
            itemImage: item.images?.[0],
            unitPrice: 0,
            partnerName: order.partnerName,
          }
        );
      }
      toast.success('Items added to cart!');
      logger.info('Reorder successful', { orderId: order.id, itemCount: order.items.length });
    } catch (error) {
      const errorMessage = error instanceof Error ? error.message : 'Unknown error';
      logger.error('Reorder failed', error, { orderId: order.id, itemCount: order.items.length });
      toast.error('Failed to add items. Please try again.');
    } finally {
      setReorderingId(null);
    }
  };

  const formatDate = (dateStr: string) => {
    const date = new Date(dateStr);
    const now = new Date();
    const diffDays = Math.floor((now.getTime() - date.getTime()) / (1000 * 60 * 60 * 24));

    if (diffDays === 0) return 'Today';
    if (diffDays === 1) return 'Yesterday';
    if (diffDays < 7) return `${diffDays} days ago`;
    return date.toLocaleDateString('en-IN', { day: 'numeric', month: 'short' });
  };

  if (!user) {
    return null;
  }

  if (loading) return null;

  if (recentOrders.length === 0) {
    return null;
  }

  return (
    <section className="px-4 py-2 md:px-8">
      <div className="flex items-center justify-between mb-4">
        <div className="flex items-center gap-2">
          <div className="size-8 rounded-lg bg-emerald-100 flex items-center justify-center">
            <RotateCcw className="size-4 text-emerald-600" />
          </div>
          <div>
            <h2 className="text-base font-bold text-zinc-900">Reorder</h2>
            <p className="text-[11px] text-zinc-500">From your past orders</p>
          </div>
        </div>
      </div>

      <div className="flex gap-3 overflow-x-auto no-scrollbar -mx-4 px-4 pb-2">
        {recentOrders.map((order, index) => {
          const firstItem = order.items?.[0];
          const itemCount = order.items?.length || 0;
          const isReordering = reorderingId === order.id;
          const hasPersonalization = order.items?.some(i => i.personalization?.enabled);

          return (
            <button
              key={order.id}
              onClick={() => handleReorder(order)}
              disabled={isPending || isReordering}
              className={cn(
                "shrink-0 w-[260px] bg-white rounded-2xl border border-zinc-100 overflow-hidden",
                "hover:border-zinc-200 hover:shadow-lg transition-all duration-300",
                "active:scale-[0.98] disabled:opacity-60 disabled:cursor-not-allowed",
                "group slide-in-from-bottom-2",
                `[animation-delay:${index * 0.1}s]`
              )}
            >
              <div className="flex items-stretch">
                <div className="relative w-20 bg-zinc-100">
                  {firstItem?.images?.[0] ? (
                    <Image
                      src={firstItem.images[0]}
                      alt={firstItem.item_name || 'Order item'}
                      fill
                      className="object-cover"
                      sizes="80px"
                    />
                  ) : (
                    <div className="size-full flex items-center justify-center">
                      <RotateCcw className="size-6 text-zinc-300" />
                    </div>
                  )}
                  {hasPersonalization && (
                    <div className="absolute bottom-1 left-1 px-1 py-0.5 rounded bg-amber-500/90">
                      <Sparkles className="size-2.5 text-white" />
                    </div>
                  )}
                </div>

                <div className="flex-1 p-3 flex flex-col min-w-0">
                  <div className="flex items-center gap-1.5 text-[10px] text-zinc-400 mb-1">
                    <Clock className="size-3" />
                    <span>{formatDate(order.createdAt)}</span>
                    <span>•</span>
                    <span className="truncate">{order.partnerName}</span>
                  </div>

                  <p className="text-sm font-semibold text-zinc-900 truncate">
                    {firstItem?.item_name || 'Order'}
                  </p>
                  {itemCount > 1 && (
                    <p className="text-[11px] text-zinc-500">
                      +{itemCount - 1} more item{itemCount > 2 ? 's' : ''}
                    </p>
                  )}

                  <div className="flex items-center justify-between mt-auto pt-2">
                    <span className="text-sm font-bold text-zinc-900 tabular-nums">
                      ₹{order.total.toFixed(0)}
                    </span>

                    <div className={cn(
                      "flex items-center gap-1 px-2.5 py-1 rounded-lg text-[11px] font-bold transition-all",
                      isReordering
                        ? "bg-emerald-100 text-emerald-700"
                        : "bg-zinc-100 text-zinc-700 group-hover:bg-zinc-900 group-hover:text-white"
                    )}>
                      {isReordering ? (
                        <>
                          <Check className="size-3" />
                          <span>Adding</span>
                        </>
                      ) : (
                        <>
                          <span>Reorder</span>
                          <ChevronRight className="size-3" />
                        </>
                      )}
                    </div>
                  </div>
                </div>
              </div>
            </button>
          );
        })}
      </div>
    </section>
  );
}
