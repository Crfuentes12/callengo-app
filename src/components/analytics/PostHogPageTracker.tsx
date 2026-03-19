// src/components/analytics/PostHogPageTracker.tsx
// Client component that fires PostHog $pageview events for specific app sections.
// Complements the GA4 PageTracker — both can coexist on the same page.

'use client'

import { useEffect, useRef } from 'react'
import {
  phDashboardEvents,
  phAgentEvents,
  phCampaignEvents,
  phCallEvents,
  phContactEvents,
  phIntegrationEvents,
  phCalendarEvents,
  phFollowUpEvents,
  phVoicemailEvents,
  phTeamEvents,
  phSettingsEvents,
  phAnalyticsPageEvents,
  phBillingEvents,
} from '@/lib/posthog'

type TrackedPage =
  | 'dashboard'
  | 'home'
  | 'agents'
  | 'campaigns'
  | 'calls'
  | 'contacts'
  | 'integrations'
  | 'calendar'
  | 'follow-ups'
  | 'voicemails'
  | 'team'
  | 'settings'
  | 'analytics'
  | 'reports'
  | 'pricing'

const pageViewHandlers: Record<TrackedPage, () => void> = {
  home: () => phDashboardEvents.pageViewed(),
  dashboard: phDashboardEvents.pageViewed,
  agents: phAgentEvents.pageViewed,
  campaigns: phCampaignEvents.pageViewed,
  calls: phCallEvents.pageViewed,
  contacts: phContactEvents.pageViewed,
  integrations: phIntegrationEvents.pageViewed,
  calendar: phCalendarEvents.pageViewed,
  'follow-ups': phFollowUpEvents.pageViewed,
  voicemails: phVoicemailEvents.pageViewed,
  team: phTeamEvents.pageViewed,
  settings: phSettingsEvents.pageViewed,
  analytics: phAnalyticsPageEvents.pageViewed,
  reports: phAnalyticsPageEvents.reportsPageViewed,
  pricing: () => phBillingEvents.pricingPageViewed(),
}

export function PostHogPageTracker({ page }: { page: TrackedPage }) {
  const hasFired = useRef(false)

  useEffect(() => {
    if (hasFired.current) return
    hasFired.current = true
    const handler = pageViewHandlers[page]
    if (handler) handler()
  }, [page])

  return null
}
