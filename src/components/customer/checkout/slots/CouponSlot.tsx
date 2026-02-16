'use client';

import { useState, useTransition } from 'react';
import { Ticket, X, Loader2 } from 'lucide-react';
import { Input } from '@/components/ui/input';
import { Button } from '@/components/ui/button';
import { applyCouponAction } from '@/lib/actions/checkout';
import { toast } from 'sonner';
import { cn } from '@/lib/utils';

interface CouponSlotProps {
    appliedCoupon: {
        code: string;
        discount: number;
    } | null;
}

/**
 * WYSHKIT 2026: Coupon Slot - Inline expandable (Swiggy pattern, no sheet)
 */
export function CouponSlot({ appliedCoupon }: CouponSlotProps) {
    const [isPending, startTransition] = useTransition();
    const [code, setCode] = useState('');

    const handleApply = async () => {
        if (!code) return;
        startTransition(async () => {
            const result = await applyCouponAction(code);
            if (result.success) {
                setCode('');
                toast.success('Coupon applied');
            } else {
                toast.error('Invalid coupon');
            }
        });
    };

    const handleRemove = async () => {
        startTransition(async () => {
            await applyCouponAction(null);
            toast.info('Coupon removed');
        });
    };

    return (
        <div className="py-2">
            {appliedCoupon ? (
                <div className="flex items-center justify-between p-4 bg-emerald-50 rounded-2xl border border-emerald-100">
                    <div className="flex items-center gap-3">
                        <div className="size-10 rounded-xl bg-white border border-emerald-100 flex items-center justify-center text-emerald-600 shadow-sm">
                            <Ticket className="size-5" />
                        </div>
                        <div>
                            <p className="text-[13px] font-black text-emerald-900 tracking-tight">
                                {appliedCoupon.code} Applied
                            </p>
                            <p className="text-[10px] font-bold text-emerald-600/70 uppercase tracking-wider mt-0.5">
                                Saved ₹{appliedCoupon.discount.toFixed(0)}
                            </p>
                        </div>
                    </div>
                    <button
                        onClick={handleRemove}
                        disabled={isPending}
                        className="size-8 rounded-full hover:bg-emerald-100 flex items-center justify-center text-emerald-600 transition-colors"
                    >
                        {isPending ? <Loader2 className="size-4 animate-spin" /> : <X className="size-4" />}
                    </button>
                </div>
            ) : (
                <div className="rounded-2xl border border-zinc-100 overflow-hidden">
                    {/* WYSHKIT 2026: Always-visible coupon input (Swiggy pattern - reduce friction) */}
                    <div className="p-4 space-y-3">
                        <div className="flex items-center gap-2 text-zinc-600">
                            <Ticket className="size-4" />
                            <span className="text-xs font-bold tracking-tight">Have a coupon?</span>
                        </div>
                        <div className="flex gap-2">
                            <Input
                                placeholder="Enter code"
                                value={code}
                                onChange={(e) => setCode(e.target.value.toUpperCase())}
                                className="h-10 flex-1 rounded-xl border-zinc-200 focus:border-zinc-900 focus:ring-0 px-3 text-[13px] font-bold uppercase tracking-widest placeholder:normal-case placeholder:tracking-normal"
                                onKeyDown={(e) => e.key === 'Enter' && handleApply()}
                            />
                            <Button
                                onClick={handleApply}
                                disabled={!code || isPending}
                                className="h-10 rounded-xl px-5 bg-zinc-900 hover:bg-zinc-800 text-white text-sm font-bold shrink-0"
                            >
                                {isPending ? <Loader2 className="size-4 animate-spin" /> : 'Apply'}
                            </Button>
                        </div>
                    </div>
                </div>
            )}
        </div>
    );
}
