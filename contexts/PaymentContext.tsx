import React, { useState, useMemo } from 'react';
import createContextHook from '@nkzw/create-context-hook';
import { TicketTier } from '@/types/payment';

interface PaymentContextType {
  selectedTier: TicketTier | null;
  setSelectedTier: (tier: TicketTier | null) => void;
}

const [PaymentProviderInternal, usePaymentInternal] = createContextHook((): PaymentContextType => {
  const [selectedTier, setSelectedTier] = useState<TicketTier | null>(null);

  return useMemo(() => ({
    selectedTier,
    setSelectedTier,
  }), [selectedTier]);
});

export function usePayment() {
  const context = usePaymentInternal();
  if (!context) {
    return {
      selectedTier: null,
      setSelectedTier: () => {},
    };
  }
  return context;
}

const PaymentProvider = PaymentProviderInternal;

interface PaymentWrapperProps {
  children: React.ReactNode;
}

export function PaymentWrapper({ children }: PaymentWrapperProps) {
  // All platforms now use the same PaymentProvider without Stripe React Native
  return (
    <PaymentProvider>
      {children}
    </PaymentProvider>
  );
}

export { PaymentProvider };