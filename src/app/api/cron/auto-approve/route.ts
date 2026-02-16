import { NextRequest, NextResponse } from 'next/server';
import { createAdminClient } from '@/lib/supabase/server';
import { logger } from '@/lib/logging/logger';

export const dynamic = 'force-dynamic';

/**
 * WYSHKIT 2026: Auto-Approve Cron
 * 
 * Rules:
 * - If order is PREVIEW_READY for > 24 hours, Auto-Approve.
 * - "Silence is Consent".
 * 
 * Schedule: Every hour.
 */
export async function GET(req: NextRequest) {
    // 1. Security Check
    const authHeader = req.headers.get('authorization');
    if (authHeader !== `Bearer ${process.env.CRON_SECRET}`) {
        return new NextResponse('Unauthorized', { status: 401 });
    }

    try {
        const supabase = await createAdminClient();
        const now = new Date();
        const twentyFourHoursAgo = new Date(now.getTime() - 24 * 60 * 60 * 1000);

        // 2. Fetch Stale Previews
        const { data: staleOrders, error } = await supabase
            .from('orders')
            .select('id, order_number')
            .eq('status', 'PREVIEW_READY')
            .lt('preview_ready_at', twentyFourHoursAgo.toISOString()) // Ensure this column exists and is populated
            // If preview_ready_at is null, fall back to updated_at? No, strict check.
            .limit(50);

        if (error) {
            logger.error('Cron: Failed to fetch stale previews', error);
            return new NextResponse('Database Error', { status: 500 });
        }

        if (!staleOrders || staleOrders.length === 0) {
            return NextResponse.json({ processed: 0, message: 'No stale previews found' });
        }

        const results = [];

        // 3. Process Each Order
        for (const order of staleOrders) {
            try {
                logger.info(`Cron: Auto-approving order ${order.order_number}`);

                // Use partner-actions generic update logic to handle transitions/history
                // But partner-actions functions are server actions, they might check auth?
                // `updateOrderStatus` in `partner-actions.ts` calls `createClient()` which checks cookies.
                // This is a CRON job. It has no user cookies.
                // So `updateOrderStatus` will FAIL or use anonymous client.
                // I CANNOT use `updateOrderStatus` directly if it relies on `createClient()`.

                // Checking partner-actions.ts content from step 470:
                // Line 204: const supabase = await createClient();
                // Line 25: const { cookies } = await import('next/headers'); ...
                // If called from Cron, cookies() might be empty. `createClient` uses anon key.
                // But RLS might block update if not partner/admin.
                // `orders` table usually has RLS.
                // So `updateOrderStatus` will fail.

                // I must implement the update logic HERE using `admin` client.

                const { error: updateError } = await supabase
                    .from('orders')
                    .update({
                        status: 'APPROVED',
                        updated_at: new Date().toISOString()
                    })
                    .eq('id', order.id);

                if (updateError) throw updateError;

                // Add History
                await supabase.from('order_status_history').insert({
                    order_id: order.id,
                    type: 'info',
                    title: 'Auto-Approved',
                    description: 'Preview auto-approved due to 24 hours of inactivity (Silence is Consent).'
                });

                results.push({ id: order.id, status: 'APPROVED' });

            } catch (err) {
                logger.error(`Cron: Failed to auto-approve ${order.id}`, err);
                results.push({ id: order.id, error: err instanceof Error ? err.message : 'Unknown' });
            }
        }

        return NextResponse.json({ success: true, results });

    } catch (error) {
        logger.error('Cron: Auto-Approve Error', error);
        return new NextResponse('Internal Server Error', { status: 500 });
    }
}
