'use client';

import { useState } from 'react';
import Link from 'next/link';
import { useAuth } from '@/contexts/AuthContext';

export default function ForgotPasswordPage() {
  const { resetPassword } = useAuth();
  const [email, setEmail] = useState('');
  const [loading, setLoading] = useState(false);
  const [sent, setSent] = useState(false);
  const [error, setError] = useState('');

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError('');
    setLoading(true);

    const { error: resetError } = await resetPassword(email);

    if (resetError) {
      setError(resetError.message || 'Failed to send reset email');
    } else {
      setSent(true);
    }

    setLoading(false);
  };

  if (sent) {
    return (
      <div className="animate-fade-in">
        {/* Header */}
        <div className="mb-8">
          <div className="w-14 h-14 rounded-2xl gradient-bg flex items-center justify-center mb-6 shadow-lg shadow-[var(--color-primary)]/20">
            <svg className="w-7 h-7 text-white" fill="none" viewBox="0 0 24 24" stroke="currentColor">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M3 8l7.89 5.26a2 2 0 002.22 0L21 8M5 19h14a2 2 0 002-2V7a2 2 0 00-2-2H5a2 2 0 00-2 2v10a2 2 0 002 2z" />
            </svg>
          </div>
          <h1 className="text-3xl font-bold text-slate-900 tracking-tight">
            Check your email
          </h1>
          <p className="text-slate-500 mt-2">
            We&apos;ve sent a password reset link to
          </p>
          <p className="text-slate-900 font-semibold text-base mt-1">{email}</p>
        </div>

        {/* Steps card */}
        <div className="bg-[var(--color-primary-50)] border border-[var(--color-primary-100)] rounded-2xl p-5 mb-6">
          <p className="font-semibold text-slate-800 mb-3 text-sm">Next steps:</p>
          <ol className="space-y-2.5">
            {[
              'Open the email we sent you',
              'Click the reset password link',
              'Enter your new password',
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

        {/* Back to sign in */}
        <Link
          href="/auth/login"
          className="flex items-center justify-center gap-2 w-full py-3 text-sm text-slate-600 hover:text-slate-800 font-medium transition-colors rounded-xl hover:bg-slate-100"
        >
          <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M10 19l-7-7m0 0l7-7m-7 7h18" />
          </svg>
          Back to sign in
        </Link>
      </div>
    );
  }

  return (
    <div className="animate-fade-in">
      {/* Header */}
      <div className="mb-8">
        <div className="w-14 h-14 rounded-2xl bg-[var(--color-primary-50)] flex items-center justify-center mb-6">
          <svg className="w-7 h-7 text-[var(--color-primary)]" fill="none" viewBox="0 0 24 24" stroke="currentColor">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 7a2 2 0 012 2m4 0a6 6 0 01-7.743 5.743L11 17H9v2H7v2H4a1 1 0 01-1-1v-2.586a1 1 0 01.293-.707l5.964-5.964A6 6 0 1121 9z" />
          </svg>
        </div>
        <h1 className="text-3xl font-bold text-slate-900 tracking-tight">
          Forgot password?
        </h1>
        <p className="text-slate-500 mt-2">
          No worries, we&apos;ll send you reset instructions
        </p>
      </div>

      {/* Error */}
      {error && (
        <div className="mb-6 p-4 bg-red-50 border border-red-200 rounded-xl text-red-700 text-sm flex items-start gap-3">
          <svg className="w-5 h-5 shrink-0 mt-0.5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 8v4m0 4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
          </svg>
          <span>{error}</span>
        </div>
      )}

      {/* Form */}
      <form onSubmit={handleSubmit} className="space-y-5">
        <div>
          <label className="block text-sm font-semibold text-slate-700 mb-2">
            Email Address
          </label>
          <div className="relative">
            <div className="absolute inset-y-0 left-0 pl-3.5 flex items-center pointer-events-none">
              <svg className="w-[18px] h-[18px] text-slate-400" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M16 12a4 4 0 10-8 0 4 4 0 008 0zm0 0v1.5a2.5 2.5 0 005 0V12a9 9 0 10-9 9m4.5-1.206a8.959 8.959 0 01-4.5 1.207" />
              </svg>
            </div>
            <input
              type="email"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              placeholder="you@company.com"
              className="auth-input"
              required
              disabled={loading}
              autoComplete="email"
            />
          </div>
        </div>

        <button
          type="submit"
          disabled={loading}
          className="auth-submit-btn flex items-center justify-center gap-2"
        >
          {loading ? (
            <>
              <svg className="animate-spin h-5 w-5" viewBox="0 0 24 24">
                <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" fill="none" />
                <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z" />
              </svg>
              Sending...
            </>
          ) : (
            'Send reset link'
          )}
        </button>
      </form>

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
