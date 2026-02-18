
const { createClient } = require('@supabase/supabase-js');
require('dotenv').config({ path: '.env.local' });

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
const supabaseKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;
const supabase = createClient(supabaseUrl, supabaseKey);

async function enrichInventory() {
    console.log('Enriching inventory...');

    const { data: items, error: fetchError } = await supabase
        .from('items')
        .select('id, name');

    if (fetchError) {
        console.error('Error fetching items:', fetchError);
        return;
    }

    console.log(`Found ${items.length} items. Updating stock to 100...`);

    for (const item of items) {
        const { error: updateError } = await supabase
            .from('items')
            .update({ stock_quantity: 100, stock_status: 'in_stock' })
            .eq('id', item.id);

        if (updateError) {
            console.error(`Failed to update ${item.name}:`, updateError);
        } else {
            console.log(`Updated ${item.name}`);
        }
    }

    console.log('Inventory enrichment complete!');
}

enrichInventory();
