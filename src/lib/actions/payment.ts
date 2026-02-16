'use server';

import { createRazorpayOrder } from '@/lib/services/razorpay';
import { createClient } from '@/lib/supabase/server';
import { logError } from '@/lib/utils/error-handler';
import { logger } from '@/lib/logging/logger';
import { hasAnyPersonalization } from '@/lib/utils/personalization';
import { calculateHaversineDistance } from '@/lib/utils/distance';
import { getDeliveryFeeByDistance } from '@/lib/utils/pricing';

// WYSHKIT 2026: Node-level recalculateOrderTotal removed.
// We now use the database-level 'calculate_order_total' RPC for authority.

// WYSHKIT 2026: Single-Trip Pricing Recalculation via Database RPC
// Authority moves from Node.js logic to Postgres Logic
export async function createPaymentOrder(
    amount: number, // Client-provided amount (for validation)
    currency: string = 'INR',
    payload: {
        addressId: string;
        draftItems: any[];
        pricing: any;
        gstin?: string;
        appliedCoupon?: any;
        walletDiscount?: number;
        deliveryInstructions?: string;
    }
) {
    try {
        const supabase = await createClient();
        const { data: { user } } = await supabase.auth.getUser();

        if (!user) return { error: 'Unauthorized', status: 401 };
        if (!payload.draftItems || payload.draftItems.length === 0) return { error: 'No items in cart', status: 400 };

        // 1. Resolve address and distance for accurate delivery fee calculation
        const { data: address } = await supabase
            .from('addresses')
            .select('latitude, longitude')
            .eq('id', payload.addressId)
            .maybeSingle();

        let deliveryFee = 40; // Default minimum
        let distanceKm = null;

        if (address?.latitude && address?.longitude) {
            // Fetch partner coordinates from the first item
            const firstItemId = payload.draftItems[0].itemId;
            const { data: itemData } = await supabase
                .from('items')
                .select('partner_id, partners(latitude, longitude)')
                .eq('id', firstItemId)
                .single();

            const partnerLat = (itemData as any)?.partners?.latitude;
            const partnerLng = (itemData as any)?.partners?.longitude;

            if (partnerLat && partnerLng) {
                distanceKm = calculateHaversineDistance(
                    address.latitude,
                    address.longitude,
                    partnerLat,
                    partnerLng
                );
                deliveryFee = getDeliveryFeeByDistance(distanceKm);
            }
        }

        // 1.5. WYSHKIT 2026: STRICT INVENTORY CHECK (F4)
        const variantUsage = new Map<string, number>();
        payload.draftItems.forEach((item: any) => {
            const vId = item.selectedVariantId ?? item.variantId;
            if (vId) variantUsage.set(vId, (variantUsage.get(vId) || 0) + (item.quantity || 1));
        });

        if (variantUsage.size > 0) {
            const variantIds = Array.from(variantUsage.keys());
            const { data: variants, error: stockError } = await supabase
                .from('variants')
                .select('id, stock_quantity, item_id, items(name)')
                .in('id', variantIds);

            if (stockError) {
                logger.error('Inventory check failed', stockError);
                return { error: 'Failed to verify inventory', status: 500 };
            }

            for (const [vId, requiredQty] of variantUsage.entries()) {
                const variant = variants?.find(v => v.id === vId);
                if (!variant) {
                    return { error: 'One or more items are no longer available', status: 400 };
                }
                if ((variant.stock_quantity || 0) < requiredQty) {
                    const itemName = (variant.items as any)?.name || 'Item';
                    return { error: `Insufficient stock for ${itemName} (Available: ${variant.stock_quantity})`, status: 409 };
                }
            }
        }

        // 2. FETCH PRICING FROM DB RPC
        const { data: pricingData, error: pricingError } = await (supabase as any).rpc('calculate_order_total', {
            p_cart_items: payload.draftItems.map((item: any) => ({
                itemId: item.itemId,
                quantity: item.quantity,
                variantId: item.selectedVariantId ?? item.variantId ?? null,
                personalizationOptionId: item.personalization?.optionId || null,
                hasPersonalization: hasAnyPersonalization([item]),
                selectedAddons: item.selectedAddons || []
            })),
            p_delivery_fee: deliveryFee,
            p_coupon_code: payload.appliedCoupon?.code || null,
            p_distance_km: distanceKm
        });

        if (pricingError || (pricingData as any).error) {
            return { error: (pricingData as any)?.error || 'Pricing verification failed', status: 400 };
        }

        // 3. SECURE VALIDATION
        const serverAmount = Math.round((pricingData as any).total * 100);
        const walletPaise = Math.round((payload.walletDiscount || 0) * 100);
        const expectedClientAmount = serverAmount - walletPaise;
        const clientAmount = Math.round(amount);

        if (Math.abs(expectedClientAmount - clientAmount) > 5) {
            return { error: 'Price mismatch detected. Order security triggered.', status: 400 };
        }

        // 4. PERSIST DRAFT (WYSHKIT 2026: Bypass Razorpay Notes Limit)
        const { data: draft, error: draftError } = await supabase
            .from('draft_orders')
            .insert({
                user_id: user.id,
                items: payload.draftItems.map((item: any) => ({
                    itemId: item.itemId,
                    variantId: item.selectedVariantId ?? item.variantId ?? null,
                    quantity: item.quantity,
                    hasPersonalization: hasAnyPersonalization([item]),
                    personalization: item.personalization || null,
                    selectedAddons: item.selectedAddons || [],
                })),
                address_id: payload.addressId,
                metadata: {
                    gstin: payload.gstin || null,
                    deliveryInstructions: (payload.deliveryInstructions || '').trim(),
                    couponCode: payload.appliedCoupon?.code || null,
                    useWallet: !!(payload.walletDiscount && payload.walletDiscount > 0),
                    pricing: pricingData,
                    distanceKm: distanceKm,
                    deliveryFee: deliveryFee
                }
            })
            .select('id')
            .single();

        if (draftError) {
            logger.error('Failed to create draft order', draftError);
            return { error: 'Failed to prepare order', status: 500 };
        }

        // 5. RAZORPAY ORDER
        const receipt = `order_${Date.now()}`;
        const order = await createRazorpayOrder(
            serverAmount,
            currency,
            receipt,
            {
                userId: user.id,
                draftId: draft.id, // Only pass the ID to stay under 256 chars
            }
        );

        return {
            order: {
                id: order.id,
                amount: order.amount,
                currency: order.currency,
                key: process.env.NEXT_PUBLIC_RAZORPAY_KEY_ID,
                draftId: draft.id
            },
            error: null
        };
    } catch (error) {
        logError(error, 'CreatePaymentOrder');
        return { error: 'Failed to create payment order', status: 500 };
    }
}

// WYSHKIT 2026: Atomic Payment Verification & Order Placement
export async function verifyPaymentSignature(
    razorpayOrderId: string,
    razorpayPaymentId: string,
    razorpaySignature: string,
    payload: {
        draftId: string; // F4: Use Draft ID for reliability
    }
) {
    try {
        const { verifyPayment } = await import('@/lib/services/razorpay');
        const { createOrder } = await import('@/lib/actions/orders');
        const supabase = await createClient();
        const { data: { user } } = await supabase.auth.getUser();

        if (!user) {
            logger.error('verifyPaymentSignature: user not found in session');
            return { error: 'User session not found', status: 401 };
        }

        // 1. Fetch Draft Data
        const { data: draft, error: draftError } = await supabase
            .from('draft_orders')
            .select('*')
            .eq('id', payload.draftId)
            .single();

        if (draftError || !draft) {
            logger.error('verifyPaymentSignature: draft not found', { draftId: payload.draftId });
            return { error: 'Order session expired. Please try again.', status: 404 };
        }

        // 2. Verification Logic
        const isValid = await verifyPayment(
            razorpayOrderId,
            razorpayPaymentId,
            razorpaySignature
        );
        if (!isValid) return { error: 'Invalid payment signature', status: 400 };

        // WYSHKIT 2026: Idempotency Check (Anti-Double-Ordering)
        // If a webhook (F5) already processed this payment, we just return the order ID.
        const { data: existingOrder } = await (supabase as any)
            .from('orders')
            .select('id, order_number, has_personalization')
            .eq('razorpay_order_id', razorpayOrderId)
            .maybeSingle();

        if (existingOrder) {
            logger.info('verifyPaymentSignature: order already exists (webhook won)', { orderId: existingOrder.id });
            await cleanupDraftOrders(); // Clean up expired/stale drafts
            return {
                success: true,
                verified: true,
                orderId: existingOrder.id,
                orderNumber: existingOrder.order_number,
                hasPersonalization: existingOrder.has_personalization,
                error: null,
            };
        }

        // 3. ATOMIC ORDER PLACEMENT
        const metadata = (draft.metadata as any) || {};

        // Calculate personalization flag for UI feedback
        const hasPers = hasAnyPersonalization(draft.items as any[] || []);

        const orderResult = await createOrder({
            addressId: draft.address_id,
            items: draft.items as any,
            razorpayOrderId: razorpayOrderId,
            paymentId: razorpayPaymentId,
            couponCode: metadata.couponCode,
            useWallet: metadata.useWallet,
            gstin: metadata.gstin,
            deliveryInstructions: metadata.deliveryInstructions,
            distanceKm: metadata.distanceKm,
            deliveryFee: metadata.deliveryFee,
            userId: user.id,
            useAdmin: true // Webhook fallback might have won, or we use admin for atomic trust
        });

        if (!('success' in orderResult) || !orderResult.success) {
            return { error: ('error' in orderResult ? orderResult.error : 'Failed to finalize order') || 'Failed to finalize order', status: 500 };
        }

        // Cleanup draft
        await supabase.from('draft_orders').delete().eq('id', draft.id);

        return {
            success: true,
            verified: true,
            orderId: (orderResult as any).orderId,
            orderNumber: (orderResult as any).orderNumber,
            hasPersonalization: hasPers,
            error: null,
        };
    } catch (error) {
        logError(error, 'VerifyPaymentSignature');
        return { error: 'Payment verification failed', status: 500 };
    }
}

/**
 * WYSHKIT 2026: Cleanup logic for stale draft orders.
 * This can be called from a maintenance worker or cron job.
 */
export async function cleanupDraftOrders() {
    try {
        const { createAdminClient } = await import('@/lib/supabase/server');
        const supabase = await createAdminClient();
        const { error } = await supabase
            .from('draft_orders')
            .delete()
            .lt('expires_at', new Date().toISOString());

        if (error) {
            logger.error('Failed to cleanup draft orders', error);
            return { success: false, error };
        }

        return { success: true };
    } catch (error) {
        logError(error, 'CleanupDraftOrders');
        return { success: false, error };
    }
}
