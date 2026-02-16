
import { createClient } from '@supabase/supabase-js';
import dotenv from 'dotenv';
import path from 'path';

dotenv.config({ path: path.resolve(process.cwd(), '.env.local') });

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
const supabaseServiceKey = process.env.SUPABASE_SERVICE_ROLE_KEY || process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;

if (!supabaseUrl || !supabaseServiceKey) {
    console.error('Missing Supabase credentials');
    process.exit(1);
}

const supabase = createClient(supabaseUrl, supabaseServiceKey);

const VARIANTS_DATA = [
    // Classic Almond Croissant
    {
        itemName: 'Classic Almond Croissant',
        variants: [
            { name: 'Plain', price: 0, attributes: { size: 'Regular' } },
            { name: 'With Egg', price: 0, attributes: { size: 'Regular', type: 'Egg' } },
            { name: 'Chocolate Drizzle', price: 50, attributes: { size: 'Regular', flavor: 'Chocolate' } },
            { name: 'Heat it up', price: 10, attributes: { serving: 'Warm' } }
        ]
    },
    // Chocolate Truffle Cake
    {
        itemName: 'Chocolate Truffle Cake',
        variants: [
            { name: '500g', price: 0, attributes: { weight: '500g' } },
            { name: '1kg', price: 800, attributes: { weight: '1kg' } } // Assuming base price is corresponding to 500g, or just delta
        ]
    },
    // Red Velvet Cupcakes
    {
        itemName: 'Red Velvet Cupcakes',
        variants: [
            { name: 'Box of 2', price: 0, attributes: { quantity: '2' } },
            { name: 'Box of 6', price: 300, attributes: { quantity: '6' } }
        ]
    }
];

async function enrichData() {
    console.log('Enriching data with variants...');

    for (const itemData of VARIANTS_DATA) {
        // Find item ID
        const { data: items } = await supabase
            .from('items')
            .select('id, name')
            .ilike('name', `%${itemData.itemName}%`)
            .limit(1);

        if (!items || items.length === 0) {
            console.log(`Item not found: ${itemData.itemName}`);
            continue;
        }

        const item = items[0];
        console.log(`Found item: ${item.name} (${item.id})`);

        // Insert variants
        for (const variant of itemData.variants) {
            // Check if exists
            const { data: existing } = await supabase
                .from('variants')
                .select('id')
                .eq('item_id', item.id)
                .eq('name', variant.name)
                .maybeSingle();

            if (existing) {
                console.log(`  Variant exists: ${variant.name}`);
            } else {
                const { error } = await supabase.from('variants').insert({
                    item_id: item.id,
                    name: variant.name,
                    price: variant.price,
                    attributes: variant.attributes,
                    is_active: true
                });
                if (error) console.error(`  Error adding variant ${variant.name}:`, error.message);
                else console.log(`  Added variant: ${variant.name}`);
            }
        }
    }
    console.log('Done.');
}

enrichData();
