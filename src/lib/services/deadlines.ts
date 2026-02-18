import { createAdminClient } from '@/lib/supabase/server';
import { logger } from '@/lib/logging/logger';
import { ORDER_STATUS } from '@/lib/types/order-status';

/**
 * ENFORCE DESIGN DEADLINES (Wyshkit 2026)
 * Scans for:
 * 1. Confirmed orders where customer hasn't shared details for 24h (Cancel/Partial Refund)
 * 2. Preview Ready orders where customer hasn't actioned for 24h (Auto-Approve)
 */
export async function enforceDesignDeadlines() {
    try {
        const supabase = await createAdminClient();
        const now = new Date();
        const nowIso = now.toISOString();
        const twentyFourHoursAgo = new Date(now.getTime() - 24 * 60 * 60 * 1000).toISOString();

        let processedCount = 0;

        // 1. CLEANUP: No Personalization Details for 24h
        // WYSHKIT 2026: Partial Refund Policy - Partner slot reservation fee (₹50) retained.
        const { data: detailTimeouts } = await supabase
            .from('orders')
            .select('id, order_number, payment_id, total, payment_status')
            .eq('status', ORDER_STATUS.CONFIRMED)
            .eq('has_personalization', true)
            .is('personalization_input', null)
            .lt('created_at', twentyFourHoursAgo);

        if (detailTimeouts && detailTimeouts.length > 0) {
            for (const order of detailTimeouts) {
                let paymentUpdates = {};
                const partnerStake = 50; // Partner compensation for reservation slot
                const refundAmount = Math.max(0, (Number(order.total) || 0) - partnerStake);

                if (['paid', 'PAID', 'captured', 'CAPTURED'].includes(order.payment_status || '') && order.payment_id) {
                    try {
                        const { refundPayment } = await import('@/lib/services/razorpay');
                        const refundAmountPaise = Math.round(refundAmount * 100);
                        await refundPayment(order.payment_id, refundAmountPaise);
                        paymentUpdates = {
                            payment_status: 'partial_refunded',
                            refunded_amount: refundAmount
                        };
                    } catch (e) {
                        logger.error(`Auto-refund failed for design timeout ${order.order_number}`, e);
                    }
                }

                await supabase.from('orders').update({
                    status: ORDER_STATUS.CANCELLED,
                    updated_at: nowIso,
                    cancellation_reason: `Design deadline expired (24h). Partner compensated ₹${partnerStake} for time slot.`,
                    cancelled_by: 'system',
                    ...paymentUpdates
                }).eq('id', order.id);

                await (supabase as any).rpc('log_order_status_history', {
                    p_order_id: order.id,
                    p_type: 'auto_cancelled_timeout',
                    p_title: 'Order Cancelled',
                    p_description: `Personalization details were not shared within 24 hours. A refund of ₹${refundAmount} has been initiated (₹${partnerStake} retained for partner).`,
                    p_metadata: {
                        reason: 'design_timeout',
                        original_total: order.total,
                        refund_amount: refundAmount,
                        partner_stake: partnerStake
                    }
                });
                processedCount++;
            }
        }

        // 2. AUTO-APPROVE: No Preview Action for 24h
        // WYSHKIT 2026: "Silence is Consent" - Move to APPROVED so production can start.
        const { data: previewTimeouts } = await supabase
            .from('orders')
            .select('id, order_number')
            .eq('status', ORDER_STATUS.PREVIEW_READY)
            .lt('preview_uploaded_at', twentyFourHoursAgo);

        if (previewTimeouts && previewTimeouts.length > 0) {
            for (const order of previewTimeouts) {
                const { data: preview } = await supabase
                    .from('preview_submissions')
                    .select('id')
                    .eq('order_id', order.id)
                    .eq('status', 'pending')
                    .order('submitted_at', { ascending: false })
                    .limit(1)
                    .maybeSingle();

                if (preview) {
                    await supabase.from('preview_submissions').update({ status: 'approved' }).eq('id', preview.id);
                    await supabase.from('orders').update({
                        status: ORDER_STATUS.APPROVED,
                        approved_at: nowIso,
                        updated_at: nowIso
                    }).eq('id', order.id);

                    await (supabase as any).rpc('log_order_status_history', {
                        p_order_id: order.id,
                        p_type: 'auto_approved',
                        p_title: 'Design Auto-Approved',
                        p_description: 'The design has been auto-approved after 24 hours of inactivity. Production will begin shortly.',
                        p_metadata: { reason: 'preview_timeout' }
                    });
                    processedCount++;
                }
            }
        }

        return { count: processedCount };
    } catch (error) {
        logger.error('enforceDesignDeadlines failed', error);
        return { error: 'Internal error' };
    }
}

/**
 * ENFORCE ACCEPTANCE DEADLINES (Hyperlocal Speed)
 * Scans for orders in PLACED state that have passed their accept_deadline (5m)
 * Automatically cancels and issues a FULL refund since partner failed to act.
 */
export async function enforceAcceptanceDeadlines() {
    try {
        const supabase = await createAdminClient();
        const nowIso = new Date().toISOString();

        const { data: expiredOrders, error } = await supabase
            .from('orders')
            .select('id, order_number, payment_status, payment_id, total')
            .eq('status', ORDER_STATUS.PLACED)
            .lt('accept_deadline', nowIso);

        if (error) throw error;
        if (!expiredOrders || expiredOrders.length === 0) return { count: 0 };

        let processedCount = 0;
        for (const order of expiredOrders) {
            let paymentUpdates = {};
            if (['paid', 'PAID', 'captured', 'CAPTURED'].includes(order.payment_status || '') && order.payment_id) {
                try {
                    const { refundPayment } = await import('@/lib/services/razorpay');
                    const refundAmountPaise = Math.round(Number(order.total) * 100);
                    await refundPayment(order.payment_id, refundAmountPaise);
                    paymentUpdates = {
                        payment_status: 'refunded',
                        refunded_amount: order.total
                    };
                } catch (refundError) {
                    logger.error(`Auto-refund failed for expired order ${order.order_number}`, refundError);
                }
            }

            await supabase.from('orders').update({
                status: ORDER_STATUS.CANCELLED,
                updated_at: nowIso,
                cancelled_by: 'system',
                cancellation_reason: 'Partner acceptance timeout (5m)',
                ...paymentUpdates
            }).eq('id', order.id);

            await (supabase as any).rpc('log_order_status_history', {
                p_order_id: order.id,
                p_type: 'auto_cancelled_deadline',
                p_title: 'Order Expired',
                p_description: 'Order automatically cancelled as the partner did not accept it within the deadline. Full refund initiated.',
                p_metadata: { reason: 'acceptance_timeout' }
            });
            processedCount++;
        }

        return { count: processedCount };
    } catch (error) {
        logger.error('enforceAcceptanceDeadlines failed', error);
        return { error: 'Internal error' };
    }
}
