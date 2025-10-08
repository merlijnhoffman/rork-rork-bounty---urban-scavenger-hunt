# Supabase Backend Migration Guide

This guide will help you migrate from the Rork backend to Supabase for all backend operations.

## Overview

Your app now uses Supabase for:
1. **Payment Intent Creation** - Via Supabase Edge Functions
2. **Player Connections** - Via Supabase Database
3. **Ticket Management** - Already using Supabase ✓

## Prerequisites

- Supabase account and project
- Supabase CLI installed: `npm install -g supabase`
- Your Supabase project URL and keys from `.env.local`

## Step 1: Create Database Tables

Run these SQL commands in your Supabase SQL Editor (Dashboard → SQL Editor):

### Connection Codes Table

```sql
-- Create connection_codes table
CREATE TABLE connection_codes (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  code TEXT NOT NULL UNIQUE,
  user_id TEXT NOT NULL,
  event_id TEXT NOT NULL,
  latitude DOUBLE PRECISION NOT NULL,
  longitude DOUBLE PRECISION NOT NULL,
  expires_at TIMESTAMPTZ NOT NULL,
  created_at TIMESTAMPTZ DEFAULT NOW()
);

-- Add index for faster lookups
CREATE INDEX idx_connection_codes_code ON connection_codes(code);
CREATE INDEX idx_connection_codes_expires_at ON connection_codes(expires_at);

-- Enable RLS
ALTER TABLE connection_codes ENABLE ROW LEVEL SECURITY;

-- Policy to allow anyone to read non-expired codes
CREATE POLICY "Anyone can read non-expired codes" ON connection_codes
  FOR SELECT USING (expires_at > NOW());

-- Policy to allow authenticated users to insert codes
CREATE POLICY "Authenticated users can insert codes" ON connection_codes
  FOR INSERT WITH CHECK (auth.uid()::text = user_id);

-- Policy to allow deletion of expired codes
CREATE POLICY "Anyone can delete expired codes" ON connection_codes
  FOR DELETE USING (expires_at < NOW());
```

### Player Connections Table

```sql
-- Create player_connections table
CREATE TABLE player_connections (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  connection_key TEXT NOT NULL UNIQUE,
  generator_user_id TEXT NOT NULL,
  scanner_user_id TEXT NOT NULL,
  event_id TEXT NOT NULL,
  distance INTEGER NOT NULL,
  created_at TIMESTAMPTZ DEFAULT NOW()
);

-- Add indexes
CREATE INDEX idx_player_connections_generator ON player_connections(generator_user_id);
CREATE INDEX idx_player_connections_scanner ON player_connections(scanner_user_id);
CREATE INDEX idx_player_connections_event ON player_connections(event_id);

-- Enable RLS
ALTER TABLE player_connections ENABLE ROW LEVEL SECURITY;

-- Policy to allow users to read their own connections
CREATE POLICY "Users can read their own connections" ON player_connections
  FOR SELECT USING (
    auth.uid()::text = generator_user_id OR 
    auth.uid()::text = scanner_user_id
  );

-- Policy to allow authenticated users to insert connections
CREATE POLICY "Authenticated users can insert connections" ON player_connections
  FOR INSERT WITH CHECK (
    auth.uid()::text = generator_user_id OR 
    auth.uid()::text = scanner_user_id
  );
```

### Cleanup Function (Optional)

```sql
-- Create a function to clean up expired connection codes
CREATE OR REPLACE FUNCTION cleanup_expired_connection_codes()
RETURNS void AS $$
BEGIN
  DELETE FROM connection_codes WHERE expires_at < NOW();
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Schedule it to run every 5 minutes using pg_cron (if available)
-- Or you can call it manually/via a cron job
```

## Step 2: Deploy Supabase Edge Function

### Initialize Supabase (if not already done)

```bash
# Login to Supabase
supabase login

# Link to your project
supabase link --project-ref YOUR_PROJECT_REF
```

### Deploy the Edge Function

The Edge Function file is already created at `supabase/functions/create-payment-intent/index.ts`.

```bash
# Deploy the function
supabase functions deploy create-payment-intent

# Set the Stripe secret key as an environment variable
supabase secrets set STRIPE_SECRET_KEY=sk_test_YOUR_TEST_SECRET_KEY_HERE
```

### Test the Edge Function

```bash
# Test locally
supabase functions serve create-payment-intent

# Test with curl
curl -i --location --request POST 'http://localhost:54321/functions/v1/create-payment-intent' \
  --header 'Authorization: Bearer YOUR_ANON_KEY' \
  --header 'Content-Type: application/json' \
  --data '{"priceId":"price_YOUR_PRICE_ID","userId":"test-user"}'
```

## Step 3: Update Environment Variables

Make sure your `.env.local` has these variables:

```env
# Supabase Configuration
EXPO_PUBLIC_SUPABASE_URL=https://YOUR_PROJECT.supabase.co
EXPO_PUBLIC_SUPABASE_ANON_KEY=your_anon_key_here
SUPABASE_SERVICE_ROLE_KEY=your_service_role_key_here

# Stripe Configuration
EXPO_PUBLIC_STRIPE_PUBLISHABLE_KEY=pk_test_YOUR_TEST_KEY
EXPO_PUBLIC_STRIPE_PRICE_ID=price_YOUR_PRICE_ID
STRIPE_SECRET_KEY=sk_test_YOUR_SECRET_KEY
```

## Step 4: Remove Rork Backend Dependencies (Optional)

Once everything is working with Supabase, you can optionally remove the Rork backend:

1. **Stop the backend server** - No need to run `bun run dev:backend` anymore
2. **Remove backend files** (optional):
   - `backend/` folder
   - `lib/trpc.ts` (if not used elsewhere)
3. **Remove from package.json** (optional):
   - `@hono/trpc-server`
   - `@trpc/client`
   - `@trpc/react-query`
   - `@trpc/server`
   - `hono`

## Step 5: Test Your Migration

### Test Player Connections

1. Open the app on two devices/simulators
2. Sign in with different accounts
3. Go to the Hunt tab
4. Try connecting players using QR codes
5. Verify the connection is saved in Supabase

### Test Payment Flow

1. Go to Profile tab
2. Click "Buy Ticket"
3. Select a ticket tier
4. Complete the payment with test card: `4242 4242 4242 4242`
5. Verify the ticket is created in Supabase

### Check Supabase Dashboard

- **Table Editor** → Verify data in `connection_codes`, `player_connections`, and `tickets`
- **Edge Functions** → Check logs for `create-payment-intent`
- **Authentication** → Verify users are authenticated

## Troubleshooting

### Edge Function Not Working

1. Check if the function is deployed:
   ```bash
   supabase functions list
   ```

2. Check function logs:
   ```bash
   supabase functions logs create-payment-intent
   ```

3. Verify environment variables:
   ```bash
   supabase secrets list
   ```

### Connection Codes Not Working

1. Check RLS policies in Supabase Dashboard
2. Verify the user is authenticated
3. Check browser/app console for errors
4. Verify location permissions are granted

### Payment Intent Errors

1. Verify Stripe keys are correct (test mode)
2. Check Edge Function logs
3. Verify the price ID exists in Stripe
4. Test with Stripe test cards

## Benefits of Supabase Backend

✅ **No separate backend server to run**
✅ **Built-in authentication and RLS**
✅ **Real-time subscriptions available**
✅ **Automatic scaling**
✅ **Better mobile compatibility**
✅ **No CORS issues**
✅ **Free tier available**

## What Changed

### Before (Rork Backend)
- tRPC endpoints for payment, connections
- Separate Node.js server required
- In-memory storage for connection codes
- Manual CORS configuration

### After (Supabase)
- Supabase Edge Functions for payment
- Direct Supabase client calls for connections
- Database storage for connection codes
- Built-in CORS handling

## Need Help?

- Supabase Docs: https://supabase.com/docs
- Supabase Discord: https://discord.supabase.com
- Stripe Docs: https://stripe.com/docs
