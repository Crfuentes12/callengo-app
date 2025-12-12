// components/settings/SettingsManager.tsx
'use client';

import { useState } from 'react';
import { createClient } from '@/lib/supabase/client';
import { Database } from '@/types/supabase';

type Company = Database['public']['Tables']['companies']['Row'];
type CompanySettings = Database['public']['Tables']['company_settings']['Row'];
type User = {
  id: string;
  email: string;
  full_name: string | null;
  role: string;
};

interface SettingsManagerProps {
  company: Company;
  settings: CompanySettings;
  user: User;
}

export default function SettingsManager({ company: initialCompany, settings: initialSettings, user }: SettingsManagerProps) {
  const supabase = createClient();
  const [activeTab, setActiveTab] = useState<'company' | 'api' | 'calling'>('company');
  const [loading, setLoading] = useState(false);
  const [success, setSuccess] = useState('');

  const [company, setCompany] = useState({
    name: initialCompany.name,
    website: initialCompany.website || '',
    description: initialCompany.description || '',
    industry: initialCompany.industry || '',
  });

  const [settings, setSettings] = useState({
    default_voice: initialSettings.default_voice,
    default_interval_minutes: initialSettings.default_interval_minutes,
    default_max_duration: initialSettings.default_max_duration,
    test_phone_number: initialSettings.test_phone_number || '',
  });

  const [apiKeys, setApiKeys] = useState({
    bland_api_key: '',
    openai_api_key: '',
  });

  const handleUpdateCompany = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoading(true);
    setSuccess('');

    try {
      const response = await fetch('/api/company/update', {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(company),
      });

      if (!response.ok) throw new Error('Failed to update');

      setSuccess('Company information updated successfully');
    } catch (error) {
      alert('Failed to update company information');
    } finally {
      setLoading(false);
    }
  };

  const handleScrapeWebsite = async () => {
    setLoading(true);
    try {
      const response = await fetch('/api/company/scrape', {
        method: 'POST',
      });

      const data = await response.json();
      if (!response.ok) throw new Error(data.error);

      setSuccess('Website analyzed successfully! Your company context has been updated.');
      
      // Update local company description
      if (data.summary) {
        setCompany(prev => ({ ...prev, description: data.summary }));
      }
    } catch (error) {
      alert('Failed to analyze website');
    } finally {
      setLoading(false);
    }
  };

  const handleUpdateSettings = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoading(true);
    setSuccess('');

    try {
      const { error } = await supabase
        .from('company_settings')
        .update(settings)
        .eq('company_id', initialCompany.id);

      if (error) throw error;

      setSuccess('Call settings updated successfully');
    } catch (error) {
      alert('Failed to update settings');
    } finally {
      setLoading(false);
    }
  };

  const handleUpdateApiKeys = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoading(true);
    setSuccess('');

    try {
      const updates: any = {};
      if (apiKeys.bland_api_key) updates.bland_api_key = apiKeys.bland_api_key;
      if (apiKeys.openai_api_key) updates.openai_api_key = apiKeys.openai_api_key;

      const { error } = await supabase
        .from('company_settings')
        .update(updates)
        .eq('company_id', initialCompany.id);

      if (error) throw error;

      setSuccess('API keys updated successfully');
      setApiKeys({ bland_api_key: '', openai_api_key: '' });
    } catch (error) {
      alert('Failed to update API keys');
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="space-y-6">
      {/* Success Message */}
      {success && (
        <div className="bg-emerald-50/80 border border-emerald-200 rounded-xl p-4 flex items-center gap-3">
          <div className="w-8 h-8 rounded-lg bg-emerald-100 flex items-center justify-center">
            <svg className="w-4 h-4 text-emerald-600" fill="none" viewBox="0 0 24 24" stroke="currentColor">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 13l4 4L19 7" />
            </svg>
          </div>
          <p className="text-sm text-emerald-700 font-medium">{success}</p>
        </div>
      )}

      {/* Tabs */}
      <div className="bg-white rounded-xl border border-slate-200/80 overflow-hidden shadow-sm">
        <div className="border-b border-slate-100">
          <nav className="flex">
            {[
              { id: 'company', label: 'Company Info', icon: '🏢' },
              { id: 'calling', label: 'Call Settings', icon: '📞' },
              { id: 'api', label: 'API Keys', icon: '🔑' },
            ].map((tab) => (
              <button
                key={tab.id}
                onClick={() => setActiveTab(tab.id as any)}
                className={`flex-1 px-6 py-4 text-sm font-medium border-b-2 transition-all ${
                  activeTab === tab.id
                    ? 'border-indigo-600 text-indigo-600 bg-indigo-50/50'
                    : 'border-transparent text-slate-600 hover:text-slate-900 hover:bg-slate-50'
                }`}
              >
                <span className="mr-2">{tab.icon}</span>
                {tab.label}
              </button>
            ))}
          </nav>
        </div>

        <div className="p-6">
          {/* Company Info Tab */}
          {activeTab === 'company' && (
            <form onSubmit={handleUpdateCompany} className="space-y-6">
              <div>
                <h3 className="text-lg font-bold text-slate-900 mb-4">Company Information</h3>
                <div className="space-y-4">
                  <div>
                    <label className="block text-sm font-medium text-slate-700 mb-1.5">
                      Company Name
                    </label>
                    <input
                      type="text"
                      value={company.name}
                      onChange={(e) => setCompany({ ...company, name: e.target.value })}
                      className="w-full px-4 py-2.5 border border-slate-200 rounded-xl focus:ring-2 focus:ring-indigo-500/20 focus:border-indigo-500 outline-none transition-all"
                      required
                    />
                  </div>

                  <div>
                    <label className="block text-sm font-medium text-slate-700 mb-1.5">
                      Website
                    </label>
                    <div className="flex gap-2">
                      <input
                        type="url"
                        value={company.website}
                        onChange={(e) => setCompany({ ...company, website: e.target.value })}
                        placeholder="https://example.com"
                        className="flex-1 px-4 py-2.5 border border-slate-200 rounded-xl focus:ring-2 focus:ring-indigo-500/20 focus:border-indigo-500 outline-none transition-all"
                      />
                      <button
                        type="button"
                        onClick={handleScrapeWebsite}
                        disabled={!company.website || loading}
                        className="px-4 py-2.5 bg-violet-600 text-white rounded-xl hover:bg-violet-700 disabled:opacity-50 disabled:cursor-not-allowed flex items-center gap-2 font-medium transition-all shadow-sm"
                      >
                        <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0z" />
                        </svg>
                        Analyze
                      </button>
                    </div>
                    <p className="text-xs text-slate-500 mt-1.5">
                      We'll extract company info from your website to improve AI conversations
                    </p>
                  </div>

                  <div>
                    <label className="block text-sm font-medium text-slate-700 mb-1.5">
                      Industry
                    </label>
                    <input
                      type="text"
                      value={company.industry}
                      onChange={(e) => setCompany({ ...company, industry: e.target.value })}
                      placeholder="e.g., Technology, Healthcare, Retail"
                      className="w-full px-4 py-2.5 border border-slate-200 rounded-xl focus:ring-2 focus:ring-indigo-500/20 focus:border-indigo-500 outline-none transition-all"
                    />
                  </div>

                  <div>
                    <label className="block text-sm font-medium text-slate-700 mb-1.5">
                      Description
                    </label>
                    <textarea
                      value={company.description}
                      onChange={(e) => setCompany({ ...company, description: e.target.value })}
                      rows={4}
                      placeholder="Brief description of your company..."
                      className="w-full px-4 py-2.5 border border-slate-200 rounded-xl focus:ring-2 focus:ring-indigo-500/20 focus:border-indigo-500 outline-none transition-all resize-none"
                    />
                  </div>
                </div>
              </div>

              <button
                type="submit"
                disabled={loading}
                className="w-full py-3 bg-indigo-600 text-white font-semibold rounded-xl hover:bg-indigo-700 disabled:opacity-50 disabled:cursor-not-allowed transition-all shadow-sm"
              >
                {loading ? 'Saving...' : 'Save Company Info'}
              </button>
            </form>
          )}

          {/* Call Settings Tab */}
          {activeTab === 'calling' && (
            <form onSubmit={handleUpdateSettings} className="space-y-6">
              <div>
                <h3 className="text-lg font-bold text-slate-900 mb-4">Default Call Settings</h3>
                <div className="space-y-4">
                  <div>
                    <label className="block text-sm font-medium text-slate-700 mb-1.5">
                      Default Voice
                    </label>
                    <select
                      value={settings.default_voice}
                      onChange={(e) => setSettings({ ...settings, default_voice: e.target.value })}
                      className="w-full px-4 py-2.5 border border-slate-200 rounded-xl focus:ring-2 focus:ring-indigo-500/20 focus:border-indigo-500 bg-white outline-none transition-all cursor-pointer"
                    >
                      <option value="maya">Maya (Female)</option>
                      <option value="nat">Natalie (Female)</option>
                      <option value="josh">Josh (Male)</option>
                      <option value="matt">Matt (Male)</option>
                    </select>
                  </div>

                  <div>
                    <label className="block text-sm font-medium text-slate-700 mb-1.5">
                      Default Max Duration (minutes)
                    </label>
                    <input
                      type="number"
                      min="1"
                      max="15"
                      value={settings.default_max_duration}
                      onChange={(e) => setSettings({ ...settings, default_max_duration: parseInt(e.target.value) })}
                      className="w-full px-4 py-2.5 border border-slate-200 rounded-xl focus:ring-2 focus:ring-indigo-500/20 focus:border-indigo-500 outline-none transition-all"
                    />
                  </div>

                  <div>
                    <label className="block text-sm font-medium text-slate-700 mb-1.5">
                      Default Interval Between Calls (minutes)
                    </label>
                    <input
                      type="number"
                      min="1"
                      max="60"
                      value={settings.default_interval_minutes}
                      onChange={(e) => setSettings({ ...settings, default_interval_minutes: parseInt(e.target.value) })}
                      className="w-full px-4 py-2.5 border border-slate-200 rounded-xl focus:ring-2 focus:ring-indigo-500/20 focus:border-indigo-500 outline-none transition-all"
                    />
                  </div>

                  <div>
                    <label className="block text-sm font-medium text-slate-700 mb-1.5">
                      Test Phone Number
                    </label>
                    <input
                      type="tel"
                      value={settings.test_phone_number}
                      onChange={(e) => setSettings({ ...settings, test_phone_number: e.target.value })}
                      placeholder="+1 (555) 123-4567"
                      className="w-full px-4 py-2.5 border border-slate-200 rounded-xl focus:ring-2 focus:ring-indigo-500/20 focus:border-indigo-500 outline-none transition-all"
                    />
                    <p className="text-xs text-slate-500 mt-1.5">
                      Use this number for test calls
                    </p>
                  </div>
                </div>
              </div>

              <button
                type="submit"
                disabled={loading}
                className="w-full py-3 bg-indigo-600 text-white font-semibold rounded-xl hover:bg-indigo-700 disabled:opacity-50 disabled:cursor-not-allowed transition-all shadow-sm"
              >
                {loading ? 'Saving...' : 'Save Call Settings'}
              </button>
            </form>
          )}

          {/* API Keys Tab */}
          {activeTab === 'api' && (
            <form onSubmit={handleUpdateApiKeys} className="space-y-6">
              <div>
                <h3 className="text-lg font-bold text-slate-900 mb-2">API Keys</h3>
                <p className="text-sm text-slate-600 mb-4">
                  Configure your own API keys for Bland AI and OpenAI (optional - defaults to system keys)
                </p>

                <div className="space-y-4">
                  <div>
                    <label className="block text-sm font-medium text-slate-700 mb-1.5">
                      Bland AI API Key
                    </label>
                    <input
                      type="password"
                      value={apiKeys.bland_api_key}
                      onChange={(e) => setApiKeys({ ...apiKeys, bland_api_key: e.target.value })}
                      placeholder="sk-..."
                      className="w-full px-4 py-2.5 border border-slate-200 rounded-xl focus:ring-2 focus:ring-indigo-500/20 focus:border-indigo-500 outline-none transition-all font-mono"
                    />
                    <p className="text-xs text-slate-500 mt-1.5">
                      Get your API key from <a href="https://app.bland.ai" target="_blank" className="text-indigo-600 hover:underline font-medium">Bland AI Dashboard</a>
                    </p>
                  </div>

                  <div>
                    <label className="block text-sm font-medium text-slate-700 mb-1.5">
                      OpenAI API Key
                    </label>
                    <input
                      type="password"
                      value={apiKeys.openai_api_key}
                      onChange={(e) => setApiKeys({ ...apiKeys, openai_api_key: e.target.value })}
                      placeholder="sk-..."
                      className="w-full px-4 py-2.5 border border-slate-200 rounded-xl focus:ring-2 focus:ring-indigo-500/20 focus:border-indigo-500 outline-none transition-all font-mono"
                    />
                    <p className="text-xs text-slate-500 mt-1.5">
                      Get your API key from <a href="https://platform.openai.com" target="_blank" className="text-indigo-600 hover:underline font-medium">OpenAI Platform</a>
                    </p>
                  </div>
                </div>

                <div className="bg-amber-50/80 rounded-xl p-4 border border-amber-200 mt-4">
                  <div className="flex items-start gap-3">
                    <div className="w-8 h-8 rounded-lg bg-amber-100 flex items-center justify-center shrink-0">
                      <svg className="w-4 h-4 text-amber-600" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-3L13.732 4c-.77-1.333-2.694-1.333-3.464 0L3.34 16c-.77 1.333.192 3 1.732 3z" />
                      </svg>
                    </div>
                    <div>
                      <p className="text-sm font-semibold text-amber-900 mb-0.5">Security Note</p>
                      <p className="text-sm text-amber-700">
                        API keys are encrypted and stored securely. Leave blank to use system default keys.
                      </p>
                    </div>
                  </div>
                </div>
              </div>

              <button
                type="submit"
                disabled={loading}
                className="w-full py-3 bg-indigo-600 text-white font-semibold rounded-xl hover:bg-indigo-700 disabled:opacity-50 disabled:cursor-not-allowed transition-all shadow-sm"
              >
                {loading ? 'Saving...' : 'Save API Keys'}
              </button>
            </form>
          )}
        </div>
      </div>
    </div>
  );
}