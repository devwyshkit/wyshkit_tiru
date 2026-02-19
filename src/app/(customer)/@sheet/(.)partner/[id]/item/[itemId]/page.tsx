import { Suspense } from 'react';
import { notFound } from 'next/navigation';
import { InterceptedItemSheet } from '@/components/customer/item/InterceptedItemSheet';
import { WyshkitItem } from '@/lib/types/item';
import { getPartnerStoreData } from '@/lib/actions/discovery';

/**
 * WYSHKIT 2026: Intercepted Item Route
 * Path: /partner/[id]/item/[itemId]
 * 
 * Swiggy 2026 Pattern: Immersive Store Context
 * Effectively an "atomic overlay" that preserves the background partner store.
 */
export default async function InterceptedItemPage({
    params,
}: {
    params: Promise<{ id: string; itemId: string }>;
}) {
    const { id, itemId } = await params;

    // Fetch partner data to get the specific item details for the sheet
    const { items, error } = await getPartnerStoreData(id);

    const item = items?.find(i => String(i.id) === itemId);

    if (!item || error) {
        return null; // Return null so RouteSlotGuard doesn't fail, or handle as needed
    }

    return (
        <InterceptedItemSheet
            item={item as WyshkitItem}
            onCloseOverride={`/partner/${id}`}
        />
    );
}
