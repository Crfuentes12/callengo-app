// app/auth/verify-email/page.tsx
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
    <div className="min-h-screen gradient-bg-subtle flex items-center justify-center p-4">
      <div className="w-full max-w-md">
        <div className="text-center mb-8">
          <div className="inline-flex items-center justify-center w-20 h-20 rounded-3xl gradient-bg mb-6 shadow-md relative">
            <svg className="w-10 h-10 text-white" fill="none" viewBox="0 0 24 24" stroke="currentColor">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M3 8l7.89 5.26a2 2 0 002.22 0L21 8M5 19h14a2 2 0 002-2V7a2 2 0 00-2-2H5a2 2 0 00-2 2v10a2 2 0 002 2z" />
            </svg>
            <div className="absolute -top-1 -right-1 w-6 h-6 bg-amber-400 rounded-full flex items-center justify-center shadow-lg">
              <svg className="w-4 h-4 text-white" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 8v4m0 4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
              </svg>
            </div>
          </div>
          <h1 className="text-4xl font-bold text-slate-900 mb-3 tracking-tight">Check your email</h1>
          <p className="text-slate-500">We've sent a verification link to</p>
          {email && (
            <p className="text-slate-900 font-semibold text-lg mt-2">{email}</p>
          )}
        </div>

        <div className="bg-white rounded-3xl shadow-md p-8 border border-slate-200">
          <div className="text-center space-y-6">
            <div className="flex items-start text-left space-x-4 p-5 gradient-bg-subtle rounded-2xl border border-slate-200">
              <div className="shrink-0">
                <svg className="w-6 h-6 text-[var(--color-primary)] mt-0.5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M13 16h-1v-4h-1m1-4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
                </svg>
              </div>
              <div className="text-sm text-slate-700">
                <p className="font-semibold mb-3 text-base">Next steps:</p>
                <ol className="space-y-2">
                  <li className="flex items-start gap-2">
                    <span className="flex items-center justify-center w-6 h-6 rounded-full gradient-bg text-white text-xs font-bold shrink-0">1</span>
                    <span>Open the email we sent you</span>
                  </li>
                  <li className="flex items-start gap-2">
                    <span className="flex items-center justify-center w-6 h-6 rounded-full gradient-bg text-white text-xs font-bold shrink-0">2</span>
                    <span>Click the verification link</span>
                  </li>
                  <li className="flex items-start gap-2">
                    <span className="flex items-center justify-center w-6 h-6 rounded-full gradient-bg text-white text-xs font-bold shrink-0">3</span>
                    <span>Complete your company setup</span>
                  </li>
                </ol>
              </div>
            </div>

            {error && (
              <div className="p-4 bg-red-50 border border-red-200 rounded-xl text-red-700 text-sm flex items-start gap-3">
                <svg className="w-5 h-5 shrink-0 mt-0.5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 8v4m0 4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
                </svg>
                <span>{error}</span>
              </div>
            )}

            {resent && (
              <div className="p-4 bg-emerald-50 border border-emerald-200 rounded-xl text-emerald-700 text-sm flex items-start gap-3">
                <svg className="w-5 h-5 shrink-0 mt-0.5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 12l2 2 4-4m6 2a9 9 0 11-18 0 9 9 0 0118 0z" />
                </svg>
                <span>Verification email resent successfully!</span>
              </div>
            )}

            <div className="pt-4 space-y-3">
              <button
                onClick={handleResend}
                disabled={resending || !email}
                className="w-full py-3.5 text-[var(--color-primary)] font-semibold hover:opacity-80 disabled:opacity-50 disabled:cursor-not-allowed transition-colors flex items-center justify-center gap-2 hover:bg-[var(--color-primary)]/5 rounded-xl"
              >
                {resending ? (
                  <>
                    <svg className="animate-spin h-5 w-5" viewBox="0 0 24 24">
                      <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" fill="none"></circle>
                      <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"></path>
                    </svg>
                    Sending...
                  </>
                ) : (
                  <>
                    <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 4v5h.582m15.356 2A8.001 8.001 0 004.582 9m0 0H9m11 11v-5h-.581m0 0a8.003 8.003 0 01-15.357-2m15.357 2H15" />
                    </svg>
                    Didn't receive the email? Resend
                  </>
                )}
              </button>
            </div>
          </div>
        </div>

        <p className="text-center text-slate-500 text-sm mt-8">
          Check your spam folder if you don't see the email
        </p>
      </div>
    </div>
  );
}

export default function VerifyEmailPage() {
  return (
    <Suspense fallback={
      <div className="min-h-screen gradient-bg-subtle flex items-center justify-center">
        <div className="animate-spin rounded-full h-12 w-12 border-t-2 border-b-2 border-[var(--color-primary)]"></div>
      </div>
    }>
      <VerifyEmailForm />
    </Suspense>
  );
}
