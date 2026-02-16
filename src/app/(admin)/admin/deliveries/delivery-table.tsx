'use client'

import { useState } from 'react'
import { useRouter } from 'next/navigation'
import { Badge } from '@/components/ui/badge'
import { Input } from '@/components/ui/input'
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table'
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select'
import { Search } from 'lucide-react'
import type { Database } from '@/lib/supabase/database.types'

type Tables<T extends keyof Database['public']['Tables']> = Database['public']['Tables'][T]['Row']

type DeliveryWithOrder = Tables<'deliveries'> & {
  orders: {
    order_number: string
    total: number
    partners: { name?: string | null; business_name: string | null } | null
    users: { name?: string | null; full_name?: string | null; phone: string | null } | null
  } | null
}

interface DeliveryTableProps {
  deliveries: DeliveryWithOrder[]
  currentStatus?: string
}

const STATUS_OPTIONS = [
  { value: 'all', label: 'All' },
  { value: 'pending', label: 'Pending' },
  { value: 'picked_up', label: 'Picked up' },
  { value: 'in_transit', label: 'In transit' },
  { value: 'delivered', label: 'Delivered' },
  { value: 'failed', label: 'Failed' },
]

function formatDate(date: string | null) {
  if (!date) return '-'
  return new Date(date).toLocaleDateString('en-IN', { day: 'numeric', month: 'short', hour: '2-digit', minute: '2-digit' })
}

function getStatusBadge(status: string | null) {
  if (!status) return <Badge variant="outline">Unknown</Badge>
  const colors: Record<string, string> = {
    pending: 'text-amber-600 border-amber-200',
    picked_up: 'text-blue-600 border-blue-200',
    in_transit: 'text-purple-600 border-purple-200',
    delivered: 'text-emerald-600 border-emerald-200',
    failed: 'text-red-600 border-red-200',
  }
  const normalizedStatus = status.toLowerCase().replace(/ /g, '_')
  return <Badge variant="outline" className={colors[normalizedStatus] || ''}>{status.replace(/_/g, ' ')}</Badge>
}

export function DeliveryTable({ deliveries, currentStatus }: DeliveryTableProps) {
  const [search, setSearch] = useState('')
  const router = useRouter()

  const filtered = deliveries.filter((d) =>
    d.orders?.order_number?.toLowerCase().includes(search.toLowerCase()) ||
    d.awb_number?.toLowerCase().includes(search.toLowerCase()) ||
    (d.orders?.partners?.name ?? d.orders?.partners?.business_name)?.toLowerCase().includes(search.toLowerCase()) ||
    d.orders?.partners?.business_name?.toLowerCase().includes(search.toLowerCase())
  )

  const handleStatusFilter = (value: string) => {
    if (value === 'all') {
      router.push('/admin/deliveries')
    } else {
      router.push(`/admin/deliveries?status=${value}`)
    }
  }

  return (
    <div className="space-y-4">
      <div className="flex flex-col sm:flex-row gap-3">
        <div className="relative flex-1">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 size-4 text-zinc-400" />
          <Input placeholder="Search order or AWB..." value={search} onChange={(e) => setSearch(e.target.value)} className="pl-9" />
        </div>
        <Select value={currentStatus || 'all'} onValueChange={handleStatusFilter}>
          <SelectTrigger className="w-[140px]"><SelectValue /></SelectTrigger>
          <SelectContent>
            {STATUS_OPTIONS.map((opt) => (
              <SelectItem key={opt.value} value={opt.value}>{opt.label}</SelectItem>
            ))}
          </SelectContent>
        </Select>
      </div>

      <div className="border rounded-lg">
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead>Order</TableHead>
              <TableHead className="hidden md:table-cell">Partner</TableHead>
              <TableHead>AWB / Courier</TableHead>
              <TableHead>Status</TableHead>
              <TableHead className="hidden lg:table-cell">ETA</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {filtered.length === 0 ? (
              <TableRow><TableCell colSpan={5} className="text-center text-zinc-500 py-8">No deliveries found</TableCell></TableRow>
            ) : (
              filtered.map((delivery) => (
                <TableRow key={delivery.id}>
                  <TableCell>
                    <div>
                      <span className="font-medium">#{delivery.orders?.order_number}</span>
                      <span className="block text-xs text-zinc-500">
                        {delivery.orders?.users?.name ?? delivery.orders?.users?.full_name ?? delivery.orders?.users?.phone ?? '-'}
                      </span>
                    </div>
                  </TableCell>
                  <TableCell className="hidden md:table-cell text-zinc-500">
                    {delivery.orders?.partners?.business_name || delivery.orders?.partners?.name || '-'}
                  </TableCell>
                  <TableCell>
                    <div>
                      <span className="font-mono text-sm">{delivery.awb_number || 'Not assigned'}</span>
                      {delivery.courier_partner && (
                        <span className="block text-xs text-zinc-500">{delivery.courier_partner}</span>
                      )}
                    </div>
                  </TableCell>
                  <TableCell>{getStatusBadge(delivery.status)}</TableCell>
                  <TableCell className="hidden lg:table-cell text-zinc-500">
                    {formatDate(delivery.estimated_delivery_at)}
                  </TableCell>
                </TableRow>
              ))
            )}
          </TableBody>
        </Table>
      </div>
    </div>
  )
}
