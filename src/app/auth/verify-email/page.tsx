'use client';

import { Suspense, useState } from 'react';
import { useSearchParams } from 'next/navigation';
import Link from 'next/link';
import { useAuth } from '@/contexts/AuthContext';

function VerifyEmailForm() {
  const searchParams = useSearchParams();
  const { resendVerification } = useAuth();
  const email = searchParams.get('email');
  const [resending, setResending] = useState(false);
  const [resent, setResent] = useState(false);
  const [error, setError] = useState('');

  const handleResend = async () => {
    if (!email) return;

    setResending(true);
    setError('');
    setResent(false);

    const { error: resendError } = await resendVerification(email);

    if (resendError) {
      setError(resendError.message || 'Failed to resend email');
    } else {
      setResent(true);
    }

    setResending(false);
  };

  return (
    <div className="animate-fade-in">
      {/* Header with animated icon */}
      <div className="mb-8">
        <div className="w-16 h-16 rounded-2xl gradient-bg flex items-center justify-center mb-6 shadow-lg shadow-[var(--color-primary)]/20 relative">
          <svg className="w-8 h-8 text-white" fill="none" viewBox="0 0 24 24" stroke="currentColor">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M3 8l7.89 5.26a2 2 0 002.22 0L21 8M5 19h14a2 2 0 002-2V7a2 2 0 00-2-2H5a2 2 0 00-2 2v10a2 2 0 002 2z" />
          </svg>
          {/* Notification badge */}
          <div className="absolute -top-1.5 -right-1.5 w-6 h-6 bg-amber-400 rounded-full flex items-center justify-center shadow-md ring-2 ring-[var(--background)]">
            <svg className="w-3.5 h-3.5 text-white" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={3}>
              <path strokeLinecap="round" strokeLinejoin="round" d="M12 6v6m0 0v.01" />
            </svg>
          </div>
        </div>

        <h1 className="text-3xl font-bold text-slate-900 tracking-tight">
          Check your email
        </h1>
        <p className="text-slate-500 mt-2">
          We&apos;ve sent a verification link to
        </p>
        {email && (
          <p className="text-slate-900 font-semibold text-base mt-1">{email}</p>
        )}
      </div>

      {/* Steps card */}
      <div className="bg-[var(--color-primary-50)] border border-[var(--color-primary-100)] rounded-2xl p-5 mb-6">
        <p className="font-semibold text-slate-800 mb-3 text-sm">Next steps:</p>
        <ol className="space-y-2.5">
          {[
            'Open the email we sent you',
            'Click the verification link',
            'Complete your company setup',
          ].map((step, i) => (
            <li key={i} className="flex items-start gap-3">
              <span className="flex items-center justify-center w-6 h-6 rounded-full gradient-bg text-white text-xs font-bold shrink-0">
                {i + 1}
              </span>
              <span className="text-sm text-slate-600 pt-0.5">{step}</span>
            </li>
          ))}
        </ol>
      </div>

      {/* Alerts */}
      {error && (
        <div className="mb-4 p-4 bg-red-50 border border-red-200 rounded-xl text-red-700 text-sm flex items-start gap-3">
          <svg className="w-5 h-5 shrink-0 mt-0.5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 8v4m0 4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
          </svg>
          <span>{error}</span>
        </div>
      )}

      {resent && (
        <div className="mb-4 p-4 bg-emerald-50 border border-emerald-200 rounded-xl text-emerald-700 text-sm flex items-start gap-3">
          <svg className="w-5 h-5 shrink-0 mt-0.5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 12l2 2 4-4m6 2a9 9 0 11-18 0 9 9 0 0118 0z" />
          </svg>
          <span>Verification email resent successfully!</span>
        </div>
      )}

      {/* Resend button */}
      <button
        onClick={handleResend}
        disabled={resending || !email}
        className="w-full py-3 text-[var(--color-primary)] font-semibold hover:opacity-80 disabled:opacity-50 disabled:cursor-not-allowed transition-all flex items-center justify-center gap-2 rounded-xl hover:bg-[var(--color-primary)]/5 border border-transparent hover:border-[var(--color-primary)]/10"
      >
        {resending ? (
          <>
            <svg className="animate-spin h-4 w-4" viewBox="0 0 24 24">
              <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" fill="none" />
              <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z" />
            </svg>
            Sending...
          </>
        ) : (
          <>
            <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 4v5h.582m15.356 2A8.001 8.001 0 004.582 9m0 0H9m11 11v-5h-.581m0 0a8.003 8.003 0 01-15.357-2m15.357 2H15" />
            </svg>
            Didn&apos;t receive the email? Resend
          </>
        )}
      </button>

      {/* Tip */}
      <div className="mt-6 p-3.5 bg-slate-50 border border-slate-100 rounded-xl flex items-start gap-3">
        <svg className="w-4 h-4 text-slate-400 shrink-0 mt-0.5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M13 16h-1v-4h-1m1-4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
        </svg>
        <p className="text-xs text-slate-500 leading-relaxed">
          Can&apos;t find the email? Check your spam or junk folder. The email may take a few moments to arrive.
        </p>
      </div>

      {/* Footer */}
      <div className="mt-8 pt-6 border-t border-slate-200">
        <Link
          href="/auth/login"
          className="flex items-center justify-center gap-2 text-sm text-slate-500 hover:text-slate-700 font-medium transition-colors"
        >
          <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M10 19l-7-7m0 0l7-7m-7 7h18" />
          </svg>
          Back to sign in
        </Link>
      </div>
    </div>
  );
}

export default function VerifyEmailPage() {
  return (
    <Suspense fallback={
      <div className="flex items-center justify-center py-20">
        <div className="animate-spin rounded-full h-10 w-10 border-t-2 border-b-2 border-[var(--color-primary)]" />
      </div>
    }>
      <VerifyEmailForm />
    </Suspense>
  );
}
