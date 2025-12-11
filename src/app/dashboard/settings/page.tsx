// app/dashboard/settings/page.tsx
import { redirect } from 'next/navigation';
import { createServerClient } from '@/lib/supabase/server';
import Layout from '@/components/layout/Layout';
import SettingsManager from '@/components/settings/SettingsManager';

export default async function SettingsPage() {
  const supabase = await createServerClient();
  
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) redirect('/login');

  const { data: userData } = await supabase
    .from('users')
    .select('company_id, full_name, role, companies(*)')
    .eq('id', user.id)
    .single();

  if (!userData?.company_id) redirect('/signup');

  const company = userData.companies;
  if (!company) redirect('/signup');

  let { data: settings } = await supabase
    .from('company_settings')
    .select('*')
    .eq('company_id', userData.company_id)
    .single();

  if (!settings) {
    const { data: newSettings } = await supabase
      .from('company_settings')
      .insert({ company_id: userData.company_id })
      .select()
      .single();
    settings = newSettings;
  }

  return (
    <Layout
      user={{ 
        id: user.id, 
        email: user.email!, 
        full_name: userData.full_name 
      }}
      company={company}
      headerTitle="Settings"
      headerSubtitle="Configure your account and preferences"
    >
      <SettingsManager
        company={company}
        settings={settings!}
        user={{ 
          id: user.id, 
          email: user.email!, 
          full_name: userData.full_name, 
          role: userData.role 
        }}
      />
    </Layout>
  );
}