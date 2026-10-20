// NOTE: price is only the FALLBACK shown when the live RevenueCat offering
// cannot be loaded — the paywall always prefers the real StoreKit/Play price.
// TODO: keep this in sync with the paid product configured in RevenueCat.
export const TICKET = {
  id: 'hunt_ticket_free', // kept: matches the existing RevenueCat configuration
  name: 'Hunt Ticket',
  price: 4.99,
  currency: 'EUR',
  description: 'Join the urban scavenger hunt',
  features: [
    'Real-time clues during the hunt',
    'Distance meter to track proximity',
    'Connect with other hunters',
    'Chance to win the prize',
  ],
  isFree: false,
  isFirstEvent: false,
  rcOfferingId: 'hunt_ticket',
  rcEntitlementId: 'hunt_access',
};

export const TICKET_TIERS = [TICKET];
