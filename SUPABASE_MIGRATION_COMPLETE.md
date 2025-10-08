# Supabase Migration Complete

## Summary
Your app has been successfully migrated from using the Rork tRPC backend to using Supabase as the backend. All tRPC dependencies have been removed and replaced with direct Supabase database queries.

## Changes Made

### 1. Removed tRPC from Root Layout (`app/_layout.tsx`)
- Removed `trpc` and `trpcClient` imports
- Removed `<trpc.Provider>` wrapper
- App now uses only React Query with Supabase

### 2. Updated Hunt Screen (`app/(tabs)/hunt.tsx`)
- **Ticket Status Check**: Replaced tRPC query with direct Supabase query
  ```typescript
  // Old: trpc.payment.checkTicketStatus.useQuery()
  // New: useQuery with supabase.from('tickets').select()
  ```

- **Ticket Creation**: Replaced tRPC mutation with direct Supabase insert
  ```typescript
  // Old: trpcClient.payment.createTicket.mutate()
  // New: supabase.from('tickets').insert()
  ```

### 3. Backend Architecture
Your app now uses:
- **Supabase Edge Functions** for payment processing (`create-payment-intent`)
- **Supabase Database** for ticket management
- **Supabase Realtime** for live clue updates
- **Stripe Webhook** in Supabase for payment confirmations

## Database Schema Required

Make sure your Supabase database has a `tickets` table with this structure:

```sql
CREATE TABLE tickets (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  user_id UUID NOT NULL REFERENCES auth.users(id),
  event_id TEXT NOT NULL,
  payment_intent_id TEXT NOT NULL,
  status TEXT NOT NULL DEFAULT 'active',
  purchased_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- Add indexes for performance
CREATE INDEX idx_tickets_user_id ON tickets(user_id);
CREATE INDEX idx_tickets_event_id ON tickets(event_id);
CREATE INDEX idx_tickets_payment_intent ON tickets(payment_intent_id);
```

## Environment Variables

Your `.env.local` should have:
```bash
# Supabase Configuration
EXPO_PUBLIC_SUPABASE_URL=https://jmlqcdcegejeunblzemh.supabase.co
EXPO_PUBLIC_SUPABASE_ANON_KEY=your_anon_key

# Stripe Configuration
EXPO_PUBLIC_STRIPE_PUBLISHABLE_KEY=pk_test_...
EXPO_PUBLIC_STRIPE_PAYMENT_LINK=https://buy.stripe.com/...

# Backend Keys (for Supabase Edge Functions)
STRIPE_SECRET_KEY=sk_test_...
SUPABASE_SERVICE_ROLE_KEY=your_service_role_key
STRIPE_WEBHOOK_SECRET=whsec_...
```

## What's No Longer Needed

You can safely ignore or remove:
- `backend/` folder (Hono/tRPC backend)
- `lib/trpc.ts` (tRPC client configuration)
- `EXPO_PUBLIC_RORK_API_BASE_URL` environment variable
- Backend startup scripts (`run-backend.sh`, `run-backend.bat`, `start-backend.js`)

## Testing Your App

1. **Start your app**: `bun run start`
2. **Sign in** to your account
3. **Purchase a ticket** using the embedded Stripe payment
4. **Verify ticket status** - should automatically update after payment
5. **Start hunt simulation** to test the live hunt features

## Troubleshooting

If you see any errors:

1. **"Error checking ticket status"**
   - Verify your Supabase database has the `tickets` table
   - Check that your `EXPO_PUBLIC_SUPABASE_URL` and `EXPO_PUBLIC_SUPABASE_ANON_KEY` are correct

2. **"Failed to create ticket"**
   - Ensure the Stripe webhook is properly configured in Supabase
   - Check that the `tickets` table has proper permissions (RLS policies)

3. **Payment not working**
   - Verify your Supabase Edge Function `create-payment-intent` is deployed
   - Check that `STRIPE_SECRET_KEY` is set in Supabase Edge Function secrets

## Next Steps

Your app is now fully running on Supabase! The Rork backend is no longer needed. All payment processing, ticket management, and real-time features are handled by Supabase.
