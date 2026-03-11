// src/components/analytics/PageTracker.tsx
// Client component that fires a page_view event for specific app sections.
// Include this component in any page to track when users visit that section.

'use client'

import { useEffect, useRef } from 'react'
import {
  dashboardEvents,
  agentEvents,
  campaignEvents,
  callEvents,
  contactEvents,
  integrationEvents,
  calendarEvents,
  followUpEvents,
  voicemailEvents,
  teamEvents,
  settingsEvents,
  analyticsPageEvents,
  billingEvents,
} from '@/lib/analytics'

type TrackedPage =
  | 'dashboard'
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
  dashboard: dashboardEvents.pageViewed,
  agents: agentEvents.pageViewed,
  campaigns: campaignEvents.pageViewed,
  calls: callEvents.pageViewed,
  contacts: contactEvents.pageViewed,
  integrations: integrationEvents.pageViewed,
  calendar: calendarEvents.pageViewed,
  'follow-ups': followUpEvents.pageViewed,
  voicemails: voicemailEvents.pageViewed,
  team: teamEvents.pageViewed,
  settings: settingsEvents.pageViewed,
  analytics: analyticsPageEvents.pageViewed,
  reports: analyticsPageEvents.reportsPageViewed,
  pricing: () => billingEvents.pricingPageViewed(),
}

export function PageTracker({ page }: { page: TrackedPage }) {
  const hasFired = useRef(false)

  useEffect(() => {
    if (hasFired.current) return
    hasFired.current = true
    const handler = pageViewHandlers[page]
    if (handler) handler()
  }, [page])

  return null
}
