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

    const { priceId, amount, currency, userId, customerEmail, metadata } = await req.json()

    console.log('Creating payment intent. Price ID:', priceId)

    let finalAmount = amount as number | undefined
    let finalCurrency = currency as string | undefined

    if (priceId) {
      const price = await stripe.prices.retrieve(priceId)
      if (!price.unit_amount || !price.currency) {
        throw new Error('Price must have a unit amount and currency')
      }
      finalAmount = price.unit_amount
      finalCurrency = price.currency
    }

    if (!finalAmount || !finalCurrency) {
      throw new Error('Invalid payment inputs: provide priceId or amount+currency')
    }

    console.log(`Creating payment intent for ${finalAmount} ${finalCurrency}`)

    const paymentIntent = await stripe.paymentIntents.create({
      amount: finalAmount,
      currency: finalCurrency,
      metadata: {
        priceId: priceId || 'custom',
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
