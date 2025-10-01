// Stripe configuration
export const STRIPE_CONFIG = {
  // You'll need to provide these values:
  publishableKey: process.env.EXPO_PUBLIC_STRIPE_PUBLISHABLE_KEY || 'pk_test_...',
  priceId: process.env.EXPO_PUBLIC_STRIPE_PRICE_ID || 'price_...',
  // Default values - you can update these
  currency: 'eur',
  amount: 399, // €3.99 in cents
};