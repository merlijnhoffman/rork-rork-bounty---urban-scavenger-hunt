import React, { useState, useEffect, useRef } from 'react';
import {
  StyleSheet,
  Text,
  View,
  TouchableOpacity,
  ActivityIndicator,
  Platform,
} from 'react-native';
import { loadStripe, Stripe, StripeElements } from '@stripe/stripe-js';

interface StripePaymentWebProps {
  clientSecret: string;
  publishableKey: string;
  onSuccess: (paymentIntentId: string) => void;
  onError: (error: string) => void;
}

export default function StripePaymentWeb({
  clientSecret,
  publishableKey,
  onSuccess,
  onError,
}: StripePaymentWebProps) {
  const [stripe, setStripe] = useState<Stripe | null>(null);
  const [elements, setElements] = useState<StripeElements | null>(null);
  const containerRef = useRef<View | null>(null);
  const paymentElementRef = useRef<any>(null);
  const [loading, setLoading] = useState<boolean>(true);
  const [processing, setProcessing] = useState<boolean>(false);
  const [errorMessage, setErrorMessage] = useState<string>('');

  useEffect(() => {
    if (Platform.OS !== 'web') {
      return;
    }

    const initializeStripe = async () => {
      try {
        const stripeInstance = await loadStripe(publishableKey);
        
        if (!stripeInstance) {
          throw new Error('Failed to load Stripe');
        }

        setStripe(stripeInstance);

        const elementsInstance = stripeInstance.elements({
          clientSecret,
          appearance: {
            theme: 'night',
            variables: {
              colorPrimary: '#00D4FF',
              colorBackground: '#1A1A1A',
              colorText: '#FFF',
              colorDanger: '#FF6B6B',
              fontFamily: '-apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, sans-serif',
              borderRadius: '12px',
            },
          },
        });

        setElements(elementsInstance);

        const paymentElement = elementsInstance.create('payment');
        paymentElementRef.current = paymentElement;
        
        setTimeout(() => {
          const el = document.getElementById('stripe-payment-element');
          if (!el) {
            console.error('Payment container not found');
            onError('Failed to initialize payment form');
            setLoading(false);
            return;
          }
          
          try {
            paymentElement.mount('#stripe-payment-element');
            setLoading(false);
          } catch (mountError) {
            console.error('Error mounting payment element:', mountError);
            onError('Failed to initialize payment form');
            setLoading(false);
          }
        }, 100);
      } catch (error) {
        console.error('Error initializing Stripe:', error);
        onError('Failed to initialize payment form');
        setLoading(false);
      }
    };

    initializeStripe();
  }, [clientSecret, publishableKey, onError]);

  const handleSubmit = async () => {
    if (!stripe || !elements) {
      return;
    }

    setProcessing(true);
    setErrorMessage('');

    try {
      const { error, paymentIntent } = await stripe.confirmPayment({
        elements,
        confirmParams: {
          return_url: window.location.href,
        },
        redirect: 'if_required',
      });

      if (error) {
        setErrorMessage(error.message || 'Payment failed');
        onError(error.message || 'Payment failed');
        setProcessing(false);
      } else if (paymentIntent && paymentIntent.status === 'succeeded') {
        onSuccess(paymentIntent.id);
      } else {
        setErrorMessage('Payment processing failed. Please try again.');
        setProcessing(false);
      }
    } catch (error) {
      console.error('Payment error:', error);
      setErrorMessage('An unexpected error occurred');
      onError('An unexpected error occurred');
      setProcessing(false);
    }
  };

  if (Platform.OS !== 'web') {
    return null;
  }

  return (
    <View style={styles.container}>
      {loading ? (
        <View style={styles.loadingContainer}>
          <ActivityIndicator size="large" color="#00D4FF" />
          <Text style={styles.loadingText}>Loading payment form...</Text>
        </View>
      ) : (
        <View style={styles.formContainer}>
          <View 
            ref={containerRef}
            nativeID="stripe-payment-element"
            style={styles.paymentElementContainer}
          />
          
          {errorMessage ? (
            <View style={styles.errorContainer}>
              <Text style={styles.errorText}>{errorMessage}</Text>
            </View>
          ) : null}

          <TouchableOpacity
            style={[styles.submitButton, processing && styles.submitButtonDisabled]}
            onPress={handleSubmit}
            disabled={processing || !stripe || !elements}
          >
            {processing ? (
              <View style={styles.buttonContent}>
                <ActivityIndicator size="small" color="#FFF" style={{ marginRight: 8 }} />
                <Text style={styles.submitButtonText}>Processing...</Text>
              </View>
            ) : (
              <Text style={styles.submitButtonText}>Pay Now</Text>
            )}
          </TouchableOpacity>
        </View>
      )}
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    padding: 20,
  },
  loadingContainer: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
  },
  loadingText: {
    marginTop: 16,
    fontSize: 16,
    color: '#888',
  },
  errorContainer: {
    backgroundColor: '#2A1A1A',
    padding: 12,
    borderRadius: 8,
    marginBottom: 16,
    borderLeftWidth: 4,
    borderLeftColor: '#FF6B6B',
  },
  errorText: {
    fontSize: 14,
    color: '#FF6B6B',
  },
  submitButton: {
    width: '100%',
    padding: 16,
    backgroundColor: '#00D4FF',
    borderRadius: 12,
    alignItems: 'center',
    justifyContent: 'center',
  },
  submitButtonDisabled: {
    backgroundColor: '#666',
  },
  submitButtonText: {
    fontSize: 16,
    fontWeight: '700',
    color: '#FFF',
  },
  buttonContent: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
  },
  formContainer: {
    flex: 1,
  },
  paymentElementContainer: {
    minHeight: 200,
    marginBottom: 24,
  },
});
