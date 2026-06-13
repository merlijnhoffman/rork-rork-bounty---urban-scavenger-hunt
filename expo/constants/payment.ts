export const TICKET = {
  id: 'hunt_ticket_free',
  name: 'Hunt Ticket',
  price: 0,
  currency: 'EUR',
  description: 'Join the urban scavenger hunt for free',
  features: [
    'Real-time clues during the hunt',
    'Distance meter to track proximity',
    'Connect with other hunters',
    'Chance to win the prize',
  ],
  isFree: true,
  isFirstEvent: false,
  rcOfferingId: 'hunt_ticket',
  rcEntitlementId: 'hunt_access',
};

export const TICKET_TIERS = [TICKET];
