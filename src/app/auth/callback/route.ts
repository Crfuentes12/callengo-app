// app/auth/callback/route.ts
import { createServerClient } from '@supabase/ssr';
import { NextResponse } from 'next/server';
import type { NextRequest } from 'next/server';
import { cookies } from 'next/headers';

export async function GET(request: NextRequest) {
  const requestUrl = new URL(request.url);
  const code = requestUrl.searchParams.get('code');
  const origin = requestUrl.origin;

  if (code) {
    const cookieStore = await cookies();
    
    const supabase = createServerClient(
      process.env.NEXT_PUBLIC_SUPABASE_URL!,
      process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
      {
        cookies: {
          getAll() {
            return cookieStore.getAll();
          },
          setAll(cookiesToSet) {
            try {
              cookiesToSet.forEach(({ name, value, options }) =>
                cookieStore.set(name, value, options)
              );
            } catch {
              // Server component
            }
          },
        },
      }
    );

    const { error } = await supabase.auth.exchangeCodeForSession(code);
    
    if (error) {
      console.error('Error exchanging code for session:', error);
      return NextResponse.redirect(`${origin}/auth/login?error=auth_callback_error`);
    }

    // Get user to check if they have completed onboarding
    const { data: { user } } = await supabase.auth.getUser();

    if (user) {
      // Check if user has a company
      const { data: userData } = await supabase
        .from('users')
        .select('company_id')
        .eq('id', user.id)
        .maybeSingle();

      if (!userData?.company_id) {
        // New user - redirect to onboarding
        return NextResponse.redirect(`${origin}/onboarding`);
      }
    }

    // User already onboarded - redirect to dashboard
    return NextResponse.redirect(`${origin}/dashboard`);
  }

  // No code - redirect to login
  return NextResponse.redirect(`${origin}/auth/login`);
}