import React, { useState } from 'react';
import {
  StyleSheet,
  Text,
  View,
  TouchableOpacity,
  Modal,
  Alert,
  Platform,
} from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { LinearGradient } from 'expo-linear-gradient';
import { X, CreditCard, CheckCircle } from 'lucide-react-native';
import { usePayment } from '@/contexts/PaymentContext';
import { useAuth } from '@/contexts/AuthContext';
import { STRIPE_CONFIG } from '@/constants/stripe';

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
  const { createPaymentIntent, isProcessing, paymentError, clearError } = usePayment();
  const [showSuccess, setShowSuccess] = useState<boolean>(false);
  const [paymentIntentId, setPaymentIntentId] = useState<string>('');

  const handlePayment = async () => {
    if (!user) {
      Alert.alert('Authentication Required', 'Please sign in to make a payment');
      return;
    }

    try {
      clearError();
      console.log('Starting payment process with price ID:', priceId);
      
      const { paymentIntentId: intentId } = await createPaymentIntent(
        priceId,
        user.id,
        user.email
      );

      console.log('Payment intent created:', intentId);
      setPaymentIntentId(intentId);

      // For now, simulate successful payment
      // In a real implementation, you would integrate with Stripe's web SDK
      // or redirect to a Stripe Checkout session
      
      if (Platform.OS === 'web') {
        // On web, you would use Stripe.js to handle the payment
        Alert.alert(
          'Payment Ready',
          `Payment intent created: ${intentId}\n\nIn a real implementation, this would redirect to Stripe Checkout or use Stripe Elements.`,
          [
            { text: 'Cancel', style: 'cancel' },
            { 
              text: 'Simulate Success', 
              onPress: () => handlePaymentSuccess(intentId)
            }
          ]
        );
      } else {
        // On mobile, you would typically redirect to a web view with Stripe Checkout
        Alert.alert(
          'Payment Ready',
          `Payment intent created: ${intentId}\n\nIn a real implementation, this would open a WebView with Stripe Checkout.`,
          [
            { text: 'Cancel', style: 'cancel' },
            { 
              text: 'Simulate Success', 
              onPress: () => handlePaymentSuccess(intentId)
            }
          ]
        );
      }

    } catch (error) {
      console.error('Payment failed:', error);
      Alert.alert(
        'Payment Failed',
        error instanceof Error ? error.message : 'An unexpected error occurred'
      );
    }
  };

  const handlePaymentSuccess = (intentId: string) => {
    setShowSuccess(true);
    setTimeout(() => {
      setShowSuccess(false);
      onSuccess(intentId);
      onClose();
    }, 2000);
  };

  const handleClose = () => {
    clearError();
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

            {paymentError && (
              <View style={styles.errorContainer}>
                <Text style={styles.errorText}>{paymentError}</Text>
              </View>
            )}

            <TouchableOpacity
              style={[styles.payButton, isProcessing && styles.payButtonDisabled]}
              onPress={handlePayment}
              disabled={isProcessing}
            >
              <CreditCard color="#FFF" size={20} />
              <Text style={styles.payButtonText}>
                {isProcessing ? 'Processing...' : 'Pay Now'}
              </Text>
            </TouchableOpacity>
          </View>
        </View>

        <View style={styles.footer}>
          <Text style={styles.footerText}>
            Your payment information is encrypted and secure
          </Text>
          <Text style={styles.footerSubtext}>
            Price ID: {priceId}
          </Text>
        </View>
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
    alignItems: 'center',
    borderWidth: 1,
    borderColor: '#333',
  },
  paymentTitle: {
    fontSize: 24,
    fontWeight: '700',
    color: '#FFF',
    marginBottom: 8,
  },
  paymentPrice: {
    fontSize: 32,
    fontWeight: '900',
    color: '#00D4FF',
    marginBottom: 12,
  },
  paymentDescription: {
    fontSize: 16,
    color: '#888',
    textAlign: 'center',
    marginBottom: 32,
    lineHeight: 22,
  },
  errorContainer: {
    backgroundColor: '#2A1A1A',
    padding: 12,
    borderRadius: 8,
    marginBottom: 16,
    width: '100%',
    borderLeftWidth: 4,
    borderLeftColor: '#FF6B6B',
  },
  errorText: {
    fontSize: 14,
    color: '#FF6B6B',
    textAlign: 'center',
  },
  payButton: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#00D4FF',
    paddingHorizontal: 32,
    paddingVertical: 16,
    borderRadius: 12,
    width: '100%',
    justifyContent: 'center',
  },
  payButtonDisabled: {
    backgroundColor: '#666',
  },
  payButtonText: {
    fontSize: 18,
    fontWeight: '700',
    color: '#FFF',
    marginLeft: 8,
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
    marginBottom: 4,
    textAlign: 'center',
  },
  footerSubtext: {
    fontSize: 12,
    color: '#888',
    textAlign: 'center',
  },
});