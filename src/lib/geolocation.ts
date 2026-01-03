/**
 * Geolocation Service
 * Automatically detects user location and currency based on IP address
 * Runs silently in background without user interaction
 */

export interface GeoLocation {
  ip: string;
  country_code: string;
  country_name: string;
  city: string;
  region: string;
  timezone: string;
  currency: 'USD' | 'EUR' | 'GBP';
  latitude?: number;
  longitude?: number;
}

/**
 * Determine currency based on country code
 * Rules:
 * - UK (GB) → GBP
 * - EU countries → EUR
 * - Rest of world → USD (Americas, Asia, Oceania, Africa)
 */
export function getCurrencyFromCountry(countryCode: string): 'USD' | 'EUR' | 'GBP' {
  const code = countryCode.toUpperCase();

  // UK and dependencies
  if (code === 'GB' || code === 'UK' || code === 'IM' || code === 'JE' || code === 'GG') {
    return 'GBP';
  }

  // European Union countries + some associated territories
  const euroCountries = [
    'AT', // Austria
    'BE', // Belgium
    'CY', // Cyprus
    'EE', // Estonia
    'FI', // Finland
    'FR', // France
    'DE', // Germany
    'GR', // Greece
    'IE', // Ireland
    'IT', // Italy
    'LV', // Latvia
    'LT', // Lithuania
    'LU', // Luxembourg
    'MT', // Malta
    'NL', // Netherlands
    'PT', // Portugal
    'SK', // Slovakia
    'SI', // Slovenia
    'ES', // Spain
    'HR', // Croatia
    'BG', // Bulgaria
    'RO', // Romania
    'CZ', // Czech Republic
    'DK', // Denmark (uses DKK but we map to EUR for simplicity)
    'HU', // Hungary (uses HUF but we map to EUR for simplicity)
    'PL', // Poland (uses PLN but we map to EUR for simplicity)
    'SE', // Sweden (uses SEK but we map to EUR for simplicity)
    'NO', // Norway (uses NOK but we map to EUR for simplicity)
    'CH', // Switzerland (uses CHF but we map to EUR for simplicity)
    'IS', // Iceland
    'LI', // Liechtenstein
    'MC', // Monaco
    'SM', // San Marino
    'VA', // Vatican City
    'AD', // Andorra
  ];

  if (euroCountries.includes(code)) {
    return 'EUR';
  }

  // Default to USD for all other countries
  return 'USD';
}

/**
 * Get user's IP address from request headers
 * Supports various proxy headers (Vercel, Cloudflare, etc.)
 */
export function getClientIP(headers: Headers): string {
  // Try various headers in order of preference
  const ipHeaders = [
    'x-real-ip',
    'x-forwarded-for',
    'cf-connecting-ip', // Cloudflare
    'true-client-ip', // Cloudflare Enterprise
    'x-client-ip',
    'x-cluster-client-ip',
    'x-forwarded',
    'forwarded-for',
    'forwarded',
  ];

  for (const header of ipHeaders) {
    const value = headers.get(header);
    if (value) {
      // x-forwarded-for can contain multiple IPs, take the first one
      const ip = value.split(',')[0].trim();
      if (ip && ip !== '::1' && ip !== '127.0.0.1') {
        return ip;
      }
    }
  }

  // Fallback to localhost for development
  return '127.0.0.1';
}

/**
 * Fetch geolocation data from IP API
 * Uses ip-api.com (free tier: 45 requests/minute)
 */
export async function getGeolocationFromIP(ip: string): Promise<GeoLocation | null> {
  try {
    // Skip for localhost/development
    if (ip === '127.0.0.1' || ip === '::1' || ip.startsWith('192.168.') || ip.startsWith('10.')) {
      return {
        ip,
        country_code: 'US',
        country_name: 'United States',
        city: 'Development',
        region: 'Local',
        timezone: 'America/New_York',
        currency: 'USD',
      };
    }

    // Call IP geolocation API
    const response = await fetch(`http://ip-api.com/json/${ip}?fields=status,message,country,countryCode,region,regionName,city,timezone,lat,lon,query`, {
      headers: {
        'Accept': 'application/json',
      },
      // Short timeout for fast response
      signal: AbortSignal.timeout(3000),
    });

    if (!response.ok) {
      console.error('[Geolocation] API error:', response.status);
      return null;
    }

    const data = await response.json();

    if (data.status !== 'success') {
      console.error('[Geolocation] API returned error:', data.message);
      return null;
    }

    const currency = getCurrencyFromCountry(data.countryCode);

    return {
      ip: data.query || ip,
      country_code: data.countryCode || 'US',
      country_name: data.country || 'United States',
      city: data.city || 'Unknown',
      region: data.regionName || 'Unknown',
      timezone: data.timezone || 'UTC',
      currency,
      latitude: data.lat,
      longitude: data.lon,
    };
  } catch (error) {
    console.error('[Geolocation] Error fetching location:', error);
    // Return default on error
    return {
      ip,
      country_code: 'US',
      country_name: 'United States',
      city: 'Unknown',
      region: 'Unknown',
      timezone: 'UTC',
      currency: 'USD',
    };
  }
}

/**
 * Create a location log entry
 */
export function createLocationLogEntry(location: GeoLocation): {
  timestamp: string;
  ip: string;
  country: string;
  city: string;
  currency: string;
} {
  return {
    timestamp: new Date().toISOString(),
    ip: location.ip,
    country: location.country_code,
    city: location.city,
    currency: location.currency,
  };
}

/**
 * Append new location to location_logs array
 * Keeps only last 50 entries to prevent bloat
 */
export function appendLocationLog(
  existingLogs: any[] | null,
  newEntry: ReturnType<typeof createLocationLogEntry>
): any[] {
  const logs = Array.isArray(existingLogs) ? existingLogs : [];

  // Add new entry at the beginning
  const updated = [newEntry, ...logs];

  // Keep only last 50 entries
  return updated.slice(0, 50);
}
