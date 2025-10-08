import React, { useState, useEffect } from 'react';
import {
  StyleSheet,
  Text,
  View,
  TouchableOpacity,
  Modal,
  Alert,
  Platform,
  ActivityIndicator,
} from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { LinearGradient } from 'expo-linear-gradient';
import { X, CreditCard, CheckCircle } from 'lucide-react-native';
import { usePayment } from '@/contexts/PaymentContext';
import { useAuth } from '@/contexts/AuthContext';
import { STRIPE_CONFIG } from '@/constants/stripe';
import StripePaymentWebView from './StripePaymentWebView';
import StripePaymentWeb from './StripePaymentWeb';

interface StripePaymentProps {
  visible: boolean;
  onClose: () => void;
  onSuccess: (paymentIntentId: string) => void;
  priceId?: string;
  amount?: number;
  currency?: string;
  description?: string;
}

export default function StripePayment({
  visible,
  onClose,
  onSuccess,
  priceId = STRIPE_CONFIG.priceId,
  amount = STRIPE_CONFIG.amount,
  currency = STRIPE_CONFIG.currency,
  description = 'Hunt Ticket',
}: StripePaymentProps) {
  const insets = useSafeAreaInsets();
  const { user } = useAuth();
  const { createPaymentIntent, isProcessing, clearError } = usePayment();
  const [showSuccess, setShowSuccess] = useState<boolean>(false);
  const [paymentIntentId, setPaymentIntentId] = useState<string>('');
  const [clientSecret, setClientSecret] = useState<string>('');
  const [isInitializing, setIsInitializing] = useState<boolean>(false);
  const [initError, setInitError] = useState<string>('');

  useEffect(() => {
    if (visible && !clientSecret) {
      initializePayment();
    }
  }, [visible, clientSecret]);

  const initializePayment = async () => {
    if (!user) {
      Alert.alert('Authentication Required', 'Please sign in to make a payment');
      onClose();
      return;
    }

    setIsInitializing(true);
    setInitError('');
    clearError();

    try {
      console.log('Initializing payment with price ID:', priceId);
      
      const { clientSecret: secret, paymentIntentId: intentId } = await createPaymentIntent(
        priceId,
        user.id,
        user.email
      );

      console.log('Payment intent created:', intentId);
      setClientSecret(secret);
      setPaymentIntentId(intentId);
    } catch (error) {
      console.error('Payment initialization failed:', error);
      const errorMsg = error instanceof Error ? error.message : 'Failed to initialize payment';
      setInitError(errorMsg);
      Alert.alert(
        'Payment Initialization Failed',
        errorMsg + '\n\nPlease try again.',
        [
          { text: 'Close', onPress: onClose }
        ]
      );
    } finally {
      setIsInitializing(false);
    }
  };

  const handlePaymentSuccess = (intentId: string) => {
    console.log('Payment successful:', intentId);
    setShowSuccess(true);
    setTimeout(() => {
      setShowSuccess(false);
      setClientSecret('');
      setPaymentIntentId('');
      onSuccess(intentId);
      onClose();
    }, 2000);
  };

  const handlePaymentError = (error: string) => {
    console.error('Payment error:', error);
    Alert.alert('Payment Failed', error);
  };

  const handleClose = () => {
    if (isProcessing || isInitializing) {
      Alert.alert(
        'Payment in Progress',
        'Please wait for the payment to complete before closing.',
        [{ text: 'OK' }]
      );
      return;
    }
    clearError();
    setClientSecret('');
    setPaymentIntentId('');
    setInitError('');
    onClose();
  };

  if (showSuccess) {
    return (
      <Modal
        visible={visible}
        animationType="slide"
        presentationStyle="pageSheet"
        onRequestClose={handleClose}
      >
        <LinearGradient
          colors={['#0A0A0A', '#1A1A1A']}
          style={[styles.container, { paddingTop: insets.top }]}
        >
          <View style={styles.successContainer}>
            <CheckCircle color="#00D4FF" size={80} />
            <Text style={styles.successTitle}>Payment Successful!</Text>
            <Text style={styles.successMessage}>
              Your payment has been processed successfully.
              Payment ID: {paymentIntentId}
            </Text>
          </View>
        </LinearGradient>
      </Modal>
    );
  }

  return (
    <Modal
      visible={visible}
      animationType="slide"
      presentationStyle="pageSheet"
      onRequestClose={handleClose}
    >
      <LinearGradient
        colors={['#0A0A0A', '#1A1A1A']}
        style={[styles.container, { paddingTop: insets.top }]}
      >
        <View style={styles.header}>
          <View style={styles.headerContent}>
            <CreditCard color="#00D4FF" size={24} />
            <Text style={styles.headerTitle}>Secure Payment</Text>
          </View>
          <TouchableOpacity style={styles.closeButton} onPress={handleClose}>
            <X color="#FFF" size={24} />
          </TouchableOpacity>
        </View>

        <View style={styles.content}>
          <View style={styles.paymentCard}>
            <Text style={styles.paymentTitle}>{description}</Text>
            <Text style={styles.paymentPrice}>
              {currency.toUpperCase()} {(amount / 100).toFixed(2)}
            </Text>
            <Text style={styles.paymentDescription}>
              Secure payment powered by Stripe
            </Text>

            {(isInitializing || !clientSecret) && !initError ? (
              <View style={styles.loadingContainer}>
                <ActivityIndicator size="large" color="#00D4FF" />
                <Text style={styles.loadingText}>Preparing payment...</Text>
              </View>
            ) : initError ? (
              <View style={styles.errorContainer}>
                <Text style={styles.errorText}>{initError}</Text>
                <TouchableOpacity
                  style={styles.retryButton}
                  onPress={initializePayment}
                >
                  <Text style={styles.retryButtonText}>Retry</Text>
                </TouchableOpacity>
              </View>
            ) : (
              <View style={styles.paymentFormContainer}>
                {Platform.OS === 'web' ? (
                  <StripePaymentWeb
                    clientSecret={clientSecret}
                    publishableKey={STRIPE_CONFIG.publishableKey}
                    onSuccess={handlePaymentSuccess}
                    onError={handlePaymentError}
                  />
                ) : (
                  <StripePaymentWebView
                    clientSecret={clientSecret}
                    publishableKey={STRIPE_CONFIG.publishableKey}
                    onSuccess={handlePaymentSuccess}
                    onError={handlePaymentError}
                  />
                )}
              </View>
            )}
          </View>
        </View>

        {!isInitializing && clientSecret && (
          <View style={styles.footer}>
            <Text style={styles.footerText}>
              Your payment information is encrypted and secure
            </Text>
          </View>
        )}
      </LinearGradient>
    </Modal>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
  },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: 20,
    paddingVertical: 16,
    borderBottomWidth: 1,
    borderBottomColor: '#333',
  },
  headerContent: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  headerTitle: {
    fontSize: 20,
    fontWeight: '700',
    color: '#FFF',
    marginLeft: 12,
  },
  closeButton: {
    padding: 8,
  },
  content: {
    flex: 1,
    padding: 20,
    justifyContent: 'center',
  },
  paymentCard: {
    backgroundColor: '#1A1A1A',
    borderRadius: 16,
    padding: 24,
    borderWidth: 1,
    borderColor: '#333',
    flex: 1,
  },
  paymentTitle: {
    fontSize: 24,
    fontWeight: '700',
    color: '#FFF',
    marginBottom: 8,
    textAlign: 'center',
  },
  paymentPrice: {
    fontSize: 32,
    fontWeight: '900',
    color: '#00D4FF',
    marginBottom: 12,
    textAlign: 'center',
  },
  paymentDescription: {
    fontSize: 16,
    color: '#888',
    textAlign: 'center',
    marginBottom: 32,
    lineHeight: 22,
  },
  loadingContainer: {
    marginTop: 32,
    alignItems: 'center',
    justifyContent: 'center',
    padding: 40,
  },
  loadingText: {
    marginTop: 16,
    fontSize: 16,
    color: '#888',
  },
  errorContainer: {
    backgroundColor: '#2A1A1A',
    padding: 16,
    borderRadius: 8,
    marginTop: 24,
    borderLeftWidth: 4,
    borderLeftColor: '#FF6B6B',
    alignItems: 'center',
  },
  errorText: {
    fontSize: 14,
    color: '#FF6B6B',
    textAlign: 'center',
    marginBottom: 12,
  },
  retryButton: {
    backgroundColor: '#00D4FF',
    paddingHorizontal: 24,
    paddingVertical: 12,
    borderRadius: 8,
    marginTop: 8,
  },
  retryButtonText: {
    color: '#FFF',
    fontSize: 14,
    fontWeight: '700',
  },
  paymentFormContainer: {
    flex: 1,
    marginTop: 24,
  },

  successContainer: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    padding: 40,
  },
  successTitle: {
    fontSize: 32,
    fontWeight: '900',
    color: '#FFF',
    textAlign: 'center',
    marginTop: 24,
    marginBottom: 16,
  },
  successMessage: {
    fontSize: 16,
    color: '#888',
    textAlign: 'center',
    lineHeight: 24,
    maxWidth: 300,
  },
  footer: {
    padding: 20,
    alignItems: 'center',
    borderTopWidth: 1,
    borderTopColor: '#333',
  },
  footerText: {
    fontSize: 14,
    fontWeight: '600',
    color: '#00D4FF',
    textAlign: 'center',
  },
});