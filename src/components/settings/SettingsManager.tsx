// components/settings/SettingsManager.tsx
'use client';

import { useState, useEffect, Suspense } from 'react';
import { useRouter, useSearchParams } from 'next/navigation';
import { createClient } from '@/lib/supabase/client';
import { Database } from '@/types/supabase';
import BillingSettings from './BillingSettings';
import CallSettings from './CallSettings';
import NotificationSettings from './NotificationSettings';
import TeamSettings from './TeamSettings';
import VoiceSelector from '@/components/voice/VoiceSelector';

type Company = Database['public']['Tables']['companies']['Row'];
type CompanySettings = Database['public']['Tables']['company_settings']['Row'];
type User = {
  id: string;
  email: string;
  full_name: string | null;
  role: string;
  notifications_enabled?: boolean;
};

interface SettingsManagerProps {
  company: Company;
  settings: CompanySettings;
  user: User;
}

export default function SettingsManager({ company: initialCompany, settings: initialSettings, user }: SettingsManagerProps) {
  const supabase = createClient();
  const router = useRouter();
  const searchParams = useSearchParams();
  const [activeTab, setActiveTab] = useState<'company' | 'calling' | 'billing' | 'notifications' | 'team'>('company');

  // Handle URL query params for deep linking (e.g., from Integrations → Twilio)
  useEffect(() => {
    const tab = searchParams.get('tab');
    if (tab === 'calling' || tab === 'billing' || tab === 'notifications' || tab === 'company' || tab === 'team') {
      setActiveTab(tab);
    }
  }, [searchParams]);
  const [loading, setLoading] = useState(false);
  const [uploadingLogo, setUploadingLogo] = useState(false);
  const [success, setSuccess] = useState('');
  const [faviconTimestamp, setFaviconTimestamp] = useState(Date.now());

  // Separate state for temporary website input vs saved data
  const [websiteInput, setWebsiteInput] = useState(initialCompany.website || '');

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
      setFaviconTimestamp(Date.now()); // Force favicon refresh

      // Refresh the page to update all components with new logo
      router.refresh();
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
      // Update company data including the website input
      const dataToSave = {
        ...company,
        website: websiteInput, // Only save website when explicitly saving
      };

      const response = await fetch('/api/company/update', {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(dataToSave),
      });

      if (!response.ok) throw new Error('Failed to update');

      // Update local state to match saved data
      setCompany({ ...company, website: websiteInput });
      setSuccess('Company information updated successfully');
      setFaviconTimestamp(Date.now()); // Force favicon refresh

      // Refresh the page to update all components with new company data
      setTimeout(() => {
        window.location.reload();
      }, 500);
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
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          website: websiteInput, // Use temporary input value, not saved website
          auto_save: false, // Don't save automatically, user will save manually
        }),
      });

      const data = await response.json();
      if (!response.ok) throw new Error(data.error);

      // Update local state with extracted data (not saved to DB yet)
      // Note: website is NOT updated here - it only saves when user clicks "Save Company Info"
      setCompany(prev => ({
        ...prev,
        name: data.name || prev.name, // Always update with detected company name
        description: data.summary || prev.description,
        favicon_url: data.favicon_url || prev.favicon_url,
        industry: data.industry || prev.industry,
        // website is intentionally NOT updated - only saved on explicit save
      }));
      setFaviconTimestamp(Date.now()); // Force favicon refresh

      setSuccess('Website analyzed! Review the extracted information (including company name) and click "Save Company Info" to apply changes.');
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
              { id: 'team', label: 'Team', icon: '👥' },
              { id: 'notifications', label: 'Notifications', icon: '🔔' },
            ].map((tab) => (
              <button
                key={tab.id}
                onClick={() => setActiveTab(tab.id as any)}
                className={`flex-1 px-6 py-4 text-sm font-medium border-b-2 transition-all ${
                  activeTab === tab.id
                    ? 'border-[var(--color-primary)] text-[var(--color-primary)] bg-[var(--color-primary-50)]'
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
              <div className="relative overflow-hidden gradient-bg-subtle rounded-2xl p-8 shadow-md">
                <div className="relative z-10 flex items-center gap-6">
                  {/* Logo Upload */}
                  <div className="relative group">
                    <div className="w-24 h-24 rounded-2xl overflow-hidden bg-white/80 backdrop-blur-sm border border-slate-200 shadow-md">
                      {company.favicon_url ? (
                        <img
                          key={`${company.favicon_url}-${faviconTimestamp}`}
                          src={`${company.favicon_url}${company.favicon_url.includes('?') ? '&' : '?'}t=${faviconTimestamp}`}
                          alt={company.name}
                          className="w-full h-full object-cover"
                        />
                      ) : (
                        <div className="w-full h-full flex items-center justify-center gradient-bg">
                          <span className="text-4xl font-bold text-white">
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
                          <div className="w-6 h-6 border border-white/30 border-t-white rounded-full animate-spin mx-auto"></div>
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
                  </div>

                  {/* Company Info Header */}
                  <div className="flex-1">
                    <h2 className="text-3xl font-bold text-slate-900 mb-2">
                      {company.name || 'Your Company'}
                    </h2>
                    <p className="text-[var(--color-primary)] font-medium mb-3">
                      {company.industry || 'Set your industry'}
                    </p>
                    <div className="flex items-center gap-4">
                      <div className="flex items-center gap-2">
                        <div className="w-2 h-2 bg-emerald-500 rounded-full"></div>
                        <span className="text-xs text-slate-600 font-semibold">Active</span>
                      </div>
                      <div className="h-4 w-px bg-slate-300"></div>
                      <div className="flex items-center gap-2">
                        <div className="w-2 h-2 bg-[var(--color-primary)] rounded-full"></div>
                        <span className="text-xs text-slate-600 font-semibold">Connected</span>
                      </div>
                    </div>
                  </div>
                </div>
              </div>

              {/* Company Form */}
              <form onSubmit={handleUpdateCompany} className="space-y-6">
                <div className="grid md:grid-cols-2 gap-6">
                  <div>
                    <label className="block text-sm font-semibold text-slate-700 mb-2 flex items-center gap-2">
                      <span className="w-6 h-6 rounded-md bg-[var(--color-primary-50)] text-[var(--color-primary)] flex items-center justify-center text-xs">🏢</span>
                      Company Name
                    </label>
                    <input
                      type="text"
                      value={company.name}
                      onChange={(e) => setCompany({ ...company, name: e.target.value })}
                      className="w-full px-4 py-3 border border-slate-200 rounded-xl focus:ring-2 focus:ring-[var(--color-primary-200)] focus:border-[var(--color-primary)] outline-none transition-all bg-white hover:border-slate-300"
                      required
                    />
                  </div>

                  <div>
                    <label className="block text-sm font-semibold text-slate-700 mb-2 flex items-center gap-2">
                      <span className="w-6 h-6 rounded-md bg-purple-100 text-purple-600 flex items-center justify-center text-xs">🏭</span>
                      Industry
                    </label>
                    <input
                      type="text"
                      value={company.industry}
                      onChange={(e) => setCompany({ ...company, industry: e.target.value })}
                      placeholder="e.g., Technology, Healthcare, Retail"
                      className="w-full px-4 py-3 border border-slate-200 rounded-xl focus:ring-2 focus:ring-[var(--color-primary-200)] focus:border-[var(--color-primary)] outline-none transition-all bg-white hover:border-slate-300"
                    />
                  </div>
                </div>

                <div>
                  <label className="block text-sm font-semibold text-slate-700 mb-2 flex items-center gap-2">
                    <span className="w-6 h-6 rounded-md bg-blue-100 text-blue-600 flex items-center justify-center text-xs">🌐</span>
                    Website
                  </label>
                  <div className="flex gap-2">
                    <input
                      type="text"
                      value={websiteInput}
                      onChange={(e) => setWebsiteInput(e.target.value)}
                      onKeyDown={(e) => {
                        if (e.key === 'Enter' && websiteInput && !loading) {
                          e.preventDefault();
                          handleScrapeWebsite();
                        }
                      }}
                      placeholder="example.com"
                      className="flex-1 px-4 py-3 border border-slate-200 rounded-xl focus:ring-2 focus:ring-[var(--color-primary-200)] focus:border-[var(--color-primary)] outline-none transition-all bg-white hover:border-slate-300"
                    />
                    <button
                      type="button"
                      onClick={handleScrapeWebsite}
                      disabled={!websiteInput || loading}
                      className="btn-primary px-5 py-3 rounded-xl disabled:opacity-50 disabled:cursor-not-allowed flex items-center gap-2 font-semibold transition-all"
                    >
                      <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0z" />
                      </svg>
                      {loading ? 'Analyzing...' : 'Analyze'}
                    </button>
                  </div>
                  <p className="text-xs text-slate-500 mt-2 flex items-center gap-1.5">
                    <svg className="w-3.5 h-3.5 text-[var(--color-primary)]" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M13 16h-1v-4h-1m1-4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
                    </svg>
                    We'll extract company info from your website to improve AI conversations
                  </p>
                </div>

                <div>
                  <label className="block text-sm font-semibold text-slate-700 mb-2 flex items-center gap-2">
                    <span className="w-6 h-6 rounded-md bg-emerald-100 text-emerald-600 flex items-center justify-center text-xs">📝</span>
                    Description
                  </label>
                  <textarea
                    value={company.description}
                    onChange={(e) => setCompany({ ...company, description: e.target.value })}
                    rows={5}
                    placeholder="Brief description of your company and what you do..."
                    className="w-full px-4 py-3 border border-slate-200 rounded-xl focus:ring-2 focus:ring-[var(--color-primary-200)] focus:border-[var(--color-primary)] outline-none transition-all resize-none bg-white hover:border-slate-300"
                  />
                </div>

                <button
                  type="submit"
                  disabled={loading}
                  className="btn-primary w-full py-4 font-bold rounded-xl disabled:opacity-50 disabled:cursor-not-allowed transition-all text-lg"
                >
                  {loading ? (
                    <span className="flex items-center justify-center gap-3">
                      <div className="w-5 h-5 border border-white/30 border-t-white rounded-full animate-spin"></div>
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
            <CallSettings
              settings={settings}
              onSettingsChange={setSettings}
              onSubmit={handleUpdateSettings}
              loading={loading}
              success={success}
              companyId={initialCompany.id}
              initialSection={searchParams.get('section') || undefined}
            />
          )}

          {/* Billing Tab */}
          {activeTab === 'billing' && (
            <Suspense fallback={
              <div className="flex items-center justify-center py-12">
                <div className="w-8 h-8 border border-[var(--color-primary-200)] border-t-[var(--color-primary)] rounded-full animate-spin"></div>
              </div>
            }>
              <BillingSettings companyId={initialCompany.id} />
            </Suspense>
          )}

          {/* Team Tab */}
          {activeTab === 'team' && (
            <TeamSettings companyId={initialCompany.id} currentUser={user} />
          )}

          {/* Notifications Tab */}
          {activeTab === 'notifications' && (
            <NotificationSettings
              userId={user.id}
              initialEnabled={user.notifications_enabled ?? true}
            />
          )}
        </div>
      </div>
    </div>
  );
}
