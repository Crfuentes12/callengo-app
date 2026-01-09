// app/(app)/settings/page.tsx
import { createServerClient } from '@/lib/supabase/server';
import SettingsManager from '@/components/settings/SettingsManager';

export default async function SettingsPage() {
  const supabase = await createServerClient();

  const { data: { user } } = await supabase.auth.getUser();

  const { data: userData } = await supabase
    .from('users')
    .select('company_id, full_name, role, notifications_enabled, companies(*)')
    .eq('id', user!.id)
    .single();

  const company = userData!.companies;

  let { data: settings } = await supabase
    .from('company_settings')
    .select('*')
    .eq('company_id', userData!.company_id)
    .single();

  if (!settings) {
    const { data: newSettings } = await supabase
      .from('company_settings')
      .insert({ company_id: userData!.company_id })
      .select()
      .single();
    settings = newSettings;
  }

  return (
    <SettingsManager
      company={company}
      settings={settings!}
      user={{
        id: user!.id,
        email: user!.email!,
        full_name: userData!.full_name,
        role: userData!.role,
        notifications_enabled: userData!.notifications_enabled
      }}
    />
  );
}
