// lib/calendar/resource-routing.ts
// Doctor/Resource routing for calendar events.
// Routes events to the correct team member's calendar based on:
// - contact's doctor_assigned custom field
// - AI assignment from call analysis
// - manual assignment by the user
// Available on Business+ and Teams plans.

import { supabaseAdminRaw as supabaseAdmin } from '@/lib/supabase/service';

// ============================================================================
// TYPES
// ============================================================================

export interface TeamCalendarAssignment {
  id: string;
  company_id: string;
  user_id: string;
  display_name: string;
  email: string | null;
  role: string;
  color: string;
  is_active: boolean;
  google_calendar_id: string | null;
  microsoft_calendar_id: string | null;
  simplybook_provider_id: number | null;
  specialties: string[];
  max_daily_appointments: number;
  created_at: string;
  updated_at: string;
}

// ============================================================================
// TEAM MEMBER MANAGEMENT
// ============================================================================

/**
 * Get all active team calendar assignments for a company
 */
export async function getTeamMembers(
  companyId: string
): Promise<TeamCalendarAssignment[]> {
  const { data, error } = await supabaseAdmin
    .from('team_calendar_assignments')
    .select('*')
    .eq('company_id', companyId)
    .eq('is_active', true)
    .order('display_name');

  if (error) {
    console.error('[resource-routing] Error fetching team members:', error);
    return [];
  }

  return (data || []) as unknown as TeamCalendarAssignment[];
}

/**
 * Find the team member to assign an event to based on contact's doctor_assigned field.
 * Matches by name (fuzzy), email, or SimplyBook provider ID.
 */
export async function resolveAssignment(
  companyId: string,
  doctorAssigned: string | null | undefined
): Promise<TeamCalendarAssignment | null> {
  if (!doctorAssigned) return null;

  const members = await getTeamMembers(companyId);
  if (members.length === 0) return null;

  const searchTerm = doctorAssigned.toLowerCase().trim();

  // 1. Exact name match
  const exactMatch = members.find(
    m => m.display_name.toLowerCase() === searchTerm
  );
  if (exactMatch) return exactMatch;

  // 2. Partial name match (contains)
  const partialMatch = members.find(
    m => m.display_name.toLowerCase().includes(searchTerm) ||
         searchTerm.includes(m.display_name.toLowerCase())
  );
  if (partialMatch) return partialMatch;

  // 3. Email match
  const emailMatch = members.find(
    m => m.email?.toLowerCase() === searchTerm
  );
  if (emailMatch) return emailMatch;

  // 4. First-name match (for "Dr. Smith" → "John Smith")
  const lastNameMatch = members.find(m => {
    const parts = m.display_name.toLowerCase().split(/\s+/);
    return parts.some(part => searchTerm.includes(part) && part.length > 2);
  });
  if (lastNameMatch) return lastNameMatch;

  return null;
}

/**
 * Create or update a team calendar assignment
 */
export async function upsertTeamMember(
  companyId: string,
  params: {
    userId: string;
    displayName: string;
    email?: string;
    role?: string;
    color?: string;
    googleCalendarId?: string;
    microsoftCalendarId?: string;
    simplybookProviderId?: number;
    specialties?: string[];
    maxDailyAppointments?: number;
  }
): Promise<TeamCalendarAssignment | null> {
  const { data, error } = await supabaseAdmin
    .from('team_calendar_assignments')
    .upsert({
      company_id: companyId,
      user_id: params.userId,
      display_name: params.displayName,
      email: params.email || null,
      role: params.role || 'member',
      color: params.color || '#3b82f6',
      google_calendar_id: params.googleCalendarId || null,
      microsoft_calendar_id: params.microsoftCalendarId || null,
      simplybook_provider_id: params.simplybookProviderId || null,
      specialties: params.specialties || [],
      max_daily_appointments: params.maxDailyAppointments || 20,
      is_active: true,
    }, { onConflict: 'company_id,user_id' })
    .select('*')
    .single();

  if (error) {
    console.error('[resource-routing] Error upserting team member:', error);
    return null;
  }

  return data as unknown as TeamCalendarAssignment;
}

/**
 * Assign a calendar event to a team member.
 * Updates both the event record and optionally syncs to the member's external calendar.
 */
export async function assignEventToMember(
  eventId: string,
  member: TeamCalendarAssignment
): Promise<boolean> {
  const { error } = await supabaseAdmin
    .from('calendar_events')
    .update({
      assigned_to: member.id,
      assigned_to_name: member.display_name,
      updated_at: new Date().toISOString(),
    })
    .eq('id', eventId);

  if (error) {
    console.error('[resource-routing] Error assigning event:', error);
    return false;
  }

  return true;
}

/**
 * Auto-assign an event based on the contact's doctor_assigned field.
 * Called from webhook processing and event creation.
 */
export async function autoAssignEvent(
  companyId: string,
  eventId: string,
  contactId: string | null
): Promise<{ assigned: boolean; member?: TeamCalendarAssignment }> {
  if (!contactId) return { assigned: false };

  // Get the contact's doctor_assigned from custom_fields
  const { data: contact } = await supabaseAdmin
    .from('contacts')
    .select('custom_fields')
    .eq('id', contactId)
    .single();

  const cf = (contact?.custom_fields as Record<string, unknown>) || {};
  const doctorAssigned = (cf.doctor_assigned || cf.provider_name || cf.assigned_to || cf.medico) as string | undefined;

  if (!doctorAssigned) return { assigned: false };

  const member = await resolveAssignment(companyId, doctorAssigned);
  if (!member) return { assigned: false };

  const success = await assignEventToMember(eventId, member);
  return { assigned: success, member: success ? member : undefined };
}

// ============================================================================
// TEAM CALENDAR API
// ============================================================================

/**
 * Get calendar events for a specific team member
 */
export async function getMemberEvents(
  companyId: string,
  memberId: string,
  options: { startDate?: string; endDate?: string } = {}
): Promise<unknown[]> {
  let query = supabaseAdmin
    .from('calendar_events')
    .select('*')
    .eq('company_id', companyId)
    .eq('assigned_to', memberId);

  if (options.startDate) query = query.gte('start_time', options.startDate);
  if (options.endDate) query = query.lte('start_time', options.endDate);

  const { data } = await query.order('start_time', { ascending: true });
  return data || [];
}

/**
 * Get events grouped by team member for company calendar view
 */
export async function getTeamCalendarView(
  companyId: string,
  startDate: string,
  endDate: string
): Promise<{ member: TeamCalendarAssignment; eventCount: number }[]> {
  const members = await getTeamMembers(companyId);

  const results = await Promise.all(
    members.map(async (member) => {
      const { count } = await supabaseAdmin
        .from('calendar_events')
        .select('id', { count: 'exact', head: true })
        .eq('company_id', companyId)
        .eq('assigned_to', member.id)
        .gte('start_time', startDate)
        .lte('start_time', endDate);

      return { member, eventCount: count || 0 };
    })
  );

  return results;
}
