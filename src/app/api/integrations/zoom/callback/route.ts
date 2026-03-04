// app/api/integrations/zoom/callback/route.ts
// No longer used — Server-to-Server OAuth doesn't require a callback.
// Kept for safety in case old links still point here.

import { NextRequest, NextResponse } from 'next/server';
import { getAppUrl } from '@/lib/config';

export async function GET(request: NextRequest) {
  const appUrl = getAppUrl();
  return NextResponse.redirect(
    new URL('/integrations?error=zoom_s2s_no_callback', appUrl || request.url)
  );
}
