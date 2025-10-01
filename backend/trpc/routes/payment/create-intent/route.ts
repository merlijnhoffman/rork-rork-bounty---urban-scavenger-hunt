import { z } from "zod";
import { publicProcedure } from "../../../create-context";
import Stripe from "stripe";

const stripe = new Stripe(process.env.STRIPE_SECRET_KEY!, {
  apiVersion: "2025-09-30.clover",
});

export const createPaymentIntentProcedure = publicProcedure
  .input(
    z.object({
      eventId: z.string(),
      userId: z.string(),
      amount: z.number().min(1), // Amount in cents
      currency: z.string().default("eur"),
    })
  )
  .mutation(async ({ input }) => {
    try {
      console.log("Creating payment intent for:", input);

      const paymentIntent = await stripe.paymentIntents.create({
        amount: input.amount,
        currency: input.currency,
        metadata: {
          eventId: input.eventId,
          userId: input.userId,
        },
        automatic_payment_methods: {
          enabled: true,
        },
      });

      console.log("Payment intent created:", paymentIntent.id);

      return {
        clientSecret: paymentIntent.client_secret,
        paymentIntentId: paymentIntent.id,
        amount: paymentIntent.amount,
        currency: paymentIntent.currency,
      };
    } catch (error) {
      console.error("Error creating payment intent:", error);
      throw new Error("Failed to create payment intent");
    }
  });