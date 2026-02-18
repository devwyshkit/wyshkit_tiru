import { createClient } from '@supabase/supabase-js';
import * as dotenv from 'dotenv';
import * as path from 'path';

// Load env vars
dotenv.config({ path: path.resolve(__dirname, '.env.local') });

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
const supabaseKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;

if (!supabaseUrl || !supabaseKey) {
    console.error('Missing Supabase URL or Key in .env.local');
    process.exit(1);
}

const supabase = createClient(supabaseUrl, supabaseKey);

async function testPricingRPC() {
    console.log('--- Testing calculate_order_total RPC with Real Item ---');

    // Test case: Royal Chocolate Box (ID: d466da04-4bdb-45d4-bace-1318d8584b63)
    const items = [
        {
            itemId: 'd466da04-4bdb-45d4-bace-1318d8584b63',
            quantity: 1,
            hasPersonalization: false,
            personalizationOptionId: null,
            selectedAddons: [
                { id: '00000000-0000-0000-0000-000000000000', price: 100 }
            ]
        }
    ];

    // Explicitly providing all arguments for overload 1
    const { data, error } = await supabase.rpc('calculate_order_total', {
        p_cart_items: items,
        p_delivery_fee_override: 40,
        p_address_id: null,
        p_coupon_code: null,
        p_distance_km: 5, // Should trigger 60 slab
        p_use_wallet: false,
        p_user_id: null
    });

    if (error) {
        console.error('RPC Error:', error);
        return;
    }

    console.log('Pricing Breakdown:', JSON.stringify(data, null, 2));

    const subtotal = Number(data.subtotal);
    const gst = Number(data.gst);
    const deliveryFee = Number(data.deliveryFee);
    const platformFee = Number(data.platformFee);

    const taxableAmount = subtotal + deliveryFee + platformFee;
    const expectedGst = Math.round(taxableAmount * 0.18 * 100) / 100;

    console.log(`Subtotal: ${subtotal}`);
    console.log(`Delivery Fee: ${deliveryFee} (Distance 5km = 60 expected)`);
    console.log(`Calculated GST: ${gst}`);
    console.log(`Expected GST (18% of ${taxableAmount}): ${expectedGst}`);

    if (Math.abs(gst - expectedGst) <= 0.5) {
        console.log('✅ GST Calculation is correct and inclusive of subtotal.');
    } else {
        console.error('❌ GST Calculation mismatch!');
    }

    if (deliveryFee === 60) {
        console.log('✅ Delivery slab logic (5km = 60) confirmed.');
    } else {
        console.warn('⚠️ Delivery fee slab mismatch. Expected 60 for 5km.');
    }
}

testPricingRPC();
