/**
 * WYSHKIT 2026: SLA & Time Utilities
 * Centralized formatting for delivery and prep times.
 */

export function formatPrepTime(prepHours: number): string {
    if (prepHours < 1) {
        return `${Math.round(prepHours * 60)}m`;
    }
    return `${prepHours}h`;
}

export function formatDeliveryTime(min: number, max: number): string {
    return `${min}-${max} mins`;
}
