'use server'

import { getCart, getTransactionData } from './draft-order'
import { getAddresses } from './addresses'
import { getWalletInfo } from './wallet'
import { calculateOrderTotalRPC } from './pricing'
import { logError } from '@/lib/utils/error-handler'
import { calculateHaversineDistance } from '@/lib/utils/distance'
import { getDeliveryFeeByDistance } from '@/lib/utils/pricing'
import type { HydratedDraftItem, PricingBreakdown } from '@/components/customer/checkout/types'
import type { Address } from '@/lib/types/address'
import type { WalletInfo } from './wallet'
import type { UpsellItem } from '@/components/features/UpsellGrid'

export interface CheckoutData {
    items: HydratedDraftItem[]
    upsellItems: UpsellItem[]
    addresses: Address[]
    walletInfo: WalletInfo | null
    pricing: PricingBreakdown | null
    appliedCoupon: {
        code: string
        discount: number
    } | null
    useWallet: boolean
    gstin?: string | null
    user: {
        id: string
        email?: string
        name?: string
    } | null
    error?: string
}

import { cache } from 'react'
import { cookies } from 'next/headers'
import { revalidatePath } from 'next/cache'
import { validateCoupon } from './coupons'

/**
 * WYSHKIT 2026: The "One-Trip" Checkout Orchestrator
 * Consolidates all necessary checkout data into a single server-side call.
 * 
 * Swiggy 2026 Pattern: Deduplicated Server Fetching
 * - Uses React cache() to ensure a single execution per request.
 * - State (coupons, wallet toggle) managed via cookies for stateless resilience.
 */
export const getCheckoutData = cache(async (): Promise<CheckoutData> => {
    try {
        const cookieStore = await cookies()
        const appliedCouponCode = cookieStore.get('applied_coupon')?.value
        const useWallet = cookieStore.get('use_wallet')?.value === 'true'

        // 1. Fetch base data in parallel
        const supabase = await (await import('@/lib/supabase/server')).createClient();
        const [cartRes, addressesRes, walletRes, { data: { user } }] = await Promise.all([
            getCart(),
            getAddresses(),
            getWalletInfo(),
            supabase.auth.getUser()
        ])

        const cart = cartRes.cart
        const addresses = addressesRes.addresses as Address[] || []
        const walletInfo = walletRes.data || null

        if (!cart || cart.items.length === 0) {
            return {
                items: [],
                upsellItems: [],
                addresses: addresses,
                walletInfo: walletInfo,
                pricing: null,
                appliedCoupon: null,
                useWallet: useWallet,
                user: user ? { id: user.id, email: user.email } : null,
                error: 'Cart is empty'
            }
        }

        // 2. Hydrate items (include selectedAddons for pricing and personalization detection)
        const draftItems = cart.items.map(item => ({
            itemId: item.itemId,
            variantId: item.selectedVariantId,
            personalization: item.personalization || { enabled: false },
            selectedAddons: item.selectedAddons || [],
            quantity: item.quantity
        }))

        // 3. Parallel fetch of transaction data (upsells)
        const transactionData = await getTransactionData(draftItems)
        const hydratedItems = transactionData.hydratedItems as unknown as HydratedDraftItem[]
        const upsellItems = transactionData.upsellItems as unknown as UpsellItem[]

        // 4. Calculate Final Pricing (Server-side Truth via RPC)
        const pricingItems = hydratedItems.map(item => ({
            itemId: item.itemId,
            quantity: item.quantity,
            variantId: item.variantId,
            personalizationOptionId: (item.personalization as any)?.optionId || null,
            hasPersonalization: !!((item.personalization as any)?.enabled && (item.personalization as any)?.optionId) ||
                (item.selectedAddons || []).some((a: { requires_preview?: boolean }) => !!a.requires_preview),
            selectedAddons: item.selectedAddons || []
        }))

        const defaultAddress = addresses.find(a => a.is_default) || addresses[0]

        // WYSHKIT 2026: If no address exists, we skip RPC but return valid structure
        if (!defaultAddress) {
            return {
                items: hydratedItems,
                upsellItems: upsellItems,
                addresses: addresses,
                walletInfo: walletInfo,
                pricing: null,
                appliedCoupon: null,
                useWallet: useWallet,
                user: user ? { id: user.id, email: user.email } : null
            }
        }

        const partnerLat = (cartRes.cart as any)?.items?.[0]?.partnerLatitude
        const partnerLng = (cartRes.cart as any)?.items?.[0]?.partnerLongitude

        const distanceKm = calculateHaversineDistance(
            defaultAddress.latitude,
            defaultAddress.longitude,
            partnerLat,
            partnerLng
        )

        // WYSHKIT 2026: Atomic Pricing Pivot
        // We pass useWallet and userId to the RPC. 
        // We no longer calculate deliveryFee in JS; RPC handles it via distanceKm.
        const pricingRes = await calculateOrderTotalRPC(
            pricingItems,
            0, // deliveryFee override not needed
            defaultAddress.id,
            appliedCouponCode,
            distanceKm ?? undefined,
            useWallet,
            user?.id
        )

        if (pricingRes.error || !pricingRes.data) {
            logError(new Error(pricingRes.error || 'Pricing calculation returned no data'), 'GetCheckoutData:PricingRPC');
            return {
                items: hydratedItems,
                upsellItems: upsellItems,
                addresses: addresses,
                walletInfo: walletInfo,
                pricing: null,
                appliedCoupon: null,
                useWallet: useWallet,
                user: user ? { id: user.id, email: user.email } : null,
                error: pricingRes.error || 'Pricing calculation failed'
            }
        }

        const pricing = pricingRes.data;
        let appliedCoupon: { code: string; discount: number } | null = null

        if (appliedCouponCode && pricing.discount > 0) {
            appliedCoupon = {
                code: appliedCouponCode,
                discount: pricing.discount
            }
        }

        return {
            items: hydratedItems,
            upsellItems: upsellItems,
            addresses: addresses,
            walletInfo: walletInfo,
            pricing: pricing,
            appliedCoupon: appliedCoupon,
            useWallet: useWallet,
            user: user ? { id: user.id, email: user.email } : null,
        }

    } catch (error) {
        const errorMessage = error instanceof Error ? error.message : 'Failed to fetch checkout data';
        logError(error, 'GetCheckoutData');
        return {
            items: [],
            upsellItems: [],
            addresses: [],
            walletInfo: null,
            pricing: null,
            appliedCoupon: null,
            useWallet: false,
            user: null,
            error: errorMessage
        }
    }
})

/**
 * WYSHKIT 2026: Stateless Mutations
 * These actions update cookies and revalidate the checkout layout.
 */
export async function applyCouponAction(code: string | null) {
    const cookieStore = await cookies()
    if (code) {
        cookieStore.set('applied_coupon', code, { maxAge: 60 * 60 }) // 1 hour
    } else {
        cookieStore.delete('applied_coupon')
    }
    revalidatePath('/checkout')
    return { success: true }
}

export async function toggleWalletAction(use: boolean) {
    const cookieStore = await cookies()
    cookieStore.set('use_wallet', String(use), { maxAge: 60 * 60 })
    revalidatePath('/checkout')
    return { success: true }
}
