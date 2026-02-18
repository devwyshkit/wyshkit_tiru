'use client';

import React from 'react';
import { Download, FileText, ChevronDown, ChevronUp } from 'lucide-react';
import { formatCurrency } from '@/lib/utils/pricing';
import { generateTaxInvoicePDF } from '@/lib/services/pdf-service';
import { toast } from 'sonner';
import { useState } from 'react';
import { cn } from '@/lib/utils';
import { Button } from '@/components/ui/button';

interface BillSummaryProps {
    order: any;
}

export function BillSummary({ order }: BillSummaryProps) {
    const [isExpanded, setIsExpanded] = useState(false);

    if (!order) return null;

    const handleDownloadInvoice = () => {
        try {
            const data = {
                orderNumber: order.order_number,
                date: new Date(order.created_at).toLocaleDateString(),
                order_items: order.order_items,
                partner: {
                    name: order.partner_name || 'WyshKit Partner',
                    address: 'Bangalore, India', // Placeholder if address missing
                    gstin: order.partner_gstin
                },
                customerName: order.customer_name || 'Valued Customer', // Should come from order or auth
                totals: {
                    itemTotal: order.subtotal || 0,
                    deliveryFee: order.delivery_fee || 0,
                    platformFee: order.platform_fee || 0,
                    gstAmount: order.tax_amount || 0,
                    grandTotal: order.total || 0,
                    discount: (order.discount || 0) + (order.cashback_amount || 0)
                }
            };
            generateTaxInvoicePDF(data);
            toast.success('Invoice downloaded');
        } catch (error) {
            console.error('Invoice generation failed', error);
            toast.error('Failed to generate invoice');
        }
    };

    return (
        <div className="bg-white rounded-[2rem] border border-zinc-100 overflow-hidden">
            <button
                onClick={() => setIsExpanded(!isExpanded)}
                className="w-full flex items-center justify-between p-5 bg-zinc-50/50 hover:bg-zinc-50 transition-colors"
            >
                <div className="flex items-center gap-3">
                    <div className="size-10 rounded-xl bg-white border border-zinc-100 flex items-center justify-center shadow-sm">
                        <FileText className="size-5 text-zinc-900" />
                    </div>
                    <div className="text-left">
                        <p className="text-sm font-bold text-zinc-900">Bill Summary</p>
                        <p className="text-[10px] font-medium text-zinc-500">
                            Total: {formatCurrency(order.total || 0)}
                        </p>
                    </div>
                </div>
                {isExpanded ? <ChevronUp className="size-5 text-zinc-400" /> : <ChevronDown className="size-5 text-zinc-400" />}
            </button>

            <div className={cn(
                "grid transition-all duration-300 ease-in-out",
                isExpanded ? "grid-rows-[1fr] opacity-100" : "grid-rows-[0fr] opacity-0"
            )}>
                <div className="overflow-hidden">
                    <div className="p-5 pt-0 space-y-3">
                        <div className="h-px bg-zinc-100 w-full mb-4" />

                        <div className="flex justify-between text-xs text-zinc-600">
                            <span>Item Total</span>
                            <span className="font-medium text-zinc-900">{formatCurrency(order.subtotal || 0)}</span>
                        </div>

                        {(order.delivery_fee > 0 || order.delivery_fee === 0) && (
                            <div className="flex justify-between text-xs text-zinc-600">
                                <span>Delivery Fee</span>
                                <span className="font-medium text-zinc-900">
                                    {order.delivery_fee === 0 ? 'FREE' : formatCurrency(order.delivery_fee)}
                                </span>
                            </div>
                        )}

                        {(order.platform_fee > 0) && (
                            <div className="flex justify-between text-xs text-zinc-600">
                                <span>Platform Fee</span>
                                <span className="font-medium text-zinc-900">{formatCurrency(order.platform_fee)}</span>
                            </div>
                        )}

                        <div className="flex justify-between text-xs text-zinc-600">
                            <span>GST & Taxes</span>
                            <span className="font-medium text-zinc-900">{formatCurrency(order.tax_amount || 0)}</span>
                        </div>

                        {((order.discount || 0) + (order.cashback_amount || 0)) > 0 && (
                            <div className="flex justify-between text-xs text-emerald-600 font-medium">
                                <span>Total Savings</span>
                                <span>-{formatCurrency((order.discount || 0) + (order.cashback_amount || 0))}</span>
                            </div>
                        )}

                        <div className="h-px bg-zinc-100 w-full my-2" />

                        <div className="flex justify-between items-center">
                            <span className="text-sm font-bold text-zinc-900">Grand Total</span>
                            <span className="text-base font-black text-zinc-900">{formatCurrency(order.total || 0)}</span>
                        </div>

                        <div className="pt-4">
                            <Button
                                onClick={handleDownloadInvoice}
                                variant="outline"
                                className="w-full h-10 rounded-xl gap-2 font-bold text-xs"
                            >
                                <Download className="size-3.5" />
                                Download Tax Invoice
                            </Button>
                        </div>
                    </div>
                </div>
            </div>
        </div>
    );
}
