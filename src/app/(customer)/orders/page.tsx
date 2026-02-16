import { createClient } from "@/lib/supabase/server";
import { redirect } from "next/navigation";
import { Package, ChevronRight, Calendar, MapPin } from "lucide-react";
import Link from "next/link";
import { cn } from "@/lib/utils";
import { OrderList } from "@/components/customer/orders/OrderList";
import type { OrderListItem } from "@/lib/types/order";

export default async function OrdersPage() {
    const supabase = await createClient();
    const { data: { user } } = await supabase.auth.getUser();

    if (!user) {
        redirect("/auth?intent=signin&returnUrl=/orders");
    }

    // WYSHKIT 2026: Use v_orders_detailed for rich context (items, partner_image)
    const { data: orders, error } = await supabase
        .from('v_orders_detailed')
        .select('id, order_number, status, total, created_at, delivery_address, partner_name, partner_image, items')
        .eq('user_id', user.id)
        .order('created_at', { ascending: false }) as any;

    // Map DB orders to OrderListItem for the component
    const mappedOrders = (orders || []).map((row: any) => ({
        id: row.id,
        orderNumber: row.order_number ?? null,
        status: row.status,
        total: row.total ?? 0,
        createdAt: row.created_at ?? null,
        partnerName: row.partner_name ?? null,
        itemCount: row.items?.length || 1,
        firstItemImage: row.partner_image ?? null,
        firstItemName: row.items?.map((it: any) => it.item_name || it.itemName).join(', ') || null,
    }));

    return (
        <div className="bg-zinc-50/50 min-h-screen py-6">
            <div className="max-w-xl mx-auto px-4">
                <div className="flex items-center justify-between mb-8">
                    <div>
                        <h1 className="text-2xl font-black text-zinc-900 tracking-tight flex items-center gap-2">
                            My Orders
                        </h1>
                        <p className="text-[11px] font-bold text-zinc-400 uppercase tracking-widest mt-0.5">
                            Track and manage your gifts
                        </p>
                    </div>
                    <span className="text-[10px] font-black text-zinc-500 uppercase tracking-widest bg-white px-3 py-1.5 rounded-full border border-zinc-100 shadow-sm">
                        {orders?.length || 0} Total
                    </span>
                </div>

                {error ? (
                    <div className="p-8 text-center bg-white rounded-3xl border border-zinc-100 shadow-sm">
                        <p className="text-sm font-medium text-zinc-500">Failed to load orders. Please try again.</p>
                    </div>
                ) : !orders || orders.length === 0 ? (
                    <div className="p-12 text-center bg-white rounded-[2.5rem] border border-zinc-100 shadow-sm">
                        <div className="size-16 rounded-full bg-zinc-50 flex items-center justify-center mx-auto mb-4 border border-zinc-100">
                            <Package className="size-8 text-zinc-300" />
                        </div>
                        <h3 className="text-lg font-bold text-zinc-900 mb-2">No orders yet</h3>
                        <p className="text-sm text-zinc-500 mb-6 max-w-[200px] mx-auto">Start exploring the best stores in Bangalore!</p>
                        <Link href="/">
                            <button className="bg-zinc-900 text-white rounded-xl px-8 py-3 font-bold text-sm active:scale-95 transition-all">
                                Browse Stores
                            </button>
                        </Link>
                    </div>
                ) : (
                    <OrderList initialOrders={mappedOrders} />
                )}
            </div>
        </div>
    );
}
