// src/app/api/hubspot-events/route.ts
// Lightweight endpoint for logging HubSpot Custom Behavioral Events from the client.
// Resolves the user email server-side from auth, then fires logProductEvent.

import { NextRequest, NextResponse } from 'next/server';
import { createServerClient } from '@/lib/supabase/server';
import { logProductEvent, hsEventName } from '@/lib/hubspot-user-sync';

export async function POST(req: NextRequest) {
  try {
    const supabase = await createServerClient();
    const { data: { user } } = await supabase.auth.getUser();

    if (!user?.email) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const body = await req.json();
    const { eventName, properties } = body as {
      eventName: string;
      properties?: Record<string, string | number>;
    };

    if (!eventName) {
      return NextResponse.json({ error: 'Missing eventName' }, { status: 400 });
    }

    // Build the full HubSpot internal event name
    const fullEventName = hsEventName(eventName);

    await logProductEvent(user.email, fullEventName, properties || {});

    return NextResponse.json({ ok: true });
  } catch (error) {
    console.error('[HubSpot Events API] Error:', error);
    return NextResponse.json({ error: 'Internal error' }, { status: 500 });
  }
}
