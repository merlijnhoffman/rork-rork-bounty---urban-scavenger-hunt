import React, { useState, useCallback, useMemo } from 'react';
import createContextHook from '@nkzw/create-context-hook';
import { Platform } from 'react-native';
import { PaymentResult, TicketTier, PaymentIntent } from '@/types/payment';
import { useUserStore } from '@/store/user-store';
import { STRIPE_CONFIG, StripeProvider, initPaymentSheet, presentPaymentSheet } from '@/constants/stripe';

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

  const createPaymentIntent = useCallback(async (tier: TicketTier): Promise<PaymentIntent> => {
    try {
      const response = await fetch('https://your-backend.com/api/create-payment-intent', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          amount: tier.price * 100, // Convert to cents
          currency: tier.currency.toLowerCase(),
          userId: user?.id,
          tierName: tier.name,
          stripePriceId: tier.stripePriceId,
        }),
      });

      if (!response.ok) {
        throw new Error('Failed to create payment intent');
      }

      const data = await response.json();
      return data.paymentIntent;
    } catch (error) {
      console.error('Error creating payment intent:', error);
      
      // Mock payment intent for development
      return {
        id: `pi_mock_${Date.now()}`,
        clientSecret: `pi_mock_${Date.now()}_secret_mock`,
        amount: tier.price * 100,
        currency: tier.currency.toLowerCase(),
        status: 'requires_payment_method'
      };
    }
  }, [user]);

  const processPayment = useCallback(async (tier: TicketTier): Promise<PaymentResult> => {
    if (!user) {
      const error = 'User must be logged in to make a payment';
      setPaymentError(error);
      return { success: false, error };
    }

    setIsProcessing(true);
    setPaymentError(null);

    try {
      if (Platform.OS === 'web') {
        // On web, we don't process payments directly in the context
        // The PaymentSheet component handles web payments
        const error = 'Web payments should be handled by PaymentSheet component';
        setPaymentError(error);
        return { success: false, error };
      }

      // Native payment processing
      if (!initPaymentSheet || !presentPaymentSheet) {
        throw new Error('Stripe payment sheet not available');
      }

      // Create payment intent
      const paymentIntent = await createPaymentIntent(tier);

      // Initialize payment sheet
      const { error: initError } = await initPaymentSheet({
        merchantDisplayName: 'Bounty Hunt',
        paymentIntentClientSecret: paymentIntent.clientSecret,
        defaultBillingDetails: {
          name: user.email,
          email: user.email,
        },
        allowsDelayedPaymentMethods: false,
        returnURL: Platform.OS === 'ios' ? 'bounty-app://payment-return' : undefined,
      });

      if (initError) {
        console.error('Payment sheet initialization error:', initError);
        setPaymentError(initError.message);
        return { success: false, error: initError.message };
      }

      // Present payment sheet
      const { error: presentError } = await presentPaymentSheet();

      if (presentError) {
        console.error('Payment sheet presentation error:', presentError);
        if (presentError.code !== 'Canceled') {
          setPaymentError(presentError.message);
          return { success: false, error: presentError.message };
        }
        return { success: false, error: 'Payment cancelled' };
      }

      // Payment successful
      console.log('Payment successful for tier:', tier.name);
      return { success: true, paymentIntent };

    } catch (error) {
      console.error('Payment processing error:', error);
      const errorMessage = error instanceof Error ? error.message : 'Payment failed';
      setPaymentError(errorMessage);
      return { success: false, error: errorMessage };
    } finally {
      setIsProcessing(false);
    }
  }, [user, createPaymentIntent]);

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
  if (Platform.OS === 'web' || !StripeProvider) {
    // On web or when Stripe is not available, just use the PaymentProvider
    return (
      <PaymentProvider>
        {children}
      </PaymentProvider>
    );
  }

  // On native platforms with Stripe available
  return (
    <StripeProvider
      publishableKey={STRIPE_CONFIG.publishableKey}
      merchantIdentifier={STRIPE_CONFIG.merchantIdentifier}
      urlScheme={STRIPE_CONFIG.urlScheme}
    >
      <PaymentProvider>
        {children}
      </PaymentProvider>
    </StripeProvider>
  );
}