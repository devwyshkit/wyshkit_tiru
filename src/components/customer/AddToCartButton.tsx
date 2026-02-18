'use client';

import { useState } from 'react';
import { useRouter } from 'next/navigation';
import { Plus, Check, Loader2 } from 'lucide-react';
import { cn } from '@/lib/utils';
import { useCart } from '@/components/customer/CartProvider';
import { toast } from 'sonner';
import { Button } from '@/components/ui/button';
import {
    AlertDialog,
    AlertDialogAction,
    AlertDialogCancel,
    AlertDialogContent,
    AlertDialogDescription,
    AlertDialogFooter,
    AlertDialogHeader,
    AlertDialogTitle,
} from '@/components/ui/alert-dialog';
import { triggerHaptic, HapticPattern } from '@/lib/utils/haptic';

interface AddToCartButtonProps {
    itemId: string;
    itemName: string;
    itemImage?: string;
    unitPrice?: number;
    partnerId?: string;
    partnerName?: string;
    isIdentityAvailable?: boolean;
    hasVariants?: boolean;
    onPersonalizeClick?: (e: React.MouseEvent) => void;
    className?: string;
}

/**
 * WYSHKIT 2026: AddToCartButton - Instant Add with Optimistic Updates
 * Swiggy 2026 Pattern: User stays where they are, cart updates instantly
 */
export function AddToCartButton({
    itemId,
    itemName,
    itemImage,
    unitPrice,
    partnerId,
    partnerName,
    isIdentityAvailable,
    hasVariants,
    onPersonalizeClick,
    className,
}: AddToCartButtonProps) {
    const router = useRouter();
    const { addToDraftOrder, clearDraftOrder, isPending } = useCart();

    const [isAdding, setIsAdding] = useState(false);
    const [justAdded, setJustAdded] = useState(false);
    const [showReplaceCartDialog, setShowReplaceCartDialog] = useState(false);
    const [pendingAdd, setPendingAdd] = useState<{ x: number; y: number } | null>(null);

    const handleQuickAdd = async (e: React.MouseEvent) => {
        e.preventDefault();
        e.stopPropagation();

        triggerHaptic(HapticPattern.ACTION);

        // WYSHKIT 2026: If item needs selection (identity addition OR variants), navigate to store sheet
        if (isIdentityAvailable || hasVariants) {
            if (partnerId) {
                // Swiggy Pattern: Intercepted by (.)item
                router.push(`/partner/${partnerId}/item/${itemId}`, { scroll: false });
            } else if (onPersonalizeClick) {
                onPersonalizeClick(e);
            }
            return;
        }

        setIsAdding(true);
        const startCoords = { x: e.clientX, y: e.clientY };

        setJustAdded(true);
        triggerHaptic(HapticPattern.SUCCESS);

        const revertTimer = setTimeout(() => setJustAdded(false), 1500);

        try {
            const optimisticData = {
                itemName: itemName || 'Item',
                itemImage: itemImage || '/images/logo.png',
                unitPrice: unitPrice || 0,
                partnerId: partnerId || undefined,
                partnerName: partnerName || undefined
            };

            const result = await addToDraftOrder(itemId, null, { enabled: false }, [], 1, optimisticData);

            if ('code' in result && result.code === 'PARTNER_MISMATCH') {
                clearTimeout(revertTimer);
                setJustAdded(false);
                triggerHaptic(HapticPattern.ERROR);
                setPendingAdd(startCoords);
                setShowReplaceCartDialog(true);
                return;
            } else if ('error' in result) {
                throw new Error(result.error);
            }
        } catch (error) {
            clearTimeout(revertTimer);
            setJustAdded(false);
            triggerHaptic(HapticPattern.ERROR);
            toast.error('Failed to add item');
        } finally {
            setIsAdding(false);
        }
    };

    const handleReplaceCart = async () => {
        setShowReplaceCartDialog(false);
        setPendingAdd(null);

        await clearDraftOrder();

        const optimisticData = { itemName, itemImage, unitPrice, partnerId, partnerName };
        const result = await addToDraftOrder(itemId, null, { enabled: false }, [], 1, optimisticData);

        if ('success' in result && result.success) {
            triggerHaptic(HapticPattern.SUCCESS);
            setJustAdded(true);
            setTimeout(() => setJustAdded(false), 1500);
        } else if ('error' in result) {
            toast.error(result.error ?? 'Failed to add item');
        }
    };

    return (
        <>
            <AlertDialog open={showReplaceCartDialog} onOpenChange={setShowReplaceCartDialog}>
                <AlertDialogContent>
                    <AlertDialogHeader>
                        <AlertDialogTitle>Different store</AlertDialogTitle>
                        <AlertDialogDescription>
                            Your cart has items from another store. To add from this store, start a new cart. Your current cart will be cleared.
                        </AlertDialogDescription>
                    </AlertDialogHeader>
                    <AlertDialogFooter>
                        <AlertDialogCancel>Keep current cart</AlertDialogCancel>
                        <AlertDialogAction onClick={handleReplaceCart}>
                            Start new cart & add
                        </AlertDialogAction>
                    </AlertDialogFooter>
                </AlertDialogContent>
            </AlertDialog>
            <Button
                size="icon"
                onClick={handleQuickAdd}
                aria-label={`Add ${itemName} to cart`}
                disabled={isAdding || isPending}
                className={cn(
                    "size-8 rounded-xl transition-all z-10",
                    justAdded
                        ? "bg-emerald-500 text-white hover:bg-emerald-600"
                        : "bg-white text-zinc-900 hover:bg-zinc-100 shadow-sm border border-zinc-100",
                    "active:scale-95",
                    className
                )}
            >
                {isAdding ? (
                    <Loader2 className="size-4 animate-spin" />
                ) : justAdded ? (
                    <Check className="size-4" />
                ) : (
                    <Plus className="size-4" />
                )}
            </Button>
        </>
    );
}
