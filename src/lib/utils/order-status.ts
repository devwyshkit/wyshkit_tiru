/**
 * Order Status Utility Functions
 * 
 * Helper functions for displaying and styling order statuses.
 * Uses ORDER_STATUS from @/lib/types/order-status (DB-derived types).
 */

import { ORDER_STATUS, type OrderStatus } from '@/lib/types/order-status';

/**
 * Convert database enum value to display-friendly text
 * Example: "IN_PRODUCTION" → "In Production"
 */
export function getOrderStatusDisplay(status: string): string {
  return status
    .split('_')
    .map(word => word.charAt(0).toUpperCase() + word.slice(1).toLowerCase())
    .join(' ');
}

/**
 * Get color classes for order status badge
 */
export function getOrderStatusColor(status: string): string {
  switch (status) {
    case ORDER_STATUS.PLACED:
    case ORDER_STATUS.PREVIEW_READY:
    case ORDER_STATUS.REVISION_REQUESTED:
      return "bg-rose-50 text-[var(--primary)] border-rose-100";

    case ORDER_STATUS.DETAILS_RECEIVED:
    case ORDER_STATUS.IN_PRODUCTION:
    case ORDER_STATUS.PACKED:
    case ORDER_STATUS.DISPATCHED:
    case ORDER_STATUS.OUT_FOR_DELIVERY:
      return "bg-amber-50 text-amber-600 border-amber-100";

    case ORDER_STATUS.APPROVED:
      return "bg-blue-50 text-blue-600 border-blue-100";

    case ORDER_STATUS.DELIVERED:
      return "bg-emerald-50 text-emerald-600 border-emerald-100";

    case ORDER_STATUS.CANCELLED:
    case ORDER_STATUS.REFUNDED:
      return "bg-zinc-100 text-zinc-500 border-zinc-200";

    default:
      return "bg-zinc-50 text-zinc-400 border-zinc-100";
  }
}

