# Stripe Synchronization Scripts

This directory contains scripts for synchronizing your billing configuration with Stripe.

## 📋 Available Scripts

### 1. `sync-stripe-advanced.ts` ⭐ **RECOMMENDED**

Advanced, production-ready script with comprehensive features:

**Features:**
- ✅ Products with rich descriptions and features
- ✅ Recurring prices (monthly/annual) with tax configuration
- ✅ Metered prices for overage billing
- ✅ Promotional coupons with redemption limits
- ✅ Promotion codes for easy sharing
- ✅ Dry-run mode to preview changes
- ✅ Idempotent operations (safe to run multiple times)
- ✅ Comprehensive error handling
- ✅ Detailed logging and reporting

**Usage:**

```bash
# Full synchronization (preview only)
npx tsx scripts/sync-stripe-advanced.ts --dry-run

# Apply all changes
npx tsx scripts/sync-stripe-advanced.ts

# Sync only coupons
npx tsx scripts/sync-stripe-advanced.ts --coupons

# Sync only plans
npx tsx scripts/sync-stripe-advanced.ts --plans

# Verbose output for debugging
npx tsx scripts/sync-stripe-advanced.ts --verbose
```

### 2. `sync-stripe-plans.ts`

Basic script for simple synchronization (legacy).

**Usage:**
```bash
npx tsx scripts/sync-stripe-plans.ts
```

---

## 🎫 Configured Coupons

The advanced script creates these promotional coupons:

| Code | Discount | Duration | Max Uses | Purpose |
|------|----------|----------|----------|---------|
| `TOTAL100` | 100% | Forever | 5 | Full access for early adopters |
| `LAUNCH50` | 50% | 3 months | 100 | Launch special promotion |
| `EARLY25` | 25% | Once | 500 | Early bird discount |
| `ANNUAL20` | 20% | Forever | ∞ | Annual plan incentive |

### How Customers Use Coupons

1. **During Checkout:**
   - Customer clicks "Have a promo code?"
   - Enters code (e.g., `TOTAL100`)
   - Discount applied automatically

2. **Redemption Limits:**
   - `TOTAL100`: Limited to 5 users total
   - `LAUNCH50`: Limited to 100 users total
   - `EARLY25`: Limited to 500 users total
   - `ANNUAL20`: Unlimited (annual plans only)

3. **Tracking:**
   - View usage in Stripe Dashboard: https://dashboard.stripe.com/coupons
   - Monitor redemptions in real-time

---

## 💰 Pricing Structure Created

### Products

Each plan creates:
1. **Stripe Product** with:
   - Rich description
   - Feature list
   - Custom metadata
   - Statement descriptor

2. **Monthly Price** (recurring)
   - Tax exclusive
   - Usage type: licensed

3. **Annual Price** (recurring)
   - Tax exclusive
   - Automatic savings calculation
   - Usage type: licensed

4. **Metered Price** (overage)
   - Per-minute billing
   - Usage type: metered
   - Billed monthly based on consumption

### Example: Starter Plan

```
Product: Callengo Starter
├─ Monthly Price: $29/month
├─ Annual Price: $290/year (17% savings)
└─ Metered Price: $0.50/minute (overage)
```

When a customer:
- Subscribes to **Monthly**: Pays $29/month
- Uses **600 minutes** (500 included + 100 overage): Pays $29 + (100 × $0.50) = $79
- Applies coupon **TOTAL100**: Pays $0 (100% off)

---

## 🔧 Configuration

### Environment Variables

Required in `.env.local`:

```bash
NEXT_PUBLIC_SUPABASE_URL=your-supabase-url
SUPABASE_SERVICE_ROLE_KEY=your-service-role-key
STRIPE_SECRET_KEY=sk_test_... # or sk_live_...
```

### Customizing Coupons

Edit `COUPONS_CONFIG` in `sync-stripe-advanced.ts`:

```typescript
{
  id: 'CUSTOM50',
  name: '50% Off Custom Campaign',
  percent_off: 50,
  duration: 'repeating',
  duration_in_months: 6,
  max_redemptions: 50,
  metadata: {
    campaign: 'custom_campaign_2024',
  },
}
```

### Customizing Product Descriptions

Edit `PRODUCT_DESCRIPTIONS` in `sync-stripe-advanced.ts`:

```typescript
starter: {
  short: 'Your short description',
  long: 'Your detailed description...',
  features: [
    'Feature 1',
    'Feature 2',
    // ...
  ],
  statement_descriptor: 'YOUR BRAND',
}
```

---

## 📊 What Gets Synced

### From Supabase → Stripe

```
subscription_plans table
├─ name                    → Product name
├─ description             → Product description
├─ price_monthly           → Monthly recurring price
├─ price_annual            → Annual recurring price
├─ price_per_extra_minute  → Metered price
├─ minutes_included        → Product metadata
├─ max_users               → Product metadata
└─ features                → Product features

Stored back in Supabase:
├─ stripe_product_id
├─ stripe_price_id_monthly
├─ stripe_price_id_annual
└─ stripe_metered_price_id
```

### Created in Stripe Only

- Coupons (`TOTAL100`, `LAUNCH50`, etc.)
- Promotion codes
- Tax configuration references

---

## ⚠️ Important Notes

### Idempotency

The script is safe to run multiple times:
- ✅ Existing products are updated, not duplicated
- ✅ Existing prices are reused
- ✅ Existing coupons are not duplicated
- ✅ Database IDs are preserved

### Dry Run First

**Always test with `--dry-run` first:**

```bash
npx tsx scripts/sync-stripe-advanced.ts --dry-run
```

This shows you exactly what will be created/updated without making changes.

### Price Changes

⚠️ **Important:** You cannot modify existing Stripe prices. If you need to change pricing:

1. The script will create NEW prices
2. Old prices remain (for existing subscriptions)
3. New subscriptions use new prices
4. Manually archive old prices in Stripe Dashboard

### Coupons

⚠️ **Once created, coupons cannot be modified.** To change:

1. Create a new coupon with different ID
2. Archive the old one in Stripe Dashboard
3. Update your marketing materials

---

## 🚀 Common Workflows

### Initial Setup

```bash
# 1. Preview what will be created
npx tsx scripts/sync-stripe-advanced.ts --dry-run

# 2. Review the output carefully

# 3. Apply changes
npx tsx scripts/sync-stripe-advanced.ts

# 4. Verify in Stripe Dashboard
open https://dashboard.stripe.com/products
```

### Adding a New Coupon

1. Edit `COUPONS_CONFIG` in `sync-stripe-advanced.ts`
2. Add your coupon configuration
3. Run: `npx tsx scripts/sync-stripe-advanced.ts --coupons`

### Updating Product Descriptions

1. Edit `PRODUCT_DESCRIPTIONS` in `sync-stripe-advanced.ts`
2. Update descriptions/features
3. Run: `npx tsx scripts/sync-stripe-advanced.ts --plans`

### Creating a New Plan

1. Add plan to `subscription_plans` table in Supabase
2. Run: `npx tsx scripts/sync-stripe-advanced.ts --plans`
3. Verify in Stripe Dashboard

---

## 🐛 Troubleshooting

### Error: "Product already exists"

This is normal. The script updates existing products instead of creating duplicates.

### Error: "Coupon already exists"

Coupons cannot be modified. Create a new one with a different ID if needed.

### Error: "Invalid API key"

Check your `.env.local` file:
- Ensure `STRIPE_SECRET_KEY` is set
- Verify the key starts with `sk_test_` (test) or `sk_live_` (production)
- No extra spaces or quotes

### Prices not showing in checkout

1. Verify prices were created: Check script output
2. Check Supabase: Ensure `stripe_price_id_monthly` and `stripe_price_id_annual` are populated
3. Check Stripe Dashboard: Ensure prices are active

---

## 📈 Monitoring

### Check Coupon Usage

```bash
# View in dashboard
open https://dashboard.stripe.com/coupons

# Or use Stripe CLI
stripe coupons list
stripe coupons retrieve TOTAL100
```

### Check Product Sync Status

Query Supabase:

```sql
SELECT
  name,
  stripe_product_id IS NOT NULL as has_product,
  stripe_price_id_monthly IS NOT NULL as has_monthly,
  stripe_price_id_annual IS NOT NULL as has_annual,
  stripe_metered_price_id IS NOT NULL as has_metered
FROM subscription_plans
WHERE is_active = true;
```

---

## 🔐 Security

- Never commit `.env.local` to git
- Use test keys for development
- Use live keys only in production
- Rotate keys periodically
- Use different keys for different environments

---

## 📚 Additional Resources

- [Stripe Products API](https://stripe.com/docs/api/products)
- [Stripe Prices API](https://stripe.com/docs/api/prices)
- [Stripe Coupons API](https://stripe.com/docs/api/coupons)
- [Stripe Metered Billing](https://stripe.com/docs/billing/subscriptions/usage-based)
- [Stripe Tax](https://stripe.com/docs/tax)

---

## 💡 Tips

1. **Use dry-run mode** before making changes
2. **Test coupons** with test mode first
3. **Monitor redemptions** to prevent abuse
4. **Archive old coupons** when campaigns end
5. **Keep descriptions updated** for better customer experience
6. **Use statement descriptors** that customers will recognize on their bank statement

---

**Questions?** Check the main documentation: `STRIPE_BILLING_SETUP.md`
