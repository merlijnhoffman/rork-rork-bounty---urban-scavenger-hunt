import { serve } from "https://deno.land/std@0.168.0/http/server.ts"
import Stripe from 'https://esm.sh/stripe@14.21.0?target=deno'

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
}

serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response('ok', { headers: corsHeaders })
  }

  try {
    const stripeSecretKey = Deno.env.get('STRIPE_SECRET_KEY')
    
    if (!stripeSecretKey) {
      throw new Error('STRIPE_SECRET_KEY environment variable is required')
    }

    const stripe = new Stripe(stripeSecretKey, {
      apiVersion: '2024-11-20.acacia',
      httpClient: Stripe.createFetchHttpClient(),
    })

    const { priceId, userId, customerEmail, metadata } = await req.json()

    console.log('Creating payment intent for price:', priceId)

    const price = await stripe.prices.retrieve(priceId)
    
    if (!price.unit_amount) {
      throw new Error('Price must have a unit amount')
    }

    console.log(`Creating payment intent for ${price.unit_amount} ${price.currency}`)

    const paymentIntent = await stripe.paymentIntents.create({
      amount: price.unit_amount,
      currency: price.currency,
      metadata: {
        priceId: priceId,
        userId: userId || 'anonymous',
        ...metadata,
      },
      automatic_payment_methods: {
        enabled: true,
      },
      receipt_email: customerEmail,
    })

    console.log('Payment intent created:', paymentIntent.id)

    return new Response(
      JSON.stringify({
        clientSecret: paymentIntent.client_secret,
        paymentIntentId: paymentIntent.id,
        amount: paymentIntent.amount,
        currency: paymentIntent.currency,
        priceId: priceId,
      }),
      {
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
        status: 200,
      },
    )
  } catch (error) {
    console.error('Error creating payment intent:', error)
    
    let errorMessage = 'Failed to create payment intent'
    
    if (error instanceof Error) {
      if (error.message.includes('No such price')) {
        errorMessage = `Invalid price ID`
      } else if (error.message.includes('Invalid API Key')) {
        errorMessage = 'Stripe configuration error'
      } else {
        errorMessage = `Payment setup failed: ${error.message}`
      }
    }
    
    return new Response(
      JSON.stringify({ error: errorMessage }),
      {
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
        status: 400,
      },
    )
  }
})
