# Stripe Billing - Quick Start Guide

## 🚀 Quick Setup (5 minutes)

### 1. Install Dependencies
```bash
npm install
```

### 2. Set Environment Variables

Add to your `.env.local`:

```bash
# Stripe Test Keys
NEXT_PUBLIC_STRIPE_PUBLISHABLE_KEY=pk_test_YOUR_KEY
STRIPE_SECRET_KEY=sk_test_YOUR_KEY
STRIPE_WEBHOOK_SECRET=whsec_YOUR_SECRET

# App URL
NEXT_PUBLIC_APP_URL=http://localhost:3000
```

**Get your keys:** https://dashboard.stripe.com/test/apikeys

### 3. Run Database Migration

```bash
# Using Supabase CLI
supabase db push

# Or run the SQL file manually in Supabase SQL Editor:
# supabase/migrations/add_stripe_fields.sql
```

### 4. Sync Plans to Stripe

```bash
npx tsx scripts/sync-stripe-plans.ts
```

### 5. Setup Webhook (Development)

```bash
# Install Stripe CLI: https://stripe.com/docs/stripe-cli
stripe login
stripe listen --forward-to localhost:3000/api/webhooks/stripe
```

Copy the webhook secret to `.env.local`.

### 6. Start Development Server

```bash
npm run dev
```

---

## ✅ Test the Integration

1. Navigate to **Settings → Billing & Plans**
2. Select a paid plan (e.g., Starter)
3. Use test card: `4242 4242 4242 4242`
4. Complete checkout
5. Verify subscription in Stripe Dashboard

---

## 📋 What Was Implemented

### Backend APIs
- ✅ `/api/billing/create-checkout-session` - Stripe Checkout
- ✅ `/api/billing/create-portal-session` - Billing Portal
- ✅ `/api/billing/report-usage` - Metered billing
- ✅ `/api/billing/check-usage-limit` - Usage verification
- ✅ `/api/billing/update-overage` - Overage management
- ✅ `/api/webhooks/stripe` - Webhook handler

### Services
- ✅ `lib/stripe.ts` - Stripe SDK wrapper
- ✅ `lib/billing/usage-tracker.ts` - Usage tracking
- ✅ `lib/billing/overage-manager.ts` - Overage management

### Frontend
- ✅ `hooks/useStripe.ts` - Stripe React hook
- ✅ `components/settings/BillingSettings.tsx` - Updated with Stripe

### Database
- ✅ New columns for Stripe IDs
- ✅ `stripe_events` table for idempotency

---

## 📖 Full Documentation

See [STRIPE_BILLING_SETUP.md](./STRIPE_BILLING_SETUP.md) for complete documentation.

---

## 🔥 Key Features

### Subscription Management
- Monthly and annual billing
- Multiple plan tiers
- Upgrade/downgrade with proration
- Trial periods

### Metered Billing
- Usage-based overage charges
- Real-time usage tracking
- Budget controls and alerts
- Automatic Stripe sync

### Customer Self-Service
- Stripe Checkout for payments
- Billing Portal for subscription management
- Update payment methods
- View invoices

### Robust Integration
- Webhook event processing
- Idempotency for reliability
- Error handling and logging
- Production-ready security

---

## 🛠️ Common Commands

```bash
# Sync plans to Stripe
npx tsx scripts/sync-stripe-plans.ts

# Test usage reporting
curl -X POST http://localhost:3000/api/billing/report-usage \
  -H "Content-Type: application/json" \
  -d '{"companyId": "uuid", "minutes": 10, "callId": "test-123"}'

# Check usage limit
curl -X POST http://localhost:3000/api/billing/check-usage-limit \
  -H "Content-Type: application/json" \
  -d '{"companyId": "uuid"}'

# Forward webhooks (development)
stripe listen --forward-to localhost:3000/api/webhooks/stripe
```

---

## 🚨 Troubleshooting

**Checkout fails?**
- Verify Stripe keys in `.env.local`
- Run sync script to create prices
- Check console for errors

**Webhooks not working?**
- Ensure Stripe CLI is running
- Verify webhook secret
- Check webhook endpoint logs

**Usage not syncing?**
- Verify overage is enabled
- Check `stripe_subscription_item_id` exists
- Review `/api/billing/report-usage` logs

---

## 🎯 Next Steps

1. **Production Setup**
   - Switch to live Stripe keys
   - Configure production webhook
   - Test with real payment

2. **Customize Plans**
   - Update plan features in Supabase
   - Run sync script
   - Update UI copy

3. **Monitor**
   - Set up error tracking (Sentry)
   - Monitor webhook events
   - Track failed payments

---

## 💡 Need Help?

- 📖 [Full Documentation](./STRIPE_BILLING_SETUP.md)
- 🔗 [Stripe Docs](https://stripe.com/docs)
- 🎫 Check `stripe_events` table for webhook logs
- 📊 Monitor Stripe Dashboard for real-time data
