import Link from 'next/link';
import { cn } from '@/lib/utils';
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
    // WYSHKIT 2026: Zero-Reflection - Hide out-of-stock items entirely
    const filteredItems = initialItems.filter(item =>
        item.stock_status !== 'out_of_stock' &&
        (typeof item.stock_quantity !== 'number' || item.stock_quantity > 0)
    );

    if (filteredItems.length === 0) {
        return (
            <div className="flex flex-col items-center justify-center py-16 px-4">
                <div className="size-16 rounded-full bg-zinc-100 flex items-center justify-center mb-4">
                    <Sparkles className="size-6 text-zinc-300" />
                </div>
                <p className="text-sm text-zinc-500 text-center">No items currently available</p>
            </div>
        );
    }

    // WYSHKIT 2026: One Vendor, One Card Principle
    // Group filtered items by partner to prevent repetitive vendor cards
    const groupedByPartner = filteredItems.reduce((acc: Record<string, { partnerName: string, items: any[] }>, item) => {
        const pId = item.partner_id || 'unknown';
        if (!acc[pId]) acc[pId] = { partnerName: item.partner_name, items: [] };
        acc[pId].items.push(item);
        return acc;
    }, {});

    const partnerEntries = Object.entries(groupedByPartner);

    return (
        <section className="px-4 py-6 md:px-8 slide-in-from-bottom-2 [animation-delay:0.15s]">
            <div className="flex flex-col mb-8">
                <h2 className="text-lg md:text-xl font-semibold text-zinc-900 capitalize">
                    {categoryName || 'Trending items'}
                </h2>
                <p className="text-xs text-zinc-500 mt-0.5">
                    {categoryName ? `${partnerEntries.length} stores found` : 'Popular in your area'}
                </p>
            </div>

            {/* WYSHKIT 2026: Vendor-Centric Discovery Grid */}
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6 md:gap-10">
                {partnerEntries.map(([pId, group], index: number) => (
                    <div
                        key={pId}
                        className="p-4 bg-zinc-50/50 rounded-[32px] border border-zinc-100 hover:bg-white hover:shadow-xl hover:shadow-zinc-200/40 transition-all duration-500 group"
                        style={{ animationDelay: `${index * 0.05}s` }}
                    >
                        {/* Vendor Context */}
                        <div className="flex items-center justify-between mb-4 px-1">
                            <div>
                                <h3 className="text-[13px] font-black text-zinc-950 uppercase tracking-tight group-hover:text-[var(--primary)] transition-colors">
                                    {group.partnerName || 'Local Store'}
                                </h3>
                                <p className="text-[9px] font-bold text-zinc-400 uppercase tracking-widest mt-0.5">
                                    {group.items.length} {group.items.length === 1 ? 'Item' : 'Items'} available
                                </p>
                            </div>
                            <Link
                                href={`/partner/${pId}`}
                                className="text-[9px] font-black text-zinc-400 uppercase tracking-widest hover:text-zinc-950 transition-colors bg-white px-2 py-1 rounded-md border border-zinc-100 shadow-sm"
                            >
                                Visit Store
                            </Link>
                        </div>

                        {/* Items Sub-Grid */}
                        <div className={cn(
                            "grid gap-3",
                            group.items.length === 1 ? "grid-cols-1" : "grid-cols-2"
                        )}>
                            {group.items.slice(0, 4).map((item) => (
                                <ItemCard
                                    key={item.id}
                                    item={item}
                                    variant="default"
                                    className="bg-white"
                                />
                            ))}
                        </div>
                    </div>
                ))}

                {/* Client component picks up for infinite scroll */}
                <InfiniteItemsGrid
                    initialItems={[]}
                    category={category}
                    categoryName={categoryName}
                    startOffset={filteredItems.length}
                />
            </div>
        </section>
    );
}
