'use client';

import { useState, useEffect } from 'react';
import { createClient } from '@/lib/supabase/client';
import { ORDER_STATUS, type OrderStatus } from '@/lib/types/order-status';
import { logger } from '@/lib/logging/logger';
import { useAuth } from '@/hooks/useAuth';
import { useRealtime } from '@/providers/RealtimeProvider';

export interface ActiveOrder {
    id: string;
    order_number: string;
    status: OrderStatus;
    has_personalization: boolean;
    total: number;
    partner_name?: string;
    items?: { name: string }[];
}

/**
 * WYSHKIT 2026: Hook to monitor active orders for a user.
 * Reuses the shared Realtime channel to prevent proliferation.
 */
export function useActiveOrders() {
    const { user, loading: authLoading } = useAuth();
    const { channel } = useRealtime(); // WYSHKIT 2026: Shared Pulse
    const [activeOrders, setActiveOrders] = useState<ActiveOrder[]>([]);
    const [loading, setLoading] = useState(true);
    const supabase = createClient();

    const fetchActiveOrders = async (uid: string) => {
        const { data, error } = await supabase
            .from('orders')
            .select('id,order_number,status,has_personalization,total,partners(name),order_items(item_name)')
            .eq('user_id', uid)
            .not('status', 'in', `(${[ORDER_STATUS.DELIVERED, ORDER_STATUS.CANCELLED, ORDER_STATUS.REFUNDED].join(',')})`)
            .order('created_at', { ascending: false });

        if (error) {
            logger.error('Error fetching active orders', error);
        } else {
            setActiveOrders(data.map((o: any) => ({
                id: o.id,
                order_number: o.order_number,
                status: o.status as OrderStatus,
                has_personalization: o.has_personalization,
                total: o.total,
                partner_name: o.partners?.name,
                items: Array.isArray(o.order_items) ? o.order_items.map((i: any) => ({ name: i.item_name })) : []
            })));
        }
        setLoading(false);
    };

    useEffect(() => {
        if (authLoading || !user) {
            if (!authLoading) {
                setActiveOrders([]);
                setLoading(false);
            }
            return;
        }

        fetchActiveOrders(user.id);

        // WYSHKIT 2026: Use a dedicated channel for this hook's specific filter.
        // This avoids listener accumulation on the shared Pulse channel.
        const userActiveOrdersChannel = supabase
            .channel(`active-orders-${user.id}`)
            .on(
                'postgres_changes',
                {
                    event: '*',
                    schema: 'public',
                    table: 'orders',
                    filter: `user_id=eq.${user.id}`
                },
                () => {
                    fetchActiveOrders(user.id);
                }
            )
            .subscribe();

        return () => {
            supabase.removeChannel(userActiveOrdersChannel);
        };
    }, [user?.id, authLoading]);

    return { activeOrders, loading };
}
