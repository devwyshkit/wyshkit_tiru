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
 */
export function calculateItemPrice(item: DraftLineItem): number {
    const unitPrice = Number(item.unitPrice) || 0;
    const quantity = Number(item.quantity) || 1;
    return unitPrice * quantity;
}

/**
 * Calculates cart subtotal across all items.
 */
export function calculateCartSubtotal(items: DraftLineItem[]): number {
    return items.reduce((sum, item) => sum + calculateItemPrice(item), 0);
}

/**
 * Legacy support for personalization pricing calculation.
 */
export function calculatePersonalizationPrice(
    personalization: any,
    options: any[],
    quantity: number
): number {
    if (!personalization?.enabled || !personalization?.optionId) return 0;
    const option = options.find(o => o.id === personalization.optionId);
    if (!option) return 0;
    return (Number(option.price) || 0) * quantity;
}
