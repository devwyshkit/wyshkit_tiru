import { createClient } from '@supabase/supabase-js';
import * as dotenv from 'dotenv';
dotenv.config({ path: '.env.local' });

const supabase = createClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.SUPABASE_SERVICE_ROLE_KEY!
);

async function testCoupon() {
    console.log('--- Testing Coupon Support in RPC ---');

    // 1. Create a test coupon if it doesn't exist
    const couponCode = 'TEST_COUPON_50';
    await supabase.from('coupons').upsert({
        code: couponCode,
        discount_type: 'percentage',
        discount_value: 50,
        max_discount_amount: 100,
        min_order_value: 100,
        is_active: true
    }, { onConflict: 'code' });

    // 2. Fetch an item
    const { data: items } = await supabase.from('items').select('id, base_price').limit(1);
    if (!items || items.length === 0) return;

    const cartItems = [{
        itemId: items[0].id,
        quantity: 1,
        variantId: null,
        hasPersonalization: false,
        selectedAddons: []
    }];

    // 3. Call RPC with coupon
    const { data, error } = await supabase.rpc('calculate_order_total', {
        p_cart_items: cartItems,
        p_coupon_code: couponCode
    });

    if (error) {
        console.error('RPC Error:', error);
        return;
    }

    console.log('Pricing with Coupon:', JSON.stringify(data, null, 2));

    if (data.discount > 0) {
        console.log(`✅ Coupon applied! Discount: ${data.discount}`);
    } else {
        console.error('❌ Coupon NOT applied!');
    }
}

testCoupon();
