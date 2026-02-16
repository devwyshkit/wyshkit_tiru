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
    partnerId?: string; // WYSHKIT 2026: Add partnerId prop (Swiggy 2026 pattern)
    partnerName?: string; // WYSHKIT 2026: Pass from parent - no getItemDetails fetch (perf)
    isPersonalizable?: boolean;
    hasVariants?: boolean;
    onPersonalizeClick?: (e: React.MouseEvent) => void;
    /** Swiggy pattern: after add from homepage, navigate to store with item sheet open */
    onAfterAdd?: (partnerId: string | undefined, itemId: string) => void;
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
    isPersonalizable,
    hasVariants,
    onPersonalizeClick,
    onAfterAdd,
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

        // WYSHKIT 2026: If item needs selection (personalization OR variants), open store sheet
        if ((isPersonalizable || hasVariants)) {
            if (partnerId) {
                // WYSHKIT 2026: Use router.push for seamless transition (Sheet opens via searchParam)
                // Swiggy Pattern: No full page reload
                router.push(`/partner/${partnerId}?item=${itemId}`, { scroll: false });
            } else if (onPersonalizeClick) {
                onPersonalizeClick(e);
            }
            return;
        }

        setIsAdding(true);

        // WYSHKIT 2026: Fluid Physics - Immediate Feedback
        // Animation triggers INSTANTLY, does not wait for server
        // This decouples "feel" from "network latency"
        const startCoords = { x: e.clientX, y: e.clientY };

        // optimistic UI updates
        setJustAdded(true);
        triggerHaptic(HapticPattern.SUCCESS);

        // Revert timer
        const revertTimer = setTimeout(() => setJustAdded(false), 1500);

        try {
            // WYSHKIT 2026: Use partnerName from props - no getItemDetails fetch (Swiggy 2026 perf)
            // Type-safe optimistic data with fallbacks
            const optimisticData = {
                itemName: itemName || 'Item',
                itemImage: itemImage || '/images/logo.png',
                unitPrice: unitPrice || 0,
                partnerId: partnerId || undefined,
                partnerName: partnerName || undefined
            };

            const result = await addToDraftOrder(itemId, null, { enabled: false }, [], 1, optimisticData);

            if ('code' in result && result.code === 'PARTNER_MISMATCH') {
                // Formatting Rollback
                clearTimeout(revertTimer);
                setJustAdded(false);
                triggerHaptic(HapticPattern.ERROR);
                setPendingAdd(startCoords);
                setShowReplaceCartDialog(true);
                return;
            } else if ('error' in result) {
                throw new Error(result.error);
            }

            // WYSHKIT 2026: Animation + Badge pulse is sufficient feedback (Swiggy 2026 pattern)
            // No redundant toast for happy path to keep UI clean
            // Swiggy pattern: from discovery, navigate to store with item sheet open
            if (onAfterAdd && partnerId) {
                onAfterAdd(partnerId, itemId);
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
        const coords = pendingAdd ?? { x: 0, y: 0 };
        setPendingAdd(null);
        await clearDraftOrder();

        // WYSHKIT 2026: Use partnerName from props - no getItemDetails fetch (Swiggy 2026 perf)
        const optimisticData = { itemName, itemImage, unitPrice, partnerId, partnerName };
        const result = await addToDraftOrder(itemId, null, { enabled: false }, [], 1, optimisticData);
        if ('success' in result && result.success) {
            triggerHaptic(HapticPattern.SUCCESS);
            if (onAfterAdd && partnerId) {
                onAfterAdd(partnerId, itemId);
            }
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
