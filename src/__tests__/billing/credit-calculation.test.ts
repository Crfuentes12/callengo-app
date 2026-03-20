/**
 * Unit tests for billing credit calculations.
 * These are pure function tests — no DB or API calls needed.
 *
 * Run with: npx tsx src/__tests__/billing/credit-calculation.test.ts
 * Or integrate with vitest/jest when a test framework is added.
 */

import { calculateCreditAmount } from '@/lib/bland/subaccount-manager';
import { getMaxCallDuration } from '@/lib/billing/call-throttle';
import { minutesToEstimatedCalls, callsToEstimatedMinutes } from '@/config/plan-features';

// Simple test runner
let passed = 0;
let failed = 0;

function test(name: string, fn: () => void) {
  try {
    fn();
    passed++;
    console.log(`  ✅ ${name}`);
  } catch (e) {
    failed++;
    console.error(`  ❌ ${name}: ${(e as Error).message}`);
  }
}

function assertEqual(actual: unknown, expected: unknown) {
  if (actual !== expected) {
    throw new Error(`Expected ${expected}, got ${actual}`);
  }
}

function assertGreaterThan(actual: number, expected: number) {
  if (actual <= expected) {
    throw new Error(`Expected ${actual} > ${expected}`);
  }
}

function assertLessThan(actual: number, expected: number) {
  if (actual >= expected) {
    throw new Error(`Expected ${actual} < ${expected}`);
  }
}

// ============================================================================
// Credit Calculation Tests
// ============================================================================

console.log('\n📊 Credit Calculation Tests');

test('Starter plan (300 min) credit allocation', () => {
  const credits = calculateCreditAmount(300);
  // 300 * $0.11 * 1.05 = $34.65 → ceil to $34.65
  assertGreaterThan(credits, 33); // At least base cost
  assertLessThan(credits, 40);    // Not too much more
});

test('Growth plan (600 min) credit allocation', () => {
  const credits = calculateCreditAmount(600);
  // 600 * $0.11 * 1.05 = $69.30
  assertGreaterThan(credits, 66);
  assertLessThan(credits, 75);
});

test('Business plan (1200 min) credit allocation', () => {
  const credits = calculateCreditAmount(1200);
  // 1200 * $0.11 * 1.05 = $138.60
  assertGreaterThan(credits, 132);
  assertLessThan(credits, 145);
});

test('Teams plan (2250 min) credit allocation', () => {
  const credits = calculateCreditAmount(2250);
  // 2250 * $0.11 * 1.05 = $259.875
  assertGreaterThan(credits, 247);
  assertLessThan(credits, 270);
});

test('Enterprise plan (6000 min) credit allocation', () => {
  const credits = calculateCreditAmount(6000);
  // 6000 * $0.11 * 1.05 = $693
  assertGreaterThan(credits, 660);
  assertLessThan(credits, 710);
});

test('Free plan (15 min) credit allocation', () => {
  const credits = calculateCreditAmount(15);
  // 15 * $0.11 * 1.05 = $1.7325
  assertGreaterThan(credits, 1.5);
  assertLessThan(credits, 2.5);
});

test('Zero minutes returns zero credits', () => {
  assertEqual(calculateCreditAmount(0), 0);
});

test('Calls Booster (225 min) credit allocation', () => {
  const credits = calculateCreditAmount(225);
  // 225 * $0.11 * 1.05 = $25.99
  assertGreaterThan(credits, 24);
  assertLessThan(credits, 30);
});

// ============================================================================
// Max Call Duration Tests
// ============================================================================

console.log('\n⏱️  Max Call Duration Tests');

test('Free plan max duration = 3 min', () => {
  assertEqual(getMaxCallDuration('free'), 3);
});

test('Starter plan max duration = 3 min', () => {
  assertEqual(getMaxCallDuration('starter'), 3);
});

test('Growth plan max duration = 4 min', () => {
  assertEqual(getMaxCallDuration('growth'), 4);
});

test('Business plan max duration = 5 min', () => {
  assertEqual(getMaxCallDuration('business'), 5);
});

test('Teams plan max duration = 6 min', () => {
  assertEqual(getMaxCallDuration('teams'), 6);
});

test('Enterprise plan max duration = 600 min (unlimited)', () => {
  assertEqual(getMaxCallDuration('enterprise'), 600);
});

test('Unknown plan falls back to free (3 min)', () => {
  assertEqual(getMaxCallDuration('nonexistent'), 3);
});

// ============================================================================
// Minutes/Calls Conversion Tests
// ============================================================================

console.log('\n🔄 Minutes/Calls Conversion Tests');

test('300 minutes = ~200 calls', () => {
  assertEqual(minutesToEstimatedCalls(300), 200);
});

test('600 minutes = ~400 calls', () => {
  assertEqual(minutesToEstimatedCalls(600), 400);
});

test('1200 minutes = ~800 calls', () => {
  assertEqual(minutesToEstimatedCalls(1200), 800);
});

test('200 calls = ~300 minutes', () => {
  assertEqual(callsToEstimatedMinutes(200), 300);
});

test('225 minutes (booster) = ~150 calls', () => {
  assertEqual(minutesToEstimatedCalls(225), 150);
});

// ============================================================================
// Unit Economics Sanity Tests
// ============================================================================

console.log('\n💰 Unit Economics Sanity Tests');

const BLAND_COST = 0.11; // Scale plan

test('All overage rates are above Bland cost ($0.11/min)', () => {
  const overageRates: Record<string, number> = {
    starter: 0.29,
    growth: 0.26,
    business: 0.23,
    teams: 0.20,
    enterprise: 0.17,
  };
  for (const [plan, rate] of Object.entries(overageRates)) {
    if (rate <= BLAND_COST) {
      throw new Error(`${plan} overage rate $${rate} is below Bland cost $${BLAND_COST}`);
    }
  }
});

test('Overage ladder is monotonically decreasing', () => {
  const rates = [0.29, 0.26, 0.23, 0.20, 0.17];
  for (let i = 1; i < rates.length; i++) {
    if (rates[i] >= rates[i - 1]) {
      throw new Error(`Rate ${rates[i]} is not less than ${rates[i - 1]}`);
    }
  }
});

test('All plan gross margins are positive (Scale plan)', () => {
  const plans = [
    { name: 'Starter', revenue: 99, minutes: 300 },
    { name: 'Growth', revenue: 179, minutes: 600 },
    { name: 'Business', revenue: 299, minutes: 1200 },
    { name: 'Teams', revenue: 649, minutes: 2250 },
    { name: 'Enterprise', revenue: 1499, minutes: 6000 },
  ];
  for (const plan of plans) {
    const cost = plan.minutes * BLAND_COST;
    const margin = (plan.revenue - cost) / plan.revenue;
    if (margin <= 0) {
      throw new Error(`${plan.name} has negative margin: ${(margin * 100).toFixed(1)}%`);
    }
    if (margin < 0.3) {
      throw new Error(`${plan.name} margin too low: ${(margin * 100).toFixed(1)}% (min 30%)`);
    }
  }
});

test('Annual pricing has 12% discount (2 months free)', () => {
  const plans = [
    { name: 'Starter', monthly: 99, annual: 1044 },
    { name: 'Growth', monthly: 179, annual: 1908 },
    { name: 'Business', monthly: 299, annual: 3228 },
    { name: 'Teams', monthly: 649, annual: 6948 },
    { name: 'Enterprise', monthly: 1499, annual: 16188 },
  ];
  for (const plan of plans) {
    const expectedAnnual = plan.monthly * 12 * 0.88; // 12% discount
    // Allow small rounding difference
    const diff = Math.abs(plan.annual - expectedAnnual);
    if (diff > 5) {
      throw new Error(`${plan.name} annual $${plan.annual} != expected $${expectedAnnual.toFixed(0)} (12% discount)`);
    }
  }
});

// ============================================================================
// Summary
// ============================================================================

console.log(`\n${'='.repeat(50)}`);
console.log(`Results: ${passed} passed, ${failed} failed`);
console.log(`${'='.repeat(50)}\n`);

if (failed > 0) process.exit(1);
