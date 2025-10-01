// Default Stripe configuration with platform-specific handling
import { Platform } from 'react-native';

// Configuration
export const STRIPE_CONFIG = Platform.OS === 'web' 
  ? {
      publishableKey: '',
      merchantIdentifier: '',
      urlScheme: '',
    }
  : {
      publishableKey: process.env.EXPO_PUBLIC_STRIPE_PUBLISHABLE_KEY || '',
      merchantIdentifier: 'merchant.com.yourapp.stripe',
      urlScheme: 'bounty-app',
    };

// Stripe components - only available on native platforms
let stripe: any = null;
if (Platform.OS !== 'web') {
  try {
    // eslint-disable-next-line @typescript-eslint/no-require-imports
    stripe = require('@stripe/stripe-react-native');
  } catch (error) {
    console.warn('Stripe React Native not available:', error);
  }
}

export const StripeProvider = stripe?.StripeProvider || null;
export const initPaymentSheet = stripe?.initPaymentSheet || null;
export const presentPaymentSheet = stripe?.presentPaymentSheet || null;