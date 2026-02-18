import { createClient } from '@supabase/supabase-js';
import * as dotenv from 'dotenv';
dotenv.config({ path: '.env.local' });

const supabase = createClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.SUPABASE_SERVICE_ROLE_KEY!
);

async function testPricing() {
    console.log('--- Testing 2026 Compliant Pricing (HSN-Based GST) ---');

    // 1. Fetch some items with known GST (seeded earlier)
    const { data: items } = await supabase.from('items').select('id, name, base_price, gst_percentage').limit(3);
    if (!items || items.length === 0) {
        console.log('No items found for testing');
        return;
    }

    console.log('Seeded GST Rates:');
    items.forEach(i => console.log(`- ${i.name}: ${i.gst_percentage}%`));

    const cartItems = items.map(i => ({
        itemId: i.id,
        quantity: 1,
        variantId: null,
        hasPersonalization: false,
        selectedAddons: []
    }));

    // 2. Call the RPC
    const { data, error } = await supabase.rpc('calculate_order_total', {
        p_cart_items: cartItems,
        p_distance_km: 4.5 // Slab: 60
    });

    if (error) {
        console.error('RPC Error:', error);
        return;
    }

    console.log('\nPricing Breakdown (RPC Result):');
    console.log(JSON.stringify(data, null, 2));

    // 3. Manual Verification Calculation
    let expectedSubtotal = items.reduce((sum, i) => sum + Number(i.base_price), 0);
    let expectedGst = items.reduce((sum, i) => sum + (Number(i.base_price) * (Number(i.gst_percentage) / 100)), 0);

    // Add platform (10) + delivery (60) GST at 18%
    expectedGst += (10 + 60) * 0.18;

    console.log('\nManual Verification:');
    console.log(`Expected Subtotal: ${expectedSubtotal}`);
    console.log(`Expected GST (approx): ${expectedGst.toFixed(2)}`);
}

testPricing();
