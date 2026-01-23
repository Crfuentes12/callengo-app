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
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/60 backdrop-blur-sm">
      <div className="relative w-full max-w-4xl max-h-[90vh] overflow-y-auto bg-gradient-to-br from-slate-950 via-slate-900 to-slate-950 rounded-3xl shadow-2xl border-2 border-slate-800">
        {/* Animated background effects */}
        <div className="absolute inset-0 bg-[radial-gradient(ellipse_at_top_right,_var(--tw-gradient-stops))] from-cyan-900/20 via-transparent to-transparent rounded-3xl"></div>
        <div className="absolute inset-0 bg-[radial-gradient(ellipse_at_bottom_left,_var(--tw-gradient-stops))] from-purple-900/20 via-transparent to-transparent rounded-3xl"></div>

        {/* Scan lines effect */}
        <div className="absolute inset-0 opacity-10 rounded-3xl" style={{
          backgroundImage: 'repeating-linear-gradient(0deg, transparent, transparent 2px, rgba(255,255,255,0.03) 2px, rgba(255,255,255,0.03) 4px)'
        }}></div>

        <div className="relative z-10 p-8">
          {/* Close button */}
          <button
            onClick={onClose}
            className="absolute top-6 right-6 w-10 h-10 flex items-center justify-center rounded-xl bg-slate-800/50 border border-slate-700 text-slate-400 hover:text-white hover:bg-slate-800 transition-all"
          >
            <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
            </svg>
          </button>

          {/* Header */}
          <div className="text-center mb-8">
            <h2 className="text-4xl md:text-5xl font-black text-white mb-4 uppercase tracking-tight bg-clip-text text-transparent bg-gradient-to-r from-white via-cyan-200 to-purple-200">
              What do you want to do today?
            </h2>
            <p className="text-lg text-slate-400">
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
                className="w-full h-32 px-6 py-4 bg-slate-900/50 border-2 border-slate-700 rounded-2xl text-white placeholder-slate-500 focus:outline-none focus:border-cyan-500 transition-all resize-none"
                onKeyDown={(e) => {
                  if (e.key === 'Enter' && e.ctrlKey) {
                    handleAnalyzeInput();
                  }
                }}
              />
              <button
                onClick={handleAnalyzeInput}
                disabled={!userInput.trim() || isAnalyzing}
                className="absolute bottom-4 right-4 px-6 py-2 bg-gradient-to-r from-cyan-500 via-blue-600 to-purple-600 text-white font-bold rounded-xl hover:shadow-lg hover:shadow-cyan-500/50 transition-all disabled:opacity-50 disabled:cursor-not-allowed flex items-center gap-2"
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
            <p className="text-xs text-slate-500 mt-2 text-center">
              Press Ctrl+Enter or click "Find My Agent" to get AI-powered recommendation
            </p>
          </div>

          {/* AI Recommendation */}
          {recommendedAgent && (
            <div className="mb-8 p-6 bg-gradient-to-r from-cyan-900/30 via-blue-900/30 to-purple-900/30 border-2 border-cyan-500/50 rounded-2xl animate-pulse-subtle">
              <div className="flex items-center gap-3 mb-3">
                <svg className="w-6 h-6 text-cyan-400" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9.663 17h4.673M12 3v1m6.364 1.636l-.707.707M21 12h-1M4 12H3m3.343-5.657l-.707-.707m2.828 9.9a5 5 0 117.072 0l-.548.547A3.374 3.374 0 0014 18.469V19a2 2 0 11-4 0v-.531c0-.895-.356-1.754-.988-2.386l-.548-.547z" />
                </svg>
                <h3 className="text-xl font-bold text-white">AI Recommendation</h3>
              </div>
              <div className="flex items-center gap-4">
                <div className="w-16 h-16 rounded-xl overflow-hidden flex-shrink-0 border-2 border-cyan-400/50">
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
          <div className="grid md:grid-cols-3 gap-4 mb-8">
            {agentTemplates.map((agent) => (
              <button
                key={agent.id}
                onClick={() => handleSelectAgent(agent)}
                className={`group relative p-6 rounded-2xl border-2 transition-all text-left ${
                  selectedAgentId === agent.id
                    ? 'bg-gradient-to-br from-cyan-900/40 to-purple-900/40 border-cyan-500 shadow-lg shadow-cyan-500/25'
                    : 'bg-slate-900/30 border-slate-700 hover:border-slate-600 hover:bg-slate-900/50'
                }`}
              >
                {/* Selected indicator */}
                {selectedAgentId === agent.id && (
                  <div className="absolute top-3 right-3 w-6 h-6 bg-cyan-500 rounded-full flex items-center justify-center">
                    <svg className="w-4 h-4 text-white" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={3} d="M5 13l4 4L19 7" />
                    </svg>
                  </div>
                )}

                <div className="w-14 h-14 rounded-xl overflow-hidden mb-4 border-2 border-slate-700 group-hover:border-cyan-500/50 transition-all">
                  <Image
                    src={`/agent-avatars/${agent.slug}.png`}
                    alt={agent.name}
                    width={56}
                    height={56}
                    className="w-full h-full object-cover"
                  />
                </div>
                <h3 className="text-lg font-bold text-white mb-2 group-hover:text-cyan-400 transition-colors">
                  {agent.name}
                </h3>
                <p className="text-sm text-slate-400 line-clamp-3">
                  {agent.description}
                </p>
              </button>
            ))}
          </div>

          {/* Action Buttons */}
          <div className="flex items-center justify-end gap-4 pt-6 border-t border-slate-800">
            <button
              onClick={onClose}
              className="px-6 py-3 bg-slate-800 text-white font-semibold rounded-xl hover:bg-slate-700 transition-all"
            >
              Cancel
            </button>
            <button
              onClick={handleContinue}
              disabled={!selectedAgentId && !recommendedAgent}
              className="px-8 py-3 bg-gradient-to-r from-cyan-500 via-blue-600 to-purple-600 text-white font-bold rounded-xl hover:shadow-lg hover:shadow-cyan-500/50 transition-all disabled:opacity-50 disabled:cursor-not-allowed flex items-center gap-2"
            >
              Continue
              <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M13 7l5 5m0 0l-5 5m5-5H6" />
              </svg>
            </button>
          </div>
        </div>

        {/* Decorative glowing orbs */}
        <div className="absolute right-0 top-0 w-96 h-96 bg-gradient-to-br from-cyan-500/10 to-purple-500/10 rounded-full -translate-y-1/2 translate-x-1/3 blur-3xl pointer-events-none"></div>
        <div className="absolute left-0 bottom-0 w-64 h-64 bg-gradient-to-tr from-purple-500/10 to-pink-500/10 rounded-full translate-y-1/2 -translate-x-1/3 blur-3xl pointer-events-none"></div>
      </div>
    </div>
  );
}
