'use client';

import { PersonalizationForm } from "@/components/customer/orders/PersonalizationForm";
import { useRouter } from "next/navigation";
import { toast } from "sonner";

export function ClientWrapper({ order }: { order: any }) {
    const router = useRouter();

    return (
        <PersonalizationForm
            order={order}
            onSubmitted={() => {
                toast.success("Details sent to partner!");
                router.push(`/orders/${order.id}`);
                router.refresh();
            }}
        />
    );
}
