import { updateOrderStatus } from '@/lib/actions/partner-actions';
import { createAdminClient } from '@/lib/supabase/server';
import { logger } from '@/lib/logging/logger';
import { ORDER_STATUS } from '@/lib/types/order-status';

/**
 * ENFORCE ACCEPTANCE DEADLINES (F13)
 * Scans for orders in PLACED state that have passed their accept_deadline
 * and automatically cancels them to prevent customer frustration.
 */
export async function enforceAcceptanceDeadlines() {
    try {
        const supabase = await createAdminClient();
        const now = new Date().toISOString();

        // 1. Fetch Placed orders where accept_deadline has passed
        const { data: expiredOrders, error } = await supabase
            .from('orders')
            .select('id, order_number')
            .eq('status', 'PLACED')
            .lt('accept_deadline', now);

        if (error) throw error;

        if (!expiredOrders || expiredOrders.length === 0) {
            return { count: 0 };
        }

        logger.info(`Enforcing deadlines for ${expiredOrders.length} orders`);

        let processedCount = 0;
        for (const order of expiredOrders) {
            // Check if we need to refund
            const { data: fullOrder } = await supabase
                .from('orders')
                .select('payment_status, payment_id, total')
                .eq('id', order.id)
                .single();

            let paymentUpdates = {};
            if (fullOrder && ['paid', 'PAID', 'captured', 'CAPTURED'].includes(fullOrder.payment_status || '') && fullOrder.payment_id) {
                try {
                    const { refundPayment } = await import('@/lib/services/razorpay');
                    const refundAmountPaise = Math.round(Number(fullOrder.total) * 100);
                    await refundPayment(fullOrder.payment_id, refundAmountPaise);
                    paymentUpdates = {
                        payment_status: 'refunded',
                        return_status: 'auto_refunded'
                    };
                    logger.info(`Auto-refund successful for expired order ${order.order_number}`);
                } catch (refundError) {
                    logger.error(`Auto-refund failed for expired order ${order.order_number}`, refundError);
                }
            }

            const { error: updateError } = await supabase
                .from('orders')
                .update({
                    status: 'CANCELLED',
                    updated_at: now,
                    ...paymentUpdates
                })
                .eq('id', order.id);

            if (!updateError) {
                // Log specific reason via RPC
                await supabase.rpc('log_order_status_history', {
                    p_order_id: order.id,
                    p_type: 'auto_cancelled_deadline',
                    p_title: 'Order Expired',
                    p_description: 'Order automatically cancelled as the partner did not accept it within the deadline.',
                    p_metadata: { source: 'system', reason: 'deadline_expired' }
                });
                processedCount++;
            } else {
                logger.error(`Failed to auto-cancel order ${order.id}`, updateError);
            }
        }

        return { count: processedCount };
    } catch (error) {
        logger.error('enforceAcceptanceDeadlines failed', error);
        return { error: 'Internal error' };
    }
}
