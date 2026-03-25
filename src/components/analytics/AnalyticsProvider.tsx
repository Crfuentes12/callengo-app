// src/components/analytics/AnalyticsProvider.tsx
// Client component that identifies the authenticated user in GA4
// and sets user properties for audience segmentation.
// Renders nothing — pure side-effect component.

'use client'

import { useEffect, useRef } from 'react'
import { createClient } from '@/lib/supabase/client'
import { setUserProperties, clearUserProperties } from '@/lib/analytics'

interface AnalyticsProviderProps {
  /** Supabase user id (UUID) — used as the GA4 user identifier (non-PII) */
  userId: string
  /** Subscription plan slug (free, starter, growth, business, teams, enterprise) */
  planSlug?: string
  /** Billing cycle (monthly or annual) */
  billingCycle?: string
  /** Company industry */
  companyIndustry?: string
  /** Number of team members */
  teamSize?: number
  /** ISO country code */
  countryCode?: string
  /** Currency code (USD, EUR, GBP) */
  currency?: string
}

export function AnalyticsProvider({
  userId,
  planSlug,
  billingCycle,
  companyIndustry,
  teamSize,
  countryCode,
  currency,
}: AnalyticsProviderProps) {
  const hasSetup = useRef(false)

  useEffect(() => {
    if (hasSetup.current) return
    hasSetup.current = true

    // Set user properties for audience segmentation.
    // Uses UUID as identifier — email must not be sent to GA4 (GDPR/CCPA).
    setUserProperties({
      user_id: userId,
      plan_slug: planSlug,
      billing_cycle: billingCycle,
      company_industry: companyIndustry,
      team_size: teamSize,
      country_code: countryCode,
      currency: currency,
    })

    // Listen for sign out to clear user identity
    const supabase = createClient()
    const {
      data: { subscription },
    } = supabase.auth.onAuthStateChange((event) => {
      if (event === 'SIGNED_OUT') {
        clearUserProperties()
      }
    })

    return () => subscription.unsubscribe()
  }, [userId, planSlug, billingCycle, companyIndustry, teamSize, countryCode, currency])

  return null
}
