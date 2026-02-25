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
    if (resetError) { setError(resetError.message || 'Failed to send reset email'); }
    else { setSent(true); }
    setLoading(false);
  };

  if (sent) {
    return (
      <div className="animate-fade-in text-center">
        <div className="w-12 h-12 rounded-2xl gradient-bg flex items-center justify-center mx-auto mb-4 shadow-lg shadow-[var(--color-primary)]/20">
          <svg className="w-6 h-6 text-white" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M3 8l7.89 5.26a2 2 0 002.22 0L21 8M5 19h14a2 2 0 002-2V7a2 2 0 00-2-2H5a2 2 0 00-2 2v10a2 2 0 002 2z" /></svg>
        </div>
        <h1 className="text-2xl font-bold text-slate-900 tracking-tight">Check your email</h1>
        <p className="text-slate-400 text-sm mt-1">Reset link sent to <span className="text-slate-700 font-medium">{email}</span></p>

        <div className="mt-5 bg-slate-50 border border-slate-100 rounded-xl p-4 text-left">
          <ol className="space-y-2">
            {['Open the email', 'Click the reset link', 'Set your new password'].map((step, i) => (
              <li key={i} className="flex items-center gap-2.5 text-xs text-slate-600">
                <span className="w-5 h-5 rounded-full gradient-bg text-white text-[10px] font-bold flex items-center justify-center shrink-0">{i + 1}</span>
                {step}
              </li>
            ))}
          </ol>
        </div>

        <Link href="/auth/login" className="inline-flex items-center gap-1.5 mt-5 text-xs text-slate-400 hover:text-slate-600 font-medium transition-colors">
          <svg className="w-3.5 h-3.5" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M10 19l-7-7m0 0l7-7m-7 7h18" /></svg>
          Back to sign in
        </Link>
      </div>
    );
  }

  return (
    <div className="animate-fade-in">
      <h1 className="text-2xl font-bold text-slate-900 tracking-tight">Forgot password?</h1>
      <p className="text-slate-400 text-sm mt-1 mb-6">We&apos;ll send you reset instructions</p>

      {error && (
        <div className="mb-4 p-3 bg-red-50 border border-red-200 rounded-xl text-red-600 text-xs flex items-center gap-2">
          <svg className="w-4 h-4 shrink-0" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 8v4m0 4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z" /></svg>
          <span>{error}</span>
        </div>
      )}

      <form onSubmit={handleSubmit} className="space-y-4">
        <div>
          <label className="block text-xs font-medium text-slate-500 mb-1.5">Email Address</label>
          <div className="relative">
            <div className="absolute inset-y-0 left-0 pl-3 flex items-center pointer-events-none">
              <svg className="w-4 h-4 text-slate-400" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M16 12a4 4 0 10-8 0 4 4 0 008 0zm0 0v1.5a2.5 2.5 0 005 0V12a9 9 0 10-9 9m4.5-1.206a8.959 8.959 0 01-4.5 1.207" /></svg>
            </div>
            <input type="email" value={email} onChange={(e) => setEmail(e.target.value)} placeholder="you@company.com" className="auth-input" required disabled={loading} autoComplete="email" />
          </div>
        </div>

        <button type="submit" disabled={loading} className="auth-submit-btn flex items-center justify-center gap-2">
          {loading ? (
            <><svg className="animate-spin h-4 w-4" viewBox="0 0 24 24"><circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" fill="none" /><path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z" /></svg>Sending...</>
          ) : 'Send reset link'}
        </button>
      </form>

      <div className="mt-5 text-center">
        <Link href="/auth/login" className="inline-flex items-center gap-1.5 text-xs text-slate-400 hover:text-slate-600 font-medium transition-colors">
          <svg className="w-3.5 h-3.5" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M10 19l-7-7m0 0l7-7m-7 7h18" /></svg>
          Back to sign in
        </Link>
      </div>
    </div>
  );
}
