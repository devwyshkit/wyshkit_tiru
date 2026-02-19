
import { createClient } from '@supabase/supabase-js';
import dotenv from 'dotenv';
import { resolve } from 'path';

// Load env vars
dotenv.config({ path: resolve(process.cwd(), '.env.local') });

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
const supabaseServiceKey = process.env.SUPABASE_SERVICE_ROLE_KEY;

if (!supabaseUrl || !supabaseServiceKey) {
    console.error('Missing Supabase credentials');
    process.exit(1);
}

const supabase = createClient(supabaseUrl, supabaseServiceKey);

async function seedOrder() {
    // 1. Get User
    const { data: { users }, error: userError } = await supabase.auth.admin.listUsers();
    if (userError || !users || users.length === 0) {
        return;
    }
    const userId = users[0].id;

    // 2. Get Partner
    const { data: partners, error: partnerError } = await supabase
        .from('partners')
        .select('id')
        .limit(1);

    if (partnerError || !partners || partners.length === 0) {
        return;
    }
    const partnerId = partners[0].id;

    // 3. Insert Order
    const { data, error } = await supabase
        .from('orders')
        .insert({
            user_id: userId,
            partner_id: partnerId,
            status: 'PLACED',
            payment_status: 'PAID',
            total: 999,
            subtotal: 999, // Should match Total for simple test
            delivery_fee: 0,
            platform_fee: 0,
            gst: 0,
            items: [
                {
                    id: 'test-item-1',
                    name: 'Personalized Test Item (Seeded)',
                    price: 999,
                    quantity: 1,
                    personalization: {
                        enabled: true,
                        type: 'text',
                        prompt: 'Enter your name for the mug'
                    }
                }
            ],
            has_personalization: true,
            personalization_input: null,
            payment_id: 'pay_seed_' + Date.now(),
            order_number: 'ORD-' + Math.floor(Math.random() * 100000)
        })
        .select()
        .single();
}

seedOrder();
