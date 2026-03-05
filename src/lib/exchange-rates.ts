/**
 * Exchange Rate Service
 * Fetches live exchange rates from exchangerate-api.com with server-side caching.
 * Falls back to hardcoded rates if the API is unavailable.
 */

// Fallback rates (USD-based) used when the API is unreachable
const FALLBACK_RATES: Record<string, number> = {
  USD: 1,
  EUR: 0.92,
  GBP: 0.79,
};

// Cache configuration
const CACHE_TTL_MS = 10 * 60 * 1000; // 10 minutes

interface CachedRates {
  rates: Record<string, number>;
  fetchedAt: number;
}

let ratesCache: CachedRates | null = null;

/**
 * Fetch latest USD-based exchange rates from the API.
 * Returns null on failure so the caller can fall back to hardcoded rates.
 */
async function fetchRatesFromAPI(): Promise<Record<string, number> | null> {
  try {
    const response = await fetch('https://open.er-api.com/v6/latest/USD', {
      signal: AbortSignal.timeout(5000),
      headers: { Accept: 'application/json' },
    });

    if (!response.ok) {
      console.error(`[ExchangeRates] API responded with status ${response.status}`);
      return null;
    }

    const data = await response.json();

    if (data.result !== 'success' || !data.rates) {
      console.error('[ExchangeRates] Unexpected API response:', data.result);
      return null;
    }

    return data.rates as Record<string, number>;
  } catch (error) {
    console.error('[ExchangeRates] Failed to fetch rates:', error);
    return null;
  }
}

/**
 * Get the full set of USD-based rates, using cache when available.
 */
async function getRates(): Promise<Record<string, number>> {
  const now = Date.now();

  // Return cached rates if still valid
  if (ratesCache && now - ratesCache.fetchedAt < CACHE_TTL_MS) {
    return ratesCache.rates;
  }

  const freshRates = await fetchRatesFromAPI();

  if (freshRates) {
    ratesCache = { rates: freshRates, fetchedAt: now };
    return freshRates;
  }

  // If we have stale cached rates, prefer them over hardcoded fallbacks
  if (ratesCache) {
    console.warn('[ExchangeRates] API unavailable, using stale cached rates');
    return ratesCache.rates;
  }

  // Last resort: hardcoded fallback rates
  console.warn('[ExchangeRates] API unavailable and no cache, using fallback rates');
  return FALLBACK_RATES;
}

/**
 * Get the exchange rate to convert from one currency to another.
 *
 * @param from - Source currency code (e.g. "USD")
 * @param to   - Target currency code (e.g. "EUR")
 * @returns The exchange rate (multiply source amount by this to get target amount)
 */
export async function getExchangeRate(from: string, to: string): Promise<number> {
  const fromUpper = from.toUpperCase();
  const toUpper = to.toUpperCase();

  if (fromUpper === toUpper) return 1;

  const rates = await getRates();

  const fromRate = rates[fromUpper];
  const toRate = rates[toUpper];

  if (fromRate == null || toRate == null) {
    console.error(
      `[ExchangeRates] Unknown currency pair: ${fromUpper} -> ${toUpper}. Available: ${Object.keys(rates).slice(0, 10).join(', ')}...`
    );
    // Return 1 as a safe fallback to avoid breaking pricing
    return 1;
  }

  // Convert via USD base: rate = toRate / fromRate
  return toRate / fromRate;
}

/**
 * Convert an amount from one currency to another using live exchange rates.
 *
 * @param amount - The amount in the source currency
 * @param from   - Source currency code (e.g. "USD")
 * @param to     - Target currency code (e.g. "EUR")
 * @returns The converted amount (not rounded — caller should round as needed)
 */
export async function convertAmount(
  amount: number,
  from: string,
  to: string
): Promise<number> {
  const rate = await getExchangeRate(from, to);
  return amount * rate;
}
