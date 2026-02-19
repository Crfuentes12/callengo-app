// middleware.ts
import { createServerClient } from '@supabase/ssr';
import { NextResponse, type NextRequest } from 'next/server';

export async function middleware(request: NextRequest) {
  let supabaseResponse = NextResponse.next({
    request,
  });

  const supabase = createServerClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
    {
      cookies: {
        getAll() {
          return request.cookies.getAll();
        },
        setAll(cookiesToSet) {
          cookiesToSet.forEach(({ name, value }) => request.cookies.set(name, value));
          supabaseResponse = NextResponse.next({
            request,
          });
          cookiesToSet.forEach(({ name, value, options }) =>
            supabaseResponse.cookies.set(name, value, options)
          );
        },
      },
    }
  );

  const {
    data: { user },
  } = await supabase.auth.getUser();

  const pathname = request.nextUrl.pathname;

  // Public routes that don't require auth
  const publicRoutes = [
    '/auth/login',
    '/auth/signup',
    '/auth/forgot-password',
    '/auth/reset-password',
  ];

  // Routes that require auth but not email verification
  const verificationRoutes = ['/auth/verify-email'];

  // Protected routes that require authentication AND email verification
  const protectedRoutes = ['/dashboard', '/onboarding', '/contacts', '/campaigns', '/agents', '/calls', '/voicemails', '/follow-ups', '/analytics', '/reports', '/integrations', '/settings', '/billing', '/admin', '/subscription'];

  const isPublicRoute = publicRoutes.some(route => pathname.startsWith(route));
  const isVerificationRoute = verificationRoutes.some(route => pathname.startsWith(route));
  const isProtectedRoute = protectedRoutes.some(route => pathname.startsWith(route));

  // Allow callback always (it handles its own redirects)
  if (pathname === '/auth/callback') {
    return supabaseResponse;
  }

  // Allow verification routes for users with session
  if (isVerificationRoute) {
    return supabaseResponse;
  }

  // If user is not logged in and tries to access protected route
  if (!user && isProtectedRoute) {
    return NextResponse.redirect(new URL('/auth/login', request.url));
  }

  // If user is logged in, check email verification for protected routes
  if (user && isProtectedRoute) {
    // Check if email is verified
    if (!user.email_confirmed_at) {
      // Email not verified - redirect to verify page
      return NextResponse.redirect(new URL('/auth/verify-email?email=' + encodeURIComponent(user.email || ''), request.url));
    }

    // Email is verified, check onboarding status
    const { data: userData } = await supabase
      .from('users')
      .select('company_id')
      .eq('id', user.id)
      .maybeSingle();

    if (!userData?.company_id && pathname !== '/onboarding') {
      // User hasn't completed onboarding - redirect there
      return NextResponse.redirect(new URL('/onboarding', request.url));
    }

    if (userData?.company_id && pathname === '/onboarding') {
      // User has completed onboarding but is on onboarding page - redirect to dashboard
      return NextResponse.redirect(new URL('/dashboard', request.url));
    }
  }

  // If user is logged in and verified and tries to access public auth pages
  if (user && user.email_confirmed_at && isPublicRoute) {
    // Check if user has completed onboarding
    const { data: userData } = await supabase
      .from('users')
      .select('company_id')
      .eq('id', user.id)
      .maybeSingle();

    if (!userData?.company_id) {
      // User hasn't completed onboarding - redirect there
      return NextResponse.redirect(new URL('/onboarding', request.url));
    }

    // User has completed onboarding - redirect to dashboard
    return NextResponse.redirect(new URL('/dashboard', request.url));
  }

  return supabaseResponse;
}

export const config = {
  matcher: [
    '/((?!_next/static|_next/image|favicon.ico|.*\\.(?:svg|png|jpg|jpeg|gif|webp)$).*)',
  ],
};