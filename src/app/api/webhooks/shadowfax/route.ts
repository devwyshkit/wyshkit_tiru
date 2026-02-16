import { NextRequest, NextResponse } from 'next/server';
import { createAdminClient } from '@/lib/supabase/server';
import { updateOrderStatus } from '@/lib/actions/partner-actions';
import { logger } from '@/lib/logging/logger';
import { ORDER_STATUS } from '@/lib/types/order-status';

/**
 * SHADOWFAX WEBHOOK HANDLER (F11)
 * Receives delivery status updates from Shadowfax and updates WyshKit order status.
 */
export async function POST(req: NextRequest) {
  try {
    const body = await req.json();
    const headers = req.headers;

    // Basic Security: Verify against API Key if provided in headers
    const apiKey = process.env.SHADOWFAX_API_KEY;
    const authHeader = headers.get('Authorization');

    if (apiKey && authHeader !== `Token ${apiKey}`) {
      logger.warn('Shadowfax Webhook: Unauthorized attempt', { authHeader });
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    logger.info('Shadowfax Webhook received', { body });

    const { client_order_id, status, awb_number } = body;

    if (!client_order_id) {
      return NextResponse.json({ error: 'Missing client_order_id' }, { status: 400 });
    }

    // Map Shadowfax status to WyshKit ORDER_STATUS
    let targetStatus: string | null = null;

    switch (status?.toLowerCase()) {
      case 'picked_up':
      case 'in_transit':
        targetStatus = ORDER_STATUS.OUT_FOR_DELIVERY;
        break;
      case 'delivered':
        targetStatus = ORDER_STATUS.DELIVERED;
        break;
      case 'cancelled':
      case 'returned':
      case 'failed':
        targetStatus = ORDER_STATUS.CANCELLED; // Or a more specific status if available
        break;
      default:
        logger.info('Shadowfax Webhook: Unmapped status ignored', { status, client_order_id });
        return NextResponse.json({ message: 'Status unmapped, no action taken' });
    }

    if (targetStatus) {
      const result = await updateOrderStatus(client_order_id, targetStatus);

      if (!result.success) {
        logger.error('Shadowfax Webhook: Status update failed', result.error, { client_order_id, targetStatus });
        return NextResponse.json({ error: result.error }, { status: 500 });
      }

      logger.info('Shadowfax Webhook: Status updated successfully', { client_order_id, targetStatus, awb_number });
    }

    return NextResponse.json({ success: true });
  } catch (error) {
    logger.error('Shadowfax Webhook: Internal error', error);
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}
