import Stripe from 'stripe';

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

Deno.serve(async (req: Request) => {
  if (req.method === 'OPTIONS') {
    return new Response('ok', { headers: corsHeaders });
  }

  try {
    const stripeSecretKey = Deno.env.get('STRIPE_SECRET_KEY');
    if (!stripeSecretKey) {
      console.error('STRIPE_SECRET_KEY is not set');
      return new Response(
        JSON.stringify({ error: 'STRIPE_SECRET_KEY is not configured' }),
        {
          headers: { ...corsHeaders, 'Content-Type': 'application/json' },
          status: 500,
        }
      );
    }

    const stripe = new Stripe(stripeSecretKey, {
      apiVersion: '2024-11-20.acacia',
    });

    const body = await req.json();
    const { priceId, amount, currency, userId, customerEmail, metadata } = body;

    console.log('Creating payment intent with:', { priceId, amount, currency, userId });

    let paymentIntentParams: Stripe.PaymentIntentCreateParams;

    if (priceId && priceId.trim() !== '' && priceId !== 'price_...') {
      try {
        const price = await stripe.prices.retrieve(priceId);
        
        if (!price.unit_amount) {
          return new Response(
            JSON.stringify({ error: 'Price does not have a unit amount' }),
            {
              headers: { ...corsHeaders, 'Content-Type': 'application/json' },
              status: 400,
            }
          );
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
      } catch (priceError) {
        console.error('Error retrieving price:', priceError);
        return new Response(
          JSON.stringify({ error: `Failed to retrieve price: ${priceError.message}` }),
          {
            headers: { ...corsHeaders, 'Content-Type': 'application/json' },
            status: 400,
          }
        );
      }
    } else {
      if (!amount || !currency) {
        return new Response(
          JSON.stringify({ error: 'Either priceId or both amount and currency must be provided' }),
          {
            headers: { ...corsHeaders, 'Content-Type': 'application/json' },
            status: 400,
          }
        );
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
