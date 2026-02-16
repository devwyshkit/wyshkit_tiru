/**
 * Admin types derived from Supabase database types
 */

import type { Tables } from '@/lib/supabase/database.types'

// Base table types from Supabase
export type Partner = Tables<'partners'>
export type Order = Tables<'orders'>
export type Item = Tables<'items'>
export type Category = Tables<'categories'>
export type Coupon = Tables<'coupons'>
export type User = Tables<'users'>
export type ServiceablePincode = Tables<'serviceable_pincodes'>
export type PartnerPayout = Tables<'partner_payouts'>

// Admin session
export interface AdminSession {
  id: string
  email: string | null
  phone: string
  name: string | null
  role: string
}

// Dashboard metrics
export interface DashboardMetrics {
  gmv_today: number
  orders_today: number
  active_partners: number
  pending_kyc: number
}

// Partner with joined data for lists
export interface PartnerWithStats extends Omit<Partner, 'total_orders'> {
  total_orders?: number | null
  total_gmv?: number
  total_items?: number
}

// Order with joined data for lists
export interface OrderWithRelations extends Order {
  partner: Pick<Partner, 'id' | 'name' | 'business_name'> | null
  user: Pick<User, 'id' | 'full_name' | 'phone'> | null
}

// Item with joined data for catalog
export interface ItemWithRelations extends Item {
  partner: Pick<Partner, 'id' | 'name' | 'business_name'> | null
}

// KYC status values
export const KYC_STATUS = {
  PENDING: 'PENDING',
  SUBMITTED: 'SUBMITTED',
  ACTIVE: 'ACTIVE',
  REJECTED: 'REJECTED',
} as const

export type KYCStatus = (typeof KYC_STATUS)[keyof typeof KYC_STATUS]

// Order status values
export const ORDER_STATUS = {
  PENDING: 'PENDING',
  CONFIRMED: 'CONFIRMED',
  PREPARING: 'PREPARING',
  READY: 'READY',
  OUT_FOR_DELIVERY: 'OUT_FOR_DELIVERY',
  DELIVERED: 'DELIVERED',
  CANCELLED: 'CANCELLED',
} as const

export type OrderStatus = (typeof ORDER_STATUS)[keyof typeof ORDER_STATUS]

// Discount type
export const DISCOUNT_TYPE = {
  PERCENTAGE: 'percentage',
  FIXED: 'fixed',
} as const

export type DiscountType = (typeof DISCOUNT_TYPE)[keyof typeof DISCOUNT_TYPE]
