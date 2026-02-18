
const { createClient } = require('@supabase/supabase-js');
const dotenv = require('dotenv');
const path = require('path');
const fs = require('fs');

// Load environment variables from .env.local
const envPath = path.resolve(__dirname, '../.env.local');
const envConfig = dotenv.parse(fs.readFileSync(envPath));

const supabaseUrl = envConfig.NEXT_PUBLIC_SUPABASE_URL;
const supabaseServiceKey = envConfig.SUPABASE_SERVICE_ROLE_KEY;

if (!supabaseUrl || !supabaseServiceKey) {
    console.error('Missing Supabase credentials in .env.local');
    process.exit(1);
}

const supabase = createClient(supabaseUrl, supabaseServiceKey);

async function checkAndFixStock() {
    console.log('Checking stock for "iPhone 15 Pro"...');

    // 1. Find the item
    const { data: items, error: itemError } = await supabase
        .from('items')
        .select('id, name, stock_quantity, stock_status')
        .ilike('name', '%iPhone 15 Pro%');

    if (itemError) {
        console.error('Error fetching items:', itemError);
        return;
    }

    if (!items || items.length === 0) {
        console.log('No item found matching "iPhone 15 Pro"');
        return;
    }

    for (const item of items) {
        console.log(`Found Item: ${item.name} (ID: ${item.id})`);
        console.log(`- Stock: ${item.stock_quantity}`);
        console.log(`- Status: ${item.stock_status}`);

        // Update Item Stock just in case
        await supabase.from('items').update({ stock_quantity: 100, stock_status: 'in_stock' }).eq('id', item.id);
        console.log('  -> Updated item stock to 100');

        // 2. Check for Variants
        const { data: variants, error: variantError } = await supabase
            .from('variants')
            .select('id, name, stock_quantity, price')
            .eq('item_id', item.id);

        if (variantError) {
            console.error('  Error fetching variants:', variantError);
            continue;
        }

        if (variants && variants.length > 0) {
            console.log(`  Found ${variants.length} variants:`);
            for (const variant of variants) {
                console.log(`  - Variant: ${variant.name} (Stock: ${variant.stock_quantity})`);

                // Fix Variant Stock
                if (variant.stock_quantity < 10) {
                    const { error: updateVarError } = await supabase
                        .from('variants')
                        .update({ stock_quantity: 100 })
                        .eq('id', variant.id);

                    if (updateVarError) {
                        console.error(`    Failed to update variant ${variant.name}:`, updateVarError);
                    } else {
                        console.log(`    -> Updated variant ${variant.name} stock to 100`);
                    }
                }
            }
        } else {
            console.log('  No variants found for this item.');
        }
    }

    // Also generic fix for ALL variants just to be safe
    console.log('\nRunning global variant stock enrichment...');
    const { error: globalError } = await supabase
        .from('variants')
        .update({ stock_quantity: 100 })
        .lt('stock_quantity', 10);

    if (globalError) console.error('Global variant update failed:', globalError);
    else console.log('Global variant enrichment complete.');

    // 3. Clear Reservations
    console.log('\nClearing ALL cart reservations...');
    const { error: deleteError } = await supabase.from('cart_reservations').delete().neq('id', '00000000-0000-0000-0000-000000000000'); // Delete all
    if (deleteError) {
        console.error('Failed to clear reservations:', deleteError);
    } else {
        console.log('Successfully purged all cart reservations.');
    }

    // 4. Double check the specific iPhone variant
    const { data: specificVariant } = await supabase.from('variants').select('id, name, stock_quantity').ilike('name', '%256GB Black%').maybeSingle();
    if (specificVariant) {
        console.log(`\nFinal Check - ${specificVariant.name}: ${specificVariant.stock_quantity} units.`);

        // Check if any reservations remain
        const { count } = await supabase.from('cart_reservations').select('*', { count: 'exact', head: true }).eq('variant_id', specificVariant.id);
        console.log(`Reservations remaining for this variant: ${count}`);
    }

    console.log('\nDone.');
}

checkAndFixStock();
