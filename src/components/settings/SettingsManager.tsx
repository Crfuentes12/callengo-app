// components/settings/SettingsManager.tsx
'use client';

import { useState, useEffect, Suspense, useRef } from 'react';
import { useRouter, useSearchParams } from 'next/navigation';
import { createClient } from '@/lib/supabase/client';
import { Database } from '@/types/supabase';
import BillingSettings from './BillingSettings';
import CallSettings from './CallSettings';
import NotificationSettings from './NotificationSettings';
import VoiceSelector from '@/components/voice/VoiceSelector';
import { useTranslation, useLanguage } from '@/i18n';
import LanguageSelector from '@/components/LanguageSelector';
import type { SupportedLanguage } from '@/i18n/translations';

type Company = Database['public']['Tables']['companies']['Row'];
type CompanySettings = Database['public']['Tables']['company_settings']['Row'];
type User = {
  id: string;
  email: string;
  full_name: string | null;
  role: string;
  notifications_enabled?: boolean;
  timezone?: string | null;
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
  const { t } = useTranslation();
  const { language, setLanguage } = useLanguage();
  const [activeTab, setActiveTab] = useState<'general' | 'company' | 'calling' | 'billing'>('general');
  const [savingLanguage, setSavingLanguage] = useState(false);

  // Profile state
  const [fullName, setFullName] = useState(user.full_name || '');
  const [savingProfile, setSavingProfile] = useState(false);
  const [profileSuccess, setProfileSuccess] = useState('');

  // Password state
  const [currentPassword, setCurrentPassword] = useState('');
  const [newPassword, setNewPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');
  const [savingPassword, setSavingPassword] = useState(false);
  const [passwordError, setPasswordError] = useState('');
  const [passwordSuccess, setPasswordSuccess] = useState('');
  const [showCurrentPw, setShowCurrentPw] = useState(false);
  const [showNewPw, setShowNewPw] = useState(false);

  // 2FA state
  const [mfaFactors, setMfaFactors] = useState<Record<string, unknown>[]>([]);
  const [mfaLoading, setMfaLoading] = useState(true);
  const [enrolling, setEnrolling] = useState(false);
  const [mfaEnrollData, setMfaEnrollData] = useState<{ factorId: string; qrCode: string; secret: string } | null>(null);
  const [mfaCode, setMfaCode] = useState('');
  const [mfaVerifying, setMfaVerifying] = useState(false);
  const [mfaError, setMfaError] = useState('');
  const [mfaSuccess, setMfaSuccess] = useState('');
  const [disabling2FA, setDisabling2FA] = useState(false);

  useEffect(() => {
    if (activeTab === 'general') {
      loadMfaFactors();
    }
  }, [activeTab]);

  const loadMfaFactors = async () => {
    setMfaLoading(true);
    try {
      const { data } = await supabase.auth.mfa.listFactors();
      setMfaFactors(data?.totp || []);
    } catch { /* non-critical */ }
    setMfaLoading(false);
  };

  const handleSaveProfile = async () => {
    setSavingProfile(true);
    setProfileSuccess('');
    try {
      const { error } = await supabase.from('users').update({ full_name: fullName }).eq('id', user.id);
      if (error) throw error;
      setProfileSuccess('Name updated successfully.');
      setTimeout(() => setProfileSuccess(''), 3000);
    } catch {
      alert('Could not update name. Please try again.');
    } finally {
      setSavingProfile(false);
    }
  };

  const handleChangePassword = async () => {
    setPasswordError('');
    setPasswordSuccess('');
    if (newPassword.length < 8) { setPasswordError('Password must be at least 8 characters.'); return; }
    if (newPassword !== confirmPassword) { setPasswordError('Passwords do not match.'); return; }
    setSavingPassword(true);
    try {
      const { error } = await supabase.auth.updateUser({ password: newPassword });
      if (error) throw error;
      setPasswordSuccess('Password updated successfully.');
      setCurrentPassword(''); setNewPassword(''); setConfirmPassword('');
      setTimeout(() => setPasswordSuccess(''), 4000);
    } catch (err: unknown) {
      setPasswordError((err as Error).message || 'Failed to update password.');
    } finally {
      setSavingPassword(false);
    }
  };

  const handleEnroll2FA = async () => {
    setEnrolling(true);
    setMfaError('');
    try {
      const { data, error } = await supabase.auth.mfa.enroll({ factorType: 'totp', issuer: 'Callengo', friendlyName: 'Authenticator App' });
      if (error) throw error;
      setMfaEnrollData({ factorId: data.id, qrCode: data.totp.qr_code, secret: data.totp.secret });
    } catch (err: unknown) {
      setMfaError((err as Error).message || 'Could not start 2FA setup.');
    } finally {
      setEnrolling(false);
    }
  };

  const handleVerify2FA = async () => {
    if (!mfaEnrollData || mfaCode.length < 6) return;
    setMfaVerifying(true);
    setMfaError('');
    try {
      const { data: challengeData, error: challengeError } = await supabase.auth.mfa.challenge({ factorId: mfaEnrollData.factorId });
      if (challengeError) throw challengeError;
      const { error: verifyError } = await supabase.auth.mfa.verify({ factorId: mfaEnrollData.factorId, challengeId: challengeData.id, code: mfaCode });
      if (verifyError) throw verifyError;
      setMfaSuccess('Two-factor authentication is now active.');
      setMfaEnrollData(null);
      setMfaCode('');
      await loadMfaFactors();
    } catch (err: unknown) {
      setMfaError((err as Error).message || 'Invalid code. Please try again.');
    } finally {
      setMfaVerifying(false);
    }
  };

  const handleDisable2FA = async (factorId: string) => {
    if (!confirm('Are you sure you want to disable two-factor authentication?')) return;
    setDisabling2FA(true);
    try {
      const { error } = await supabase.auth.mfa.unenroll({ factorId });
      if (error) throw error;
      setMfaSuccess('2FA has been disabled.');
      await loadMfaFactors();
    } catch (err: unknown) {
      setMfaError((err as Error).message || 'Could not disable 2FA.');
    } finally {
      setDisabling2FA(false);
    }
  };

  // Handle URL query params for deep linking (e.g., from Integrations → Twilio)
  useEffect(() => {
    const tab = searchParams.get('tab');
    if (tab === 'calling' || tab === 'billing' || tab === 'general' || tab === 'company') {
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
  const additionalSettings = (initialSettings.settings as Record<string, unknown>) || {};
  const [settings, setSettings] = useState({
    default_voice: initialSettings.default_voice,
    default_interval_minutes: initialSettings.default_interval_minutes,
    default_max_duration: initialSettings.default_max_duration,
    test_phone_number: initialSettings.test_phone_number || '',
    timezone: additionalSettings.timezone || user.timezone || 'America/New_York',
    working_hours_start: additionalSettings.working_hours_start || '09:00',
    working_hours_end: additionalSettings.working_hours_end || '18:00',
    max_calls_per_day: additionalSettings.max_calls_per_day || 100,
    language: additionalSettings.language || 'en-US',
    working_days: additionalSettings.working_days || ['monday', 'tuesday', 'wednesday', 'thursday', 'friday'],
    exclude_holidays: additionalSettings.exclude_holidays ?? true,
    voicemail_enabled: additionalSettings.voicemail_enabled ?? false,
    followup_enabled: additionalSettings.followup_enabled ?? false,
    followup_max_attempts: additionalSettings.followup_max_attempts || 3,
    followup_interval_hours: additionalSettings.followup_interval_hours || 24,
    smart_followup_enabled: additionalSettings.smart_followup_enabled ?? false,
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
      setSuccess(t.settings.company.logoUploadSuccess);
      setFaviconTimestamp(Date.now()); // Force favicon refresh

      // Refresh the page to update all components with new logo
      router.refresh();
    } catch (error) {
      console.error('Logo upload error:', error);
      alert(t.settings.company.logoUploadError);
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
      setSuccess(t.settings.company.updateSuccess);
      setFaviconTimestamp(Date.now()); // Force favicon refresh

      // Refresh the page to update all components with new company data
      setTimeout(() => {
        window.location.reload();
      }, 500);
    } catch (error) {
      alert(t.settings.company.updateError);
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

      setSuccess(t.settings.company.analyzeSuccess);
    } catch (error) {
      alert(t.settings.company.analyzeError);
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
      // Ensure integer columns are actually integers (prevents 22P02 error)
      // IMPORTANT: Spread ALL existing JSONB settings first to preserve Slack, Zoom, and other integration data
      const existingJsonSettings = (initialSettings.settings as Record<string, unknown>) || {};
      const updatedSettings = {
        default_voice: settings.default_voice,
        default_interval_minutes: Math.max(1, Math.round(Number(settings.default_interval_minutes) || 5)),
        default_max_duration: Math.max(1, Math.round(Number(settings.default_max_duration) || 5)),
        test_phone_number: settings.test_phone_number,
        settings: {
          ...existingJsonSettings,
          timezone: settings.timezone,
          working_hours_start: settings.working_hours_start,
          working_hours_end: settings.working_hours_end,
          max_calls_per_day: Math.max(1, Math.round(Number(settings.max_calls_per_day) || 100)),
          language: settings.language,
          working_days: settings.working_days,
          exclude_holidays: settings.exclude_holidays,
          voicemail_enabled: settings.voicemail_enabled,
          followup_enabled: settings.followup_enabled,
          followup_max_attempts: settings.followup_max_attempts,
          followup_interval_hours: settings.followup_interval_hours,
          smart_followup_enabled: settings.smart_followup_enabled,
        }
      };

      const { error } = await supabase
        .from('company_settings')
        .update(updatedSettings)
        .eq('company_id', initialCompany.id);

      if (error) throw error;

      setSuccess(t.settings.calling.success);
    } catch (error) {
      alert(t.settings.calling.error);
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
              { id: 'general', label: t.settings.tabs.general, icon: '⚙️' },
              { id: 'company', label: t.settings.tabs.company, icon: '🏢' },
              { id: 'calling', label: t.settings.tabs.calling, icon: '📞' },
              { id: 'billing', label: t.settings.tabs.billing, icon: '💳' },
            ].map((tab) => (
              <button
                key={tab.id}
                onClick={() => setActiveTab(tab.id as 'general' | 'company' | 'calling' | 'billing')}
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
                            <span className="text-xs text-white font-medium">{t.settings.company.uploadLogo}</span>
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
                      {company.name || t.settings.company.companyName}
                    </h2>
                    <p className="text-[var(--color-primary)] font-medium mb-3">
                      {company.industry || t.settings.company.setIndustry}
                    </p>
                    <div className="flex items-center gap-4">
                      <div className="flex items-center gap-2">
                        <div className="w-2 h-2 bg-emerald-500 rounded-full"></div>
                        <span className="text-xs text-slate-600 font-semibold">{t.settings.company.active}</span>
                      </div>
                      <div className="h-4 w-px bg-slate-300"></div>
                      <div className="flex items-center gap-2">
                        <div className="w-2 h-2 bg-[var(--color-primary)] rounded-full"></div>
                        <span className="text-xs text-slate-600 font-semibold">{t.settings.company.connected}</span>
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
                      {t.settings.company.companyName}
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
                      {t.settings.company.industry}
                    </label>
                    <input
                      type="text"
                      value={company.industry}
                      onChange={(e) => setCompany({ ...company, industry: e.target.value })}
                      placeholder={t.settings.company.industryPlaceholder}
                      className="w-full px-4 py-3 border border-slate-200 rounded-xl focus:ring-2 focus:ring-[var(--color-primary-200)] focus:border-[var(--color-primary)] outline-none transition-all bg-white hover:border-slate-300"
                    />
                  </div>
                </div>

                <div>
                  <label className="block text-sm font-semibold text-slate-700 mb-2 flex items-center gap-2">
                    <span className="w-6 h-6 rounded-md bg-blue-100 text-blue-600 flex items-center justify-center text-xs">🌐</span>
                    {t.settings.company.website}
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
                      placeholder={t.settings.company.websitePlaceholder}
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
                      {loading ? t.settings.company.analyzing : t.settings.company.analyze}
                    </button>
                  </div>
                  <p className="text-xs text-slate-500 mt-2 flex items-center gap-1.5">
                    <svg className="w-3.5 h-3.5 text-[var(--color-primary)]" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M13 16h-1v-4h-1m1-4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
                    </svg>
                    {t.settings.company.websiteHint}
                  </p>
                </div>

                <div>
                  <label className="block text-sm font-semibold text-slate-700 mb-2 flex items-center gap-2">
                    <span className="w-6 h-6 rounded-md bg-emerald-100 text-emerald-600 flex items-center justify-center text-xs">📝</span>
                    {t.settings.company.description}
                  </label>
                  <textarea
                    value={company.description}
                    onChange={(e) => setCompany({ ...company, description: e.target.value })}
                    rows={5}
                    placeholder={t.settings.company.descriptionPlaceholder}
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
                      {t.settings.company.saving}
                    </span>
                  ) : (
                    t.settings.company.saveButton
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

          {/* General Settings Tab */}
          {activeTab === 'general' && (
            <div className="space-y-8">

              {/* ── Profile ── */}
              <div className="space-y-4">
                <div className="flex items-center gap-2">
                  <div className="w-7 h-7 rounded-lg bg-indigo-50 flex items-center justify-center">
                    <svg className="w-4 h-4 text-indigo-600" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}><path strokeLinecap="round" strokeLinejoin="round" d="M15.75 6a3.75 3.75 0 11-7.5 0 3.75 3.75 0 017.5 0zM4.501 20.118a7.5 7.5 0 0114.998 0A17.933 17.933 0 0112 21.75c-2.676 0-5.216-.584-7.499-1.632z" /></svg>
                  </div>
                  <h3 className="text-base font-bold text-slate-900">Profile</h3>
                </div>

                <div className="bg-slate-50 rounded-xl p-5 border border-slate-200 space-y-4">
                  {profileSuccess && (
                    <div className="bg-emerald-50 border border-emerald-200 rounded-lg px-3 py-2 text-sm text-emerald-700 font-medium">{profileSuccess}</div>
                  )}
                  <div className="grid sm:grid-cols-2 gap-4">
                    <div>
                      <label className="block text-xs font-semibold text-slate-600 uppercase mb-1.5">Full Name</label>
                      <input
                        type="text"
                        value={fullName}
                        onChange={e => setFullName(e.target.value)}
                        className="w-full px-3 py-2.5 border border-slate-200 rounded-lg text-sm focus:ring-2 focus:ring-[var(--color-primary-200)] focus:border-[var(--color-primary)] outline-none bg-white"
                        placeholder="Your full name"
                      />
                    </div>
                    <div>
                      <label className="block text-xs font-semibold text-slate-600 uppercase mb-1.5">Email</label>
                      <div className="relative">
                        <input
                          type="email"
                          value={user.email}
                          disabled
                          className="w-full px-3 py-2.5 border border-slate-200 rounded-lg text-sm bg-slate-100 text-slate-500 cursor-not-allowed"
                        />
                        <span className="absolute right-3 top-1/2 -translate-y-1/2 text-[10px] font-semibold text-slate-400 bg-slate-200 px-1.5 py-0.5 rounded">Locked</span>
                      </div>
                    </div>
                  </div>
                  <button
                    onClick={handleSaveProfile}
                    disabled={savingProfile}
                    className="btn-primary px-5 py-2.5 rounded-lg text-sm font-bold disabled:opacity-50"
                  >
                    {savingProfile ? 'Saving...' : 'Save Profile'}
                  </button>
                </div>
              </div>

              <div className="border-t border-slate-200" />

              {/* ── Security ── */}
              <div className="space-y-4">
                <div className="flex items-center gap-2">
                  <div className="w-7 h-7 rounded-lg bg-rose-50 flex items-center justify-center">
                    <svg className="w-4 h-4 text-rose-600" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}><path strokeLinecap="round" strokeLinejoin="round" d="M16.5 10.5V6.75a4.5 4.5 0 10-9 0v3.75m-.75 11.25h10.5a2.25 2.25 0 002.25-2.25v-6.75a2.25 2.25 0 00-2.25-2.25H6.75a2.25 2.25 0 00-2.25 2.25v6.75a2.25 2.25 0 002.25 2.25z" /></svg>
                  </div>
                  <h3 className="text-base font-bold text-slate-900">Security</h3>
                </div>

                {/* Change Password */}
                <div className="bg-slate-50 rounded-xl p-5 border border-slate-200 space-y-4">
                  <h4 className="text-sm font-semibold text-slate-900">Change Password</h4>
                  {passwordError && (
                    <div className="bg-red-50 border border-red-200 rounded-lg px-3 py-2 text-sm text-red-700">{passwordError}</div>
                  )}
                  {passwordSuccess && (
                    <div className="bg-emerald-50 border border-emerald-200 rounded-lg px-3 py-2 text-sm text-emerald-700 font-medium">{passwordSuccess}</div>
                  )}
                  <div className="space-y-3">
                    <div>
                      <label className="block text-xs font-semibold text-slate-600 uppercase mb-1.5">New Password</label>
                      <div className="relative">
                        <input
                          type={showNewPw ? 'text' : 'password'}
                          value={newPassword}
                          onChange={e => setNewPassword(e.target.value)}
                          placeholder="Min. 8 characters"
                          className="w-full px-3 py-2.5 pr-10 border border-slate-200 rounded-lg text-sm focus:ring-2 focus:ring-[var(--color-primary-200)] focus:border-[var(--color-primary)] outline-none bg-white"
                        />
                        <button type="button" onClick={() => setShowNewPw(!showNewPw)} className="absolute right-3 top-1/2 -translate-y-1/2 text-slate-400 hover:text-slate-600">
                          <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>{showNewPw ? <><path strokeLinecap="round" strokeLinejoin="round" d="M3.98 8.223A10.477 10.477 0 001.934 12C3.226 16.338 7.244 19.5 12 19.5c.993 0 1.953-.138 2.863-.395M6.228 6.228A10.45 10.45 0 0112 4.5c4.756 0 8.773 3.162 10.065 7.498a10.523 10.523 0 01-4.293 5.774M6.228 6.228L3 3m3.228 3.228l3.65 3.65m7.894 7.894L21 21m-3.228-3.228l-3.65-3.65m0 0a3 3 0 10-4.243-4.243m4.242 4.242L9.88 9.88" /></> : <><path strokeLinecap="round" strokeLinejoin="round" d="M2.036 12.322a1.012 1.012 0 010-.639C3.423 7.51 7.36 4.5 12 4.5c4.638 0 8.573 3.007 9.963 7.178.07.207.07.431 0 .639C20.577 16.49 16.64 19.5 12 19.5c-4.638 0-8.573-3.007-9.963-7.178z" /><path strokeLinecap="round" strokeLinejoin="round" d="M15 12a3 3 0 11-6 0 3 3 0 016 0z" /></>}</svg>
                        </button>
                      </div>
                    </div>
                    <div>
                      <label className="block text-xs font-semibold text-slate-600 uppercase mb-1.5">Confirm Password</label>
                      <input
                        type={showNewPw ? 'text' : 'password'}
                        value={confirmPassword}
                        onChange={e => setConfirmPassword(e.target.value)}
                        placeholder="Repeat new password"
                        className="w-full px-3 py-2.5 border border-slate-200 rounded-lg text-sm focus:ring-2 focus:ring-[var(--color-primary-200)] focus:border-[var(--color-primary)] outline-none bg-white"
                      />
                    </div>
                  </div>
                  <button
                    onClick={handleChangePassword}
                    disabled={savingPassword || !newPassword || !confirmPassword}
                    className="btn-primary px-5 py-2.5 rounded-lg text-sm font-bold disabled:opacity-50"
                  >
                    {savingPassword ? 'Updating...' : 'Update Password'}
                  </button>
                </div>

                {/* Two-Factor Authentication */}
                <div className="bg-slate-50 rounded-xl p-5 border border-slate-200 space-y-4">
                  <div className="flex items-center justify-between">
                    <div>
                      <h4 className="text-sm font-semibold text-slate-900 flex items-center gap-2">
                        Two-Factor Authentication
                        {!mfaLoading && mfaFactors.length > 0 && (
                          <span className="inline-flex items-center gap-1 text-[10px] font-bold px-2 py-0.5 rounded-full bg-emerald-100 text-emerald-700 border border-emerald-200">
                            <svg className="w-2.5 h-2.5" fill="currentColor" viewBox="0 0 20 20"><path fillRule="evenodd" d="M10 18a8 8 0 100-16 8 8 0 000 16zm3.707-9.293a1 1 0 00-1.414-1.414L9 10.586 7.707 9.293a1 1 0 00-1.414 1.414l2 2a1 1 0 001.414 0l4-4z" clipRule="evenodd" /></svg>
                            Enabled
                          </span>
                        )}
                      </h4>
                      <p className="text-xs text-slate-500 mt-0.5">Use an authenticator app for extra account protection.</p>
                    </div>
                    {mfaLoading ? (
                      <div className="w-5 h-5 border border-slate-300 border-t-slate-600 rounded-full animate-spin" />
                    ) : mfaFactors.length > 0 ? (
                      <button
                        onClick={() => handleDisable2FA(mfaFactors[0].id)}
                        disabled={disabling2FA}
                        className="px-3 py-1.5 rounded-lg text-xs font-semibold text-red-600 bg-red-50 hover:bg-red-100 border border-red-200 transition-colors disabled:opacity-50"
                      >
                        {disabling2FA ? 'Disabling...' : 'Disable 2FA'}
                      </button>
                    ) : !mfaEnrollData ? (
                      <button
                        onClick={handleEnroll2FA}
                        disabled={enrolling}
                        className="px-3 py-1.5 rounded-lg text-xs font-bold text-white gradient-bg hover:opacity-90 transition-all shadow-sm disabled:opacity-50"
                      >
                        {enrolling ? 'Loading...' : 'Enable 2FA'}
                      </button>
                    ) : null}
                  </div>

                  {mfaError && (
                    <div className="bg-red-50 border border-red-200 rounded-lg px-3 py-2 text-sm text-red-700">{mfaError}</div>
                  )}
                  {mfaSuccess && (
                    <div className="bg-emerald-50 border border-emerald-200 rounded-lg px-3 py-2 text-sm text-emerald-700 font-medium">{mfaSuccess}</div>
                  )}

                  {mfaEnrollData && (
                    <div className="space-y-4 pt-2 border-t border-slate-200">
                      <p className="text-xs text-slate-600">Scan this QR code with your authenticator app (Google Authenticator, Authy, 1Password…)</p>
                      <div className="flex flex-col sm:flex-row gap-5 items-start">
                        <div className="bg-white border border-slate-200 rounded-xl p-3 shadow-sm flex-shrink-0">
                          <img
                            src={mfaEnrollData.qrCode}
                            alt="2FA QR Code"
                            className="w-40 h-40"
                          />
                        </div>
                        <div className="space-y-3 flex-1">
                          <div>
                            <p className="text-xs font-semibold text-slate-600 uppercase mb-1">Manual entry key</p>
                            <code className="block text-xs bg-slate-100 border border-slate-200 rounded-lg px-3 py-2 font-mono text-slate-700 break-all select-all">
                              {mfaEnrollData.secret}
                            </code>
                          </div>
                          <div>
                            <label className="block text-xs font-semibold text-slate-600 uppercase mb-1.5">Enter 6-digit code from app</label>
                            <div className="flex gap-2">
                              <input
                                type="text"
                                inputMode="numeric"
                                maxLength={6}
                                value={mfaCode}
                                onChange={e => setMfaCode(e.target.value.replace(/\D/g, ''))}
                                placeholder="000000"
                                className="flex-1 px-3 py-2.5 border border-slate-200 rounded-lg text-sm font-mono tracking-widest focus:ring-2 focus:ring-[var(--color-primary-200)] focus:border-[var(--color-primary)] outline-none bg-white"
                              />
                              <button
                                onClick={handleVerify2FA}
                                disabled={mfaVerifying || mfaCode.length < 6}
                                className="px-4 py-2.5 rounded-lg text-sm font-bold text-white gradient-bg hover:opacity-90 transition-all shadow-sm disabled:opacity-50"
                              >
                                {mfaVerifying ? 'Verifying...' : 'Verify & Enable'}
                              </button>
                            </div>
                          </div>
                          <button
                            onClick={() => { setMfaEnrollData(null); setMfaCode(''); setMfaError(''); }}
                            className="text-xs text-slate-400 hover:text-slate-600 transition-colors"
                          >
                            Cancel setup
                          </button>
                        </div>
                      </div>
                    </div>
                  )}
                </div>
              </div>

              <div className="border-t border-slate-200" />

              {/* ── Language ── */}
              <div className="space-y-4">
                <div className="flex items-center gap-2">
                  <div className="w-7 h-7 rounded-lg bg-blue-50 flex items-center justify-center">
                    <svg className="w-4 h-4 text-blue-600" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}><path strokeLinecap="round" strokeLinejoin="round" d="M10.5 21l5.25-11.25L21 21m-9-3h7.5M3 5.621a48.474 48.474 0 016-.371m0 0c1.12 0 2.233.038 3.334.114M9 5.25V3m3.334 2.364C11.176 10.658 7.69 15.08 3 17.502m9.334-12.138c.896.061 1.785.147 2.666.257m-4.589 8.495a18.023 18.023 0 01-3.827-5.802" /></svg>
                  </div>
                  <h3 className="text-base font-bold text-slate-900">{t.settings.language.title}</h3>
                </div>

                <div className="bg-slate-50 rounded-xl p-5 border border-slate-200 space-y-4">
                  <LanguageSelector value={language} onChange={(lang) => setLanguage(lang)} />
                  <button
                    onClick={async () => {
                      setSavingLanguage(true);
                      try {
                        const existingJsonSettings = (initialSettings.settings as Record<string, unknown>) || {};
                        const { error } = await supabase
                          .from('company_settings')
                          .update({ settings: { ...existingJsonSettings, language } })
                          .eq('company_id', initialCompany.id);
                        if (error) throw error;
                        setSuccess(t.settings.language.success);
                      } catch {
                        alert(t.settings.language.error);
                      } finally {
                        setSavingLanguage(false);
                      }
                    }}
                    disabled={savingLanguage}
                    className="btn-primary px-5 py-2.5 rounded-lg text-sm font-bold disabled:opacity-50"
                  >
                    {savingLanguage ? t.settings.language.saving : t.settings.language.saveButton}
                  </button>
                </div>
              </div>

              <div className="border-t border-slate-200" />

              {/* ── Notifications ── */}
              <div>
                <div className="flex items-center gap-2 mb-4">
                  <div className="w-7 h-7 rounded-lg bg-amber-50 flex items-center justify-center">
                    <svg className="w-4 h-4 text-amber-600" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}><path strokeLinecap="round" strokeLinejoin="round" d="M14.857 17.082a23.848 23.848 0 005.454-1.31A8.967 8.967 0 0118 9.75v-.7V9A6 6 0 006 9v.75a8.967 8.967 0 01-2.312 6.022c1.733.64 3.56 1.085 5.455 1.31m5.714 0a24.255 24.255 0 01-5.714 0m5.714 0a3 3 0 11-5.714 0" /></svg>
                  </div>
                  <h3 className="text-base font-bold text-slate-900">{t.settings.notifications.title}</h3>
                </div>
                <NotificationSettings
                  userId={user.id}
                  initialEnabled={user.notifications_enabled ?? true}
                />
              </div>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
