import React from 'react';
import { Sparkles } from 'lucide-react';
import { InfiniteItemsGrid } from './InfiniteItemsGrid';
import { ItemCard } from '@/components/customer/ItemCard';

interface DiscoveryItemsGridProps {
    initialItems: any[];
    category: string | null;
    categoryName?: string | null;
}

/**
 * WYSHKIT 2026: Server-First Discovery Grid
 * - Initial render happens on server for LCP optimization
 * - Infinite scroll handled by InfiniteItemsGrid (Client Component)
 */
export function DiscoveryItemsGrid({
    initialItems,
    category,
    categoryName
}: DiscoveryItemsGridProps) {
    if (initialItems.length === 0) {
        return (
            <div className="flex flex-col items-center justify-center py-16 px-4">
                <div className="size-16 rounded-full bg-zinc-100 flex items-center justify-center mb-4">
                    <Sparkles className="size-6 text-zinc-300" />
                </div>
                <p className="text-sm text-zinc-500 text-center">No items found in this area</p>
            </div>
        );
    }

    return (
        <section className="px-4 py-6 md:px-8 slide-in-from-bottom-2 [animation-delay:0.15s]">
            <div className="flex flex-col mb-8">
                <h2 className="text-lg md:text-xl font-semibold text-zinc-900 capitalize">
                    {categoryName || 'Trending items'}
                </h2>
                <p className="text-xs text-zinc-500 mt-0.5">
                    {categoryName ? `${initialItems.length} items found` : 'Popular in your area'}
                </p>
            </div>

            {/* WYSHKIT 2026: Server-First - Initial items rendered on server with staggered entrance */}
            <div className="grid grid-cols-2 lg:grid-cols-4 gap-4 md:gap-8">
                {initialItems.map((item: any, index: number) => (
                    <div
                        key={item.id}
                        className="slide-in-from-bottom-2"
                        style={{ animationDelay: `${index * 0.05}s` }}
                    >
                        <ItemCard
                            item={item}
                            priority={index < 4}
                            navigateToStoreOnAdd
                        />
                    </div>
                ))}

                {/* Client component picks up for infinite scroll */}
                <InfiniteItemsGrid
                    initialItems={[]}
                    category={category}
                    categoryName={categoryName}
                    startOffset={initialItems.length}
                    navigateToStoreOnAdd
                />
            </div>
        </section>
    );
}
