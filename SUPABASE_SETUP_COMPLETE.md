# ✅ Supabase Backend Setup - Final Steps

You've successfully deployed your Edge Function! Now complete these final steps:

## 1. Set Stripe Secret Key in Supabase

Your Edge Function needs the Stripe secret key to create payment intents. Set it as an environment variable:

### Option A: Using Supabase Dashboard (Recommended)
1. Go to https://supabase.com/dashboard/project/jmlqcdcegejeunblzemh/settings/functions
2. Click on "Edge Functions" in the left sidebar
3. Click on "Manage secrets" or "Environment variables"
4. Add a new secret:
   - **Name**: `STRIPE_SECRET_KEY`
   - **Value**: Your Stripe test secret key (starts with `sk_test_`)
5. Click "Save"

### Option B: Using Supabase CLI
```bash
supabase secrets set STRIPE_SECRET_KEY=sk_test_YOUR_ACTUAL_SECRET_KEY_HERE
```

## 2. Get Your Stripe Keys

If you don't have Stripe keys yet:

1. Go to https://dashboard.stripe.com/test/apikeys
2. Copy your **Publishable key** (starts with `pk_test_`)
3. Copy your **Secret key** (starts with `sk_test_`)

## 3. Update Your .env.local File

Update these values in your `.env.local`:

```env
# Frontend - Stripe Publishable Key
EXPO_PUBLIC_STRIPE_PUBLISHABLE_KEY=pk_test_YOUR_ACTUAL_KEY_HERE

# Create a test product in Stripe and get the price ID
EXPO_PUBLIC_STRIPE_PRICE_ID=price_YOUR_ACTUAL_PRICE_ID_HERE
```

## 4. Create a Test Product in Stripe

1. Go to https://dashboard.stripe.com/test/products
2. Click "Add product"
3. Fill in:
   - **Name**: Hunt Ticket
   - **Price**: 10.00 USD (or your desired price)
4. Click "Save product"
5. Copy the **Price ID** (starts with `price_`)
6. Paste it in your `.env.local` as `EXPO_PUBLIC_STRIPE_PRICE_ID`

## 5. Test the Payment Flow

1. Restart your Expo app:
   ```bash
   npx expo start
   ```

2. In your app, try to make a payment
3. Check the logs for any errors
4. Verify in Stripe Dashboard that payment intents are being created

## 6. Verify Edge Function Logs

Check if your Edge Function is working:

1. Go to https://supabase.com/dashboard/project/jmlqcdcegejeunblzemh/functions
2. Click on "create-payment-intent"
3. View the logs to see if requests are coming through

## Current Configuration Status

✅ Supabase project created
✅ Edge Function deployed
✅ Frontend configured to use Supabase
⏳ Stripe secret key needs to be set in Supabase
⏳ Stripe test keys need to be added to .env.local
⏳ Test product/price needs to be created in Stripe

## What's Changed

Your app now uses:
- ✅ **Supabase Edge Functions** instead of Rork backend for payment processing
- ✅ **Supabase Auth** for user authentication
- ✅ **Supabase Database** for storing tickets, events, clues, etc.
- ✅ **Direct Stripe integration** via Edge Function

## Troubleshooting

### "STRIPE_SECRET_KEY environment variable is required"
- You need to set the Stripe secret key in Supabase (Step 1)

### "Invalid price ID"
- Make sure you created a product in Stripe and copied the correct price ID
- Verify the price ID in your .env.local matches the one in Stripe

### "Network error"
- Check that your Supabase URL is correct in .env.local
- Verify your internet connection

### Edge Function not receiving requests
- Check that EXPO_PUBLIC_SUPABASE_URL is set correctly
- Verify EXPO_PUBLIC_SUPABASE_ANON_KEY is set correctly
- Restart your Expo app after changing .env.local

## Next Steps

After completing the setup:
1. Test creating a payment intent
2. Verify it appears in your Stripe Dashboard
3. Test the full payment flow
4. Check Supabase logs for any errors

## Need Help?

- Stripe Dashboard: https://dashboard.stripe.com/test
- Supabase Dashboard: https://supabase.com/dashboard/project/jmlqcdcegejeunblzemh
- Edge Function Logs: https://supabase.com/dashboard/project/jmlqcdcegejeunblzemh/functions
