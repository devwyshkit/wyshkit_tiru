import { createClient } from '@supabase/supabase-js'
import * as dotenv from 'dotenv'
import { randomUUID } from 'crypto'

dotenv.config({ path: '.env.local' })

// WYSHKIT 2026: Never run seed in production — dummy data must stay dev-only
if (process.env.NODE_ENV === 'production') {
    console.error('Seed script cannot run in production. Use development environment.')
    process.exit(1)
}

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL
const supabaseKey = process.env.SUPABASE_SERVICE_ROLE_KEY || process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY

if (!supabaseUrl || !supabaseKey) {
    console.error('Missing Supabase credentials in .env.local')
    process.exit(1)
}

const supabase = createClient(supabaseUrl, supabaseKey)

async function seed() {
    console.log('🚀 Starting Rich Data Injection (Swiggy 2026 Style)...')

    // 1. Categories
    const categories = [
        { id: randomUUID(), name: 'Cakes & Patisserie', slug: 'cakes-patisserie', is_active: true, display_order: 1 },
        { id: randomUUID(), name: 'Premium Chocolates', slug: 'chocolates', is_active: true, display_order: 2 },
        { id: randomUUID(), name: 'Gourmet Hampers', slug: 'hampers', is_active: true, display_order: 3 },
        { id: randomUUID(), name: 'Luxury Flowers', slug: 'flowers', is_active: true, display_order: 4 }
    ]

    console.log('Injecting categories...')
    await supabase.from('categories').upsert(categories)

    // 2. Partners
    const partners = [
        {
            id: 'd1111111-1111-1111-1111-111111111111',
            name: 'Smoor',
            display_name: 'Smoor Chocolates',
            description: 'Exquisite couverture chocolates and signature cakes for gifting. Curated for the fine palate.',
            city: 'Bangalore',
            rating: 4.8,
            is_active: true,
            is_online: true,
            image_url: 'https://images.unsplash.com/photo-1511381939415-e44015466834?auto=format&fit=crop&q=80&w=1200',
            base_delivery_charge: 0,
            status: 'active'
        },
        {
            id: 'd2222222-2222-2222-2222-222222222222',
            name: 'The Oberoi',
            display_name: 'The Oberoi Bakery',
            description: 'Luxury patisserie by the legendary Oberoi chefs. Freshly baked perfection delivered to your door.',
            city: 'Bangalore',
            rating: 4.9,
            is_active: true,
            is_online: true,
            image_url: 'https://images.unsplash.com/photo-1555507036-ab1f4038808a?auto=format&fit=crop&q=80&w=1200',
            base_delivery_charge: 60,
            status: 'active'
        }
    ]

    console.log('Injecting partners...')
    await supabase.from('partners').upsert(partners)

    // 3. Items
    const items = [
        {
            id: randomUUID(),
            partner_id: 'd1111111-1111-1111-1111-111111111111',
            name: 'Signature 8-Piece Box',
            description: 'Assorted handcrafted chocolates in a luxury midnight-blue gift box.',
            price: 1200,
            base_price: 1200,
            is_active: true,
            stock_status: 'in_stock',
            category: 'Premium Chocolates',
            has_personalization: false,
            images: ['https://images.unsplash.com/photo-1549007994-cb92ca714503?auto=format&fit=crop&q=80&w=800']
        },
        {
            id: randomUUID(),
            partner_id: 'd1111111-1111-1111-1111-111111111111',
            name: 'Belgian Chocolate Cake',
            description: 'Dense chocolate sponge layers with 64% Belgian ganache coating.',
            price: 1800,
            base_price: 1800,
            is_active: true,
            stock_status: 'in_stock',
            category: 'Cakes & Patisserie',
            has_personalization: true,
            images: ['https://images.unsplash.com/photo-1578985545062-69928b1d9587?auto=format&fit=crop&q=80&w=800'],
            personalization_options: [
                { id: 'cake-msg', name: 'Message on Cake', type: 'text', price: 0, maxLength: 30 }
            ]
        },
        {
            id: randomUUID(),
            partner_id: 'd2222222-2222-2222-2222-222222222222',
            name: 'Royal Fruit Tart',
            description: 'A harvest of seasonal organic fruits on a Madagascar vanilla crème pâtissière.',
            price: 950,
            base_price: 950,
            is_active: true,
            stock_status: 'in_stock',
            category: 'Cakes & Patisserie',
            has_personalization: false,
            images: ['https://images.unsplash.com/photo-1519915028121-7d3463d20b13?auto=format&fit=crop&q=80&w=800']
        }
    ]

    console.log('Injecting items...')
    await supabase.from('items').upsert(items)

    console.log('✅ Rich Data Seeded Successfully!')
    console.log('You can now test the flow with partner "Smoor" or "The Oberoi".')
}

seed().catch(console.error)
