"use client";

import { useState, useEffect } from "react";
import { FulfilmentBlock } from "@/components/customer/checkout/blocks/FulfilmentBlock";
import { useCheckoutAddress } from "@/components/customer/checkout/CheckoutAddressContext";
import { useAuth } from "@/hooks/useAuth";
import { MapPin, Check, Home, Briefcase, ChevronDown, ChevronUp } from "lucide-react";

import type { Address } from "@/lib/types/address";

interface AddressSlotProps {
  initialAddresses?: Address[];
  currentAddress?: Address;
}

/**
 * WYSHKIT 2026: AddressSlot - Inline expandable (Swiggy pattern, no sheet)
 * GSTIN/estimate in Bill Summary per Blinkit
 */
export function AddressSlot({ initialAddresses, currentAddress }: AddressSlotProps) {
  const { user } = useAuth();
  const { setSelectedAddressId } = useCheckoutAddress() ?? {};
  const [isExpanded, setIsExpanded] = useState(false);
  const [addressState, setLocalAddressState] = useState({
    address: currentAddress || null,
    committed: !!currentAddress
  });

  useEffect(() => {
    if (addressState.committed && addressState.address?.id && setSelectedAddressId) {
      setSelectedAddressId(addressState.address.id);
    }
  }, [addressState.committed, addressState.address?.id, setSelectedAddressId]);

  const handleCommit = (addr: Address | null) => {
    setLocalAddressState({ address: addr ?? null, committed: !!addr });
    if (addr) {
      setSelectedAddressId?.(addr.id);
      setIsExpanded(false);
    }
  };

  const addr = addressState.address;
  const Icon = addr?.type === 'home' ? Home : addr?.type === 'work' ? Briefcase : MapPin;

  return (
    <div className="space-y-2">
      {addressState.committed && addressState.address ? (
        <>
          <div className="flex items-center justify-between">
            <label className="text-[10px] font-bold uppercase tracking-widest text-zinc-400">Delivering to</label>
            <button
              onClick={() => setIsExpanded(!isExpanded)}
              className="text-xs font-bold text-zinc-900 active:opacity-50 flex items-center gap-1"
            >
              {isExpanded ? 'Collapse' : 'Change'}
              {isExpanded ? <ChevronUp className="size-3.5" /> : <ChevronDown className="size-3.5" />}
            </button>
          </div>
          <div className="p-4 bg-zinc-50 rounded-2xl flex items-start gap-4 border border-zinc-100">
            <div className="size-10 rounded-xl bg-white border border-zinc-100 flex items-center justify-center shrink-0 shadow-sm">
              <Icon className="size-5 text-zinc-600" />
            </div>
            <div className="flex-1 min-w-0">
              <div className="flex items-center gap-2">
                <p className="text-[15px] font-bold text-zinc-900 truncate">{addressState.address.name}</p>
                <Check className="size-4 text-emerald-500 shrink-0" />
              </div>
              <p className="text-xs text-zinc-500 leading-relaxed mt-1 line-clamp-2 font-medium">
                {addressState.address.address_line1}{addressState.address.city ? `, ${addressState.address.city}` : ''} {addressState.address.pincode || ''}
              </p>
            </div>
          </div>
          {isExpanded && (
            <div className="pt-2 border-t border-zinc-100">
              <FulfilmentBlock
                addressState={{ address: null, committed: false }}
                onCommit={handleCommit}
                userId={user?.id || null}
                initialAddresses={initialAddresses}
                initialSelectedAddressId={addr?.id}
              />
            </div>
          )}
        </>
      ) : (
        <FulfilmentBlock
          addressState={addressState}
          onCommit={handleCommit}
          userId={user?.id || null}
          initialAddresses={initialAddresses}
        />
      )}
    </div>
  );
}
