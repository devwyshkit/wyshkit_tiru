"use client";

import React, { createContext, useContext, useState, useEffect, useTransition, useOptimistic } from "react";
import { Cart, SelectedPersonalization } from "@/lib/types/cart";
import { useAuth } from "@/hooks/useAuth";
import * as draftOrderActions from "@/lib/actions/draft-order";
import { createClient } from "@/lib/supabase/client";
import { logger } from "@/lib/logging/logger";

interface CartContextType {
    draftOrder: Cart;
    loading: boolean;
    isPending: boolean;
    isGuest: boolean;
    addToDraftOrder: (
        itemId: string,
        variantId: string | null,
        personalization: SelectedPersonalization,
        selectedAddons?: any[],
        quantity?: number,
        optimisticData?: { itemName?: string; itemImage?: string; unitPrice?: number; partnerId?: string; partnerName?: string }
    ) => Promise<any>;
    removeFromDraftOrder: (itemId: string, variantId?: string | null) => Promise<void>;
    updateQuantity: (itemId: string, variantId: string | null, quantity: number) => Promise<void>;
    clearDraftOrder: () => Promise<void>;
    refreshDraftOrder: () => Promise<Cart | null>;
}

const CartContext = createContext<CartContextType | null>(null);

export function useCart() {
    const context = useContext(CartContext);
    if (!context) throw new Error("useCart must be used within a CartProvider");
    return context;
}

/**
 * WYSHKIT 2026: CartProvider (Singleton State)
 * 
 * Swiggy 2026 Pattern: One Source of Truth
 * - Shared state across Home, Product, and Checkout screens
 * - Eliminates 'disconnect feel' by ensuring all UI segments update simultaneously
 * - Handles optimistic updates and server synchronization
 */
export function CartProvider({
    children,
    initialCart,
    guestSessionId = null,
}: {
    children: React.ReactNode,
    initialCart?: Cart,
    /** For guests: scope realtime to this session only (no global leak). */
    guestSessionId?: string | null
}) {
    const { user, loading: authLoading } = useAuth();
    const [draftOrder, setDraftOrder] = useState<Cart>(initialCart || { items: [], partnerId: null, subtotal: 0, total: 0, itemCount: 0 });
    const [loading, setLoading] = useState(!initialCart);
    const [isPending, startTransition] = useTransition();

    // WYSHKIT 2026: Optimistic cart updates (Section 3 Pattern 3)
    const [optimisticCart, addOptimisticCart] = useOptimistic(
        draftOrder,
        (state: Cart, newItem: { itemId: string; variantId: string | null; personalization: SelectedPersonalization; selectedAddons?: any[]; quantity: number; itemName?: string; itemImage?: string; unitPrice?: number; partnerId?: string; partnerName?: string }) => {

            // Generate keys for robust matching
            const newItemAddonsKey = (newItem.selectedAddons || []).map(a => a.id).sort().join(',');

            const existingItemIndex = state.items.findIndex(
                i => i.itemId === newItem.itemId &&
                    (i.selectedVariantId ?? null) === newItem.variantId &&
                    ((i.selectedAddons || []).map(a => a.id).sort().join(',') === newItemAddonsKey)
            );

            let newItems;
            if (existingItemIndex >= 0) {
                newItems = state.items.map((item, idx) =>
                    idx === existingItemIndex
                        ? { ...item, quantity: item.quantity + newItem.quantity, totalPrice: (item.unitPrice || 0) * (item.quantity + newItem.quantity) }
                        : item
                );
            } else {
                const tempId = `optimistic-${newItem.itemId}-${newItem.variantId || 'base'}-${Date.now()}`;
                newItems = [
                    ...state.items,
                    {
                        id: tempId,
                        itemId: newItem.itemId,
                        itemName: newItem.itemName || 'Loading...',
                        itemImage: newItem.itemImage || '/images/logo.png',
                        quantity: newItem.quantity,
                        unitPrice: newItem.unitPrice || 0,
                        totalPrice: (newItem.unitPrice || 0) * newItem.quantity,
                        selectedVariantId: newItem.variantId,
                        personalization: newItem.personalization,
                        selectedAddons: newItem.selectedAddons, // Add this
                        partnerName: newItem.partnerName,
                    },
                ];
            }

            const newItemCount = newItems.reduce((sum, i) => sum + i.quantity, 0);
            const newSubtotal = newItems.reduce((sum, i) => sum + i.totalPrice, 0);

            // WYSHKIT 2026: Preserve partnerId in optimistic updates
            const newPartnerId = newItem.partnerId || state.partnerId;

            return {
                ...state,
                items: newItems,
                itemCount: newItemCount,
                subtotal: newSubtotal,
                total: newSubtotal,
                partnerId: newPartnerId,
            };
        }
    );

    const fetchDraftOrder = async (): Promise<Cart | null> => {
        try {
            const result = await draftOrderActions.getCart();
            const cart = result.error ? { items: [], partnerId: null, subtotal: 0, total: 0, itemCount: 0 } : result.cart ?? { items: [], partnerId: null, subtotal: 0, total: 0, itemCount: 0 };
            startTransition(() => setDraftOrder(cart));
            return result.cart ?? null;
        } catch {
            startTransition(() => setDraftOrder({ items: [], partnerId: null, subtotal: 0, total: 0, itemCount: 0 }));
            return null;
        } finally {
            setLoading(false);
        }
    };

    // WYSHKIT 2026: Removed initial fetch useEffect. 
    // Now hydrated via Page Server Component to prevent waterfalls.


    // WYSHKIT 2026: Anti-Zombie Mechanism (Mutation Dominance)
    // Track the time of the last user action and the ID of the last mutation
    const lastActionTimeRef = React.useRef<number>(0);
    const isMutatingRef = React.useRef<boolean>(false);

    // WYSHKIT 2026: Realtime Sync (Section 4 Pattern 4)
    // Supabase is the Single Source of Truth (SSOT)
    // Filter by user_id (logged-in) or session_id (guest) so we never listen to all users' carts.
    useEffect(() => {
        if (authLoading) return;

        const filter = user
            ? `user_id=eq.${user.id}`
            : guestSessionId
                ? `session_id=eq.${guestSessionId}`
                : null;
        if (filter === null) return;

        const supabase = createClient();
        const channel = supabase
            .channel('cart_updates')
            .on(
                'postgres_changes',
                {
                    event: '*',
                    schema: 'public',
                    table: 'cart_items',
                    filter,
                },
                () => {
                    const timeSinceLastAction = Date.now() - lastActionTimeRef.current;
                    if (isMutatingRef.current || timeSinceLastAction < 3000) return;
                    fetchDraftOrder();
                }
            )
            .subscribe();

        return () => {
            supabase.removeChannel(channel);
        };
    }, [user, authLoading, guestSessionId]);

    const addToDraftOrder = async (
        itemId: string,
        variantId: string | null,
        personalization: SelectedPersonalization,
        selectedAddons?: any[],
        quantity: number = 1,
        optimisticData?: { itemName?: string; itemImage?: string; unitPrice?: number; partnerId?: string; partnerName?: string }
    ) => {
        lastActionTimeRef.current = Date.now();
        isMutatingRef.current = true; // WYSHKIT 2026: Lock realtime

        if (optimisticData) {
            startTransition(() => {
                addOptimisticCart({
                    itemId,
                    variantId,
                    personalization,
                    selectedAddons, // Add this
                    quantity,
                    ...optimisticData,
                });
            });
        }

        try {
            const result = await draftOrderActions.addToCart({ itemId, variantId, personalization, selectedAddons, quantity });
            const cart = (result as { cart?: Cart })?.cart;
            if (cart && !('error' in result)) {
                startTransition(() => setDraftOrder(cart));
            } else if (!('code' in result)) {
                await fetchDraftOrder();
            }
            return result;
        } finally {
            isMutatingRef.current = false; // Unlock
        }
    };

    const removeFromDraftOrder = async (itemId: string, variantId?: string | null) => {
        lastActionTimeRef.current = Date.now();
        isMutatingRef.current = true;

        const normalizedVariantId = variantId ?? null;
        const cartItem = draftOrder.items.find(
            i => i.itemId === itemId && (i.selectedVariantId ?? null) === normalizedVariantId
        );
        if (!cartItem) {
            isMutatingRef.current = false;
            return;
        }

        startTransition(async () => {
            try {
                const result = await draftOrderActions.removeCartItem(cartItem.id);
                if ((result as any).cart) {
                    setDraftOrder((result as any).cart);
                } else {
                    await fetchDraftOrder();
                }
            } catch (err) {
                logger.error('CartProvider remove failed', err as Error);
                await fetchDraftOrder();
            } finally {
                isMutatingRef.current = false;
            }
        });
    };

    const updateQuantity = async (itemId: string, variantId: string | null, quantity: number) => {
        lastActionTimeRef.current = Date.now();
        isMutatingRef.current = true;

        const normalizedVariantId = variantId ?? null;
        const cartItem = draftOrder.items.find(
            i => i.itemId === itemId && (i.selectedVariantId ?? null) === normalizedVariantId
        );
        if (!cartItem) {
            isMutatingRef.current = false;
            return;
        }

        startTransition(async () => {
            try {
                const result = await draftOrderActions.updateCartItemQuantity(cartItem.id, quantity);
                if ((result as any).cart) {
                    setDraftOrder((result as any).cart);
                } else {
                    await fetchDraftOrder();
                }
            } catch (err) {
                logger.error('CartProvider update quantity failed', err as Error);
                await fetchDraftOrder();
            } finally {
                isMutatingRef.current = false;
            }
        });
    };

    const clearDraftOrder = async () => {
        lastActionTimeRef.current = Date.now();
        isMutatingRef.current = true;

        // WYSHKIT 2026: Synchronous clear to prevent "Ghost Cart" during route transitions
        setDraftOrder({ items: [], partnerId: null, subtotal: 0, total: 0, itemCount: 0 });

        startTransition(async () => {
            try {
                await draftOrderActions.clearDraftOrder();
            } catch (err) {
                logger.error('CartProvider clear failed', err as Error);
                // No need to reset state here as we already cleared it synchronously
            } finally {
                isMutatingRef.current = false;
            }
        });
    };

    // WYSHKIT 2026: One source of truth - use optimistic when it has more items (recent add)
    // Otherwise use server state (authoritative)
    // WYSHKIT 2026: Single Source of Truth
    // useOptimistic automatically handles the rollback/sync.
    // We should always render the optimistic state to prevent jumpiness.
    const displayCart = optimisticCart;

    const value = {
        draftOrder: displayCart,
        loading,
        isPending,
        isGuest: !user,
        addToDraftOrder,
        removeFromDraftOrder,
        updateQuantity,
        clearDraftOrder,
        refreshDraftOrder: fetchDraftOrder,
    };

    return <CartContext.Provider value={value}>{children}</CartContext.Provider>;
}
