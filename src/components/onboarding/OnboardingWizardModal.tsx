// components/onboarding/OnboardingWizardModal.tsx
'use client';

import { useState, useCallback } from 'react';
import { useTranslation } from '@/i18n';
import PainSelection from './PainSelection';
import AgentTestExperience from './AgentTestExperience';
import { onboardingEvents } from '@/lib/analytics';
import { phOnboardingEvents } from '@/lib/posthog';

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

type WizardStep = 'pain_selection' | 'agent_test';

interface OnboardingWizardModalProps {
  companyId: string;
  companyName: string;
  onComplete: () => void;
  onDismiss: () => void;
}

export default function OnboardingWizardModal({
  companyId,
  companyName,
  onComplete,
  onDismiss,
}: OnboardingWizardModalProps) {
  const { t } = useTranslation();
  const [wizardStep, setWizardStep] = useState<WizardStep>('pain_selection');
  const [selectedPain, setSelectedPain] = useState<Pain | null>(null);
  const totalSteps = 2;
  const currentStepNum = wizardStep === 'pain_selection' ? 1 : 2;

  const markComplete = useCallback(async (action: 'complete' | 'skip', painId?: string) => {
    try {
      await fetch('/api/company/onboarding-status', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          action,
          selected_pain: painId || selectedPain?.id,
        }),
      });
    } catch (err) {
      console.error('Error saving onboarding status:', err);
    }
  }, [selectedPain]);

  const handlePainSelection = (pain: Pain) => {
    setSelectedPain(pain);
    onboardingEvents.stepCompleted('pain_selection', 2);
    phOnboardingEvents.stepCompleted('pain_selection', 2);

    // Save pain selection
    fetch('/api/company/onboarding-status', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ action: 'select_pain', selected_pain: pain.id }),
    }).catch(console.error);

    setWizardStep('agent_test');
  };

  const handleSkipPain = async () => {
    onboardingEvents.skipped('pain_selection');
    phOnboardingEvents.skipped('pain_selection');
    onboardingEvents.completed();
    phOnboardingEvents.completed();
    await markComplete('skip');
    onComplete();
  };

  const handleAgentTestComplete = async (callData: unknown) => {
    onboardingEvents.stepCompleted('agent_test', 3);
    phOnboardingEvents.stepCompleted('agent_test', 3);
    onboardingEvents.completed();
    phOnboardingEvents.completed();
    await markComplete('complete', selectedPain?.id);
    onComplete();
  };

  const handleSkipAgentTest = async () => {
    onboardingEvents.skipped('agent_test');
    phOnboardingEvents.skipped('agent_test');
    onboardingEvents.completed();
    phOnboardingEvents.completed();
    await markComplete('skip', selectedPain?.id);
    onComplete();
  };

  const handleBackdropClick = (e: React.MouseEvent) => {
    if (e.target === e.currentTarget) {
      // Clicking outside the modal — treat as skip/dismiss
      handleDismiss();
    }
  };

  const handleDismiss = async () => {
    onboardingEvents.skipped(wizardStep);
    phOnboardingEvents.skipped(wizardStep);
    await markComplete('skip', selectedPain?.id);
    onDismiss();
  };

  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center p-4"
      onClick={handleBackdropClick}
    >
      {/* Backdrop — blurred home page */}
      <div className="absolute inset-0 bg-black/40 backdrop-blur-sm" />

      {/* Modal */}
      <div className="relative z-10 w-full max-w-4xl max-h-[90vh] bg-white rounded-2xl shadow-2xl border border-[var(--border-default)] overflow-hidden flex flex-col">
        {/* Header */}
        <div className="flex items-center justify-between px-6 py-4 border-b border-[var(--border-default)] bg-[var(--color-neutral-50)]">
          <div className="flex items-center gap-3">
            {/* Step indicators */}
            <div className="flex items-center gap-2">
              {Array.from({ length: totalSteps }).map((_, i) => {
                const stepNum = i + 1;
                const isActive = stepNum === currentStepNum;
                const isCompleted = stepNum < currentStepNum;
                return (
                  <div key={i} className="flex items-center gap-2">
                    <div className={`
                      flex items-center justify-center w-8 h-8 rounded-full border-2 transition-all duration-300
                      ${isActive
                        ? 'gradient-bg border-white shadow-md scale-110'
                        : isCompleted
                        ? 'bg-emerald-600 border-emerald-400'
                        : 'bg-[var(--color-neutral-200)] border-[var(--border-default)]'
                      }
                    `}>
                      {isCompleted ? (
                        <svg className="w-4 h-4 text-white" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={3}>
                          <path strokeLinecap="round" strokeLinejoin="round" d="M5 13l4 4L19 7" />
                        </svg>
                      ) : (
                        <span className={`text-xs font-bold ${isActive ? 'text-white' : 'text-[var(--color-neutral-500)]'}`}>
                          {stepNum}
                        </span>
                      )}
                    </div>
                    {i < totalSteps - 1 && (
                      <div className={`w-8 h-0.5 rounded ${isCompleted ? 'bg-emerald-400' : 'bg-[var(--color-neutral-200)]'}`} />
                    )}
                  </div>
                );
              })}
            </div>
            <span className="text-xs text-[var(--color-neutral-500)] font-medium ml-2">
              {t.onboarding.wizard.step} {currentStepNum} {t.onboarding.wizard.of} {totalSteps}
            </span>
          </div>

          {/* Skip / Close button */}
          <button
            onClick={handleDismiss}
            className="flex items-center gap-2 px-4 py-2 bg-[var(--color-neutral-100)] border border-[var(--border-default)] text-[var(--color-neutral-600)] hover:text-[var(--color-neutral-800)] hover:bg-[var(--color-neutral-200)] rounded-lg text-sm font-semibold transition-all"
            title={t.onboarding.wizard.skipTooltip}
          >
            {t.onboarding.wizard.skipOnboarding}
            <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
              <path strokeLinecap="round" strokeLinejoin="round" d="M6 18L18 6M6 6l12 12" />
            </svg>
          </button>
        </div>

        {/* Content — scrollable */}
        <div className="flex-1 overflow-y-auto p-6" style={{ scrollbarGutter: 'stable' }}>
          {wizardStep === 'pain_selection' && (
            <PainSelection
              onSelect={handlePainSelection}
              onSkip={handleSkipPain}
            />
          )}

          {wizardStep === 'agent_test' && selectedPain && (
            <AgentTestExperience
              agentSlug={selectedPain.agentSlug}
              agentTitle={selectedPain.title}
              agentDescription={selectedPain.description}
              companyId={companyId}
              companyName={companyName}
              onComplete={handleAgentTestComplete}
              onSkip={handleSkipAgentTest}
            />
          )}
        </div>
      </div>
    </div>
  );
}
