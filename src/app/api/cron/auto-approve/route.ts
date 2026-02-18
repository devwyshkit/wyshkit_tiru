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
        const { enforceDesignDeadlines } = await import('@/lib/services/deadlines');
        const result = await enforceDesignDeadlines();

        return NextResponse.json({
            success: true,
            processed: result.count,
            message: 'Auto-approve cron completed'
        });
    } catch (error) {

        logger.error('Cron: Auto-Approve Error', error);
        return new NextResponse('Internal Server Error', { status: 500 });
    }
}
