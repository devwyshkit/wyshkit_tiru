
import { createClient } from '@supabase/supabase-js';
import dotenv from 'dotenv';
import path from 'path';

// Load env from root
dotenv.config({ path: path.resolve(process.cwd(), '.env.local') });

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL!;
const supabaseKey = process.env.SUPABASE_SERVICE_ROLE_KEY!;

const supabase = createClient(supabaseUrl, supabaseKey);

async function testPricing() {
    console.log('--- Testing calculate_order_total RPC ---');

    // Mock cart item (use a real item ID from your DB if known, or just a UUID for testing logic)
    // Actually, to test logic correctly it needs to fetch from items table.
    // I will fetch a real item first.
    const { data: item } = await supabase.from('items').select('id, base_price').limit(1).single();
    if (!item) {
        console.error('No items found in DB to test with.');
        return;
    }

    console.log(`Using item: ${item.id} (Price: ${item.base_price})`);

    const cartItems = [
        {
            itemId: item.id,
            quantity: 1,
            hasPersonalization: true
        }
    ];

    // Test Distance 2km (should be ₹40)
    const { data: res1 } = await supabase.rpc('calculate_order_total', {
        p_cart_items: cartItems,
        p_distance_km: 2
    });
    console.log('Distance 2km Result:', res1);

    // Test Distance 4km (should be ₹50)
    const { data: res2 } = await supabase.rpc('calculate_order_total', {
        p_cart_items: cartItems,
        p_distance_km: 4
    });
    console.log('Distance 4km Result:', res2);

    // Test Distance 6km (should be ₹60)
    const { data: res3 } = await supabase.rpc('calculate_order_total', {
        p_cart_items: cartItems,
        p_distance_km: 6
    });
    console.log('Distance 6km Result:', res3);

    console.log('--- Done ---');
}

testPricing();
