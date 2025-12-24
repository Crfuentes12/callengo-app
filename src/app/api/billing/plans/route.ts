// app/api/billing/plans/route.ts
import { NextResponse } from 'next/server';
import { createServerClient } from '@/lib/supabase/server';

export async function GET() {
  try {
    const supabase = await createServerClient();

    // Fetch all active subscription plans
    const { data: plans, error } = await supabase
      .from('subscription_plans')
      .select('*')
      .eq('is_active', true)
      .order('display_order', { ascending: true });

    if (error) {
      console.error('Error fetching plans:', error);
      // Return empty array if table doesn't exist yet
      return NextResponse.json([]);
    }

    return NextResponse.json(plans || []);

  } catch (error) {
    console.error('Error fetching plans:', error);
    // Return empty array instead of error
    return NextResponse.json([]);
  }
}
