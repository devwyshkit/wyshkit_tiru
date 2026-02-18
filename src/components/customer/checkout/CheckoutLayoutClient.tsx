'use client';

import { ReactNode, Suspense, useState, useCallback, useRef } from "react";
import { useRouter } from "next/navigation";
import { ChevronLeft, Loader2, Truck, Package, Check, XCircle, CreditCard, ChevronDown, ChevronUp, ShieldCheck, ChevronRight, Info, FileText } from "lucide-react";
import { SlideToPay } from "@/components/features/checkout/SlideToPay";
import { useAuth } from "@/hooks/useAuth";
import { Confetti } from "@/components/ui/Confetti";
import { cn } from "@/lib/utils";
import { triggerHaptic, HapticPattern } from "@/lib/utils/haptic";
import { CheckoutData } from "@/lib/actions/checkout";
import { toast } from "sonner";
import { useEffect } from "react";
import { useCart } from "@/components/customer/CartProvider";
import { Button } from "@/components/ui/button";
import { ShoppingBag, RefreshCw, MapPin, Sparkles } from "lucide-react";
import { CartSlot } from "./slots/CartSlot";
import { AddressSlot } from "./slots/AddressSlot";
import { createClient } from "@/lib/supabase/client";
import { logger } from "@/lib/logging/logger";
import { formatCurrency } from "@/lib/utils/pricing";





import { CouponSlot } from "./slots/CouponSlot";
import { WalletSlot } from "./slots/WalletSlot";
import { CheckoutAddressProvider, useCheckoutAddress } from "./CheckoutAddressContext";
import { generateEstimatePDF } from "@/lib/services/pdf-service";
import { IdentityForm } from "@/components/customer/orders/IdentityForm";
import { getPartnerInfo } from "@/lib/actions/draft-order";
import { validateGSTINAction } from "@/lib/actions/gstin";
// SuccessOverlay removed as per Swiggy 2026 single-screen model
import { UpsellGrid } from "@/components/features/UpsellGrid";

interface CheckoutLayoutClientProps {
  data: CheckoutData;
}

/**
 * WYSHKIT 2026: Checkout Layout Client Component
 * Orchestrates Parallel Routes slots with Stateless Data
 * 
 * Swiggy 2026 Pattern: Responsive Width Constraints
 * - Data injected via props (no context waterfall)
 * - Local UI state only
 */
function CheckoutLayoutClientInner({
  data,
}: CheckoutLayoutClientProps) {
  const router = useRouter();
  const { user: authUser } = useAuth();
  const { clearDraftOrder, addToDraftOrder } = useCart();
  const addressContext = useCheckoutAddress();
  const selectedAddressId = addressContext?.selectedAddressId ?? null;

  const [isProcessing, setIsProcessing] = useState(false);
  const [isSuccess, setIsSuccess] = useState(false);
  const successRef = useRef(false);
  const [gstin, setGstin] = useState<string>((data.gstin as string) || '');
  const [gstinExpanded, setGstinExpanded] = useState(false);
  const [gstinValidation, setGstinValidation] = useState<'idle' | 'validating' | 'valid' | 'invalid'>('idle');
  const [gstinError, setGstinError] = useState<string | null>(null);
  const [businessName, setBusinessName] = useState<string | null>(null);
  // WYSHKIT 2026: State for inline personalization interception
  const [uploadOrder, setUploadOrder] = useState<any>(null);

  const [testCardHintExpanded, setTestCardHintExpanded] = useState(false);
  const paymentInitiatedRef = useRef(false);
  const activeRazorpayOrderIdRef = useRef<string | null>(null);
  const { items, pricing, walletInfo } = data;

  const isTestMode = (process.env.NEXT_PUBLIC_RAZORPAY_KEY_ID ?? '').startsWith('rzp_test_');

  const handleGstinBlur = async () => {
    const trimmed = gstin.trim();
    if (!trimmed) {
      setGstinValidation('idle');
      setGstinError(null);
      return;
    }
    setGstinValidation('validating');
    setGstinError(null);
    const result = await validateGSTINAction(trimmed);
    if (result.valid) {
      setGstinValidation('valid');
      setGstinError(null);
      setBusinessName(result.businessName ?? null);
      if (result.businessName) {
        toast.success(`Verified: ${result.businessName}`);
      }
    } else {
      setGstinValidation('invalid');
      setGstinError(result.error ?? 'Invalid GSTIN');
      setBusinessName(null);
    }
  };

  const handleDownloadEstimate = async () => {
    if (!items.length || !pricing) {
      toast.error("No items in cart");
      return;
    }

    // WYSHKIT 2026: Get partner info from the first item (since 1 order = 1 partner)
    const partnerId = (items[0] as any).partnerId;
    const { data: partner } = await getPartnerInfo(partnerId);

    const currentAddress = data.addresses?.find(a => a.id === selectedAddressId);

    generateEstimatePDF({
      date: new Date().toLocaleDateString(),
      customerName: authUser?.user_metadata?.full_name || "Valued Customer",
      businessName: businessName || undefined,
      billingAddress: currentAddress,
      gstin: gstin || undefined,
      partner: partner
        ? {
          name: partner.name,
          address: partner.address || 'Bangalore, India',
          gstin: partner.gstin || undefined,
        }
        : { name: 'Partner', address: 'Bangalore, India' },
      cart: {

        items: items.map((it: any) => ({
          itemName: it.name || "Item",
          quantity: it.quantity || 1,
          unitPrice: it.unitPrice || 0,
          totalPrice: (it.unitPrice || 0) * (it.quantity || 1),
        })),
        subtotal: pricing.subtotal,
        total: pricing.total
      } as any,
      totals: {
        itemTotal: pricing.subtotal,
        deliveryFee: pricing.deliveryFee,
        platformFee: pricing.platformFee,
        gstAmount: pricing.gst,
        grandTotal: pricing.total,
        discount: (pricing.discount || 0) + (pricing.walletDiscount || 0)
      }
    });

    toast.success("Estimate downloaded");
  };

  const handleOrderSuccess = useCallback(async (order: any, orderId?: string, hasPersonalization?: boolean) => {
    if (successRef.current) return;

    // WYSHKIT 2026: Momentum-Resilience Hydration
    // "Rich Data" from RPC or Realtime is prioritized.
    // If the order has items, we use it directly. If not, we fetch.
    let richOrder = order;
    const finalOrderId = orderId || order?.id;

    // Use the explicit flag if provided, otherwise check the order object (handles both cases)
    let finalHasPersonalization = hasPersonalization ?? order?.has_personalization ?? order?.hasPersonalization;

    // Check if the order object is "thin" (missing relations)
    const isThinOrder = Boolean(finalOrderId && (!richOrder || !richOrder.order_items || richOrder.orderItems || richOrder.order_items?.length === 0));

    if (isThinOrder) {
      // Fallback: Fetch full details if we only got a thin notification
      const { getOrderWithHistory } = await import('@/lib/actions/orders');
      const { order: hydratedOrder } = await getOrderWithHistory(finalOrderId);
      if (hydratedOrder) {
        richOrder = hydratedOrder;
        if (finalHasPersonalization === undefined) {
          finalHasPersonalization = hydratedOrder.hasPersonalization || hydratedOrder.has_personalization;
        }
      }
    }

    // Swiggy 2026: Proactive Interception
    // If order requires personalization, show THE IdentityForm INLINE before navigating.
    if (finalHasPersonalization && richOrder) {
      setUploadOrder(richOrder);
      setIsProcessing(false);
      return; // Stop redirection flow - waiting for user interaction
    }

    successRef.current = true;
    setIsSuccess(true);
    setIsProcessing(false);

    // WYSHKIT 2026: Explicitly clear cart on client to stop staleness
    // Wrap in try-catch to ensure navigation NEVER blocks
    try {
      await clearDraftOrder();
    } catch (e) {
      console.error("Failed to clear cart, proceeding anyway", e);
    }

    // Swiggy 2026: Immediate transition to the Order Heartbeat (Tracking Screen)
    // No more "intermediary" screens. The tracker is the single source of truth.
    if (finalOrderId) {
      router.push(`/orders/${finalOrderId}?success=true`);
    } else {
      router.push('/orders');
    }
  }, [clearDraftOrder, router]);

  const handlePayment = useCallback(async () => {
    if (!authUser || !data.pricing) return;
    if (!selectedAddressId) {
      toast.error('Please select a delivery address');
      return;
    }

    // WYSHKIT 2026: Critical Guards to prevent double-payment/double-orders
    if (isProcessing || isSuccess || paymentInitiatedRef.current) {
      return;
    }

    try {
      paymentInitiatedRef.current = true;
      setIsProcessing(true);

      const { createPaymentOrder, verifyPaymentSignature } = await import('@/lib/actions/payment');

      const response = await createPaymentOrder(
        Math.round(data.pricing.total * 100),
        'INR',
        {
          addressId: selectedAddressId,
          draftItems: data.items,
          pricing: data.pricing,
          appliedCoupon: data.appliedCoupon || undefined,
          useWallet: data.useWallet,
          walletDiscount: data.pricing.walletDiscount || 0,
          deliveryInstructions: addressContext?.deliveryInstructions || undefined,
        }
      );

      if (response.error || !response.order) {
        throw new Error(response.error || 'Failed to create payment order');
      }

      const orderData = response.order;
      activeRazorpayOrderIdRef.current = orderData.id;
      setTrackingOrderId(orderData.id); // Enable Realtime Listener

      // WYSHKIT 2026: Strict Payment Flow - No Bypass Allowed

      // WYSHKIT 2026: Wait for Razorpay SDK 
      let RazorpayConstructor = typeof window !== 'undefined' ? (window as any).Razorpay : null;
      if (!RazorpayConstructor) {
        for (let i = 0; i < 6; i++) {
          await new Promise(r => setTimeout(r, 500));
          RazorpayConstructor = (window as any).Razorpay;
          if (RazorpayConstructor) break;
        }
      }

      if (RazorpayConstructor) {
        const options = {
          key: orderData.key || process.env.NEXT_PUBLIC_RAZORPAY_KEY_ID,
          amount: orderData.amount,
          currency: orderData.currency,
          name: 'Wyshkit',
          description: `Order from ${data.partnerName || 'Local Store'}`,
          order_id: orderData.id,
          handler: async (razorpayResponse: any) => {
            try {
              const verifyResponse = await verifyPaymentSignature(
                razorpayResponse.razorpay_order_id,
                razorpayResponse.razorpay_payment_id,
                razorpayResponse.razorpay_signature,
                {
                  draftId: orderData.draftId
                }
              );

              if (verifyResponse.error) {
                logger.error('Payment verification action failed', { error: verifyResponse.error });
                // If it fails with a 500/Ambiguity error, the webhook/Realtime listener might also fail.
                // We show a slightly more descriptive error but keep the door open for Realtime.
                toast.error("Still verifying your order... please don't refresh.");
              }

              // WYSHKIT 2026: Direct Hydration from RPC Response
              // If verification succeeded and returned an order object (from enriched RPC or fetch), use it immediately!
              if (verifyResponse.success && !successRef.current) {
                // The enriched RPC/Action returns the FULL order object in `verifyResponse.order`
                handleOrderSuccess(verifyResponse.order || null, verifyResponse.orderId, verifyResponse.hasPersonalization);
              }
            } catch (err) {
              toast.error(err instanceof Error ? err.message : 'Payment verification failed');
              setIsProcessing(false);
              paymentInitiatedRef.current = false;
            }
          },
          prefill: { name: authUser?.user_metadata?.full_name, phone: authUser?.phone },
          theme: { color: '#18181b' },
          modal: {
            ondismiss: () => {
              setIsProcessing(false);
              paymentInitiatedRef.current = false;
            }
          },
          retry: {
            enabled: false
          }
        };

        const rzp = new RazorpayConstructor(options);
        rzp.open();
      } else {
        toast.error('Payment gateway not loaded. Please refresh and try again.');
        setIsProcessing(false);
        paymentInitiatedRef.current = false;
      }
    } catch (err) {
      toast.error(err instanceof Error ? err.message : 'Payment failed');
      setIsProcessing(false);
      paymentInitiatedRef.current = false;
    }
  }, [authUser, data.pricing, data.items, data.appliedCoupon, data.useWallet, selectedAddressId, isProcessing, isSuccess, gstin, addressContext?.deliveryInstructions, router, clearDraftOrder, handleOrderSuccess]);

  // WYSHKIT 2026: Precise Realtime Tracking (Data comes to user)
  // We track the specific Razorpay Order ID to avoid noise and auth-context flakiness.
  const [trackingOrderId, setTrackingOrderId] = useState<string | null>(null);

  useEffect(() => {
    if (!trackingOrderId || successRef.current) return;

    logger.info('Initializing Realtime Listener for Order', { razorpayOrderId: trackingOrderId });

    const supabase = createClient();
    const channel = supabase
      .channel(`checkout-${trackingOrderId}`)
      .on(
        'postgres_changes',
        {
          event: '*', // Listen for INSERT (creation) or UPDATE (status change)
          schema: 'public',
          table: 'orders',
          filter: `razorpay_order_id=eq.${trackingOrderId}` // Point-to-Point Precision
        },
        async (payload) => {
          const newOrder = payload.new as any;

          // Double check it matches (redundant but safe)
          if (newOrder && !successRef.current && newOrder.razorpay_order_id === trackingOrderId) {

            // WYSHKIT 2026: Resilience Fix - Accept ANY valid status that implies success
            // 'PLACED' is the initial success state. 'CONFIRMED'/'PAID' are upgrades.
            const isValidSuccess =
              newOrder.status === 'PLACED' ||
              newOrder.status === 'CONFIRMED' ||
              newOrder.status === 'PAID' ||
              (newOrder.payment_status === 'PAID' || newOrder.payment_status === 'captured');

            if (isValidSuccess) {
              logger.info('Order confirmed via Realtime', { orderId: newOrder.id, status: newOrder.status });
              handleOrderSuccess(newOrder, newOrder.id, newOrder.has_personalization);
            }
          }
        }
      )
      .subscribe();

    return () => {
      supabase.removeChannel(channel);
    };
  }, [trackingOrderId, handleOrderSuccess]);


  // Move pricing check into JSX to allow isSuccess overlay to render even with null pricing
  // if (!pricing) return null;

  const personalizationTotal = items.reduce((sum: number, item: any) => sum + ((item.personalizationPrice || 0) * item.quantity), 0);

  return (
    <div className="h-[100dvh] flex flex-col bg-white relative font-sans">
      {/* WYSHKIT 2026: The main UI is only shown if pricing exists or if we are in success state */}
      {/* WYSHKIT 2026: Granular Error/Empty States to avoid redirect loop */}
      {!items.length && !isSuccess ? (
        <div className="flex-1 flex flex-col items-center justify-center p-10 text-center space-y-4">
          <div className="size-20 bg-zinc-50 rounded-full flex items-center justify-center mb-2">
            <ShoppingBag className="size-10 text-zinc-300" />
          </div>
          <div className="space-y-1">
            <h2 className="text-xl font-bold text-zinc-900">Your cart is empty</h2>
            <p className="text-sm text-zinc-500 max-w-xs mx-auto">Looks like you haven't added anything yet. Start browsing to find something you'll love.</p>
          </div>
          <Button
            onClick={() => router.push('/')}
            className="rounded-2xl px-8 h-12 bg-zinc-900 text-white font-bold uppercase tracking-widest text-xs"
          >
            Browse Products
          </Button>
        </div>
      ) : (
        <div className="flex flex-col h-full">
          {/* WYSHKIT 2026: Always show Header and Main Content if items exist */}
          <header className="flex items-center justify-between h-16 px-5 md:px-0 bg-white shrink-0">
            <div className="w-full max-w-2xl mx-auto flex items-center gap-3">
              <button
                onClick={() => router.back()}
                className="size-9 flex items-center justify-center text-zinc-900 active:scale-95 transition-all"
              >
                <ChevronLeft className="size-6" />
              </button>
              <div className="flex flex-col">
                <h2 className="text-lg font-bold text-zinc-900 leading-tight tracking-tight">{data.partnerName || 'Checkout'}</h2>
                <p className="text-[11px] font-bold text-zinc-400 leading-tight">{data.partnerCity || 'Local Store'}</p>
              </div>
            </div>
          </header>

          <main className="flex-1 overflow-y-auto">
            <div className="flex flex-col px-5 md:px-0 py-4 divide-y divide-zinc-100 max-w-2xl mx-auto w-full">
              <section className="pb-6">
                <CartSlot initialHydratedItems={data.items as any} />
              </section>

              {/* WYSHKIT 2026: Consolidation of Upsells */}
              {data.upsellItems && data.upsellItems.length > 0 && (
                <section className="py-2">
                  <UpsellGrid
                    items={data.upsellItems as any}
                    title="Add more from this store"
                    onAdd={async (item) => {
                      try {
                        const result = await addToDraftOrder(item.id, null, { enabled: false }, [], 1);
                        if (result.success) {
                          toast.success(`Added ${item.name}`);
                          router.refresh();
                        } else {
                          toast.error(result.error || 'Failed to add item');
                        }
                      } catch (error) {
                        toast.error('Failed to add item. Please try again.');
                      }
                    }}
                  />
                </section>
              )}

              {/* WYSHKIT 2026: Address always visible so user can select/add one */}
              <Suspense fallback={<div className="py-8 flex items-center justify-center"><Loader2 className="size-5 animate-spin text-zinc-400" /></div>}>
                <section className="py-6 space-y-4">
                  <AddressSlot
                    initialAddresses={data.addresses as any}
                    currentAddress={data.addresses?.find(a => a.id === selectedAddressId) as any}
                  />
                  {selectedAddressId && (
                    <p className="text-xs text-zinc-500 font-bold uppercase tracking-tight">Delivery today by 6 PM</p>
                  )}
                  {selectedAddressId && (
                    <div>
                      <label htmlFor="delivery-instructions" className="text-[10px] font-bold uppercase tracking-widest text-zinc-400 block mb-1.5">
                        Delivery instructions (optional)
                      </label>
                      <textarea
                        id="delivery-instructions"
                        placeholder="e.g. Leave at door, Call on arrival"
                        maxLength={200}
                        value={addressContext?.deliveryInstructions ?? ''}
                        onChange={(e) => addressContext?.setDeliveryInstructions(e.target.value)}
                        className="w-full h-20 rounded-xl border border-zinc-100 bg-zinc-50 px-4 py-3 text-sm placeholder:text-zinc-400 focus:outline-none focus:ring-2 focus:ring-[#D91B24]/20 focus:border-[#D91B24]/30 resize-none"
                        rows={2}
                      />
                    </div>
                  )}
                </section>
              </Suspense>

              {authUser && (
                <section className="py-4 space-y-4">
                  <CouponSlot appliedCoupon={data.appliedCoupon} />
                  <WalletSlot
                    walletInfo={data.walletInfo}
                    useWalletBalance={data.useWallet}
                    pricing={data.pricing}
                  />
                </section>
              )}


              {/* WYSHKIT 2026: Bill Summary - Shows loader or summary */}
              <section className="py-6">
                {!pricing ? (
                  <div className="py-8 flex flex-col items-center justify-center text-center space-y-3 bg-zinc-50 rounded-2xl border border-dashed border-zinc-200">
                    <Loader2 className="size-6 text-zinc-300 animate-spin" />
                    <div className="space-y-0.5">
                      <p className="text-[11px] font-bold uppercase tracking-widest text-zinc-400">Calculating bill...</p>
                      <p className="text-[10px] text-zinc-400 px-10">Select an address to see final delivery fees and taxes.</p>
                    </div>
                  </div>
                ) : (
                  <div className="space-y-4">
                    <div className="flex items-center justify-between pb-3 border-b border-zinc-100">
                      <span className="text-sm font-bold text-zinc-900">Bill Summary</span>
                      <span className="text-lg font-black text-zinc-950 tabular-nums">{formatCurrency(pricing.total)}</span>
                    </div>
                    <div className="space-y-3">
                      <div className="flex justify-between text-sm text-zinc-600">
                        <span>Subtotal ({items.length} item{items.length > 1 ? 's' : ''})</span>
                        <span className="tabular-nums font-semibold text-zinc-950">{formatCurrency(pricing.subtotal)}</span>
                      </div>
                      {personalizationTotal > 0 && (
                        <div className="flex justify-between text-sm text-zinc-600">
                          <span>Personalization</span>
                          <span className="tabular-nums font-semibold text-zinc-950">{formatCurrency(personalizationTotal)}</span>
                        </div>
                      )}
                      <div className="flex justify-between text-sm text-zinc-600">
                        <span className="flex items-center gap-1.5">
                          <Truck className="size-4" />
                          Delivery
                          {pricing.deliveryFee === 0 && <span className="text-[10px] text-emerald-600 font-bold px-1.5 py-0.5 bg-emerald-50 rounded-md">FREE</span>}
                        </span>
                        <span className="tabular-nums font-semibold text-zinc-950">{pricing.deliveryFee === 0 ? 'FREE' : formatCurrency(pricing.deliveryFee)}</span>
                      </div>
                      <div className="flex justify-between text-sm text-zinc-600">
                        <span>Platform fee</span>
                        <span className="tabular-nums font-semibold text-zinc-950">{formatCurrency(pricing.platformFee)}</span>
                      </div>
                      <div className="flex justify-between text-sm text-zinc-600">
                        <span>GST (18%)</span>
                        <span className="tabular-nums font-semibold text-zinc-950">{formatCurrency(pricing.gst)}</span>
                      </div>
                    </div>

                    <div className="pt-4 border-t border-zinc-100">
                      <div className="flex justify-between items-center">
                        <span className="text-lg font-bold text-zinc-950">Sum to pay</span>
                        <span className="text-xl font-black text-zinc-950 tabular-nums">{formatCurrency(pricing.total)}</span>
                      </div>
                      {((pricing.discount || 0) + (pricing.walletDiscount || 0)) > 0 && (
                        <p className="text-xs font-semibold text-emerald-600 mt-1">
                          You saved {formatCurrency((pricing.discount || 0) + (pricing.walletDiscount || 0))}
                        </p>
                      )}
                    </div>

                    <div className="pt-4 space-y-3">
                      <div className="pt-6 space-y-4">
                        {/* WYSHKIT 2026: Premium Business Identity Slot - Inline & High Trust */}
                        <div className="p-4 rounded-2xl border bg-zinc-50/50 border-zinc-100">
                          <div className="space-y-3">
                            <div className="flex items-center justify-between">
                              <div className="flex items-center gap-2">
                                <ShieldCheck className="size-4 text-zinc-900" />
                                <span className="text-[10px] font-bold uppercase tracking-widest text-zinc-900">Tax Identity (GSTIN)</span>
                              </div>
                              {/* Swiggy 2026: Cleaner, text-only save message */}
                              <span className="text-[10px] font-medium text-emerald-600">Save 18%</span>
                            </div>
                            <div className="relative">
                              <input
                                type="text"
                                value={gstin}
                                onChange={(e) => {
                                  setGstin(e.target.value.toUpperCase());
                                  if (gstinValidation !== 'idle') setGstinValidation('idle');
                                  setGstinError(null);
                                }}
                                onBlur={handleGstinBlur}
                                placeholder="Enter 15-digit GSTIN"
                                className={cn(
                                  "w-full h-10 pl-3 pr-10 bg-white border rounded-lg text-xs font-bold placeholder:text-zinc-300 focus:outline-none transition-all",
                                  gstinValidation === 'invalid' ? "border-rose-200 bg-rose-50" : "border-zinc-200 focus:border-zinc-900"
                                )}
                              />
                              <div className="absolute right-3 top-1/2 -translate-y-1/2">
                                {gstinValidation === 'validating' && <Loader2 className="size-3 text-zinc-400 animate-spin" />}
                                {gstinValidation === 'valid' && <Check className="size-3 text-emerald-500 stroke-[3]" />}
                                {gstinValidation === 'invalid' && <XCircle className="size-3 text-rose-500" />}
                              </div>
                            </div>
                            {businessName && (
                              <div className="flex items-center gap-1.5 animate-in fade-in slide-in-from-top-1">
                                <Check className="size-3 text-emerald-600" />
                                <span className="text-[10px] font-bold text-emerald-700 uppercase tracking-tight">{businessName} verified</span>
                              </div>
                            )}
                            {gstinError && <p className="text-[10px] text-rose-600 font-bold">{gstinError}</p>}

                            {/* Inline Estimate Action */}
                            <div className="flex items-center justify-between pt-1">
                              <p className="text-[10px] text-zinc-400">Claims input tax credit</p>
                              <button
                                type="button"
                                onClick={handleDownloadEstimate}
                                className="flex items-center gap-1.5 text-[10px] font-bold uppercase tracking-wider text-zinc-900 hover:underline transition-all"
                              >
                                <FileText className="size-3" />
                                Get Estimate
                              </button>
                            </div>
                          </div>
                        </div>

                        <div className="p-4 bg-zinc-50 rounded-2xl border border-zinc-100/80">
                          <div className="flex items-start gap-3">
                            <Info className="size-4 text-zinc-400 mt-0.5 shrink-0" />
                            <p className="text-[10px] text-zinc-500 leading-normal font-medium italic">
                              Personalized items cannot be returned unless received damaged. 100% advance payment required. Estimated delivery 1-3 business days.
                            </p>
                          </div>
                        </div>
                      </div>
                    </div>
                  </div>
                )}
              </section>

              {/* Security badge (Unified) */}
              <div className="px-3 py-8 flex items-center justify-center gap-2 opacity-30">
                <ShieldCheck className="size-3 text-zinc-400" />
                <span className="text-[9px] font-bold text-zinc-400 uppercase tracking-widest">Secured by Razorpay</span>
              </div>
            </div>
          </main>

          {/* WYSHKIT 2026: Footer - Adjusted for null pricing */}
          {/* WYSHKIT 2026: Footer - Adjusted for null pricing */}
          <footer className="sticky bottom-0 bg-white/80 backdrop-blur-xl border-t border-zinc-100 z-20">
            <div className="max-w-2xl mx-auto w-full px-4 md:px-0">
              <div className="flex items-center justify-between gap-4 py-2.5 pb-[max(0.625rem,env(safe-area-inset-bottom))]">
                <div className="flex flex-col">
                  <span className="text-xl font-bold text-zinc-950 tabular-nums">
                    {pricing ? formatCurrency(pricing.total) : '—'}
                  </span>
                  <span className="text-[10px] text-zinc-400 font-semibold">
                    {pricing ? 'Bill details above' : 'Waiting for address'}
                  </span>
                </div>

                <div className="flex-1">
                  {!authUser ? (
                    <button
                      onClick={() => router.push('/auth?returnUrl=/checkout')}
                      className="w-full h-16 bg-[#D91B24] rounded-[24px] flex flex-col items-center justify-center border border-[#D91B24] active:scale-95 transition-all shadow-xl shadow-rose-900/10"
                    >
                      <span className="text-sm font-black text-white">Login to continue</span>
                      <span className="text-[10px] font-bold text-white/70">Securely checkout after login</span>
                    </button>
                  ) : !selectedAddressId ? (
                    <div className="w-full h-16 bg-zinc-100 rounded-[24px] flex items-center justify-center border border-zinc-200">
                      <span className="text-xs font-semibold text-zinc-400">Select delivery address</span>
                    </div>
                  ) : !pricing ? (
                    <button
                      onClick={() => {
                        triggerHaptic(HapticPattern.WARNING);
                        router.refresh();
                      }}
                      className="w-full h-16 bg-rose-50 rounded-[24px] flex items-center justify-center border border-rose-100 px-4 text-center hover:bg-rose-100 transition-colors group"
                    >
                      <div className="flex flex-col items-center">
                        <div className="flex items-center gap-1.5 mb-0.5">
                          <RefreshCw className="size-3 text-rose-600 group-active:animate-spin" />
                          <span className="text-[10px] font-black text-rose-600 uppercase tracking-widest">Pricing Engine Offline</span>
                        </div>
                        <span className="text-[9px] font-bold text-rose-500/70 uppercase">Tap to retry calculation</span>
                      </div>
                    </button>
                  ) : (
                    <div className="flex-1">
                      <div className="hidden md:block">
                        <button
                          onClick={handlePayment}
                          disabled={isProcessing || isSuccess}
                          className={cn(
                            "w-full h-16 rounded-[24px] flex items-center justify-center transition-all active:scale-95 shadow-xl hover:shadow-2xl",
                            isProcessing || isSuccess
                              ? "bg-zinc-100 border border-zinc-200 text-zinc-400"
                              : "bg-zinc-900 border border-zinc-900 text-white hover:bg-zinc-800"
                          )}
                        >
                          {isProcessing ? (
                            <Loader2 className="size-5 animate-spin" />
                          ) : (
                            <span className="text-sm font-bold">Place Order • {formatCurrency(pricing.total)}</span>
                          )}
                        </button>
                      </div>
                      <div className="md:hidden">
                        <SlideToPay
                          amount={pricing.total}
                          onPay={() => {
                            triggerHaptic(HapticPattern.WARNING);
                            handlePayment();
                          }}
                          isProcessing={isProcessing}
                        />
                      </div>
                    </div>
                  )}
                </div>
              </div>
              {/* WYSHKIT 2026: Test Card Hint HIDDEN for Production Feel */}
              {/* {isTestMode && authUser && selectedAddressId && ( ... )} */}
            </div>
          </footer>
        </div>
      )}

      {/* WYSHKIT 2026: Proactive Success Intercept */}
      {(isSuccess || uploadOrder) && (
        <div className="fixed inset-0 z-[100] bg-white flex flex-col items-center justify-start overflow-y-auto px-6 py-12 scrollbar-none">
          <Confetti />

          <div className="w-full max-w-lg mx-auto space-y-12 animate-in cubic-bezier(0.19, 1, 0.22, 1) slide-in-from-bottom-12 duration-1000">
            <div className="text-center space-y-6">
              <div
                className="size-28 bg-zinc-950 rounded-[40px] flex items-center justify-center mx-auto shadow-2xl shadow-zinc-200 animate-in zoom-in-50 duration-700 ease-out"
                onAnimationEnd={() => triggerHaptic(HapticPattern.HEARTBEAT)}
              >
                <Check className="size-12 text-white stroke-[3px]" />
              </div>
              <div className="space-y-2">
                <h2 className="text-4xl font-black text-zinc-950 tracking-tighter uppercase italic leading-none">
                  Order <span className="text-[#D91B24]">Received</span>
                </h2>
                <div className="flex items-center justify-center gap-2">
                  <span className="text-[10px] font-black text-zinc-400 uppercase tracking-widest bg-zinc-50 px-3 py-1 rounded-full border border-zinc-100">
                    ID: #{uploadOrder?.order_number || data.partnerName}
                  </span>
                </div>
              </div>
            </div>

            {uploadOrder ? (
              <div className="bg-white rounded-[40px] border border-zinc-100 p-1 shadow-2xl shadow-zinc-200/50 animate-in zoom-in-95 duration-500 delay-300 fill-mode-backwards">
                <div className="p-8 space-y-3 border-b border-zinc-50 bg-[#FFF9E6]/30 rounded-t-[38px] relative overflow-hidden">
                  <div className="absolute top-0 right-0 p-4 opacity-[0.05] pointer-events-none">
                    <Sparkles className="size-16 text-amber-500" />
                  </div>
                  <div className="flex items-center gap-2 relative z-10">
                    <div className="size-2 bg-amber-500 rounded-full animate-pulse shadow-[0_0_8px_rgba(245,158,11,0.5)]" />
                    <h3 className="text-xl font-black text-zinc-900 tracking-tighter uppercase leading-none">Complete Design</h3>
                  </div>
                  <p className="text-sm text-zinc-500 font-medium leading-relaxed relative z-10 max-w-[280px]">
                    Crafting starts as soon as you share your identity brief.
                  </p>
                </div>
                <div className="p-8">
                  <IdentityForm
                    order={uploadOrder}
                    onSubmitted={() => {
                      setUploadOrder(null);
                      setIsSuccess(true);
                      successRef.current = true;

                      // Immediate redirect after submitting details
                      const finalId = uploadOrder.id;
                      setTimeout(() => {
                        router.push(`/orders/${finalId}?success=true`);
                      }, 1000);
                    }}
                  />
                </div>
              </div>
            ) : (
              <div className="text-center py-12 space-y-8 animate-in fade-in zoom-in-95 duration-700">
                <div className="space-y-4">
                  <div className="relative inline-flex flex-col items-center">
                    <div className="p-8 bg-emerald-50 rounded-[32px] border border-emerald-100/50 shadow-sm relative overflow-hidden">
                      <div className="absolute inset-0 bg-gradient-to-tr from-emerald-100/20 to-transparent animate-pulse" />
                      <p className="text-sm font-black text-emerald-700 uppercase tracking-tight relative z-10">Syncing with Partner</p>
                    </div>
                  </div>
                  <p className="text-[10px] font-black text-zinc-300 uppercase tracking-[0.2em]">Preparing your tracker...</p>
                </div>

                <div className="h-1 bg-zinc-50 rounded-full overflow-hidden w-48 mx-auto border border-zinc-100/50 shadow-inner">
                  <div className="h-full bg-zinc-950 animate-[loading-bar_1.5s_cubic-bezier(0.65,0,0.35,1)_infinite]" />
                </div>

                <div className="pt-4">
                  <button
                    onClick={() => {
                      if (uploadOrder?.id) window.location.href = `/orders/${uploadOrder.id}`;
                    }}
                    className="text-[10px] font-black text-zinc-400 hover:text-zinc-600 underline underline-offset-8 decoration-zinc-200 uppercase tracking-[0.15em] transition-all"
                  >
                    Skip to Tracker
                  </button>
                </div>
              </div>
            )}
          </div>
        </div>
      )}
    </div>
  );
}

export function CheckoutLayoutClient({ children, ...props }: CheckoutLayoutClientProps & { children?: React.ReactNode }) {
  const defaultAddressId = props.data.addresses?.find((a) => a.is_default)?.id ?? props.data.addresses?.[0]?.id ?? null;
  return (
    <CheckoutAddressProvider defaultAddressId={defaultAddressId}>
      <CheckoutLayoutClientInner {...props} />
      {children}
    </CheckoutAddressProvider>
  );
}
