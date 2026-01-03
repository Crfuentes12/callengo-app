/**
 * Auto Geolocation Hook
 * Automatically detects and updates user location on app load
 * Runs silently in background without user interaction
 */

import { useEffect, useState } from 'react';

interface UserLocation {
  currency: 'USD' | 'EUR' | 'GBP';
  country: string | null;
  city: string | null;
  ip: string | null;
}

export function useAutoGeolocation() {
  const [location, setLocation] = useState<UserLocation>({
    currency: 'USD',
    country: null,
    city: null,
    ip: null,
  });
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    let isMounted = true;

    async function updateLocation() {
      try {
        // Call API to update location
        const response = await fetch('/api/user/update-location', {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
          },
        });

        if (!response.ok) {
          // Silently fail - use defaults
          if (isMounted) {
            setLocation({
              currency: 'USD',
              country: null,
              city: null,
              ip: null,
            });
            setLoading(false);
          }
          return;
        }

        const data = await response.json();

        if (isMounted && data.success) {
          setLocation({
            currency: data.currency || 'USD',
            country: data.country || null,
            city: data.city || null,
            ip: data.ip || null,
          });
        }
      } catch (error) {
        // Silently fail - use defaults
        console.error('[AutoGeolocation] Error:', error);
        if (isMounted) {
          setLocation({
            currency: 'USD',
            country: null,
            city: null,
            ip: null,
          });
        }
      } finally {
        if (isMounted) {
          setLoading(false);
        }
      }
    }

    updateLocation();

    return () => {
      isMounted = false;
    };
  }, []); // Run once on mount

  return { location, loading };
}

/**
 * Hook to get user's currency (lighter version)
 * Fetches from database instead of updating
 */
export function useUserCurrency() {
  const [currency, setCurrency] = useState<'USD' | 'EUR' | 'GBP'>('USD');
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    let isMounted = true;

    async function fetchCurrency() {
      try {
        const response = await fetch('/api/user/update-location', {
          method: 'GET',
        });

        if (!response.ok) {
          if (isMounted) {
            setCurrency('USD');
            setLoading(false);
          }
          return;
        }

        const data = await response.json();

        if (isMounted) {
          setCurrency(data.currency || 'USD');
        }
      } catch (error) {
        console.error('[UserCurrency] Error:', error);
        if (isMounted) {
          setCurrency('USD');
        }
      } finally {
        if (isMounted) {
          setLoading(false);
        }
      }
    }

    fetchCurrency();

    return () => {
      isMounted = false;
    };
  }, []);

  return { currency, loading };
}
