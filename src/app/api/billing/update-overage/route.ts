// app/api/billing/update-overage/route.ts
// DEPRECATED: Overage has been removed from Callengo.
// This endpoint returns a 410 Gone response.
import { NextRequest, NextResponse } from 'next/server';

export async function POST(request: NextRequest) {
  return NextResponse.json(
    {
      error: 'Overage billing has been removed',
      message: 'Overage is no longer available. Please upgrade your plan for more minutes.',
    },
    { status: 410 }
  );
}
