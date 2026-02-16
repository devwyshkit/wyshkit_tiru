'use server';

import { createClient } from '@/lib/supabase/server';
import { revalidatePath } from 'next/cache';
import { logger } from '@/lib/logging/logger';

export type Coupon = {
    id: string;
    code: string;
    description: string | null;
    discount_type: 'percentage' | 'fixed';
    discount_value: number;
    max_discount_amount: number | null;
    min_order_value: number | null;
    is_active: boolean;
};

export async function getAvailableCoupons(): Promise<{ data: Coupon[] | null; error?: string }> {
    try {
        const supabase = await createClient();
        const now = new Date().toISOString();

        const { data, error } = await supabase
            .from('coupons')
            .select('*')
            .eq('is_active', true)
            .lte('start_date', now)
            .gte('end_date', now)
            .order('created_at', { ascending: false });

        if (error) throw error;
        return { data: data as Coupon[] };
    } catch (error) {
        logger.error('Failed to get available coupons', error);
        return { data: null, error: 'Failed to fetch coupons' };
    }
}

export async function validateCoupon(code: string, orderValue: number): Promise<{ data: Coupon | null; error?: string }> {
    try {
        const supabase = await createClient();
        const now = new Date().toISOString();

        const { data: rawCoupon, error } = await supabase
            .from('coupons')
            .select('*')
            .eq('code', code.toUpperCase())
            .eq('is_active', true)
            .lte('start_date', now)
            .gte('end_date', now)
            .single();

        const coupon = rawCoupon as any;

        if (error || !coupon) {
            return { data: null, error: 'Invalid or expired coupon code' };
        }

        if (coupon.min_order_value && orderValue < Number(coupon.min_order_value)) {
            return { data: null, error: `Minimum order value for this coupon is ₹${coupon.min_order_value}` };
        }

        if (coupon.usage_limit && coupon.used_count !== undefined && Number(coupon.used_count) >= Number(coupon.usage_limit)) {
            return { data: null, error: 'Coupon usage limit reached' };
        }

        return { data: coupon as Coupon };
    } catch (error) {
        logger.error('Failed to validate coupon', error, { code });
        return { data: null, error: 'Could not validate coupon' };
    }
}
