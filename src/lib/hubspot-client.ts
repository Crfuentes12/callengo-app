// src/lib/hubspot-client.ts
// HubSpot Private App client singleton for user/contact sync (NOT the OAuth CRM integration)
// Uses HUBSPOT_PRIVATE_APP_TOKEN — separate from the per-company OAuth flow in lib/hubspot/

import { Client } from '@hubspot/api-client'

export const hubspot = new Client({
  accessToken: process.env.HUBSPOT_PRIVATE_APP_TOKEN,
})
