import { OrderListItem } from "@/lib/types/order";
import { format } from "date-fns";
import { ChevronRight, Package } from "lucide-react";
import Image from "next/image";
import Link from "next/link";
import { cn } from "@/lib/utils";
import { ORDER_STATUS } from "@/lib/types/order-status";
import { getOrderStatusDisplay, getOrderStatusColor } from "@/lib/utils/order-status";

interface OrderCardProps {
  order: OrderListItem;
}

export function OrderCard({ order }: OrderCardProps) {
  const orderId = order.id ?? '';
  const orderNumber = order.orderNumber ?? '—';
  const status = order.status ?? 'UNKNOWN';
  const total = order.total ?? 0;
  const createdAt = order.createdAt ?? '';
  const itemCount = order.itemCount ?? 1;

  const isActive = ['PLACED', 'DETAILS_RECEIVED', 'PREVIEW_READY', 'REVISION_REQUESTED', 'IN_PRODUCTION', 'OUT_FOR_DELIVERY'].includes(status);

  return (
    <Link
      href={`/orders/${orderId}`}
      className="block bg-white p-5 rounded-[2rem] border border-zinc-100 active:scale-[0.98] transition-all hover:border-zinc-200 shadow-sm hover:shadow-xl hover:shadow-zinc-200/40 cursor-pointer group"
      prefetch={false}
    >
      <div className="flex items-start gap-4">
        {/* Partner Avatar / Image */}
        <div className="size-14 rounded-2xl bg-zinc-50 border border-zinc-100 overflow-hidden shrink-0 flex items-center justify-center relative">
          {order.firstItemImage ? (
            <img src={order.firstItemImage} alt={order.partnerName || 'Store'} className="size-full object-cover" />
          ) : (
            <Package className="size-6 text-zinc-300" />
          )}
          {isActive && (
            <div className="absolute top-1 right-1 size-2 bg-[#D91B24] rounded-full ring-2 ring-white animate-pulse" />
          )}
        </div>

        <div className="flex-1 min-w-0">
          <div className="flex items-start justify-between">
            <div>
              <h3 className="text-sm font-black text-zinc-900 truncate leading-tight group-hover:text-[#D91B24] transition-colors">
                {order.partnerName || "Wyshkit Partner"}
              </h3>
              <p className="text-[10px] font-bold text-zinc-400 mt-0.5 uppercase tracking-wider">
                Order #{orderNumber}
              </p>
            </div>
            <p className="text-sm font-black text-zinc-950 tabular-nums">₹{total}</p>
          </div>

          <div className="mt-3 flex flex-wrap gap-2">
            <span className={cn(
              "px-2 py-0.5 rounded-md text-[9px] font-black uppercase tracking-wider",
              status === 'DELIVERED' ? "bg-emerald-50 text-emerald-600" :
                isActive ? "bg-rose-50 text-[#D91B24]" :
                  "bg-zinc-100 text-zinc-600"
            )}>
              {status.replace(/_/g, ' ')}
            </span>
          </div>

          <p className="text-[11px] font-medium text-zinc-500 mt-3 line-clamp-1">
            {order.firstItemName || "Order Details"}
          </p>
        </div>
      </div>

      <div className="mt-4 pt-4 border-t border-zinc-50 flex items-center justify-between">
        <div className="flex items-center gap-1.5 text-zinc-400 text-[10px] font-bold">
          {createdAt ? format(new Date(createdAt), "MMM d, yyyy") : '—'}
        </div>
        <div className={cn(
          "px-4 py-1.5 rounded-full text-[10px] font-black uppercase tracking-widest transition-all",
          isActive
            ? "bg-[#D91B24] text-white shadow-lg shadow-rose-900/10 active:scale-95"
            : "bg-zinc-50 text-zinc-500 group-hover:bg-zinc-900 group-hover:text-white"
        )}>
          {isActive ? 'Track Order' : 'Details'}
        </div>
      </div>
    </Link>
  );
}
