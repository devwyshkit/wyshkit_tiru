'use client';

import React, { useState } from 'react';
import Image from 'next/image';
import { ShoppingBag, Sparkles, Clock, Camera, Package, CheckCircle2, X } from 'lucide-react';
import { Sheet, SheetContent } from '@/components/ui/sheet';
import { cn } from '@/lib/utils';
import { formatCurrency } from '@/lib/utils/pricing';
import { ORDER_STATUS } from '@/lib/types/order-status';
import { IdentityForm } from '../IdentityForm';
import { SubmittedIdentity } from './SubmittedIdentity';
import { PreviewApproval } from '../PreviewApproval';
import { approvePreview, requestChange } from '@/lib/actions/orders';
import { toast } from 'sonner';

interface OrderItemsListProps {
    order: any;
    itemPreviews: Record<string, any>;
    onPersonalizationSubmitted: () => void;
}

export function OrderItemsList({ order, itemPreviews, onPersonalizationSubmitted }: OrderItemsListProps) {
    const [selectedPreviewItem, setSelectedPreviewItem] = useState<any | null>(null);
    const [isApproving, setIsApproving] = useState(false);
    const [isRequestingChange, setIsRequestingChange] = useState(false);

    const getItemStatusConfig = (status: string) => {
        // ... (keep existing config logic)
        const s = status.toUpperCase();
        if (s === 'WAITING_FOR_INPUT' || s === 'AWAITING_DETAILS') {
            return { label: 'Design Needed', color: 'text-amber-600 bg-amber-50 border-amber-100', icon: Sparkles };
        }
        if (s === 'DETAILS_SHARED') {
            return { label: 'Reviewing Details', color: 'text-blue-600 bg-blue-50 border-blue-100', icon: Clock };
        }
        if (s === 'PREVIEW_READY') {
            return { label: 'Preview Ready', color: 'text-rose-600 bg-rose-50 border-rose-100', icon: Camera };
        }
        if (s === 'APPROVED' || s === 'IN_PRODUCTION') {
            return { label: 'Preparing', color: 'text-emerald-600 bg-emerald-50 border-emerald-100', icon: Package };
        }
        if (s === 'PACKED') {
            return { label: 'Ready', color: 'text-emerald-600 bg-emerald-50 border-emerald-100', icon: CheckCircle2 };
        }
        return { label: status.toLowerCase(), color: 'text-zinc-500 bg-zinc-50 border-zinc-100', icon: Clock };
    };

    const renderItemStatus = (item: any) => {
        const itemStatus = item.status || order.status;
        const config = getItemStatusConfig(itemStatus);
        const Icon = config.icon;

        return (
            <div className={cn("flex items-center gap-1.5 px-2 py-0.5 rounded-full border text-[10px] font-bold uppercase tracking-wider", config.color)}>
                <Icon className="size-3" />
                <span>{config.label}</span>
            </div>
        );
    };

    return (
        <>
            <section className="bg-white rounded-3xl border border-zinc-100 overflow-hidden">
                <div className="px-5 py-3 border-b border-zinc-50 bg-zinc-50/50 flex items-center justify-between">
                    <h3 className="text-xs font-bold text-zinc-400 uppercase tracking-widest">Items ({order.order_items?.length || 0})</h3>
                    <span className="text-[10px] font-bold text-zinc-300">#{order.order_number}</span>
                </div>
                <div className="divide-y divide-zinc-50">
                    {(order.order_items || []).map((item: any) => (
                        <div key={item.id} className="p-4 flex gap-4">
                            <div className="size-16 bg-zinc-50 rounded-xl relative overflow-hidden border border-zinc-100 shrink-0">
                                {(item.item_image_url || item.image_url) ? (
                                    <Image
                                        src={item.item_image_url || item.image_url}
                                        alt={item.item_name || item.name}
                                        fill
                                        className="object-cover"
                                    />
                                ) : (
                                    <div className="size-full flex items-center justify-center">
                                        <ShoppingBag className="size-6 text-zinc-200" />
                                    </div>
                                )}
                            </div>
                            <div className="flex-1 min-w-0">
                                <div className="flex items-start justify-between gap-2 mb-1">
                                    <p className="text-sm font-bold text-zinc-900 line-clamp-2 leading-tight">{item.item_name || item.name}</p>
                                    <p className="text-xs font-bold text-zinc-900 tabular-nums">x{item.quantity}</p>
                                </div>

                                <div className="flex items-center justify-between mt-2">
                                    {renderItemStatus(item)}
                                    <span className="text-xs font-bold text-zinc-900">{formatCurrency(item.total_price)}</span>
                                </div>

                                {/* WYSHKIT 2026: Identity Visibility (Post-Submission) */}
                                {item.is_personalized && item.personalization_details && item.status !== 'preview_ready' && (
                                    <div className="mt-4 pt-4 border-t border-zinc-50">
                                        <SubmittedIdentity
                                            details={item.personalization_details as any}
                                            itemName={item.item_name || item.name}
                                        />
                                    </div>
                                )}

                                {/* WYSHKIT 2026: Item-Level Personalization Form */}
                                {item.is_personalized && (() => {
                                    const s = (item.status || 'pending').toLowerCase();
                                    // Hide if already moved past design phase
                                    if (s === 'preview_ready' || s === 'approved' || s === 'in_production' || s === 'packed' || s === 'shipped' || s === 'delivered' || s === 'cancelled') return false;
                                    return true;
                                })() && (
                                        <div className="mt-4 pt-4 border-t border-zinc-50">
                                            <IdentityForm
                                                order={order}
                                                orderItem={item}
                                                onSubmitted={onPersonalizationSubmitted}
                                            />
                                        </div>
                                    )}

                                {/* WYSHKIT 2026: Preview Trigger (Sheet Mode) */}
                                {item.status === 'preview_ready' && itemPreviews[item.id] && (
                                    <div className="mt-4 pt-4 border-t border-zinc-50">
                                        <button
                                            onClick={() => setSelectedPreviewItem(item)}
                                            className="w-full flex items-center justify-between p-3 bg-rose-50 border border-rose-100 rounded-xl group active:scale-[0.98] transition-all"
                                        >
                                            <div className="flex items-center gap-3">
                                                <div className="size-10 bg-white rounded-lg flex items-center justify-center border border-rose-100 shadow-sm">
                                                    <Camera className="size-5 text-rose-500" />
                                                </div>
                                                <div className="text-left">
                                                    <p className="text-xs font-bold text-rose-900">Preview Ready</p>
                                                    <p className="text-[10px] text-rose-600 font-medium">Tap to review & approve</p>
                                                </div>
                                            </div>
                                            <div className="size-8 rounded-full bg-white flex items-center justify-center border border-rose-100 group-hover:bg-rose-100 transition-colors">
                                                <div className="size-2 rounded-full bg-rose-500 animate-pulse" />
                                            </div>
                                        </button>
                                    </div>
                                )}
                            </div>
                        </div>
                    ))}
                </div>
            </section>

            {/* WYSHKIT 2026: Preview Sheet */}
            <Sheet open={!!selectedPreviewItem} onOpenChange={(open) => !open && setSelectedPreviewItem(null)}>
                <SheetContent side="bottom" className="p-0 h-[90dvh] rounded-t-[32px] border-none overflow-hidden outline-none bg-zinc-50">
                    {selectedPreviewItem && itemPreviews[selectedPreviewItem.id] && (
                        <div className="h-full overflow-y-auto overscroll-contain pb-safe">
                            <div className="p-4 sticky top-0 bg-white/80 backdrop-blur-md z-10 border-b border-zinc-100 flex items-center justify-between">
                                <h3 className="text-lg font-black text-zinc-900 tracking-tight">Review Design</h3>
                                <button
                                    onClick={() => setSelectedPreviewItem(null)}
                                    className="p-2 bg-zinc-100 rounded-full hover:bg-zinc-200 transition-colors"
                                >
                                    <X className="size-5 text-zinc-500" />
                                </button>
                            </div>
                            <div className="p-4">
                                <PreviewApproval
                                    preview={itemPreviews[selectedPreviewItem.id]}
                                    orderItem={selectedPreviewItem}
                                    onApprove={async () => {
                                        setIsApproving(true);
                                        try {
                                            const result = await approvePreview(itemPreviews[selectedPreviewItem.id].id, order.id);
                                            if (result.success) {
                                                toast.success('Item approved! Production has started.');
                                                setSelectedPreviewItem(null);
                                            } else {
                                                toast.error(result.error ?? 'Failed to approve');
                                            }
                                            return result;
                                        } catch {
                                            toast.error('Something went wrong');
                                            return { success: false };
                                        } finally {
                                            setIsApproving(false);
                                        }
                                    }}
                                    onRequestChange={async (feedback: string) => {
                                        setIsRequestingChange(true);
                                        try {
                                            const result = await requestChange(itemPreviews[selectedPreviewItem.id].id, order.id, feedback);
                                            if (result.success) {
                                                toast.success('Feedback sent. Partner will upload a new preview.');
                                                setSelectedPreviewItem(null);
                                            } else {
                                                toast.error(result.error ?? 'Failed to send feedback');
                                            }
                                            return result;
                                        } catch {
                                            toast.error('Something went wrong');
                                            return { success: false };
                                        } finally {
                                            setIsRequestingChange(false);
                                        }
                                    }}
                                    isApproving={isApproving || isRequestingChange}
                                    maxChanges={order.max_change_requests ?? 2}
                                    changeCount={order.change_request_count ?? 0}
                                />
                            </div>
                        </div>
                    )}
                </SheetContent>
            </Sheet>
        </>
    );
}
