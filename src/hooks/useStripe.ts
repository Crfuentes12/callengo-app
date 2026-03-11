/**
 * Custom hook for Stripe operations in the client
 */

import { useState } from 'react';
import { loadStripe } from '@stripe/stripe-js';
import { billingEvents } from '@/lib/analytics';

// Initialize Stripe
const stripePromise = loadStripe(
  process.env.NEXT_PUBLIC_STRIPE_PUBLISHABLE_KEY!
);

export function useStripe() {
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  /**
   * Create and redirect to Stripe checkout
   */
  const createCheckoutSession = async (params: {
    planId: string;
    billingCycle: 'monthly' | 'annual';
    currency?: 'USD' | 'EUR' | 'GBP';
  }) => {
    try {
      setLoading(true);
      setError(null);

      const response = await fetch('/api/billing/create-checkout-session', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify(params),
      });

      const data = await response.json();

      if (!response.ok) {
        throw new Error(data.error || 'Failed to create checkout session');
      }

      // Redirect to Stripe Checkout URL
      if (data.url) {
        billingEvents.checkoutStarted(params.planId, params.billingCycle, 0);
        window.location.href = data.url;
      } else {
        throw new Error('No checkout URL received from server');
      }
    } catch (err) {
      const errorMessage = err instanceof Error ? err.message : 'Unknown error';
      setError(errorMessage);
      console.error('Checkout error:', err);
      throw err;
    } finally {
      setLoading(false);
    }
  };

  /**
   * Create addon checkout session and redirect
   */
  const createAddonCheckout = async (params: {
    addonType: 'dedicated_number' | 'recording_vault' | 'calls_booster';
    currency?: 'USD' | 'EUR' | 'GBP';
  }) => {
    try {
      setLoading(true);
      setError(null);

      const response = await fetch('/api/billing/addon-checkout', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(params),
      });

      const data = await response.json();

      if (!response.ok) {
        throw new Error(data.error || 'Failed to create addon checkout');
      }

      if (data.url) {
        billingEvents.addonPurchased(params.addonType, 0);
        window.location.href = data.url;
      } else {
        throw new Error('No checkout URL received');
      }
    } catch (err) {
      const errorMessage = err instanceof Error ? err.message : 'Unknown error';
      setError(errorMessage);
      throw err;
    } finally {
      setLoading(false);
    }
  };

  /**
   * Open Stripe billing portal
   */
  const openBillingPortal = async () => {
    try {
      setLoading(true);
      setError(null);

      const response = await fetch('/api/billing/create-portal-session', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
      });

      const data = await response.json();

      if (!response.ok) {
        throw new Error(data.error || 'Failed to create portal session');
      }

      // Redirect to billing portal
      billingEvents.billingPortalOpened();
      window.location.href = data.url;
    } catch (err) {
      const errorMessage = err instanceof Error ? err.message : 'Unknown error';
      setError(errorMessage);
      console.error('Portal error:', err);
      throw err;
    } finally {
      setLoading(false);
    }
  };

  return {
    createCheckoutSession,
    createAddonCheckout,
    openBillingPortal,
    loading,
    error,
  };
}
