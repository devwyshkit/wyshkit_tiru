/**
 * Order Types - Wyshkit 2026: Zero Data Mismatch
 * 
 * All types derive directly from Supabase database types.
 * UI-only types are kept for display transformations.
 * 
 * Hyperlocal Item Marketplace with Optional Personalization
 */

import type { Tables } from '@/lib/supabase/database.types';

// Fallback for missing view type
type ViewOrderDetailed = any;

export type OrderItem = Tables<'order_items'>;
export type OrderPersonalization = Tables<'order_personalization'>;

export interface OrderListItem {
  id: string | null;
  orderNumber: string | null;
  status: string | null;
  total: number | null;
  createdAt: string | null;
  partnerName?: string | null;
  itemCount?: number; // Optional: v_order_listings does not have this; OrderCard defaults to 1
  firstItemImage?: string | null;
  firstItemName?: string | null;
  hasPersonalization?: boolean;
  personalizationStatus?: string | null;
}

export interface OrderForPDF {
  orderNumber: string;
  createdAt: string;
  subtotal: number;
  deliveryFee: number;
  platformFee: number;
  total: number;
  partners: {
    name: string;
    gstin?: string;
  };
  orderItems: Array<{
    itemName: string;
    quantity: number;
    unitPrice: number;
    totalPrice: number;
  }>;
}

export interface PartnerForPDF {
  name: string;
  gstin?: string;
  businessType?: string;
  panNumber?: string;
}

export interface PreviewSubmission {
  id: string;
  orderId: string;
  previewUrl: string;
  version: number;
  status: 'pending' | 'approved' | 'change_requested';
  partnerNotes?: string;
  customerFeedback?: string;
  submittedAt: string;
}

export interface OrderItemDetail {
  id: string;
  itemId: string;
  name: string;
  quantity: number;
  unitPrice: number;
  totalPrice: number;
  personalizationConfig?: unknown;
  imageUrl?: string;
  itemName?: string;
}

export interface OrderStatusHistory {
  id: string;
  orderId: string;
  type: string;
  title: string;
  description: string;
  createdAt: string;
  metadata?: Record<string, unknown>;
}

export interface OrderDetail extends ViewOrderDetailed {
  subtotal?: number;
  personalizationCharges?: number;
  deliveryFee?: number;
  platformFee?: number;
  gst?: number;
  discount?: number;
  hasPersonalization: boolean;
  personalizationInput?: Record<string, unknown>;
  personalizationStatus?: string;
  placedAt?: string;
  paidAt?: string;
  details_submitted_at?: string | null;
  approved_at?: string | null;
  previewSubmissions?: PreviewSubmission[];
  personalizations?: OrderPersonalization[];
  orderItems?: OrderItemDetail[];
  orderStatusHistory?: OrderStatusHistory[];
  partners?: {
    name?: string;
    gstin?: string;
    businessType?: string;
    panNumber?: string;
  };
  users?: {
    fullName?: string;
    email?: string;
    full_name?: string;
  };
  deliveryAddress?: {
    addressLine1: string;
    city: string;
    state?: string;
    pincode?: string;
    country?: string;
    name?: string;
    phone?: string;
  };
}
