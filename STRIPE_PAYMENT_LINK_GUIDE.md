# Stripe Payment Link Integration Guide

This guide explains how to temporarily switch from the embedded Stripe payment system to using Stripe Payment Links that open in a browser.

## Overview

Instead of processing payments within the app, users will be redirected to a Stripe-hosted payment page. After completing the payment, they'll be redirected back to your app via deep links.

## Step-by-Step Setup

### 1. Create a Stripe Payment Link

1. **Go to Stripe Dashboard**: https://dashboard.stripe.com/
2. **Navigate to Payment Links** in the left sidebar
3. **Click "+ New"** to create a new payment link
4. **Configure the payment link**:
   - **Product**: Select your existing product or create new (€3.99 for Hunt Ticket)
   - **Quantity**: Set to 1 (one ticket per purchase)
   - **After payment**: 
     - Success URL: `bounty://payment-success`
     - Cancel URL: `bounty://payment-cancel` (optional)
   - **Collect customer information**: Enable email collection
   - **Payment methods**: Enable card payments
5. **Save and copy the payment link URL** (e.g., `https://buy.stripe.com/test_xxxxx`)

### 2. Update Environment Variables

Open your `.env.local` file and add the payment link:

```bash
# Stripe Payment Link (temporary solution)
EXPO_PUBLIC_STRIPE_PAYMENT_LINK=https://buy.stripe.com/YOUR_ACTUAL_LINK_HERE
```

Replace `YOUR_ACTUAL_LINK_HERE` with the payment link you copied from Stripe.

### 3. Configure Deep Links (Already Done)

The app is already configured to handle deep links with the scheme `bounty://`. The code will automatically:
- Listen for `bounty://payment-success` - Shows success message and refreshes ticket status
- Listen for `bounty://payment-cancel` - Shows cancellation message

### 4. Test the Flow

#### On Web:
1. Click "PURCHASE TICKET" button
2. Browser opens Stripe payment page in new tab
3. Complete payment (use test card: 4242 4242 4242 4242)
4. After payment, you'll be redirected back to the app
5. Success alert appears and ticket status refreshes

#### On Mobile (iOS/Android):
1. Click "PURCHASE TICKET" button
2. Browser/WebView opens with Stripe payment page
3. Complete payment
4. App automatically reopens via deep link
5. Success alert appears and ticket status refreshes

### 5. Testing with Stripe Test Mode

Use these test cards:
- **Success**: 4242 4242 4242 4242
- **Decline**: 4000 0000 0000 0002
- **3D Secure**: 4000 0025 0000 3155

Any future expiry date and any 3-digit CVC will work.

## How It Works

### Payment Flow:

1. **User clicks "PURCHASE TICKET"**
   - App checks if payment link is configured
   - If not configured, shows alert with setup instructions
   - If configured, opens payment link in browser

2. **User completes payment on Stripe**
   - Stripe processes the payment
   - On success: Redirects to `bounty://payment-success`
   - On cancel: Redirects to `bounty://payment-cancel`

3. **App receives deep link**
   - Deep link listener catches the redirect
   - Shows appropriate alert message
   - Refreshes ticket status from backend

4. **Backend webhook (recommended)**
   - Stripe sends webhook to your backend
   - Backend creates ticket in database
   - App polls for ticket status

### Code Changes Made:

1. **Added Linking import** to handle deep links
2. **Modified handlePurchaseTicket()** to open payment link instead of modal
3. **Added deep link listener** in useEffect to handle return from Stripe
4. **Added configuration check** to guide users if payment link not set up

## Advantages of Payment Links

✅ **No backend required** for payment processing  
✅ **Works on all platforms** (web, iOS, Android)  
✅ **Stripe-hosted** - PCI compliant by default  
✅ **Easy to test** on your computer  
✅ **Mobile-friendly** - Optimized checkout experience  
✅ **Quick setup** - No complex integration needed  

## Limitations

⚠️ **User leaves app** during payment  
⚠️ **Requires internet** connection  
⚠️ **Deep link handling** must be properly configured  
⚠️ **Manual ticket creation** - You'll need to handle ticket creation via webhooks  

## Webhook Setup (Recommended)

To automatically create tickets after payment:

1. **Go to Stripe Dashboard** → Developers → Webhooks
2. **Add endpoint**: `https://your-domain.com/api/stripe/webhook`
3. **Select events**:
   - `checkout.session.completed`
   - `payment_intent.succeeded`
4. **Copy webhook secret** and add to `.env.local`:
   ```bash
   STRIPE_WEBHOOK_SECRET=whsec_xxxxx
   ```

## Reverting to Old Flow

If you want to go back to the embedded payment flow:

1. Remove or comment out the payment link from `.env.local`
2. The app will automatically fall back to the old modal-based flow
3. Or click "Use Old Flow" when the configuration alert appears

## Troubleshooting

### Payment link not opening:
- Check that `EXPO_PUBLIC_STRIPE_PAYMENT_LINK` is set correctly in `.env.local`
- Restart your development server after changing `.env.local`
- Verify the payment link is active in Stripe Dashboard

### Deep link not working:
- On iOS: Make sure URL scheme `bounty` is registered in app.json
- On Android: Check that intent filters are properly configured
- Test deep link manually: Open `bounty://payment-success` in browser

### Ticket not appearing after payment:
- Check backend logs for webhook delivery
- Manually refresh ticket status by pulling down on the hunt screen
- Verify webhook endpoint is publicly accessible
- Check Stripe Dashboard → Developers → Webhooks for delivery status

## Support

For issues with:
- **Stripe setup**: Check Stripe documentation or contact Stripe support
- **Deep links**: Review Expo documentation on deep linking
- **Backend integration**: Check your backend logs and webhook configuration

---

**Note**: This is a temporary solution for testing. For production, consider implementing a more robust payment flow with proper error handling and ticket creation logic.
