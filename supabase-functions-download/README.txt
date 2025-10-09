SUPABASE FUNCTIONS - DEPLOYMENT GUIDE
=====================================

These are your Supabase Edge Functions for Stripe payment processing.

FOLDER STRUCTURE:
-----------------
Copy these folders to your local Supabase project:

C:\Users\Gebruiker\supabase\functions\create-payment-intent\index.ts
C:\Users\Gebruiker\supabase\functions\stripe-webhook\index.ts


DEPLOYMENT STEPS:
-----------------

1. Install Supabase CLI (if not already installed):
   npm install -g supabase

2. Login to Supabase:
   supabase login

3. Link your project (you'll need your project reference ID):
   supabase link --project-ref YOUR_PROJECT_REF_ID

   To find your project reference ID:
   - Go to https://supabase.com/dashboard
   - Select your project
   - Go to Settings > General
   - Look for "Reference ID"

4. Set environment variables (secrets):
   supabase secrets set STRIPE_SECRET_KEY=your_stripe_secret_key
   supabase secrets set STRIPE_WEBHOOK_SECRET=your_stripe_webhook_secret

5. Deploy the functions:
   supabase functions deploy create-payment-intent
   supabase functions deploy stripe-webhook


TESTING:
--------
After deployment, you can test the functions:

supabase functions invoke create-payment-intent --data '{"priceId":"price_xxx","userId":"user123"}'


TROUBLESHOOTING:
----------------
- If deployment fails, check that you're in the correct directory
- Ensure your Supabase CLI is up to date: npm update -g supabase
- Verify your project is linked: supabase projects list
- Check function logs: supabase functions logs create-payment-intent


WEBHOOK CONFIGURATION:
----------------------
After deploying stripe-webhook, configure it in Stripe Dashboard:
1. Go to Stripe Dashboard > Developers > Webhooks
2. Add endpoint: https://YOUR_PROJECT_REF.supabase.co/functions/v1/stripe-webhook
3. Select events: payment_intent.succeeded, payment_intent.payment_failed, payment_intent.canceled
4. Copy the webhook signing secret and set it as STRIPE_WEBHOOK_SECRET
