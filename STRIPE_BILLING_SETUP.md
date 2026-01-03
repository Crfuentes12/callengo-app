# Stripe Billing System - Complete Setup Guide

This document provides a comprehensive guide to setting up and using the Stripe billing system integrated into the Callengo application.

## Table of Contents

1. [Overview](#overview)
2. [Architecture](#architecture)
3. [Prerequisites](#prerequisites)
4. [Installation & Configuration](#installation--configuration)
5. [Database Setup](#database-setup)
6. [Stripe Configuration](#stripe-configuration)
7. [Webhook Setup](#webhook-setup)
8. [Testing](#testing)
9. [Production Deployment](#production-deployment)
10. [API Reference](#api-reference)
11. [Troubleshooting](#troubleshooting)

---

## Overview

The Stripe billing system provides:

- ✅ **Subscription Management**: Monthly and annual billing cycles
- ✅ **Metered Billing**: Usage-based pricing for overage minutes
- ✅ **Stripe Checkout**: Secure payment processing
- ✅ **Billing Portal**: Customer self-service for subscription management
- ✅ **Webhook Integration**: Real-time event processing
- ✅ **Usage Tracking**: Automatic minute tracking and reporting
- ✅ **Overage Management**: Budget controls and alerts
- ✅ **Multiple Plans**: Free, Starter, Business, Teams, Enterprise

---

## Architecture

### System Components

```
┌─────────────────────────────────────────────────────────────┐
│                     Frontend (React)                        │
│  ├─ BillingSettings Component (Plan selection)              │
│  ├─ useStripe Hook (Checkout & Portal)                     │
│  └─ Stripe Elements (Payment forms)                         │
└────────────────────┬────────────────────────────────────────┘
                     │
┌────────────────────▼────────────────────────────────────────┐
│                  API Routes (Next.js)                       │
│  ├─ /api/billing/create-checkout-session                   │
│  ├─ /api/billing/create-portal-session                     │
│  ├─ /api/billing/report-usage                              │
│  ├─ /api/billing/check-usage-limit                         │
│  ├─ /api/billing/update-overage                            │
│  └─ /api/webhooks/stripe                                   │
└────────────────────┬────────────────────────────────────────┘
                     │
┌────────────────────▼────────────────────────────────────────┐
│              Business Logic Layer                           │
│  ├─ lib/stripe.ts (Stripe SDK wrapper)                     │
│  ├─ lib/billing/usage-tracker.ts                           │
│  └─ lib/billing/overage-manager.ts                         │
└────────────────────┬────────────────────────────────────────┘
                     │
┌────────────────────▼────────────────────────────────────────┐
│                    Stripe API                               │
│  ├─ Customers                                               │
│  ├─ Subscriptions                                           │
│  ├─ Products & Prices                                       │
│  ├─ Usage Records (Metered Billing)                        │
│  └─ Webhooks                                                │
└─────────────────────────────────────────────────────────────┘
                     │
┌────────────────────▼────────────────────────────────────────┐
│              Supabase (PostgreSQL)                          │
│  ├─ subscription_plans                                      │
│  ├─ company_subscriptions                                  │
│  ├─ usage_tracking                                          │
│  ├─ billing_history                                         │
│  ├─ billing_events                                          │
│  └─ stripe_events                                           │
└─────────────────────────────────────────────────────────────┘
```

---

## Prerequisites

- Node.js 18+ installed
- Supabase project set up
- Stripe account (test mode for development)
- npm or yarn package manager

---

## Installation & Configuration

### 1. Install Dependencies

```bash
npm install stripe @stripe/stripe-js
```

### 2. Environment Variables

Create a `.env.local` file (or update your existing one):

```bash
# Supabase
NEXT_PUBLIC_SUPABASE_URL=your-supabase-url
NEXT_PUBLIC_SUPABASE_ANON_KEY=your-supabase-anon-key
SUPABASE_SERVICE_ROLE_KEY=your-service-role-key

# Stripe
NEXT_PUBLIC_STRIPE_PUBLISHABLE_KEY=pk_test_...
STRIPE_SECRET_KEY=sk_test_...
STRIPE_WEBHOOK_SECRET=whsec_...

# App
NEXT_PUBLIC_APP_URL=http://localhost:3000
```

**Get Stripe Keys:**
1. Log in to [Stripe Dashboard](https://dashboard.stripe.com)
2. Go to **Developers** → **API Keys**
3. Copy the **Publishable key** and **Secret key**

---

## Database Setup

### 1. Run Migration

Apply the Stripe fields migration to your Supabase database:

```bash
# Using Supabase CLI
supabase db push

# Or manually execute the SQL file in Supabase SQL Editor
```

The migration file is located at: `supabase/migrations/add_stripe_fields.sql`

This will:
- Add Stripe ID columns to `subscription_plans`
- Add Stripe ID columns to `company_subscriptions`
- Add Stripe ID columns to `billing_history`
- Create `stripe_events` table for idempotency
- Add necessary indexes

### 2. Verify Tables

Check that these tables exist in your database:
- ✅ `subscription_plans` (with Stripe columns)
- ✅ `company_subscriptions` (with Stripe columns)
- ✅ `usage_tracking`
- ✅ `billing_history`
- ✅ `billing_events`
- ✅ `stripe_events` (new)

---

## Stripe Configuration

### 1. Create Products and Prices

Run the synchronization script to create products in Stripe based on your Supabase plans:

```bash
# Install tsx if not already installed
npm install -D tsx

# Run the sync script
npx tsx scripts/sync-stripe-plans.ts
```

This script will:
- Fetch all active plans from `subscription_plans`
- Create Stripe Products for each plan
- Create monthly and annual Prices
- Create metered Prices for overage billing
- Update Supabase with Stripe IDs

**Expected Output:**
```
🚀 Starting Stripe plans synchronization...

📋 Found 5 active plans to sync

📦 Processing plan: Free (free)
  → Creating new product in Stripe...
  ✅ Product created: prod_...
  ⏭️  Skipping monthly price (free plan)
  ✅ Completed: Free

📦 Processing plan: Starter (starter)
  → Creating new product in Stripe...
  ✅ Product created: prod_...
  → Creating monthly price...
  ✅ Monthly price created: price_... ($29/mo)
  → Creating annual price...
  ✅ Annual price created: price_... ($290/yr)
  ✅ Completed: Starter

...

🎉 Stripe plans synchronization completed!
```

### 2. Verify in Stripe Dashboard

1. Go to [Stripe Dashboard](https://dashboard.stripe.com/test/products)
2. Verify that all products were created
3. Check that each product has:
   - Monthly recurring price
   - Annual recurring price
   - Metered usage price (for overage)

---

## Webhook Setup

### Development (Local Testing)

Use Stripe CLI to forward webhook events to your local server:

```bash
# Install Stripe CLI
# https://stripe.com/docs/stripe-cli

# Login to Stripe
stripe login

# Forward events to local webhook
stripe listen --forward-to localhost:3000/api/webhooks/stripe
```

Copy the webhook signing secret (`whsec_...`) to your `.env.local`:
```bash
STRIPE_WEBHOOK_SECRET=whsec_...
```

### Production

1. Go to [Stripe Webhooks](https://dashboard.stripe.com/webhooks)
2. Click **Add endpoint**
3. Enter your webhook URL: `https://yourdomain.com/api/webhooks/stripe`
4. Select events to listen for:
   - `checkout.session.completed`
   - `customer.subscription.created`
   - `customer.subscription.updated`
   - `customer.subscription.deleted`
   - `invoice.payment_succeeded`
   - `invoice.payment_failed`
   - `customer.subscription.trial_will_end`
5. Copy the **Signing secret** to your production environment variables

---

## Testing

### 1. Test Checkout Flow

1. Start your development server: `npm run dev`
2. Navigate to Settings → Billing & Plans
3. Select a paid plan (e.g., Starter)
4. Use Stripe test card: `4242 4242 4242 4242`
   - Expiry: Any future date
   - CVC: Any 3 digits
   - ZIP: Any 5 digits
5. Complete checkout
6. Verify webhook events in Stripe CLI
7. Check database for updated subscription

### 2. Test Usage Tracking

```bash
# Call the report-usage API
curl -X POST http://localhost:3000/api/billing/report-usage \
  -H "Content-Type: application/json" \
  -d '{
    "companyId": "your-company-id",
    "minutes": 10,
    "callId": "test-call-123"
  }'
```

### 3. Test Overage

1. Enable overage in Settings
2. Set a budget (e.g., $50)
3. Report usage that exceeds included minutes
4. Verify metered usage in Stripe Dashboard

### 4. Test Billing Portal

1. Click "Manage Subscription & Payment" button
2. Verify redirect to Stripe Billing Portal
3. Test updating payment method
4. Test canceling subscription

---

## Production Deployment

### Pre-Flight Checklist

- [ ] Switch to Stripe **Live Mode** keys
- [ ] Update webhook endpoint to production URL
- [ ] Set production environment variables
- [ ] Test checkout with real card (then refund)
- [ ] Monitor webhook events
- [ ] Set up error alerting (e.g., Sentry)

### Environment Variables (Production)

```bash
NEXT_PUBLIC_STRIPE_PUBLISHABLE_KEY=pk_live_...
STRIPE_SECRET_KEY=sk_live_...
STRIPE_WEBHOOK_SECRET=whsec_...
NEXT_PUBLIC_APP_URL=https://yourdomain.com
```

### Monitoring

Monitor these endpoints for errors:
- `/api/webhooks/stripe` - Webhook processing
- `/api/billing/report-usage` - Usage tracking
- `/api/billing/create-checkout-session` - Checkout

Check `stripe_events` table for failed webhook processing.

---

## API Reference

### Checkout API

**POST** `/api/billing/create-checkout-session`

Creates a Stripe Checkout session for a subscription.

**Request:**
```json
{
  "planId": "plan-uuid",
  "billingCycle": "monthly" // or "annual"
}
```

**Response:**
```json
{
  "sessionId": "cs_test_...",
  "url": "https://checkout.stripe.com/..."
}
```

---

### Billing Portal API

**POST** `/api/billing/create-portal-session`

Creates a Stripe Billing Portal session.

**Response:**
```json
{
  "url": "https://billing.stripe.com/..."
}
```

---

### Usage Reporting API

**POST** `/api/billing/report-usage`

Reports usage for metered billing.

**Request:**
```json
{
  "companyId": "company-uuid",
  "minutes": 10,
  "callId": "call-uuid"
}
```

**Response:**
```json
{
  "success": true,
  "usage": {
    "minutes_used": 110,
    "minutes_included": 100,
    "overage_minutes": 10,
    "overage_cost": 8.00,
    "budget_remaining": 42.00
  }
}
```

---

### Usage Limit Check API

**POST** `/api/billing/check-usage-limit`

Checks if a company can make a call based on usage limits.

**Request:**
```json
{
  "companyId": "company-uuid"
}
```

**Response:**
```json
{
  "allowed": true,
  "reason": null,
  "usage": {
    "minutesUsed": 50,
    "minutesIncluded": 100,
    "overageMinutes": 0,
    "overageCost": 0
  },
  "subscription": {
    "status": "active",
    "overageEnabled": true,
    "overageBudget": 50,
    "overageSpent": 0
  }
}
```

---

### Overage Update API

**POST** `/api/billing/update-overage`

Updates overage settings and syncs with Stripe.

**Request:**
```json
{
  "companyId": "company-uuid",
  "subscriptionId": "subscription-uuid",
  "enabled": true,
  "budget": 50
}
```

---

## Troubleshooting

### Webhook Not Receiving Events

**Issue:** Webhooks are not being processed.

**Solution:**
1. Check Stripe CLI is running: `stripe listen --forward-to localhost:3000/api/webhooks/stripe`
2. Verify `STRIPE_WEBHOOK_SECRET` in `.env.local`
3. Check webhook endpoint in Stripe Dashboard
4. Look for errors in webhook logs

---

### Checkout Session Fails

**Issue:** Checkout session creation fails.

**Solution:**
1. Verify Stripe keys are correct
2. Check that plans have `stripe_price_id_monthly` and `stripe_price_id_annual`
3. Run sync script again: `npx tsx scripts/sync-stripe-plans.ts`
4. Check API logs for detailed error

---

### Usage Not Syncing to Stripe

**Issue:** Metered usage not appearing in Stripe.

**Solution:**
1. Verify `stripe_subscription_item_id` is set in `company_subscriptions`
2. Check that overage is enabled
3. Run manual sync: Call `/api/billing/report-usage`
4. Check Stripe Dashboard → Subscriptions → Usage

---

### Database Migration Fails

**Issue:** Migration fails with "table already exists".

**Solution:**
```sql
-- Check if columns exist
SELECT column_name
FROM information_schema.columns
WHERE table_name = 'subscription_plans';

-- If needed, manually add missing columns
ALTER TABLE subscription_plans
ADD COLUMN IF NOT EXISTS stripe_product_id TEXT;
```

---

## Advanced Usage

### Custom Metered Billing

To add custom metered items:

```typescript
import { enableOverage } from '@/lib/billing/overage-manager';

await enableOverage({
  companyId: 'company-uuid',
  budget: 100,
});
```

### Sync All Usage

Run a batch sync of all metered usage:

```typescript
import { syncAllMeteredUsage } from '@/lib/billing/overage-manager';

await syncAllMeteredUsage();
```

### Check Usage Before Action

Before initiating a call:

```typescript
import { checkUsageLimit } from '@/lib/billing/usage-tracker';

const result = await checkUsageLimit(companyId);
if (!result.allowed) {
  throw new Error(result.reason);
}
```

---

## Support

For questions or issues:
- Check [Stripe Documentation](https://stripe.com/docs)
- Review webhook logs in Stripe Dashboard
- Check `stripe_events` table for failed events
- Review API logs in your hosting platform

---

## Summary

✅ **Complete Stripe Integration** with checkout, billing portal, and webhooks
✅ **Metered Billing** for overage with budget controls
✅ **Automatic Usage Tracking** and reporting
✅ **Robust Error Handling** with idempotency
✅ **Production Ready** with comprehensive testing

The system is now fully integrated with Stripe and ready for production use!
