/**
 * Order Status Types - STRICTLY Derived from Supabase Database Enum
 * 
 * This file is the SINGLE SOURCE OF TRUTH for order status values.
 * All status values must match the database enum exactly (UPPERCASE).
 * 
 * Database Enum: Database['public']['Enums']['order_status']
 * 
 * NEVER create custom status constants. Always use this file.
 */

import type { Database } from '@/lib/supabase/database.types';
import { Sparkles, Package, Clock, CheckCircle2, AlertCircle } from 'lucide-react';
import React from 'react';

export interface StatusConfig {
  label: string;
  subLabel: string;
  icon: React.ReactNode;
  color: string; // Tailwind class like 'bg-zinc-500'
  pulse: boolean;
}

// ✅ STRICT: Type derived directly from database enum
// We explicitly EXCLUDE deprecated values that might technically exist in DB but should never be used in code.
export type OrderStatus = Exclude<Database['public']['Enums']['order_status'], 'INPUT_RECEIVED' | 'CHANGE_REQUESTED'>;

// ✅ STRICT: Const object with values matching DB enum (UPPERCASE)
export const ORDER_STATUS = {
  PLACED: 'PLACED',
  CONFIRMED: 'CONFIRMED',
  DETAILS_RECEIVED: 'DETAILS_RECEIVED',
  PREVIEW_READY: 'PREVIEW_READY',
  REVISION_REQUESTED: 'REVISION_REQUESTED',
  APPROVED: 'APPROVED',
  IN_PRODUCTION: 'IN_PRODUCTION',
  PACKED: 'PACKED',
  DISPATCHED: 'DISPATCHED',
  DELIVERED: 'DELIVERED',
  CANCELLED: 'CANCELLED',
  REFUNDED: 'REFUNDED',
  OUT_FOR_DELIVERY: 'OUT_FOR_DELIVERY',
  // Swiggy 2026 Aliases
  PREPARING: 'IN_PRODUCTION',
  READY: 'PACKED',
} as const satisfies Record<string, OrderStatus>;

// WYSHKIT 2026: Centralized Status Configuration
// Used by OrderTrackingBar and OrderTracker for consistent UI
export function getStatusConfig(order: { status: string; has_personalization: boolean; order_number?: string; id?: string }): StatusConfig {
  // 1. Action Needed: Personalization (STRICT: Only if has_personalization is true and order is CONFIRMED or PLACED)
  // Swiggy 2026: Allow immediate input after payment (PLACED) to maintain momentum.
  if ((order.status === ORDER_STATUS.CONFIRMED || order.status === ORDER_STATUS.PLACED) &&
    order.has_personalization &&
    (order as any).personalization_status !== 'submitted') {
    return {
      label: "Design Input Needed",
      subLabel: "Upload your design details now",
      icon: React.createElement(Sparkles, { className: "size-4 text-amber-500" }),
      color: "bg-amber-50",
      pulse: true
    };
  }

  // 1.5 Action Needed: Wait for Confirmation
  if (order.status === ORDER_STATUS.PLACED) {
    return {
      label: "Order Placed",
      subLabel: "Waiting for partner to accept",
      icon: React.createElement(Clock, { className: "size-4 text-zinc-400" }),
      color: "bg-zinc-50",
      pulse: true
    };
  }

  // 2. Action Needed: Preview Approval
  if (order.status === ORDER_STATUS.PREVIEW_READY) {
    return {
      label: "Preview Ready",
      subLabel: "Tap to approve and ship",
      icon: React.createElement(Package, { className: "size-4 text-emerald-500" }),
      color: "bg-emerald-50",
      pulse: true
    };
  }

  // 3. Status Display
  return {
    label: `Order #${order.order_number || (order.id ? order.id.slice(0, 8) : '...')}`,
    subLabel: getOrderStatusDisplay(order.status).toLowerCase(),
    icon: React.createElement(Clock, { className: "size-4 text-zinc-400" }),
    color: "bg-zinc-50",
    pulse: false
  };
}

// Type guard to validate status strings
export function isValidOrderStatus(status: string): status is OrderStatus {
  return Object.values(ORDER_STATUS).includes(status as any);
}

// Helper to get all valid statuses
export function getAllOrderStatuses(): OrderStatus[] {
  return [
    'PLACED', 'CONFIRMED', 'DETAILS_RECEIVED', 'PREVIEW_READY', 'REVISION_REQUESTED',
    'APPROVED', 'IN_PRODUCTION', 'PACKED', 'DISPATCHED', 'DELIVERED',
    'CANCELLED', 'REFUNDED', 'OUT_FOR_DELIVERY'
  ];
}

// Display labels for statuses - Wyshkit 2026 Lean State Machine
const STATUS_DISPLAY: Record<string, string> = {
  PLACED: 'Order Placed',
  CONFIRMED: 'Accepted',
  DETAILS_RECEIVED: 'Reviewing Details',
  PREVIEW_READY: 'Preview Uploaded',
  REVISION_REQUESTED: 'Revision Requested',
  APPROVED: 'Approved',
  IN_PRODUCTION: 'Preparing Order',
  PACKED: 'Ready',
  DISPATCHED: 'Dispatched',
  OUT_FOR_DELIVERY: 'Out for Delivery',
  DELIVERED: 'Delivered',
  CANCELLED: 'Cancelled',
  REFUNDED: 'Refunded',
};

// Color classes for statuses - Wyshkit 2026 Design Language
const STATUS_COLORS: Record<string, string> = {
  PLACED: 'text-[var(--primary)]',
  CONFIRMED: 'text-[#60B246]',
  DETAILS_RECEIVED: 'text-amber-500',
  PREVIEW_READY: 'text-blue-500',
  REVISION_REQUESTED: 'text-orange-500',
  APPROVED: 'text-[#60B246]',
  IN_PRODUCTION: 'text-zinc-600',
  PACKED: 'text-[#60B246]',
  DISPATCHED: 'text-zinc-900',
  OUT_FOR_DELIVERY: 'text-zinc-900',
  DELIVERED: 'text-[#60B246]',
  CANCELLED: 'text-zinc-400',
  REFUNDED: 'text-zinc-400',
};

export function getOrderStatusDisplay(status: string): string {
  return STATUS_DISPLAY[status as OrderStatus] || status.replace(/_/g, ' ');
}

export function getOrderStatusColor(status: string): string {
  return STATUS_COLORS[status as OrderStatus] || 'text-zinc-600';
}

// Status grouping helpers (for UI/logic)
export const STATUS_GROUPS = {
  // Customer action required
  CUSTOMER_ACTION: [
    ORDER_STATUS.CONFIRMED, // 2026: Customer needs to provide details
    ORDER_STATUS.DETAILS_RECEIVED,
    ORDER_STATUS.PREVIEW_READY,
  ] as const,

  // Partner action required
  PARTNER_ACTION: [
    ORDER_STATUS.PLACED, // 2026: Partner needs to Accept
    ORDER_STATUS.DETAILS_RECEIVED,
    ORDER_STATUS.REVISION_REQUESTED,
    ORDER_STATUS.APPROVED,
  ] as const,

  // In progress
  IN_PROGRESS: [
    ORDER_STATUS.IN_PRODUCTION,
    ORDER_STATUS.PACKED,
    ORDER_STATUS.DISPATCHED,
    ORDER_STATUS.OUT_FOR_DELIVERY,
  ] as const,

  // Completed
  COMPLETED: [
    ORDER_STATUS.DELIVERED,
  ] as const,

  // Terminal states
  TERMINAL: [
    ORDER_STATUS.CANCELLED,
    ORDER_STATUS.REFUNDED,
  ] as const,
} as const;
// WYSHKIT 2026: Item-level status configuration
// Used by OrderItemsList and CreativeBrief for consistent item status badges
export function getItemStatusConfig(status: string) {
  const s = (status || '').toUpperCase();

  if (s === 'WAITING_FOR_INPUT' || s === 'AWAITING_DETAILS') {
    return {
      label: 'ACTION REQ.',
      color: 'text-amber-700 bg-amber-50 border-amber-200 shadow-sm shadow-amber-100/50',
      icon: Sparkles
    };
  }

  if (s === 'DETAILS_SHARED' || s === 'DETAILS_RECEIVED') {
    return {
      label: 'Reviewing',
      color: 'text-zinc-600 bg-zinc-100 border-zinc-200',
      icon: Clock
    };
  }

  if (s === 'PREVIEW_READY') {
    return {
      label: 'REVIEW REQ.',
      color: 'text-rose-700 bg-rose-50 border-rose-200 shadow-sm shadow-rose-100/50',
      icon: PreviewIcon
    };
  }

  if (s === 'APPROVED' || s === 'IN_PRODUCTION') {
    return {
      label: 'Preparing',
      color: 'text-emerald-700 bg-emerald-50 border-emerald-200',
      icon: Package
    };
  }

  if (s === 'PACKED') {
    return {
      label: 'Ready',
      color: 'text-emerald-700 bg-emerald-50 border-emerald-200',
      icon: CheckCircle2
    };
  }

  return {
    label: s.toLowerCase(),
    color: 'text-zinc-700 bg-zinc-100 border-zinc-200',
    icon: Clock
  };
}

// Internal icon mapping to avoid name collision with Clock
const PreviewIcon = (props: any) => React.createElement(AlertCircle, props);
