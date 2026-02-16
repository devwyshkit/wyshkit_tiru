import { createAdminClient } from '@/lib/supabase/server';

async function debugItems() {
    const supabase = await createAdminClient();
    const { data, error } = await supabase
        .from('items')
        .select('*')
        .limit(10);

    if (error) {
        console.error('Error fetching items:', error);
        return;
    }

    console.log('Items Data:');
    console.log(JSON.stringify(data, null, 2));
}

debugItems();
