// Stripe configuration
export const STRIPE_CONFIG = {
  publishableKey: process.env.EXPO_PUBLIC_STRIPE_PUBLISHABLE_KEY || 'pk_test_51SDNfLATZcBhONrDiNHbfLSIbjZ4Aed6dinzqxR4wlqwqYvJAn66jHEqFYETtqdHRyTl0Tik8eJhQPU31vSfBkB400Xl5Qf9Gc',
  priceId: process.env.EXPO_PUBLIC_STRIPE_PRICE_ID || 'price_1SFbUhATZcBhONrDPUlVyFRJ',
  currency: 'eur',
  amount: 399,
};