// src/components/analytics/PostHogProvider.tsx
// Client component that initializes PostHog, identifies the authenticated user,
// and sets up company-level group analytics.
// Renders nothing — pure side-effect component.

'use client'

import { useEffect, useRef } from 'react'
import { createClient } from '@/lib/supabase/client'
import { initPostHog, identifyUser, resetUser } from '@/lib/posthog'

interface PostHogProviderProps {
  /** Supabase user id (UUID) — used as distinct_id in PostHog (non-PII) */
  userId: string
  /** User full name */
  fullName?: string
  /** Subscription plan slug */
  planSlug?: string
  /** Billing cycle (monthly or annual) */
  billingCycle?: string
  /** Company UUID */
  companyId?: string
  /** Company name (for group analytics display) */
  companyName?: string
  /** Company industry */
  companyIndustry?: string
  /** Number of team members */
  teamSize?: number
  /** ISO country code */
  countryCode?: string
  /** Currency code */
  currency?: string
  /** User creation date (ISO string) */
  createdAt?: string
}

export function PostHogProvider({
  userId,
  fullName,
  planSlug,
  billingCycle,
  companyId,
  companyName,
  companyIndustry,
  teamSize,
  countryCode,
  currency,
  createdAt,
}: PostHogProviderProps) {
  const hasSetup = useRef(false)

  useEffect(() => {
    if (hasSetup.current) return
    hasSetup.current = true

    // Initialize PostHog SDK
    initPostHog()

    // Identify user with UUID as distinct_id + person + company group properties.
    // Email is not passed — it is PII and must not be sent to third-party analytics (GDPR/CCPA).
    identifyUser({
      userId,
      fullName,
      planSlug,
      billingCycle,
      companyId,
      companyName,
      companyIndustry,
      teamSize,
      countryCode,
      currency,
      createdAt,
    })

    // Listen for sign out to reset PostHog identity
    const supabase = createClient()
    const {
      data: { subscription },
    } = supabase.auth.onAuthStateChange((event) => {
      if (event === 'SIGNED_OUT') {
        resetUser()
      }
    })

    return () => subscription.unsubscribe()
  }, [userId, fullName, planSlug, billingCycle, companyId, companyName, companyIndustry, teamSize, countryCode, currency, createdAt])

  return null
}
