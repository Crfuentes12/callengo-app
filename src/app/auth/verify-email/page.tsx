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
    if (resendError) { setError(resendError.message || 'Failed to resend'); }
    else { setResent(true); }
    setResending(false);
  };

  return (
    <div className="animate-fade-in text-center">
      <div className="w-12 h-12 rounded-2xl gradient-bg flex items-center justify-center mx-auto mb-4 shadow-lg shadow-[var(--color-primary)]/20 relative">
        <svg className="w-6 h-6 text-white" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M3 8l7.89 5.26a2 2 0 002.22 0L21 8M5 19h14a2 2 0 002-2V7a2 2 0 00-2-2H5a2 2 0 00-2 2v10a2 2 0 002 2z" /></svg>
        <div className="absolute -top-1 -right-1 w-5 h-5 bg-amber-400 rounded-full flex items-center justify-center ring-2 ring-white">
          <svg className="w-3 h-3 text-white" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={3}><path strokeLinecap="round" strokeLinejoin="round" d="M12 6v6m0 0v.01" /></svg>
        </div>
      </div>

      <h1 className="text-2xl font-bold text-slate-900 tracking-tight">Check your email</h1>
      <p className="text-slate-400 text-sm mt-1">
        Verification link sent to{email && <><br /><span className="text-slate-700 font-medium">{email}</span></>}
      </p>

      <div className="mt-5 bg-slate-50 border border-slate-100 rounded-xl p-4 text-left">
        <ol className="space-y-2">
          {['Open the email we sent', 'Click the verification link', 'Complete your company setup'].map((step, i) => (
            <li key={i} className="flex items-center gap-2.5 text-xs text-slate-600">
              <span className="w-5 h-5 rounded-full gradient-bg text-white text-[10px] font-bold flex items-center justify-center shrink-0">{i + 1}</span>
              {step}
            </li>
          ))}
        </ol>
      </div>

      {error && (
        <div className="mt-3 p-2.5 bg-red-50 border border-red-200 rounded-xl text-red-600 text-xs">{error}</div>
      )}
      {resent && (
        <div className="mt-3 p-2.5 bg-emerald-50 border border-emerald-200 rounded-xl text-emerald-600 text-xs">Verification email resent!</div>
      )}

      <button
        onClick={handleResend}
        disabled={resending || !email}
        className="mt-4 w-full py-2.5 text-xs text-[var(--color-primary)] font-semibold hover:opacity-80 disabled:opacity-50 disabled:cursor-not-allowed transition-all flex items-center justify-center gap-1.5 rounded-xl hover:bg-[var(--color-primary)]/5 border border-slate-200"
      >
        {resending ? (
          <><svg className="animate-spin h-3.5 w-3.5" viewBox="0 0 24 24"><circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" fill="none" /><path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z" /></svg>Sending...</>
        ) : (
          <><svg className="w-3.5 h-3.5" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 4v5h.582m15.356 2A8.001 8.001 0 004.582 9m0 0H9m11 11v-5h-.581m0 0a8.003 8.003 0 01-15.357-2m15.357 2H15" /></svg>Resend email</>
        )}
      </button>

      <p className="mt-3 text-[10px] text-slate-400">Check spam if you don&apos;t see it</p>

      <div className="mt-4 pt-4 border-t border-slate-100">
        <Link href="/auth/login" className="inline-flex items-center gap-1.5 text-xs text-slate-400 hover:text-slate-600 font-medium transition-colors">
          <svg className="w-3.5 h-3.5" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M10 19l-7-7m0 0l7-7m-7 7h18" /></svg>
          Back to sign in
        </Link>
      </div>
    </div>
  );
}

export default function VerifyEmailPage() {
  return (
    <Suspense fallback={<div className="flex justify-center py-16"><div className="animate-spin rounded-full h-8 w-8 border-t-2 border-b-2 border-[var(--color-primary)]" /></div>}>
      <VerifyEmailForm />
    </Suspense>
  );
}
