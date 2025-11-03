const STRIPE_PRICE_ID = process.env.EXPO_PUBLIC_STRIPE_PRICE_ID || 'price_1SFbUhATZcBhONrDPUlVyFRJ';

export const TICKET = {
  id: 'hunt_ticket',
  name: 'Hunt Ticket',
  price: 0,
  currency: 'EUR',
  description: 'Join the first treasure hunt - FREE!',
  features: [
    'Real-time clues during the hunt',
    'Distance meter to track proximity',
    'Connect with other hunters',
    'Chance to win €1,000'
  ],
  stripePriceId: STRIPE_PRICE_ID,
  isFree: true,
  isFirstEvent: true
};

export const TICKET_TIERS = [TICKET];

export const PAYMENT_CONFIG = {
  publishableKey: process.env.EXPO_PUBLIC_STRIPE_PUBLISHABLE_KEY || 'pk_test_...',
  merchantIdentifier: 'merchant.com.bounty.app',
  urlScheme: 'bounty-app',
};