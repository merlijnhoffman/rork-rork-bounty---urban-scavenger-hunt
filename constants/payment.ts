import { TicketTier } from '@/types/payment';

export const TICKET_TIERS: TicketTier[] = [
  {
    id: 'basic',
    name: 'Basic Hunter',
    price: 15,
    currency: 'EUR',
    description: 'Standard hunt experience',
    features: [
      'Real-time clues',
      'Basic hints',
      'Prize eligibility',
      'Community chat'
    ],
    stripePriceId: 'price_basic_hunt'
  },
  {
    id: 'premium',
    name: 'Premium Hunter',
    price: 25,
    currency: 'EUR',
    description: 'Enhanced hunt experience',
    features: [
      'Real-time clues',
      'Advanced hints',
      'Prize eligibility',
      'Community chat',
      'Priority support',
      'Exclusive clues'
    ],
    popular: true,
    stripePriceId: 'price_premium_hunt'
  },
  {
    id: 'vip',
    name: 'VIP Hunter',
    price: 50,
    currency: 'EUR',
    description: 'Ultimate hunt experience',
    features: [
      'Real-time clues',
      'VIP hints & shortcuts',
      'Double prize eligibility',
      'Private VIP chat',
      'Priority support',
      'Exclusive clues',
      'Early access to future hunts',
      'Personal hunt assistant'
    ],
    stripePriceId: 'price_vip_hunt'
  }
];

export const PAYMENT_CONFIG = {
  publishableKey: process.env.EXPO_PUBLIC_STRIPE_PUBLISHABLE_KEY || 'pk_test_...',
  merchantIdentifier: 'merchant.com.bounty.app',
  urlScheme: 'bounty-app',
};