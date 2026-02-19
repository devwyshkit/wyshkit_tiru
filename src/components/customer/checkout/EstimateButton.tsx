'use client';

import { useState } from 'react';
import { FileText, Loader2, Info } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { generateEstimatePDF } from '@/lib/services/pdf-service';
import { getPartnerInfo } from '@/lib/actions/draft-order';
import { toast } from 'sonner';

interface EstimateButtonProps {
    items: any[];
    pricing: any;
    businessName?: string;
    billingAddress?: any;
    gstin?: string;
    customerName?: string;
}

export function EstimateButton({
    items,
    pricing,
    businessName,
    billingAddress,
    gstin,
    customerName = "Valued Customer"
}: EstimateButtonProps) {
    const [loading, setLoading] = useState(false);

    const handleDownload = async () => {
        if (!items.length || !pricing) {
            toast.error("No items in cart");
            return;
        }

        setLoading(true);
        try {
            const partnerId = items[0]?.partnerId;
            const { data: partner } = await getPartnerInfo(partnerId);

            generateEstimatePDF({
                date: new Date().toLocaleDateString(),
                customerName,
                businessName,
                billingAddress,
                gstin,
                partner: partner
                    ? {
                        name: partner.name,
                        address: partner.address || 'Bangalore, India',
                        gstin: partner.gstin || undefined,
                    }
                    : { name: 'Partner', address: 'Bangalore, India' },
                cart: {
                    items: items.map((it: any) => ({
                        itemName: it.name || "Item",
                        quantity: it.quantity || 1,
                        unitPrice: it.unitPrice || 0,
                        totalPrice: (it.unitPrice || 0) * (it.quantity || 1),
                    })),
                    subtotal: pricing.subtotal,
                    total: pricing.total
                } as any,
                totals: {
                    itemTotal: pricing.subtotal,
                    deliveryFee: pricing.deliveryFee,
                    platformFee: pricing.platformFee,
                    gstAmount: pricing.gst,
                    grandTotal: pricing.total,
                    discount: (pricing.discount || 0) + (pricing.walletDiscount || 0)
                }
            });

            toast.success("Estimate downloaded");
        } catch (err) {
            toast.error("Failed to generate estimate");
        } finally {
            setLoading(false);
        }
    };

    return (
        <div className="flex flex-col gap-3">
            <div className="flex items-start gap-3 p-4 bg-zinc-50 rounded-2xl border border-zinc-100">
                <Info className="size-4 text-zinc-400 mt-0.5" />
                <p className="text-[10px] font-bold text-zinc-500 leading-relaxed uppercase tracking-widest">
                    Need an pro-forma estimate for your business? Click below to generate an PDF.
                </p>
            </div>
            <Button
                onClick={handleDownload}
                disabled={loading}
                variant="outline"
                className="w-full h-14 rounded-2xl border-2 border-zinc-100 hover:border-zinc-900 gap-3 font-black uppercase tracking-widest text-[11px]"
            >
                {loading ? (
                    <Loader2 className="size-4 animate-spin" />
                ) : (
                    <FileText className="size-4" />
                )}
                Get Estimate PDF
            </Button>
        </div>
    );
}
