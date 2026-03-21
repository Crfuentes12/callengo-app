// app/onboarding/page.tsx
'use client';

import { useEffect, useState, useRef } from 'react';
import { useRouter } from 'next/navigation';
import { createClient } from '@/lib/supabase/client';
import { useAuth } from '@/contexts/AuthContext';
import { useLanguage } from '@/i18n';
import { onboardingEvents } from '@/lib/analytics';
import { phOnboardingEvents } from '@/lib/posthog';

type OnboardingStep =
  | 'form'
  | 'creating_company'
  | 'setting_up_account'
  | 'analyzing_website'
  | 'showing_results'
  | 'complete'
  | 'error';

interface ScrapedResults {
  summary: string;
  favicon_url: string | null;
  data: {
    title: string;
    description: string;
    headings: string[];
  };
}

export default function OnboardingPage() {
  const router = useRouter();
  const { user } = useAuth();
  const { t } = useLanguage();
  const supabase = createClient();
  const onboardingStartedRef = useRef(false);
  const setupInProgressRef = useRef(false);

  const [step, setStep] = useState<OnboardingStep>('form');
  const [progress, setProgress] = useState(0);
  const [error, setError] = useState('');
  const [scrapedData, setScrapedData] = useState<ScrapedResults | null>(null);
  const [companyId, setCompanyId] = useState<string | null>(null);
  const [formData, setFormData] = useState({
    companyName: '',
    companyWebsite: '',
  });

  // Editable scraped data fields
  const [editableCompanyName, setEditableCompanyName] = useState('');
  const [editableDescription, setEditableDescription] = useState('');
  const [editableSummary, setEditableSummary] = useState('');
  const [savingResults, setSavingResults] = useState(false);

  useEffect(() => {
    checkOnboardingStatus();
  }, [user]);

  const checkOnboardingStatus = async () => {
    if (!user) {
      router.push('/auth/login');
      return;
    }

    // Don't redirect if onboarding has already started (prevents auto-close bug)
    if (onboardingStartedRef.current) return;

    // Check if user already has a company
    const { data: existingUser } = await supabase
      .from('users')
      .select('company_id')
      .eq('id', user.id)
      .single();

    if (existingUser?.company_id) {
      // User already has company - go to home
      router.push('/home');
    }
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (setupInProgressRef.current) return; // Prevent double-submit
    setError('');

    if (!formData.companyName) {
      setError(t.common.required);
      return;
    }

    setupInProgressRef.current = true;
    onboardingStartedRef.current = true;
    onboardingEvents.started();
    phOnboardingEvents.started();
    await setupAccount();
  };

  const setupAccount = async () => {
    try {
      if (!user) {
        router.push('/auth/login');
        return;
      }

      const fullName = user.user_metadata?.full_name || '';

      // 1. Check if user already has a company (prevent duplicates)
      const { data: existingUserRecord } = await supabase
        .from('users')
        .select('company_id')
        .eq('id', user.id)
        .maybeSingle();

      if (existingUserRecord?.company_id) {
        router.push('/home');
        return;
      }

      // 2. Create company
      setStep('creating_company');
      setProgress(30);

      const { data: companyData, error: companyError } = await supabase
        .from('companies')
        .insert({
          name: formData.companyName,
          website: formData.companyWebsite || null,
        })
        .select()
        .single();

      if (companyError) {
        console.error('Company creation error:', companyError);
        throw new Error(`Failed to create company: ${companyError.message}`);
      }

      setCompanyId(companyData.id);

      setProgress(50);
      await new Promise(resolve => setTimeout(resolve, 500));

      // 3. Create user record
      setStep('setting_up_account');
      setProgress(60);

      const { error: userError } = await supabase
        .from('users')
        .insert({
          id: user.id,
          company_id: companyData.id,
          email: user.email!,
          full_name: fullName,
          role: 'owner',
        });

      if (userError) {
        console.error('User record creation error:', userError);
        throw new Error(`Failed to create user record: ${userError.message}`);
      }

      setProgress(70);
      await new Promise(resolve => setTimeout(resolve, 500));

      // 4. Create company settings
      const { error: settingsError } = await supabase
        .from('company_settings')
        .insert({
          company_id: companyData.id,
        });

      if (settingsError) {
        console.error('Settings creation error:', settingsError);
      }

      setProgress(75);
      await new Promise(resolve => setTimeout(resolve, 500));

      // 5. Assign Free plan to new user
      try {
        const planRes = await fetch('/api/billing/ensure-free-plan', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ company_id: companyData.id }),
        });
        if (!planRes.ok) {
          console.error('Failed to assign free plan:', await planRes.text());
        }
      } catch (planError) {
        console.error('Error assigning free plan:', planError);
      }

      setProgress(80);
      await new Promise(resolve => setTimeout(resolve, 500));

      // 6. Trigger website scraping if URL provided
      if (formData.companyWebsite) {
        setStep('analyzing_website');
        setProgress(85);

        try {
          const scrapeResponse = await fetch('/api/company/scrape', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({
              company_id: companyData.id,
              website: formData.companyWebsite,
              auto_save: true,
            }),
          });

          if (scrapeResponse.ok) {
            const scrapeData = await scrapeResponse.json();
            setScrapedData(scrapeData);
            // Pre-fill editable fields
            setEditableCompanyName(scrapeData.name || formData.companyName);
            setEditableDescription(scrapeData.data.description || '');
            setEditableSummary(scrapeData.summary || '');
            setProgress(90);
            setStep('showing_results');
            onboardingEvents.stepCompleted('website_analysis', 1);
            phOnboardingEvents.stepCompleted('website_analysis', 1);
            // DO NOT auto-advance — wait for user to review and click Continue
            return;
          }
        } catch (scrapeError) {
          console.error('Scrape error:', scrapeError);
        }
      }

      // No website or scraping failed — go directly to home
      setProgress(100);
      setStep('complete');
      onboardingEvents.stepCompleted('company_setup', 1);
      phOnboardingEvents.stepCompleted('company_setup', 1);
      setTimeout(() => {
        router.push('/home');
        router.refresh();
      }, 1500);

    } catch (err: unknown) {
      console.error('Onboarding error:', err);
      setError(err instanceof Error ? err.message : t.common.somethingWentWrong);
      setStep('error');
    }
  };

  const handleContinueFromResults = async () => {
    if (!companyId) return;
    setSavingResults(true);

    try {
      // Save any edits to the company
      await fetch('/api/company/update', {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          name: editableCompanyName || formData.companyName,
          description: editableDescription || undefined,
        }),
      });
    } catch (err) {
      console.error('Error saving company edits:', err);
    }

    setSavingResults(false);
    setProgress(100);
    setStep('complete');

    onboardingEvents.stepCompleted('company_review', 1);
    phOnboardingEvents.stepCompleted('company_review', 1);

    setTimeout(() => {
      router.push('/home');
      router.refresh();
    }, 1500);
  };

  const getStepMessage = () => {
    switch (step) {
      case 'creating_company':
        return t.onboarding.steps.creatingCompany;
      case 'setting_up_account':
        return t.onboarding.steps.settingUpAccount;
      case 'analyzing_website':
        return t.onboarding.steps.analyzingWebsite;
      case 'showing_results':
        return t.onboarding.steps.showingResults;
      case 'complete':
        return t.onboarding.steps.complete;
      case 'error':
        return t.onboarding.steps.error;
      default:
        return '';
    }
  };

  const getStepIcon = () => {
    if (step === 'error') {
      return (
        <div className="w-20 h-20 rounded-full bg-red-100 flex items-center justify-center">
          <svg className="w-10 h-10 text-red-600" fill="none" viewBox="0 0 24 24" stroke="currentColor">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 8v4m0 4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
          </svg>
        </div>
      );
    }

    if (step === 'complete') {
      return (
        <div className="w-20 h-20 rounded-full bg-emerald-100 flex items-center justify-center">
          <svg className="w-10 h-10 text-emerald-600" fill="none" viewBox="0 0 24 24" stroke="currentColor">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 13l4 4L19 7" />
          </svg>
        </div>
      );
    }

    if (step === 'showing_results') {
      return (
        <div className="w-20 h-20 rounded-full bg-gradient-to-br from-emerald-400 via-emerald-500 to-teal-600 flex items-center justify-center shadow-lg">
          <svg className="w-10 h-10 text-white" fill="none" viewBox="0 0 24 24" stroke="currentColor">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 13l4 4L19 7" />
          </svg>
        </div>
      );
    }

    return (
      <div className="w-20 h-20 rounded-full gradient-bg flex items-center justify-center shadow-md animate-pulse">
        <svg className="w-10 h-10 text-white animate-spin" fill="none" viewBox="0 0 24 24">
          <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4"></circle>
          <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"></path>
        </svg>
      </div>
    );
  };

  const isProcessing = step !== 'form' && step !== 'error' && step !== 'showing_results';

  // ============ FORM STEP ============
  if (step === 'form') {
    return (
      <div className="min-h-screen bg-[var(--surface-base)] flex items-center justify-center p-4 relative overflow-hidden">
        {/* Blurred background overlay to simulate being inside the app */}
        <div className="absolute inset-0 bg-gradient-to-br from-[var(--color-neutral-100)] via-[var(--surface-base)] to-[var(--color-neutral-100)]" />
        <div className="absolute inset-0 backdrop-blur-sm bg-black/5" />

        <div className="w-full max-w-md relative z-10">
          <div className="text-center mb-8">
            <div className="inline-flex items-center justify-center w-20 h-20 rounded-3xl gradient-bg mb-6 shadow-md">
              <svg className="w-10 h-10 text-white" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 21V5a2 2 0 00-2-2H7a2 2 0 00-2 2v16m14 0h2m-2 0h-5m-9 0H3m2 0h5M9 7h1m-1 4h1m4-4h1m-1 4h1m-5 10v-5a1 1 0 011-1h2a1 1 0 011 1v5m-4 0h4" />
              </svg>
            </div>
            <h1 className="text-4xl font-bold text-[var(--color-ink)] mb-3 tracking-tight">{t.onboarding.form.title}</h1>
            <p className="text-[var(--color-neutral-500)] text-lg">{t.onboarding.form.companyNamePlaceholder}</p>
          </div>

          <div className="bg-white backdrop-blur-xl rounded-3xl shadow-2xl p-8 border border-[var(--border-default)]">
            {error && (
              <div className="mb-6 p-4 bg-red-50 border border-red-200 rounded-xl text-red-700 text-sm flex items-start gap-3">
                <svg className="w-5 h-5 shrink-0 mt-0.5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 8v4m0 4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
                </svg>
                <span>{error}</span>
              </div>
            )}

            <form onSubmit={handleSubmit} className="space-y-5">
              <div>
                <label className="block text-sm font-semibold text-[var(--color-neutral-700)] mb-2">
                  {t.onboarding.form.companyNameLabel} <span className="text-red-500">*</span>
                </label>
                <div className="relative">
                  <div className="absolute inset-y-0 left-0 pl-4 flex items-center pointer-events-none">
                    <svg className="w-5 h-5 text-[var(--color-neutral-400)]" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 21V5a2 2 0 00-2-2H7a2 2 0 00-2 2v16m14 0h2m-2 0h-5m-9 0H3m2 0h5M9 7h1m-1 4h1m4-4h1m-1 4h1m-5 10v-5a1 1 0 011-1h2a1 1 0 011 1v5m-4 0h4" />
                    </svg>
                  </div>
                  <input
                    type="text"
                    value={formData.companyName}
                    onChange={(e) => setFormData({ ...formData, companyName: e.target.value })}
                    className="w-full pl-12 pr-4 py-3.5 border border-[var(--border-strong)] rounded-xl focus:ring-2 focus:ring-[var(--color-primary)] focus:border-transparent outline-none transition-all bg-white text-[var(--color-ink)] placeholder-[var(--color-neutral-400)]"
                    placeholder={t.onboarding.form.companyNamePlaceholder}
                    required
                  />
                </div>
              </div>

              <div>
                <label className="block text-sm font-semibold text-[var(--color-neutral-700)] mb-2">
                  {t.onboarding.form.websiteLabel} <span className="text-[var(--color-neutral-400)]">({t.common.optional})</span>
                </label>
                <div className="relative">
                  <div className="absolute inset-y-0 left-0 pl-4 flex items-center pointer-events-none">
                    <svg className="w-5 h-5 text-[var(--color-neutral-400)]" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M21 12a9 9 0 01-9 9m9-9a9 9 0 00-9-9m9 9H3m9 9a9 9 0 01-9-9m9 9c1.657 0 3-4.03 3-9s-1.343-9-3-9m0 18c-1.657 0-3-4.03-3-9s1.343-9 3-9m-9 9a9 9 0 019-9" />
                    </svg>
                  </div>
                  <input
                    type="text"
                    value={formData.companyWebsite}
                    onChange={(e) => setFormData({ ...formData, companyWebsite: e.target.value })}
                    className="w-full pl-12 pr-4 py-3.5 border border-[var(--border-strong)] rounded-xl focus:ring-2 focus:ring-[var(--color-primary)] focus:border-transparent outline-none transition-all bg-white text-[var(--color-ink)] placeholder-[var(--color-neutral-400)]"
                    placeholder={t.onboarding.form.websitePlaceholder}
                  />
                </div>
                <p className="text-xs text-[var(--color-neutral-500)] mt-2 flex items-start gap-1.5">
                  <svg className="w-4 h-4 shrink-0 mt-0.5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9.663 17h4.673M12 3v1m6.364 1.636l-.707.707M21 12h-1M4 12H3m3.343-5.657l-.707-.707m2.828 9.9a5 5 0 117.072 0l-.548.547A3.374 3.374 0 0014 18.469V19a2 2 0 11-4 0v-.531c0-.895-.356-1.754-.988-2.386l-.548-.547z" />
                  </svg>
                  {t.settings.company.websiteHint}
                </p>
              </div>

              <button
                type="submit"
                className="w-full py-4 gradient-bg text-white font-semibold rounded-xl hover:opacity-90 transition-all shadow-md transform hover:-translate-y-0.5"
              >
                {t.onboarding.form.submitButton}
              </button>
            </form>
          </div>
        </div>
      </div>
    );
  }

  // ============ SHOWING RESULTS STEP — Paused, editable ============
  if (step === 'showing_results' && scrapedData) {
    // Combine description + AI summary into a single unified description
    const combinedDescription = editableSummary
      ? (editableDescription ? `${editableDescription}\n\n${editableSummary}` : editableSummary)
      : editableDescription;

    return (
      <div className="min-h-screen bg-[var(--surface-base)] flex items-center justify-center p-4 relative overflow-hidden">
        {/* Blurred background overlay */}
        <div className="absolute inset-0 bg-gradient-to-br from-[var(--color-neutral-100)] via-[var(--surface-base)] to-[var(--color-neutral-100)]" />
        <div className="absolute inset-0 backdrop-blur-sm bg-black/5" />

        <div className="w-full max-w-2xl relative z-10 animate-fadeIn">
          {/* Header */}
          <div className="text-center mb-6">
            <div className="flex justify-center mb-4">
              <div className="w-16 h-16 rounded-full bg-gradient-to-br from-emerald-400 to-teal-500 flex items-center justify-center shadow-lg">
                <svg className="w-8 h-8 text-white" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 13l4 4L19 7" />
                </svg>
              </div>
            </div>
            <h2 className="text-2xl font-bold text-[var(--color-ink)] mb-2">{t.onboarding.results.title}</h2>
            <p className="text-[var(--color-neutral-500)] text-sm">{t.onboarding.results.subtitle}</p>
          </div>

          {/* Unified Company Card */}
          <div className="bg-white backdrop-blur-xl rounded-2xl shadow-2xl border border-[var(--border-default)] overflow-hidden">
            {/* Company Header with logo */}
            <div className="p-6 flex items-start gap-4 border-b border-[var(--border-default)]">
              {scrapedData.favicon_url ? (
                <img
                  src={scrapedData.favicon_url}
                  alt="Company logo"
                  className="w-14 h-14 rounded-xl shadow-sm border border-[var(--border-default)] object-cover flex-shrink-0"
                  onError={(e) => {
                    e.currentTarget.style.display = 'none';
                  }}
                />
              ) : (
                <div className="w-14 h-14 rounded-xl gradient-bg flex items-center justify-center flex-shrink-0 shadow-sm">
                  <span className="text-2xl font-bold text-white">{formData.companyName.charAt(0).toUpperCase()}</span>
                </div>
              )}
              <div className="flex-1 min-w-0">
                <label className="block text-[11px] font-bold text-[var(--color-neutral-500)] uppercase mb-1">
                  {t.onboarding.results.companyName}
                </label>
                <input
                  type="text"
                  value={editableCompanyName}
                  onChange={(e) => setEditableCompanyName(e.target.value)}
                  className="w-full px-3 py-2 bg-[var(--color-neutral-50)] border border-[var(--border-default)] rounded-lg text-[var(--color-ink)] text-base font-semibold focus:ring-2 focus:ring-[var(--color-primary)] outline-none transition-all"
                />
              </div>
            </div>

            {/* Unified About section — merged description + AI summary */}
            <div className="px-6 py-5">
              <label className="block text-[11px] font-bold text-[var(--color-neutral-500)] uppercase mb-2 flex items-center gap-1.5">
                <svg className="w-3.5 h-3.5 text-[var(--color-primary)]" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9.813 15.904L9 18.75l-.813-2.846a4.5 4.5 0 00-3.09-3.09L2.25 12l2.846-.813a4.5 4.5 0 003.09-3.09L9 5.25l.813 2.846a4.5 4.5 0 003.09 3.09L15.75 12l-2.846.813a4.5 4.5 0 00-3.09 3.09z" />
                </svg>
                {t.onboarding.results.description}
              </label>
              <textarea
                value={combinedDescription}
                onChange={(e) => {
                  // Store everything in editableDescription, clear AI summary
                  setEditableDescription(e.target.value);
                  setEditableSummary('');
                }}
                rows={4}
                className="w-full px-3 py-2.5 bg-[var(--color-neutral-50)] border border-[var(--border-default)] rounded-lg text-[var(--color-ink)] text-sm leading-relaxed focus:ring-2 focus:ring-[var(--color-primary)] outline-none transition-all resize-none"
                placeholder={t.onboarding.results.descriptionPlaceholder}
              />
            </div>

            {/* Key Topics */}
            {scrapedData.data.headings && scrapedData.data.headings.length > 0 && (
              <div className="px-6 pb-5">
                <p className="text-[11px] font-bold text-[var(--color-neutral-500)] uppercase mb-2">{t.onboarding.results.keyTopics}</p>
                <div className="flex flex-wrap gap-2">
                  {scrapedData.data.headings.slice(0, 6).map((heading, index) => (
                    <span
                      key={index}
                      className="px-3 py-1 bg-[var(--color-primary-50)] border border-[var(--color-primary-100)] rounded-full text-xs font-medium text-[var(--color-primary-700)]"
                    >
                      {heading.length > 30 ? heading.substring(0, 30) + '...' : heading}
                    </span>
                  ))}
                </div>
              </div>
            )}

            {/* Continue Button */}
            <div className="px-6 py-5 border-t border-[var(--border-default)]">
              <button
                onClick={handleContinueFromResults}
                disabled={savingResults}
                className="w-full py-4 gradient-bg text-white font-semibold rounded-xl hover:opacity-90 transition-all shadow-md transform hover:-translate-y-0.5 flex items-center justify-center gap-2 disabled:opacity-50"
              >
                {savingResults ? (
                  <>
                    <svg className="w-5 h-5 animate-spin" fill="none" viewBox="0 0 24 24">
                      <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4"></circle>
                      <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"></path>
                    </svg>
                    {t.common.loading}
                  </>
                ) : (
                  <>
                    {t.onboarding.results.continueButton}
                    <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                      <path strokeLinecap="round" strokeLinejoin="round" d="M13 7l5 5m0 0l-5 5m5-5H6" />
                    </svg>
                  </>
                )}
              </button>
              <p className="text-center text-xs text-[var(--color-neutral-400)] mt-3">
                {t.onboarding.results.editHint}
              </p>
            </div>
          </div>
        </div>

        <style jsx>{`
          @keyframes fadeIn {
            from { opacity: 0; transform: translateY(10px); }
            to { opacity: 1; transform: translateY(0); }
          }
          .animate-fadeIn {
            animation: fadeIn 0.5s ease-out forwards;
          }
        `}</style>
      </div>
    );
  }

  // ============ PROCESSING / COMPLETE / ERROR STEPS ============
  return (
    <div className="min-h-screen bg-[var(--surface-base)] flex items-center justify-center p-4 relative overflow-hidden">
      {/* Blurred background overlay */}
      <div className="absolute inset-0 bg-gradient-to-br from-[var(--color-neutral-100)] via-[var(--surface-base)] to-[var(--color-neutral-100)]" />
      <div className="absolute inset-0 backdrop-blur-sm bg-black/5" />

      <div className="w-full max-w-md relative z-10">
        <div className="bg-white backdrop-blur-xl rounded-3xl shadow-2xl p-12 border border-[var(--border-default)]">
          <div className="text-center">
            {/* Icon */}
            <div className="flex justify-center mb-8">
              {getStepIcon()}
            </div>

            {/* Message */}
            <h2 className="text-2xl font-bold text-[var(--color-ink)] mb-3">
              {step === 'error' ? t.onboarding.steps.error : t.onboarding.steps.settingUpAccount}
            </h2>

            <p className="text-[var(--color-neutral-600)] mb-8">
              {getStepMessage()}
            </p>

            {/* Progress bar */}
            {isProcessing && (
              <div className="mb-8">
                <div className="w-full bg-[var(--color-neutral-200)] rounded-full h-3 overflow-hidden">
                  <div
                    className="h-full gradient-bg transition-all duration-500 ease-out"
                    style={{ width: `${progress}%` }}
                  ></div>
                </div>
                <p className="text-sm text-[var(--color-neutral-500)] mt-2">{progress}%</p>
              </div>
            )}

            {/* Error message */}
            {step === 'error' && (
              <div className="space-y-4">
                <div className="p-4 bg-red-50 border border-red-200 rounded-xl text-red-700 text-sm text-left">
                  {error}
                </div>
                <div className="flex gap-3">
                  <button
                    onClick={() => router.push('/auth/login')}
                    className="flex-1 px-4 py-3 border border-[var(--border-strong)] text-[var(--color-neutral-700)] rounded-lg hover:bg-[var(--surface-hover)] font-medium"
                  >
                    {t.auth.forgotPassword.backToSignIn}
                  </button>
                  <button
                    onClick={() => {
                      setStep('form');
                      setError('');
                      setProgress(0);
                    }}
                    className="flex-1 px-4 py-3 gradient-bg text-white rounded-lg hover:opacity-90 font-medium"
                  >
                    {t.common.tryAgain}
                  </button>
                </div>
              </div>
            )}

            {/* Steps list */}
            {isProcessing && step !== 'complete' && (
              <div className="space-y-3 text-left">
                <div className={`flex items-center gap-3 p-3 rounded-lg transition-all ${
                  ['creating_company', 'setting_up_account', 'analyzing_website', 'complete'].includes(step)
                    ? 'bg-emerald-50 border border-emerald-200'
                    : 'bg-[var(--color-neutral-50)] border border-[var(--border-default)]'
                }`}>
                  <div className={`w-6 h-6 rounded-full flex items-center justify-center shrink-0 ${
                    ['creating_company', 'setting_up_account', 'analyzing_website', 'complete'].includes(step)
                      ? 'bg-emerald-500'
                      : 'bg-[var(--color-neutral-300)]'
                  }`}>
                    <svg className="w-3.5 h-3.5 text-white" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={3} d="M5 13l4 4L19 7" />
                    </svg>
                  </div>
                  <span className={`text-sm font-medium ${
                    ['creating_company', 'setting_up_account', 'analyzing_website', 'complete'].includes(step)
                      ? 'text-emerald-900'
                      : 'text-[var(--color-neutral-600)]'
                  }`}>
                    {t.onboarding.steps.creatingCompany}
                  </span>
                </div>

                <div className={`flex items-center gap-3 p-3 rounded-lg transition-all ${
                  ['setting_up_account', 'analyzing_website', 'complete'].includes(step)
                    ? 'bg-emerald-50 border border-emerald-200'
                    : 'bg-[var(--color-neutral-50)] border border-[var(--border-default)]'
                }`}>
                  <div className={`w-6 h-6 rounded-full flex items-center justify-center shrink-0 ${
                    ['setting_up_account', 'analyzing_website', 'complete'].includes(step)
                      ? 'bg-emerald-500'
                      : 'bg-[var(--color-neutral-300)]'
                  }`}>
                    <svg className="w-3.5 h-3.5 text-white" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={3} d="M5 13l4 4L19 7" />
                    </svg>
                  </div>
                  <span className={`text-sm font-medium ${
                    ['setting_up_account', 'analyzing_website', 'complete'].includes(step)
                      ? 'text-emerald-900'
                      : 'text-[var(--color-neutral-600)]'
                  }`}>
                    {t.onboarding.steps.settingUpAccount}
                  </span>
                </div>

                {formData.companyWebsite && (
                  <div className={`flex items-center gap-3 p-3 rounded-lg transition-all ${
                    ['analyzing_website', 'complete'].includes(step)
                      ? 'bg-emerald-50 border border-emerald-200'
                      : 'bg-[var(--color-neutral-50)] border border-[var(--border-default)]'
                  }`}>
                    <div className={`w-6 h-6 rounded-full flex items-center justify-center shrink-0 ${
                      ['analyzing_website', 'complete'].includes(step)
                        ? 'bg-emerald-500'
                        : 'bg-[var(--color-neutral-300)]'
                    }`}>
                      <svg className="w-3.5 h-3.5 text-white" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={3} d="M5 13l4 4L19 7" />
                      </svg>
                    </div>
                    <span className={`text-sm font-medium ${
                      ['analyzing_website', 'complete'].includes(step)
                        ? 'text-emerald-900'
                        : 'text-[var(--color-neutral-600)]'
                    }`}>
                      {t.onboarding.steps.analyzingWebsite}
                    </span>
                  </div>
                )}
              </div>
            )}
          </div>
        </div>

        {isProcessing && (
          <p className="text-center text-[var(--color-neutral-500)] text-sm mt-8">
            {t.common.loading}
          </p>
        )}
      </div>
    </div>
  );
}
