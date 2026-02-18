'use client';

import React from 'react';
import { Clock, CheckCircle2, Package, Camera, FileText, Download, AlertCircle, Timer } from 'lucide-react';
import { cn } from '@/lib/utils';
import { ORDER_STATUS } from '@/lib/types/order-status';
import { generateEstimatePDF, generateTaxInvoicePDF } from '@/lib/services/pdf-service';

interface StatusCardProps {
    order: any;
}

export function StatusCard({ order }: StatusCardProps) {
    const [timeLeft, setTimeLeft] = React.useState<string | null>(null);

    // WYSHKIT 2026: The "Live Pulse" ETA Engine
    React.useEffect(() => {
        if (!order || order.status === ORDER_STATUS.DELIVERED || order.status === ORDER_STATUS.CANCELLED) {
            setTimeLeft(null);
            return;
        }

        const calculateETA = () => {
            const createdAt = new Date(order.created_at || Date.now()).getTime();
            const now = Date.now();
            const elapsedMins = Math.floor((now - createdAt) / 60000);

            // Swiggy 2026 SLA Logic:
            // - Plain orders: ~30-45 mins total
            // - Personalized: ~24h for design + 2h for production
            const baseSLA = order.has_personalization ? 1440 : 45;
            const remaining = Math.max(2, baseSLA - elapsedMins);

            if (order.has_personalization && order.status === ORDER_STATUS.CONFIRMED) {
                return "Waiting for details";
            }

            if (order.status === ORDER_STATUS.OUT_FOR_DELIVERY) {
                return "Arriving in ~5 mins";
            }

            return `${remaining} min`;
        };

        setTimeLeft(calculateETA());
        const timer = setInterval(() => setTimeLeft(calculateETA()), 30000);
        return () => clearInterval(timer);
    }, [order.status, order.created_at, order.has_personalization]);

    const getStatusIcon = (status: string) => {
        switch (status) {
            case ORDER_STATUS.PLACED: return <Clock className="size-5" />;
            case ORDER_STATUS.DETAILS_RECEIVED: return <Package className="size-5" />;
            case ORDER_STATUS.PREVIEW_READY: return <Camera className="size-5" />;
            case ORDER_STATUS.APPROVED: return <CheckCircle2 className="size-5" />;
            case ORDER_STATUS.DELIVERED: return <CheckCircle2 className="size-5" />;
            default: return <Clock className="size-5" />;
        }
    };

    function getStatusText(status: string) {
        const map: Record<string, string> = {
            [ORDER_STATUS.PLACED]: 'Order placed',
            [ORDER_STATUS.CONFIRMED]: 'Partner confirmed',
            [ORDER_STATUS.DETAILS_RECEIVED]: 'Details reviewed',
            [ORDER_STATUS.PREVIEW_READY]: 'Preview is ready',
            [ORDER_STATUS.REVISION_REQUESTED]: 'Revision in progress',
            [ORDER_STATUS.APPROVED]: 'Ready to craft',
            [ORDER_STATUS.IN_PRODUCTION]: 'Crafting now',
            [ORDER_STATUS.PACKED]: 'Ready to fly',
            [ORDER_STATUS.DISPATCHED]: 'On the way',
            [ORDER_STATUS.OUT_FOR_DELIVERY]: 'Arriving shortly',
            [ORDER_STATUS.DELIVERED]: 'Delivered',
        };
        return map[status] || status.replace(/_/g, ' ').toLowerCase();
    }

    function getNextStep(status: string, hasPersonalization: boolean = false) {
        switch (status) {
            case ORDER_STATUS.PLACED:
                return hasPersonalization ? 'Waiting for your design details' : 'Waiting for partner to accept';
            case ORDER_STATUS.CONFIRMED:
                return hasPersonalization ? 'Share identity to start crafting' : 'Partner is securing your items';
            case ORDER_STATUS.DETAILS_RECEIVED: return 'Partner is sketching your vision';
            case ORDER_STATUS.PREVIEW_READY: return 'Review and approve your design preview';
            case ORDER_STATUS.APPROVED: return 'Partner is starting production';
            case ORDER_STATUS.IN_PRODUCTION: return 'Your gift is being masterfully prepared';
            case ORDER_STATUS.PACKED: return 'Gift is being gift-wrapped for delivery';
            case ORDER_STATUS.OUT_FOR_DELIVERY: return 'Valet is arriving at your location';
            case ORDER_STATUS.DELIVERED: return 'Gift successfully delivered';
            default: return 'Processing your order';
        }
    }

    return (
        <section className="bg-white rounded-3xl border border-zinc-100 p-6 shadow-sm overflow-hidden relative">
            {/* WYSHKIT 2026: Live Pulse Header */}
            {timeLeft && (
                <div className="absolute top-0 right-0 px-4 py-2 bg-zinc-950 flex items-center gap-2 rounded-bl-2xl">
                    <div className="relative flex size-1.5 items-center justify-center">
                        <span className="absolute inline-flex h-full w-full animate-ping rounded-full bg-emerald-400 opacity-75"></span>
                        <span className="relative inline-flex size-1.5 rounded-full bg-emerald-500"></span>
                    </div>
                    <span className="text-[10px] font-black text-white uppercase tracking-widest">Live</span>
                </div>
            )}

            <div className="flex items-start gap-4">
                <div className={cn(
                    "size-14 rounded-2xl flex items-center justify-center shrink-0 relative transition-all duration-500",
                    order.status === ORDER_STATUS.PREVIEW_READY
                        ? "bg-rose-50 text-[#D91B24]"
                        : order.status === ORDER_STATUS.DELIVERED ? "bg-emerald-50 text-emerald-600" : "bg-zinc-100 text-zinc-600",
                    timeLeft && "scale-105 shadow-lg shadow-zinc-100"
                )}>
                    {getStatusIcon(order.status)}
                    {timeLeft && (
                        <div className="absolute -bottom-1 -right-1 size-5 bg-white rounded-full flex items-center justify-center shadow-sm border border-zinc-100">
                            <Timer className="size-3 text-zinc-950 animate-pulse" />
                        </div>
                    )}
                </div>
                <div className="flex-1">
                    <div className="flex items-center gap-2">
                        <h2 className="text-lg font-black text-zinc-900 uppercase tracking-tight leading-tight">
                            {getStatusText(order.status)}
                        </h2>
                    </div>

                    {order.status === ORDER_STATUS.CANCELLED && order.cancellation_reason ? (
                        <div className="mt-2 p-3 bg-amber-50 rounded-xl border border-amber-100 flex items-start gap-2 animate-in fade-in slide-in-from-top-1 duration-300">
                            <AlertCircle className="size-3.5 text-amber-600 shrink-0 mt-0.5" />
                            <p className="text-[11px] font-bold text-amber-900/80 leading-relaxed italic">
                                "{order.cancellation_reason}"
                            </p>
                        </div>
                    ) : (
                        <div className="flex flex-col gap-0.5 mt-1">
                            <p className="text-xs font-medium text-zinc-500">{getNextStep(order.status, order.has_personalization)}</p>
                            {timeLeft && (
                                <p className="text-[11px] font-black text-emerald-600 uppercase tracking-wide flex items-center gap-1.5">
                                    {timeLeft}
                                </p>
                            )}
                        </div>
                    )}
                </div>
            </div>

            <div className="mt-6 flex gap-1.5">
                {[0, 1, 2, 3].map((i) => {
                    const stepStatuses: Record<string, number> = {
                        [ORDER_STATUS.PLACED]: 0,
                        [ORDER_STATUS.CONFIRMED]: 0,
                        [ORDER_STATUS.DETAILS_RECEIVED]: 1,
                        [ORDER_STATUS.PREVIEW_READY]: 1,
                        [ORDER_STATUS.REVISION_REQUESTED]: 1,
                        [ORDER_STATUS.APPROVED]: 1,
                        [ORDER_STATUS.IN_PRODUCTION]: 1,
                        [ORDER_STATUS.PACKED]: 2,
                        [ORDER_STATUS.DISPATCHED]: 3,
                        [ORDER_STATUS.OUT_FOR_DELIVERY]: 3,
                        [ORDER_STATUS.DELIVERED]: 4,
                    };
                    const currentStep = stepStatuses[order.status] ?? 0;
                    const isActive = i < currentStep;
                    const isCurrent = i === currentStep;

                    return (
                        <div key={i} className="flex-1 h-1 rounded-full bg-zinc-100 relative overflow-hidden">
                            {(isActive || isCurrent) && (
                                <div className={cn(
                                    "absolute inset-0 bg-zinc-900 transition-all duration-1000",
                                    isCurrent && "animate-pulse shadow-[0_0_12px_rgba(0,0,0,0.2)]",
                                    (isCurrent && timeLeft) && "bg-emerald-500"
                                )} />
                            )}
                        </div>
                    );
                })}
            </div>

            {/* WYSHKIT 2026: B2B Documents (Estimate/Invoice) */}
            <div className="mt-6 flex flex-wrap gap-2 pt-5 border-t border-zinc-50">
                <button
                    onClick={() => {
                        const orderData = order as any;
                        generateEstimatePDF({
                            orderNumber: orderData.order_number,
                            date: new Date(orderData.created_at || Date.now()).toLocaleDateString(),
                            order_items: orderData.order_items,
                            customerName: (orderData.delivery_address as any)?.name,
                            billingAddress: orderData.delivery_address,
                            gstin: orderData.gstin,
                            partner: orderData.partner?.[0] || { name: 'Partner', address: 'Bangalore' },
                            totals: {
                                itemTotal: Number(orderData.subtotal) || 0,
                                deliveryFee: Number(orderData.delivery_fee) || 0,
                                platformFee: 10,
                                gstAmount: (Number(orderData.total) || 0) * 0.18,
                                grandTotal: Number(orderData.total) || 0
                            }
                        });
                    }}
                    className="flex-1 flex items-center justify-center gap-2 px-4 py-3 bg-zinc-50 border border-zinc-100 rounded-2xl text-[11px] font-bold text-zinc-600 hover:bg-zinc-100 active:scale-95 transition-all"
                >
                    <FileText className="size-3.5" />
                    Estimate
                </button>
                {order.status === ORDER_STATUS.DELIVERED && (
                    <button
                        onClick={() => {
                            const orderData = order as any;
                            generateTaxInvoicePDF({
                                orderNumber: orderData.order_number,
                                date: new Date().toLocaleDateString(),
                                order_items: orderData.order_items,
                                customerName: (orderData.delivery_address as any)?.name,
                                billingAddress: orderData.delivery_address,
                                gstin: orderData.gstin,
                                partner: orderData.partner?.[0] || { name: 'Partner', address: 'Bangalore' },
                                totals: {
                                    itemTotal: Number(orderData.subtotal) || 0,
                                    deliveryFee: Number(orderData.delivery_fee) || 0,
                                    platformFee: 10,
                                    gstAmount: (Number(orderData.total) || 0) * 0.18,
                                    grandTotal: Number(orderData.total) || 0
                                }
                            });
                        }}
                        className="flex-1 flex items-center justify-center gap-2 px-4 py-3 bg-emerald-50 border border-emerald-100 rounded-2xl text-[11px] font-bold text-emerald-600 hover:bg-emerald-100 active:scale-95 transition-all"
                    >
                        <Download className="size-3.5" />
                        Invoice
                    </button>
                )}
            </div>
        </section>
    );
}
