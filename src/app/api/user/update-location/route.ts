/**
 * Update User Location API
 * Automatically called on app load/refresh to update user's geolocation and currency
 * Runs silently in background without user interaction
 */

import { NextRequest, NextResponse } from 'next/server';
import { createServerClient } from '@/lib/supabase/server';
import {
  getClientIP,
  getGeolocationFromIP,
  createLocationLogEntry,
  appendLocationLog,
} from '@/lib/geolocation';

export async function POST(req: NextRequest) {
  try {
    const supabase = await createServerClient();

    // Get authenticated user
    const {
      data: { user },
      error: authError,
    } = await supabase.auth.getUser();

    if (authError || !user) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    // Get client IP from request headers
    const ip = getClientIP(req.headers);

    // Fetch geolocation data from IP
    const location = await getGeolocationFromIP(ip);

    if (!location) {
      // If geolocation fails, return success but don't update
      return NextResponse.json({
        success: true,
        message: 'Geolocation unavailable, using defaults',
        currency: 'USD',
      });
    }

    // Get current user data to append to location logs
    const { data: userData, error: fetchError } = await supabase
      .from('users')
      .select('location_logs')
      .eq('id', user.id)
      .single();

    if (fetchError) {
      console.error('[UpdateLocation] Error fetching user:', fetchError);
    }

    // Create new location log entry
    const newLogEntry = createLocationLogEntry(location);

    // Append to existing logs
    const updatedLogs = appendLocationLog(userData?.location_logs as any[] | null, newLogEntry);

    // Update user record
    const { error: updateError } = await supabase
      .from('users')
      .update({
        currency: location.currency,
        country_code: location.country_code,
        country_name: location.country_name,
        city: location.city,
        region: location.region,
        timezone: location.timezone,
        ip_address: location.ip,
        location_logs: updatedLogs,
        location_updated_at: new Date().toISOString(),
      })
      .eq('id', user.id);

    if (updateError) {
      console.error('[UpdateLocation] Error updating user:', updateError);
      return NextResponse.json({ error: 'Failed to update location' }, { status: 500 });
    }

    return NextResponse.json({
      success: true,
      currency: location.currency,
      country: location.country_code,
      city: location.city,
      ip: location.ip,
    });
  } catch (error: any) {
    console.error('[UpdateLocation] Unexpected error:', error);
    return NextResponse.json(
      { error: 'Internal server error', message: error.message },
      { status: 500 }
    );
  }
}

// Also support GET for easier testing
export async function GET(req: NextRequest) {
  try {
    const supabase = await createServerClient();

    const {
      data: { user },
      error: authError,
    } = await supabase.auth.getUser();

    if (authError || !user) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    // Get user location data
    const { data: userData, error: fetchError } = await supabase
      .from('users')
      .select('currency, country_code, country_name, city, ip_address, location_updated_at')
      .eq('id', user.id)
      .single();

    if (fetchError) {
      return NextResponse.json({ error: 'User not found' }, { status: 404 });
    }

    return NextResponse.json({
      currency: userData.currency || 'USD',
      country: userData.country_code,
      city: userData.city,
      ip: userData.ip_address,
      last_updated: userData.location_updated_at,
    });
  } catch (error: any) {
    console.error('[GetLocation] Unexpected error:', error);
    return NextResponse.json(
      { error: 'Internal server error', message: error.message },
      { status: 500 }
    );
  }
}
