// src/lib/posthog-server.ts
// Server-side PostHog event capture for API routes and webhooks.
// Separated from posthog.ts (client) to avoid bundling posthog-node in browser code.

import { PostHog } from 'posthog-node'

/**
 * Server-side PostHog event capture.
 * Uses posthog-node SDK for API routes and webhooks.
 *
 * Requires: NEXT_PUBLIC_POSTHOG_KEY and optionally NEXT_PUBLIC_POSTHOG_HOST
 */
export async function captureServerEvent(
  distinctId: string,
  eventName: string,
  properties: Record<string, string | number | boolean> = {},
  groups?: { company?: string }
) {
  const key = process.env.NEXT_PUBLIC_POSTHOG_KEY
  if (!key) return

  try {
    const client = new PostHog(key, {
      host: process.env.NEXT_PUBLIC_POSTHOG_HOST || 'https://us.i.posthog.com',
      flushAt: 1,
      flushInterval: 0,
    })

    client.capture({
      distinctId,
      event: eventName,
      properties: {
        ...properties,
        $groups: groups,
      },
    })

    await client.shutdown()
  } catch {
    // Silently fail — analytics should never break the app
  }
}
