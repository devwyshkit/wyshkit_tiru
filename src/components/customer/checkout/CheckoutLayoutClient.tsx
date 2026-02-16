'use client';

import { ReactNode, Suspense, useState, useCallback, useRef } from "react";
import { useRouter } from "next/navigation";
import { ChevronLeft, Loader2, Truck, Package, Check, XCircle, CreditCard, ChevronDown, ChevronUp } from "lucide-react";
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
import { ShoppingBag, RefreshCw, MapPin } from "lucide-react";
import { CartSlot } from "./slots/CartSlot";
import { AddressSlot } from "./slots/AddressSlot";

function RedirectToStore() {
  const router = useRouter();
  useEffect(() => {
    router.replace('/');
  }, [router]);
  return null;
}



import { CouponSlot } from "./slots/CouponSlot";
import { WalletSlot } from "./slots/WalletSlot";
import { CheckoutAddressProvider, useCheckoutAddress } from "./CheckoutAddressContext";
import { generateEstimatePDF } from "@/lib/services/pdf-service";
import { getPartnerInfo } from "@/lib/actions/draft-order";
import { validateGSTINAction } from "@/lib/actions/gstin";

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
  const { clearDraftOrder } = useCart();
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

  const [testCardHintExpanded, setTestCardHintExpanded] = useState(false);
  const paymentInitiatedRef = useRef(false);
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
      partner: partner || { name: 'Partner', address: 'Bangalore' },
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
          walletDiscount: data.pricing.walletDiscount || 0,
          deliveryInstructions: addressContext?.deliveryInstructions || undefined,
        }
      );

      if (response.error || !response.order) {
        throw new Error(response.error || 'Failed to create payment order');
      }

      const orderData = response.order;

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
          description: `Order for ${data.items.length} item(s)`,
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
                throw new Error(verifyResponse.error);
              }

              setIsSuccess(true);
              successRef.current = true;
              setIsProcessing(false);

              // WYSHKIT 2026: Explicitly clear cart on client to stop staleness
              await clearDraftOrder();

              // WYSHKIT 2026: Instant Redirect (No artificial delay)
              if (verifyResponse.orderId) {
                const hasPers = (verifyResponse as any).hasPersonalization;
                if (hasPers) {
                  router.push(`/orders/${verifyResponse.orderId}/upload`);
                } else {
                  router.push(`/orders/${verifyResponse.orderId}`);
                }
              } else {
                toast.success('Payment verified!');
                router.push('/orders');
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

        const razorpay = new RazorpayConstructor(options);
        razorpay.open();

        // WYSHKIT 2026: 15s Reliability Fallback
        // In case the Razorpay handler doesn't fire but payment succeeded (webhook won)
        // orderData.id is Razorpay order_id; look up by razorpay_order_id to get Supabase order.
        setTimeout(async () => {
          if (!successRef.current && paymentInitiatedRef.current) {
            toast.info('Finalizing your order...');
            const { getOrderByRazorpayOrderId } = await import('@/lib/actions/orders');
            for (let i = 0; i < 10; i++) {
              const { data: order } = await getOrderByRazorpayOrderId(orderData.id);
              if (order && order.payment_status === 'paid') {
                setIsSuccess(true);
                successRef.current = true;
                setIsProcessing(false);
                await clearDraftOrder();
                router.push(`/orders/${order.id}`);
                return;
              }
              await new Promise(r => setTimeout(r, 3000));
            }
            // If still not found, let user know
            toast.error('Taking longer than expected. Please check your orders page.');
            setIsProcessing(false);
            paymentInitiatedRef.current = false;
          }
        }, 15000);
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
  }, [authUser, data.pricing, data.items, data.appliedCoupon, data.useWallet, selectedAddressId, isProcessing, isSuccess, gstin, addressContext?.deliveryInstructions, router]);


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
                <h2 className="text-lg font-bold text-zinc-900 leading-tight tracking-tight">Secure Transaction</h2>
                <p className="text-[11px] font-bold text-zinc-400 leading-tight">Delivered from local stores</p>
              </div>
            </div>
          </header>

          <main className="flex-1 overflow-y-auto">
            <div className="flex flex-col px-5 md:px-0 py-4 divide-y divide-zinc-100 max-w-2xl mx-auto w-full">
              {/* WYSHKIT 2026: Cart always visible */}
              <section className="pb-6">
                <CartSlot initialHydratedItems={data.items as any} />
              </section>

              {/* WYSHKIT 2026: Address always visible so user can select/add one */}
              <Suspense fallback={<div className="py-8 flex items-center justify-center"><Loader2 className="size-5 animate-spin text-zinc-400" /></div>}>
                <section className="py-6 space-y-4">
                  <AddressSlot
                    initialAddresses={data.addresses as any}
                    currentAddress={data.addresses?.find(a => a.id === selectedAddressId) as any}
                  />
                  {selectedAddressId && (
                    <p className="text-xs text-zinc-500">Estimated delivery: 1–3 business days</p>
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
                      <span className="text-lg font-black text-zinc-950 tabular-nums">₹{pricing.total.toFixed(0)}</span>
                    </div>
                    <div className="space-y-3">
                      <div className="flex justify-between text-sm text-zinc-600">
                        <span>Subtotal ({items.length} item{items.length > 1 ? 's' : ''})</span>
                        <span className="tabular-nums font-semibold text-zinc-950">₹{pricing.subtotal.toFixed(0)}</span>
                      </div>
                      {personalizationTotal > 0 && (
                        <div className="flex justify-between text-sm text-zinc-600">
                          <span>Personalization</span>
                          <span className="tabular-nums font-semibold text-zinc-950">₹{personalizationTotal.toFixed(0)}</span>
                        </div>
                      )}
                      <div className="flex justify-between text-sm text-zinc-600">
                        <span className="flex items-center gap-1.5">
                          <Truck className="size-4" />
                          Delivery
                          {pricing.deliveryFee === 0 && <span className="text-[10px] text-emerald-600 font-bold px-1.5 py-0.5 bg-emerald-50 rounded-md">FREE</span>}
                        </span>
                        <span className="tabular-nums font-semibold text-zinc-950">{pricing.deliveryFee === 0 ? '₹0' : `₹${pricing.deliveryFee.toFixed(0)}`}</span>
                      </div>
                      <div className="flex justify-between text-sm text-zinc-600">
                        <span>Platform fee</span>
                        <span className="tabular-nums font-semibold text-zinc-950">₹{pricing.platformFee.toFixed(0)}</span>
                      </div>
                      <div className="flex justify-between text-sm text-zinc-600">
                        <span>GST (18%)</span>
                        <span className="tabular-nums font-semibold text-zinc-950">₹{pricing.gst.toFixed(0)}</span>
                      </div>
                    </div>

                    <div className="pt-4 border-t border-zinc-100">
                      <div className="flex justify-between items-center">
                        <span className="text-lg font-bold text-zinc-950">Sum to pay</span>
                        <span className="text-xl font-black text-zinc-950 tabular-nums">₹{pricing.total.toFixed(0)}</span>
                      </div>
                      {((pricing.discount || 0) + (pricing.walletDiscount || 0)) > 0 && (
                        <p className="text-xs font-semibold text-emerald-600 mt-1">
                          You saved ₹{((pricing.discount || 0) + (pricing.walletDiscount || 0)).toFixed(0)}
                        </p>
                      )}
                    </div>

                    <div className="pt-4 space-y-3">
                      <div className="p-3 bg-zinc-50 rounded-xl border border-zinc-100 italic">
                        <p className="text-[10px] text-zinc-500 leading-normal">
                          Note: All products are available with optional personalization. Personalized items cannot be returned unless received damaged or incorrect. 100% advance payment required for order confirmation.
                        </p>
                      </div>
                      {!gstinExpanded ? (
                        <button
                          type="button"
                          onClick={() => setGstinExpanded(true)}
                          className="text-[10px] text-zinc-400 font-semibold underline decoration-zinc-200 hover:text-zinc-600"
                        >
                          Add GSTIN (optional for tax credit)
                        </button>
                      ) : (
                        <div className="space-y-1">
                          <div className="relative">
                            <input
                              type="text"
                              inputMode="text"
                              autoCapitalize="characters"
                              autoCorrect="off"
                              value={gstin}
                              onChange={(e) => {
                                setGstin(e.target.value.toUpperCase());
                                if (gstinValidation !== 'idle') setGstinValidation('idle');
                                setGstinError(null);
                              }}
                              onBlur={handleGstinBlur}
                              placeholder="GSTIN (Optional for Tax Credit)"
                              className={cn(
                                "w-full h-10 pl-3 pr-9 bg-zinc-50 border rounded-xl text-[13px] font-semibold placeholder:text-zinc-400 focus:outline-none focus:ring-2 focus:ring-zinc-900/5 transition-all",
                                gstinValidation === 'invalid' ? "border-red-300" : "border-zinc-200"
                              )}
                            />
                            {gstinValidation === 'validating' && (
                              <Loader2 className="absolute right-3 top-1/2 -translate-y-1/2 size-3.5 text-zinc-400 animate-spin" />
                            )}
                            {gstinValidation === 'valid' && (
                              <div className="absolute right-3 top-1/2 -translate-y-1/2 bg-emerald-500 rounded-full p-0.5">
                                <Check className="size-2.5 text-white" />
                              </div>
                            )}
                            {gstinValidation === 'invalid' && (
                              <XCircle className="absolute right-3 top-1/2 -translate-y-1/2 size-3.5 text-red-500" />
                            )}
                          </div>
                          {businessName && (
                            <p className="text-[10px] text-emerald-600 font-bold mt-1 px-2 py-0.5 bg-emerald-50 rounded-lg inline-block">
                              {businessName}
                            </p>
                          )}
                          {gstinError && <p className="text-[10px] text-red-600 font-medium">{gstinError}</p>}
                        </div>
                      )}
                      <button
                        type="button"
                        onClick={handleDownloadEstimate}
                        className="text-[10px] text-zinc-400 font-semibold underline decoration-zinc-200 hover:text-zinc-600 block"
                      >
                        Download estimate (PDF)
                      </button>
                    </div>
                  </div>
                )}
              </section>

            </div>
          </main>

          {/* WYSHKIT 2026: Footer - Adjusted for null pricing */}
          <footer className="sticky bottom-0 bg-white border-t border-zinc-100 z-20">
            <div className="max-w-2xl mx-auto w-full px-4 md:px-0">
              <div className="flex items-center justify-between gap-4 py-2.5 pb-[max(0.625rem,env(safe-area-inset-bottom))]">
                <div className="flex flex-col">
                  <span className="text-xl font-bold text-zinc-950 tabular-nums">
                    {pricing ? `₹${pricing.total.toFixed(0)}` : '—'}
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
                    <div className="w-full h-16 bg-zinc-50 rounded-[24px] flex items-center justify-center border border-zinc-100">
                      <Loader2 className="size-5 animate-spin text-zinc-300" />
                    </div>
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
                            <span className="text-sm font-bold">Place Order • ₹{pricing.total.toFixed(0)}</span>
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
              {isTestMode && authUser && selectedAddressId && (
                <button
                  type="button"
                  onClick={() => setTestCardHintExpanded(!testCardHintExpanded)}
                  className="w-full mt-2 py-2 flex items-center justify-center gap-2 text-[10px] font-medium text-zinc-400 hover:text-zinc-600 transition-colors"
                >
                  <CreditCard className="size-3" />
                  Razorpay test mode
                  {testCardHintExpanded ? <ChevronUp className="size-3" /> : <ChevronDown className="size-3" />}
                </button>
              )}
              {isTestMode && authUser && selectedAddressId && testCardHintExpanded && (
                <div className="mt-1 px-3 py-2 rounded-lg bg-amber-50 border border-amber-100 text-[10px] text-amber-800 space-y-0.5">
                  <p className="font-semibold">Test card: 4111 1111 1111 1111</p>
                  <p className="text-amber-700">Expiry: any future date · CVV: any 3 digits</p>
                </div>
              )}
            </div>
          </footer>
        </div>
      )}

      {(isProcessing || isSuccess) && (
        <div className="absolute inset-0 bg-white/95 backdrop-blur-md z-[100] flex flex-col items-center justify-center p-8 text-center space-y-6">
          {isSuccess && <Confetti />}
          <div className="relative">
            <div className={cn(
              "size-20 rounded-full border-4 flex items-center justify-center shrink-0",
              isSuccess ? "border-emerald-100 bg-emerald-50" : "border-zinc-50"
            )}>
              {isSuccess ? (
                <div className="scale-in">
                  <Check className="size-10 text-emerald-600" />
                </div>
              ) : (
                <Loader2 className="size-8 text-zinc-900 animate-spin" />
              )}
            </div>
          </div>
          <div className="space-y-2">
            <h3 className="text-xl font-bold text-zinc-900 tracking-tight">
              {isSuccess ? "Order Placed Successfully!" : "Securing your order"}
            </h3>
            <p className="text-sm font-medium text-zinc-500 leading-snug max-w-[240px]">
              {isSuccess
                ? "Redirecting you to tracking..."
                : "We're processing your transaction securely. Please don't close this window."
              }
            </p>

            {/* WYSHKIT 2026: Immediate Manual Control (Anti-Hang) */}
            {isSuccess && (
              <div className="pt-4 animate-in fade-in zoom-in duration-300">
                <button
                  onClick={() => router.push('/orders')}
                  className="px-6 py-3 bg-zinc-900 text-white text-sm font-bold rounded-xl shadow-lg shadow-zinc-900/10 active:scale-95 transition-all"
                >
                  View Order
                </button>
              </div>
            )}

            {/* WYSHKIT 2026: Recovery Link (Prevent hang frustration) */}
            {!isSuccess && (
              <div className="pt-2 animate-in fade-in duration-1000 delay-500">
                <button
                  onClick={() => router.push('/orders')}
                  className="text-[10px] font-bold text-zinc-400 uppercase tracking-widest hover:text-zinc-900 transition-colors"
                >
                  Taking too long? Track order
                </button>
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
