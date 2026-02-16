'use server';

import { createClient, createAdminClient } from '@/lib/supabase/server';
import { ORDER_STATUS } from '@/lib/types/order-status';
import { revalidatePath } from 'next/cache';
import { Database, Json } from '@/lib/supabase/database.types';
import type { DBOrder, Tables, OrderDetails, OrderWithRelations, OrderStatusHistory } from '@/lib/supabase/types';
import { logError, handleActionError } from '@/lib/utils/error-handler';
import { logger } from '@/lib/logging/logger';
import { hasItemPersonalization } from '@/lib/utils/personalization';

/** Item shape for place_secure_order RPC (matches checkout payload). */
export interface PlaceOrderItem {
  itemId: string;
  variantId?: string | null;
  quantity: number;
  hasPersonalization?: boolean;
  personalization?: { enabled?: boolean; optionId?: string } | null;
  selectedAddons?: Array<{ id: string; name?: string; price?: number; requires_preview?: boolean }>;
}

export interface PlaceOrderPayload {
  addressId: string;
  items: PlaceOrderItem[];
  razorpayOrderId: string;
  paymentId?: string;
  couponCode?: string | null;
  useWallet?: boolean;
  gstin?: string | null;
  deliveryInstructions?: string | null;
  userId?: string;
  useAdmin?: boolean;
  distanceKm?: number;
  deliveryFee?: number;
}


async function logOrderStatusHistory(orderId: string, type: string, title: string, description: string, metadata: Record<string, unknown> = {}) {
  const supabase = await createAdminClient();
  const { error } = await (supabase as any).rpc('log_order_status_history', {
    p_order_id: orderId,
    p_type: type,
    p_title: title,
    p_description: description,
    p_metadata: metadata as Json
  });

  if (error) logError(error, 'OrderStatusHistory');
}

export async function submitOrderPersonalization(orderId: string, personalizationInput: Record<string, unknown>): Promise<{ success: boolean; error?: string }> {
  try {
    logger.info(`[submitOrderPersonalization] Starting for order: ${orderId}`, { personalizationInput });

    // 1. Verify Ownership & Fetch Current State
    const supabase = await createClient();
    const { data: { user } } = await supabase.auth.getUser();

    if (!user) {
      return { success: false, error: "Unauthorized" };
    }

    const { data: order, error: fetchError } = await supabase
      .from('orders')
      .select('id, user_id, status')
      .eq('id', orderId)
      .single();

    if (fetchError || !order) {
      return { success: false, error: "Order not found" };
    }

    // Strict ownership check
    if (order.user_id !== user.id) {
      logger.error(`[submitOrderPersonalization] Unauthorized attempt by ${user.id} for order ${orderId}`);
      return { success: false, error: "Unauthorized" };
    }

    // 2. Validate Current State
    // WYSHKIT 2026: "Momentum First" - Allow upload during PLACED, but only move status for CONFIRMED.
    const canSubmit = ([ORDER_STATUS.PLACED, ORDER_STATUS.CONFIRMED, ORDER_STATUS.DETAILS_RECEIVED, ORDER_STATUS.REVISION_REQUESTED] as string[]).includes(order.status);

    if (!canSubmit) {
      return { success: false, error: `Cannot submit details in ${order.status} state.` };
    }

    // 3. Determine Next Status
    // Only move to DETAILS_RECEIVED if we were already CONFIRMED or in the loop.
    // If PLACED, we stay PLACED until the partner commits (Accepts).
    const nextStatus = order.status === ORDER_STATUS.PLACED ? ORDER_STATUS.PLACED : ORDER_STATUS.DETAILS_RECEIVED;

    // 3. Use Admin Client for Updates (Bypass RLS complexity)
    const adminSupabase = await createAdminClient();

    // 4. Update Order Level Status
    const { error: updateError } = await adminSupabase
      .from('orders')
      .update({
        personalization_input: personalizationInput as unknown as Json,
        personalization_status: 'submitted',
        status: nextStatus,
        details_submitted_at: new Date().toISOString(),
        updated_at: new Date().toISOString()
      })
      .eq('id', orderId);

    if (updateError) {
      logger.error(`[submitOrderPersonalization] Failed to update orders table`, updateError);
      throw updateError;
    }

    // 4. Try updating Relational Items & Order Personalization
    const personalizationEntries = [];
    let entryIndex = 0;

    for (const [orderItemId, details] of Object.entries(personalizationInput)) {
      const d = details as any;
      const { data: itemExists } = await adminSupabase
        .from('order_items')
        .select('id')
        .eq('id', orderItemId)
        .maybeSingle();

      if (itemExists) {
        await adminSupabase
          .from('order_items')
          .update({
            personalization_details: d as unknown as Json,
            status: 'submitted'
          })
          .eq('id', orderItemId);
      }

      // WYSHKIT 2026: Add to relational personalization table for structured tracking
      personalizationEntries.push({
        order_id: orderId,
        item_index: entryIndex++,
        text_input: d.text || null,
        uploaded_files: d.image_url ? [d.image_url] : (d.images || []),
        instructions: d.instructions || null,
        status: 'submitted',
        submitted_at: new Date().toISOString()
      });
    }

    if (personalizationEntries.length > 0) {
      await adminSupabase
        .from('order_personalization')
        .upsert(personalizationEntries);
    }

    await logOrderStatusHistory(orderId, 'personalization_submitted', 'Details Shared', 'You have shared the personalization details with the partner.', { personalization: personalizationInput });

    revalidatePath(`/orders/${orderId}`);
    return { success: true };
  } catch (error) {
    logError(error, `SubmitPersonalization:${orderId}`);
    const { error: errMsg } = handleActionError(error);
    return { success: false, error: errMsg };
  }
}

/**
 * WYSHKIT 2026: Enforce HARD LIMIT on revisions (5 attempts total).
 * Corresponds to Break #2.
 */
export async function enforceRevisionLimits(orderId: string) {
  try {
    const supabase = await createAdminClient();

    // Count existing previews/revisions
    const { count, error } = await supabase
      .from('preview_submissions')
      .select('*', { count: 'exact', head: true })
      .eq('order_id', orderId);

    if (error) throw error;

    if (count && count >= 5) {
      return { limited: true, count, message: 'Maximum revision limit (5) reached. Please approve the current design or contact support.' };
    }

    return { limited: false, count };
  } catch (error) {
    logger.error(`Failed to check revision limits for ${orderId}`, error);
    return { limited: true, error: 'Failed to verify limits' };
  }
}

export async function markOrderAsPacked(orderId: string) {
  try {
    const { updateOrderStatus } = await import('@/lib/actions/partner-actions');
    const result = await updateOrderStatus(orderId, ORDER_STATUS.PACKED);

    if (!result.success) {
      throw new Error(result.error);
    }

    revalidatePath(`/orders/${orderId}`);
    return { success: true };
  } catch (error) {
    logError(error, `MarkAsPacked:${orderId}`);
    const { error: errMsg } = handleActionError(error);
    return { success: false, error: errMsg };
  }
}

export async function approvePreview(previewSubmissionId: string, orderId: string) {
  try {
    const supabase = await createClient();

    const { error: previewError } = await supabase
      .from('preview_submissions')
      .update({ status: 'approved' })
      .eq('id', previewSubmissionId);

    if (previewError) throw previewError;

    const { error: orderError } = await supabase
      .from('orders')
      .update({
        status: ORDER_STATUS.APPROVED,
        approved_at: new Date().toISOString(),
        updated_at: new Date().toISOString()
      })
      .eq('id', orderId);

    if (orderError) throw orderError;

    await logOrderStatusHistory(orderId, 'preview_approved', 'Preview Approved', 'You have approved the preview. The partner will now start production (Preparing).', { preview_submission_id: previewSubmissionId });

    revalidatePath(`/orders/${orderId}`);
    return { success: true };
  } catch (error) {
    logError(error, `ApprovePreview:${orderId}`);
    const { error: errMsg } = handleActionError(error);
    return { success: false, error: errMsg };
  }
}

export async function requestChange(previewSubmissionId: string, orderId: string, feedback: string) {
  try {
    const supabase = await createClient();

    const { data: order, error: orderError } = await supabase
      .from('orders')
      .select('change_request_count, max_change_requests')
      .eq('id', orderId)
      .maybeSingle();

    if (orderError) throw orderError;
    if (!order) {
      return { success: false, error: 'Order not found' };
    }

    const changeRequestCount = (order.change_request_count || 0) + 1;
    const maxChangeRequests = order.max_change_requests || 2;

    if (changeRequestCount > maxChangeRequests) {
      return { success: false, error: `Maximum ${maxChangeRequests} change requests allowed. Please approve or contact support.` };
    }

    const { error: previewError } = await supabase
      .from('preview_submissions')
      .update({
        status: 'change_requested',
        customer_feedback: feedback
      })
      .eq('id', previewSubmissionId);

    if (previewError) throw previewError;

    const { error: updateOrderError } = await supabase
      .from('orders')
      .update({
        status: ORDER_STATUS.REVISION_REQUESTED,
        change_request_count: changeRequestCount,
        updated_at: new Date().toISOString()
      })
      .eq('id', orderId);

    if (updateOrderError) throw updateOrderError;

    await logOrderStatusHistory(orderId, 'change_requested', 'Change Requested', `You have requested changes to the preview (${changeRequestCount}/${maxChangeRequests}).`, { feedback, preview_submission_id: previewSubmissionId, change_request_count: changeRequestCount });

    revalidatePath(`/orders/${orderId}`);
    return { success: true, changeRequestCount, maxChangeRequests };
  } catch (error) {
    logError(error, `RequestChange:${orderId}`);
    const { error: errMsg } = handleActionError(error);
    return { success: false, error: errMsg };
  }
}

export async function getOrderWithHistory(orderId: string): Promise<{ order: OrderDetails | null; error?: string }> {
  try {
    const supabase = await createClient();

    const { data, error } = await supabase
      .from('orders')
      .select(`
        *,
        order_items(*),
        order_status_history(*),
        partners(name, image_url)
      `)
      .eq('id', orderId)
      .single();

    if (error || !data) {
      return { order: null, error: 'Order not found' };
    }

    // Cast to the robust join type we defined
    const rawOrder = data as unknown as OrderWithRelations;

    // Sort history by latest first
    const orderStatusHistory = (rawOrder.order_status_history || []).sort((a, b) => {
      const aTime = a.created_at ? new Date(a.created_at).getTime() : 0;
      const bTime = b.created_at ? new Date(b.created_at).getTime() : 0;
      return bTime - aTime;
    });

    // Map snake_case to camelCase for the frontend (keeping existing contract)
    const mappedOrder: OrderDetails = {
      ...rawOrder,
      partner_name: rawOrder.partners?.name || 'Partner',
      partner_image: rawOrder.partners?.image_url,
      orderNumber: rawOrder.order_number,
      createdAt: rawOrder.created_at,
      userId: rawOrder.user_id,
      partnerId: rawOrder.partner_id,
      partnerName: rawOrder.partners?.name || 'Partner',
      hasPersonalization: rawOrder.has_personalization,
      personalizationStatus: rawOrder.personalization_status,
      orderStatusHistory,
      orderItems: rawOrder.order_items || []
    };

    return { order: mappedOrder };
  } catch (error) {
    logError(error, 'GetOrderWithHistory');
    const { error: errMsg } = handleActionError(error);
    return { order: null, error: errMsg };
  }
}

export async function enforceDesignDeadlines() {
  try {
    const supabase = await createAdminClient();
    const now = new Date().toISOString();

    // 1. Cancel orders where customer hasn't shared details within 12h
    const { data: expiredDetails, error: fetchError } = await supabase
      .from('orders')
      .select('id, order_number, user_id, payment_id, total')
      .eq('status', ORDER_STATUS.CONFIRMED)
      .eq('has_personalization', true)
      .is('personalization_input', null)
      .lt('design_deadline_at', now);

    if (fetchError) throw fetchError;
    const expiredOrdersList = (expiredDetails || []) as unknown as Pick<DBOrder, 'id' | 'order_number' | 'user_id' | 'payment_id' | 'total'>[];

    const results = [];

    for (const order of expiredOrdersList) {
      try {
        await supabase
          .from('orders')
          .update({
            status: ORDER_STATUS.CANCELLED,
            return_status: 'auto_refunded',
            updated_at: now
          })
          .eq('id', order.id);

        await logOrderStatusHistory(
          order.id,
          'auto_refund',
          'Order Cancelled (Details Timeout)',
          'Your order was cancelled and refunded because personalization details were not shared within 12 hours.',
          { order_number: order.order_number }
        );

        results.push(order.id);
      } catch (err) {
        logError(err, `AutoRefund: ${order.id}`);
      }
    }

    // 2. Auto-approve previews after 12h of no customer action
    const { data: pendingApprovals, error: approvalFetchError } = await supabase
      .from('orders')
      .select('id, order_number')
      .eq('status', ORDER_STATUS.PREVIEW_READY)
      .lt('preview_uploaded_at', new Date(Date.now() - 12 * 60 * 60 * 1000).toISOString());

    if (!approvalFetchError && pendingApprovals) {
      for (const order of pendingApprovals) {
        try {
          // Auto-approve the latest preview
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
              approved_at: now,
              updated_at: now
            }).eq('id', order.id);

            await logOrderStatusHistory(
              order.id,
              'auto_approve',
              'Design Auto-Approved',
              'The design has been auto-approved after 12 hours of inactivity. Production will begin shortly.',
              { order_number: order.order_number }
            );
            results.push(order.id);
          }
        } catch (err) {
          logError(err, `AutoApprove: ${order.id}`);
        }
      }
    }

    return { count: results.length };
  } catch (error) {
    logError(error, 'EnforceDesignDeadlines');
    return { error: 'Failed to process deadlines' };
  }
}

/** WYSHKIT 2026: Enforce 5-minute Partner Acceptance window. */
export async function enforceAcceptanceTimeouts() {
  try {
    const supabase = await createAdminClient();
    const now = new Date().toISOString();

    const { data: timedOutOrders, error: fetchError } = await supabase
      .from('orders')
      .select('id, order_number, user_id, payment_id, total')
      .eq('status', ORDER_STATUS.PLACED)
      .lt('accept_deadline', now);

    if (fetchError) throw fetchError;
    if (!timedOutOrders || timedOutOrders.length === 0) return { count: 0 };

    const results = [];

    for (const order of timedOutOrders) {
      try {
        // 1. Mark as Cancelled
        await supabase
          .from('orders')
          .update({
            status: ORDER_STATUS.CANCELLED,
            cancellation_reason: 'Partner acceptance timeout (5m)',
            cancelled_by: 'system',
            return_status: 'auto_refunded',
            updated_at: now
          })
          .eq('id', order.id);

        // 2. Trigger Refund if paid
        if (order.payment_id) {
          try {
            const { refundPayment } = await import('@/lib/services/razorpay');
            await refundPayment(order.payment_id);
          } catch (refundErr) {
            logger.error('Auto-refund failed for acceptance timeout', refundErr, { orderId: order.id });
          }
        }

        await logOrderStatusHistory(
          order.id,
          'system_cancel',
          'Order Timed Out',
          'The partner did not accept the order within 5 minutes. A full refund has been initiated.',
          { order_number: order.order_number }
        );

        results.push(order.id);
      } catch (err) {
        logError(err, `AcceptanceTimeout: ${order.id}`);
      }
    }

    return { count: results.length };
  } catch (error) {
    logError(error, 'EnforceAcceptanceTimeouts');
    return { error: 'Failed to process acceptance timeouts' };
  }
}

export async function getMyOrders() {
  try {
    const supabase = await createClient();
    const { data: { user } } = await supabase.auth.getUser();
    if (!user) throw new Error('Not authenticated');

    const { data, error } = await supabase
      .from('v_orders_detailed')
      .select('id, order_number, status, total, created_at, partner_name, partner_image, items, has_personalization, personalization_status')
      .eq('user_id', user.id)
      .order('created_at', { ascending: false });

    if (error) throw error;
    return { data };
  } catch (error) {
    logError(error, 'GetMyOrders');
    const { error: errMsg } = handleActionError(error);
    return { data: null, error: errMsg };
  }
}

/**
 * WYSHKIT 2026: Create Order (Atomic RPC Version)
 * Replaces the direct insert model with a single atomic transaction.
 * Logic:
 * 1. Call 'place_atomic_order' RPC.
 * 2. Database handles pricing, stock, wallet, and history in one 'BEGIN...END' block.
 */
export async function createOrder(payload: PlaceOrderPayload) {
  try {
    const supabase = payload.useAdmin ? await createAdminClient() : await createClient();

    // WYSHKIT 2026: Atomic execution (Single Source of Truth)
    const { data: result, error } = await (supabase as any).rpc('place_secure_order', {
      p_items: payload.items as any,
      p_address_id: payload.addressId,
      p_razorpay_order_id: payload.razorpayOrderId,
      p_payment_id: payload.paymentId,
      p_coupon_code: payload.couponCode,
      p_use_wallet: payload.useWallet || false,
      p_gstin: payload.gstin,
      p_delivery_instructions: payload.deliveryInstructions,
      p_distance_km: payload.distanceKm
    });

    if (error) throw error;
    const rpcResult = result as any;

    if (!rpcResult.success) {
      throw new Error(rpcResult.error || 'Failed to place order');
    }

    revalidatePath('/orders');
    return {
      success: true,
      orderId: rpcResult.orderId,
      orderNumber: rpcResult.orderNumber
    };

  } catch (error) {
    logError(error, `createOrder:${payload.razorpayOrderId}`);
    return handleActionError(error);
  }
}


export async function getOrder(orderId: string) {
  try {
    const supabase = await createClient();
    const { data: order, error } = await supabase
      .from('orders')
      .select('id, payment_status, status')
      .eq('id', orderId)
      .maybeSingle();

    if (error) throw error;
    return { data: order };
  } catch (error) {
    return { data: null, error: 'Failed to fetch order' };
  }
}

export async function getOrderByRazorpayOrderId(razorpayOrderId: string) {
  try {
    const supabase = await createClient();
    const { data: order, error } = await supabase
      .from('orders')
      .select('id, payment_status, status')
      .eq('razorpay_order_id', razorpayOrderId)
      .maybeSingle();

    if (error) throw error;
    return { data: order };
  } catch (error) {
    return { data: null, error: 'Failed to fetch order' };
  }
}
