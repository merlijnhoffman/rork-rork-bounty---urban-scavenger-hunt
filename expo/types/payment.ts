export interface PaymentMethod {
  id: string;
  type: 'card' | 'apple_pay' | 'google_pay';
  last4?: string;
  brand?: string;
  expiryMonth?: number;
  expiryYear?: number;
}

export interface PaymentIntent {
  id: string;
  clientSecret: string;
  amount: number;
  currency: string;
  status: 'requires_payment_method' | 'requires_confirmation' | 'requires_action' | 'processing' | 'succeeded' | 'canceled';
}

export interface TicketTier {
  id: string;
  name: string;
  price: number;
  currency: string;
  description: string;
  features: string[];
  popular?: boolean;
  stripePriceId?: string;
  isFree?: boolean;
  isFirstEvent?: boolean;
}

export interface PaymentResult {
  success: boolean;
  paymentIntent?: PaymentIntent;
  error?: string;
}

export interface PaymentConfig {
  publishableKey: string;
  merchantIdentifier?: string;
  urlScheme?: string;
}