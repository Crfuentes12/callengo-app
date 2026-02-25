'use client';

import { Suspense, useState } from 'react';
import Link from 'next/link';
import { useAuth } from '@/contexts/AuthContext';
import { useSearchParams } from 'next/navigation';
import SocialAuthButtons from '@/components/auth/SocialAuthButtons';

function LoginForm() {
  const { signIn } = useAuth();
  const searchParams = useSearchParams();
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [showPassword, setShowPassword] = useState(false);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError('');
    setLoading(true);
    const { error: signInError } = await signIn(email, password);
    if (signInError) {
      setError(signInError.message || 'Invalid credentials. Please try again.');
      setLoading(false);
      return;
    }
    window.location.href = '/dashboard';
  };

  return (
    <div className="animate-fade-in">
      <h1 className="text-2xl font-bold text-white tracking-tight">Welcome back</h1>
      <p className="text-white/40 text-sm mt-1 mb-6">Sign in to your account</p>

      {(error || searchParams.get('error')) && (
        <div className="mb-4 p-3 bg-red-500/10 border border-red-500/20 rounded-xl text-red-300 text-xs flex items-center gap-2">
          <svg className="w-4 h-4 shrink-0" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 8v4m0 4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z" /></svg>
          <span>{error || 'Authentication error. Please try again.'}</span>
        </div>
      )}

      {searchParams.get('verified') === 'true' && (
        <div className="mb-4 p-3 bg-emerald-500/10 border border-emerald-500/20 rounded-xl text-emerald-300 text-xs flex items-center gap-2">
          <svg className="w-4 h-4 shrink-0" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 12l2 2 4-4m6 2a9 9 0 11-18 0 9 9 0 0118 0z" /></svg>
          <span>Email verified! You can now sign in.</span>
        </div>
      )}

      <form onSubmit={handleSubmit} className="space-y-4">
        <div>
          <label className="block text-xs font-medium text-white/40 mb-1.5">Email</label>
          <div className="relative">
            <div className="absolute inset-y-0 left-0 pl-3 flex items-center pointer-events-none">
              <svg className="w-4 h-4 text-white/25" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M16 12a4 4 0 10-8 0 4 4 0 008 0zm0 0v1.5a2.5 2.5 0 005 0V12a9 9 0 10-9 9m4.5-1.206a8.959 8.959 0 01-4.5 1.207" /></svg>
            </div>
            <input type="email" value={email} onChange={(e) => setEmail(e.target.value)} className="auth-input" placeholder="you@company.com" required disabled={loading} autoComplete="email" />
          </div>
        </div>

        <div>
          <div className="flex items-center justify-between mb-1.5">
            <label className="block text-xs font-medium text-white/40">Password</label>
            <Link href="/auth/forgot-password" className="text-xs text-white/50 hover:text-white/70 font-medium transition-colors">Forgot?</Link>
          </div>
          <div className="relative">
            <div className="absolute inset-y-0 left-0 pl-3 flex items-center pointer-events-none">
              <svg className="w-4 h-4 text-white/25" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 15v2m-6 4h12a2 2 0 002-2v-6a2 2 0 00-2-2H6a2 2 0 00-2 2v6a2 2 0 002 2zm10-10V7a4 4 0 00-8 0v4h8z" /></svg>
            </div>
            <input type={showPassword ? 'text' : 'password'} value={password} onChange={(e) => setPassword(e.target.value)} className="auth-input" style={{ paddingRight: '2.5rem' }} placeholder="Enter password" required disabled={loading} autoComplete="current-password" />
            <button type="button" onClick={() => setShowPassword(!showPassword)} className="absolute inset-y-0 right-0 pr-3 flex items-center text-white/25 hover:text-white/50 transition-colors" tabIndex={-1}>
              {showPassword ? (
                <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M13.875 18.825A10.05 10.05 0 0112 19c-4.478 0-8.268-2.943-9.543-7a9.97 9.97 0 011.563-3.029m5.858.908a3 3 0 114.243 4.243M9.878 9.878l4.242 4.242M9.88 9.88l-3.29-3.29m7.532 7.532l3.29 3.29M3 3l3.59 3.59m0 0A9.953 9.953 0 0112 5c4.478 0 8.268 2.943 9.543 7a10.025 10.025 0 01-4.132 5.411m0 0L21 21" /></svg>
              ) : (
                <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 12a3 3 0 11-6 0 3 3 0 016 0z" /><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M2.458 12C3.732 7.943 7.523 5 12 5c4.478 0 8.268 2.943 9.542 7-1.274 4.057-5.064 7-9.542 7-4.477 0-8.268-2.943-9.542-7z" /></svg>
              )}
            </button>
          </div>
        </div>

        <button type="submit" disabled={loading} className="auth-submit-btn flex items-center justify-center gap-2">
          {loading ? (
            <><svg className="animate-spin h-4 w-4" viewBox="0 0 24 24"><circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" fill="none" /><path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z" /></svg>Signing in...</>
          ) : 'Sign in'}
        </button>
      </form>

      {/* Divider */}
      <div className="flex items-center my-5">
        <div className="flex-1 border-t border-white/10" />
        
        <span className="px-4 text-xs text-white/25">
          or
        </span>
        
        <div className="flex-1 border-t border-white/10" />
      </div>

      {/* Social auth at bottom */}
      <SocialAuthButtons mode="signin" />

      <p className="text-center text-xs text-white/30 mt-5">
        Don&apos;t have an account?{' '}
        <Link href="/auth/signup" className="text-white/70 font-semibold hover:text-white transition-colors">Create account</Link>
      </p>
    </div>
  );
}

export default function LoginPage() {
  return (
    <Suspense fallback={<div className="flex justify-center py-16"><div className="animate-spin rounded-full h-8 w-8 border-t-2 border-b-2 border-white/30" /></div>}>
      <LoginForm />
    </Suspense>
  );
}
