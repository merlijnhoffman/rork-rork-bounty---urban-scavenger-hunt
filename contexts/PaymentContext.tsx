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
      
      // Validate required inputs
      if (!priceId) {
        throw new Error('Price ID is required');
      }
      
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
      
      if (!result.clientSecret) {
        throw new Error('Invalid payment intent response - missing client secret');
      }
      
      return {
        clientSecret: result.clientSecret,
        paymentIntentId: result.paymentIntentId,
      };
    } catch (error) {
      console.error('Payment intent creation error:', error);
      
      let errorMessage = 'Failed to create payment intent';
      
      if (error instanceof Error) {
        if (error.message.includes('Unable to connect to backend server')) {
          errorMessage = 'Backend server is not running. Please start the server and try again.';
        } else if (error.message.includes('Unable to connect to server')) {
          errorMessage = 'Unable to connect to payment server. Please check your internet connection and try again.';
        } else if (error.message.includes('Failed to fetch')) {
          errorMessage = 'Network error. Please check your connection and try again.';
        } else if (error.message.includes('HTTP 500')) {
          errorMessage = 'Payment server error. Please try again later.';
        } else if (error.message.includes('HTTP 401')) {
          errorMessage = 'Authentication error. Please sign in and try again.';
        } else if (error.message.includes('HTTP 400')) {
          errorMessage = 'Invalid payment request. Please check your details and try again.';
        } else {
          errorMessage = error.message;
        }
      }
      
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