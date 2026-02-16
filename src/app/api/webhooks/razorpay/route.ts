import { NextRequest, NextResponse } from 'next/server';
import { validateWebhookSignature } from '@/lib/services/razorpay';
import { createClient, createAdminClient } from '@/lib/supabase/server';
import { log } from '@/lib/logging/logger';
import { createOrder } from '@/lib/actions/orders';
import { handleAPIError } from '@/lib/utils/error-handler';
import Razorpay from 'razorpay';

export async function POST(req: NextRequest) {
  try {
    const body = await req.text();
    const signature = req.headers.get('x-razorpay-signature');
    const secret = process.env.RAZORPAY_WEBHOOK_SECRET;

    if (!signature || !secret) {
      return NextResponse.json({ error: 'Missing signature or secret' }, { status: 400 });
    }

    const isValid = validateWebhookSignature(body, signature, secret);
    if (!isValid) {
      return NextResponse.json({ error: 'Invalid signature' }, { status: 400 });
    }

    const event = JSON.parse(body);

    let supabase
    try {
      supabase = await createAdminClient();
    } catch (clientError) {
      log.error('[webhooks/razorpay] Failed to create Supabase client', clientError, { path: '/api/webhooks/razorpay' });
      return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
    }

    // Handle payment.captured event (NEW FLOW: Create order from payment)
    if (event.event === 'payment.captured') {
      const razorpayOrderId = event.payload.payment?.entity?.order_id;
      const razorpayPaymentId = event.payload.payment?.entity?.id;

      if (!razorpayOrderId || !razorpayPaymentId) {
        return NextResponse.json({ received: true, message: 'Missing order_id or payment_id' });
      }

      try {
        // Fetch Razorpay order to get notes (contains draftItems, addressId, etc.)
        const razorpayInstance = new Razorpay({
          key_id: process.env.RAZORPAY_KEY_ID!,
          key_secret: process.env.RAZORPAY_KEY_SECRET!,
        });

        // Fetch order from Razorpay
        const razorpayOrder = await razorpayInstance.orders.fetch(razorpayOrderId);
        const notes = (razorpayOrder.notes as any) || {};

        const userId = String(notes.userId || notes.user_id || '');
        const draftId = String(notes.draftId || notes.draft_id || '');

        if (!userId || userId === '' || !draftId || draftId === '') {
          log.error('[webhooks/razorpay] Missing required data in notes', { notes });
          return NextResponse.json({ error: 'Missing required data in payment notes' }, { status: 400 });
        }

        // Fetch draft order
        const { data: draft, error: draftError } = await supabase
          .from('draft_orders')
          .select('*')
          .eq('id', draftId)
          .single();

        if (draftError || !draft) {
          log.error('[webhooks/razorpay] Draft not found', { draftId, error: draftError });
          return NextResponse.json({ received: true, message: 'Draft not found or expired' });
        }

        // Check if order already exists (Idempotency)
        const { data: existingOrder } = await supabase
          .from('orders')
          .select('id')
          .eq('razorpay_order_id', razorpayOrderId)
          .maybeSingle();

        if (existingOrder) {
          log.info('[webhooks/razorpay] Order already exists', { orderId: existingOrder.id, razorpayOrderId });
          return NextResponse.json({ received: true, message: 'Order already processed' });
        }

        // Verify Amount (Safety Check)
        const paidAmountPaise = event.payload.payment?.entity?.amount;
        const expectedAmountPaise = Math.round((draft.metadata as any)?.pricing?.total * 100);

        if (paidAmountPaise && Math.abs(paidAmountPaise - expectedAmountPaise) > 50) { // Allowed 50 paise variance
          log.error('[webhooks/razorpay] Payment amount mismatch', { paidAmountPaise, expectedAmountPaise, razorpayOrderId });
          return NextResponse.json({ received: true, message: 'Payment amount mismatch' });
        }

        // Place order using draft data (Trigger-first model)
        const metadata = (draft.metadata as any) || {};
        const result = await createOrder({
          addressId: draft.address_id,
          items: draft.items as any,
          razorpayOrderId,
          paymentId: razorpayPaymentId,
          couponCode: metadata.couponCode,
          useWallet: metadata.useWallet,
          gstin: metadata.gstin,
          deliveryInstructions: metadata.deliveryInstructions,
          userId: userId,
          useAdmin: true
        });

        if ('error' in result) {
          throw new Error(result.error || 'Failed to create order atomicly');
        }

        // Cleanup draft after successful placement
        await supabase.from('draft_orders').delete().eq('id', draft.id);

        log.info('[webhooks/razorpay] Order created atomicly via triggers and draft cleaned', { orderId: result.orderId, razorpayOrderId });
        return NextResponse.json({ received: true, orderId: result.orderId });
      } catch (error) {
        log.error('[webhooks/razorpay] Error creating order from payment', error, { razorpayOrderId });
        // Return 200 to acknowledge receipt - Razorpay will retry on their end
        return NextResponse.json({ received: true, error: 'Failed to create order, will retry' }, { status: 200 });
      }
    }

    return NextResponse.json({ received: true });
  } catch (error) {
    log.error('[webhooks/razorpay] Unexpected error', error, { path: '/api/webhooks/razorpay' });
    return handleAPIError(error, 500);
  }
}
