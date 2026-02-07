// app/onboarding/page.tsx
'use client';

import { useEffect, useState } from 'react';
import { useRouter } from 'next/navigation';
import { createClient } from '@/lib/supabase/client';
import { useAuth } from '@/contexts/AuthContext';
import PainSelection from '@/components/onboarding/PainSelection';
import AgentTestExperience from '@/components/onboarding/AgentTestExperience';

type OnboardingStep =
  | 'form'
  | 'creating_company'
  | 'setting_up_account'
  | 'analyzing_website'
  | 'showing_results'
  | 'pain_selection'
  | 'agent_test'
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

interface Pain {
  id: string;
  title: string;
  description: string;
  emoji: string;
  color: string;
  gradient: string;
  value: string;
  agentSlug: string;
}

export default function OnboardingPage() {
  const router = useRouter();
  const { user } = useAuth();
  const supabase = createClient();

  const [step, setStep] = useState<OnboardingStep>('form');
  const [progress, setProgress] = useState(0);
  const [error, setError] = useState('');
  const [scrapedData, setScrapedData] = useState<ScrapedResults | null>(null);
  const [selectedPain, setSelectedPain] = useState<Pain | null>(null);
  const [companyId, setCompanyId] = useState<string | null>(null);
  const [formData, setFormData] = useState({
    companyName: '',
    companyWebsite: '',
  });

  useEffect(() => {
    checkOnboardingStatus();
  }, [user]);

  const checkOnboardingStatus = async () => {
    if (!user) {
      router.push('/auth/login');
      return;
    }

    // Check if user already has a company
    const { data: existingUser } = await supabase
      .from('users')
      .select('company_id')
      .eq('id', user.id)
      .single();

    if (existingUser?.company_id) {
      // User already has company - go to dashboard
      router.push('/dashboard');
    }
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError('');

    if (!formData.companyName) {
      setError('Company name is required');
      return;
    }

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
        // User already has a company, redirect to dashboard
        router.push('/dashboard');
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

      // Store company ID for later use
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
        // Non-critical, continue
      }

      setProgress(75);
      await new Promise(resolve => setTimeout(resolve, 500));

      // 5. Assign Free plan to new user (server-side API to bypass RLS)
      try {
        await fetch('/api/billing/ensure-free-plan', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ company_id: companyData.id }),
        });
      } catch (planError) {
        console.error('Error assigning free plan:', planError);
        // Non-critical, continue
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
              auto_save: true, // Auto-save for onboarding
            }),
          });

          if (scrapeResponse.ok) {
            const scrapeData = await scrapeResponse.json();
            setScrapedData(scrapeData);
            setProgress(88);
            setStep('showing_results');
            // Show the wow effect for 4 seconds so user can see the results
            await new Promise(resolve => setTimeout(resolve, 4000));
          }
        } catch (scrapeError) {
          // Non-critical, continue without showing results
          console.error('Scrape error:', scrapeError);
        }
      }

      // 7. Move to pain selection
      setProgress(90);
      setStep('pain_selection');

    } catch (err: any) {
      console.error('Onboarding error:', err);
      setError(err.message || 'Failed to set up your account');
      setStep('error');
    }
  };

  const handlePainSelection = (pain: any) => {
    setSelectedPain(pain);
    setProgress(95);
    setStep('agent_test');
  };

  const handleSkipPain = () => {
    setProgress(100);
    setStep('complete');
    setTimeout(() => {
      router.push('/dashboard');
      router.refresh();
    }, 1500);
  };

  const handleAgentTestComplete = async (callData: any) => {
    setProgress(100);
    setStep('complete');
    await new Promise(resolve => setTimeout(resolve, 1500));
    router.push('/dashboard');
    router.refresh();
  };

  const handleSkipAgentTest = () => {
    setProgress(100);
    setStep('complete');
    setTimeout(() => {
      router.push('/dashboard');
      router.refresh();
    }, 1500);
  };

  const getStepMessage = () => {
    switch (step) {
      case 'creating_company':
        return 'Creating your company profile...';
      case 'setting_up_account':
        return 'Setting up your account...';
      case 'analyzing_website':
        return 'Analyzing your website to personalize your experience...';
      case 'showing_results':
        return 'Here\'s what we found about your business!';
      case 'complete':
        return 'All set! Redirecting to dashboard...';
      case 'error':
        return 'Something went wrong';
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

    if (step === 'showing_results' && scrapedData?.favicon_url) {
      return (
        <div className="w-20 h-20 rounded-full bg-gradient-to-br from-emerald-400 via-emerald-500 to-teal-600 flex items-center justify-center shadow-2xl shadow-emerald-500/50 animate-bounce">
          <img
            src={scrapedData.favicon_url}
            alt="Company favicon"
            className="w-10 h-10 rounded"
            onError={(e) => {
              e.currentTarget.style.display = 'none';
            }}
          />
        </div>
      );
    }

    return (
      <div className="w-20 h-20 rounded-full bg-gradient-to-br from-blue-500 via-blue-600 to-indigo-600 flex items-center justify-center shadow-2xl shadow-blue-500/50 animate-pulse">
        <svg className="w-10 h-10 text-white animate-spin" fill="none" viewBox="0 0 24 24">
          <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4"></circle>
          <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"></path>
        </svg>
      </div>
    );
  };

  const isProcessing = step !== 'form' && step !== 'error' && step !== 'pain_selection' && step !== 'agent_test';

  if (step === 'form') {
    return (
      <div className="min-h-screen bg-gradient-to-br from-slate-900 via-blue-900 to-indigo-900 flex items-center justify-center p-4 relative overflow-hidden">
        {/* Animated background elements */}
        <div className="absolute inset-0 overflow-hidden pointer-events-none">
          <div className="absolute -top-40 -right-40 w-80 h-80 bg-blue-500 rounded-full mix-blend-multiply filter blur-xl opacity-20 animate-blob"></div>
          <div className="absolute -bottom-40 -left-40 w-80 h-80 bg-indigo-500 rounded-full mix-blend-multiply filter blur-xl opacity-20 animate-blob animation-delay-2000"></div>
          <div className="absolute top-1/2 left-1/2 transform -translate-x-1/2 -translate-y-1/2 w-80 h-80 bg-purple-500 rounded-full mix-blend-multiply filter blur-xl opacity-20 animate-blob animation-delay-4000"></div>
        </div>

        <div className="w-full max-w-md relative z-10">
          <div className="text-center mb-8">
            <div className="inline-flex items-center justify-center w-20 h-20 rounded-3xl bg-gradient-to-br from-blue-500 via-blue-600 to-indigo-600 mb-6 shadow-2xl shadow-blue-500/50">
              <svg className="w-10 h-10 text-white" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 21V5a2 2 0 00-2-2H7a2 2 0 00-2 2v16m14 0h2m-2 0h-5m-9 0H3m2 0h5M9 7h1m-1 4h1m4-4h1m-1 4h1m-5 10v-5a1 1 0 011-1h2a1 1 0 011 1v5m-4 0h4" />
              </svg>
            </div>
            <h1 className="text-4xl font-bold text-white mb-3 tracking-tight">Tell us about your company</h1>
            <p className="text-blue-200 text-lg">We'll personalize your experience</p>
          </div>

          <div className="bg-white/95 backdrop-blur-xl rounded-3xl shadow-2xl p-8 border border-white/20">
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
                <label className="block text-sm font-semibold text-slate-700 mb-2">
                  Company Name <span className="text-red-500">*</span>
                </label>
                <div className="relative">
                  <div className="absolute inset-y-0 left-0 pl-4 flex items-center pointer-events-none">
                    <svg className="w-5 h-5 text-slate-400" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 21V5a2 2 0 00-2-2H7a2 2 0 00-2 2v16m14 0h2m-2 0h-5m-9 0H3m2 0h5M9 7h1m-1 4h1m4-4h1m-1 4h1m-5 10v-5a1 1 0 011-1h2a1 1 0 011 1v5m-4 0h4" />
                    </svg>
                  </div>
                  <input
                    type="text"
                    value={formData.companyName}
                    onChange={(e) => setFormData({ ...formData, companyName: e.target.value })}
                    className="w-full pl-12 pr-4 py-3.5 border border-slate-300 rounded-xl focus:ring-2 focus:ring-blue-500 focus:border-transparent outline-none transition-all bg-white text-slate-900 placeholder-slate-400"
                    placeholder="Acme Corporation"
                    required
                  />
                </div>
              </div>

              <div>
                <label className="block text-sm font-semibold text-slate-700 mb-2">
                  Company Website <span className="text-slate-400">(optional)</span>
                </label>
                <div className="relative">
                  <div className="absolute inset-y-0 left-0 pl-4 flex items-center pointer-events-none">
                    <svg className="w-5 h-5 text-slate-400" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M21 12a9 9 0 01-9 9m9-9a9 9 0 00-9-9m9 9H3m9 9a9 9 0 01-9-9m9 9c1.657 0 3-4.03 3-9s-1.343-9-3-9m0 18c-1.657 0-3-4.03-3-9s1.343-9 3-9m-9 9a9 9 0 019-9" />
                    </svg>
                  </div>
                  <input
                    type="text"
                    value={formData.companyWebsite}
                    onChange={(e) => setFormData({ ...formData, companyWebsite: e.target.value })}
                    className="w-full pl-12 pr-4 py-3.5 border border-slate-300 rounded-xl focus:ring-2 focus:ring-blue-500 focus:border-transparent outline-none transition-all bg-white text-slate-900 placeholder-slate-400"
                    placeholder="example.com"
                  />
                </div>
                <p className="text-xs text-slate-500 mt-2 flex items-start gap-1.5">
                  <svg className="w-4 h-4 shrink-0 mt-0.5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9.663 17h4.673M12 3v1m6.364 1.636l-.707.707M21 12h-1M4 12H3m3.343-5.657l-.707-.707m2.828 9.9a5 5 0 117.072 0l-.548.547A3.374 3.374 0 0014 18.469V19a2 2 0 11-4 0v-.531c0-.895-.356-1.754-.988-2.386l-.548-.547z" />
                  </svg>
                  We'll analyze your website to personalize your experience
                </p>
              </div>

              <button
                type="submit"
                className="w-full py-4 bg-gradient-to-r from-blue-600 via-blue-700 to-indigo-600 text-white font-semibold rounded-xl hover:from-blue-700 hover:via-blue-800 hover:to-indigo-700 transition-all shadow-lg shadow-blue-500/30 hover:shadow-xl hover:shadow-blue-500/40 transform hover:-translate-y-0.5"
              >
                Continue to Dashboard
              </button>
            </form>
          </div>

          <p className="text-center text-blue-200 text-sm mt-8">
            You can update this information later in settings
          </p>
        </div>

        <style jsx>{`
          @keyframes blob {
            0% { transform: translate(0px, 0px) scale(1); }
            33% { transform: translate(30px, -50px) scale(1.1); }
            66% { transform: translate(-20px, 20px) scale(0.9); }
            100% { transform: translate(0px, 0px) scale(1); }
          }
          .animate-blob {
            animation: blob 7s infinite;
          }
          .animation-delay-2000 {
            animation-delay: 2s;
          }
          .animation-delay-4000 {
            animation-delay: 4s;
          }
        `}</style>
      </div>
    );
  }

  // Pain Selection Step
  if (step === 'pain_selection') {
    return (
      <PainSelection
        onSelect={handlePainSelection}
        onSkip={handleSkipPain}
      />
    );
  }

  // Agent Test Step
  if (step === 'agent_test' && selectedPain) {
    return (
      <AgentTestExperience
        agentSlug={selectedPain.agentSlug}
        agentTitle={selectedPain.title}
        agentDescription={selectedPain.description}
        companyId={companyId!}
        companyName={formData.companyName}
        onComplete={handleAgentTestComplete}
        onSkip={handleSkipAgentTest}
      />
    );
  }

  return (
    <div className="min-h-screen bg-gradient-to-br from-slate-900 via-blue-900 to-indigo-900 flex items-center justify-center p-4 relative overflow-hidden">
      {/* Animated background elements */}
      <div className="absolute inset-0 overflow-hidden pointer-events-none">
        <div className="absolute -top-40 -right-40 w-80 h-80 bg-blue-500 rounded-full mix-blend-multiply filter blur-xl opacity-20 animate-blob"></div>
        <div className="absolute -bottom-40 -left-40 w-80 h-80 bg-indigo-500 rounded-full mix-blend-multiply filter blur-xl opacity-20 animate-blob animation-delay-2000"></div>
        <div className="absolute top-1/2 left-1/2 transform -translate-x-1/2 -translate-y-1/2 w-80 h-80 bg-purple-500 rounded-full mix-blend-multiply filter blur-xl opacity-20 animate-blob animation-delay-4000"></div>
      </div>

      <div className="w-full max-w-md relative z-10">
        <div className="bg-white/95 backdrop-blur-xl rounded-3xl shadow-2xl p-12 border border-white/20">
          <div className="text-center">
            {/* Icon */}
            <div className="flex justify-center mb-8">
              {getStepIcon()}
            </div>

            {/* Message */}
            <h2 className="text-2xl font-bold text-slate-900 mb-3">
              {step === 'error' ? 'Setup Failed' : 'Setting Up Your Workspace'}
            </h2>

            <p className="text-slate-600 mb-8">
              {getStepMessage()}
            </p>

            {/* Progress bar */}
            {isProcessing && (
              <div className="mb-8">
                <div className="w-full bg-slate-200 rounded-full h-3 overflow-hidden">
                  <div
                    className="h-full bg-gradient-to-r from-blue-600 via-blue-700 to-indigo-600 transition-all duration-500 ease-out"
                    style={{ width: `${progress}%` }}
                  ></div>
                </div>
                <p className="text-sm text-slate-500 mt-2">{progress}%</p>
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
                    className="flex-1 px-4 py-3 border border-slate-300 text-slate-700 rounded-lg hover:bg-slate-50 font-medium"
                  >
                    Back to Login
                  </button>
                  <button
                    onClick={() => {
                      setStep('form');
                      setError('');
                      setProgress(0);
                    }}
                    className="flex-1 px-4 py-3 bg-blue-600 text-white rounded-lg hover:bg-blue-700 font-medium"
                  >
                    Try Again
                  </button>
                </div>
              </div>
            )}

            {/* Scraped Results - WOW Effect */}
            {step === 'showing_results' && scrapedData && (
              <div className="space-y-4 text-left animate-fadeIn">
                <div className="p-5 bg-gradient-to-br from-emerald-50 to-teal-50 border border-emerald-200 rounded-2xl">
                  <div className="flex items-start gap-4">
                    {scrapedData.favicon_url && (
                      <img
                        src={scrapedData.favicon_url}
                        alt="Company logo"
                        className="w-12 h-12 rounded-xl shadow-md"
                        onError={(e) => {
                          e.currentTarget.style.display = 'none';
                        }}
                      />
                    )}
                    <div className="flex-1 min-w-0">
                      <h3 className="font-bold text-lg text-slate-900 mb-1">
                        {scrapedData.data.title || formData.companyName}
                      </h3>
                      {scrapedData.data.description && (
                        <p className="text-sm text-slate-600 line-clamp-2">
                          {scrapedData.data.description}
                        </p>
                      )}
                    </div>
                  </div>
                </div>

                {scrapedData.summary && (
                  <div className="p-4 bg-blue-50 border border-blue-200 rounded-xl">
                    <div className="flex items-start gap-2">
                      <svg className="w-5 h-5 text-blue-600 shrink-0 mt-0.5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9.663 17h4.673M12 3v1m6.364 1.636l-.707.707M21 12h-1M4 12H3m3.343-5.657l-.707-.707m2.828 9.9a5 5 0 117.072 0l-.548.547A3.374 3.374 0 0014 18.469V19a2 2 0 11-4 0v-.531c0-.895-.356-1.754-.988-2.386l-.548-.547z" />
                      </svg>
                      <div>
                        <p className="text-xs font-semibold text-blue-800 uppercase tracking-wide mb-1">AI Summary</p>
                        <p className="text-sm text-blue-900">{scrapedData.summary}</p>
                      </div>
                    </div>
                  </div>
                )}

                {scrapedData.data.headings && scrapedData.data.headings.length > 0 && (
                  <div className="p-4 bg-slate-50 border border-slate-200 rounded-xl">
                    <p className="text-xs font-semibold text-slate-500 uppercase tracking-wide mb-2">Key Topics</p>
                    <div className="flex flex-wrap gap-2">
                      {scrapedData.data.headings.slice(0, 4).map((heading, index) => (
                        <span
                          key={index}
                          className="px-3 py-1 bg-white border border-slate-200 rounded-full text-xs font-medium text-slate-700"
                        >
                          {heading.length > 30 ? heading.substring(0, 30) + '...' : heading}
                        </span>
                      ))}
                    </div>
                  </div>
                )}
              </div>
            )}

            {/* Steps list */}
            {isProcessing && step !== 'showing_results' && (
              <div className="space-y-3 text-left">
                <div className={`flex items-center gap-3 p-3 rounded-lg transition-all ${
                  ['creating_company', 'setting_up_account', 'analyzing_website', 'showing_results', 'complete'].includes(step)
                    ? 'bg-emerald-50 border border-emerald-200'
                    : 'bg-slate-50 border border-slate-200'
                }`}>
                  <div className={`w-6 h-6 rounded-full flex items-center justify-center shrink-0 ${
                    ['creating_company', 'setting_up_account', 'analyzing_website', 'showing_results', 'complete'].includes(step)
                      ? 'bg-emerald-500'
                      : 'bg-slate-300'
                  }`}>
                    <svg className="w-3.5 h-3.5 text-white" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={3} d="M5 13l4 4L19 7" />
                    </svg>
                  </div>
                  <span className={`text-sm font-medium ${
                    ['creating_company', 'setting_up_account', 'analyzing_website', 'showing_results', 'complete'].includes(step)
                      ? 'text-emerald-900'
                      : 'text-slate-600'
                  }`}>
                    Creating company profile
                  </span>
                </div>

                <div className={`flex items-center gap-3 p-3 rounded-lg transition-all ${
                  ['setting_up_account', 'analyzing_website', 'showing_results', 'complete'].includes(step)
                    ? 'bg-emerald-50 border border-emerald-200'
                    : 'bg-slate-50 border border-slate-200'
                }`}>
                  <div className={`w-6 h-6 rounded-full flex items-center justify-center shrink-0 ${
                    ['setting_up_account', 'analyzing_website', 'showing_results', 'complete'].includes(step)
                      ? 'bg-emerald-500'
                      : 'bg-slate-300'
                  }`}>
                    <svg className="w-3.5 h-3.5 text-white" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={3} d="M5 13l4 4L19 7" />
                    </svg>
                  </div>
                  <span className={`text-sm font-medium ${
                    ['setting_up_account', 'analyzing_website', 'showing_results', 'complete'].includes(step)
                      ? 'text-emerald-900'
                      : 'text-slate-600'
                  }`}>
                    Setting up your account
                  </span>
                </div>

                {formData.companyWebsite && (
                  <div className={`flex items-center gap-3 p-3 rounded-lg transition-all ${
                    ['analyzing_website', 'showing_results', 'complete'].includes(step)
                      ? 'bg-emerald-50 border border-emerald-200'
                      : 'bg-slate-50 border border-slate-200'
                  }`}>
                    <div className={`w-6 h-6 rounded-full flex items-center justify-center shrink-0 ${
                      ['analyzing_website', 'showing_results', 'complete'].includes(step)
                        ? 'bg-emerald-500'
                        : 'bg-slate-300'
                    }`}>
                      <svg className="w-3.5 h-3.5 text-white" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={3} d="M5 13l4 4L19 7" />
                      </svg>
                    </div>
                    <span className={`text-sm font-medium ${
                      ['analyzing_website', 'showing_results', 'complete'].includes(step)
                        ? 'text-emerald-900'
                        : 'text-slate-600'
                    }`}>
                      Personalizing experience
                    </span>
                  </div>
                )}
              </div>
            )}
          </div>
        </div>

        {isProcessing && (
          <p className="text-center text-blue-200 text-sm mt-8">
            This will only take a moment...
          </p>
        )}
      </div>

      <style jsx>{`
        @keyframes blob {
          0% { transform: translate(0px, 0px) scale(1); }
          33% { transform: translate(30px, -50px) scale(1.1); }
          66% { transform: translate(-20px, 20px) scale(0.9); }
          100% { transform: translate(0px, 0px) scale(1); }
        }
        @keyframes fadeIn {
          from { opacity: 0; transform: translateY(10px); }
          to { opacity: 1; transform: translateY(0); }
        }
        .animate-blob {
          animation: blob 7s infinite;
        }
        .animate-fadeIn {
          animation: fadeIn 0.5s ease-out forwards;
        }
        .animation-delay-2000 {
          animation-delay: 2s;
        }
        .animation-delay-4000 {
          animation-delay: 4s;
        }
      `}</style>
    </div>
  );
}
