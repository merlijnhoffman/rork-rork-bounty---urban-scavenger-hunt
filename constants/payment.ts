import { TicketTier } from '@/types/payment';

export const TICKET_TIERS: TicketTier[] = [
  {
    id: 'hunt_ticket',
    name: 'Hunt Ticket',
    price: 3.99,
    currency: 'EUR',
    description: 'Join the treasure hunt adventure',
    features: [
      'Real-time clues',
      'Interactive hints',
      'Prize eligibility',
      'Community chat',
      'Full hunt access'
    ],
    stripePriceId: process.env.EXPO_PUBLIC_STRIPE_PRICE_ID || 'price_1SFbUhATZcBhONrDPUlVyFRJ'
  }
];

export const PAYMENT_CONFIG = {
  publishableKey: process.env.EXPO_PUBLIC_STRIPE_PUBLISHABLE_KEY || 'pk_test_...',
  merchantIdentifier: 'merchant.com.bounty.app',
  urlScheme: 'bounty-app',
};