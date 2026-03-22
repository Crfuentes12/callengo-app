// app/api/auth/verify-recaptcha/route.ts
// Server-side reCAPTCHA v3 token verification
// Called before signup to block bots and spam registrations
import { NextRequest, NextResponse } from 'next/server';
import { expensiveLimiter } from '@/lib/rate-limit';

const RECAPTCHA_SECRET_KEY = process.env.RECAPTCHA_SECRET_KEY;
// Minimum score to allow signup (0.0 = bot, 1.0 = human). Default: 0.5
const MIN_SCORE = Number(process.env.RECAPTCHA_MIN_SCORE || '0.5');

export async function POST(req: NextRequest) {
  // Rate limit: 10 requests per minute per IP
  const ip = req.headers.get('x-forwarded-for')?.split(',')[0]?.trim() || 'unknown';
  const rateLimitResult = await expensiveLimiter.check(10, `verify-recaptcha:${ip}`);
  if (!rateLimitResult.success) {
    return NextResponse.json({ error: 'Too many requests' }, { status: 429 });
  }

  if (!RECAPTCHA_SECRET_KEY) {
    // In production, reject if reCAPTCHA not configured — prevents bot signup bypass
    if (process.env.NODE_ENV === 'production') {
      console.error('[verify-recaptcha] RECAPTCHA_SECRET_KEY not configured in production!');
      return NextResponse.json({ error: 'reCAPTCHA not configured' }, { status: 500 });
    }
    // In dev, allow through
    console.warn('[verify-recaptcha] RECAPTCHA_SECRET_KEY not configured — skipping verification (dev)');
    return NextResponse.json({ success: true, score: 1.0 });
  }

  try {
    const { token } = await req.json();

    if (!token) {
      return NextResponse.json({ error: 'reCAPTCHA token is required' }, { status: 400 });
    }

    // Verify the token with Google's reCAPTCHA API
    const verifyUrl = 'https://www.google.com/recaptcha/api/siteverify';
    const response = await fetch(verifyUrl, {
      method: 'POST',
      headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
      body: new URLSearchParams({
        secret: RECAPTCHA_SECRET_KEY,
        response: token,
        remoteip: ip,
      }),
      signal: AbortSignal.timeout(5000),
    });

    const data = await response.json();

    if (!data.success) {
      console.warn(`[verify-recaptcha] Token verification failed for IP ${ip}:`, data['error-codes']);
      return NextResponse.json(
        { error: 'reCAPTCHA verification failed', details: data['error-codes'] },
        { status: 403 }
      );
    }

    // reCAPTCHA v3 returns a score (0.0 - 1.0)
    // Lower scores = more likely bot
    if (data.score < MIN_SCORE) {
      console.warn(`[verify-recaptcha] Low score ${data.score} for IP ${ip} (action: ${data.action})`);
      return NextResponse.json(
        { error: 'Verification score too low', score: data.score },
        { status: 403 }
      );
    }

    // Verify the action matches what we expect
    if (data.action && data.action !== 'signup') {
      console.warn(`[verify-recaptcha] Action mismatch: expected "signup", got "${data.action}" for IP ${ip}`);
      return NextResponse.json(
        { error: 'reCAPTCHA action mismatch' },
        { status: 403 }
      );
    }

    return NextResponse.json({
      success: true,
      score: data.score,
    });
  } catch (error) {
    console.error('[verify-recaptcha] Error:', error);
    return NextResponse.json({ error: 'Verification failed' }, { status: 500 });
  }
}
