'use client';

import React from 'react';
import { MapPin, Package } from 'lucide-react';

interface DeliveryInfoProps {
    order: any;
}

export function DeliveryInfo({ order }: DeliveryInfoProps) {
    if (!order.delivery_address && !order.awb_number) return null;

    return (
        <div className="space-y-3">
            {order.awb_number && (
                <div className="bg-white rounded-2xl border border-zinc-100 p-4 flex items-center gap-3">
                    <div className="size-10 bg-zinc-50 rounded-lg flex items-center justify-center">
                        <Package className="size-5 text-zinc-400" />
                    </div>
                    <div>
                        <p className="text-[10px] font-bold text-zinc-400 uppercase tracking-wider">Tracking ID</p>
                        <p className="text-sm font-bold text-zinc-900">{order.courier_partner || 'Shadowfax'} • {order.awb_number}</p>
                    </div>
                </div>
            )}

            {order.delivery_address && (
                <div className="bg-white rounded-2xl border border-zinc-100 p-4 flex items-start gap-3">
                    <div className="size-10 bg-zinc-50 rounded-lg flex items-center justify-center shrink-0">
                        <MapPin className="size-5 text-zinc-400" />
                    </div>
                    <div>
                        <p className="text-[10px] font-bold text-zinc-400 uppercase tracking-wider mb-0.5">Delivery Address</p>
                        <p className="text-xs font-medium text-zinc-600 line-clamp-2">
                            {typeof order.delivery_address === 'object'
                                ? `${(order.delivery_address as Record<string, any>).name || ''} • ${(order.delivery_address as Record<string, any>).address_line1 || (order.delivery_address as Record<string, any>).line1 || ''}`
                                : 'Address on file'}
                        </p>
                        {((order as any).gstin || (order.delivery_address as any)?.gstin) && (
                            <div className="mt-2 flex items-center gap-1.5 px-2 py-0.5 rounded-md bg-zinc-50 border border-zinc-100 w-fit">
                                <span className="text-[10px] font-bold text-zinc-400 uppercase tracking-wider">GSTIN:</span>
                                <span className="text-[10px] font-bold text-zinc-600 uppercase">{(order as any).gstin || (order.delivery_address as any).gstin}</span>
                            </div>
                        )}
                    </div>
                </div>
            )}
        </div>
    );
}
