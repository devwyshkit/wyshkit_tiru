'use client';

import { useRouter } from 'next/navigation';
import { Sheet, SheetContent, SheetTitle } from "@/components/ui/sheet";
import { ItemDetailView } from '@/components/customer/item/ItemDetailView';
import { ItemWithFullSpec } from '@/lib/supabase/types';
interface InterceptedItemSheetProps {
    item: ItemWithFullSpec;
    onCloseOverride?: string;
}

export function InterceptedItemSheet({ item, onCloseOverride }: InterceptedItemSheetProps) {
    const router = useRouter();

    return (
        <Sheet
            open={true}
            onOpenChange={(open) => {
                if (!open) {
                    if (onCloseOverride) {
                        router.push(onCloseOverride);
                    } else {
                        router.back();
                    }
                }
            }}
        >
            <SheetContent
                side="bottom"
                hideClose
                className="h-[92dvh] max-h-[92dvh] rounded-t-[32px] border-x border-t border-zinc-100 overflow-hidden p-0 gap-0 md:max-w-[520px] md:left-1/2 md:right-auto md:-translate-x-1/2 flex flex-col"
            >
                <SheetTitle className="sr-only">{item.name || 'Product Details'}</SheetTitle>
                <div className="mt-4 flex justify-center">
                    <div className="h-1 w-12 rounded-full bg-zinc-200" aria-hidden />
                </div>
                <div className="flex-1 overflow-hidden relative min-h-0">
                    <ItemDetailView item={item} onBack={() => router.back()} />
                </div>
            </SheetContent>
        </Sheet>
    );
}
