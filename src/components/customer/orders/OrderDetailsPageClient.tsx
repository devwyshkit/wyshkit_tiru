'use client';

import { use } from "react";
import { OrderTracker } from "@/components/customer/orders/OrderTracker";

interface OrderDetailsPageClientProps {
  params: Promise<{ id: string }>;
  isSheet?: boolean;
}

/**
 * WYSHKIT 2026: Order Details Page Client Component
 * Uses React 19 use() hook for Promise handling
 * 
 * Swiggy 2026 Pattern: URL-addressable order details
 */
export function OrderDetailsPageClient({ params, isSheet = false }: OrderDetailsPageClientProps) {
  const { id } = use(params);

  return <OrderTracker orderId={id} isSheet={isSheet} />;
}
