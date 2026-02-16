'use client';

import { AuthPageClient } from "@/components/auth/AuthPageClient";
import { Sheet, SheetContent, SheetTitle } from "@/components/ui/sheet";
import { useRouter, useSearchParams } from "next/navigation";
import { Suspense } from 'react';
import { Loader2 } from 'lucide-react';
import { ModalHeader } from "@/components/ui/ModalHeader";

export function InterceptedAuthClient() {
    const router = useRouter();
    return (
        <Sheet
            open={true}
            onOpenChange={(open) => {
                if (!open) {
                    router.back();
                }
            }}
        >
            <SheetContent
                side="bottom"
                hideClose
                className="h-auto max-h-[85dvh] rounded-t-[32px] border-x border-t border-zinc-100 p-0 gap-0 flex flex-col"
            >
                <SheetTitle className="sr-only">Authentication</SheetTitle>

                <div className="pt-2 pb-4 flex justify-center shrink-0">
                    <div className="h-1.5 w-12 rounded-full bg-zinc-200" aria-hidden />
                </div>

                <div className="flex-1 overflow-y-auto relative outline-none">
                    <div className="flex flex-col min-h-full">
                        <Suspense fallback={
                            <div className="flex items-center justify-center py-20">
                                <Loader2 className="size-6 animate-spin text-zinc-400" />
                            </div>
                        }>
                            <AuthContent />
                        </Suspense>
                    </div>
                </div>
            </SheetContent>
        </Sheet>
    );
}

function AuthContent() {
    const searchParams = useSearchParams();
    const intent = searchParams.get('intent') || 'signin';
    const returnUrl = searchParams.get('returnUrl') || '/';

    return <AuthPageClient intent={intent} returnUrl={returnUrl} hideHeader hideBack />;
}
