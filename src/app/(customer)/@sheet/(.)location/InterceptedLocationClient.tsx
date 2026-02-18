'use client';

import { LocationSheet } from "@/components/customer/LocationSheet";
import { Sheet, SheetContent, SheetTitle } from "@/components/ui/sheet";
import { useRouter } from "next/navigation";
import { ModalHeader } from "@/components/ui/ModalHeader";

export function InterceptedLocationClient() {
    const router = useRouter();

    return (
        <Sheet
            open={true}
            onOpenChange={(open) => {
                if (!open) window.history.back();
            }}
        >
            <SheetContent
                side="bottom"
                hideClose
                className="h-auto max-h-[85dvh] rounded-t-[32px] border-x border-t border-zinc-100 overflow-hidden p-0 gap-0 flex flex-col"
            >
                <SheetTitle className="sr-only">Delivery Location</SheetTitle>
                <ModalHeader title="Delivery Location" />
                <div className="flex-1 overflow-hidden relative min-h-0">
                    <LocationSheet isRouteContext={false} onSelect={() => router.back()} />
                </div>
            </SheetContent>
        </Sheet>
    );
}
