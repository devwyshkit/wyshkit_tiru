
import { createClient } from '@supabase/supabase-js';
import dotenv from 'dotenv';
import path from 'path';

// Load environment variables
dotenv.config({ path: path.resolve(__dirname, '../.env.local') });

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
const supabaseKey = process.env.SUPABASE_SERVICE_ROLE_KEY; // Use Service Role for admin access

if (!supabaseUrl || !supabaseKey) {
    console.error('Missing Supabase credentials. Ensure NEXT_PUBLIC_SUPABASE_URL and SUPABASE_SERVICE_ROLE_KEY are in .env.local');
    process.exit(1);
}

const supabase = createClient(supabaseUrl, supabaseKey);

async function seedPreviewReady() {
    console.log('🔍 Finding recent order...');

    // 1. Get the most recent order
    const { data: orders, error: orderError } = await supabase
        .from('orders')
        .select('id, user_id, order_number')
        .order('created_at', { ascending: false })
        .limit(1);

    if (orderError || !orders || orders.length === 0) {
        console.error('❌ Failed to find recent order:', orderError);
        return;
    }

    const order = orders[0];
    console.log(`✅ Found Order: ${order.order_number} (${order.id})`);

    // 2. Get items for this order
    const { data: items, error: itemsError } = await supabase
        .from('order_items')
        .select('id, item_name, is_personalized')
        .eq('order_id', order.id);

    if (itemsError || !items || items.length === 0) {
        console.error('❌ Failed to find items:', itemsError);
        return;
    }

    // 3. Pick a target item (prefer personalized)
    const targetItem = items.find(i => i.is_personalized) || items[0];
    console.log(`🎯 Targeting Item: ${targetItem.item_name} (${targetItem.id})`);

    // 4. Update status to 'preview_ready'
    const { error: updateError } = await supabase
        .from('order_items')
        .update({ status: 'preview_ready' })
        .eq('id', targetItem.id);

    if (updateError) {
        console.error('❌ Failed to update item status:', updateError);
        return;
    }
    console.log('✅ Updated item status to PREVIEW_READY');

    // 5. Insert a dummy preview if not exists
    const { data: existingPreview } = await supabase
        .from('preview_submissions')
        .select('id')
        .eq('order_item_id', targetItem.id)
        .maybeSingle();

    if (!existingPreview) {
        const { error: insertError } = await supabase
            .from('preview_submissions')
            .insert({
                order_id: order.id,
                order_item_id: targetItem.id,
                preview_url: 'https://images.unsplash.com/photo-1513519245088-0e12902e35a6?auto=format&fit=crop&q=80&w=800', // Dummy image
                status: 'pending',
                partner_notes: 'Here is your preview! Let us know if you need changes.',
                submitted_at: new Date().toISOString()
            });

        if (insertError) {
            console.error('❌ Failed to insert preview:', insertError);
            return;
        }
        console.log('✅ Inserted dummy preview submission');
    } else {
        console.log('ℹ️ Preview submission already exists');
    }

    console.log('\n🎉 VALIDATION READY');
    console.log(`👉 Go to: http://localhost:3000/orders/${order.id}`);
    console.log('   You should see the "Preview Ready" badge and the approval interface.');
}

seedPreviewReady();
