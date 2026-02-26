// app/auth/callback/route.ts
import { createServerClient } from '@supabase/ssr';
import { createClient } from '@supabase/supabase-js';
import { NextResponse } from 'next/server';
import type { NextRequest } from 'next/server';
import { cookies } from 'next/headers';

export async function GET(request: NextRequest) {
  const requestUrl = new URL(request.url);
  const code = requestUrl.searchParams.get('code');
  const inviteToken = requestUrl.searchParams.get('invite_token');
  const type = requestUrl.searchParams.get('type');
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
      // Handle team invitation acceptance
      if (type === 'team_invite' && inviteToken) {
        try {
          const adminClient = createClient(
            process.env.NEXT_PUBLIC_SUPABASE_URL!,
            process.env.SUPABASE_SERVICE_ROLE_KEY!,
            { auth: { autoRefreshToken: false, persistSession: false } }
          );

          // Find the invitation by token
          const { data: invitation } = await adminClient
            .from('team_invitations')
            .select('*')
            .eq('token', inviteToken)
            .eq('status', 'pending')
            .single();

          if (invitation && new Date(invitation.expires_at) > new Date()) {
            // Verify email matches
            if (user.email?.toLowerCase() === invitation.email.toLowerCase()) {
              // Accept the invitation: assign user to company with the invited role
              await adminClient
                .from('users')
                .update({
                  company_id: invitation.company_id,
                  role: invitation.role,
                })
                .eq('id', user.id);

              // Mark invitation as accepted
              await adminClient
                .from('team_invitations')
                .update({
                  status: 'accepted',
                  accepted_at: new Date().toISOString(),
                })
                .eq('id', invitation.id);

              console.log(`Team invitation accepted: ${user.email} joined company ${invitation.company_id}`);
              return NextResponse.redirect(`${origin}/dashboard?team_joined=true`);
            }
          }
        } catch (inviteError) {
          console.error('Error processing team invite during callback:', inviteError);
          // Don't block auth flow - continue to normal flow
        }
      }

      // Check if user has a company
      const { data: userData } = await supabase
        .from('users')
        .select('company_id')
        .eq('id', user.id)
        .maybeSingle();

      if (!userData?.company_id) {
        // Check if user's metadata has an invite (from Supabase Auth invite)
        const invitedCompany = user.user_metadata?.invited_to_company;
        const invitedRole = user.user_metadata?.invited_role;
        const metadataToken = user.user_metadata?.invite_token;

        if (invitedCompany && metadataToken) {
          try {
            const adminClient = createClient(
              process.env.NEXT_PUBLIC_SUPABASE_URL!,
              process.env.SUPABASE_SERVICE_ROLE_KEY!,
              { auth: { autoRefreshToken: false, persistSession: false } }
            );

            // Accept the invitation from metadata
            await adminClient
              .from('users')
              .update({
                company_id: invitedCompany,
                role: invitedRole || 'member',
              })
              .eq('id', user.id);

            // Mark the invitation as accepted
            await adminClient
              .from('team_invitations')
              .update({
                status: 'accepted',
                accepted_at: new Date().toISOString(),
              })
              .eq('token', metadataToken)
              .eq('status', 'pending');

            console.log(`Team invitation auto-accepted from metadata: ${user.email}`);
            return NextResponse.redirect(`${origin}/dashboard?team_joined=true`);
          } catch (inviteError) {
            console.error('Error auto-accepting team invite from metadata:', inviteError);
          }
        }

        // New user without invite - redirect to onboarding
        return NextResponse.redirect(`${origin}/onboarding`);
      }
    }

    // User already onboarded - redirect to dashboard
    return NextResponse.redirect(`${origin}/dashboard`);
  }

  // No code - redirect to login
  return NextResponse.redirect(`${origin}/auth/login`);
}