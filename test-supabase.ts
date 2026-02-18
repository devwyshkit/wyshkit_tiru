
import { createClient } from '@supabase/supabase-js'
import dotenv from 'dotenv'

dotenv.config({ path: '.env.local' })

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL!
const supabaseAnonKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!

const supabase = createClient(supabaseUrl, supabaseAnonKey)

async function test() {
    console.log('Testing v_item_listings...')
    const { data: items, error: itemsError } = await supabase
        .from('v_item_listings')
        .select('*')
        .limit(1)

    if (itemsError) {
        console.error('Error fetching v_item_listings:', itemsError)
    } else {
        console.log('v_item_listings success:', items?.[0]?.name)
    }

    console.log('\nTesting v_active_cart_totals...')
    const { data: cart, error: cartError } = await supabase
        .from('v_active_cart_totals')
        .select('*')
        .limit(1)

    if (cartError) {
        console.error('Error fetching v_active_cart_totals:', cartError)
    } else {
        console.log('v_active_cart_totals success:', cart)
    }
}

test()
