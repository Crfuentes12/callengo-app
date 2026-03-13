// src/lib/hubspot-user-sync.ts
// HubSpot user lifecycle sync — syncs Callengo users as HubSpot contacts
// Uses the Private App token (HUBSPOT_PRIVATE_APP_TOKEN) via direct REST calls
// Separate from the per-company OAuth CRM integration in lib/hubspot/

const HUBSPOT_BASE = 'https://api.hubapi.com'
const PORTAL_ID = process.env.NEXT_PUBLIC_HUBSPOT_PORTAL_ID

function getToken(): string | undefined {
  return process.env.HUBSPOT_PRIVATE_APP_TOKEN
}

function headers(): Record<string, string> {
  return {
    Authorization: `Bearer ${getToken()}`,
    'Content-Type': 'application/json',
  }
}

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

interface HubSpotContact {
  id: string
  properties: Record<string, string | null>
}

/**
 * Search for a HubSpot contact by email.
 * Returns the contact object or null if not found.
 */
async function findContactByEmail(email: string): Promise<HubSpotContact | null> {
  const res = await fetch(`${HUBSPOT_BASE}/crm/v3/objects/contacts/search`, {
    method: 'POST',
    headers: headers(),
    body: JSON.stringify({
      filterGroups: [
        {
          filters: [
            { propertyName: 'email', operator: 'EQ', value: email },
          ],
        },
      ],
      properties: [
        'email', 'firstname', 'lastname', 'company',
        'callengo_user_id', 'callengo_plan', 'callengo_mrr',
        'stripe_customer_id', 'lifecyclestage',
      ],
      limit: 1,
    }),
  })

  const data = await res.json()
  if (data.total > 0) {
    return data.results[0] as HubSpotContact
  }
  return null
}

// ---------------------------------------------------------------------------
// 1. syncUserToHubSpot — called on signup
// ---------------------------------------------------------------------------

interface SyncUserParams {
  email: string
  fullName?: string
  company?: string
  userId: string // Supabase UUID
}

/**
 * Sync a newly signed-up user to HubSpot as a contact.
 * If the contact already exists, update properties. Otherwise create.
 * NEVER throws — all errors are caught and logged.
 */
export async function syncUserToHubSpot(user: SyncUserParams): Promise<void> {
  try {
    const token = getToken()
    if (!token) {
      console.warn('[HubSpot User Sync] HUBSPOT_PRIVATE_APP_TOKEN not set, skipping')
      return
    }

    const nameParts = (user.fullName || '').trim().split(/\s+/)
    const firstname = nameParts[0] || ''
    const lastname = nameParts.slice(1).join(' ') || ''

    const properties: Record<string, string> = {
      email: user.email,
      firstname,
      lastname,
      callengo_user_id: user.userId,
      callengo_plan: 'free',
      callengo_signup_date: new Date().toISOString().split('T')[0],
      lifecyclestage: 'lead',
    }
    if (user.company) {
      properties.company = user.company
    }

    const existing = await findContactByEmail(user.email)

    if (existing) {
      // Update existing contact
      await fetch(`${HUBSPOT_BASE}/crm/v3/objects/contacts/${existing.id}`, {
        method: 'PATCH',
        headers: headers(),
        body: JSON.stringify({ properties }),
      })
      console.log(`[HubSpot User Sync] Updated contact ${user.email} (${existing.id})`)
    } else {
      // Create new contact
      await fetch(`${HUBSPOT_BASE}/crm/v3/objects/contacts`, {
        method: 'POST',
        headers: headers(),
        body: JSON.stringify({ properties }),
      })
      console.log(`[HubSpot User Sync] Created contact ${user.email}`)
    }
  } catch (error) {
    console.error('[HubSpot User Sync] syncUserToHubSpot failed:', error)
  }
}

// ---------------------------------------------------------------------------
// 2. updateContactPlan — called on subscription changes
// ---------------------------------------------------------------------------

/**
 * Update a HubSpot contact's plan, MRR, and Stripe customer ID.
 * Used on subscription create/update/delete.
 */
export async function updateContactPlan(
  email: string,
  planName: string,
  mrr: string,
  stripeCustomerId: string
): Promise<void> {
  try {
    const token = getToken()
    if (!token) return

    const contact = await findContactByEmail(email)
    if (!contact) {
      console.warn(`[HubSpot User Sync] Contact not found for plan update: ${email}`)
      return
    }

    await fetch(`${HUBSPOT_BASE}/crm/v3/objects/contacts/${contact.id}`, {
      method: 'PATCH',
      headers: headers(),
      body: JSON.stringify({
        properties: {
          callengo_plan: planName,
          callengo_mrr: mrr,
          stripe_customer_id: stripeCustomerId,
          lifecyclestage: planName === 'free' ? 'lead' : 'customer',
        },
      }),
    })
    console.log(`[HubSpot User Sync] Updated plan for ${email}: ${planName}, MRR: ${mrr}`)
  } catch (error) {
    console.error('[HubSpot User Sync] updateContactPlan failed:', error)
  }
}

// ---------------------------------------------------------------------------
// 3. closeWonDeal — called when subscription is created/upgraded
// ---------------------------------------------------------------------------

/**
 * Close-won a deal for this contact. If an open deal exists, update it.
 * If none exists, create a new one already in closedwon.
 */
export async function closeWonDeal(
  email: string,
  planName: string,
  mrr: string
): Promise<void> {
  try {
    const token = getToken()
    if (!token) return

    const contact = await findContactByEmail(email)
    if (!contact) {
      console.warn(`[HubSpot User Sync] Contact not found for deal close: ${email}`)
      return
    }

    // Get deals associated with this contact
    const assocRes = await fetch(
      `${HUBSPOT_BASE}/crm/v3/objects/contacts/${contact.id}/associations/deals`,
      { headers: headers() }
    )
    const assocData = await assocRes.json()
    const dealIds: string[] = (assocData.results || []).map(
      (a: { id: string }) => a.id
    )

    let openDealId: string | null = null

    if (dealIds.length > 0) {
      // Batch read deals to find an open one
      const dealsRes = await fetch(`${HUBSPOT_BASE}/crm/v3/objects/deals/batch/read`, {
        method: 'POST',
        headers: headers(),
        body: JSON.stringify({
          properties: ['dealstage', 'dealname', 'amount', 'closedate'],
          inputs: dealIds.map((id) => ({ id })),
        }),
      })
      const dealsData = await dealsRes.json()

      for (const deal of dealsData.results || []) {
        const stage = deal.properties?.dealstage
        if (stage !== 'closedwon' && stage !== 'closedlost') {
          openDealId = deal.id
          break
        }
      }
    }

    const now = new Date().toISOString().split('T')[0]

    if (openDealId) {
      // Update existing open deal to closedwon
      await fetch(`${HUBSPOT_BASE}/crm/v3/objects/deals/${openDealId}`, {
        method: 'PATCH',
        headers: headers(),
        body: JSON.stringify({
          properties: {
            dealstage: 'closedwon',
            amount: mrr,
            closedate: now,
            dealname: `Callengo ${planName} — ${email}`,
          },
        }),
      })
      console.log(`[HubSpot User Sync] Closed-won deal ${openDealId} for ${email}`)
    } else {
      // Create new deal already in closedwon
      const dealRes = await fetch(`${HUBSPOT_BASE}/crm/v3/objects/deals`, {
        method: 'POST',
        headers: headers(),
        body: JSON.stringify({
          properties: {
            dealname: `Callengo ${planName} — ${email}`,
            dealstage: 'closedwon',
            amount: mrr,
            closedate: now,
            pipeline: 'default',
          },
        }),
      })
      const dealData = await dealRes.json()

      // Associate deal with contact
      if (dealData.id) {
        await fetch(
          `${HUBSPOT_BASE}/crm/v3/objects/deals/${dealData.id}/associations/contacts/${contact.id}/deal_to_contact`,
          { method: 'PUT', headers: headers() }
        )
        console.log(`[HubSpot User Sync] Created closed-won deal ${dealData.id} for ${email}`)
      }
    }
  } catch (error) {
    console.error('[HubSpot User Sync] closeWonDeal failed:', error)
  }
}

// ---------------------------------------------------------------------------
// 4. logProductEvent — HubSpot Behavioral Events
// ---------------------------------------------------------------------------

/**
 * Send a Custom Behavioral Event to HubSpot.
 * eventName should be the internal name HubSpot generates: pe{portalId}_{name}
 */
export async function logProductEvent(
  email: string,
  eventName: string,
  properties: Record<string, string | number> = {}
): Promise<void> {
  try {
    const token = getToken()
    if (!token) return

    await fetch(`${HUBSPOT_BASE}/events/v3/send`, {
      method: 'POST',
      headers: headers(),
      body: JSON.stringify({
        eventName,
        email,
        properties,
      }),
    })
    console.log(`[HubSpot User Sync] Sent event ${eventName} for ${email}`)
  } catch (error) {
    console.error('[HubSpot User Sync] logProductEvent failed:', error)
  }
}

// ---------------------------------------------------------------------------
// 5. createTaskForContact — used on payment failures
// ---------------------------------------------------------------------------

/**
 * Create a HubSpot task associated with a contact (e.g., for payment failures).
 */
export async function createTaskForContact(
  email: string,
  subject: string,
  priority: 'LOW' | 'MEDIUM' | 'HIGH' = 'HIGH'
): Promise<void> {
  try {
    const token = getToken()
    if (!token) return

    const contact = await findContactByEmail(email)
    if (!contact) {
      console.warn(`[HubSpot User Sync] Contact not found for task: ${email}`)
      return
    }

    // Create task
    const tomorrow = new Date()
    tomorrow.setDate(tomorrow.getDate() + 1)

    const taskRes = await fetch(`${HUBSPOT_BASE}/crm/v3/objects/tasks`, {
      method: 'POST',
      headers: headers(),
      body: JSON.stringify({
        properties: {
          hs_task_subject: subject,
          hs_task_priority: priority,
          hs_timestamp: tomorrow.toISOString(),
          hs_task_status: 'NOT_STARTED',
        },
      }),
    })
    const taskData = await taskRes.json()

    // Associate task with contact
    if (taskData.id) {
      await fetch(
        `${HUBSPOT_BASE}/crm/v3/objects/tasks/${taskData.id}/associations/contacts/${contact.id}/task_to_contact`,
        { method: 'PUT', headers: headers() }
      )
      console.log(`[HubSpot User Sync] Created task "${subject}" for ${email}`)
    }
  } catch (error) {
    console.error('[HubSpot User Sync] createTaskForContact failed:', error)
  }
}

// ---------------------------------------------------------------------------
// 6. Helpers for building behavioral event names
// ---------------------------------------------------------------------------

/**
 * Build the HubSpot internal event name: pe{portalId}_{event_name}
 */
export function hsEventName(name: string): string {
  return `pe${PORTAL_ID}_${name}`
}
