'use client';

import { useRouter } from "next/navigation";
import { useEffect } from "react";
import { Loader2 } from "lucide-react";
import { CheckoutLayoutClient } from "./CheckoutLayoutClient";
import { CheckoutContent } from "./CheckoutContent";
import { CheckoutData } from "@/lib/actions/checkout";

interface CheckoutLayoutWrapperProps {
  children?: React.ReactNode;
  checkoutData: CheckoutData;
}

/**
 * WYSHKIT 2026: Checkout Layout Wrapper
 * 
 * Swiggy 2026 Pattern: "Data Should Come to User"
 * - Receives unified checkoutData from Server Component
 * - Manages high-level routing (redirect if empty)
 * - Passes data down to layout shell
 */
export function CheckoutLayoutWrapper({
  children,
  checkoutData,
}: CheckoutLayoutWrapperProps) {
  const router = useRouter();

  useEffect(() => {
    // If no items, or if the error is specifically 'Cart is empty', redirect home
    // We wait a bit to allow success redirects to take precedence
    const isCartEmpty = !checkoutData.items || checkoutData.items.length === 0;
    const isCartEmptyError = checkoutData.error === 'Cart is empty';

    if ((!checkoutData.error && isCartEmpty) || isCartEmptyError) {
      const timer = setTimeout(() => {
        router.push('/');
      }, 2000);
      return () => clearTimeout(timer);
    }
  }, [checkoutData.items, checkoutData.error, router]);

  // If there's an error, BUT it's just 'Cart is empty', we still render 
  // because we might be in the success transition where the cart was cleared.
  if (checkoutData.error && checkoutData.error !== 'Cart is empty') {
    return (
      <div className="flex flex-col items-center justify-center py-20 px-4 text-center">
        <div className="size-16 rounded-full bg-rose-50 flex items-center justify-center mb-4">
          <div className="size-10 rounded-full bg-rose-100 flex items-center justify-center text-[#D91B24] font-bold">!</div>
        </div>
        <h2 className="text-lg font-bold text-zinc-900 mb-2">Checkout Error</h2>
        <p className="text-sm text-zinc-500 mb-8 max-w-xs mx-auto">
          {`We encountered a problem: ${checkoutData.error}`}
        </p>
        <button
          onClick={() => router.push('/')}
          className="px-8 py-3 bg-[#D91B24] text-white rounded-xl font-bold text-sm active:scale-95 transition-all shadow-lg shadow-rose-900/10"
        >
          Back to Store
        </button>
      </div>
    );
  }

  return (
    <CheckoutLayoutClient data={checkoutData}>
      <CheckoutContent data={checkoutData} />
      {children}
    </CheckoutLayoutClient>
  );
}
