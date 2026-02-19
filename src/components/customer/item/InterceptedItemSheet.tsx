'use client';

import { useRouter, useSearchParams } from 'next/navigation';
import { Sheet, SheetContent, SheetTitle, SheetDescription } from "@/components/ui/sheet";
import { ItemDetailView } from '@/components/customer/item/ItemDetailView';
import { WyshkitItem } from '@/lib/types/item';
interface InterceptedItemSheetProps {
    item: WyshkitItem;
    onCloseOverride?: string;
}

export function InterceptedItemSheet({ item, onCloseOverride }: InterceptedItemSheetProps) {
    const router = useRouter();
    const searchParams = useSearchParams();
    const isFromSearch = searchParams.get('context') === 'search';

    const handleClose = () => {
        if (onCloseOverride) {
            router.push(onCloseOverride);
        } else {
            router.back();
        }
    };

    const isEditMode = searchParams.get('edit') === 'true';
    const cartItemId = searchParams.get('cartItemId');
    const variantId = searchParams.get('variantId');
    const quantity = parseInt(searchParams.get('quantity') || '1');
    const addonIds = searchParams.get('addons')?.split(',').filter(Boolean) || [];

    const initialState = isEditMode && cartItemId ? {
        cartItemId,
        variantId: variantId || null,
        quantity,
        addonIds
    } : undefined;

    return (
        <Sheet
            open={true}
            onOpenChange={(open) => {
                if (!open) handleClose();
            }}
        >
            <SheetContent
                side="bottom"
                hideClose
                className="h-[92dvh] max-h-[92dvh] rounded-t-[32px] border-x border-t border-zinc-100 overflow-hidden p-0 gap-0 md:max-w-[520px] md:left-1/2 md:right-auto md:-translate-x-1/2 flex flex-col"
            >
                <SheetTitle className="sr-only">{item.name || 'Product Details'}</SheetTitle>
                <SheetDescription className="sr-only">
                    View details and add {item.name || 'this item'} to your cart.
                </SheetDescription>
                <div className="mt-4 flex justify-center">
                    <div className="h-1 w-12 rounded-full bg-zinc-200" aria-hidden />
                </div>
                <div className="flex-1 overflow-hidden relative min-h-0">
                    <ItemDetailView
                        item={item}
                        onBack={handleClose}
                        initialState={initialState}
                    />
                </div>
            </SheetContent>
        </Sheet>
    );
}
