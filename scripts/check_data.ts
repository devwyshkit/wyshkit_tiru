
import { createClient } from '@supabase/supabase-js';
import dotenv from 'dotenv';
import path from 'path';

// Load environment variables from .env.local
dotenv.config({ path: path.resolve(process.cwd(), '.env.local') });

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
const supabaseKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;
// Using service role key if available for RLS bypass, otherwise anon
const supabaseServiceKey = process.env.SUPABASE_SERVICE_ROLE_KEY || process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;

if (!supabaseUrl || !supabaseServiceKey) {
    console.error('Missing Supabase credentials');
    process.exit(1);
}

const supabase = createClient(supabaseUrl, supabaseServiceKey);

async function checkData() {
    console.log('Checking items data...');

    // 1. Check Items and Partner IDs
    const { data: items, error: itemsError } = await supabase
        .from('items')
        .select('id, name, partner_id, partners(id, name), has_personalization')
        .limit(10);

    if (itemsError) {
        console.error('Error fetching items:', itemsError);
        return;
    }

    console.log(`Found ${items.length} items.`);
    items.forEach(item => {
        console.log(`- Item: ${item.name} (${item.id})`);
        console.log(`  Partner ID: ${item.partner_id}`);
        console.log(`  Partner Relation: ${JSON.stringify(item.partners)}`);
        console.log(`  Has Personalization: ${item.has_personalization}`);
    });

    // 2. Check Variants
    if (items.length > 0) {
        const itemIds = items.map(i => i.id);
        const { data: variants, error: variantsError } = await supabase
            .from('item_variations')
            .select('id, item_id, name, price')
            .in('item_id', itemIds);

        if (variantsError) {
            console.error('Error fetching variants:', variantsError);
        } else {
            console.log(`Found ${variants.length} variants for these items.`);
            variants.forEach(v => {
                console.log(`  - Variant: ${v.name} for Item ${v.item_id}`);
            });
        }

        // 3. Check Addons
        const { data: addons, error: addonsError } = await supabase
            .from('item_addons')
            .select('id, item_id, name, price')
            .in('item_id', itemIds);

        if (addonsError) {
            console.error('Error fetching addons:', addonsError);
        } else {
            console.log(`Found ${addons.length} addons for these items.`);
            addons.forEach(a => {
                console.log(` - Addon: ${a.name} for Item ${a.item_id}`);
            })
        }
    }
}

checkData().catch(console.error);
