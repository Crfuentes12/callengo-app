// src/lib/analytics.ts
// Comprehensive GA4 Analytics System for Callengo
// Tracks all user behavior, engagement, and business metrics
// Uses @next/third-parties/google for event dispatch

'use client'

import { sendGAEvent } from '@next/third-parties/google'

// ============================================================
// CORE UTILITY
// ============================================================

const isProduction = () => typeof window !== 'undefined' && process.env.NODE_ENV === 'production'

/**
 * Send a GA4 event. Only fires in production.
 * All events are prefixed with `callengo_` to distinguish from default GA4 events.
 */
function track(eventName: string, params: Record<string, string | number | boolean | null | undefined> = {}) {
  if (!isProduction()) {
    if (typeof window !== 'undefined') {
      console.debug(`[GA4 Debug] ${eventName}`, params)
    }
    return
  }
  // Filter out null/undefined values
  const cleanParams: Record<string, string | number | boolean> = {}
  for (const [key, value] of Object.entries(params)) {
    if (value !== null && value !== undefined) {
      cleanParams[key] = value
    }
  }
  sendGAEvent('event', eventName, cleanParams)
}

// ============================================================
// USER PROPERTIES (set once per session / on change)
// ============================================================

export function setUserProperties(props: {
  user_id: string
  email?: string
  plan_slug?: string
  billing_cycle?: string
  company_industry?: string
  team_size?: number
  country_code?: string
  currency?: string
  integrations_count?: number
  contacts_count?: number
}) {
  if (typeof window === 'undefined' || typeof window.gtag === 'undefined') return
  const gaId = process.env.NEXT_PUBLIC_GA_MEASUREMENT_ID
  if (!gaId) return

  window.gtag('config', gaId, {
    user_id: props.user_id,
    user_properties: {
      email: props.email,
      plan_slug: props.plan_slug,
      billing_cycle: props.billing_cycle,
      company_industry: props.company_industry,
      team_size: props.team_size,
      country_code: props.country_code,
      currency: props.currency,
      integrations_count: props.integrations_count,
      contacts_count: props.contacts_count,
    },
  })
}

export function clearUserProperties() {
  if (typeof window === 'undefined' || typeof window.gtag === 'undefined') return
  const gaId = process.env.NEXT_PUBLIC_GA_MEASUREMENT_ID
  if (!gaId) return
  window.gtag('config', gaId, { user_id: null })
}

// ============================================================
// 1. AUTHENTICATION EVENTS
// ============================================================

export const authEvents = {
  signUp(method: 'email' | 'google' | 'azure' | 'slack') {
    track('sign_up', { method })
  },

  login(method: 'email' | 'google' | 'azure' | 'slack') {
    track('login', { method })
  },

  logout() {
    track('logout', {})
  },

  passwordResetRequested() {
    track('password_reset_requested', {})
  },

  passwordResetCompleted() {
    track('password_reset_completed', {})
  },

  emailVerified() {
    track('email_verified', {})
  },

  verificationEmailResent() {
    track('verification_email_resent', {})
  },

  socialAuthClicked(provider: 'google' | 'azure' | 'slack') {
    track('social_auth_clicked', { provider })
  },
}

// ============================================================
// 2. ONBOARDING EVENTS
// ============================================================

export const onboardingEvents = {
  started() {
    track('onboarding_started', {})
  },

  stepCompleted(stepName: string, stepNumber: number) {
    track('onboarding_step_completed', { step_name: stepName, step_number: stepNumber })
  },

  companyCreated(industry?: string) {
    track('onboarding_company_created', { industry: industry ?? 'unknown' })
  },

  completed(industry?: string) {
    track('onboarding_completed', { industry: industry ?? 'unknown' })
  },

  skipped(atStep: string) {
    track('onboarding_skipped', { at_step: atStep })
  },

  wizardOpened(source: 'auto' | 'banner') {
    track('onboarding_wizard_opened', { source })
  },

  wizardDismissed(atStep: string) {
    track('onboarding_wizard_dismissed', { at_step: atStep })
  },

  companyReviewed() {
    track('onboarding_company_reviewed', {})
  },
}

// ============================================================
// 3. SUBSCRIPTION & BILLING EVENTS
// ============================================================

export const billingEvents = {
  pricingPageViewed(source?: string) {
    track('pricing_page_viewed', { source: source ?? 'direct' })
  },

  planComparisonViewed() {
    track('plan_comparison_viewed', {})
  },

  checkoutStarted(plan: string, billingCycle: string, value: number) {
    track('checkout_started', {
      plan,
      billing_cycle: billingCycle,
      value,
      currency: 'USD',
    })
  },

  subscriptionStarted(plan: string, billingCycle: string, value: number) {
    track('subscription_started', {
      plan,
      billing_cycle: billingCycle,
      value,
      currency: 'USD',
    })
    // Also send as GA4 ecommerce purchase event
    track('purchase', {
      transaction_id: `sub_${Date.now()}`,
      value,
      currency: 'USD',
      items_plan: plan,
      items_billing_cycle: billingCycle,
    })
  },

  subscriptionUpgraded(fromPlan: string, toPlan: string, newValue: number) {
    track('subscription_upgraded', {
      from_plan: fromPlan,
      to_plan: toPlan,
      value: newValue,
      currency: 'USD',
    })
  },

  subscriptionDowngraded(fromPlan: string, toPlan: string) {
    track('subscription_downgraded', {
      from_plan: fromPlan,
      to_plan: toPlan,
    })
  },

  subscriptionCancelled(plan: string, reason?: string, monthsSubscribed?: number) {
    track('subscription_cancelled', {
      plan,
      reason: reason ?? 'unknown',
      months_subscribed: monthsSubscribed ?? 0,
    })
  },

  subscriptionReactivated(plan: string) {
    track('subscription_reactivated', { plan })
  },

  billingPortalOpened() {
    track('billing_portal_opened', {})
  },

  addonPurchased(addonType: 'dedicated_number' | 'recording_vault' | 'calls_booster', value: number) {
    track('addon_purchased', {
      addon_type: addonType,
      value,
      currency: 'USD',
    })
  },

  addonCancelled(addonType: string) {
    track('addon_cancelled', { addon_type: addonType })
  },

  overageEnabled(budgetAmount: number) {
    track('overage_enabled', { budget_amount: budgetAmount })
  },

  overageDisabled() {
    track('overage_disabled', {})
  },

  overageBudgetUpdated(budgetAmount: number) {
    track('overage_budget_updated', { budget_amount: budgetAmount })
  },

  retentionOfferShown(plan: string, monthsSubscribed: number) {
    track('retention_offer_shown', { plan, months_subscribed: monthsSubscribed })
  },

  retentionOfferAccepted(plan: string, discountType: string) {
    track('retention_offer_accepted', { plan, discount_type: discountType })
  },

  retentionOfferDeclined(plan: string) {
    track('retention_offer_declined', { plan })
  },

  upgradeCtaClicked(location: string, currentPlan?: string, targetPlan?: string) {
    track('upgrade_cta_clicked', {
      location,
      current_plan: currentPlan ?? 'unknown',
      target_plan: targetPlan ?? 'unknown',
    })
  },

  extraSeatPurchased(totalSeats: number) {
    track('extra_seat_purchased', { total_seats: totalSeats, value: 49, currency: 'USD' })
  },

  billingCycleToggled(cycle: 'monthly' | 'annual') {
    track('billing_cycle_toggled', { billing_cycle: cycle })
  },

  invoiceViewed() {
    track('invoice_viewed', {})
  },
}

// ============================================================
// 4. AGENT EVENTS
// ============================================================

export const agentEvents = {
  pageViewed() {
    track('agents_page_viewed', {})
  },

  cardClicked(agentType: string) {
    track('agent_card_clicked', { agent_type: agentType })
  },

  configModalOpened(agentType: string) {
    track('agent_config_modal_opened', { agent_type: agentType })
  },

  configStepCompleted(agentType: string, stepName: string, stepNumber: number) {
    track('agent_config_step_completed', {
      agent_type: agentType,
      step_name: stepName,
      step_number: stepNumber,
    })
  },

  configModalClosed(agentType: string, completedSteps: number) {
    track('agent_config_modal_closed', {
      agent_type: agentType,
      completed_steps: completedSteps,
    })
  },

  created(agentType: string, name: string) {
    track('agent_created', { agent_type: agentType, agent_name: name })
  },

  deleted(agentType: string) {
    track('agent_deleted', { agent_type: agentType })
  },

  switched(fromType: string, toType: string) {
    track('agent_switched', { from_type: fromType, to_type: toType })
  },

  voiceSelected(voiceId: string, voiceName: string, gender: string) {
    track('agent_voice_selected', {
      voice_id: voiceId,
      voice_name: voiceName,
      voice_gender: gender,
    })
  },

  voicePreviewed(voiceId: string) {
    track('agent_voice_previewed', { voice_id: voiceId })
  },

  voiceFavorited(voiceId: string) {
    track('agent_voice_favorited', { voice_id: voiceId })
  },

  testCallInitiated(agentType: string) {
    track('test_call_initiated', { agent_type: agentType })
  },

  testCallCompleted(agentType: string, durationSeconds: number, status: string) {
    track('test_call_completed', {
      agent_type: agentType,
      duration_seconds: durationSeconds,
      call_status: status,
    })
  },

  settingsUpdated(agentType: string, settingName: string) {
    track('agent_settings_updated', { agent_type: agentType, setting_name: settingName })
  },

  integrationConnected(agentType: string, integrationProvider: string) {
    track('agent_integration_connected', {
      agent_type: agentType,
      integration_provider: integrationProvider,
    })
  },
}

// ============================================================
// 5. CAMPAIGN / AGENT RUN EVENTS
// ============================================================

export const campaignEvents = {
  pageViewed() {
    track('campaigns_page_viewed', {})
  },

  newCampaignClicked() {
    track('new_campaign_clicked', {})
  },

  aiRecommendationRequested(descriptionLength: number) {
    track('ai_agent_recommendation_requested', { description_length: descriptionLength })
  },

  aiRecommendationSelected(recommendedType: string, selectedType: string) {
    track('ai_agent_recommendation_selected', {
      recommended_type: recommendedType,
      selected_type: selectedType,
      matched: recommendedType === selectedType,
    })
  },

  created(params: {
    agentType: string
    contactCount: number
    followUpEnabled: boolean
    voicemailEnabled: boolean
    calendarEnabled: boolean
  }) {
    track('campaign_created', {
      agent_type: params.agentType,
      contact_count: params.contactCount,
      follow_up_enabled: params.followUpEnabled,
      voicemail_enabled: params.voicemailEnabled,
      calendar_enabled: params.calendarEnabled,
    })
  },

  started(agentType: string, contactCount: number) {
    track('campaign_started', {
      agent_type: agentType,
      contact_count: contactCount,
    })
  },

  paused(agentType: string, callsCompleted: number, totalContacts: number) {
    track('campaign_paused', {
      agent_type: agentType,
      calls_completed: callsCompleted,
      total_contacts: totalContacts,
      progress_percent: totalContacts > 0 ? Math.round((callsCompleted / totalContacts) * 100) : 0,
    })
  },

  resumed(agentType: string) {
    track('campaign_resumed', { agent_type: agentType })
  },

  completed(params: {
    agentType: string
    totalContacts: number
    completedCalls: number
    successfulCalls: number
    failedCalls: number
  }) {
    track('campaign_completed', {
      agent_type: params.agentType,
      total_contacts: params.totalContacts,
      completed_calls: params.completedCalls,
      successful_calls: params.successfulCalls,
      failed_calls: params.failedCalls,
      success_rate: params.completedCalls > 0
        ? Math.round((params.successfulCalls / params.completedCalls) * 100)
        : 0,
    })
  },

  deleted(agentType: string) {
    track('campaign_deleted', { agent_type: agentType })
  },

  detailViewed(agentType: string, status: string) {
    track('campaign_detail_viewed', {
      agent_type: agentType,
      campaign_status: status,
    })
  },

  filtered(filterType: string, filterValue: string) {
    track('campaigns_filtered', { filter_type: filterType, filter_value: filterValue })
  },

  searched(queryLength: number) {
    track('campaigns_searched', { query_length: queryLength })
  },
}

// ============================================================
// 6. CALL EVENTS
// ============================================================

export const callEvents = {
  pageViewed() {
    track('calls_page_viewed', {})
  },

  detailOpened(callStatus: string, agentType?: string) {
    track('call_detail_opened', {
      call_status: callStatus,
      agent_type: agentType ?? 'unknown',
    })
  },

  recordingPlayed(agentType: string, durationSeconds: number) {
    track('call_recording_played', {
      agent_type: agentType,
      duration_seconds: durationSeconds,
    })
  },

  transcriptViewed(agentType: string) {
    track('call_transcript_viewed', { agent_type: agentType })
  },

  analysisViewed(agentType: string, sentiment?: string, interestLevel?: string) {
    track('call_analysis_viewed', {
      agent_type: agentType,
      sentiment: sentiment ?? 'unknown',
      interest_level: interestLevel ?? 'unknown',
    })
  },

  filtered(filterType: string, filterValue: string) {
    track('calls_filtered', { filter_type: filterType, filter_value: filterValue })
  },

  searched(queryLength: number, resultsCount: number) {
    track('calls_searched', { query_length: queryLength, results_count: resultsCount })
  },

  exportRequested(format: string) {
    track('calls_export_requested', { format })
  },
}

// ============================================================
// 7. CONTACT EVENTS
// ============================================================

export const contactEvents = {
  pageViewed() {
    track('contacts_page_viewed', {})
  },

  created(source: string) {
    track('contact_created', { source })
  },

  imported(source: string, count: number, method: string) {
    track('contacts_imported', {
      source,
      count,
      method,
    })
  },

  exported(format: string, count: number) {
    track('contacts_exported', { format, count })
  },

  listCreated() {
    track('contact_list_created', {})
  },

  listDeleted() {
    track('contact_list_deleted', {})
  },

  edited(fieldsChanged: number) {
    track('contact_edited', { fields_changed: fieldsChanged })
  },

  deleted(count: number) {
    track('contacts_deleted', { count })
  },

  bulkDeleted(count: number) {
    track('contacts_bulk_deleted', { count })
  },

  searched(queryLength: number, resultsCount: number) {
    track('contacts_searched', { query_length: queryLength, results_count: resultsCount })
  },

  filtered(filterType: string) {
    track('contacts_filtered', { filter_type: filterType })
  },

  sorted(sortField: string, sortDirection: string) {
    track('contacts_sorted', { sort_field: sortField, sort_direction: sortDirection })
  },

  detailViewed() {
    track('contact_detail_viewed', {})
  },

  aiSegmentationUsed(contactCount: number) {
    track('ai_segmentation_used', { contact_count: contactCount })
  },

  csvImportStarted() {
    track('csv_import_started', {})
  },

  csvImportCompleted(rowCount: number, columnsMatched: number) {
    track('csv_import_completed', {
      row_count: rowCount,
      columns_matched: columnsMatched,
    })
  },

  csvImportFailed(errorType: string) {
    track('csv_import_failed', { error_type: errorType })
  },

  googleSheetsImportStarted() {
    track('google_sheets_import_started', {})
  },

  googleSheetsImportCompleted(rowCount: number) {
    track('google_sheets_import_completed', { row_count: rowCount })
  },

  crmSubpageViewed(provider: string) {
    track('crm_contacts_subpage_viewed', { provider })
  },

  crmContactsImported(provider: string, count: number) {
    track('crm_contacts_imported', { provider, count })
  },
}

// ============================================================
// 8. INTEGRATION EVENTS
// ============================================================

export const integrationEvents = {
  pageViewed() {
    track('integrations_page_viewed', {})
  },

  connectStarted(provider: string, type: string) {
    track('integration_connect_started', { provider, integration_type: type })
  },

  connected(provider: string, type: string) {
    track('integration_connected', { provider, integration_type: type })
  },

  disconnected(provider: string, type: string) {
    track('integration_disconnected', { provider, integration_type: type })
  },

  syncStarted(provider: string) {
    track('integration_sync_started', { provider })
  },

  syncCompleted(provider: string, recordsCreated: number, recordsUpdated: number) {
    track('integration_sync_completed', {
      provider,
      records_created: recordsCreated,
      records_updated: recordsUpdated,
      total_records: recordsCreated + recordsUpdated,
    })
  },

  syncFailed(provider: string, errorType: string) {
    track('integration_sync_failed', { provider, error_type: errorType })
  },

  slackNotificationsConfigured(channelsCount: number) {
    track('slack_notifications_configured', { channels_count: channelsCount })
  },

  webhookCreated() {
    track('webhook_endpoint_created', {})
  },

  webhookDeleted() {
    track('webhook_endpoint_deleted', {})
  },

  feedbackSubmitted(feedbackType: string) {
    track('integration_feedback_submitted', { feedback_type: feedbackType })
  },
}

// ============================================================
// 9. CALENDAR EVENTS
// ============================================================

export const calendarEvents = {
  pageViewed() {
    track('calendar_page_viewed', {})
  },

  viewChanged(view: string) {
    track('calendar_view_changed', { view })
  },

  dateNavigated(direction: string) {
    track('calendar_date_navigated', { direction })
  },

  eventCreated(eventType: string, source: string) {
    track('calendar_event_created', { event_type: eventType, source })
  },

  eventRescheduled(eventType: string) {
    track('calendar_event_rescheduled', { event_type: eventType })
  },

  eventCancelled(eventType: string) {
    track('calendar_event_cancelled', { event_type: eventType })
  },

  eventClicked(eventType: string) {
    track('calendar_event_clicked', { event_type: eventType })
  },

  filterApplied(filterType: string) {
    track('calendar_filter_applied', { filter_type: filterType })
  },

  timezoneChanged(timezone: string) {
    track('calendar_timezone_changed', { timezone })
  },

  workingHoursUpdated(start: string, end: string) {
    track('calendar_working_hours_updated', { start, end })
  },

  syncTriggered(provider: string) {
    track('calendar_sync_triggered', { provider })
  },

  teamMemberAssigned() {
    track('calendar_team_member_assigned', {})
  },
}

// ============================================================
// 10. FOLLOW-UP EVENTS
// ============================================================

export const followUpEvents = {
  pageViewed() {
    track('follow_ups_page_viewed', {})
  },

  filtered(status: string) {
    track('follow_ups_filtered', { status })
  },

  searched(queryLength: number) {
    track('follow_ups_searched', { query_length: queryLength })
  },

  detailViewed(reason: string, attemptNumber: number) {
    track('follow_up_detail_viewed', { reason, attempt_number: attemptNumber })
  },
}

// ============================================================
// 11. VOICEMAIL EVENTS
// ============================================================

export const voicemailEvents = {
  pageViewed() {
    track('voicemails_page_viewed', {})
  },

  played(durationSeconds: number) {
    track('voicemail_played', { duration_seconds: durationSeconds })
  },

  filtered(filterType: string) {
    track('voicemails_filtered', { filter_type: filterType })
  },

  searched(queryLength: number) {
    track('voicemails_searched', { query_length: queryLength })
  },
}

// ============================================================
// 12. TEAM EVENTS
// ============================================================

export const teamEvents = {
  pageViewed() {
    track('team_page_viewed', {})
  },

  memberInvited(role: string, method: string) {
    track('team_member_invited', { role, method })
  },

  memberRemoved() {
    track('team_member_removed', {})
  },

  memberRoleChanged(fromRole: string, toRole: string) {
    track('team_member_role_changed', { from_role: fromRole, to_role: toRole })
  },

  bulkInviteSent(count: number, source: string) {
    track('team_bulk_invite_sent', { count, source })
  },

  inviteResent() {
    track('team_invite_resent', {})
  },

  inviteCancelled() {
    track('team_invite_cancelled', {})
  },
}

// ============================================================
// 13. NAVIGATION & ENGAGEMENT EVENTS
// ============================================================

export const navigationEvents = {
  sidebarClicked(destination: string) {
    track('sidebar_navigation_clicked', { destination })
  },

  notificationClicked(notificationType: string) {
    track('notification_clicked', { notification_type: notificationType })
  },

  notificationDismissed() {
    track('notification_dismissed', {})
  },

  notificationsBellClicked(unreadCount: number) {
    track('notifications_bell_clicked', { unread_count: unreadCount })
  },

  allNotificationsMarkedRead() {
    track('all_notifications_marked_read', {})
  },

  languageChanged(fromLang: string, toLang: string) {
    track('language_changed', { from_lang: fromLang, to_lang: toLang })
  },

  searchPerformed(section: string, queryLength: number) {
    track('search_performed', { section, query_length: queryLength })
  },
}

// ============================================================
// 14. SETTINGS EVENTS
// ============================================================

export const settingsEvents = {
  pageViewed() {
    track('settings_page_viewed', {})
  },

  tabChanged(tabName: string) {
    track('settings_tab_changed', { tab_name: tabName })
  },

  companyProfileUpdated() {
    track('company_profile_updated', {})
  },

  defaultVoiceChanged(voiceId: string) {
    track('default_voice_changed', { voice_id: voiceId })
  },

  testPhoneUpdated() {
    track('test_phone_updated', {})
  },

  notificationPreferencesUpdated(enabled: boolean) {
    track('notification_preferences_updated', { enabled })
  },
}

// ============================================================
// 15. DASHBOARD EVENTS
// ============================================================

export const dashboardEvents = {
  pageViewed() {
    track('dashboard_page_viewed', {})
  },

  quickStartAgentClicked(agentType: string) {
    track('dashboard_quick_start_clicked', { agent_type: agentType })
  },

  recentCallClicked() {
    track('dashboard_recent_call_clicked', {})
  },

  recentCampaignClicked() {
    track('dashboard_recent_campaign_clicked', {})
  },

  usageMeterViewed(usagePercent: number) {
    track('dashboard_usage_meter_viewed', { usage_percent: usagePercent })
  },
}

// ============================================================
// 16. ANALYTICS / REPORTS PAGE EVENTS
// ============================================================

export const analyticsPageEvents = {
  pageViewed() {
    track('analytics_page_viewed', {})
  },

  periodChanged(period: string) {
    track('analytics_period_changed', { period })
  },

  reportExported(format: string) {
    track('report_exported', { format })
  },

  reportsPageViewed() {
    track('reports_page_viewed', {})
  },

  chartInteracted(chartType: string) {
    track('chart_interacted', { chart_type: chartType })
  },
}

// ============================================================
// 17. AI CHAT EVENTS
// ============================================================

export const aiChatEvents = {
  started() {
    track('ai_chat_started', {})
  },

  messageSent(messageLength: number) {
    track('ai_chat_message_sent', { message_length: messageLength })
  },

  conversationCreated() {
    track('ai_chat_conversation_created', {})
  },

  conversationDeleted() {
    track('ai_chat_conversation_deleted', {})
  },
}

// ============================================================
// 18. ERROR & PERFORMANCE EVENTS
// ============================================================

export const errorEvents = {
  apiError(endpoint: string, statusCode: number) {
    track('api_error', { endpoint, status_code: statusCode })
  },

  clientError(errorType: string, component: string) {
    track('client_error', { error_type: errorType, component })
  },

  paymentFailed(plan: string, errorType: string) {
    track('payment_failed', { plan, error_type: errorType })
  },
}

// ============================================================
// 19. FEATURE DISCOVERY & ENGAGEMENT SCORING
// ============================================================

export const engagementEvents = {
  featureDiscovered(featureName: string) {
    track('feature_discovered', { feature_name: featureName })
  },

  tooltipViewed(tooltipId: string) {
    track('tooltip_viewed', { tooltip_id: tooltipId })
  },

  emptyStateViewed(section: string) {
    track('empty_state_viewed', { section })
  },

  emptyStateCtaClicked(section: string, ctaType: string) {
    track('empty_state_cta_clicked', { section, cta_type: ctaType })
  },

  sessionDuration(durationMinutes: number) {
    track('session_duration', { duration_minutes: durationMinutes })
  },
}

// ============================================================
// 20. SERVER-SIDE TRACKING HELPER (for API routes)
// ============================================================

/**
 * Server-side GA4 Measurement Protocol helper.
 * Use this in API routes and webhooks to track server-side events.
 *
 * Requires: NEXT_PUBLIC_GA_MEASUREMENT_ID and GA_API_SECRET env vars
 */
export async function trackServerEvent(
  clientId: string,
  userId: string | null,
  eventName: string,
  params: Record<string, string | number | boolean> = {}
) {
  const measurementId = process.env.NEXT_PUBLIC_GA_MEASUREMENT_ID
  const apiSecret = process.env.GA_API_SECRET
  if (!measurementId || !apiSecret) return

  try {
    await fetch(
      `https://www.google-analytics.com/mp/collect?measurement_id=${measurementId}&api_secret=${apiSecret}`,
      {
        method: 'POST',
        body: JSON.stringify({
          client_id: clientId,
          user_id: userId,
          events: [
            {
              name: eventName,
              params: {
                ...params,
                engagement_time_msec: 1,
              },
            },
          ],
        }),
      }
    )
  } catch {
    // Silently fail — analytics should never break the app
  }
}

// ============================================================
// TYPE AUGMENTATION FOR window.gtag
// ============================================================

declare global {
  interface Window {
    gtag: (...args: unknown[]) => void
  }
}
