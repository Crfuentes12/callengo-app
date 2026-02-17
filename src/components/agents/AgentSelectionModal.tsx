// components/agents/AgentSelectionModal.tsx
'use client';

import { useState, useEffect } from 'react';
import { AgentTemplate } from '@/types/supabase';
import Image from 'next/image';

interface AgentSelectionModalProps {
  agentTemplates: AgentTemplate[];
  onSelect: (agent: AgentTemplate) => void;
  onClose: () => void;
}

export default function AgentSelectionModal({ agentTemplates, onSelect, onClose }: AgentSelectionModalProps) {
  const [userInput, setUserInput] = useState('');
  const [isAnalyzing, setIsAnalyzing] = useState(false);
  const [recommendedAgent, setRecommendedAgent] = useState<AgentTemplate | null>(null);
  const [selectedAgentId, setSelectedAgentId] = useState<string | null>(null);

  // Reset recommended agent when user types
  useEffect(() => {
    if (userInput.trim() === '') {
      setRecommendedAgent(null);
    }
  }, [userInput]);

  const handleAnalyzeInput = async () => {
    if (!userInput.trim()) return;

    setIsAnalyzing(true);
    try {
      const response = await fetch('/api/openai/recommend-agent', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          userInput,
          availableAgents: agentTemplates.map(a => ({
            slug: a.slug,
            name: a.name,
            description: a.description
          }))
        }),
      });

      const data = await response.json();

      if (data.recommendedSlug) {
        const agent = agentTemplates.find(a => a.slug === data.recommendedSlug);
        if (agent) {
          setRecommendedAgent(agent);
          setSelectedAgentId(agent.id);
        }
      }
    } catch (error) {
      console.error('Error analyzing input:', error);
    } finally {
      setIsAnalyzing(false);
    }
  };

  const handleSelectAgent = (agent: AgentTemplate) => {
    setSelectedAgentId(agent.id);
    setRecommendedAgent(null);
  };

  const handleContinue = () => {
    const agent = selectedAgentId
      ? agentTemplates.find(a => a.id === selectedAgentId)
      : recommendedAgent;

    if (agent) {
      onSelect(agent);
    }
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/80 backdrop-blur-md" style={{ isolation: 'isolate', willChange: 'transform' }}>
      <div className="relative w-full max-w-4xl max-h-[90vh] bg-gradient-to-br from-slate-900 via-slate-800 to-slate-900 rounded-2xl shadow-2xl border border-slate-700/50 overflow-hidden flex flex-col" style={{ transform: 'translateZ(0)' }}>
        {/* Close button */}
        <button
          onClick={onClose}
          className="absolute top-3 right-3 z-50 w-9 h-9 rounded-lg bg-slate-800/80 backdrop-blur-sm border border-slate-700 text-slate-400 hover:text-white hover:bg-red-600 hover:border-red-500 transition-all duration-300 flex items-center justify-center group"
        >
          <svg className="w-4 h-4 group-hover:rotate-90 transition-transform duration-300" fill="none" viewBox="0 0 24 24" stroke="currentColor">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
          </svg>
        </button>

        {/* Scrollable content */}
        <div className="overflow-y-auto flex-1 px-8 py-6" style={{
          scrollbarGutter: 'stable',
          scrollbarWidth: 'thin'
        }}>

          {/* Header */}
          <div className="text-center mb-8">
            <h2 className="text-2xl md:text-3xl font-bold text-white mb-2 tracking-tight">
              What do you want to do today?
            </h2>
            <p className="text-sm text-slate-400">
              Tell us about your challenge, and we'll find the perfect AI agent for you
            </p>
          </div>

          {/* AI Input Section */}
          <div className="mb-8">
            <div className="relative">
              <textarea
                value={userInput}
                onChange={(e) => setUserInput(e.target.value)}
                placeholder="Example: I need to clean up my contact database with outdated phone numbers..."
                maxLength={500}
                className="w-full h-32 px-6 py-4 bg-slate-900/50 border border-slate-700 rounded-2xl text-white placeholder-slate-500 focus:outline-none focus:border-[var(--color-primary)] transition-all resize-none"
                onKeyDown={(e) => {
                  if (e.key === 'Enter' && e.ctrlKey) {
                    handleAnalyzeInput();
                  }
                }}
              />
              {/* Character counter */}
              <div className="absolute bottom-4 left-4 text-xs text-slate-500">
                {userInput.length}/500
              </div>
              <button
                onClick={handleAnalyzeInput}
                disabled={!userInput.trim() || isAnalyzing}
                className="absolute bottom-4 right-4 px-6 py-2 gradient-bg text-white font-semibold rounded-xl hover:opacity-90 transition-all disabled:opacity-50 disabled:cursor-not-allowed flex items-center gap-2"
              >
                {isAnalyzing ? (
                  <>
                    <svg className="animate-spin h-5 w-5" xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24">
                      <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4"></circle>
                      <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"></path>
                    </svg>
                    Analyzing...
                  </>
                ) : (
                  <>
                    <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M13 10V3L4 14h7v7l9-11h-7z" />
                    </svg>
                    Find My Agent
                  </>
                )}
              </button>
            </div>
          </div>

          {/* AI Recommendation */}
          {recommendedAgent && (
            <div className="mb-8 p-6 bg-[var(--color-primary)]/5 border border-[var(--color-primary)]/20 rounded-2xl">
              <div className="flex items-center gap-3 mb-3">
                <svg className="w-6 h-6 text-[var(--color-primary)]" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9.663 17h4.673M12 3v1m6.364 1.636l-.707.707M21 12h-1M4 12H3m3.343-5.657l-.707-.707m2.828 9.9a5 5 0 117.072 0l-.548.547A3.374 3.374 0 0014 18.469V19a2 2 0 11-4 0v-.531c0-.895-.356-1.754-.988-2.386l-.548-.547z" />
                </svg>
                <h3 className="text-xl font-bold text-white">AI Recommendation</h3>
              </div>
              <div className="flex items-center gap-4">
                <div className="w-16 h-16 rounded-xl overflow-hidden flex-shrink-0 border border-[var(--color-primary)]/30">
                  <Image
                    src={`/agent-avatars/${recommendedAgent.slug}.png`}
                    alt={recommendedAgent.name}
                    width={64}
                    height={64}
                    className="w-full h-full object-cover"
                  />
                </div>
                <div className="flex-1">
                  <h4 className="text-lg font-bold text-white mb-1">{recommendedAgent.name}</h4>
                  <p className="text-sm text-slate-300">{recommendedAgent.description}</p>
                </div>
              </div>
            </div>
          )}

          {/* Divider */}
          <div className="flex items-center gap-4 mb-8">
            <div className="flex-1 h-px bg-gradient-to-r from-transparent via-slate-700 to-transparent"></div>
            <span className="text-sm text-slate-500 font-semibold uppercase tracking-wider">Or choose manually</span>
            <div className="flex-1 h-px bg-gradient-to-r from-transparent via-slate-700 to-transparent"></div>
          </div>

          {/* Manual Agent Selection */}
          <div className="grid md:grid-cols-3 gap-4 mb-6">
            {agentTemplates.map((agent) => (
              <button
                key={agent.id}
                onClick={() => handleSelectAgent(agent)}
                className={`group relative p-4 rounded-2xl border transition-all text-left ${
                  selectedAgentId === agent.id
                    ? 'bg-[var(--color-primary)]/5 border-[var(--color-primary)] shadow-lg'
                    : 'bg-slate-900/30 border-slate-700 hover:border-slate-600 hover:bg-slate-900/50'
                }`}
              >
                {/* Selected indicator */}
                {selectedAgentId === agent.id && (
                  <div className="absolute top-3 right-3 w-6 h-6 bg-[var(--color-primary)] rounded-full flex items-center justify-center">
                    <svg className="w-4 h-4 text-white" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={3} d="M5 13l4 4L19 7" />
                    </svg>
                  </div>
                )}

                {/* Avatar and title side by side */}
                <div className="flex items-center gap-3 mb-3">
                  <div className="w-12 h-12 rounded-xl overflow-hidden flex-shrink-0 border border-slate-700 group-hover:border-[var(--color-primary)]/50 transition-all">
                    <Image
                      src={`/agent-avatars/${agent.slug}.png`}
                      alt={agent.name}
                      width={48}
                      height={48}
                      className="w-full h-full object-cover"
                    />
                  </div>
                  <h3 className="text-base font-bold text-white group-hover:text-[var(--color-primary)] transition-colors flex-1">
                    {agent.name}
                  </h3>
                </div>
                <p className="text-sm text-slate-400">
                  {agent.description}
                </p>
              </button>
            ))}
          </div>

          {/* Action Buttons */}
          <div className="flex items-center justify-end gap-3 pt-4 border-t border-slate-700/50 mt-4">
            <button
              onClick={onClose}
              className="px-6 py-2.5 bg-slate-800 text-white font-semibold rounded-lg hover:bg-slate-700 transition-all"
            >
              Cancel
            </button>
            <button
              onClick={handleContinue}
              disabled={!selectedAgentId && !recommendedAgent}
              className="px-8 py-2.5 gradient-bg text-white font-semibold rounded-lg hover:opacity-90 transition-all disabled:opacity-50 disabled:cursor-not-allowed flex items-center gap-2"
            >
              Continue
              <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M13 7l5 5m0 0l-5 5m5-5H6" />
              </svg>
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}
