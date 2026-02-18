import { createClient } from '@supabase/supabase-js';
import * as dotenv from 'dotenv';
dotenv.config({ path: '.env.local' });

const supabase = createClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.SUPABASE_SERVICE_ROLE_KEY!
);

async function verifyDeliveryFee() {
    console.log('--- Verifying Delivery Fee Logic (No Free Threshold) ---');
    try {
        // 1. Get a real item
        const { data: items, error: itemError } = await supabase.from('items').select('id, base_price').limit(1);
        if (itemError) {
            console.error('Item Fetch Error:', itemError);
            process.exit(1);
        }
        if (!items?.length) {
            console.error('No items found');
            return;
        }
        const item = items[0];
        console.log(`Using item: ${item.id} (Price: ${item.base_price})`);

        // 2. Setup Cart > 500
        const qty = Math.ceil(550 / (item.base_price || 1)) + 1;

        const mockItem = {
            itemId: item.id,
            quantity: qty,
            variantId: null,
            hasPersonalization: false,
            selectedAddons: []
        };

        console.log(`Testing with Quantity: ${qty} (Est Subtotal: ${qty * item.base_price})`);

        // 3. Call RPC with Distance 4.5km (Should be 60)
        // Match the signature in 20260218_unify_pricing_and_sla.sql:
        // calculate_order_total(p_cart_items, p_delivery_fee, p_distance_km, p_coupon_code)

        const { data, error } = await supabase.rpc('calculate_order_total', {
            p_cart_items: [mockItem],
            p_delivery_fee: 40,
            p_distance_km: 4.5,
            p_coupon_code: null
        });

        if (error) {
            console.error('RPC Failed:', error);
        } else {
            console.log('RPC Result:', JSON.stringify(data, null, 2));

            const subtotal = Number(data.subtotal);
            const fee = Number(data.deliveryFee);

            if (subtotal > 500 && fee === 60) {
                console.log('✅ SUCCESS: Delivery fee applied correctly (60) despite high cart value.');
            } else {
                console.log(`❌ FAILURE: Fee is ${fee}. Expected 60.`);
            }
        }
    } catch (err) {
        console.error('Unexpected Error:', err);
    }
}

async function main() {
    await verifyDeliveryFee();
    process.exit(0);
}
main();
