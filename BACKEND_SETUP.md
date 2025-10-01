# Backend Server Setup

## The Issue
You're getting "Failed to fetch" errors because the tRPC client can't connect to your backend server.

## Quick Fix

### Option 1: Using Rork Platform (Recommended)
Since you're using the Rork platform, your backend should be running automatically. The issue might be:

1. **Check your environment variables** in `.env.local`:
   ```
   EXPO_PUBLIC_RORK_API_BASE_URL=http://localhost:3000
   ```

2. **Update the base URL** to match your actual backend URL. If you're using Rork's hosted backend, update it to your actual backend URL.

### Option 2: Local Development
If you want to run the backend locally:

1. **Start the backend server**:
   ```bash
   # If you have a backend start script
   bun run backend
   # or
   bun run dev:backend
   # or manually run the backend
   cd backend && bun run hono.ts
   ```

2. **Verify the server is running**:
   - Open http://localhost:3000 in your browser
   - You should see: `{"status":"ok","message":"API is running"}`

3. **Check your environment variables**:
   ```bash
   # Make sure these are set in .env.local
   STRIPE_SECRET_KEY=sk_live_...
   EXPO_PUBLIC_SUPABASE_URL=https://...
   SUPABASE_SERVICE_ROLE_KEY=...
   EXPO_PUBLIC_RORK_API_BASE_URL=http://localhost:3000
   ```

## Testing the Connection

After starting the server, you should see these console messages:
- ✅ Backend server is running at: http://localhost:3000
- Making tRPC request to: http://localhost:3000/api/trpc/...

## Environment Variables Required

### Frontend (.env.local)
```
EXPO_PUBLIC_SUPABASE_URL=your_supabase_url
EXPO_PUBLIC_SUPABASE_ANON_KEY=your_supabase_anon_key
EXPO_PUBLIC_STRIPE_PUBLISHABLE_KEY=your_stripe_publishable_key
EXPO_PUBLIC_STRIPE_PRICE_ID=your_stripe_price_id
EXPO_PUBLIC_RORK_API_BASE_URL=your_backend_url
```

### Backend (.env.local)
```
STRIPE_SECRET_KEY=your_stripe_secret_key
SUPABASE_SERVICE_ROLE_KEY=your_supabase_service_role_key
STRIPE_WEBHOOK_SECRET=your_stripe_webhook_secret
```

## Troubleshooting

1. **"Backend server is not running"** - Start your backend server
2. **"HTTP 500"** - Check your environment variables and Stripe/Supabase configuration
3. **"Invalid price ID"** - Verify your `EXPO_PUBLIC_STRIPE_PRICE_ID` is correct
4. **"Stripe configuration error"** - Check your `STRIPE_SECRET_KEY`

## Next Steps

1. Start your backend server
2. Verify environment variables are correct
3. Test the payment flow
4. Check console logs for any remaining errors