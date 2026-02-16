import { createClient } from '@/lib/supabase/server'
import { PayoutTable } from './payout-table'

async function getPayouts() {
  const supabase = await createClient()
  const { data } = await supabase
    .from('partner_payouts')
    .select('*, partners(business_name)')
    .order('created_at', { ascending: false })
    .limit(100)
  return data || []
}

async function getPayoutStats() {
  const supabase = await createClient()

  const [pendingResult, processedResult] = await Promise.all([
    supabase.from('partner_payouts').select('payout_amount').eq('status', 'pending'),
    supabase.from('partner_payouts').select('payout_amount').eq('status', 'processed'),
  ])

  const pendingTotal = (pendingResult.data || []).reduce((sum, p) => sum + (p.payout_amount ?? 0), 0)
  const processedTotal = (processedResult.data || []).reduce((sum, p) => sum + (p.payout_amount ?? 0), 0)

  return { pending: pendingTotal, processed: processedTotal }
}

function formatCurrency(amount: number) {
  return new Intl.NumberFormat('en-IN', {
    style: 'currency',
    currency: 'INR',
    maximumFractionDigits: 0,
  }).format(amount)
}

export default async function PayoutsPage() {
  const [payouts, stats] = await Promise.all([getPayouts(), getPayoutStats()])

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <h1 className="text-lg font-semibold text-zinc-900">Payouts</h1>
        <div className="flex gap-4 text-sm">
          <span className="text-zinc-500">
            Pending: <strong className="text-amber-600">{formatCurrency(stats.pending)}</strong>
          </span>
          <span className="text-zinc-500">
            Processed: <strong className="text-emerald-600">{formatCurrency(stats.processed)}</strong>
          </span>
        </div>
      </div>
      <PayoutTable payouts={payouts} />
    </div>
  )
}
