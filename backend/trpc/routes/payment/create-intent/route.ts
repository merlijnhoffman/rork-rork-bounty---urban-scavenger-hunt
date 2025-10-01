import { z } from "zod";
import { publicProcedure } from "../../../create-context";
import Stripe from "stripe";

// Validate Stripe secret key
if (!process.env.STRIPE_SECRET_KEY) {
  throw new Error('STRIPE_SECRET_KEY environment variable is required');
}

const stripe = new Stripe(process.env.STRIPE_SECRET_KEY, {
  apiVersion: "2025-09-30.clover",
});

export const createPaymentIntentProcedure = publicProcedure
  .input(
    z.object({
      priceId: z.string(),
      userId: z.string().optional(),
      customerEmail: z.string().email().optional(),
      metadata: z.record(z.string(), z.string()).optional(),
    })
  )
  .mutation(async ({ input }) => {
    try {
      console.log("Creating payment intent for price:", input.priceId);

      // Validate Stripe configuration
      if (!process.env.STRIPE_SECRET_KEY) {
        throw new Error("Stripe secret key not configured");
      }

      // Get the price to determine the amount
      const price = await stripe.prices.retrieve(input.priceId);
      
      if (!price.unit_amount) {
        throw new Error("Price must have a unit amount");
      }

      console.log(`Creating payment intent for ${price.unit_amount} ${price.currency}`);

      const paymentIntent = await stripe.paymentIntents.create({
        amount: price.unit_amount,
        currency: price.currency,
        metadata: {
          priceId: input.priceId,
          userId: input.userId || 'anonymous',
          ...input.metadata,
        },
        automatic_payment_methods: {
          enabled: true,
        },
        receipt_email: input.customerEmail,
      });

      console.log("Payment intent created:", paymentIntent.id);

      return {
        clientSecret: paymentIntent.client_secret,
        paymentIntentId: paymentIntent.id,
        amount: paymentIntent.amount,
        currency: paymentIntent.currency,
        priceId: input.priceId,
      };
    } catch (error) {
      console.error("Error creating payment intent:", error);
      
      if (error instanceof Error) {
        if (error.message.includes('No such price')) {
          throw new Error(`Invalid price ID: ${input.priceId}`);
        }
        if (error.message.includes('Invalid API Key')) {
          throw new Error('Stripe configuration error');
        }
        throw new Error(`Payment setup failed: ${error.message}`);
      }
      
      throw new Error("Failed to create payment intent");
    }
  });