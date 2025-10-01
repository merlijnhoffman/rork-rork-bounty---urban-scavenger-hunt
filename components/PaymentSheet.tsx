import React, { useState } from 'react';
import {
  StyleSheet,
  Text,
  View,
  TouchableOpacity,
  Modal,
  Alert,
} from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { LinearGradient } from 'expo-linear-gradient';
import { X, CreditCard, AlertCircle, CheckCircle } from 'lucide-react-native';
import PriceSelection from './PriceSelection';
import { usePayment } from '@/contexts/PaymentContext';
import { TicketTier } from '@/types/payment';

interface PaymentSheetProps {
  visible: boolean;
  onClose: () => void;
  onSuccess: (tier: TicketTier) => void;
}

export default function PaymentSheet({
  visible,
  onClose,
  onSuccess,
}: PaymentSheetProps) {
  const insets = useSafeAreaInsets();
  const {
    selectedTier,
    setSelectedTier,
    processPayment,
    isProcessing,
    paymentError,
    clearError,
  } = usePayment();

  const [showSuccess, setShowSuccess] = useState<boolean>(false);

  const handleTierSelect = (tier: TicketTier) => {
    setSelectedTier(tier);
    clearError();
  };

  const handlePurchase = async (tier: TicketTier) => {
    try {
      const result = await processPayment(tier);
      
      if (result.success) {
        setShowSuccess(true);
        setTimeout(() => {
          setShowSuccess(false);
          onSuccess(tier);
          onClose();
        }, 2000);
      } else {
        Alert.alert(
          'Payment Failed',
          result.error || 'Something went wrong. Please try again.',
          [{ text: 'OK', onPress: clearError }]
        );
      }
    } catch (error) {
      console.error('Payment error:', error);
      Alert.alert(
        'Payment Error',
        'An unexpected error occurred. Please try again.',
        [{ text: 'OK', onPress: clearError }]
      );
    }
  };

  const handleClose = () => {
    if (isProcessing) {
      Alert.alert(
        'Payment in Progress',
        'Please wait for the payment to complete.',
        [{ text: 'OK' }]
      );
      return;
    }
    
    clearError();
    setSelectedTier(null);
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
              Your {selectedTier?.name} ticket has been purchased successfully.
              Get ready for an amazing hunt experience!
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
            <Text style={styles.headerTitle}>Purchase Ticket</Text>
          </View>
          <TouchableOpacity
            style={styles.closeButton}
            onPress={handleClose}
            disabled={isProcessing}
          >
            <X color="#FFF" size={24} />
          </TouchableOpacity>
        </View>

        {paymentError && (
          <View style={styles.errorContainer}>
            <AlertCircle color="#FF6B6B" size={20} />
            <Text style={styles.errorText}>{paymentError}</Text>
            <TouchableOpacity
              style={styles.errorCloseButton}
              onPress={clearError}
            >
              <X color="#FF6B6B" size={16} />
            </TouchableOpacity>
          </View>
        )}

        <PriceSelection
          selectedTier={selectedTier}
          onSelectTier={handleTierSelect}
          onPurchase={handlePurchase}
          isProcessing={isProcessing}
          disabled={isProcessing}
        />

        <View style={styles.footer}>
          <Text style={styles.footerText}>
            Secure payment powered by Stripe
          </Text>
          <Text style={styles.footerSubtext}>
            Your payment information is encrypted and secure
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
  errorContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#2A1A1A',
    margin: 20,
    padding: 16,
    borderRadius: 12,
    borderLeftWidth: 4,
    borderLeftColor: '#FF6B6B',
  },
  errorText: {
    flex: 1,
    fontSize: 14,
    color: '#FF6B6B',
    marginLeft: 12,
    lineHeight: 20,
  },
  errorCloseButton: {
    padding: 4,
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
    fontSize: 18,
    color: '#888',
    textAlign: 'center',
    lineHeight: 26,
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
  },
  footerSubtext: {
    fontSize: 12,
    color: '#888',
    textAlign: 'center',
  },
});