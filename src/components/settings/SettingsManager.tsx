// components/settings/SettingsManager.tsx
'use client';

import { useState } from 'react';
import { createClient } from '@/lib/supabase/client';
import { Database } from '@/types/supabase';
import BillingSettings from './BillingSettings';

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
  const [activeTab, setActiveTab] = useState<'company' | 'calling' | 'billing'>('company');
  const [loading, setLoading] = useState(false);
  const [uploadingLogo, setUploadingLogo] = useState(false);
  const [success, setSuccess] = useState('');

  const [company, setCompany] = useState({
    name: initialCompany.name,
    website: initialCompany.website || '',
    description: initialCompany.description || '',
    industry: initialCompany.industry || '',
    favicon_url: initialCompany.favicon_url || '',
  });

  // Extract additional settings from JSON field or use defaults
  const additionalSettings = (initialSettings.settings as any) || {};
  const [settings, setSettings] = useState({
    default_voice: initialSettings.default_voice,
    default_interval_minutes: initialSettings.default_interval_minutes,
    default_max_duration: initialSettings.default_max_duration,
    test_phone_number: initialSettings.test_phone_number || '',
    timezone: additionalSettings.timezone || 'America/New_York',
    working_hours_start: additionalSettings.working_hours_start || '09:00',
    working_hours_end: additionalSettings.working_hours_end || '18:00',
    max_calls_per_day: additionalSettings.max_calls_per_day || 100,
    language: additionalSettings.language || 'en-US',
  });

  const handleLogoUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    // Validate file type
    if (!file.type.startsWith('image/')) {
      alert('Please upload an image file');
      return;
    }

    // Validate file size (max 2MB)
    if (file.size > 2 * 1024 * 1024) {
      alert('File size must be less than 2MB');
      return;
    }

    setUploadingLogo(true);
    try {
      // Upload to Supabase Storage
      const fileExt = file.name.split('.').pop();
      const fileName = `${initialCompany.id}-${Date.now()}.${fileExt}`;
      const filePath = `company-logos/${fileName}`;

      const { error: uploadError } = await supabase.storage
        .from('public-assets')
        .upload(filePath, file);

      if (uploadError) throw uploadError;

      // Get public URL
      const { data } = supabase.storage
        .from('public-assets')
        .getPublicUrl(filePath);

      const logoUrl = data.publicUrl;

      // Update company with new logo URL
      const response = await fetch('/api/company/update', {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ favicon_url: logoUrl }),
      });

      if (!response.ok) throw new Error('Failed to update logo');

      setCompany({ ...company, favicon_url: logoUrl });
      setSuccess('Company logo updated successfully');
    } catch (error) {
      console.error('Logo upload error:', error);
      alert('Failed to upload logo. Please try again.');
    } finally {
      setUploadingLogo(false);
    }
  };

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
      // Prepare settings with additional fields in JSON
      const updatedSettings = {
        default_voice: settings.default_voice,
        default_interval_minutes: settings.default_interval_minutes,
        default_max_duration: settings.default_max_duration,
        test_phone_number: settings.test_phone_number,
        settings: {
          timezone: settings.timezone,
          working_hours_start: settings.working_hours_start,
          working_hours_end: settings.working_hours_end,
          max_calls_per_day: settings.max_calls_per_day,
          language: settings.language,
        }
      };

      const { error } = await supabase
        .from('company_settings')
        .update(updatedSettings)
        .eq('company_id', initialCompany.id);

      if (error) throw error;

      setSuccess('Call settings updated successfully');
    } catch (error) {
      alert('Failed to update settings');
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="space-y-6">
      {/* Success Message */}
      {success && (
        <div className="bg-emerald-50/80 border border-emerald-200 rounded-xl p-4 flex items-center gap-3 animate-slideDown">
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
              { id: 'billing', label: 'Billing & Plans', icon: '💳' },
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
            <div className="space-y-6">
              {/* Hero Section with Logo */}
              <div className="relative overflow-hidden bg-gradient-to-br from-slate-900 via-indigo-900 to-purple-900 rounded-2xl p-8 shadow-xl">
                {/* Animated background effects */}
                <div className="absolute inset-0 bg-[radial-gradient(ellipse_at_top_right,_var(--tw-gradient-stops))] from-cyan-900/20 via-transparent to-transparent"></div>
                <div className="absolute inset-0 bg-[radial-gradient(ellipse_at_bottom_left,_var(--tw-gradient-stops))] from-purple-900/20 via-transparent to-transparent"></div>

                <div className="relative z-10 flex items-center gap-6">
                  {/* Logo Upload */}
                  <div className="relative group">
                    <div className="w-24 h-24 rounded-2xl overflow-hidden bg-white/10 backdrop-blur-sm border-2 border-white/20 shadow-2xl">
                      {company.favicon_url ? (
                        <img
                          src={company.favicon_url}
                          alt={company.name}
                          className="w-full h-full object-cover"
                        />
                      ) : (
                        <div className="w-full h-full flex items-center justify-center bg-gradient-to-br from-indigo-600 to-purple-600">
                          <span className="text-4xl font-black text-white">
                            {company.name.charAt(0).toUpperCase()}
                          </span>
                        </div>
                      )}
                    </div>

                    {/* Upload Button Overlay */}
                    <label
                      htmlFor="logo-upload"
                      className="absolute inset-0 flex items-center justify-center bg-slate-900/80 backdrop-blur-sm opacity-0 group-hover:opacity-100 transition-all cursor-pointer rounded-2xl"
                    >
                      <div className="text-center">
                        {uploadingLogo ? (
                          <div className="w-6 h-6 border-2 border-white/30 border-t-white rounded-full animate-spin mx-auto"></div>
                        ) : (
                          <>
                            <svg className="w-6 h-6 text-white mx-auto mb-1" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 16l4.586-4.586a2 2 0 012.828 0L16 16m-2-2l1.586-1.586a2 2 0 012.828 0L20 14m-6-6h.01M6 20h12a2 2 0 002-2V6a2 2 0 00-2-2H6a2 2 0 00-2 2v12a2 2 0 002 2z" />
                            </svg>
                            <span className="text-xs text-white font-medium">Upload</span>
                          </>
                        )}
                      </div>
                    </label>
                    <input
                      id="logo-upload"
                      type="file"
                      accept="image/*"
                      onChange={handleLogoUpload}
                      className="hidden"
                      disabled={uploadingLogo}
                    />

                    {/* Corner accents */}
                    <div className="absolute -top-1 -left-1 w-4 h-4 border-t-2 border-l-2 border-cyan-400"></div>
                    <div className="absolute -bottom-1 -right-1 w-4 h-4 border-b-2 border-r-2 border-cyan-400"></div>
                  </div>

                  {/* Company Info Header */}
                  <div className="flex-1">
                    <h2 className="text-3xl font-black text-white mb-2 bg-clip-text text-transparent bg-gradient-to-r from-white via-cyan-200 to-purple-200">
                      {company.name || 'Your Company'}
                    </h2>
                    <p className="text-slate-300 font-medium mb-3">
                      {company.industry || 'Set your industry'}
                    </p>
                    <div className="flex items-center gap-4">
                      <div className="flex items-center gap-2">
                        <div className="w-2 h-2 bg-emerald-500 rounded-full"></div>
                        <span className="text-xs text-slate-400 font-bold">Active</span>
                      </div>
                      <div className="h-4 w-px bg-slate-700"></div>
                      <div className="flex items-center gap-2">
                        <div className="w-2 h-2 bg-cyan-500 rounded-full"></div>
                        <span className="text-xs text-slate-400 font-bold">Connected</span>
                      </div>
                    </div>
                  </div>
                </div>

                {/* Decorative glowing orbs */}
                <div className="absolute right-0 top-0 w-64 h-64 bg-gradient-to-br from-cyan-500/10 to-purple-500/10 rounded-full -translate-y-1/2 translate-x-1/3 blur-3xl"></div>
              </div>

              {/* Company Form */}
              <form onSubmit={handleUpdateCompany} className="space-y-6">
                <div className="grid md:grid-cols-2 gap-6">
                  <div>
                    <label className="block text-sm font-bold text-slate-700 mb-2 flex items-center gap-2">
                      <span className="w-6 h-6 rounded-md bg-indigo-100 text-indigo-600 flex items-center justify-center text-xs">🏢</span>
                      Company Name
                    </label>
                    <input
                      type="text"
                      value={company.name}
                      onChange={(e) => setCompany({ ...company, name: e.target.value })}
                      className="w-full px-4 py-3 border-2 border-slate-200 rounded-xl focus:ring-2 focus:ring-indigo-500/20 focus:border-indigo-500 outline-none transition-all bg-white hover:border-slate-300"
                      required
                    />
                  </div>

                  <div>
                    <label className="block text-sm font-bold text-slate-700 mb-2 flex items-center gap-2">
                      <span className="w-6 h-6 rounded-md bg-purple-100 text-purple-600 flex items-center justify-center text-xs">🏭</span>
                      Industry
                    </label>
                    <input
                      type="text"
                      value={company.industry}
                      onChange={(e) => setCompany({ ...company, industry: e.target.value })}
                      placeholder="e.g., Technology, Healthcare, Retail"
                      className="w-full px-4 py-3 border-2 border-slate-200 rounded-xl focus:ring-2 focus:ring-indigo-500/20 focus:border-indigo-500 outline-none transition-all bg-white hover:border-slate-300"
                    />
                  </div>
                </div>

                <div>
                  <label className="block text-sm font-bold text-slate-700 mb-2 flex items-center gap-2">
                    <span className="w-6 h-6 rounded-md bg-blue-100 text-blue-600 flex items-center justify-center text-xs">🌐</span>
                    Website
                  </label>
                  <div className="flex gap-2">
                    <input
                      type="url"
                      value={company.website}
                      onChange={(e) => setCompany({ ...company, website: e.target.value })}
                      placeholder="https://example.com"
                      className="flex-1 px-4 py-3 border-2 border-slate-200 rounded-xl focus:ring-2 focus:ring-indigo-500/20 focus:border-indigo-500 outline-none transition-all bg-white hover:border-slate-300"
                    />
                    <button
                      type="button"
                      onClick={handleScrapeWebsite}
                      disabled={!company.website || loading}
                      className="px-5 py-3 bg-gradient-to-r from-violet-600 to-purple-600 text-white rounded-xl hover:from-violet-700 hover:to-purple-700 disabled:opacity-50 disabled:cursor-not-allowed flex items-center gap-2 font-bold transition-all shadow-lg shadow-violet-500/30 hover:shadow-xl"
                    >
                      <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0z" />
                      </svg>
                      {loading ? 'Analyzing...' : 'Analyze'}
                    </button>
                  </div>
                  <p className="text-xs text-slate-500 mt-2 flex items-center gap-1.5">
                    <svg className="w-3.5 h-3.5 text-indigo-500" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M13 16h-1v-4h-1m1-4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
                    </svg>
                    We'll extract company info from your website to improve AI conversations
                  </p>
                </div>

                <div>
                  <label className="block text-sm font-bold text-slate-700 mb-2 flex items-center gap-2">
                    <span className="w-6 h-6 rounded-md bg-emerald-100 text-emerald-600 flex items-center justify-center text-xs">📝</span>
                    Description
                  </label>
                  <textarea
                    value={company.description}
                    onChange={(e) => setCompany({ ...company, description: e.target.value })}
                    rows={5}
                    placeholder="Brief description of your company and what you do..."
                    className="w-full px-4 py-3 border-2 border-slate-200 rounded-xl focus:ring-2 focus:ring-indigo-500/20 focus:border-indigo-500 outline-none transition-all resize-none bg-white hover:border-slate-300"
                  />
                </div>

                <button
                  type="submit"
                  disabled={loading}
                  className="w-full py-4 bg-gradient-to-r from-indigo-600 to-purple-600 text-white font-black rounded-xl hover:from-indigo-700 hover:to-purple-700 disabled:opacity-50 disabled:cursor-not-allowed transition-all shadow-lg shadow-indigo-500/30 hover:shadow-xl text-lg"
                >
                  {loading ? (
                    <span className="flex items-center justify-center gap-3">
                      <div className="w-5 h-5 border-2 border-white/30 border-t-white rounded-full animate-spin"></div>
                      Saving...
                    </span>
                  ) : (
                    'Save Company Info'
                  )}
                </button>
              </form>
            </div>
          )}

          {/* Call Settings Tab */}
          {activeTab === 'calling' && (
            <div className="space-y-6">
              {/* Settings Header */}
              <div className="bg-gradient-to-r from-blue-50 to-indigo-50 rounded-xl p-6 border border-indigo-100">
                <div className="flex items-center gap-3 mb-2">
                  <div className="w-10 h-10 rounded-xl bg-gradient-to-br from-blue-600 to-indigo-600 flex items-center justify-center">
                    <svg className="w-5 h-5 text-white" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M10.325 4.317c.426-1.756 2.924-1.756 3.35 0a1.724 1.724 0 002.573 1.066c1.543-.94 3.31.826 2.37 2.37a1.724 1.724 0 001.065 2.572c1.756.426 1.756 2.924 0 3.35a1.724 1.724 0 00-1.066 2.573c.94 1.543-.826 3.31-2.37 2.37a1.724 1.724 0 00-2.572 1.065c-.426 1.756-2.924 1.756-3.35 0a1.724 1.724 0 00-2.573-1.066c-1.543.94-3.31-.826-2.37-2.37a1.724 1.724 0 00-1.065-2.572c-1.756-.426-1.756-2.924 0-3.35a1.724 1.724 0 001.066-2.573c-.94-1.543.826-3.31 2.37-2.37.996.608 2.296.07 2.572-1.065z" />
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 12a3 3 0 11-6 0 3 3 0 016 0z" />
                    </svg>
                  </div>
                  <div>
                    <h3 className="text-lg font-black text-slate-900">Call Configuration</h3>
                    <p className="text-sm text-slate-600">Set default calling preferences and parameters</p>
                  </div>
                </div>
              </div>

              <form onSubmit={handleUpdateSettings} className="space-y-6">
                {/* Voice & Language */}
                <div className="bg-white border-2 border-slate-200 rounded-xl p-6 space-y-6">
                  <h4 className="text-sm font-black text-slate-900 uppercase tracking-wide flex items-center gap-2">
                    <svg className="w-4 h-4 text-indigo-600" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 11a7 7 0 01-7 7m0 0a7 7 0 01-7-7m7 7v4m0 0H8m4 0h4m-4-8a3 3 0 01-3-3V5a3 3 0 116 0v6a3 3 0 01-3 3z" />
                    </svg>
                    Voice & Language
                  </h4>

                  <div className="grid md:grid-cols-2 gap-6">
                    <div>
                      <label className="block text-sm font-bold text-slate-700 mb-2">
                        Default Voice
                      </label>
                      <select
                        value={settings.default_voice}
                        onChange={(e) => setSettings({ ...settings, default_voice: e.target.value })}
                        className="w-full px-4 py-3 border-2 border-slate-200 rounded-xl focus:ring-2 focus:ring-indigo-500/20 focus:border-indigo-500 bg-white outline-none transition-all cursor-pointer hover:border-slate-300"
                      >
                        <option value="maya">Maya (Female - Friendly)</option>
                        <option value="nat">Natalie (Female - Professional)</option>
                        <option value="josh">Josh (Male - Energetic)</option>
                        <option value="matt">Matt (Male - Calm)</option>
                      </select>
                    </div>

                    <div>
                      <label className="block text-sm font-bold text-slate-700 mb-2">
                        Language
                      </label>
                      <select
                        value={settings.language}
                        onChange={(e) => setSettings({ ...settings, language: e.target.value })}
                        className="w-full px-4 py-3 border-2 border-slate-200 rounded-xl focus:ring-2 focus:ring-indigo-500/20 focus:border-indigo-500 bg-white outline-none transition-all cursor-pointer hover:border-slate-300"
                      >
                        <option value="en-US">English (US)</option>
                        <option value="en-GB">English (UK)</option>
                        <option value="es-ES">Spanish (Spain)</option>
                        <option value="es-MX">Spanish (Mexico)</option>
                        <option value="fr-FR">French</option>
                        <option value="de-DE">German</option>
                      </select>
                    </div>
                  </div>
                </div>

                {/* Call Timing */}
                <div className="bg-white border-2 border-slate-200 rounded-xl p-6 space-y-6">
                  <h4 className="text-sm font-black text-slate-900 uppercase tracking-wide flex items-center gap-2">
                    <svg className="w-4 h-4 text-indigo-600" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 8v4l3 3m6-3a9 9 0 11-18 0 9 9 0 0118 0z" />
                    </svg>
                    Call Timing
                  </h4>

                  <div className="grid md:grid-cols-3 gap-6">
                    <div>
                      <label className="block text-sm font-bold text-slate-700 mb-2">
                        Max Duration (minutes)
                      </label>
                      <input
                        type="number"
                        min="1"
                        max="15"
                        value={settings.default_max_duration}
                        onChange={(e) => setSettings({ ...settings, default_max_duration: parseInt(e.target.value) })}
                        className="w-full px-4 py-3 border-2 border-slate-200 rounded-xl focus:ring-2 focus:ring-indigo-500/20 focus:border-indigo-500 outline-none transition-all hover:border-slate-300"
                      />
                    </div>

                    <div>
                      <label className="block text-sm font-bold text-slate-700 mb-2">
                        Interval Between Calls (min)
                      </label>
                      <input
                        type="number"
                        min="1"
                        max="60"
                        value={settings.default_interval_minutes}
                        onChange={(e) => setSettings({ ...settings, default_interval_minutes: parseInt(e.target.value) })}
                        className="w-full px-4 py-3 border-2 border-slate-200 rounded-xl focus:ring-2 focus:ring-indigo-500/20 focus:border-indigo-500 outline-none transition-all hover:border-slate-300"
                      />
                    </div>

                    <div>
                      <label className="block text-sm font-bold text-slate-700 mb-2">
                        Max Calls Per Day
                      </label>
                      <input
                        type="number"
                        min="1"
                        max="1000"
                        value={settings.max_calls_per_day}
                        onChange={(e) => setSettings({ ...settings, max_calls_per_day: parseInt(e.target.value) })}
                        className="w-full px-4 py-3 border-2 border-slate-200 rounded-xl focus:ring-2 focus:ring-2 focus:ring-indigo-500/20 focus:border-indigo-500 outline-none transition-all hover:border-slate-300"
                      />
                    </div>
                  </div>
                </div>

                {/* Working Hours & Timezone */}
                <div className="bg-white border-2 border-slate-200 rounded-xl p-6 space-y-6">
                  <h4 className="text-sm font-black text-slate-900 uppercase tracking-wide flex items-center gap-2">
                    <svg className="w-4 h-4 text-indigo-600" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M3 21v-4m0 0V5a2 2 0 012-2h6.5l1 1H21l-3 6 3 6h-8.5l-1-1H5a2 2 0 00-2 2zm9-13.5V9" />
                    </svg>
                    Working Hours & Timezone
                  </h4>

                  <div className="grid md:grid-cols-3 gap-6">
                    <div>
                      <label className="block text-sm font-bold text-slate-700 mb-2">
                        Start Time
                      </label>
                      <input
                        type="time"
                        value={settings.working_hours_start}
                        onChange={(e) => setSettings({ ...settings, working_hours_start: e.target.value })}
                        className="w-full px-4 py-3 border-2 border-slate-200 rounded-xl focus:ring-2 focus:ring-indigo-500/20 focus:border-indigo-500 outline-none transition-all hover:border-slate-300"
                      />
                    </div>

                    <div>
                      <label className="block text-sm font-bold text-slate-700 mb-2">
                        End Time
                      </label>
                      <input
                        type="time"
                        value={settings.working_hours_end}
                        onChange={(e) => setSettings({ ...settings, working_hours_end: e.target.value })}
                        className="w-full px-4 py-3 border-2 border-slate-200 rounded-xl focus:ring-2 focus:ring-indigo-500/20 focus:border-indigo-500 outline-none transition-all hover:border-slate-300"
                      />
                    </div>

                    <div>
                      <label className="block text-sm font-bold text-slate-700 mb-2">
                        Timezone
                      </label>
                      <select
                        value={settings.timezone}
                        onChange={(e) => setSettings({ ...settings, timezone: e.target.value })}
                        className="w-full px-4 py-3 border-2 border-slate-200 rounded-xl focus:ring-2 focus:ring-indigo-500/20 focus:border-indigo-500 bg-white outline-none transition-all cursor-pointer hover:border-slate-300"
                      >
                        <option value="America/New_York">Eastern Time (ET)</option>
                        <option value="America/Chicago">Central Time (CT)</option>
                        <option value="America/Denver">Mountain Time (MT)</option>
                        <option value="America/Los_Angeles">Pacific Time (PT)</option>
                        <option value="America/Phoenix">Arizona (MST)</option>
                        <option value="America/Anchorage">Alaska (AKT)</option>
                        <option value="Pacific/Honolulu">Hawaii (HST)</option>
                        <option value="Europe/London">London (GMT)</option>
                        <option value="Europe/Paris">Paris (CET)</option>
                        <option value="Asia/Tokyo">Tokyo (JST)</option>
                        <option value="Australia/Sydney">Sydney (AEDT)</option>
                      </select>
                    </div>
                  </div>

                  <div className="bg-blue-50 border border-blue-200 rounded-lg p-4">
                    <div className="flex gap-3">
                      <svg className="w-5 h-5 text-blue-600 flex-shrink-0 mt-0.5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M13 16h-1v-4h-1m1-4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
                      </svg>
                      <div className="text-sm text-blue-900">
                        <p className="font-semibold mb-1">Working Hours Information</p>
                        <p className="text-blue-700">Calls will only be placed during these hours in the selected timezone. This helps ensure you're reaching contacts at appropriate times.</p>
                      </div>
                    </div>
                  </div>
                </div>

                {/* Test Phone */}
                <div className="bg-white border-2 border-slate-200 rounded-xl p-6 space-y-4">
                  <h4 className="text-sm font-black text-slate-900 uppercase tracking-wide flex items-center gap-2">
                    <svg className="w-4 h-4 text-indigo-600" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M3 5a2 2 0 012-2h3.28a1 1 0 01.948.684l1.498 4.493a1 1 0 01-.502 1.21l-2.257 1.13a11.042 11.042 0 005.516 5.516l1.13-2.257a1 1 0 011.21-.502l4.493 1.498a1 1 0 01.684.949V19a2 2 0 01-2 2h-1C9.716 21 3 14.284 3 6V5z" />
                    </svg>
                    Test Configuration
                  </h4>

                  <div>
                    <label className="block text-sm font-bold text-slate-700 mb-2">
                      Test Phone Number
                    </label>
                    <input
                      type="tel"
                      value={settings.test_phone_number}
                      onChange={(e) => setSettings({ ...settings, test_phone_number: e.target.value })}
                      placeholder="+1 (555) 123-4567"
                      className="w-full px-4 py-3 border-2 border-slate-200 rounded-xl focus:ring-2 focus:ring-indigo-500/20 focus:border-indigo-500 outline-none transition-all hover:border-slate-300"
                    />
                    <p className="text-xs text-slate-500 mt-2 flex items-center gap-1.5">
                      <svg className="w-3.5 h-3.5 text-indigo-500" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M13 16h-1v-4h-1m1-4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
                      </svg>
                      Use this number for testing agent configurations before launching campaigns
                    </p>
                  </div>
                </div>

                <button
                  type="submit"
                  disabled={loading}
                  className="w-full py-4 bg-gradient-to-r from-blue-600 to-indigo-600 text-white font-black rounded-xl hover:from-blue-700 hover:to-indigo-700 disabled:opacity-50 disabled:cursor-not-allowed transition-all shadow-lg shadow-blue-500/30 hover:shadow-xl text-lg"
                >
                  {loading ? (
                    <span className="flex items-center justify-center gap-3">
                      <div className="w-5 h-5 border-2 border-white/30 border-t-white rounded-full animate-spin"></div>
                      Saving...
                    </span>
                  ) : (
                    'Save Call Settings'
                  )}
                </button>
              </form>
            </div>
          )}

          {/* Billing Tab */}
          {activeTab === 'billing' && (
            <BillingSettings companyId={initialCompany.id} />
          )}
        </div>
      </div>
    </div>
  );
}
