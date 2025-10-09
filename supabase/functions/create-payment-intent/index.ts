// @ts-ignore: Deno imports
import { serve } from 'https://deno.land/std@0.168.0/http/server.ts';
// @ts-ignore: Deno imports
import Stripe from 'https://esm.sh/stripe@14.21.0?target=deno';

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

serve(async (req: Request) => {
  if (req.method === 'OPTIONS') {
    return new Response('ok', { headers: corsHeaders });
  }

  try {
    // @ts-ignore: Deno global
    const stripeSecretKey = Deno.env.get('STRIPE_SECRET_KEY');
    if (!stripeSecretKey) {
      throw new Error('STRIPE_SECRET_KEY is not configured');
    }

    const stripe = new Stripe(stripeSecretKey, {
      apiVersion: '2023-10-16',
      httpClient: Stripe.createFetchHttpClient(),
    });

    const { priceId, amount, currency, userId, customerEmail, metadata } = await req.json();

    console.log('Creating payment intent with:', { priceId, amount, currency, userId, customerEmail });

    let paymentIntentParams: Stripe.PaymentIntentCreateParams;

    if (priceId && priceId.trim() !== '' && priceId !== 'price_...') {
      const price = await stripe.prices.retrieve(priceId);
      
      if (!price.unit_amount) {
        throw new Error('Price does not have a unit amount');
      }

      paymentIntentParams = {
        amount: price.unit_amount,
        currency: price.currency,
        automatic_payment_methods: {
          enabled: true,
        },
        metadata: {
          priceId,
          userId: userId || '',
          ...metadata,
        },
      };
    } else {
      if (!amount || !currency) {
        throw new Error('Either priceId or both amount and currency must be provided');
      }

      paymentIntentParams = {
        amount: amount,
        currency: currency,
        automatic_payment_methods: {
          enabled: true,
        },
        metadata: {
          userId: userId || '',
          ...metadata,
        },
      };
    }

    if (customerEmail) {
      paymentIntentParams.receipt_email = customerEmail;
    }

    const paymentIntent = await stripe.paymentIntents.create(paymentIntentParams);

    console.log('Payment intent created:', paymentIntent.id);

    return new Response(
      JSON.stringify({
        clientSecret: paymentIntent.client_secret,
        paymentIntentId: paymentIntent.id,
      }),
      {
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
        status: 200,
      }
    );
  } catch (error) {
    console.error('Error creating payment intent:', error);
    
    const errorMessage = error instanceof Error ? error.message : 'Unknown error occurred';
    
    return new Response(
      JSON.stringify({
        error: errorMessage,
        message: errorMessage,
      }),
      {
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
        status: 400,
      }
    );
  }
});
