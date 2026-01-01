# Pricing Migration Guide

## 📊 Overview

This guide explains how to migrate your Callengo database from the old **calls-based** pricing model to the new **minutes-based** pricing model.

## 🎯 Why This Change?

The new pricing model:
- ✅ Tracks actual cost driver (minutes, not calls)
- ✅ Guarantees 40-55% margins on all plans
- ✅ Prevents losses from long calls
- ✅ More predictable revenue with call duration limits

## 🚀 Migration Steps

### For EXISTING Databases

If you already have the billing tables (`subscription_plans`, `usage_tracking`, etc.) in your database:

**Run this file:** `supabase-pricing-migration.sql`

This script will:
1. Add new columns (`minutes_included`, `max_call_duration`, `price_per_extra_minute`)
2. Migrate existing data from calls to minutes
3. Update computed columns
4. Insert the new optimized pricing plans
5. Keep old columns for safety (you can drop them later)

**⚠️ Important:**
- This will DELETE existing subscription_plans and start fresh with the new pricing
- Usage tracking data will be migrated (not deleted)
- Company subscriptions will need to be recreated

### For NEW Installations

If you're setting up billing for the first time:

**Run this file:** `supabase-billing-migration.sql`

This is the complete setup script that creates all tables from scratch with the new structure.

## 📋 New Pricing Plans

| Plan | Price | Minutes | Max/Call | Overage | Base Margin | Overage Margin |
|------|-------|---------|----------|---------|-------------|----------------|
| **Starter** | $99/mo | 300 min | 3 min | $0.60/min | 54.5% | 75% |
| **Business** | $279/mo | 1,200 min | 5 min | $0.35/min | 35% | 57% |
| **Teams** | $599/mo | 2,400 min | 8 min | $0.22/min | 40% | 32% |
| **Enterprise** | $1,500/mo | 6,000 min | 15 min | $0.18/min | 40% | 17-20% |

Annual pricing with 10-12% discount:
- Starter: $89/mo
- Business: $249/mo
- Teams: $529/mo
- Enterprise: $1,350/mo

## 🔍 Verification

After running the migration, verify with:

```sql
-- Check new plan structure
SELECT
  name,
  slug,
  price_monthly,
  minutes_included,
  max_call_duration,
  price_per_extra_minute
FROM subscription_plans
ORDER BY display_order;

-- Check if old columns still exist (should still be there for safety)
SELECT column_name, data_type
FROM information_schema.columns
WHERE table_name = 'subscription_plans'
  AND table_schema = 'public';
```

## 🗑️ Cleanup (Optional)

After verifying everything works, you can drop the old columns by uncommenting these lines in the migration script:

```sql
ALTER TABLE subscription_plans DROP COLUMN IF EXISTS calls_included;
ALTER TABLE subscription_plans DROP COLUMN IF EXISTS price_per_extra_call;
ALTER TABLE usage_tracking DROP COLUMN IF EXISTS calls_made;
ALTER TABLE usage_tracking DROP COLUMN IF EXISTS calls_included;
```

## 💡 Cost Basis

All pricing is based on:
- **$0.15/min** all-in cost (Bland AI + OpenAI + infrastructure)
- Every plan maintains healthy margins even at 100% usage
- Overages always have higher margins than base plans

## 🆘 Support

If you encounter any issues during migration:
1. Check the error message
2. Verify your table structure matches expectations
3. Contact support with the error details
