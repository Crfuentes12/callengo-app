/**
 * Auto Geolocation Component
 * Silently detects and updates user location in background
 * Mount this component in app layout to run on every page load
 */

'use client';

import { useEffect } from 'react';

export function AutoGeolocation() {
  useEffect(() => {
    let isMounted = true;

    async function updateLocation() {
      try {
        // Call API to update location
        await fetch('/api/user/update-location', {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
          },
        });

        // Silently succeed or fail - no user interaction needed
      } catch (error) {
        // Silently fail - no need to alert user
        console.debug('[AutoGeolocation] Location update skipped');
      }
    }

    // Only run if user is likely authenticated
    // Wait a bit to not block initial render
    const timer = setTimeout(() => {
      if (isMounted) {
        updateLocation();
      }
    }, 1000);

    return () => {
      isMounted = false;
      clearTimeout(timer);
    };
  }, []);

  // This component renders nothing
  return null;
}
