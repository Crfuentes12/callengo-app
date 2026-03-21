// app/api/billing/phone-numbers/route.ts
// List dedicated phone numbers for the company
import { NextResponse } from 'next/server';
import { createServerClient } from '@/lib/supabase/server';
import { getCompanyNumbers, MAX_DEDICATED_NUMBERS, DEDICATED_NUMBER_PRICE } from '@/lib/bland/phone-numbers';

export async function GET() {
  try {
    const supabase = await createServerClient();
    const { data: { user } } = await supabase.auth.getUser();

    if (!user) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const { data: userData } = await supabase
      .from('users')
      .select('company_id')
      .eq('id', user.id)
      .single();

    if (!userData?.company_id) {
      return NextResponse.json({ error: 'No company found' }, { status: 404 });
    }

    const numbers = await getCompanyNumbers(userData.company_id);

    return NextResponse.json({
      numbers,
      maxNumbers: MAX_DEDICATED_NUMBERS,
      pricePerMonth: DEDICATED_NUMBER_PRICE,
      canAddMore: numbers.length < MAX_DEDICATED_NUMBERS,
    });
  } catch (error) {
    console.error('[phone-numbers] Error:', error);
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}
