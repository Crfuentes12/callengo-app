# Callengo Stripe Synchronization

**Unified, production-ready script** for synchronizing all billing data to Stripe.

## 🚀 Quick Start

```bash
# Sync to sandbox (test environment)
npm run stripe:sync

# Preview changes without applying (dry-run)
npm run stripe:sync:dry

# Sync to LIVE production (⚠️ use with caution)
npm run stripe:sync:live
```

## 📋 What Gets Synced

### ✅ Products
- 5 subscription plans (Free, Starter, Business, Teams, Enterprise)
- Rich descriptions and metadata
- Statement descriptors for bank statements
- Environment tagging (sandbox/live)

### ✅ Features (Entitlements)
- **Entitlement features**: Tracked by Stripe for customer access
- **Marketing features**: Displayed in pricing tables (up to 15 per product)
- Coherent with product spec document
- Common features for all plans (import/export, analytics, etc.)
- Plan-specific features (minutes, calls, permissions, etc.)

### ✅ Prices (Multi-Currency)
- **USD**: Primary currency
- **EUR**: European market (~0.92 EUR = 1 USD)
- **GBP**: UK market (~0.79 GBP = 1 USD)

**Monthly and Annual** prices for each:
- Starter: $99/mo or $1,068/yr ($89/mo equiv, save 10%)
- Business: $279/mo or $2,988/yr ($249/mo equiv, save 11%)
- Teams: $599/mo or $6,348/yr ($529/mo equiv, save 12%)
- Enterprise: $1,500/mo or $16,200/yr ($1,350/mo equiv, save 10%)

### ✅ Promotional Coupons
- **TOTAL100**: 100% off, limited to 5 redemptions (forever)
- **LAUNCH50**: 50% off for 3 months, 100 redemptions max
- **EARLY25**: 25% off once, 500 redemptions max
- **ANNUAL20**: 20% off forever (annual plans only)

## 🔧 Script Flags

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
```

## 🛡️ Safety Features

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

### Dry-Run Mode
- Preview all changes before applying
- Shows what would be created/updated
- No Stripe API mutations

## 📊 Feature Organization

Features are organized in `/src/config/plan-features.ts`:

### Common Features (All Plans)
- CSV/Excel/Google Sheets import
- JSON import/export
- Phone normalization
- Contact deduplication
- Custom fields & tags
- AI agent creation
- Call analytics
- Transcriptions
- Usage dashboard
- Billing alerts

### Plan-Specific Features

**Free**:
- 15 one-time minutes
- 3 min max per call
- 1 concurrent call
- 1 agent, 1 user
- $0.80/min overage

**Starter**:
- 300 min/month
- 3 min max per call
- 1 concurrent call
- 1 agent, 1 user
- $0.60/min overage
- Basic async support

**Business**:
- 1,200 min/month
- 5 min max per call
- 3 concurrent calls
- Unlimited agents, 3 users
- $0.35/min overage
- Automatic follow-ups
- Call scheduling
- Simple campaigns
- Priority email support

**Teams**:
- 2,400 min/month
- 8 min max per call
- 10 concurrent calls
- Unlimited agents, 5 users ($79/extra)
- $0.22/min overage
- User permissions
- Governance & logs
- Agent/campaign analytics
- Voicemail handling
- Advanced retry logic
- Priority support
- CRM integrations (coming soon)

**Enterprise**:
- 6,000+ min/month
- 15 min max per call (custom)
- 50+ concurrent calls
- Unlimited agents & users
- $0.18/min overage
- Annual contract
- SLA guarantee
- Dedicated account manager
- Priority infrastructure
- Security & compliance
- Full audit logs
- Custom integrations
- Full CRM integration
- Roadmap influence

## 🔄 Migration from Old Scripts

### Deprecated Scripts (DO NOT USE)
- ❌ `sync-stripe-plans.ts` - Basic sync (incomplete)
- ❌ `sync-stripe-advanced.ts` - Advanced but fragmented
- ❌ `fix-annual-prices.ts` - One-time fix (now built-in)

### Use Instead
- ✅ `stripe-sync.ts` - Universal script with all features

### Migration Steps
1. Delete old price IDs from Supabase (optional)
2. Run `npm run stripe:sync:dry` to preview
3. Run `npm run stripe:sync` to apply
4. Verify in Stripe Dashboard
5. Archive old scripts (don't delete, keep for reference)

## 📈 Output Example

```
╔═══════════════════════════════════════════════════════════╗
║     CALLENGO - UNIVERSAL STRIPE SYNCHRONIZATION v3.0     ║
╚═══════════════════════════════════════════════════════════╝

ℹ️  Environment: SANDBOX
⚠️  Dry run: YES
ℹ️  Verbose: YES

ℹ️  Testing Stripe connection...
✅ Connected to Stripe account: Callengo sandbox

💰 Starting coupon synchronization...

  Processing coupon: TOTAL100 (100% Off - Full Access (Limited))
✅    Coupon created: TOTAL100 (100% off)
✅    Promotion code created: TOTAL100

🚀 Starting subscription plans synchronization...
ℹ️  Found 5 active plans to sync

📦 Processing plan: Starter (starter)
────────────────────────────────────────────────────────────
✅  Product created: prod_xxx
✅  Synced 7 features to product
✅  USD Monthly: price_xxx ($99/mo)
✅  USD Annual: price_xxx ($1068/yr = $89/mo, save 10%)
✅  EUR Monthly: price_xxx (€91/mo)
✅  EUR Annual: price_xxx (€983/yr = €82/mo, save 10%)
✅  GBP Monthly: price_xxx (£78/mo)
✅  GBP Annual: price_xxx (£844/yr = £70/mo, save 10%)
✅ Completed: Starter

╔═══════════════════════════════════════════════════════════╗
║                    SYNC COMPLETED                         ║
╚═══════════════════════════════════════════════════════════╝

✅ All changes have been applied successfully!
```

## 🎯 Billing Page Integration

The billing page (`/src/components/settings/BillingSettings.tsx`) now:
- Loads features dynamically from `/src/config/plan-features.ts`
- Shows coherent features for each plan
- Displays correct pricing (annual = monthly × 12)
- Integrates with Stripe Checkout and Billing Portal

Features are rendered automatically - no hardcoded HTML.

## 🔐 Environment Variables Required

```env
# Stripe
STRIPE_SECRET_KEY=sk_test_...  # or sk_live_... for production
NEXT_PUBLIC_STRIPE_PUBLISHABLE_KEY=pk_test_...

# Supabase
NEXT_PUBLIC_SUPABASE_URL=https://...
SUPABASE_SERVICE_ROLE_KEY=...

# App
NEXT_PUBLIC_APP_URL=http://localhost:3000
```

## 📝 Troubleshooting

### "Failed to connect to Stripe"
- Check your `STRIPE_SECRET_KEY` in `.env.local`
- Ensure you're using the correct environment (sandbox vs live)

### "Error fetching plans from database"
- Check `SUPABASE_SERVICE_ROLE_KEY` is set
- Verify plans exist in `subscription_plans` table

### Annual prices showing wrong amounts
- Run the script - it auto-detects and fixes incorrect prices
- Old prices are archived, new ones created
- Existing subscriptions continue working

### Features not appearing in Stripe
- Entitlement features require `--skip-features=false` (default)
- Check Stripe Dashboard > Products > [Product] > Features tab
- Marketing features have 15-item limit per product

### Currency conversion issues
- Default conversion rates in script (USD → EUR, GBP)
- Update `CURRENCIES` object in script for custom rates
- Stripe handles actual payment conversion at checkout

## 🚦 Production Deployment Checklist

Before running in production (`--env=live`):

- [ ] Backup current Stripe products/prices (export from dashboard)
- [ ] Test in sandbox environment first
- [ ] Run dry-run in production: `npm run stripe:sync:live -- --dry-run`
- [ ] Verify environment variables are for LIVE Stripe account
- [ ] Confirm all plans in database are correct
- [ ] Check webhook endpoint is configured
- [ ] Have rollback plan ready
- [ ] Execute: `npm run stripe:sync:live`
- [ ] Verify in Stripe Dashboard
- [ ] Test checkout flow with test payment
- [ ] Monitor for errors in first hour

## 📞 Support

Questions or issues?
- Check this README first
- Review script output (use `--verbose`)
- Test with `--dry-run` flag
- Contact: dev@callengo.ai

---

**Version**: 3.0.0
**Last Updated**: January 2026
**Maintainer**: Callengo Engineering Team
