
const { createClient } = require('@supabase/supabase-js');
const dotenv = require('dotenv');
const path = require('path');

// Load env from root
dotenv.config({ path: path.resolve(process.cwd(), '.env.local') });

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
const supabaseKey = process.env.SUPABASE_SERVICE_ROLE_KEY;

if (!supabaseUrl || !supabaseKey) {
    console.error('Missing Supabase credentials');
    process.exit(1);
}

const supabase = createClient(supabaseUrl, supabaseKey);

async function testPricing() {
    console.log('--- Testing calculate_order_total RPC ---');

    const item = { id: '6e7fb75f-d1eb-4cec-8773-68c8a00193ae', base_price: 280 };

    console.log(`Using item: ${item.id} (Price: ${item.base_price})`);

    const cartItems = [
        {
            itemId: item.id,
            quantity: 1,
            hasPersonalization: true
        }
    ];

    // Test Distance 2km (should be ₹40)
    const { data: res1, error: err1 } = await supabase.rpc('calculate_order_total', {
        p_cart_items: cartItems,
        p_distance_km: 2
    });
    if (err1) console.error('Error 1:', err1);
    else console.log('Distance 2km Result:', res1);

    // Test Distance 4km (should be ₹50)
    const { data: res2, error: err2 } = await supabase.rpc('calculate_order_total', {
        p_cart_items: cartItems,
        p_distance_km: 4
    });
    if (err2) console.error('Error 2:', err2);
    else console.log('Distance 4km Result:', res2);

    // Test Distance 6km (should be ₹60)
    const { data: res3, error: err3 } = await supabase.rpc('calculate_order_total', {
        p_cart_items: cartItems,
        p_distance_km: 6
    });
    if (err3) console.error('Error 3:', err3);
    else console.log('Distance 6km Result:', res3);

    console.log('--- Done ---');
}

testPricing();
