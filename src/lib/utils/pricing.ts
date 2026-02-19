import { PRICING } from '@/lib/constants/pricing';
import { DraftLineItem } from '@/lib/types/personalization';

/**
 * Calculates delivery fee based on distance.
 */
export function getDeliveryFeeByDistance(distanceKm: number | null): number {
    if (distanceKm === null) return PRICING.DELIVERY_FEE_3KM;
    if (distanceKm <= 3) return PRICING.DELIVERY_FEE_3KM;
    if (distanceKm <= 5) return PRICING.DELIVERY_FEE_5KM;
    return PRICING.DELIVERY_FEE_ABOVE_5KM;
}


/**
 * Calculates total price for a single line item including variants and addons.
 * Wyshkit 2026: Inclusive GST Model. Price displayed = Price inclusive of GST.
 */
export function calculateItemPrice(item: DraftLineItem): number {
    const unitPrice = Number(item.unitPrice) || 0;
    const quantity = Number(item.quantity) || 1;

    // WYSHKIT 2026: Include addons in item level total
    const addonsTotal = (item.selectedAddons || []).reduce((sum, addon) => sum + (Number(addon.price) || 0), 0);

    // WYSHKIT 2026: Dynamic personalization fee calculation
    // Prefer passed personalizationPrice if hydrated, otherwise fallback to item personalization price
    const personalizationFee = item.personalizationPrice ?? (item.personalization?.enabled ? (Number(item.personalization.price) || 0) : 0);

    return (unitPrice + addonsTotal + personalizationFee) * quantity;
}

/**
 * Calculates cart subtotal across all items.
 */
export function calculateCartSubtotal(items: DraftLineItem[]): number {
    return items.reduce((sum, item) => sum + calculateItemPrice(item), 0);
}

/**
 * Formats a number as Indian Rupee (Swiggy 2026 Standard)
 */
export function formatCurrency(amount: number): string {
    return new Intl.NumberFormat('en-IN', {
        style: 'currency',
        currency: 'INR',
        minimumFractionDigits: 0,
        maximumFractionDigits: 0,
    }).format(amount);
}

