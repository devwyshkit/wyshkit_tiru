'use server';

import { createClient } from '@/lib/supabase/server';
import type { Database, Json } from '@/lib/supabase/database.types';
import {
  DBOrder,
  DBAddress,
  DBPartner,
  DBItem,
  OrderItem,
  OrderWithItems,
  OrderWithRelations,
  PreviewSubmission,
  Item,
  Address,
  Tables
} from '@/lib/supabase/types';
import { ShadowfaxService } from '@/lib/services/shadowfax';
import { ORDER_STATUS } from '@/lib/types/order-status';
import { logger } from '@/lib/logging/logger';

export type OrderStatus = Database['public']['Enums']['order_status'];

// WYSHKIT 2026: PartnerOrder Type with strict check
export type PartnerOrder = Omit<DBOrder, 'delivery_address' | 'partner'> & {
  order_items: (OrderItem & {
    item?: Item | null;
    variant?: { stock_quantity: number } | null;
    personalization_entry?: Tables<'order_personalization'> | null;
  })[];
  order_personalization?: Tables<'order_personalization'>[];
  latest_preview?: PreviewSubmission | null;
  delivery_address?: Address | Address[] | null;
  partner?: DBPartner | DBPartner[] | null;
};

export type PartnerStats = {
  todayOrders: number;
  todayRevenue: number;
  pendingOrders: number;
  avgRating: number | null;
  lowStockCount: number;
  totalEarnings: number;
  pendingSettlement: number;
};

function logError(error: unknown, context: string) {
  logger.error(`Partner action error in ${context}`, error, { context });
}

// WYSHKIT 2026: Order State Machine - Valid Transitions
// WYSHKIT 2026: Order State Machine - Valid Transitions (STRICT)
// Enforces "Commitment Before Creativity" and "One-Trip" Principles
const VALID_TRANSITIONS: Record<string, string[]> = {
  PLACED: ['CONFIRMED', 'CANCELLED', 'IN_PRODUCTION'],
  CONFIRMED: ['DETAILS_RECEIVED', 'IN_PRODUCTION', 'PREVIEW_READY', 'CANCELLED'],
  DETAILS_RECEIVED: ['PREVIEW_READY', 'CANCELLED'],
  PREVIEW_READY: ['APPROVED', 'REVISION_REQUESTED', 'CANCELLED'],
  REVISION_REQUESTED: ['PREVIEW_READY', 'CANCELLED'],
  APPROVED: ['IN_PRODUCTION', 'CANCELLED'],
  IN_PRODUCTION: ['PACKED', 'CANCELLED'],
  PACKED: ['DISPATCHED', 'CANCELLED'],
  DISPATCHED: ['OUT_FOR_DELIVERY', 'DELIVERED'],
  OUT_FOR_DELIVERY: ['DELIVERED'],
  DELIVERED: ['REFUNDED'], // Returns flow
  CANCELLED: [],
  REFUNDED: [],
};

function validateStatusTransition(
  from: string,
  to: string,
  hasPersonalization: boolean
): string | null {


  if (from === ORDER_STATUS.PLACED && to === ORDER_STATUS.DETAILS_RECEIVED) {
    // Note: We allow this if triggered by customer, but validateStatusTransition is usually for partner actions.
    // We'll keep it strict for partner actions to ensure they "Accept" first.
    return 'Partner MUST accept order (CONFIRMED) before moving to production design cycle.';
  }

  // Universal Rule: Can't skip "Preparing" (IN_PRODUCTION)
  // This applies to BOTH personalized (from APPROVED) and non-personalized (from CONFIRMED)
  if ((from === ORDER_STATUS.APPROVED || from === ORDER_STATUS.CONFIRMED) && to === ORDER_STATUS.PACKED) {
    return 'Orders must be marked as "Preparing" (IN_PRODUCTION) before they can be marked as Ready (PACKED).';
  }

  const validNextStatuses = VALID_TRANSITIONS[from];
  if (!validNextStatuses || !validNextStatuses.includes(to)) {
    return `Invalid transition from "${from}" to "${to}".`;
  }

  return null;
}

export async function getPartnerOrders(
  partnerId: string,
  status?: string[]
): Promise<{ data?: PartnerOrder[]; error?: string }> {
  try {
    const supabase = await createClient();
    let query = supabase
      .from('orders')
      .select(`
        id, status, total, subtotal, order_number, created_at, has_personalization, personalization_input, payment_id, delivery_fee, platform_fee, gst, discount, partner_id,
        order_items (*),
        order_personalization (*),
        preview_submissions (*),
        delivery_address:addresses(*),
        partner:partners(*)
      `)
      .eq('partner_id', partnerId);

    if (status && status.length > 0) {
      query = query.in('status', status as any);
    }

    const { data, error } = await query.order('created_at', { ascending: false });

    if (error) throw error;

    const mappedData = (data as any[]).map(order => ({
      ...order,
      latest_preview: order.preview_submissions?.[0] || null
    })) as PartnerOrder[];

    return { data: mappedData };
  } catch (error) {
    logError(error, `getPartnerOrders:${partnerId}`);
    return { error: 'Failed to fetch orders' };
  }
}

export async function getPartnerStats(partnerId: string): Promise<{ data?: PartnerStats; error?: string }> {
  try {
    const supabase = await createClient();

    const today = new Date();
    today.setHours(0, 0, 0, 0);

    // 1. Orders and Revenue for today
    const { data: todayOrders, error: ordersError } = await supabase
      .from('orders')
      .select('id, total, status')
      .eq('partner_id', partnerId)
      .gte('created_at', today.toISOString());

    if (ordersError) throw ordersError;
    const orders = todayOrders || [];
    const completedOrders = orders.filter((o) => o.status === 'DELIVERED');

    // 2. Partner Rating
    const { data: partner, error: partnerError } = await supabase
      .from('partners')
      .select('rating')
      .eq('id', partnerId)
      .single();

    if (partnerError) throw partnerError;

    // 3. Pending Orders (Not Delivered/Cancelled)
    const { count: pendingCount, error: pendingError } = await supabase
      .from('orders')
      .select('id', { count: 'exact', head: true })
      .eq('partner_id', partnerId)
      .neq('status', 'DELIVERED')
      .neq('status', 'CANCELLED')
      .neq('status', 'REFUNDED');

    if (pendingError) logError(pendingError, 'getPartnerStats:pendingCount');


    // WYSHKIT 2026: More efficient low stock check
    const { data: partnerItems } = await supabase.from('items').select('id').eq('partner_id', partnerId);
    const partnerItemIds = partnerItems?.map(i => i.id) || [];

    const { count: actualLowStockCount } = await supabase
      .from('variants')
      .select('id', { count: 'exact', head: true })
      .in('item_id', partnerItemIds)
      .lt('stock_quantity', 5);

    // 5. Financials
    const financialsRes = await getPartnerFinancials(partnerId);
    const financials = financialsRes.data || { totalEarnings: 0, pendingSettlement: 0 };

    return {
      data: {
        todayOrders: orders.length,
        todayRevenue: completedOrders.reduce((sum, o) => sum + Number(o.total || 0), 0),
        pendingOrders: pendingCount || 0,
        avgRating: partner?.rating ? Number(partner.rating) : null,
        lowStockCount: actualLowStockCount || 0,
        totalEarnings: financials.totalEarnings,
        pendingSettlement: financials.pendingSettlement
      }
    };
  } catch (error) {
    logError(error, 'getPartnerStats');
    return { error: 'Failed to fetch stats' };
  }
}

export async function updateOrderStatus(
  orderId: string,
  status: OrderStatus | string
): Promise<{ success: boolean; error?: string }> {
  try {
    const supabase = await createClient();

    const { data: rawOrder, error: orderError } = await supabase
      .from('orders')
      .select(`
        *,
        delivery_address:addresses(*),
        partner:partners(*)
      `)
      .eq('id', orderId)
      .single();

    if (orderError || !rawOrder) throw new Error('Order not found');

    const order = (rawOrder as unknown) as PartnerOrder;
    const currentStatus = order.status as OrderStatus;
    const hasPersonalization = order.has_personalization === true;

    const validationError = validateStatusTransition(currentStatus, status, hasPersonalization);
    if (validationError) {
      return { success: false, error: validationError };
    }

    if (status === 'PACKED') {
      try {
        const { dispatchOrder } = await import('@/lib/services/dispatch');
        const dispatchResult = await dispatchOrder({ orderId });
        if (dispatchResult.success) {
          logger.info(`[updateOrderStatus] Auto-dispatch successful for ${orderId}, moving to DISPATCHED.`);
          status = ORDER_STATUS.DISPATCHED; // Automatically move to DISPATCHED
        } else {
          logger.error('Auto-dispatch failed during PACKED transition', undefined, { orderId, error: dispatchResult.error });
        }
      } catch (dispatchError) {
        logger.error('Dispatch trigger failed', dispatchError, { orderId });
      }
    }

    let paymentStatusUpdate: Database['public']['Tables']['orders']['Update'] = {};
    if (status === 'CANCELLED') {
      if (order.payment_status === 'paid' || order.payment_status === 'captured') {
        const paymentId = order.payment_id;
        if (paymentId) {
          try {
            const { refundPayment } = await import('@/lib/services/razorpay');
            await refundPayment(paymentId);
            paymentStatusUpdate = {
              payment_status: 'refunded',
              return_status: 'auto_refunded'
            };
            logger.info('Auto-refund successful', { orderId, paymentId });
          } catch (refundError) {
            logger.error('Auto-refund failed', refundError, { orderId, paymentId });
          }
        }
      }
    }

    // WYSHKIT 2026: Auto-transition to DETAILS_RECEIVED if details were pre-uploaded during PLACED.
    // This maintains "Commitment Before Creativity" (Partner accepted) while honoring "Instant Momentum" (Customer uploaded).
    let targetStatus = status as OrderStatus;
    if (status === ORDER_STATUS.CONFIRMED && order.has_personalization && order.personalization_status === 'submitted') {
      logger.info(`[updateOrderStatus] Auto-transitioning ${orderId} to DETAILS_RECEIVED as personalization already present.`);
      targetStatus = ORDER_STATUS.DETAILS_RECEIVED;
    }

    const statusUpdates: Database['public']['Tables']['orders']['Update'] = {
      status: targetStatus,
      ...paymentStatusUpdate,
      updated_at: new Date().toISOString()
    };

    // WYSHKIT 2026: Set design deadline when partner accepts a personalized order
    if (status === 'CONFIRMED' && hasPersonalization) {
      const deadline = new Date();
      deadline.setHours(deadline.getHours() + 24); // 24-hour window for details
      statusUpdates.design_deadline_at = deadline.toISOString();
    }

    const { error } = await supabase
      .from('orders')
      .update(statusUpdates)
      .eq('id', orderId);

    if (error) throw error;

    await (supabase as any).rpc('log_order_status_history', {
      p_order_id: orderId,
      p_type: 'status_update',
      p_title: `Status: ${status}`,
      p_description: `Order status updated to ${status} by partner.`,
      p_metadata: { source: 'partner', status }
    });

    if (status === 'DELIVERED') {
      try {
        const { creditCashbackOnDelivery } = await import('@/lib/actions/cashback');
        await creditCashbackOnDelivery(orderId, order.user_id, Number(order.total));
        logger.info('Cashback credited successfully on delivery', { orderId });
      } catch (cashbackError) {
        logger.error('Failed to credit cashback on delivery', cashbackError, { orderId });
      }
    }

    return { success: true };
  } catch (error) {
    logError(error, `updateOrderStatus:${orderId}:${status}`);
    return { success: false, error: 'Failed to update order status' };
  }
}

export async function acceptOrder(orderId: string): Promise<{ success: boolean; error?: string }> {
  return updateOrderStatus(orderId, 'CONFIRMED');
}

export async function rejectOrder(
  orderId: string,
  reason: string
): Promise<{ success: boolean; error?: string }> {
  try {
    const supabase = await createClient();

    const { error } = await supabase
      .from('orders')
      .update({
        status: 'CANCELLED',
        cancellation_reason: reason,
        cancelled_by: 'partner',
        updated_at: new Date().toISOString()
      })
      .eq('id', orderId);

    if (error) throw error;

    await (supabase as any).rpc('log_order_status_history', {
      p_order_id: orderId,
      p_type: 'status_update',
      p_title: 'Status: CANCELLED',
      p_description: `Order rejected by partner. Reason: ${reason}`,
      p_metadata: { source: 'partner', status: 'CANCELLED', reason }
    });

    return { success: true };
  } catch (error) {
    logError(error, `rejectOrder:${orderId}`);
    return { success: false, error: 'Failed to reject order' };
  }
}

export type ItemWithCounts = Item & {
  variants_count?: number;
  total_stock?: number;
  personalization_count?: number;
  variants: Tables<'variants'>[];
  personalization_options: Tables<'personalization_options'>[];
};

export async function getPartnerItems(partnerId: string): Promise<{ data?: ItemWithCounts[]; error?: string }> {
  try {
    const supabase = await createClient();

    const { data: items, error } = await supabase
      .from('items')
      .select('*')
      .eq('partner_id', partnerId)
      .order('created_at', { ascending: false });

    if (error) throw error;

    if (!items || items.length === 0) {
      return { data: [] };
    }

    const itemIds = items.map(i => i.id);

    const [variantsRes, personalizationRes] = await Promise.all([
      supabase
        .from('variants')
        .select('item_id, stock_quantity')
        .in('item_id', itemIds),
      supabase
        .from('personalization_options')
        .select('item_id')
        .in('item_id', itemIds),
    ]);

    const variantsData = variantsRes.data || [];
    const personalizationData = personalizationRes.data || [];

    const variantsByItem = new Map<string, { count: number; stock: number }>();
    variantsData.forEach(v => {
      if (!v.item_id) return;
      const existing = variantsByItem.get(v.item_id) || { count: 0, stock: 0 };
      variantsByItem.set(v.item_id, {
        count: existing.count + 1,
        stock: existing.stock + (v.stock_quantity || 0),
      });
    });

    const personalizationByItem = new Map<string, number>();
    personalizationData.forEach(p => {
      personalizationByItem.set(p.item_id, (personalizationByItem.get(p.item_id) || 0) + 1);
    });

    const enrichedItems: ItemWithCounts[] = (items as Item[]).map(item => {
      const itemVariants = variantsData.filter(v => v.item_id === item.id);
      const itemPersonalization = personalizationData.filter(p => p.item_id === item.id);

      return {
        ...item,
        variants_count: itemVariants.length,
        total_stock: itemVariants.reduce((sum, v) => sum + (v.stock_quantity || 0), 0),
        personalization_count: itemPersonalization.length,
        variants: itemVariants as any,
        personalization_options: itemPersonalization as any
      };
    });

    return { data: enrichedItems };
  } catch (error) {
    logError(error, 'getPartnerItems');
    return { error: 'Failed to fetch items' };
  }
}

export async function getPartnerFinancials(partnerId: string): Promise<{
  data?: {
    totalEarnings: number;
    pendingSettlement: number;
    lastPayout: number | null;
    commissionRate: number;
  };
  error?: string
}> {
  try {
    const supabase = await createClient();

    const { data: partner, error: partnerError } = await supabase
      .from('partners')
      .select('commission_percentage')
      .eq('id', partnerId)
      .single();

    if (partnerError) throw partnerError;

    const { data: orders, error: ordersError } = await supabase
      .from('orders')
      .select('total, net_settlement_amount, payout_status, status')
      .eq('partner_id', partnerId)
      .eq('status', 'DELIVERED');

    if (ordersError) throw ordersError;

    const deliveredOrders = orders || [];
    const totalEarnings = deliveredOrders.reduce(
      (sum, o) => sum + Number(o.net_settlement_amount || 0), 0
    );
    const pendingSettlement = deliveredOrders
      .filter(o => o.payout_status !== 'completed')
      .reduce((sum, o) => sum + Number(o.net_settlement_amount || 0), 0);

    return {
      data: {
        totalEarnings,
        pendingSettlement,
        lastPayout: null,
        commissionRate: Number(partner.commission_percentage || 15),
      }
    };
  } catch (error) {
    logError(error, 'getPartnerFinancials');
    return { error: 'Failed to fetch financials' };
  }
}

export async function getPartnerPayouts(partnerId: string): Promise<{
  data?: { id: string; amount: number; status: string; created_at: string }[];
  error?: string;
}> {
  try {
    const supabase = await createClient();

    const { data, error } = await (supabase as any)
      .from('partner_payouts')
      .select('id, amount, status, created_at')
      .eq('partner_id', partnerId)
      .order('created_at', { ascending: false })
      .limit(10);

    if (error) throw error;
    return { data: data as any };
  } catch (error) {
    logError(error, 'getPartnerPayouts');
    return { error: 'Failed to fetch payouts' };
  }
}

export async function getPartnerProfile(partnerId: string): Promise<{ data?: DBPartner; error?: string }> {
  try {
    const supabase = await createClient();

    const { data, error } = await supabase
      .from('partners')
      .select('id, name, business_name, owner_name, email, phone, rating, commission_percentage, is_online, is_active, kyc_status, address, city, pincode, base_delivery_charge, gstin, pan')
      .eq('id', partnerId)
      .single();

    if (error) throw error;
    return { data: (data as unknown) as DBPartner };
  } catch (error) {
    logError(error, 'getPartnerProfile');
    return { error: 'Failed to fetch partner profile' };
  }
}

export async function updatePartnerOnlineStatus(
  partnerId: string,
  isOnline: boolean
): Promise<{ success: boolean; error?: string }> {
  try {
    const supabase = await createClient();

    const { error } = await supabase
      .from('partners')
      .update({ is_online: isOnline })
      .eq('id', partnerId);

    if (error) throw error;
    return { success: true };
  } catch (error) {
    logError(error, 'updatePartnerOnlineStatus');
    return { success: false, error: 'Failed to update status' };
  }
}

export async function getPersonalizationQueue(partnerId: string): Promise<{
  data?: PartnerOrder[];
  error?: string;
}> {
  try {
    const supabase = await createClient();

    const { data: orders, error } = await supabase
      .from('orders')
      .select(`
        id, status, total, subtotal, order_number, created_at, has_personalization, personalization_input, partner_id,
        order_items (*),
        order_personalization (*)
      `)
      .eq('partner_id', partnerId)
      .eq('has_personalization', true)
      .in('status', ['DETAILS_RECEIVED', 'PREVIEW_READY', 'REVISION_REQUESTED'])
      .order('created_at', { ascending: true });

    if (error) throw error;

    if (!orders || orders.length === 0) return { data: [] };

    const orderIds = orders.map(o => o.id);
    const { data: previews } = await supabase
      .from('preview_submissions')
      .select('order_id, preview_url, status, submitted_at, customer_feedback, partner_notes')
      .in('order_id', orderIds)
      .order('submitted_at', { ascending: false });

    const previewByItem = new Map<string, PreviewSubmission>();
    ((previews as unknown as PreviewSubmission[]) || []).forEach(p => {
      if (p.order_item_id && !previewByItem.has(p.order_item_id)) {
        previewByItem.set(p.order_item_id, p);
      }
    });

    const enrichedOrders: PartnerOrder[] = (orders as unknown as PartnerOrder[]).map(order => {
      const orderItems = (order.order_items || []).map(item => ({
        ...item,
        personalization_entry: order.order_personalization?.find(p => p.order_item_id === item.id) || null
      }));

      // For latest_preview at order level, we'll take the most recent one overall
      const latestPreview = ((previews as unknown as PreviewSubmission[]) || [])
        .filter(p => p.order_id === order.id)
        .sort((a, b) => {
          const aTime = a.submitted_at ? new Date(a.submitted_at).getTime() : 0;
          const bTime = b.submitted_at ? new Date(b.submitted_at).getTime() : 0;
          return bTime - aTime;
        })[0] || null;

      return {
        ...order,
        order_items: orderItems,
        latest_preview: latestPreview,
      };
    });

    return { data: enrichedOrders };
  } catch (error) {
    logError(error, 'getPersonalizationQueue');
    return { error: 'Failed to fetch personalization queue' };
  }
}

export async function uploadPreview(
  orderId: string,
  orderItemId: string,
  previewUrl: string,
  partnerNotes?: string
): Promise<{ success: boolean; error?: string }> {
  try {
    const supabase = await createClient();

    const { data: order, error: fetchError } = await supabase
      .from('orders')
      .select('status, has_personalization')
      .eq('id', orderId)
      .single();

    if (fetchError || !order) throw new Error('Order not found');

    const validationError = validateStatusTransition(
      order.status,
      'PREVIEW_READY',
      !!order.has_personalization
    );

    if (validationError) {
      return { success: false, error: validationError };
    }

    // WYSHKIT 2026: If order is still PLACED, auto-transition to CONFIRMED first
    if (order.status === ORDER_STATUS.PLACED) {
      logger.info(`[uploadPreview] Auto-confirming order ${orderId} before preview upload.`);
      const confirmRes = await updateOrderStatus(orderId, 'CONFIRMED');
      if (!confirmRes.success) return confirmRes;
    }

    // WYSHKIT 2026: Combined Update (Stateless/Atomic)
    // We insert the preview linked to the specific item
    const { error: previewError } = await supabase
      .from('preview_submissions')
      .insert({
        order_id: orderId,
        order_item_id: orderItemId, // Relational Mapping
        preview_url: previewUrl,
        partner_notes: partnerNotes || null,
        status: 'pending',
        submitted_at: new Date().toISOString(),
      });

    if (previewError) throw previewError;

    // Update the specific order_item status
    await supabase
      .from('order_items')
      .update({ status: 'preview_ready' })
      .eq('id', orderItemId);

    // Update order level metadata
    const { error: metadataError } = await supabase
      .from('orders')
      .update({
        preview_status: 'uploaded',
        preview_uploaded_at: new Date().toISOString(),
        preview_ready_at: new Date().toISOString(),
        updated_at: new Date().toISOString()
      })
      .eq('id', orderId);

    if (metadataError) throw metadataError;

    return updateOrderStatus(orderId, 'PREVIEW_READY');
  } catch (error) {
    logError(error, 'uploadPreview');
    return { success: false, error: 'Failed to upload preview' };
  }
}

export async function toggleItemActiveStatus(
  itemId: string,
  isActive: boolean
): Promise<{ success: boolean; error?: string }> {
  try {
    const supabase = await createClient();

    const { error } = await supabase
      .from('items')
      .update({ is_active: isActive })
      .eq('id', itemId);

    if (error) throw error;
    return { success: true };
  } catch (error) {
    logError(error, 'toggleItemActiveStatus');
    return { success: false, error: 'Failed to update item status' };
  }
}

export async function toggleItemStockStatus(
  itemId: string,
  stockStatus: string
): Promise<{ success: boolean; error?: string }> {
  try {
    const supabase = await createClient();

    const { error } = await supabase
      .from('items')
      .update({ stock_status: stockStatus })
      .eq('id', itemId);

    if (error) throw error;
    return { success: true };
  } catch (error) {
    logError(error, 'toggleItemStockStatus');
    return { success: false, error: 'Failed to update stock status' };
  }
}

export async function updateVariantStock(
  variantId: string,
  quantity: number
): Promise<{ success: boolean; error?: string }> {
  try {
    const supabase = await createClient();

    // WYSHKIT 2026: Atomic stock update
    const { error } = await supabase
      .from('variants')
      .update({
        stock_quantity: quantity,
        updated_at: new Date().toISOString()
      })
      .eq('id', variantId);

    if (error) throw error;

    return { success: true };
  } catch (error) {
    logError(error, `updateVariantStock:${variantId}`);
    return { success: false, error: 'Failed to update stock' };
  }
}

