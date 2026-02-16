import { createClient } from '@/lib/supabase/server'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { TrendingUp, TrendingDown, Minus } from 'lucide-react'

async function getInsights() {
  const supabase = await createClient()
  const today = new Date()
  const yesterday = new Date(today)
  yesterday.setDate(yesterday.getDate() - 1)
  const lastWeek = new Date(today)
  lastWeek.setDate(lastWeek.getDate() - 7)
  const lastMonth = new Date(today)
  lastMonth.setMonth(lastMonth.getMonth() - 1)

  const todayStr = today.toISOString().split('T')[0]
  const yesterdayStr = yesterday.toISOString().split('T')[0]
  const lastWeekStr = lastWeek.toISOString().split('T')[0]
  const lastMonthStr = lastMonth.toISOString().split('T')[0]

  const [
    todayOrders,
    yesterdayOrders,
    weekOrders,
    monthOrders,
    topPartners,
    topItems,
    ordersByStatus,
  ] = await Promise.all([
    // Today's orders
    supabase.from('orders').select('total').gte('created_at', `${todayStr}T00:00:00`),
    // Yesterday's orders
    supabase.from('orders').select('total')
      .gte('created_at', `${yesterdayStr}T00:00:00`)
      .lt('created_at', `${todayStr}T00:00:00`),
    // Week orders
    supabase.from('orders').select('total').gte('created_at', `${lastWeekStr}T00:00:00`),
    // Month orders
    supabase.from('orders').select('total').gte('created_at', `${lastMonthStr}T00:00:00`),
    // Top partners by orders
    supabase.from('orders').select('partner_id, partners(business_name)').limit(1000),
    // Top items
    supabase.from('order_items').select('item_id, items(name), quantity').limit(1000),
    // Orders by status
    supabase.from('orders').select('status'),
  ])

  const todayGMV = ((todayOrders.data || []) as { total?: number }[]).reduce((sum, o) => sum + (o.total ?? 0), 0)
  const yesterdayGMV = ((yesterdayOrders.data || []) as { total?: number }[]).reduce((sum, o) => sum + (o.total ?? 0), 0)
  const weekGMV = ((weekOrders.data || []) as { total?: number }[]).reduce((sum, o) => sum + (o.total ?? 0), 0)
  const monthGMV = ((monthOrders.data || []) as { total?: number }[]).reduce((sum, o) => sum + (o.total ?? 0), 0)

  // Calculate partner leaderboard
  const partnerCounts: Record<string, { name: string; count: number }> = {}
  for (const order of (topPartners.data || []) as { partner_id?: string; partners?: { business_name?: string } }[]) {
    const id = order.partner_id ?? ''
    const name = order.partners?.business_name || 'Unknown'
    if (!partnerCounts[id]) partnerCounts[id] = { name, count: 0 }
    partnerCounts[id].count++
  }
  const topPartnersList = Object.values(partnerCounts)
    .sort((a, b) => b.count - a.count)
    .slice(0, 5)

  // Calculate item leaderboard
  const itemCounts: Record<string, { name: string; count: number }> = {}
  for (const item of (topItems.data || []) as { item_id?: string; quantity?: number; items?: { name?: string } }[]) {
    const id = item.item_id ?? ''
    const name = item.items?.name || 'Unknown'
    if (!itemCounts[id]) itemCounts[id] = { name, count: 0 }
    itemCounts[id].count += item.quantity ?? 0
  }
  const topItemsList = Object.values(itemCounts)
    .sort((a, b) => b.count - a.count)
    .slice(0, 5)

  // Order status distribution
  const statusCounts: Record<string, number> = {}
  for (const order of (ordersByStatus.data || []) as { status?: string }[]) {
    const s = order.status ?? ''
    statusCounts[s] = (statusCounts[s] || 0) + 1
  }

  return {
    today: { gmv: todayGMV, orders: (todayOrders.data || []).length },
    yesterday: { gmv: yesterdayGMV, orders: (yesterdayOrders.data || []).length },
    week: { gmv: weekGMV, orders: (weekOrders.data || []).length },
    month: { gmv: monthGMV, orders: (monthOrders.data || []).length },
    topPartners: topPartnersList,
    topItems: topItemsList,
    statusDistribution: statusCounts,
  }
}

function formatCurrency(amount: number) {
  return new Intl.NumberFormat('en-IN', {
    style: 'currency',
    currency: 'INR',
    maximumFractionDigits: 0,
  }).format(amount)
}

function getTrend(today: number, yesterday: number) {
  if (yesterday === 0) return { icon: Minus, color: 'text-zinc-400', text: '-' }
  const change = ((today - yesterday) / yesterday) * 100
  if (change > 0) return { icon: TrendingUp, color: 'text-emerald-600', text: `+${change.toFixed(0)}%` }
  if (change < 0) return { icon: TrendingDown, color: 'text-red-600', text: `${change.toFixed(0)}%` }
  return { icon: Minus, color: 'text-zinc-400', text: '0%' }
}

export default async function InsightsPage() {
  const insights = await getInsights()
  const gmvTrend = getTrend(insights.today.gmv, insights.yesterday.gmv)
  const ordersTrend = getTrend(insights.today.orders, insights.yesterday.orders)

  return (
    <div className="space-y-6">
      <h1 className="text-lg font-semibold text-zinc-900">Insights</h1>

      {/* Key Metrics */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-sm font-medium text-zinc-500">GMV today</CardTitle>
          </CardHeader>
          <CardContent>
            <p className="text-2xl font-semibold">{formatCurrency(insights.today.gmv)}</p>
            <div className={`flex items-center gap-1 text-xs ${gmvTrend.color}`}>
              <gmvTrend.icon className="size-3" />
              {gmvTrend.text} vs yesterday
            </div>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-sm font-medium text-zinc-500">Orders today</CardTitle>
          </CardHeader>
          <CardContent>
            <p className="text-2xl font-semibold">{insights.today.orders}</p>
            <div className={`flex items-center gap-1 text-xs ${ordersTrend.color}`}>
              <ordersTrend.icon className="size-3" />
              {ordersTrend.text} vs yesterday
            </div>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-sm font-medium text-zinc-500">GMV this week</CardTitle>
          </CardHeader>
          <CardContent>
            <p className="text-2xl font-semibold">{formatCurrency(insights.week.gmv)}</p>
            <p className="text-xs text-zinc-500">{insights.week.orders} orders</p>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-sm font-medium text-zinc-500">GMV this month</CardTitle>
          </CardHeader>
          <CardContent>
            <p className="text-2xl font-semibold">{formatCurrency(insights.month.gmv)}</p>
            <p className="text-xs text-zinc-500">{insights.month.orders} orders</p>
          </CardContent>
        </Card>
      </div>

      <div className="grid lg:grid-cols-3 gap-6">
        {/* Top Partners */}
        <Card>
          <CardHeader>
            <CardTitle className="text-sm font-medium">Top partners</CardTitle>
          </CardHeader>
          <CardContent className="p-0">
            {insights.topPartners.length === 0 ? (
              <p className="p-4 text-sm text-zinc-500">No data yet</p>
            ) : (
              <div className="divide-y">
                {insights.topPartners.map((partner, i) => (
                  <div key={i} className="flex items-center justify-between px-4 py-3">
                    <div className="flex items-center gap-3">
                      <span className="text-xs text-zinc-400 w-4">{i + 1}</span>
                      <span className="text-sm font-medium">{partner.name}</span>
                    </div>
                    <span className="text-sm text-zinc-500">{partner.count} orders</span>
                  </div>
                ))}
              </div>
            )}
          </CardContent>
        </Card>

        {/* Top Items */}
        <Card>
          <CardHeader>
            <CardTitle className="text-sm font-medium">Top items</CardTitle>
          </CardHeader>
          <CardContent className="p-0">
            {insights.topItems.length === 0 ? (
              <p className="p-4 text-sm text-zinc-500">No data yet</p>
            ) : (
              <div className="divide-y">
                {insights.topItems.map((item, i) => (
                  <div key={i} className="flex items-center justify-between px-4 py-3">
                    <div className="flex items-center gap-3">
                      <span className="text-xs text-zinc-400 w-4">{i + 1}</span>
                      <span className="text-sm font-medium truncate max-w-[150px]">{item.name}</span>
                    </div>
                    <span className="text-sm text-zinc-500">{item.count} sold</span>
                  </div>
                ))}
              </div>
            )}
          </CardContent>
        </Card>

        {/* Order Status Distribution */}
        <Card>
          <CardHeader>
            <CardTitle className="text-sm font-medium">Order status</CardTitle>
          </CardHeader>
          <CardContent className="p-0">
            {Object.keys(insights.statusDistribution).length === 0 ? (
              <p className="p-4 text-sm text-zinc-500">No data yet</p>
            ) : (
              <div className="divide-y">
                {Object.entries(insights.statusDistribution).map(([status, count]) => (
                  <div key={status} className="flex items-center justify-between px-4 py-3">
                    <span className="text-sm capitalize">{status.toLowerCase().replace(/_/g, ' ')}</span>
                    <span className="text-sm font-medium">{count}</span>
                  </div>
                ))}
              </div>
            )}
          </CardContent>
        </Card>
      </div>
    </div>
  )
}
