# Backend Server Quick Start

## The Problem
You're getting "Failed to fetch" errors because the backend server is not running.

## Quick Solution

### Option 1: Start Backend Server (Recommended)
```bash
# Start the backend server
node start-backend.js

# OR manually:
bun run backend/hono.ts
```

### Option 2: Check if server is running
Open http://localhost:3000 in your browser. You should see:
```json
{"status":"ok","message":"API is running"}
```

## Environment Variables Setup

Make sure your `.env.local` file has these variables:

```bash
# Supabase (get from your Supabase dashboard)
EXPO_PUBLIC_SUPABASE_URL=https://your-project.supabase.co
EXPO_PUBLIC_SUPABASE_ANON_KEY=your_anon_key
SUPABASE_SERVICE_ROLE_KEY=your_service_role_key

# Stripe (get from your Stripe dashboard)
EXPO_PUBLIC_STRIPE_PUBLISHABLE_KEY=pk_live_...
EXPO_PUBLIC_STRIPE_PRICE_ID=price_...
STRIPE_SECRET_KEY=sk_live_...
STRIPE_WEBHOOK_SECRET=whsec_...

# Backend URL
EXPO_PUBLIC_RORK_API_BASE_URL=http://localhost:3000
```

## Testing Mobile Devices

If testing on a physical mobile device, replace `localhost` with your computer's IP address:

```bash
# Find your IP address:
# Mac/Linux: ifconfig | grep "inet "
# Windows: ipconfig

# Then update:
EXPO_PUBLIC_RORK_API_BASE_URL=http://192.168.1.100:3000
```

## Troubleshooting

1. **"Backend server is not running"** → Run `node start-backend.js`
2. **"HTTP 500"** → Check your environment variables
3. **"Invalid price ID"** → Verify your Stripe price ID
4. **Mobile can't connect** → Use your computer's IP instead of localhost

## Success Indicators

When everything works, you'll see:
- ✅ Backend server is running at: http://localhost:3000
- ✅ Making tRPC request to: http://localhost:3000/api/trpc/...
- ✅ Payment flows work without errors