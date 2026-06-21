export interface TicketTier {
  id: string;
  name: string;
  price: number;
  currency: string;
  description: string;
  features: string[];
  popular?: boolean;
  isFree?: boolean;
  isFirstEvent?: boolean;
}