'use client';

import { useState, useMemo, useEffect, useCallback } from 'react';
import { useRouter } from 'next/navigation';
import Link from 'next/link';
import Script from 'next/script';
import { useAuth } from '@/contexts/AuthContext';
import SocialAuthButtons from '@/components/auth/SocialAuthButtons';
import { useTranslation } from '@/i18n';
import { authEvents } from '@/lib/analytics';
import { phAuthEvents } from '@/lib/posthog';

const RECAPTCHA_SITE_KEY = process.env.NEXT_PUBLIC_RECAPTCHA_SITE_KEY;

const getPasswordStrength = (password: string): { score: number; label: string; color: string } => {
  if (!password) return { score: 0, label: '', color: '' };
  let score = 0;
  if (password.length >= 6) score++;
  if (password.length >= 8) score++;
  if (/[A-Z]/.test(password)) score++;
  if (/[a-z]/.test(password)) score++;
  if (/[0-9]/.test(password)) score++;
  if (/[^A-Za-z0-9]/.test(password)) score++;

  if (score <= 2) return { score: 1, label: 'Weak', color: 'bg-red-500' };
  if (score <= 3) return { score: 2, label: 'Fair', color: 'bg-amber-500' };
  if (score <= 4) return { score: 3, label: 'Good', color: 'bg-blue-500' };
  return { score: 4, label: 'Strong', color: 'bg-emerald-500' };
};

export default function SignupPage() {
  const router = useRouter();
  const { signUp } = useAuth();
  const { t } = useTranslation();
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');
  const [showPassword, setShowPassword] = useState(false);
  const [showConfirmPassword, setShowConfirmPassword] = useState(false);
  const [formData, setFormData] = useState({ email: '', password: '', confirmPassword: '', fullName: '' });
   
  const [_recaptchaReady, setRecaptchaReady] = useState(!RECAPTCHA_SITE_KEY); // true if no key (dev mode)

  const strength = useMemo(() => getPasswordStrength(formData.password), [formData.password]);
  const passwordsMatch = formData.confirmPassword.length === 0 || formData.password === formData.confirmPassword;

  const onRecaptchaLoad = useCallback(() => {
    setRecaptchaReady(true);
  }, []);

  // Ensure recaptchaReady is set if grecaptcha is already loaded (e.g., cached script)
  useEffect(() => {
    if (RECAPTCHA_SITE_KEY && typeof window !== 'undefined' && window.grecaptcha) {
      setRecaptchaReady(true);
    }
  }, []);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError('');
    if (!formData.email || !formData.password || !formData.fullName) { setError(t.auth.signup.errorAllFields); return; }
    if (formData.password.length < 6) { setError(t.auth.signup.errorPasswordLength); return; }
    if (formData.password !== formData.confirmPassword) { setError(t.auth.signup.errorPasswordMismatch || 'Passwords do not match'); return; }
    setLoading(true);
    try {
      // reCAPTCHA v3 verification (invisible — no user interaction)
      if (RECAPTCHA_SITE_KEY && window.grecaptcha) {
        const token = await window.grecaptcha.execute(RECAPTCHA_SITE_KEY, { action: 'signup' });
        const verifyRes = await fetch('/api/auth/verify-recaptcha', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ token }),
        });

        if (!verifyRes.ok) {
          const verifyData = await verifyRes.json();
          throw new Error(verifyData.error || 'reCAPTCHA verification failed');
        }
      }

      const { error: signUpError } = await signUp(formData.email, formData.password, formData.fullName);
      if (signUpError) throw signUpError;
      authEvents.signUp('email');
      phAuthEvents.signUp('email');
      router.push('/auth/verify-email?email=' + encodeURIComponent(formData.email));
    } catch (err: unknown) {
      setError(err instanceof Error ? err.message : t.auth.signup.errorGeneric);
    } finally { setLoading(false); }
  };

  return (
    <div className="animate-fade-in">
      {/* reCAPTCHA v3 — invisible, no UI */}
      {RECAPTCHA_SITE_KEY && (
        <Script
          src={`https://www.google.com/recaptcha/api.js?render=${RECAPTCHA_SITE_KEY}`}
          onLoad={onRecaptchaLoad}
          strategy="lazyOnload"
        />
      )}

      <h1 className="text-2xl font-bold text-white tracking-tight">{t.auth.signup.title}</h1>
      <p className="text-white/40 text-sm mt-1 mb-6">{t.auth.signup.subtitle}</p>

      {error && (
        <div className="mb-4 p-3 bg-red-500/10 border border-red-500/20 rounded-xl text-red-300 text-xs flex items-center gap-2">
          <svg className="w-4 h-4 shrink-0" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 8v4m0 4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z" /></svg>
          <span>{error}</span>
        </div>
      )}

      <form onSubmit={handleSubmit} className="space-y-3.5">
        <div>
          <label className="block text-xs font-medium text-white/40 mb-1.5">{t.auth.signup.fullNameLabel}</label>
          <div className="relative">
            <div className="absolute inset-y-0 left-0 pl-3 flex items-center pointer-events-none">
              <svg className="w-4 h-4 text-white/25" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M16 7a4 4 0 11-8 0 4 4 0 018 0zM12 14a7 7 0 00-7 7h14a7 7 0 00-7-7z" /></svg>
            </div>
            <input type="text" value={formData.fullName} onChange={(e) => setFormData({ ...formData, fullName: e.target.value })} className="auth-input" placeholder={t.auth.signup.fullNamePlaceholder} required disabled={loading} autoComplete="name" />
          </div>
        </div>

        <div>
          <label className="block text-xs font-medium text-white/40 mb-1.5">{t.auth.signup.emailLabel}</label>
          <div className="relative">
            <div className="absolute inset-y-0 left-0 pl-3 flex items-center pointer-events-none">
              <svg className="w-4 h-4 text-white/25" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M16 12a4 4 0 10-8 0 4 4 0 008 0zm0 0v1.5a2.5 2.5 0 005 0V12a9 9 0 10-9 9m4.5-1.206a8.959 8.959 0 01-4.5 1.207" /></svg>
            </div>
            <input type="email" value={formData.email} onChange={(e) => setFormData({ ...formData, email: e.target.value })} className="auth-input" placeholder={t.auth.signup.emailPlaceholder} required disabled={loading} autoComplete="email" />
          </div>
        </div>

        <div>
          <label className="block text-xs font-medium text-white/40 mb-1.5">{t.auth.signup.passwordLabel}</label>
          <div className="relative">
            <div className="absolute inset-y-0 left-0 pl-3 flex items-center pointer-events-none">
              <svg className="w-4 h-4 text-white/25" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 15v2m-6 4h12a2 2 0 002-2v-6a2 2 0 00-2-2H6a2 2 0 00-2 2v6a2 2 0 002 2zm10-10V7a4 4 0 00-8 0v4h8z" /></svg>
            </div>
            <input type={showPassword ? 'text' : 'password'} value={formData.password} onChange={(e) => setFormData({ ...formData, password: e.target.value })} className="auth-input" style={{ paddingRight: '2.5rem' }} placeholder={t.auth.signup.passwordPlaceholder} minLength={6} required disabled={loading} autoComplete="new-password" data-lpignore="true" data-1p-ignore />
            <button type="button" onClick={() => setShowPassword(!showPassword)} className="absolute inset-y-0 right-0 pr-3 flex items-center text-white/25 hover:text-white/50 transition-colors" tabIndex={-1}>
              {showPassword ? (
                <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M13.875 18.825A10.05 10.05 0 0112 19c-4.478 0-8.268-2.943-9.543-7a9.97 9.97 0 011.563-3.029m5.858.908a3 3 0 114.243 4.243M9.878 9.878l4.242 4.242M9.88 9.88l-3.29-3.29m7.532 7.532l3.29 3.29M3 3l3.59 3.59m0 0A9.953 9.953 0 0112 5c4.478 0 8.268 2.943 9.543 7a10.025 10.025 0 01-4.132 5.411m0 0L21 21" /></svg>
              ) : (
                <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 12a3 3 0 11-6 0 3 3 0 016 0z" /><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M2.458 12C3.732 7.943 7.523 5 12 5c4.478 0 8.268 2.943 9.542 7-1.274 4.057-5.064 7-9.542 7-4.477 0-8.268-2.943-9.542-7z" /></svg>
              )}
            </button>
          </div>
          {/* Password strength bar */}
          {formData.password.length > 0 && (
            <div className="mt-2 space-y-1.5">
              <div className="flex gap-1">
                {[1, 2, 3, 4].map((level) => (
                  <div
                    key={level}
                    className={`h-1 flex-1 rounded-full transition-all duration-300 ${
                      level <= strength.score ? strength.color : 'bg-white/10'
                    }`}
                  />
                ))}
              </div>
              <div className="flex items-center justify-between">
                <p className={`text-[10px] font-medium ${
                  strength.score <= 1 ? 'text-red-400' : strength.score <= 2 ? 'text-amber-400' : strength.score <= 3 ? 'text-blue-400' : 'text-emerald-400'
                }`}>
                  {strength.label}
                </p>
                <div className="flex gap-3 text-[10px] text-white/30">
                  <span className={/[A-Z]/.test(formData.password) ? 'text-emerald-400' : ''}>A-Z</span>
                  <span className={/[a-z]/.test(formData.password) ? 'text-emerald-400' : ''}>a-z</span>
                  <span className={/[0-9]/.test(formData.password) ? 'text-emerald-400' : ''}>0-9</span>
                  <span className={/[^A-Za-z0-9]/.test(formData.password) ? 'text-emerald-400' : ''}>!@#</span>
                </div>
              </div>
            </div>
          )}
        </div>

        {/* Confirm password */}
        <div>
          <label className="block text-xs font-medium text-white/40 mb-1.5">{t.auth.signup.confirmPasswordLabel || 'Confirm Password'}</label>
          <div className="relative">
            <div className="absolute inset-y-0 left-0 pl-3 flex items-center pointer-events-none">
              <svg className="w-4 h-4 text-white/25" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 12l2 2 4-4m5.618-4.016A11.955 11.955 0 0112 2.944a11.955 11.955 0 01-8.618 3.04A12.02 12.02 0 003 9c0 5.591 3.824 10.29 9 11.622 5.176-1.332 9-6.03 9-11.622 0-1.042-.133-2.052-.382-3.016z" /></svg>
            </div>
            <input type={showConfirmPassword ? 'text' : 'password'} value={formData.confirmPassword} onChange={(e) => setFormData({ ...formData, confirmPassword: e.target.value })} className={`auth-input ${formData.confirmPassword.length > 0 && !passwordsMatch ? 'border-red-500/50' : ''}`} style={{ paddingRight: '2.5rem' }} placeholder={t.auth.signup.confirmPasswordPlaceholder || 'Re-enter your password'} required disabled={loading} autoComplete="new-password" data-lpignore="true" data-1p-ignore />
            <button type="button" onClick={() => setShowConfirmPassword(!showConfirmPassword)} className="absolute inset-y-0 right-0 pr-3 flex items-center text-white/25 hover:text-white/50 transition-colors" tabIndex={-1}>
              {showConfirmPassword ? (
                <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M13.875 18.825A10.05 10.05 0 0112 19c-4.478 0-8.268-2.943-9.543-7a9.97 9.97 0 011.563-3.029m5.858.908a3 3 0 114.243 4.243M9.878 9.878l4.242 4.242M9.88 9.88l-3.29-3.29m7.532 7.532l3.29 3.29M3 3l3.59 3.59m0 0A9.953 9.953 0 0112 5c4.478 0 8.268 2.943 9.543 7a10.025 10.025 0 01-4.132 5.411m0 0L21 21" /></svg>
              ) : (
                <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 12a3 3 0 11-6 0 3 3 0 016 0z" /><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M2.458 12C3.732 7.943 7.523 5 12 5c4.478 0 8.268 2.943 9.542 7-1.274 4.057-5.064 7-9.542 7-4.477 0-8.268-2.943-9.542-7z" /></svg>
              )}
            </button>
          </div>
          {formData.confirmPassword.length > 0 && !passwordsMatch && (
            <p className="text-[10px] text-red-400 mt-1">{t.auth.signup.errorPasswordMismatch || 'Passwords do not match'}</p>
          )}
        </div>

        <button type="submit" disabled={loading || !passwordsMatch} className="auth-submit-btn flex items-center justify-center gap-2">
          {loading ? (
            <><svg className="animate-spin h-4 w-4" viewBox="0 0 24 24"><circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" fill="none" /><path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z" /></svg>{t.auth.signup.submitting}</>
          ) : t.auth.signup.submitButton}
        </button>

        <p className="text-[10px] text-center text-white/20 leading-relaxed">
          {t.auth.signup.termsText}{" "}
          <a href="https://callengo.com/terms" target="_blank" rel="noopener noreferrer" className="underline hover:text-white/40 transition-colors">{t.auth.signup.termsOfService}</a>{" "}
          {t.auth.signup.and}{" "}
          <a href="https://callengo.com/privacy" target="_blank" rel="noopener noreferrer" className="underline hover:text-white/40 transition-colors">{t.auth.signup.privacyPolicy}</a>
        </p>
      </form>

      {/* Divider */}
      <div className="flex items-center my-5">
        <div className="flex-1 border-t border-white/10" />
        <span className="px-4 text-xs text-white/25">{t.auth.signup.or}</span>
        <div className="flex-1 border-t border-white/10" />
      </div>

      {/* Social auth at bottom */}
      <SocialAuthButtons mode="signup" />

      <p className="text-center text-xs text-white/30 mt-4">
        {t.auth.signup.hasAccount}{' '}
        <Link href="/auth/login" className="text-white/70 font-semibold hover:text-white transition-colors">{t.auth.signup.signIn}</Link>
      </p>
    </div>
  );
}
