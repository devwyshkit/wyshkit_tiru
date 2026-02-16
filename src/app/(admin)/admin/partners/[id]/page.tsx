import { createClient } from '@/lib/supabase/server'
import { notFound } from 'next/navigation'
import { PartnerDetailView } from './partner-detail'
import type { Partner } from '@/lib/types/admin.types'

async function getPartner(id: string): Promise<Partner | null> {
  const supabase = await createClient()
  const { data } = await supabase
    .from('partners')
    .select('*')
    .eq('id', id)
    .single()
  return data
}

async function getPartnerStats(partnerId: string) {
  const supabase = await createClient()
  const [ordersResult, itemsResult] = await Promise.all([
    supabase.from('orders').select('total').eq('partner_id', partnerId),
    supabase.from('items').select('id', { count: 'exact' }).eq('partner_id', partnerId),
  ])

  // Explicit type cast to fix 'never' inference
  const orders = (ordersResult.data || []) as Array<{ total: number }>;

  return {
    orders: orders.length,
    gmv: orders.reduce((sum, o) => sum + (o.total || 0), 0),
    items: itemsResult.count || 0,
  }
}

export default async function PartnerDetailPage({
  params,
}: {
  params: Promise<{ id: string }>
}) {
  const { id } = await params
  const [partner, stats] = await Promise.all([getPartner(id), getPartnerStats(id)])

  if (!partner) notFound()

  return <PartnerDetailView partner={partner} stats={stats} />
}
