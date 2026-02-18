'use client';

import React, { useState, useEffect } from 'react';
import { Sparkles, Timer } from 'lucide-react';
import { cn } from '@/lib/utils';
import { HyperlocalTimer } from '@/components/ui/HyperlocalTimer';

interface ActionBannerProps {
    personalizedItemsCount: number;
    deadline?: string;
}

export function ActionBanner({ personalizedItemsCount, deadline }: ActionBannerProps) {
    if (personalizedItemsCount === 0) return null;

    return (
        <div className="bg-amber-50 border border-amber-100 rounded-3xl p-4 mb-2 animate-in fade-in slide-in-from-top-2">
            <div className="flex items-center gap-2 mb-2">
                <Sparkles className="size-4 text-amber-500" />
                <h3 className="text-xs font-black text-amber-900 uppercase tracking-widest">Input Needed</h3>
            </div>
            <p className="text-[11px] text-amber-700 font-medium">
                You have {personalizedItemsCount} item{personalizedItemsCount > 1 ? 's' : ''} that require design details. Please scroll to the items below to submit.
            </p>
            <div className="mt-3">
                <HyperlocalTimer deadline={deadline} />
            </div>
        </div>
    );
}

function DeadlineTimer({ deadline }: { deadline?: string }) {
    const [timeLeft, setTimeLeft] = useState<string>('');
    const [isUrgent, setIsUrgent] = useState(false);

    useEffect(() => {
        if (!deadline) return;
        const target = new Date(deadline).getTime();

        const update = () => {
            const now = Date.now();
            const diff = target - now;
            if (diff <= 0) {
                setTimeLeft('EXPIRED');
                return;
            }
            const hours = Math.floor(diff / (1000 * 60 * 60));
            const mins = Math.floor((diff % (1000 * 60 * 60)) / (1000 * 60));
            const secs = Math.floor((diff % (1000 * 60)) / 1000);
            setTimeLeft(`${hours}h ${mins}m ${secs}s`);
            setIsUrgent(hours < 1);
        };

        update();
        const interval = setInterval(update, 1000);
        return () => clearInterval(interval);
    }, [deadline]);

    if (!deadline) return null;

    return (
        <div className={cn(
            "border rounded-2xl p-4 flex items-center justify-between transition-all duration-500",
            isUrgent ? "bg-rose-50 border-rose-100 shadow-[0_0_15px_rgba(225,29,72,0.1)]" : "bg-white border-amber-100"
        )}>
            <div className="flex items-center gap-3">
                <div className={cn(
                    "size-9 rounded-xl flex items-center justify-center transition-colors",
                    isUrgent ? "bg-rose-100 text-rose-600" : "bg-amber-100 text-amber-600"
                )}>
                    <Timer className={cn("size-4", isUrgent && "animate-pulse")} />
                </div>
                <div>
                    <p className={cn(
                        "text-[10px] font-black uppercase tracking-widest mb-0.5",
                        isUrgent ? "text-rose-500" : "text-amber-500"
                    )}>
                        {isUrgent ? 'Expiring Soon' : 'Submission Deadline'}
                    </p>
                    <p className={cn(
                        "text-base font-black tabular-nums leading-none",
                        isUrgent ? "text-rose-700" : "text-amber-700"
                    )}>
                        {timeLeft === 'EXPIRED' ? '00h 00m 00s' : timeLeft}
                    </p>
                </div>
            </div>
            <div className={cn(
                "text-[10px] font-bold max-w-[100px] text-right leading-tight",
                isUrgent ? "text-rose-400" : "text-amber-400"
            )}>
                Submit details before auto-cancellation
            </div>
        </div>
    );
}
