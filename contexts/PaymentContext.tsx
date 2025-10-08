import React, { useState, useCallback, useMemo } from 'react';
import createContextHook from '@nkzw/create-context-hook';
import { TicketTier } from '@/types/payment';

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
      console.log('Price ID from env:', process.env.EXPO_PUBLIC_STRIPE_PRICE_ID);
      
      if (!priceId || priceId.trim() === '' || priceId === 'price_...') {
        console.error('Invalid price ID detected:', { priceId, env: process.env.EXPO_PUBLIC_STRIPE_PRICE_ID });
        throw new Error('Invalid price ID');
      }

      const supabaseUrl = process.env.EXPO_PUBLIC_SUPABASE_URL;
      if (!supabaseUrl) {
        throw new Error('Supabase URL not configured');
      }

      const edgeFunctionUrl = `${supabaseUrl}/functions/v1/create-payment-intent`;
      
      const { supabase } = await import('@/lib/supabase');
      const { data: { session } } = await supabase.auth.getSession();
      
      if (!session) {
        throw new Error('Authentication required. Please sign in and try again.');
      }
      
      const response = await fetch(edgeFunctionUrl, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${session.access_token}`,
          'apikey': process.env.EXPO_PUBLIC_SUPABASE_ANON_KEY || '',
        },
        body: JSON.stringify({
          priceId,
          userId,
          customerEmail,
          metadata: {
            source: 'mobile_app',
            timestamp: new Date().toISOString(),
          },
        }),
      });

      if (!response.ok) {
        let errorMessage = `HTTP ${response.status}`;
        try {
          const errorText = await response.text();
          console.log('Error response text:', errorText);
          
          try {
            const errorData = JSON.parse(errorText);
            errorMessage = errorData.error || errorMessage;
          } catch {
            errorMessage = errorText || errorMessage;
          }
        } catch (textError) {
          console.error('Failed to read error response:', textError);
        }
        throw new Error(errorMessage);
      }

      const responseText = await response.text();
      console.log('Success response text:', responseText);
      
      let result;
      try {
        result = JSON.parse(responseText);
      } catch {
        console.error('Failed to parse response as JSON');
        console.error('Response text (first 200 chars):', responseText.substring(0, 200));
        throw new Error('Invalid response from payment server. The edge function may not be deployed or configured correctly.');
      }

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
        if (error.message.includes('Failed to fetch')) {
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