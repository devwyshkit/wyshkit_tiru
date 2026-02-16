/**
 * WYSHKIT 2026: Intent-Based Checkout Page
 * Route: /checkout?items=[...]
 * 
 * Swiggy 2026 Pattern: URL-addressable checkout with Parallel Routes
 * - Guests can access checkout (progressive auth)
 * - Auth required only at payment step
 * - Intent captured: /checkout?items=...&intent=payment
 * - Uses Parallel Routes layout for slot-based architecture
 * 
 * Note: Content is handled by Parallel Routes slots via layout.
 * The layout's CheckoutLayoutWrapper reads searchParams from URL.
 * Data fetching happens in CheckoutLayoutWrapper via Server Actions
 * (called immediately, not in useEffect) to achieve "data comes to user" pattern.
 */
export default function CheckoutPage() {
  return null; // Content rendered by slots in layout
}
