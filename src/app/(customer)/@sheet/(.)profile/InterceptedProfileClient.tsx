'use client';

import { ProfilePage } from '@/components/customer/ProfilePage';
import { Sheet, SheetContent, SheetTitle } from "@/components/ui/sheet";
import { Suspense } from 'react';
import { Loader2 } from 'lucide-react';
import { useSearchParams } from 'next/navigation';
import { ModalHeader } from "@/components/ui/ModalHeader";

/**
 * Profile sheet for intercepted /profile navigation (same pattern as auth, location)
 */
export function InterceptedProfileClient() {
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
                <SheetTitle className="sr-only">Your Profile</SheetTitle>
                <ModalHeader title="Profile" />
                <div className="flex-1 overflow-hidden relative min-h-0">
                    <Suspense fallback={
                        <div className="flex items-center justify-center h-full">
                            <Loader2 className="size-6 animate-spin text-zinc-400" />
                        </div>
                    }>
                        <ProfilePageContent />
                    </Suspense>
                </div>
            </SheetContent>
        </Sheet>
    );
}

function ProfilePageContent() {
    const searchParams = useSearchParams();
    const tab = searchParams.get('tab') as 'account' | 'orders' | 'addresses' | 'settings' | null;
    const action = searchParams.get('action');

    return <ProfilePage initialTab={tab || undefined} initialAction={action || undefined} />;
}
