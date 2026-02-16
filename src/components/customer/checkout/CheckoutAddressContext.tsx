'use client';

import { createContext, useContext, useState, ReactNode } from 'react';

interface CheckoutAddressContextType {
  selectedAddressId: string | null;
  setSelectedAddressId: (id: string | null) => void;
  deliveryInstructions: string;
  setDeliveryInstructions: (value: string) => void;
}

const CheckoutAddressContext = createContext<CheckoutAddressContextType | null>(null);

export function useCheckoutAddress() {
  return useContext(CheckoutAddressContext);
}

export function CheckoutAddressProvider({ children, defaultAddressId }: { children: ReactNode; defaultAddressId?: string | null }) {
  const [selectedAddressId, setSelectedAddressId] = useState<string | null>(defaultAddressId ?? null);
  const [deliveryInstructions, setDeliveryInstructions] = useState('');
  return (
    <CheckoutAddressContext.Provider value={{ selectedAddressId, setSelectedAddressId, deliveryInstructions, setDeliveryInstructions }}>
      {children}
    </CheckoutAddressContext.Provider>
  );
}
