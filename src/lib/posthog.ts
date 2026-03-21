// src/lib/posthog.ts
// Comprehensive PostHog Analytics System for Callengo
// Complements GA4: GA4 handles marketing attribution, PostHog handles product behavior
// Features: event tracking, user identification, group analytics (company-level),
// feature flags, session replay tagging, super properties

'use client'

import posthog from 'posthog-js'

// ============================================================
// INITIALIZATION
// ============================================================

let initialized = false

/**
 * Initialize PostHog client-side SDK.
 * Called once in PostHogProvider. Safe to call multiple times.
 */
export function initPostHog() {
  if (initialized) return
  if (typeof window === 'undefined') return

  const key = process.env.NEXT_PUBLIC_POSTHOG_KEY
  const host = process.env.NEXT_PUBLIC_POSTHOG_HOST || 'https://us.i.posthog.com'

  if (!key) {
    if (process.env.NODE_ENV === 'development') {
      console.debug('[PostHog] No NEXT_PUBLIC_POSTHOG_KEY set — running in debug mode')
    }
    return
  }

  posthog.init(key, {
    api_host: host,
    // Capture pageviews manually via PageTracker component
    capture_pageview: false,
    // Capture pageleave for session duration analysis
    capture_pageleave: true,
    // Session recording config
    session_recording: {
      // Mask all text inputs by default for privacy
      maskTextSelector: 'input[type="password"], input[type="email"], input[name="phone"]',
    },
    // Autocapture clicks, form submissions, page views
    autocapture: true,
    // Respect Do Not Track browser setting
    respect_dnt: true,
    // Store in localStorage for persistence across sessions
    persistence: 'localStorage+cookie',
    // Disable in development unless explicitly enabled
    loaded: (ph) => {
      if (process.env.NODE_ENV === 'development') {
        // Keep debug mode on for development
        ph.debug()
      }
    },
  })

  initialized = true
}

/**
 * Get the PostHog instance. Returns null if not initialized.
 */
export function getPostHog() {
  if (!initialized || typeof window === 'undefined') return null
  return posthog
}

// ============================================================
// CORE TRACKING UTILITY
// ============================================================

/**
 * Capture a PostHog event. Handles both production and debug modes.
 * Unlike GA4, PostHog captures in all environments when initialized.
 * Events are debounced/batched by the SDK automatically.
 */
function capture(
  eventName: string,
  properties: Record<string, string | number | boolean | null | undefined> = {}
) {
  // Clean null/undefined values
  const clean: Record<string, string | number | boolean> = {}
  for (const [key, value] of Object.entries(properties)) {
    if (value !== null && value !== undefined) {
      clean[key] = value
    }
  }

  if (!initialized || typeof window === 'undefined') {
    if (typeof window !== 'undefined') {
      console.debug(`[PostHog Debug] ${eventName}`, clean)
    }
    return
  }

  posthog.capture(eventName, clean)
}

// ============================================================
// USER IDENTIFICATION & GROUP ANALYTICS
// ============================================================

/**
 * Identify a user in PostHog. Associates all future events with this user.
 * Also sets the company as a "group" for company-level analytics.
 *
 * PostHog groups allow you to analyze behavior at the company level:
 * - How many agents does company X create per month?
 * - What's the average call duration for enterprise companies?
 * - Which features do high-retention companies use?
 */
export function identifyUser(props: {
  userId: string
  email?: string
  fullName?: string
  planSlug?: string
  billingCycle?: string
  companyId?: string
  companyName?: string
  companyIndustry?: string
  teamSize?: number
  countryCode?: string
  currency?: string
  integrationsCount?: number
  contactsCount?: number
  createdAt?: string
}) {
  if (!initialized || typeof window === 'undefined') {
    if (typeof window !== 'undefined') {
      console.debug('[PostHog Debug] identify', props.email || props.userId, props)
    }
    return
  }

  // Use email as distinct_id so PostHog shows emails in session replay,
  // funnels, and person lists instead of opaque UUIDs.
  // Fall back to userId if email is not available (shouldn't happen in practice).
  const distinctId = props.email || props.userId

  posthog.identify(distinctId, {
    email: props.email,
    name: props.fullName,
    user_id: props.userId,
    plan_slug: props.planSlug,
    billing_cycle: props.billingCycle,
    company_id: props.companyId,
    company_industry: props.companyIndustry,
    team_size: props.teamSize,
    country_code: props.countryCode,
    currency: props.currency,
    integrations_count: props.integrationsCount,
    contacts_count: props.contactsCount,
    created_at: props.createdAt,
  })

  // Set company as a PostHog group for company-level analytics
  if (props.companyId) {
    posthog.group('company', props.companyId, {
      name: props.companyName,
      industry: props.companyIndustry,
      plan: props.planSlug,
      billing_cycle: props.billingCycle,
      team_size: props.teamSize,
      country: props.countryCode,
      currency: props.currency,
      integrations_count: props.integrationsCount,
      contacts_count: props.contactsCount,
    })
  }
}

/**
 * Update user properties without re-identifying.
 * Use when properties change during the session (e.g., plan upgrade).
 */
export function updateUserProperties(props: Record<string, string | number | boolean | undefined>) {
  if (!initialized || typeof window === 'undefined') return
  const clean: Record<string, string | number | boolean> = {}
  for (const [key, value] of Object.entries(props)) {
    if (value !== undefined) clean[key] = value
  }
  posthog.people.set(clean)
}

/**
 * Increment a numeric person property.
 * Useful for: total_campaigns_created, total_calls_made, total_contacts_imported
 *
 * Uses capture with $set to track the "first time" timestamp,
 * and a dedicated event so PostHog can compute running totals via formulas.
 */
export function incrementUserProperty(property: string, value: number = 1) {
  if (!initialized || typeof window === 'undefined') return
  posthog.people.set_once({ [`first_${property}_at`]: new Date().toISOString() })
  posthog.capture('user_property_incremented', {
    property,
    increment_value: value,
  })
}

/**
 * Reset user identity on logout. Generates a new anonymous ID.
 */
export function resetUser() {
  if (!initialized || typeof window === 'undefined') return
  posthog.reset()
}

// ============================================================
// FEATURE FLAGS
// ============================================================

/**
 * Check if a feature flag is enabled for the current user.
 * Feature flags are evaluated based on user/company properties.
 */
export function isFeatureEnabled(flagKey: string): boolean {
  if (!initialized || typeof window === 'undefined') return false
  return posthog.isFeatureEnabled(flagKey) ?? false
}

/**
 * Get a feature flag's payload (multivariate flags).
 */
export function getFeatureFlagPayload(flagKey: string): unknown {
  if (!initialized || typeof window === 'undefined') return null
  return posthog.getFeatureFlagPayload(flagKey)
}

/**
 * Reload feature flags from PostHog (e.g., after a plan change).
 */
export function reloadFeatureFlags() {
  if (!initialized || typeof window === 'undefined') return
  posthog.reloadFeatureFlags()
}

// ============================================================
// SESSION REPLAY HELPERS
// ============================================================

/**
 * Tag a session replay with a custom label for easy filtering.
 * Example: tagSession('bug_report_123') or tagSession('churned_user')
 */
export function tagSession(tag: string) {
  if (!initialized || typeof window === 'undefined') return
  posthog.capture('$session_tag', { tag })
}

// ============================================================
// 1. AUTHENTICATION EVENTS
// ============================================================

export const phAuthEvents = {
  signUp(method: 'email' | 'google' | 'azure' | 'slack') {
    capture('user_signed_up', { method })
    incrementUserProperty('total_signups')
  },

  login(method: 'email' | 'google' | 'azure' | 'slack') {
    capture('user_logged_in', { method })
  },

  logout() {
    capture('user_logged_out')
    resetUser()
  },

  passwordResetRequested() {
    capture('password_reset_requested')
  },

  passwordResetCompleted() {
    capture('password_reset_completed')
  },

  emailVerified() {
    capture('email_verified')
  },

  verificationEmailResent() {
    capture('verification_email_resent')
  },

  socialAuthClicked(provider: 'google' | 'azure' | 'slack') {
    capture('social_auth_clicked', { provider })
  },
}

// ============================================================
// 2. ONBOARDING EVENTS
// ============================================================

export const phOnboardingEvents = {
  started() {
    capture('onboarding_started')
  },

  stepCompleted(stepName: string, stepNumber: number) {
    capture('onboarding_step_completed', {
      step_name: stepName,
      step_number: stepNumber,
    })
  },

  companyCreated(industry?: string) {
    capture('onboarding_company_created', { industry: industry ?? 'unknown' })
  },

  completed(industry?: string) {
    capture('onboarding_completed', { industry: industry ?? 'unknown' })
    // Set as a user property so we know they completed onboarding
    updateUserProperties({ onboarding_completed: true })
  },

  skipped(atStep: string) {
    capture('onboarding_skipped', { at_step: atStep })
  },

  wizardOpened(source: 'auto' | 'banner') {
    capture('onboarding_wizard_opened', { source })
  },

  wizardDismissed(atStep: string) {
    capture('onboarding_wizard_dismissed', { at_step: atStep })
  },

  companyReviewed() {
    capture('onboarding_company_reviewed')
  },

  painPointSelected(painPoint: string) {
    capture('onboarding_pain_point_selected', { pain_point: painPoint })
  },

  agentTestStarted(agentType: string) {
    capture('onboarding_agent_test_started', { agent_type: agentType })
    phFlowEvents.startFlow('onboarding_agent_test')
  },

  agentTestCompleted(agentType: string, durationSeconds: number) {
    capture('onboarding_agent_test_completed', {
      agent_type: agentType,
      duration_seconds: durationSeconds,
    })
    phFlowEvents.completeFlow('onboarding_agent_test')
  },

  agentTestSkipped(agentType: string) {
    capture('onboarding_agent_test_skipped', { agent_type: agentType })
  },
}

// ============================================================
// 3. SUBSCRIPTION & BILLING EVENTS
// ============================================================

export const phBillingEvents = {
  pricingPageViewed(source?: string) {
    capture('pricing_page_viewed', { source: source ?? 'direct' })
  },

  planComparisonViewed() {
    capture('plan_comparison_viewed')
  },

  checkoutStarted(plan: string, billingCycle: string, value: number) {
    capture('checkout_started', {
      plan,
      billing_cycle: billingCycle,
      value,
      currency: 'USD',
    })
  },

  subscriptionStarted(plan: string, billingCycle: string, value: number) {
    capture('subscription_started', {
      plan,
      billing_cycle: billingCycle,
      value,
      currency: 'USD',
    })
    // Update user properties to reflect new plan
    updateUserProperties({
      plan_slug: plan,
      billing_cycle: billingCycle,
    })
    // Reload feature flags since plan changed
    reloadFeatureFlags()
  },

  subscriptionUpgraded(fromPlan: string, toPlan: string, newValue: number) {
    capture('subscription_upgraded', {
      from_plan: fromPlan,
      to_plan: toPlan,
      value: newValue,
      currency: 'USD',
    })
    updateUserProperties({ plan_slug: toPlan })
    reloadFeatureFlags()
  },

  subscriptionDowngraded(fromPlan: string, toPlan: string) {
    capture('subscription_downgraded', {
      from_plan: fromPlan,
      to_plan: toPlan,
    })
    updateUserProperties({ plan_slug: toPlan })
    reloadFeatureFlags()
  },

  subscriptionCancelled(plan: string, reason?: string, monthsSubscribed?: number) {
    capture('subscription_cancelled', {
      plan,
      reason: reason ?? 'unknown',
      months_subscribed: monthsSubscribed ?? 0,
    })
    // Tag session for replay review of churned users
    tagSession('churned_user')
  },

  subscriptionReactivated(plan: string) {
    capture('subscription_reactivated', { plan })
    updateUserProperties({ plan_slug: plan })
  },

  billingPortalOpened() {
    capture('billing_portal_opened')
  },

  addonPurchased(addonType: 'dedicated_number' | 'recording_vault' | 'calls_booster', value: number) {
    capture('addon_purchased', {
      addon_type: addonType,
      value,
      currency: 'USD',
    })
  },

  addonCancelled(addonType: string) {
    capture('addon_cancelled', { addon_type: addonType })
  },

  overageEnabled(budgetAmount: number) {
    capture('overage_enabled', { budget_amount: budgetAmount })
  },

  overageDisabled() {
    capture('overage_disabled')
  },

  overageBudgetUpdated(budgetAmount: number) {
    capture('overage_budget_updated', { budget_amount: budgetAmount })
  },

  retentionOfferShown(plan: string, monthsSubscribed: number) {
    capture('retention_offer_shown', { plan, months_subscribed: monthsSubscribed })
    tagSession('retention_flow')
  },

  retentionOfferAccepted(plan: string, discountType: string) {
    capture('retention_offer_accepted', { plan, discount_type: discountType })
  },

  retentionOfferDeclined(plan: string) {
    capture('retention_offer_declined', { plan })
  },

  upgradeCtaClicked(location: string, currentPlan?: string, targetPlan?: string) {
    capture('upgrade_cta_clicked', {
      location,
      current_plan: currentPlan ?? 'unknown',
      target_plan: targetPlan ?? 'unknown',
    })
  },

  extraSeatPurchased(totalSeats: number) {
    capture('extra_seat_purchased', { total_seats: totalSeats, value: 49, currency: 'USD' })
  },

  billingCycleToggled(cycle: 'monthly' | 'annual') {
    capture('billing_cycle_toggled', { billing_cycle: cycle })
  },

  invoiceViewed() {
    capture('invoice_viewed')
  },

  planComparisonTimeSpent(durationSeconds: number) {
    capture('plan_comparison_time_spent', { duration_seconds: durationSeconds })
  },

  featureDetailsViewed(featureName: string, planName: string) {
    capture('feature_details_viewed', { feature_name: featureName, plan_name: planName })
  },

  checkoutAbandoned(plan: string, atStep: string, durationSeconds: number) {
    capture('checkout_abandoned', { plan, at_step: atStep, duration_seconds: durationSeconds })
    tagSession('checkout_abandoned')
  },

  cancellationReasonSubmitted(reason: string, feedback?: string) {
    capture('cancellation_reason_submitted', { reason, feedback })
  },
}

// ============================================================
// 4. AGENT EVENTS
// ============================================================

export const phAgentEvents = {
  pageViewed() {
    capture('$pageview', { page: 'agents' })
  },

  cardClicked(agentType: string) {
    capture('agent_card_clicked', { agent_type: agentType })
  },

  configModalOpened(agentType: string) {
    capture('agent_config_modal_opened', { agent_type: agentType })
  },

  configStepCompleted(agentType: string, stepName: string, stepNumber: number) {
    capture('agent_config_step_completed', {
      agent_type: agentType,
      step_name: stepName,
      step_number: stepNumber,
    })
  },

  configModalClosed(agentType: string, completedSteps: number) {
    capture('agent_config_modal_closed', {
      agent_type: agentType,
      completed_steps: completedSteps,
    })
  },

  created(agentType: string, name: string) {
    capture('agent_created', { agent_type: agentType, agent_name: name })
    incrementUserProperty('total_agents_created')
  },

  deleted(agentType: string) {
    capture('agent_deleted', { agent_type: agentType })
  },

  switched(fromType: string, toType: string) {
    capture('agent_switched', { from_type: fromType, to_type: toType })
  },

  voiceSelected(voiceId: string, voiceName: string, gender: string) {
    capture('agent_voice_selected', {
      voice_id: voiceId,
      voice_name: voiceName,
      voice_gender: gender,
    })
  },

  voicePreviewed(voiceId: string) {
    capture('agent_voice_previewed', { voice_id: voiceId })
  },

  voiceFavorited(voiceId: string) {
    capture('agent_voice_favorited', { voice_id: voiceId })
  },

  testCallInitiated(agentType: string) {
    capture('test_call_initiated', { agent_type: agentType })
  },

  testCallCompleted(agentType: string, durationSeconds: number, status: string) {
    capture('test_call_completed', {
      agent_type: agentType,
      duration_seconds: durationSeconds,
      call_status: status,
    })
  },

  settingsUpdated(agentType: string, settingName: string) {
    capture('agent_settings_updated', { agent_type: agentType, setting_name: settingName })
  },

  integrationConnected(agentType: string, integrationProvider: string) {
    capture('agent_integration_connected', {
      agent_type: agentType,
      integration_provider: integrationProvider,
    })
  },

  /** User started configuring an agent (timer for how long config takes) */
  configFlowStarted(agentType: string) {
    phFlowEvents.startFlow('agent_config', agentType)
  },

  /** User completed agent config flow */
  configFlowCompleted(agentType: string, stepsCompleted: number) {
    phFlowEvents.completeFlow('agent_config', agentType, { steps_completed: stepsCompleted })
  },

  /** User abandoned agent config without saving */
  configFlowAbandoned(agentType: string, atStep: string) {
    phFlowEvents.abandonFlow('agent_config', agentType, atStep)
  },

  /** User listened to multiple voices in a comparison session */
  voiceComparisonSession(voicesListened: number, durationSeconds: number) {
    capture('voice_comparison_session', {
      voices_listened: voicesListened,
      duration_seconds: durationSeconds,
    })
  },
}

// ============================================================
// 5. CAMPAIGN / AGENT RUN EVENTS
// ============================================================

export const phCampaignEvents = {
  pageViewed() {
    capture('$pageview', { page: 'campaigns' })
  },

  newCampaignClicked() {
    capture('new_campaign_clicked')
  },

  aiRecommendationRequested(descriptionLength: number) {
    capture('ai_agent_recommendation_requested', { description_length: descriptionLength })
  },

  aiRecommendationSelected(recommendedType: string, selectedType: string) {
    capture('ai_agent_recommendation_selected', {
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
    capture('campaign_created', {
      agent_type: params.agentType,
      contact_count: params.contactCount,
      follow_up_enabled: params.followUpEnabled,
      voicemail_enabled: params.voicemailEnabled,
      calendar_enabled: params.calendarEnabled,
    })
    incrementUserProperty('total_campaigns_created')
  },

  started(agentType: string, contactCount: number) {
    capture('campaign_started', {
      agent_type: agentType,
      contact_count: contactCount,
    })
  },

  paused(agentType: string, callsCompleted: number, totalContacts: number) {
    capture('campaign_paused', {
      agent_type: agentType,
      calls_completed: callsCompleted,
      total_contacts: totalContacts,
      progress_percent: totalContacts > 0 ? Math.round((callsCompleted / totalContacts) * 100) : 0,
    })
  },

  resumed(agentType: string) {
    capture('campaign_resumed', { agent_type: agentType })
  },

  completed(params: {
    agentType: string
    totalContacts: number
    completedCalls: number
    successfulCalls: number
    failedCalls: number
  }) {
    capture('campaign_completed', {
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
    capture('campaign_deleted', { agent_type: agentType })
  },

  detailViewed(agentType: string, status: string) {
    capture('campaign_detail_viewed', {
      agent_type: agentType,
      campaign_status: status,
    })
  },

  filtered(filterType: string, filterValue: string) {
    capture('campaigns_filtered', { filter_type: filterType, filter_value: filterValue })
  },

  searched(queryLength: number) {
    capture('campaigns_searched', { query_length: queryLength })
  },

  /** Track campaign creation flow timing */
  creationFlowStarted() {
    phFlowEvents.startFlow('campaign_creation')
  },

  creationFlowCompleted(contactCount: number, agentType: string) {
    phFlowEvents.completeFlow('campaign_creation', undefined, {
      contact_count: contactCount,
      agent_type: agentType,
    })
  },

  creationFlowAbandoned(atStep: string) {
    phFlowEvents.abandonFlow('campaign_creation', undefined, atStep)
  },

  /** User viewed the estimated cost before launching */
  estimatedCostViewed(estimatedMinutes: number, estimatedCost: number) {
    capture('campaign_estimated_cost_viewed', {
      estimated_minutes: estimatedMinutes,
      estimated_cost: estimatedCost,
    })
  },

  /** Campaign settings changed after creation */
  settingsChangedPostCreation(settingName: string) {
    capture('campaign_settings_changed_post_creation', { setting_name: settingName })
  },
}

// ============================================================
// 6. CALL EVENTS
// ============================================================

export const phCallEvents = {
  pageViewed() {
    capture('$pageview', { page: 'calls' })
  },

  detailOpened(callStatus: string, agentType?: string) {
    capture('call_detail_opened', {
      call_status: callStatus,
      agent_type: agentType ?? 'unknown',
    })
  },

  recordingPlayed(agentType: string, durationSeconds: number) {
    capture('call_recording_played', {
      agent_type: agentType,
      duration_seconds: durationSeconds,
    })
  },

  transcriptViewed(agentType: string) {
    capture('call_transcript_viewed', { agent_type: agentType })
  },

  analysisViewed(agentType: string, sentiment?: string, interestLevel?: string) {
    capture('call_analysis_viewed', {
      agent_type: agentType,
      sentiment: sentiment ?? 'unknown',
      interest_level: interestLevel ?? 'unknown',
    })
  },

  filtered(filterType: string, filterValue: string) {
    capture('calls_filtered', { filter_type: filterType, filter_value: filterValue })
  },

  searched(queryLength: number, resultsCount: number) {
    capture('calls_searched', { query_length: queryLength, results_count: resultsCount })
  },

  exportRequested(format: string) {
    capture('calls_export_requested', { format })
  },
}

// ============================================================
// 7. CONTACT EVENTS
// ============================================================

export const phContactEvents = {
  pageViewed() {
    capture('$pageview', { page: 'contacts' })
  },

  created(source: string) {
    capture('contact_created', { source })
    incrementUserProperty('total_contacts_created')
  },

  imported(source: string, count: number, method: string) {
    capture('contacts_imported', { source, count, method })
    incrementUserProperty('total_contacts_imported', count)
  },

  exported(format: string, count: number) {
    capture('contacts_exported', { format, count })
  },

  listCreated() {
    capture('contact_list_created')
  },

  listDeleted() {
    capture('contact_list_deleted')
  },

  edited(fieldsChanged: number) {
    capture('contact_edited', { fields_changed: fieldsChanged })
  },

  deleted(count: number) {
    capture('contacts_deleted', { count })
  },

  bulkDeleted(count: number) {
    capture('contacts_bulk_deleted', { count })
  },

  searched(queryLength: number, resultsCount: number) {
    capture('contacts_searched', { query_length: queryLength, results_count: resultsCount })
  },

  filtered(filterType: string) {
    capture('contacts_filtered', { filter_type: filterType })
  },

  sorted(sortField: string, sortDirection: string) {
    capture('contacts_sorted', { sort_field: sortField, sort_direction: sortDirection })
  },

  detailViewed() {
    capture('contact_detail_viewed')
  },

  aiSegmentationUsed(contactCount: number) {
    capture('ai_segmentation_used', { contact_count: contactCount })
  },

  csvImportStarted() {
    capture('csv_import_started')
  },

  csvImportCompleted(rowCount: number, columnsMatched: number) {
    capture('csv_import_completed', { row_count: rowCount, columns_matched: columnsMatched })
  },

  csvImportFailed(errorType: string) {
    capture('csv_import_failed', { error_type: errorType })
    tagSession('import_error')
  },

  googleSheetsImportStarted() {
    capture('google_sheets_import_started')
  },

  googleSheetsImportCompleted(rowCount: number) {
    capture('google_sheets_import_completed', { row_count: rowCount })
  },

  crmSubpageViewed(provider: string) {
    capture('crm_contacts_subpage_viewed', { provider })
  },

  crmContactsImported(provider: string, count: number) {
    capture('crm_contacts_imported', { provider, count })
  },

  /** Track CSV import flow timing */
  csvImportFlowStarted() {
    phFlowEvents.startFlow('csv_import')
  },

  csvImportFlowCompleted(rowCount: number, durationSeconds: number) {
    phFlowEvents.completeFlow('csv_import', undefined, {
      row_count: rowCount,
      duration_seconds: durationSeconds,
    })
  },

  /** Import validation errors */
  importValidationError(errorType: string, rowIndex?: number) {
    capture('contact_import_validation_error', { error_type: errorType, row_index: rowIndex })
  },

  /** AI segmentation result */
  aiSegmentationCompleted(segmentCount: number, contactsAssigned: number, durationSeconds: number) {
    capture('ai_segmentation_completed', {
      segment_count: segmentCount,
      contacts_assigned: contactsAssigned,
      duration_seconds: durationSeconds,
    })
  },
}

// ============================================================
// 8. INTEGRATION EVENTS
// ============================================================

export const phIntegrationEvents = {
  pageViewed() {
    capture('$pageview', { page: 'integrations' })
  },

  connectStarted(provider: string, type: string) {
    capture('integration_connect_started', { provider, integration_type: type })
  },

  connected(provider: string, type: string) {
    capture('integration_connected', { provider, integration_type: type })
    incrementUserProperty('total_integrations_connected')
  },

  disconnected(provider: string, type: string) {
    capture('integration_disconnected', { provider, integration_type: type })
  },

  syncStarted(provider: string) {
    capture('integration_sync_started', { provider })
  },

  syncCompleted(provider: string, recordsCreated: number, recordsUpdated: number) {
    capture('integration_sync_completed', {
      provider,
      records_created: recordsCreated,
      records_updated: recordsUpdated,
      total_records: recordsCreated + recordsUpdated,
    })
  },

  syncFailed(provider: string, errorType: string) {
    capture('integration_sync_failed', { provider, error_type: errorType })
    tagSession('sync_error')
  },

  slackNotificationsConfigured(channelsCount: number) {
    capture('slack_notifications_configured', { channels_count: channelsCount })
  },

  webhookCreated() {
    capture('webhook_endpoint_created')
  },

  webhookDeleted() {
    capture('webhook_endpoint_deleted')
  },

  feedbackSubmitted(feedbackType: string) {
    capture('integration_feedback_submitted', { feedback_type: feedbackType })
  },

  /** Track integration connection flow timing */
  connectionFlowStarted(provider: string) {
    phFlowEvents.startFlow('integration_connect', provider)
  },

  connectionFlowCompleted(provider: string) {
    phFlowEvents.completeFlow('integration_connect', provider)
  },

  connectionFlowAbandoned(provider: string, atStep: string) {
    phFlowEvents.abandonFlow('integration_connect', provider, atStep)
  },

  /** CRM sync errors */
  crmSyncError(provider: string, errorType: string) {
    capture('crm_sync_error', { provider, error_type: errorType })
    tagSession('crm_sync_error')
  },

  /** Field mapping completed */
  fieldMappingCompleted(provider: string, fieldsCount: number) {
    capture('field_mapping_completed', { provider, fields_count: fieldsCount })
  },

  /** Webhook URL copied */
  webhookUrlCopied() {
    capture('webhook_url_copied')
  },

  /** Webhook secret copied */
  webhookSecretCopied() {
    capture('webhook_secret_copied')
  },
}

// ============================================================
// 9. CALENDAR EVENTS
// ============================================================

export const phCalendarEvents = {
  pageViewed() {
    capture('$pageview', { page: 'calendar' })
  },

  viewChanged(view: string) {
    capture('calendar_view_changed', { view })
  },

  dateNavigated(direction: string) {
    capture('calendar_date_navigated', { direction })
  },

  eventCreated(eventType: string, source: string) {
    capture('calendar_event_created', { event_type: eventType, source })
  },

  eventRescheduled(eventType: string) {
    capture('calendar_event_rescheduled', { event_type: eventType })
  },

  eventCancelled(eventType: string) {
    capture('calendar_event_cancelled', { event_type: eventType })
  },

  eventClicked(eventType: string) {
    capture('calendar_event_clicked', { event_type: eventType })
  },

  filterApplied(filterType: string) {
    capture('calendar_filter_applied', { filter_type: filterType })
  },

  timezoneChanged(timezone: string) {
    capture('calendar_timezone_changed', { timezone })
  },

  workingHoursUpdated(start: string, end: string) {
    capture('calendar_working_hours_updated', { start, end })
  },

  syncTriggered(provider: string) {
    capture('calendar_sync_triggered', { provider })
  },

  teamMemberAssigned() {
    capture('calendar_team_member_assigned')
  },
}

// ============================================================
// 10. FOLLOW-UP EVENTS
// ============================================================

export const phFollowUpEvents = {
  pageViewed() {
    capture('$pageview', { page: 'follow-ups' })
  },

  filtered(status: string) {
    capture('follow_ups_filtered', { status })
  },

  searched(queryLength: number) {
    capture('follow_ups_searched', { query_length: queryLength })
  },

  detailViewed(reason: string, attemptNumber: number) {
    capture('follow_up_detail_viewed', { reason, attempt_number: attemptNumber })
  },
}

// ============================================================
// 11. VOICEMAIL EVENTS
// ============================================================

export const phVoicemailEvents = {
  pageViewed() {
    capture('$pageview', { page: 'voicemails' })
  },

  played(durationSeconds: number) {
    capture('voicemail_played', { duration_seconds: durationSeconds })
  },

  filtered(filterType: string) {
    capture('voicemails_filtered', { filter_type: filterType })
  },

  searched(queryLength: number) {
    capture('voicemails_searched', { query_length: queryLength })
  },
}

// ============================================================
// 12. TEAM EVENTS
// ============================================================

export const phTeamEvents = {
  pageViewed() {
    capture('$pageview', { page: 'team' })
  },

  memberInvited(role: string, method: string) {
    capture('team_member_invited', { role, method })
  },

  memberRemoved() {
    capture('team_member_removed')
  },

  memberRoleChanged(fromRole: string, toRole: string) {
    capture('team_member_role_changed', { from_role: fromRole, to_role: toRole })
  },

  bulkInviteSent(count: number, source: string) {
    capture('team_bulk_invite_sent', { count, source })
  },

  inviteResent() {
    capture('team_invite_resent')
  },

  inviteCancelled() {
    capture('team_invite_cancelled')
  },
}

// ============================================================
// 13. NAVIGATION & ENGAGEMENT EVENTS
// ============================================================

export const phNavigationEvents = {
  sidebarClicked(destination: string) {
    capture('sidebar_navigation_clicked', { destination })
  },

  notificationClicked(notificationType: string) {
    capture('notification_clicked', { notification_type: notificationType })
  },

  notificationDismissed() {
    capture('notification_dismissed')
  },

  notificationsBellClicked(unreadCount: number) {
    capture('notifications_bell_clicked', { unread_count: unreadCount })
  },

  allNotificationsMarkedRead() {
    capture('all_notifications_marked_read')
  },

  languageChanged(fromLang: string, toLang: string) {
    capture('language_changed', { from_lang: fromLang, to_lang: toLang })
  },

  searchPerformed(section: string, queryLength: number) {
    capture('search_performed', { section, query_length: queryLength })
  },
}

// ============================================================
// 14. SETTINGS EVENTS
// ============================================================

export const phSettingsEvents = {
  pageViewed() {
    capture('$pageview', { page: 'settings' })
  },

  tabChanged(tabName: string) {
    capture('settings_tab_changed', { tab_name: tabName })
  },

  companyProfileUpdated() {
    capture('company_profile_updated')
  },

  defaultVoiceChanged(voiceId: string) {
    capture('default_voice_changed', { voice_id: voiceId })
  },

  testPhoneUpdated() {
    capture('test_phone_updated')
  },

  notificationPreferencesUpdated(enabled: boolean) {
    capture('notification_preferences_updated', { enabled })
  },
}

// ============================================================
// 15. DASHBOARD EVENTS
// ============================================================

export const phDashboardEvents = {
  pageViewed() {
    capture('$pageview', { page: 'dashboard' })
  },

  quickStartAgentClicked(agentType: string) {
    capture('dashboard_quick_start_clicked', { agent_type: agentType })
  },

  recentCallClicked() {
    capture('dashboard_recent_call_clicked')
  },

  recentCampaignClicked() {
    capture('dashboard_recent_campaign_clicked')
  },

  usageMeterViewed(usagePercent: number) {
    capture('dashboard_usage_meter_viewed', { usage_percent: usagePercent })
  },
}

// ============================================================
// 16. ANALYTICS / REPORTS PAGE EVENTS
// ============================================================

export const phAnalyticsPageEvents = {
  pageViewed() {
    capture('$pageview', { page: 'analytics' })
  },

  periodChanged(period: string) {
    capture('analytics_period_changed', { period })
  },

  reportExported(format: string) {
    capture('report_exported', { format })
  },

  reportsPageViewed() {
    capture('$pageview', { page: 'reports' })
  },

  chartInteracted(chartType: string) {
    capture('chart_interacted', { chart_type: chartType })
  },
}

// ============================================================
// 17. AI CHAT EVENTS
// ============================================================

export const phAiChatEvents = {
  started() {
    capture('ai_chat_started')
  },

  messageSent(messageLength: number) {
    capture('ai_chat_message_sent', { message_length: messageLength })
  },

  conversationCreated() {
    capture('ai_chat_conversation_created')
  },

  conversationDeleted() {
    capture('ai_chat_conversation_deleted')
  },

  /** AI response received — track latency */
  responseReceived(responseTimeMs: number) {
    capture('ai_chat_response_received', { response_time_ms: responseTimeMs })
  },

  /** User clicked a suggestion from the AI */
  suggestionClicked(suggestionType: string) {
    capture('ai_chat_suggestion_clicked', { suggestion_type: suggestionType })
  },
}

// ============================================================
// 18. ERROR & PERFORMANCE EVENTS
// ============================================================

export const phErrorEvents = {
  apiError(endpoint: string, statusCode: number) {
    capture('api_error', { endpoint, status_code: statusCode })
    tagSession('api_error')
  },

  clientError(errorType: string, component: string) {
    capture('client_error', { error_type: errorType, component })
    tagSession('client_error')
  },

  paymentFailed(plan: string, errorType: string) {
    capture('payment_failed', { plan, error_type: errorType })
    tagSession('payment_error')
  },

  /** User retried after an error */
  userRetried(originalError: string, retryCount: number) {
    capture('user_retried_after_error', { original_error: originalError, retry_count: retryCount })
  },

  /** Error boundary triggered */
  errorBoundaryTriggered(component: string, errorMessage: string) {
    capture('error_boundary_triggered', { component, error_message: errorMessage })
    tagSession('error_boundary')
  },

  /** Rate limit hit by user */
  rateLimitHit(endpoint: string) {
    capture('rate_limit_hit', { endpoint })
  },
}

// ============================================================
// 19. FEATURE DISCOVERY & ENGAGEMENT SCORING
// ============================================================

export const phEngagementEvents = {
  featureDiscovered(featureName: string) {
    capture('feature_discovered', { feature_name: featureName })
  },

  tooltipViewed(tooltipId: string) {
    capture('tooltip_viewed', { tooltip_id: tooltipId })
  },

  emptyStateViewed(section: string) {
    capture('empty_state_viewed', { section })
  },

  emptyStateCtaClicked(section: string, ctaType: string) {
    capture('empty_state_cta_clicked', { section, cta_type: ctaType })
  },

  sessionDuration(durationMinutes: number) {
    capture('session_duration_tracked', { duration_minutes: durationMinutes })
  },

  /** First time user uses a feature */
  firstTimeFeatureUsed(featureName: string) {
    capture('first_time_feature_used', { feature_name: featureName })
    updateUserProperties({ [`first_used_${featureName}_at`]: new Date().toISOString() })
  },

  /** User returned to a feature repeatedly (engagement signal) */
  featureRevisited(featureName: string, visitCount: number) {
    capture('feature_revisited', { feature_name: featureName, visit_count: visitCount })
  },
}

// ============================================================
// 20. TIMING & FLOW TRACKING
// ============================================================
// Tracks how long critical user flows take (onboarding, campaign setup,
// contact import, agent config) and where users abandon.

const flowTimers: Record<string, number> = {}

export const phFlowEvents = {
  /** Start timing a user flow. Call with a unique flowId. */
  startFlow(flowName: string, flowId?: string) {
    const key = flowId ? `${flowName}:${flowId}` : flowName
    flowTimers[key] = Date.now()
    capture(`${flowName}_flow_started`, { flow_id: flowId })
  },

  /** Complete a flow — captures duration in seconds. */
  completeFlow(flowName: string, flowId?: string, extra?: Record<string, string | number | boolean>) {
    const key = flowId ? `${flowName}:${flowId}` : flowName
    const startTime = flowTimers[key]
    const durationSeconds = startTime ? Math.round((Date.now() - startTime) / 1000) : undefined
    delete flowTimers[key]
    capture(`${flowName}_flow_completed`, {
      flow_id: flowId,
      duration_seconds: durationSeconds,
      ...extra,
    })
  },

  /** Abandon a flow — captures where and when the user dropped off. */
  abandonFlow(flowName: string, flowId?: string, atStep?: string, reason?: string) {
    const key = flowId ? `${flowName}:${flowId}` : flowName
    const startTime = flowTimers[key]
    const durationSeconds = startTime ? Math.round((Date.now() - startTime) / 1000) : undefined
    delete flowTimers[key]
    capture(`${flowName}_flow_abandoned`, {
      flow_id: flowId,
      at_step: atStep,
      reason,
      duration_seconds: durationSeconds,
    })
    tagSession(`abandoned_${flowName}`)
  },
}

// ============================================================
// 21. DECISION TRACKING
// ============================================================
// Tracks critical user decisions — plan selection, agent type choice,
// voice selection, integration choice, etc.

export const phDecisionEvents = {
  /** User chose plan X over plan Y on the pricing page */
  planSelected(selectedPlan: string, previousPlan?: string, trigger?: string) {
    capture('plan_selected', {
      selected_plan: selectedPlan,
      previous_plan: previousPlan,
      trigger: trigger, // 'pricing_page' | 'upgrade_cta' | 'limit_reached' | 'settings'
    })
  },

  /** User chose monthly vs annual billing */
  billingCycleChosen(cycle: 'monthly' | 'annual', planSlug: string) {
    capture('billing_cycle_chosen', { cycle, plan_slug: planSlug })
  },

  /** User selected an agent type */
  agentTypeChosen(agentType: string, isFirstAgent: boolean) {
    capture('agent_type_chosen', { agent_type: agentType, is_first_agent: isFirstAgent })
  },

  /** User chose a specific voice for their agent */
  voiceChosen(voiceId: string, voiceName: string, previewsListened: number) {
    capture('voice_chosen', {
      voice_id: voiceId,
      voice_name: voiceName,
      previews_listened: previewsListened,
    })
  },

  /** User chose a specific CRM integration */
  integrationChosen(provider: string, trigger: string) {
    capture('integration_chosen', { provider, trigger })
  },

  /** User chose contact import method */
  importMethodChosen(method: 'csv' | 'google_sheets' | 'crm' | 'manual') {
    capture('import_method_chosen', { method })
  },

  /** User chose campaign contacts (how many, from which list) */
  campaignContactsChosen(contactCount: number, sourceType: string) {
    capture('campaign_contacts_chosen', { contact_count: contactCount, source_type: sourceType })
  },

  /** User toggled overage on/off — a critical billing decision */
  overageDecision(enabled: boolean, budget?: number) {
    capture('overage_decision', { enabled, budget })
  },
}

// ============================================================
// 22. QUICK START & TUTORIAL TRACKING
// ============================================================

export const phQuickStartEvents = {
  /** Quick start guide became visible on dashboard */
  guideViewed() {
    capture('quick_start_guide_viewed')
  },

  /** User completed a quick start task */
  taskCompleted(taskName: string, taskIndex: number) {
    capture('quick_start_task_completed', { task_name: taskName, task_index: taskIndex })
  },

  /** User dismissed the quick start guide */
  guideDismissed(tasksCompleted: number, totalTasks: number) {
    capture('quick_start_guide_dismissed', {
      tasks_completed: tasksCompleted,
      total_tasks: totalTasks,
      completion_percent: Math.round((tasksCompleted / totalTasks) * 100),
    })
  },

  /** User clicked "watch video" or tutorial link */
  tutorialClicked(tutorialName: string, tutorialType: 'video' | 'article' | 'interactive') {
    capture('tutorial_clicked', { tutorial_name: tutorialName, tutorial_type: tutorialType })
  },

  /** User completed watching/reading a tutorial */
  tutorialCompleted(tutorialName: string, durationSeconds: number) {
    capture('tutorial_completed', { tutorial_name: tutorialName, duration_seconds: durationSeconds })
  },
}

// ============================================================
// 23. TEST CALL TRACKING
// ============================================================

export const phTestCallEvents = {
  /** User initiated a test call */
  initiated(agentType: string, voiceId: string) {
    capture('test_call_initiated', { agent_type: agentType, voice_id: voiceId })
    phFlowEvents.startFlow('test_call')
  },

  /** Test call connected */
  connected(ringDurationSeconds: number) {
    capture('test_call_connected', { ring_duration_seconds: ringDurationSeconds })
  },

  /** Test call completed */
  completed(durationSeconds: number, outcome: string) {
    capture('test_call_completed', { duration_seconds: durationSeconds, outcome })
    phFlowEvents.completeFlow('test_call', undefined, { duration_seconds: durationSeconds, outcome })
  },

  /** Test call failed */
  failed(errorType: string, atStage: string) {
    capture('test_call_failed', { error_type: errorType, at_stage: atStage })
    tagSession('test_call_failed')
  },

  /** User replayed their test call recording */
  recordingReplayed() {
    capture('test_call_recording_replayed')
  },

  /** User rated test call quality */
  qualityRated(rating: number, feedback?: string) {
    capture('test_call_quality_rated', { rating, feedback })
  },
}

// ============================================================
// 24. COPY & SHARE ACTIONS
// ============================================================

export const phCopyShareEvents = {
  /** User copied an API key or webhook URL */
  copied(itemType: string, context: string) {
    capture('item_copied', { item_type: itemType, context })
  },

  /** User shared a campaign or report link */
  shared(itemType: string, shareMethod: string) {
    capture('item_shared', { item_type: itemType, share_method: shareMethod })
  },

  /** User downloaded a file (recording, transcript, export) */
  downloaded(fileType: string, context: string) {
    capture('file_downloaded', { file_type: fileType, context })
  },
}

// ============================================================
// 25. ABANDONMENT & PAGE ENGAGEMENT
// ============================================================

export const phPageEvents = {
  /** User spent significant time on a page (tracked at intervals) */
  timeOnPage(pageName: string, seconds: number) {
    capture('time_on_page', { page_name: pageName, seconds })
  },

  /** User scrolled to a specific depth on a page */
  scrollDepth(pageName: string, percentDepth: number) {
    capture('scroll_depth', { page_name: pageName, percent_depth: percentDepth })
  },

  /** User left a form without submitting */
  formAbandoned(formName: string, fieldsFilledCount: number, totalFields: number) {
    capture('form_abandoned', {
      form_name: formName,
      fields_filled: fieldsFilledCount,
      total_fields: totalFields,
      completion_percent: Math.round((fieldsFilledCount / totalFields) * 100),
    })
  },

  /** User encountered a paywall or plan limit */
  limitReached(limitType: string, currentPlan: string, suggestedUpgrade?: string) {
    capture('plan_limit_reached', {
      limit_type: limitType,
      current_plan: currentPlan,
      suggested_upgrade: suggestedUpgrade,
    })
    tagSession('hit_plan_limit')
  },

  /** User saw an upgrade prompt and what they did */
  upgradePromptResponse(promptType: string, action: 'clicked' | 'dismissed' | 'later', currentPlan: string) {
    capture('upgrade_prompt_response', {
      prompt_type: promptType,
      action,
      current_plan: currentPlan,
    })
  },
}

// ============================================================
// 26. REPORTS & ANALYTICS PAGE EVENTS
// ============================================================

export const phReportsEvents = {
  /** User viewed a specific report */
  reportViewed(reportType: string) {
    capture('report_viewed', { report_type: reportType })
  },

  /** User changed the date range in a report */
  dateRangeChanged(reportType: string, range: string) {
    capture('report_date_range_changed', { report_type: reportType, range })
  },

  /** User exported a report */
  reportExported(reportType: string, format: string, rowCount: number) {
    capture('report_exported', { report_type: reportType, format, row_count: rowCount })
  },

  /** User drilled down into a metric */
  metricDrilldown(metricName: string, dimension: string) {
    capture('metric_drilldown', { metric_name: metricName, dimension })
  },
}

// ============================================================
// 27. CALI AI (AI ASSISTANT) DEEP TRACKING
// ============================================================

export const phCaliAiEvents = {
  /** AI panel opened — track the trigger source */
  panelOpened(trigger: 'keyboard_shortcut' | 'sidebar' | 'help_button' | 'command_palette' | 'auto') {
    capture('cali_ai_panel_opened', { trigger })
  },

  /** AI panel closed */
  panelClosed(messagesInSession: number, durationSeconds: number) {
    capture('cali_ai_panel_closed', {
      messages_in_session: messagesInSession,
      duration_seconds: durationSeconds,
    })
  },

  /** User asked a question — categorize the intent */
  questionAsked(intent: string, messageLength: number) {
    capture('cali_ai_question_asked', { intent, message_length: messageLength })
  },

  /** AI suggested a navigation action and user followed it */
  suggestionFollowed(suggestionType: string, destination: string) {
    capture('cali_ai_suggestion_followed', { suggestion_type: suggestionType, destination })
  },

  /** AI suggestion was ignored */
  suggestionIgnored(suggestionType: string) {
    capture('cali_ai_suggestion_ignored', { suggestion_type: suggestionType })
  },
}

// ============================================================
// 28. SECURITY EVENTS
// ============================================================

export const phSecurityEvents = {
  passwordChanged() {
    capture('password_changed')
  },

  passwordChangeFailed(reason: string) {
    capture('password_change_failed', { reason })
    tagSession('password_change_failed')
  },

  mfaEnrollmentStarted() {
    capture('mfa_enrollment_started')
  },

  mfaEnrollmentCompleted() {
    capture('mfa_enrollment_completed')
  },

  mfaEnrollmentCancelled() {
    capture('mfa_enrollment_cancelled')
  },

  mfaDisabled() {
    capture('mfa_disabled')
  },
}

// ============================================================
// 29. SERVER-SIDE TRACKING
// ============================================================
// Server-side tracking lives in src/lib/posthog-server.ts
// to avoid bundling posthog-node (which uses node:fs) in client code.
// Import from '@/lib/posthog-server' in API routes.
