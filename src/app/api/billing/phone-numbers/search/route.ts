// app/api/billing/phone-numbers/search/route.ts
// Search available phone numbers by state/area code
import { NextRequest, NextResponse } from 'next/server';
import { createServerClient } from '@/lib/supabase/server';
import {
  US_AREA_CODES_BY_STATE,
  CA_AREA_CODES_BY_PROVINCE,
  searchAvailableNumbers,
} from '@/lib/bland/phone-numbers';

export async function GET(req: NextRequest) {
  try {
    const supabase = await createServerClient();
    const { data: { user } } = await supabase.auth.getUser();

    if (!user) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const state = req.nextUrl.searchParams.get('state');
    const areaCode = req.nextUrl.searchParams.get('area_code');
    const country = req.nextUrl.searchParams.get('country') || 'US';

    // If searching by state, return all area codes for that state
    if (state) {
      const lookup = country === 'CA' ? CA_AREA_CODES_BY_PROVINCE : US_AREA_CODES_BY_STATE;
      const areaCodes = lookup[state];

      if (!areaCodes) {
        // Return all available states
        return NextResponse.json({
          states: Object.keys(lookup).sort(),
          message: `State "${state}" not found. Use one of the listed states.`,
        });
      }

      return NextResponse.json({
        state,
        country,
        areaCodes: areaCodes.map(code => ({
          areaCode: code,
          displayNumber: `(${code}) XXX-XXXX`,
        })),
      });
    }

    // If searching by area code, check availability
    if (areaCode) {
      const result = await searchAvailableNumbers(areaCode, country);
      return NextResponse.json(result);
    }

    // Default: return all states
    const usStates = Object.keys(US_AREA_CODES_BY_STATE).sort();
    const caProvinces = Object.keys(CA_AREA_CODES_BY_PROVINCE).sort();

    return NextResponse.json({
      US: usStates,
      CA: caProvinces,
      supportedCountries: ['US', 'CA'],
    });
  } catch (error) {
    console.error('[phone-numbers/search] Error:', error);
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}
