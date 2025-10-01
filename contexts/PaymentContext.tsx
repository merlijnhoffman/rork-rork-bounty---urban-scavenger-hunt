import React, { useState, useCallback, useMemo } from 'react';
import createContextHook from '@nkzw/create-context-hook';
import { TicketTier } from '@/types/payment';
import { trpcClient } from '@/lib/trpc';

interface PaymentContextType {
  selectedTier: TicketTier | null;
  setSelectedTier: (tier: TicketTier | null) => void;
  createPaymentIntent: (priceId: string, userId?: string, customerEmail?: string) => Promise<{ clientSecret: string; paymentIntentId: string }>;
  isProcessing: boolean;
  paymentError: string | null;
  clearError: () => void;
}

const [PaymentProviderInternal, usePaymentInternal] = createContextHook((): PaymentContextType => {
  const [selectedTier, setSelectedTier] = useState<TicketTier | null>(null);
  const [isProcessing, setIsProcessing] = useState<boolean>(false);
  const [paymentError, setPaymentError] = useState<string | null>(null);

  const clearError = useCallback(() => setPaymentError(null), []);



  const createPaymentIntent = useCallback(async (
    priceId: string, 
    userId?: string, 
    customerEmail?: string
  ): Promise<{ clientSecret: string; paymentIntentId: string }> => {
    setIsProcessing(true);
    setPaymentError(null);

    try {
      console.log('Creating payment intent for price:', priceId);
      
      const result = await trpcClient.payment.createIntent.mutate({
        priceId,
        userId,
        customerEmail,
        metadata: {
          source: 'mobile_app',
          timestamp: new Date().toISOString(),
        },
      });

      console.log('Payment intent created:', result.paymentIntentId);
      
      return {
        clientSecret: result.clientSecret!,
        paymentIntentId: result.paymentIntentId,
      };
    } catch (error) {
      console.error('Payment intent creation error:', error);
      const errorMessage = error instanceof Error ? error.message : 'Failed to create payment intent';
      setPaymentError(errorMessage);
      throw new Error(errorMessage);
    } finally {
      setIsProcessing(false);
    }
  }, []);

  return useMemo(() => ({
    selectedTier,
    setSelectedTier,
    createPaymentIntent,
    isProcessing,
    paymentError,
    clearError,
  }), [selectedTier, createPaymentIntent, isProcessing, paymentError, clearError]);
});

// Safe wrapper hook that ensures the context is available
export function usePayment() {
  const context = usePaymentInternal();
  if (!context) {
    // Return default values instead of throwing error to prevent crashes
    return {
      selectedTier: null,
      setSelectedTier: () => {},
      createPaymentIntent: async () => { throw new Error('Payment context not available'); },
      isProcessing: false,
      paymentError: null,
      clearError: () => {},
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