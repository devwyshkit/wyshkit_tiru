import { createClient } from '@/lib/supabase/server'
import { PincodeList } from './pincode-list'
import type { ServiceablePincode } from '@/lib/types/admin.types'

async function getPincodes(): Promise<ServiceablePincode[]> {
  const supabase = await createClient()
  const { data } = await supabase
    .from('serviceable_pincodes')
    .select('*')
    .order('pincode', { ascending: true })
  return data || []
}

export default async function ServiceabilityPage() {
  const pincodes = await getPincodes()

  return (
    <div className="space-y-6">
      <h1 className="text-lg font-semibold text-zinc-900">Serviceability</h1>
      <PincodeList pincodes={pincodes} />
    </div>
  )
}
