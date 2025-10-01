import { Hono } from "hono";
import { trpcServer } from "@hono/trpc-server";
import { cors } from "hono/cors";
import { appRouter } from "./trpc/app-router";
import { createContext } from "./trpc/create-context";
import Stripe from "stripe";
import { createClient } from "@supabase/supabase-js";

const stripe = new Stripe(process.env.STRIPE_SECRET_KEY!, {
  apiVersion: "2025-09-30.clover",
});

const supabaseUrl = process.env.EXPO_PUBLIC_SUPABASE_URL!;
const supabaseServiceKey = process.env.SUPABASE_SERVICE_ROLE_KEY!;
const supabase = createClient(supabaseUrl, supabaseServiceKey);

function generateVerificationCode(): string {
  return Math.random().toString(36).substring(2, 8).toUpperCase();
}

const app = new Hono();

app.use("*", cors());

app.use(
  "/trpc/*",
  trpcServer({
    endpoint: "/api/trpc",
    router: appRouter,
    createContext,
  })
);

app.get("/", (c) => {
  return c.json({ status: "ok", message: "API is running" });
});

// Stripe webhook endpoint
app.post("/webhook/stripe", async (c) => {
  try {
    const body = await c.req.text();
    const signature = c.req.header("stripe-signature");
    
    if (!signature) {
      console.error("No Stripe signature found");
      return c.json({ error: "No signature" }, 400);
    }

    const webhookSecret = process.env.STRIPE_WEBHOOK_SECRET!;
    let event: Stripe.Event;

    try {
      event = stripe.webhooks.constructEvent(body, signature, webhookSecret);
    } catch (err) {
      console.error("Webhook signature verification failed:", err);
      return c.json({ error: "Invalid signature" }, 400);
    }

    console.log("Received Stripe webhook:", event.type);

    // Handle the event
    switch (event.type) {
      case "payment_intent.succeeded":
        const paymentIntent = event.data.object as Stripe.PaymentIntent;
        console.log("Payment succeeded:", paymentIntent.id);
        
        // Create ticket when payment succeeds
        if (paymentIntent.metadata.userId && paymentIntent.metadata.eventId) {
          try {
            const verificationCode = generateVerificationCode();
            
            const { data: ticket, error } = await supabase
              .from("tickets")
              .insert({
                user_id: paymentIntent.metadata.userId,
                event_id: paymentIntent.metadata.eventId,
                verification_code: verificationCode,
                is_used: false,
              })
              .select()
              .single();

            if (error) {
              console.error("Error creating ticket:", error);
            } else {
              console.log("Ticket created successfully:", ticket.id);
            }
          } catch (ticketError) {
            console.error("Error in ticket creation:", ticketError);
          }
        }
        break;
        
      case "payment_intent.payment_failed":
        const failedPayment = event.data.object as Stripe.PaymentIntent;
        console.log("Payment failed:", failedPayment.id);
        break;
        
      default:
        console.log(`Unhandled event type: ${event.type}`);
    }

    return c.json({ received: true });
  } catch (error) {
    console.error("Webhook error:", error);
    return c.json({ error: "Webhook handler failed" }, 500);
  }
});

export default app;
