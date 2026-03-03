# Callengo Stripe Synchronization

**Unified, production-ready script** for synchronizing all billing data to Stripe.

## Quick Start

```bash
# Sync to sandbox (test environment)
npm run stripe:sync

# Preview changes without applying (dry-run)
npm run stripe:sync:dry

# Sync to LIVE production
npm run stripe:sync:live
```

## What Gets Synced

### Products
- 5 subscription plans (Free, Starter, Business, Teams, Enterprise)
- Rich descriptions and metadata
- Statement descriptors for bank statements
- Environment tagging (sandbox/live)

### Features (Entitlements)
- **Entitlement features**: Tracked by Stripe for customer access
- **Marketing features**: Displayed in pricing tables (up to 15 per product)
- Common features for all plans (import/export, analytics, etc.)
- Plan-specific features (minutes, calls, permissions, etc.)

### Prices (Multi-Currency)
- **USD**: Primary currency
- **EUR**: European market (~0.92 EUR = 1 USD)
- **GBP**: UK market (~0.79 GBP = 1 USD)

**Monthly and Annual** prices for each:
- Starter: $99/mo or $87/mo annual ($1,044/yr, save 12%)
- Business: $299/mo or $269/mo annual ($3,228/yr, save 10%)
- Teams: $649/mo or $579/mo annual ($6,948/yr, save 11%)
- Enterprise: $1,499/mo or $1,349/mo annual ($16,188/yr, save 10%)

### Promotional Coupons & Codes

| Code | Discount | Duration | Max Uses | Purpose |
|------|----------|----------|----------|---------|
| `ADMIN100` | 100% off | Forever | Unlimited | Admin lifetime access |
| `TESTER01`-`TESTER10` | 100% off | 3 months | 1 each | QA/tester access (10 codes) |
| `LAUNCH50` | 50% off | 3 months | 100 | Launch campaign |
| `EARLY25` | 25% off | First month | 500 | Early bird offer |
| `ANNUAL20` | 20% off | Forever | Unlimited | Annual billing incentive |
| `CALLENGO30` | 30% off | 2 months | 250 | General marketing campaign |
| `WELCOME15` | 15% off | First month | 1,000 | New user welcome |
| `PARTNER40` | 40% off | 6 months | 50 | Partner/referral program |
| `LEGAL20` | 20% off | 12 months | 200 | Legal vertical (Clio users) |

## Script Flags

```bash
--env=sandbox|live    # Environment (default: sandbox)
--dry-run             # Preview without applying changes
--verbose             # Show detailed logs
--skip-prices         # Skip price creation/updates
--skip-coupons        # Skip coupon creation
--skip-features       # Skip feature creation
```

### Examples

```bash
# Dry run with verbose output
npm run stripe:sync -- --dry-run --verbose

# Skip coupons (useful if already created)
npm run stripe:sync -- --skip-coupons

# Production sync (LIVE)
npm run stripe:sync:live

# Only sync coupons (skip prices and features)
npm run stripe:sync -- --skip-prices --skip-features
```

## Safety Features

### Idempotent
- Safe to run multiple times
- Checks existing resources before creating
- Updates metadata without recreating

### Auto-Fix Incorrect Prices
- Detects annual prices with wrong amounts
- Archives old incorrect prices (preserves existing subscriptions)
- Creates new prices with correct amounts
- Updates Supabase with new price IDs

### Environment Protection
- Sandbox (test) by default
- Explicit `--env=live` flag required for production
- Clear confirmation messages

---

## Complete Setup: Sandbox to Live

### Step 1: Prerequisites

```bash
# Install dependencies
npm install

# Ensure .env.local has:
STRIPE_SECRET_KEY=sk_test_...           # Sandbox key
NEXT_PUBLIC_STRIPE_PUBLISHABLE_KEY=pk_test_...
NEXT_PUBLIC_SUPABASE_URL=https://...
SUPABASE_SERVICE_ROLE_KEY=...
NEXT_PUBLIC_APP_URL=http://localhost:3000
```

### Step 2: Run SQL Migrations

Run these in your Supabase SQL Editor **in order**:

1. `supabase/migrations/20260304000001_v3_pricing_feature_gating.sql` (V3 pricing)
2. `supabase/migrations/20260304000002_fix_annual_pricing_clio_business.sql` (Annual fix + Clio)

### Step 3: Sync to Sandbox

```bash
# Preview first
npm run stripe:sync -- --dry-run --verbose

# Apply to sandbox
npm run stripe:sync -- --verbose

# Verify in Stripe Dashboard (https://dashboard.stripe.com/test/products)
```

### Step 4: Test in Sandbox

1. Open your app at `localhost:3000`
2. Go to Settings > Billing
3. Toggle Monthly/Annual - verify prices display correctly
4. Test checkout flow with Stripe test card: `4242 4242 4242 4242`
5. Verify coupons work: apply `WELCOME15` at checkout
6. Check EUR/GBP pricing by changing currency

### Step 5: Prepare for Live Mode

```bash
# In Stripe Dashboard (https://dashboard.stripe.com):
# 1. Switch to LIVE mode (toggle in top-left)
# 2. Go to Developers > API Keys
# 3. Copy your LIVE keys
```

Update `.env.local` (or `.env.production`) for live:

```bash
STRIPE_SECRET_KEY=sk_live_...           # LIVE key
NEXT_PUBLIC_STRIPE_PUBLISHABLE_KEY=pk_live_...
```

### Step 6: Sync to Live

```bash
# ALWAYS preview first
npm run stripe:sync:live -- --dry-run --verbose

# If everything looks correct, apply
npm run stripe:sync:live -- --verbose
```

### Step 7: Configure Live Webhooks

In Stripe Dashboard > Developers > Webhooks:

1. Click "Add endpoint"
2. URL: `https://your-domain.com/api/stripe/webhook`
3. Events to listen for:
   - `checkout.session.completed`
   - `customer.subscription.created`
   - `customer.subscription.updated`
   - `customer.subscription.deleted`
   - `invoice.payment_succeeded`
   - `invoice.payment_failed`
4. Copy the webhook signing secret
5. Set `STRIPE_WEBHOOK_SECRET=whsec_live_...` in production env

### Step 8: Configure Multi-Currency (Live)

Multi-currency is handled automatically by the sync script. Stripe creates separate prices for USD, EUR, and GBP. The checkout flow auto-selects currency based on user preference.

To enable multi-currency in live mode:

1. **Stripe Settings**: Dashboard > Settings > Business settings > Currency
   - Ensure USD, EUR, GBP are all enabled as presentment currencies
2. **Payout currencies**: Dashboard > Settings > Payouts
   - Configure your bank accounts for each currency you want to receive
   - Or let Stripe auto-convert to your primary currency
3. **Tax settings** (optional): Dashboard > Settings > Tax
   - Enable Stripe Tax for automatic tax calculation
   - Set up tax registrations for EU VAT, UK VAT, etc.

The app's `useUserCurrency()` hook auto-detects the user's currency via geolocation and displays converted prices. The actual Stripe checkout uses the currency-specific price IDs created by the sync script.

### Step 9: Verify Live Setup

```bash
# Verify products exist
# Go to: https://dashboard.stripe.com/products

# Verify prices in all currencies
# Click each product > Pricing section > check USD, EUR, GBP

# Verify coupons
# Go to: https://dashboard.stripe.com/coupons

# Verify promotion codes
# Go to: https://dashboard.stripe.com/promotion_codes
```

### Step 10: Test Live Checkout

1. Use a real card (small amount plan like Starter)
2. Apply coupon `ADMIN100` for 100% off (no charge)
3. Verify subscription appears in Dashboard
4. Cancel immediately after testing
5. Or use your ADMIN100 code permanently

---

## Plan-Specific Features

**Free**:
- 15 one-time minutes, 1 agent (locked), 1 user
- Google Calendar + Meet, Google Sheets
- No overage

**Starter** ($99/mo):
- 300 min/month, 1 agent (switchable), 1 user
- $0.55/min overage
- Voicemail, follow-ups (2 max)
- Slack, Zoom, SimplyBook.me, Webhooks

**Business** ($299/mo):
- 1,200 min/month, unlimited agents, 3 users
- $0.39/min overage
- Smart follow-ups (5 max)
- Outlook, Teams, Twilio BYOP
- HubSpot, Pipedrive, Zoho, Clio
- Priority email support

**Teams** ($649/mo):
- 2,500 min/month, unlimited agents, 5 users ($69/extra)
- $0.29/min overage
- Advanced follow-ups (10 max), user permissions
- Salesforce, Dynamics 365
- All Business integrations

**Enterprise** ($1,499/mo):
- 6,000+ min/month, unlimited everything
- $0.25/min overage
- SLA, dedicated account manager
- All integrations (current + future)

## Deprecated Scripts

- `sync-stripe-plans.ts` - Basic sync (incomplete)
- `sync-stripe-advanced.ts` - Advanced but fragmented
- `fix-annual-prices.ts` - One-time fix (now built-in)

Use `stripe-sync.ts` for everything.

## Troubleshooting

### "Failed to connect to Stripe"
- Check `STRIPE_SECRET_KEY` in `.env.local`
- Ensure correct environment (test key for sandbox, live key for production)

### "Error fetching plans from database"
- Check `SUPABASE_SERVICE_ROLE_KEY` is set
- Verify plans exist in `subscription_plans` table
- Run SQL migrations first

### Annual prices showing wrong amounts
- Run the script - it auto-detects and fixes incorrect prices
- Old prices are archived, new ones created
- Existing subscriptions continue working
- **Important**: `price_annual` in DB = monthly equivalent on annual billing (NOT yearly total)

### Features not appearing in Stripe
- Ensure `--skip-features` is NOT set
- Marketing features have 15-item limit per product
- Check: Stripe Dashboard > Products > [Product] > Features tab

### Coupon/promotion code errors
- Coupons are idempotent (safe to re-run)
- If a coupon already exists, the script skips creation
- Promotion codes must be unique - if one exists with same code, it's skipped
- To reset: delete coupons in Stripe Dashboard first, then re-run

### Currency conversion
- Rates are hardcoded in script (USD=1, EUR=0.92, GBP=0.79)
- Update `CURRENCIES` object for custom rates
- Stripe handles actual payment conversion at checkout

## Production Deployment Checklist

- [ ] SQL migrations executed in Supabase
- [ ] Test sync in sandbox: `npm run stripe:sync -- --verbose`
- [ ] Verify sandbox checkout flow works
- [ ] Switch to LIVE Stripe keys
- [ ] Dry-run in live: `npm run stripe:sync:live -- --dry-run`
- [ ] Execute live sync: `npm run stripe:sync:live -- --verbose`
- [ ] Configure live webhook endpoint
- [ ] Enable multi-currency in Stripe settings
- [ ] Verify all products/prices in live Dashboard
- [ ] Test live checkout with ADMIN100 coupon
- [ ] Monitor webhook deliveries for first hour
- [ ] Verify billing page shows correct pricing

---

**Version**: 3.1.0
**Last Updated**: March 2026
**Maintainer**: Callengo Engineering Team
