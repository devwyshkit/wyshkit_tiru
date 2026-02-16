/**
 * WYSHKIT 2026: Shared Personalization Logic
 * Resolves DRY violation across orders.ts, payment.ts, and checkout.ts
 */

export interface PersonalizationCheckItem {
  hasPersonalization?: boolean;
  personalization?: { enabled?: boolean; optionId?: string } | null;
  selectedAddons?: Array<{ id: string; name?: string; price?: number; requires_preview?: boolean }>;
}

/**
 * Universal check to see if an item requires personalization input.
 * Supports both Legacy (is_personalized flag) and New (Add-ons with requires_preview).
 */
export function hasItemPersonalization(item: PersonalizationCheckItem): boolean {
  if (item.hasPersonalization === true) return true;
  if (item.personalization?.enabled && item.personalization?.optionId) return true;
  const addons = item.selectedAddons || [];
  return addons.some((a) => !!a.requires_preview);
}

/**
 * Checks if a list of items contains any that require personalization.
 */
export function hasAnyPersonalization(items: PersonalizationCheckItem[]): boolean {
  return items.some(hasItemPersonalization);
}

/**
 * Checks if an order or a list of items has any personalized components.
 * Supports both order object (direct flag) and item list (iterative check).
 */
export function orderHasPersonalizedItems(input: { has_personalization?: boolean | null } | Array<{ has_personalization?: boolean | null }>): boolean {
  if (Array.isArray(input)) {
    return input.some(item => !!item.has_personalization);
  }
  return !!input.has_personalization;
}
