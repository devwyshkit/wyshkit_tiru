'use server';

import { createAdminClient } from '@/lib/supabase/server';
import { creditCashbackOnDelivery } from './cashback';
import { logger } from '@/lib/logging/logger';
import { PRICING } from '@/lib/constants/pricing';

/**
 * WYSHKIT 2026: Post-Delivery Business Logic
 * Triggered by Shadowfax 'delivered' webhook or manual override.
 * Logic:
 * 1. Calculate and Record Settlement (Partner Revenue)
 * 2. Credit Customer Cashback
 * 3. Flag Invoice as Ready
 */
export async function triggerPostDeliveryEvents(orderId: string) {
    try {
        const supabase = await createAdminClient();

        // 1. Fetch Order with Partner Details
        const { data: order, error: fetchError } = await supabase
            .from('orders')
            .select(`
        *,
        partner:partners(commission_percentage)
      `)
            .eq('id', orderId)
            .single();

        if (fetchError || !order) {
            logger.error('Order not found for settlement', fetchError, { orderId });
            throw new Error('Order not found for settlement');
        }

        // Idempotency: Don't process if already settled
        if (order.net_settlement_amount !== null && order.net_settlement_amount > 0) {
            logger.info('Order already settled, skipping post-delivery events', { orderId });
            return { success: true, message: 'Already settled' };
        }

        // 2. SETTLEMENT CALCULATION (Swiggy 2026 Model)
        const total = Number(order.total);
        const commissionRate = Number((order.partner as any)?.commission_percentage || 15) / 100;

        // Items + Service revenue for commission basis
        const commissionBasis = Number(order.subtotal) + Number(order.personalization_charges || 0);
        const commissionAmount = Math.round(commissionBasis * commissionRate);

        // Razorpay Fees (Approx 2% + GST) - Standard estimation
        const razorpayFees = Math.round(total * 0.02);

        // Platform Fee (WyshKit Revenue)
        const platformFee = Number(order.platform_fee || PRICING.PLATFORM_FEE);

        // Net to Partner = Total - Commission - RP Fees - Platform Fee
        // Note: GST is collected by partner and handled in their proforma/tax filing
        const netSettlement = total - commissionAmount - razorpayFees - platformFee;

        // 3. PERSIST SETTLEMENT & TRIGGER POST-DELIVERY STATE
        const { error: updateError } = await supabase
            .from('orders')
            .update({
                commission_amount: commissionAmount,
                net_settlement_amount: Math.max(0, netSettlement),
                delivered_at: new Date().toISOString(),
                updated_at: new Date().toISOString(),
            })
            .eq('id', orderId);

        if (updateError) throw updateError;

        // 4. CREDIT CASHBACK (Customer Reward)
        try {
            await creditCashbackOnDelivery(orderId, order.user_id, total);
        } catch (cashbackError) {
            // Minor failure, don't crash the whole flow but log it
            logger.error('Cashback credit failed', cashbackError, { orderId });
        }

        logger.info('Post-delivery events triggered successfully', { orderId, netSettlement });
        return { success: true };

    } catch (error) {
        logger.error('Failed to trigger post-delivery events', error, { orderId });
        return { success: false, error: 'Internal logic failure' };
    }
}
