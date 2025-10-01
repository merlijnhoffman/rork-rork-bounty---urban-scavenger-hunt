# Troubleshooting Network Errors

## Error: "tRPC fetch error: TypeError: Network request failed"

This error occurs when the app cannot connect to the backend server. Here's how to fix it:

### Quick Fix

**Start the backend server:**

```bash
# Option 1: Using the start script
node start-backend.js

# Option 2: Direct command
bun run backend/hono.ts
```

### Verify Backend is Running

Open http://localhost:3000 in your browser. You should see:
```json
{"status":"ok","message":"API is running"}
```

If you see this, your backend is running correctly!

---

## Testing on Mobile Devices

If you're testing on a **physical mobile device** (not the web preview), you need to use your computer's IP address instead of `localhost`.

### Step 1: Find Your Computer's IP Address

**Mac/Linux:**
```bash
ifconfig | grep "inet "
# Look for something like: inet 192.168.1.145
```

**Windows:**
```bash
ipconfig
# Look for IPv4 Address under your active network adapter
```

### Step 2: Update .env.local

Replace `localhost` with your IP address:

```bash
# Before:
EXPO_PUBLIC_RORK_API_BASE_URL=http://localhost:3000

# After (use YOUR IP address):
EXPO_PUBLIC_RORK_API_BASE_URL=http://192.168.1.145:3000
```

### Step 3: Restart the App

After changing `.env.local`, restart your Expo app for the changes to take effect.

---

## Common Issues

### 1. Backend Server Not Running
**Symptom:** "Network request failed" or "Failed to fetch"

**Solution:** Start the backend server with `node start-backend.js`

### 2. Wrong IP Address
**Symptom:** Works on web but not on mobile device

**Solution:** Update `EXPO_PUBLIC_RORK_API_BASE_URL` in `.env.local` with your computer's IP address

### 3. Firewall Blocking Connection
**Symptom:** Backend is running but mobile device can't connect

**Solution:** 
- Make sure your computer and mobile device are on the same WiFi network
- Check if your firewall is blocking port 3000
- Try temporarily disabling your firewall to test

### 4. Environment Variables Not Set
**Symptom:** Backend crashes on startup

**Solution:** Make sure all required variables are in `.env.local`:
```bash
EXPO_PUBLIC_SUPABASE_URL=https://your-project.supabase.co
EXPO_PUBLIC_SUPABASE_ANON_KEY=your_anon_key
SUPABASE_SERVICE_ROLE_KEY=your_service_role_key
STRIPE_SECRET_KEY=sk_live_...
STRIPE_WEBHOOK_SECRET=whsec_...
EXPO_PUBLIC_STRIPE_PUBLISHABLE_KEY=pk_live_...
EXPO_PUBLIC_STRIPE_PRICE_ID=price_...
EXPO_PUBLIC_RORK_API_BASE_URL=http://localhost:3000
```

---

## Success Indicators

When everything is working correctly, you should see these logs:

```
✅ Backend server is running at: http://localhost:3000
✅ Making tRPC request to: http://localhost:3000/api/trpc/...
```

---

## Still Having Issues?

1. Check the console logs for detailed error messages
2. Verify all environment variables are set correctly
3. Make sure Supabase and Stripe credentials are valid
4. Try restarting both the backend server and the Expo app
5. Check if port 3000 is already in use by another application
