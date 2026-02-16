import { logger } from '@/lib/logging/logger';
import { ShadowfaxService } from '@/lib/services/shadowfax';
import { createAdminClient } from '@/lib/supabase/server';

interface DispatchOrderPayload {
    orderId: string;
}

/**
 * WYSHKIT 2026: Standardized Dispatch Orchestrator
 * Rules:
 * 1. Try Shadowfax API (3 attempts, 30s apart).
 * 2. If all attempts fail, Fallback to Manual Delivery.
 */
export const dispatchOrder = async (payload: DispatchOrderPayload): Promise<{ success: boolean; error?: string }> => {
    try {
        const supabase = await createAdminClient();

        // 1. Fetch Order and Details
        const { data: order, error: orderError } = await supabase
            .from('orders')
            .select(`
                *,
                delivery_address:addresses(*),
                partner:partners(*),
                order_items(*)
            `)
            .eq('id', payload.orderId)
            .single();

        if (orderError || !order) {
            logger.error('DispatchService: Order not found', orderError, { orderId: payload.orderId });
            return { success: false, error: 'Order not found' };
        }

        if (order.awb_number) return { success: true };

        // 2. Resolve Logistics
        const address = Array.isArray(order.delivery_address) ? order.delivery_address[0] : order.delivery_address;
        const partner = Array.isArray(order.partner) ? order.partner[0] : order.partner;
        const orderItems = (order.order_items as any[]) || [];

        let totalWeight = 0;
        orderItems.forEach((item: any) => {
            totalWeight += (Number(item.weight_kg) || 0.1) * (item.quantity || 1);
        });

        const shadowfaxPayload = {
            orderId: order.id,
            customer: {
                name: (address as any)?.name || 'Customer',
                phone: (address as any)?.phone || '',
                address: `${(address as any)?.address_line1 || ''}`.trim(),
                city: (address as any)?.city || '',
                pincode: (address as any)?.pincode || '',
            },
            pickup: {
                name: partner?.business_name || 'Partner',
                phone: String(partner?.whatsapp_number || ''),
                address: `${partner?.address || ''}`.trim(),
                city: partner?.city || '',
                pincode: partner?.pincode || '',
            },
            order_details: {
                total_weight_kg: totalWeight > 0 ? totalWeight : 0.5,
            }
        };

        // 3. Orchestrate 3 Attempts
        let attempts = 0;
        let lastError = '';
        let dispatchResult;

        while (attempts < 3) {
            attempts++;
            logger.info(`[Dispatch] Attempt ${attempts} for ${order.order_number}`);

            dispatchResult = await ShadowfaxService.createOrder(shadowfaxPayload);

            if (dispatchResult.success) break;

            lastError = dispatchResult.error || 'Shadowfax error';
            if (attempts < 3) await new Promise(r => setTimeout(r, 30000)); // 30s interval
        }

        // 4. Finalize
        if (dispatchResult?.success) {
            await supabase.from('orders').update({
                awb_number: dispatchResult.awbNumber,
                courier_partner: 'Shadowfax',
                tracking_url: dispatchResult.trackingUrl,
                updated_at: new Date().toISOString()
            }).eq('id', payload.orderId);

            return { success: true };
        } else {
            // FALLBACK: Manual
            logger.error(`[Dispatch] All Shadowfax attempts failed. Manual fallback for ${order.id}`);
            await supabase.from('orders').update({
                courier_partner: 'Manual/Partner',
                updated_at: new Date().toISOString()
            }).eq('id', payload.orderId);

            return { success: true, error: lastError }; // Return success so UI doesn't block, but error logged
        }

    } catch (error) {
        logger.error('DispatchService: Internal error', error);
        return { success: false, error: 'Internal dispatch error' };
    }
};
