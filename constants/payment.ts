const STRIPE_PRICE_ID = process.env.EXPO_PUBLIC_STRIPE_PRICE_ID || 'price_1SFbUhATZcBhONrDPUlVyFRJ';

export const TICKET = {
  id: 'hunt_ticket',
  name: 'Hunt Ticket',
  price: 3.99,
  currency: 'EUR',
  description: 'Join the treasure hunt adventure',
  features: [
    'Real-time clues during the hunt',
    'Distance meter to track proximity',
    'Connect with other hunters',
    'Chance to win the prize'
  ],
  stripePriceId: STRIPE_PRICE_ID
};

export const TICKET_TIERS = [TICKET];

export const PAYMENT_CONFIG = {
  publishableKey: process.env.EXPO_PUBLIC_STRIPE_PUBLISHABLE_KEY || 'pk_test_...',
  merchantIdentifier: 'merchant.com.bounty.app',
  urlScheme: 'bounty-app',
};