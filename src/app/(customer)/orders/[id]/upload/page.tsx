import { createClient } from "@/lib/supabase/server";
import { redirect, notFound } from "next/navigation";
import { getOrderWithHistory } from "@/lib/actions/orders";
import { ChevronLeft } from "lucide-react";
import Link from "next/link";
import { ClientWrapper } from "./ClientWrapper";

export default async function UploadPage({
    params,
}: {
    params: Promise<{ id: string }>;
}) {
    const { id } = await params;
    const supabase = await createClient();
    const { data: { user } } = await supabase.auth.getUser();

    if (!user) {
        redirect(`/auth?intent=signin&returnUrl=/orders/${id}/upload`);
    }

    const { order, error } = await getOrderWithHistory(id);

    if (error || !order) {
        notFound();
    }

    // Security check
    if (order.user_id !== user.id) {
        redirect('/orders');
    }

    // If already submitted, redirect back to tracker
    const isSubmitted = order.personalization_status === 'submitted' ||
        ['PREVIEW_READY', 'APPROVED', 'IN_PRODUCTION', 'PACKED', 'DISPATCHED', 'DELIVERED'].includes(order.status);

    if (isSubmitted) {
        redirect(`/orders/${id}`);
    }

    return (
        <div className="min-h-screen bg-white">
            <header className="sticky top-0 z-10 bg-white/80 backdrop-blur-md border-b border-zinc-100 px-4 h-14 flex items-center gap-3">
                <Link href={`/orders/${id}`} className="size-10 flex items-center justify-center -ml-2 text-zinc-600">
                    <ChevronLeft className="size-6" />
                </Link>
                <div>
                    <h1 className="text-sm font-bold text-zinc-900">Personalize Order</h1>
                    <p className="text-[10px] text-zinc-500">#{order.orderNumber}</p>
                </div>
            </header>

            <main className="max-w-md mx-auto p-4 pb-20">
                <div className="mb-6">
                    <h2 className="text-xl font-black text-zinc-900 tracking-tight mb-2">Let's create your design</h2>
                    <p className="text-sm text-zinc-500 leading-relaxed">
                        Our partner needs a few details to get started. Please provide text, images, or instructions below.
                    </p>
                </div>

                <ClientWrapper order={order} />
            </main>
        </div>
    );
}
