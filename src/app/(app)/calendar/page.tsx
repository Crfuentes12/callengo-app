// app/(app)/calendar/page.tsx
import { createServerClient } from '@/lib/supabase/server';
import { supabaseAdminRaw as supabaseAdmin } from '@/lib/supabase/service';
import CalendarPage from '@/components/calendar/CalendarPage';
import type { CalendarEvent, CalendarIntegrationStatus } from '@/types/calendar';

export const dynamic = 'force-dynamic';

export default async function Calendar() {
  const supabase = await createServerClient();

  const { data: { user } } = await supabase.auth.getUser();

  const { data: userData } = await supabase
    .from('users')
    .select('company_id')
    .eq('id', user!.id)
    .single();

  const companyId = userData!.company_id;

  // Fetch calendar events from the database (3 months back, 3 months forward)
  const threeMonthsAgo = new Date();
  threeMonthsAgo.setMonth(threeMonthsAgo.getMonth() - 3);
  const threeMonthsAhead = new Date();
  threeMonthsAhead.setMonth(threeMonthsAhead.getMonth() + 3);

  const { data: calendarEvents } = await supabaseAdmin
    .from('calendar_events')
    .select('*')
    .eq('company_id', companyId)
    .gte('start_time', threeMonthsAgo.toISOString())
    .lte('start_time', threeMonthsAhead.toISOString())
    .order('start_time', { ascending: true });

  // Fetch integration statuses
  const { data: integrations } = await supabaseAdmin
    .from('calendar_integrations')
    .select('provider, provider_email, provider_user_name, last_synced_at, id, is_active')
    .eq('company_id', companyId)
    .eq('is_active', true);

  const integrationStatuses: CalendarIntegrationStatus[] = [
    { provider: 'google_calendar', connected: false },
    { provider: 'calendly', connected: false },
  ];

  if (integrations) {
    for (const integration of integrations) {
      const idx = integrationStatuses.findIndex(s => s.provider === integration.provider);
      if (idx !== -1) {
        integrationStatuses[idx] = {
          provider: integration.provider as 'google_calendar' | 'calendly',
          connected: true,
          email: integration.provider_email || undefined,
          user_name: integration.provider_user_name || undefined,
          last_synced: integration.last_synced_at || undefined,
          integration_id: integration.id,
        };
      }
    }
  }

  // Fetch contacts for the schedule modal
  const { data: contacts } = await supabase
    .from('contacts')
    .select('id, contact_name, phone_number, email')
    .eq('company_id', companyId)
    .limit(100);

  // Fetch working hours from company settings
  const { data: companySettings } = await supabaseAdmin
    .from('company_settings')
    .select('settings')
    .eq('company_id', companyId)
    .single();

  const additionalSettings = (companySettings?.settings ?? {}) as Record<string, unknown>;
  const workingHours = {
    start: (additionalSettings.working_hours_start as string) || '09:00',
    end: (additionalSettings.working_hours_end as string) || '18:00',
  };

  return (
    <CalendarPage
      events={(calendarEvents || []) as unknown as CalendarEvent[]}
      integrations={integrationStatuses}
      companyId={companyId}
      workingHours={workingHours}
      contacts={(contacts || []).map(c => ({
        id: c.id,
        contact_name: c.contact_name,
        phone_number: c.phone_number,
        email: c.email,
      }))}
    />
  );
}
