import React, { useState, useCallback, useMemo } from 'react';
import createContextHook from '@nkzw/create-context-hook';
import { PaymentResult, TicketTier } from '@/types/payment';
import { useUserStore } from '@/store/user-store';


interface PaymentContextType {
  selectedTier: TicketTier | null;
  setSelectedTier: (tier: TicketTier | null) => void;
  processPayment: (tier: TicketTier) => Promise<PaymentResult>;
  isProcessing: boolean;
  paymentError: string | null;
  clearError: () => void;
}

export const [PaymentProvider, usePayment] = createContextHook((): PaymentContextType => {
  const { user } = useUserStore();
  const [selectedTier, setSelectedTier] = useState<TicketTier | null>(null);
  const [isProcessing, setIsProcessing] = useState<boolean>(false);
  const [paymentError, setPaymentError] = useState<string | null>(null);

  const clearError = useCallback(() => setPaymentError(null), []);



  const processPayment = useCallback(async (tier: TicketTier): Promise<PaymentResult> => {
    if (!user) {
      const error = 'User must be logged in to make a payment';
      setPaymentError(error);
      return { success: false, error };
    }

    setIsProcessing(true);
    setPaymentError(null);

    try {
      // All payments are now handled by the PaymentSheet component
      // This context just manages state
      const error = 'Payments should be handled by PaymentSheet component';
      setPaymentError(error);
      return { success: false, error };

    } catch (error) {
      console.error('Payment processing error:', error);
      const errorMessage = error instanceof Error ? error.message : 'Payment failed';
      setPaymentError(errorMessage);
      return { success: false, error: errorMessage };
    } finally {
      setIsProcessing(false);
    }
  }, [user]);

  return useMemo(() => ({
    selectedTier,
    setSelectedTier,
    processPayment,
    isProcessing,
    paymentError,
    clearError,
  }), [selectedTier, processPayment, isProcessing, paymentError, clearError]);
});

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