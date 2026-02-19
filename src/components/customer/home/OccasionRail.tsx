'use client';

import React from 'react';
import Link from 'next/link';
import { Cake, Heart, Gift, PartyPopper, Sparkles, Star } from 'lucide-react';
import { cn } from '@/lib/utils';
import { triggerHaptic, HapticPattern } from '@/lib/utils/haptic';

const occasions = [
    {
        name: 'Birthdays',
        slug: 'birthdays',
        icon: Cake,
        color: 'from-rose-400 to-rose-600',
        shadow: 'shadow-rose-500/20'
    },
    {
        name: 'Anniversary',
        slug: 'anniversary',
        icon: Heart,
        color: 'from-pink-500 to-rose-600',
        shadow: 'shadow-pink-500/20'
    },
    {
        name: 'Surprise',
        slug: 'hampers',
        icon: PartyPopper,
        color: 'from-indigo-400 to-indigo-600',
        shadow: 'shadow-indigo-500/20'
    },
    {
        name: 'Premium',
        slug: 'personalized',
        icon: Star,
        color: 'from-amber-400 to-amber-600',
        shadow: 'shadow-amber-500/20'
    },
    {
        name: 'Just Like That',
        slug: 'cakes',
        icon: Gift,
        color: 'from-emerald-400 to-emerald-600',
        shadow: 'shadow-emerald-500/20'
    },
];

export function OccasionRail() {
    return (
        <section className="px-4 py-12 md:px-8 max-w-[1440px] mx-auto">
            <div className="flex items-center justify-between mb-10">
                <div>
                    <h2 className="text-2xl md:text-3xl font-black text-zinc-950 uppercase tracking-tighter leading-none">
                        Shop by Occasion
                    </h2>
                    <p className="text-[10px] font-black text-zinc-950 uppercase tracking-widest mt-2 px-1 border-l-2 border-[var(--primary)]">
                        Curated for your special moments
                    </p>
                </div>
            </div>

            <div className="flex gap-6 md:gap-12 overflow-x-auto no-scrollbar -mx-4 px-4 py-4">
                {occasions.map((occ) => (
                    <Link
                        key={occ.slug}
                        href={`/search?category=${occ.slug}`}
                        onClick={() => triggerHaptic(HapticPattern.ACTION)}
                        className="group flex flex-col items-center gap-4 shrink-0"
                    >
                        <div className={cn(
                            "relative size-20 md:size-28 flex items-center justify-center transition-all duration-300 group-hover:-translate-y-2",
                        )}>
                            {/* Decorative Ring */}
                            <div className="absolute inset-0 rounded-[32px] md:rounded-[40px] border-2 border-zinc-100 group-hover:border-zinc-900/10 group-hover:rotate-12 transition-all duration-500" />

                            {/* Icon Container */}
                            <div className={cn(
                                "relative size-16 md:size-20 rounded-[28px] md:rounded-[34px] bg-gradient-to-br flex items-center justify-center transition-all duration-300",
                                occ.color,
                                occ.shadow,
                                "group-hover:rounded-[20px] shadow-xl"
                            )}>
                                <occ.icon className="size-8 md:size-10 text-white stroke-[2.5]" />

                                {/* Micro-interaction spark */}
                                <Sparkles className="absolute -top-1 -right-1 size-4 text-white opacity-0 group-hover:opacity-100 transition-opacity" />
                            </div>
                        </div>

                        <div className="text-center">
                            <span className="text-[11px] md:text-[13px] font-black uppercase tracking-tighter text-zinc-900 block lg:tracking-tight">
                                {occ.name}
                            </span>
                            <span className="text-[9px] font-bold text-zinc-400 uppercase tracking-widest block mt-0.5 opacity-0 group-hover:opacity-100 transition-opacity">
                                Explore
                            </span>
                        </div>
                    </Link>
                ))}
            </div>
        </section>
    );
}
