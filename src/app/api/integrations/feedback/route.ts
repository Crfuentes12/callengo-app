// app/api/integrations/feedback/route.ts
// API for submitting and retrieving integration feedback

import { NextRequest, NextResponse } from 'next/server';
import { createServerClient } from '@/lib/supabase/server';
import { supabaseAdminRaw } from '@/lib/supabase/service';

const VALID_FEEDBACK_TYPES = ['suggestion', 'improvement', 'new_integration', 'bug', 'other'] as const;

async function getAuthContext() {
  const supabase = await createServerClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return null;

  const { data: userData } = await supabase
    .from('users')
    .select('company_id')
    .eq('id', user.id)
    .single();

  if (!userData?.company_id) return null;

  return { userId: user.id, companyId: userData.company_id };
}

/**
 * POST /api/integrations/feedback
 * Create integration feedback.
 * Body: { feedback_type: string, message: string }
 */
export async function POST(req: NextRequest) {
  try {
    const ctx = await getAuthContext();
    if (!ctx) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const body = await req.json();
    const { feedback_type, message } = body;

    // Validate feedback_type
    if (!feedback_type || !VALID_FEEDBACK_TYPES.includes(feedback_type)) {
      return NextResponse.json(
        { error: `feedback_type must be one of: ${VALID_FEEDBACK_TYPES.join(', ')}` },
        { status: 400 }
      );
    }

    // Validate message is not empty
    if (!message || typeof message !== 'string' || message.trim().length === 0) {
      return NextResponse.json({ error: 'message is required and cannot be empty' }, { status: 400 });
    }

    // Check 1/day limit: has this user already submitted feedback in the last 24 hours?
    const { data: recentFeedback, error: checkError } = await supabaseAdminRaw
      .from('integration_feedback')
      .select('id, created_at')
      .eq('user_id', ctx.userId)
      .eq('company_id', ctx.companyId)
      .gte('created_at', new Date(Date.now() - 24 * 60 * 60 * 1000).toISOString())
      .limit(1);

    if (checkError) {
      console.error('[integration-feedback] Rate limit check error:', checkError);
      return NextResponse.json({ error: 'Failed to check rate limit' }, { status: 500 });
    }

    if (recentFeedback && recentFeedback.length > 0) {
      return NextResponse.json(
        { error: 'You can only submit integration feedback once per day' },
        { status: 429 }
      );
    }

    // Insert the feedback
    const { data: feedback, error: insertError } = await supabaseAdminRaw
      .from('integration_feedback')
      .insert({
        company_id: ctx.companyId,
        user_id: ctx.userId,
        feedback_type,
        message: message.trim(),
      })
      .select()
      .single();

    if (insertError) {
      console.error('[integration-feedback] Insert error:', insertError);
      return NextResponse.json({ error: 'Failed to save feedback' }, { status: 500 });
    }

    return NextResponse.json({ feedback }, { status: 201 });
  } catch (error) {
    console.error('[integration-feedback] POST error:', error);
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}

/**
 * GET /api/integrations/feedback
 * Get the current user's recent feedback (to check if they already submitted today).
 */
export async function GET() {
  try {
    const ctx = await getAuthContext();
    if (!ctx) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    // Fetch feedback submitted in the last 24 hours
    const { data: recentFeedback, error } = await supabaseAdminRaw
      .from('integration_feedback')
      .select('id, feedback_type, message, created_at')
      .eq('user_id', ctx.userId)
      .eq('company_id', ctx.companyId)
      .gte('created_at', new Date(Date.now() - 24 * 60 * 60 * 1000).toISOString())
      .order('created_at', { ascending: false })
      .limit(1);

    if (error) {
      console.error('[integration-feedback] GET error:', error);
      return NextResponse.json({ error: 'Failed to fetch feedback' }, { status: 500 });
    }

    const hasSubmittedToday = recentFeedback && recentFeedback.length > 0;

    return NextResponse.json({
      has_submitted_today: hasSubmittedToday,
      recent_feedback: recentFeedback || [],
    });
  } catch (error) {
    console.error('[integration-feedback] GET error:', error);
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}
