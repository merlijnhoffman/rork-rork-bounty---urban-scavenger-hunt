# Embedded Stripe Payment Setup Guide

Your app now has **embedded Stripe payments** that work directly within the app (no browser redirect)! Here's what was implemented and how to complete the setup.

---

## ✅ What Was Implemented

### 1. **Embedded Payment Components**
- **`StripePaymentWebView.tsx`**: Mobile payment form using WebView with Stripe.js
- **`StripePaymentWeb.tsx`**: Web payment form using Stripe Elements
- **`StripePayment.tsx`**: Updated to use embedded components with automatic platform detection

### 2. **Payment Flow**
1. User clicks "Buy Ticket"
2. App creates a Payment Intent via Supabase Edge Function
3. Embedded payment form loads (WebView on mobile, Stripe Elements on web)
4. User enters card details directly in the app
5. Payment is processed without leaving the app
6. Success screen shows, ticket is created

### 3. **Webhook Handler**
- **`supabase/functions/stripe-webhook/index.ts`**: Handles payment confirmations from Stripe
- Automatically creates tickets in your database when payments succeed

---

## 🚀 Setup Steps

### Step 1: Configure Stripe Keys

Make sure your `.env.local` has the correct Stripe keys:

```env
# Frontend - Get from https://dashboard.stripe.com/test/apikeys
EXPO_PUBLIC_STRIPE_PUBLISHABLE_KEY=pk_test_YOUR_ACTUAL_KEY_HERE

# Backend - Get from https://dashboard.stripe.com/test/apikeys  
STRIPE_SECRET_KEY=sk_test_YOUR_ACTUAL_KEY_HERE

# Price ID - Create a product/price in Stripe Dashboard
EXPO_PUBLIC_STRIPE_PRICE_ID=price_YOUR_ACTUAL_PRICE_ID_HERE

# Webhook Secret - You'll get this in Step 3
STRIPE_WEBHOOK_SECRET=whsec_YOUR_WEBHOOK_SECRET_HERE
```

### Step 2: Deploy the Webhook Edge Function

Deploy the webhook handler to Supabase:

```bash
supabase functions deploy stripe-webhook --no-verify-jwt
```

This creates an endpoint at:
```
https://YOUR_PROJECT_REF.supabase.co/functions/v1/stripe-webhook
```

### Step 3: Configure Stripe Webhook

1. Go to [Stripe Dashboard → Webhooks](https://dashboard.stripe.com/test/webhooks)
2. Click **"Add endpoint"**
3. Enter your webhook URL:
   ```
   https://jmlqcdcegejeunblzemh.supabase.co/functions/v1/stripe-webhook
   ```
4. Select these events to listen for:
   - `payment_intent.succeeded`
   - `payment_intent.payment_failed`
   - `payment_intent.canceled`
5. Click **"Add endpoint"**
6. Copy the **Signing secret** (starts with `whsec_`)
7. Add it to your Supabase secrets:
   ```bash
   supabase secrets set STRIPE_WEBHOOK_SECRET=whsec_YOUR_SECRET_HERE
   ```

### Step 4: Set Supabase Environment Variables

Make sure your Supabase Edge Functions have these secrets set:

```bash
# Set Stripe keys
supabase secrets set STRIPE_SECRET_KEY=sk_test_YOUR_KEY_HERE
supabase secrets set STRIPE_WEBHOOK_SECRET=whsec_YOUR_SECRET_HERE

# Set Supabase keys (for webhook to access database)
supabase secrets set SUPABASE_URL=https://jmlqcdcegejeunblzemh.supabase.co
supabase secrets set SUPABASE_SERVICE_ROLE_KEY=YOUR_SERVICE_ROLE_KEY_HERE
```

You can find your service role key in:
- Supabase Dashboard → Settings → API → `service_role` key (secret)

### Step 5: Create the Tickets Table

If you haven't already, create the tickets table in Supabase:

```sql
CREATE TABLE IF NOT EXISTS tickets (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL REFERENCES auth.users(id),
  payment_intent_id TEXT NOT NULL UNIQUE,
  price_id TEXT NOT NULL,
  amount INTEGER NOT NULL,
  currency TEXT NOT NULL,
  status TEXT NOT NULL DEFAULT 'active',
  purchased_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- Add index for faster lookups
CREATE INDEX idx_tickets_user_id ON tickets(user_id);
CREATE INDEX idx_tickets_payment_intent_id ON tickets(payment_intent_id);

-- Enable Row Level Security
ALTER TABLE tickets ENABLE ROW LEVEL SECURITY;

-- Policy: Users can view their own tickets
CREATE POLICY "Users can view own tickets"
  ON tickets FOR SELECT
  USING (auth.uid() = user_id);

-- Policy: Service role can insert tickets (for webhook)
CREATE POLICY "Service role can insert tickets"
  ON tickets FOR INSERT
  WITH CHECK (true);
```

Run this in: Supabase Dashboard → SQL Editor → New Query

---

## 🧪 Testing the Payment Flow

### Test on Web:
1. Start your app: `bun start`
2. Open in browser
3. Sign in
4. Click "Buy Ticket"
5. Use Stripe test card: `4242 4242 4242 4242`
   - Any future expiry date
   - Any 3-digit CVC
   - Any ZIP code

### Test on Mobile:
1. Start your app: `bun start`
2. Scan QR code with Expo Go
3. Sign in
4. Click "Buy Ticket"
5. Use same test card details

### Verify Success:
1. Check Supabase Dashboard → Table Editor → `tickets` table
2. Check Stripe Dashboard → Payments (should see successful payment)
3. Check Supabase Edge Function logs:
   ```bash
   supabase functions logs stripe-webhook
   ```

---

## 🎨 How It Works

### Payment Flow Diagram:
```
User clicks "Buy Ticket"
    ↓
App calls Supabase Edge Function (create-payment-intent)
    ↓
Edge Function creates Stripe Payment Intent
    ↓
Returns clientSecret to app
    ↓
App shows embedded payment form
    ↓
User enters card details
    ↓
Stripe processes payment
    ↓
Stripe sends webhook to stripe-webhook Edge Function
    ↓
Webhook creates ticket in database
    ↓
User sees success screen
```

### Platform-Specific Implementation:

**Web (Desktop/Mobile Browser):**
- Uses `@stripe/stripe-js` library
- Stripe Elements embedded directly in React
- Native form validation and styling

**Mobile (iOS/Android via Expo Go):**
- Uses React Native WebView
- Loads Stripe.js in WebView
- Communicates via postMessage
- Same security as web

---

## 🔒 Security Features

✅ **PCI Compliance**: Card details never touch your server  
✅ **Webhook Verification**: Stripe signature validation  
✅ **Row Level Security**: Users can only see their own tickets  
✅ **HTTPS Only**: All communication encrypted  
✅ **Client Secret**: One-time use payment tokens  

---

## 🐛 Troubleshooting

### Payment form doesn't load:
- Check `EXPO_PUBLIC_STRIPE_PUBLISHABLE_KEY` is set correctly
- Check browser console for errors
- Verify Supabase Edge Function is deployed

### Payment succeeds but no ticket created:
- Check webhook is configured in Stripe Dashboard
- Check webhook secret is set in Supabase secrets
- Check Edge Function logs: `supabase functions logs stripe-webhook`
- Verify tickets table exists and has correct policies

### "Invalid API Key" error:
- Make sure you're using **test mode** keys (start with `pk_test_` and `sk_test_`)
- Don't mix test and live keys

### WebView shows blank screen on mobile:
- Check device has internet connection
- Check `EXPO_PUBLIC_STRIPE_PUBLISHABLE_KEY` is accessible
- Try restarting Expo Go app

---

## 📱 User Experience

### Before (Payment Link):
1. User clicks "Buy Ticket"
2. Opens browser
3. Redirects to Stripe Checkout
4. Completes payment
5. Redirects back to app
6. ❌ Confusing, slow, breaks app flow

### After (Embedded Payment):
1. User clicks "Buy Ticket"
2. Payment form slides up in app
3. Enters card details
4. Payment processes
5. Success screen shows
6. ✅ Seamless, fast, professional

---

## 🎯 Next Steps

1. **Test thoroughly** with Stripe test cards
2. **Monitor webhook logs** to ensure tickets are created
3. **Add error handling** for edge cases
4. **Customize styling** to match your brand
5. **Add receipt emails** (Stripe can send these automatically)
6. **Switch to live mode** when ready for production

---

## 📚 Resources

- [Stripe Test Cards](https://stripe.com/docs/testing#cards)
- [Stripe Payment Intents](https://stripe.com/docs/payments/payment-intents)
- [Stripe Webhooks](https://stripe.com/docs/webhooks)
- [Supabase Edge Functions](https://supabase.com/docs/guides/functions)

---

## ✨ What's Different from Payment Links?

| Feature | Payment Link | Embedded Payment |
|---------|-------------|------------------|
| User Experience | Leaves app, opens browser | Stays in app |
| Speed | Slow (redirect + load) | Fast (instant) |
| Branding | Stripe branding | Your branding |
| Mobile UX | Poor (browser switch) | Excellent (native feel) |
| Conversion Rate | Lower (friction) | Higher (seamless) |
| Setup Complexity | Simple | Moderate |

---

You're all set! The embedded payment system is ready to use. Just complete the setup steps above and test with Stripe test cards. 🎉
