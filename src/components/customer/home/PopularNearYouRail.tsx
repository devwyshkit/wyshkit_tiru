'use client';

import React from 'react';
import { ItemCard } from '@/components/customer/ItemCard';
import { Sparkles } from 'lucide-react';
import { Badge } from '@/components/ui/badge';
import {
    Carousel,
    CarouselContent,
    CarouselItem,
} from "@/components/ui/carousel";

interface PopularNearYouRailProps {
    items: any[];
}

export function PopularNearYouRail({ items }: PopularNearYouRailProps) {
    if (items.length === 0) return null;

    return (
        <section className="px-4 py-12 md:px-8 border-y border-border/50 bg-background overflow-hidden relative">
            {/* Background decoration with premium micro-animation */}
            <div className="absolute top-0 right-0 p-12 opacity-[0.03] pointer-events-none animate-pulse">
                <Sparkles className="size-64 rotate-12 text-foreground" />
            </div>

            <div className="relative z-10 max-w-[1440px] mx-auto">
                <div className="flex items-center justify-between mb-10">
                    <div className="space-y-1">
                        <h2 className="text-2xl md:text-4xl font-black text-foreground uppercase tracking-tighter leading-none italic">
                            Popular <span className="text-[#D91B24]">Near You</span>
                        </h2>
                        <div className="flex items-center gap-3">
                            <Badge variant="outline" className="bg-rose-50 border-rose-100 text-[#D91B24] rounded-full py-1 px-4 flex items-center gap-2 border-none shadow-sm shadow-rose-900/5">
                                <span className="size-1.5 bg-[#D91B24] rounded-full animate-ping" />
                                <span className="text-[10px] font-black uppercase tracking-[0.2em] leading-none">Trending Neighborhood Gifts</span>
                            </Badge>
                            <span className="text-[10px] font-black text-zinc-300 uppercase tracking-widest">Wyshkit 2026 Verified</span>
                        </div>
                    </div>
                </div>

                <Carousel
                    opts={{
                        align: "start",
                        dragFree: true,
                    }}
                    className="w-full"
                >
                    <CarouselContent className="-ml-2 md:-ml-4">
                        {items.map((item) => (
                            <CarouselItem key={item.id} className="pl-2 md:pl-4 basis-[160px] md:basis-[240px]">
                                <ItemCard
                                    item={item}
                                    className="bg-card border-border/50 shadow-sm"
                                    variant="default"
                                />
                            </CarouselItem>
                        ))}
                    </CarouselContent>
                </Carousel>
            </div>
        </section>
    );
}
