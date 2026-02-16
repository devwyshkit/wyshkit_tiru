'use client';

import React, { useState, useEffect, useRef, useCallback } from 'react';
import { ItemCard } from '@/components/customer/ItemCard';
import { Sparkles, Loader2 } from 'lucide-react';
import { getFilteredItems } from '@/lib/actions/item-actions';
import { logger } from '@/lib/logging/logger';

interface InfiniteItemsGridProps {
    initialItems: any[];
    category: string | null;
    categoryName?: string | null;
    startOffset?: number;
    /** Swiggy pattern: after add, navigate to store with item sheet open */
    navigateToStoreOnAdd?: boolean;
}

export function InfiniteItemsGrid({
    initialItems,
    category,
    categoryName,
    startOffset = 0,
    navigateToStoreOnAdd = false
}: InfiniteItemsGridProps) {
    const [items, setItems] = useState(initialItems);
    const [hasMore, setHasMore] = useState(true); // Default to true if used in discovery flow
    const [isLoadingMore, setIsLoadingMore] = useState(false);
    const loaderRef = useRef<HTMLDivElement>(null);
    const pageRef = useRef(startOffset > 0 ? Math.ceil(startOffset / 12) : 0);

    // Reset state when category changes
    useEffect(() => {
        setItems(initialItems);
        // If we have initial items from props, check length. If not, assume more might exist
        setHasMore(initialItems.length > 0 ? initialItems.length >= 12 : true);
        pageRef.current = startOffset > 0 ? Math.ceil(startOffset / 12) : 0;
    }, [initialItems, category, startOffset]);

    const loadMore = useCallback(async () => {
        if (isLoadingMore || !hasMore) return;

        setIsLoadingMore(true);
        const limit = 12;
        // If we started with an offset, current page is already calculated
        const offset = (pageRef.current + 1) * limit;

        try {
            const res = await getFilteredItems({
                limit,
                offset,
                category: category || undefined
            });

            if (res.data?.items && res.data.items.length > 0) {
                setItems(prev => [...prev, ...res.data!.items]);
                setHasMore(res.data.items.length === limit);
                pageRef.current += 1;
            } else {
                setHasMore(false);
            }
        } catch (error) {
            logger.error('Failed to load more items in InfiniteItemsGrid', error, { category, page: pageRef.current });
            setHasMore(false);
        } finally {
            setIsLoadingMore(false);
        }
    }, [category, hasMore, isLoadingMore]);

    useEffect(() => {
        const observer = new IntersectionObserver(
            (entries) => {
                if (entries[0].isIntersecting && hasMore && !isLoadingMore) {
                    loadMore();
                }
            },
            { threshold: 0.1, rootMargin: '100px' }
        );

        if (loaderRef.current) {
            observer.observe(loaderRef.current);
        }

        return () => observer.disconnect();
    }, [hasMore, isLoadingMore, loadMore]);

    return (
        <>
            {/* Additional items rendered as they are loaded */}
            {items.map((item, index) => (
                <ItemCard
                    key={`${item.id}-${index}`}
                    item={item}
                    navigateToStoreOnAdd={navigateToStoreOnAdd}
                />
            ))}

            {/* Infinite Scroll Loader - scoped to parent grid if needed, or just full width */}
            <div ref={loaderRef} className="col-span-full mt-16 flex justify-center py-8">
                {isLoadingMore ? (
                    <div className="flex flex-col items-center gap-3">
                        <Loader2 className="size-6 text-[#D91B24] animate-spin" />
                        <p className="text-xs text-zinc-400">Loading more...</p>
                    </div>
                ) : !hasMore && (items.length > 0 || startOffset > 0) ? (
                    <div className="flex flex-col items-center gap-3 opacity-30">
                        <Sparkles className="size-5 text-zinc-400" />
                        <p className="text-xs text-zinc-400">That's all for now</p>
                    </div>
                ) : null}
            </div>
        </>
    );
}
