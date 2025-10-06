import { Hono } from "hono";
import { trpcServer } from "@hono/trpc-server";
import { cors } from "hono/cors";
import { appRouter } from "./trpc/app-router";
import { createContext } from "./trpc/create-context";
import Stripe from "stripe";
import { createClient } from "@supabase/supabase-js";

const hasStripe = Boolean(process.env.STRIPE_SECRET_KEY && process.env.STRIPE_WEBHOOK_SECRET);
const hasSupabaseService = Boolean(process.env.EXPO_PUBLIC_SUPABASE_URL && process.env.SUPABASE_SERVICE_ROLE_KEY);

let stripe: Stripe | undefined;
let supabase: ReturnType<typeof createClient> | undefined;

if (!hasStripe) {
  console.warn("Stripe env vars not configured. Payment webhooks will be disabled in dev.");
} else {
  stripe = new Stripe(process.env.STRIPE_SECRET_KEY as string, {
    apiVersion: "2025-09-30.clover",
  });
}

if (!hasSupabaseService) {
  console.warn("Supabase service env vars not configured. Ticket automation will be disabled in dev.");
} else {
  const supabaseUrl = process.env.EXPO_PUBLIC_SUPABASE_URL as string;
  const supabaseServiceKey = process.env.SUPABASE_SERVICE_ROLE_KEY as string;
  supabase = createClient(supabaseUrl, supabaseServiceKey);
}

function generateVerificationCode(): string {
  return Math.random().toString(36).substring(2, 8).toUpperCase();
}

const app = new Hono();

app.use("*", cors());

app.use(
  "/api/trpc/*",
  trpcServer({
    endpoint: "/api/trpc",
    router: appRouter,
    createContext,
  })
);

app.get("/", (c) => {
  return c.json({ status: "ok", message: "API is running" });
});

if (hasStripe) {
  app.post("/webhook/stripe", async (c) => {
    try {
      const body = await c.req.text();
      const signature = c.req.header("stripe-signature");
      
      if (!signature) {
        console.error("No Stripe signature found");
        return c.json({ error: "No signature" }, 400);
      }
  
      const webhookSecret = process.env.STRIPE_WEBHOOK_SECRET as string;
      let event: Stripe.Event;
  
      try {
        event = (stripe as Stripe).webhooks.constructEvent(body, signature, webhookSecret);
      } catch (err) {
        console.error("Webhook signature verification failed:", err);
        return c.json({ error: "Invalid signature" }, 400);
      }
  
      console.log("Received Stripe webhook:", event.type);
  
      switch (event.type) {
        case "payment_intent.succeeded": {
          const paymentIntent = event.data.object as Stripe.PaymentIntent;
          console.log("Payment succeeded:", paymentIntent.id);
          
          if (hasSupabaseService && supabase && paymentIntent.metadata.userId && paymentIntent.metadata.eventId) {
            try {
              const verificationCode = generateVerificationCode();
              const { data: ticket, error } = await (supabase as any)
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
              } else if (ticket) {
                console.log("Ticket created successfully:", ticket.id);
              }
            } catch (ticketError) {
              console.error("Error in ticket creation:", ticketError);
            }
          }
          break;
        }
        case "payment_intent.payment_failed": {
          const failedPayment = event.data.object as Stripe.PaymentIntent;
          console.log("Payment failed:", failedPayment.id);
          break;
        }
        default:
          console.log(`Unhandled event type: ${event.type}`);
      }
  
      return c.json({ received: true });
    } catch (error) {
      console.error("Webhook error:", error);
      return c.json({ error: "Webhook handler failed" }, 500);
    }
  });
} else {
  app.post("/webhook/stripe", (c) => c.json({ error: "Stripe not configured" }, 501));
}

const port = process.env.PORT || 3000;

console.log(`🚀 Starting server on port ${port}...`);
console.log(`📍 Server will be available at: http://localhost:${port}`);
console.log(`🔗 API endpoint: http://localhost:${port}/api/trpc`);

export default {
  port,
  fetch: app.fetch,
};
