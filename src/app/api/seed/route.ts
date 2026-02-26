// app/api/seed/route.ts
// Seeds mock data for the demo user (crfuentes12@gmail.com) only
// POST /api/seed - Seeds all mock data
// DELETE /api/seed - Removes all seeded mock data

import { NextResponse } from 'next/server';
import { supabaseAdmin } from '@/lib/supabase/service';
import {
  DEMO_USER_EMAIL,
  generateContactLists,
  generateContacts,
  generateCompanyAgents,
  generateAgentRuns,
  generateCallLogs,
  generateFollowUpQueue,
  generateVoicemailLogs,
  generateUsageTracking,
  generateNotifications,
} from '@/lib/mock-data';

async function getDemoUserCompany() {
  // Find the demo user
  const { data: demoUser, error: userError } = await supabaseAdmin
    .from('users')
    .select('id, company_id')
    .eq('email', DEMO_USER_EMAIL)
    .single();

  if (userError || !demoUser) {
    return { error: `Demo user ${DEMO_USER_EMAIL} not found` };
  }

  return { userId: demoUser.id, companyId: demoUser.company_id };
}

async function getAgentTemplateIds() {
  const { data: templates } = await supabaseAdmin
    .from('agent_templates')
    .select('id, slug')
    .eq('is_active', true);

  if (!templates || templates.length === 0) {
    return null;
  }

  const dataValidation = templates.find((t: { id: string; slug: string }) => t.slug === 'data-validation');
  const appointmentConfirmation = templates.find((t: { id: string; slug: string }) => t.slug === 'appointment-confirmation');
  const leadQualification = templates.find((t: { id: string; slug: string }) => t.slug === 'lead-qualification');

  if (!dataValidation || !appointmentConfirmation || !leadQualification) {
    return null;
  }

  return {
    dataValidation: dataValidation.id,
    appointmentConfirmation: appointmentConfirmation.id,
    leadQualification: leadQualification.id,
  };
}

export async function POST() {
  try {
    const result = await getDemoUserCompany();
    if ('error' in result) {
      return NextResponse.json({ error: result.error }, { status: 404 });
    }

    const { userId, companyId } = result;

    const templateIds = await getAgentTemplateIds();
    if (!templateIds) {
      return NextResponse.json({ error: 'Agent templates not found. Run migrations first.' }, { status: 404 });
    }

    // Get existing subscription for usage tracking
    const { data: existingSubscription } = await supabaseAdmin
      .from('company_subscriptions')
      .select('id')
      .eq('company_id', companyId)
      .eq('status', 'active')
      .single();

    // ── 1. Clean existing demo data first ──
    // Delete in correct order to respect foreign keys
    await supabaseAdmin.from('voicemail_logs').delete().eq('company_id', companyId);
    await supabaseAdmin.from('follow_up_queue').delete().eq('company_id', companyId);
    await supabaseAdmin.from('call_queue').delete().eq('company_id', companyId);
    await supabaseAdmin.from('calendar_events').delete().eq('company_id', companyId);
    await supabaseAdmin.from('call_logs').delete().eq('company_id', companyId);
    await supabaseAdmin.from('notifications').delete().eq('company_id', companyId);
    await supabaseAdmin.from('agent_runs').delete().eq('company_id', companyId);
    await supabaseAdmin.from('company_agents').delete().eq('company_id', companyId);
    await supabaseAdmin.from('contacts').delete().eq('company_id', companyId);
    await supabaseAdmin.from('contact_lists').delete().eq('company_id', companyId);
    await supabaseAdmin.from('usage_tracking').delete().eq('company_id', companyId);
    // Clean AI conversations (user-scoped, need userId)
    await supabaseAdmin.from('ai_conversations').delete().eq('company_id', companyId);

    // ── 2. Generate all mock data ──
    const contactLists = generateContactLists(companyId);
    const listIds = contactLists.map(l => l.id);

    const contacts = generateContacts(companyId, listIds);
    const companyAgents = generateCompanyAgents(companyId, templateIds);
    const agentRuns = generateAgentRuns(companyId, templateIds);

    const contactsForCallLogs = contacts.map(c => ({
      id: c.id,
      status: c.status,
      call_attempts: c.call_attempts,
      call_outcome: c.call_outcome,
    }));

    const agentRunsForCallLogs = agentRuns.map(r => ({
      id: r.id,
      agent_template_id: r.agent_template_id,
    }));

    const callLogs = generateCallLogs(companyId, contactsForCallLogs, agentRunsForCallLogs, templateIds);

    const contactsForFollowUp = contacts.map(c => ({
      id: c.id,
      status: c.status,
      call_outcome: c.call_outcome,
    }));

    const callLogsForFollowUp = callLogs.map(cl => ({
      id: cl.id as string,
      contact_id: cl.contact_id as string | null,
      agent_run_id: cl.agent_run_id,
    }));

    const followUpQueue = generateFollowUpQueue(
      companyId,
      contactsForFollowUp,
      agentRuns.map(r => ({ id: r.id })),
      callLogsForFollowUp
    );

    const voicemailLogs = generateVoicemailLogs(
      companyId,
      contactsForFollowUp,
      callLogsForFollowUp,
      agentRuns.map(r => ({ id: r.id }))
    );

    const usageTracking = generateUsageTracking(companyId, existingSubscription?.id || null);
    const notifications = generateNotifications(companyId, userId);

    // ── 3. Insert all data in correct order ──
    const { error: listsError } = await supabaseAdmin.from('contact_lists').insert(contactLists);
    if (listsError) {
      return NextResponse.json({ error: `Failed to insert contact lists: ${listsError.message}` }, { status: 500 });
    }

    const { error: contactsError } = await supabaseAdmin.from('contacts').insert(contacts);
    if (contactsError) {
      return NextResponse.json({ error: `Failed to insert contacts: ${contactsError.message}` }, { status: 500 });
    }

    const { error: agentsError } = await supabaseAdmin.from('company_agents').insert(companyAgents);
    if (agentsError) {
      return NextResponse.json({ error: `Failed to insert company agents: ${agentsError.message}` }, { status: 500 });
    }

    const { error: runsError } = await supabaseAdmin.from('agent_runs').insert(agentRuns as never[]);
    if (runsError) {
      return NextResponse.json({ error: `Failed to insert agent runs: ${runsError.message}` }, { status: 500 });
    }

    const { error: callsError } = await supabaseAdmin.from('call_logs').insert(callLogs as never[]);
    if (callsError) {
      return NextResponse.json({ error: `Failed to insert call logs: ${callsError.message}` }, { status: 500 });
    }

    if (followUpQueue.length > 0) {
      const { error: followUpError } = await supabaseAdmin.from('follow_up_queue').insert(followUpQueue as never[]);
      if (followUpError) {
        return NextResponse.json({ error: `Failed to insert follow-up queue: ${followUpError.message}` }, { status: 500 });
      }
    }

    if (voicemailLogs.length > 0) {
      const { error: voicemailError } = await supabaseAdmin.from('voicemail_logs').insert(voicemailLogs as never[]);
      if (voicemailError) {
        return NextResponse.json({ error: `Failed to insert voicemail logs: ${voicemailError.message}` }, { status: 500 });
      }
    }

    const { error: usageError } = await supabaseAdmin.from('usage_tracking').insert(usageTracking);
    if (usageError) {
      return NextResponse.json({ error: `Failed to insert usage tracking: ${usageError.message}` }, { status: 500 });
    }

    const { error: notificationsError } = await supabaseAdmin.from('notifications').insert(notifications);
    if (notificationsError) {
      return NextResponse.json({ error: `Failed to insert notifications: ${notificationsError.message}` }, { status: 500 });
    }

    return NextResponse.json({
      success: true,
      message: `Mock data seeded successfully for ${DEMO_USER_EMAIL}`,
      summary: {
        contact_lists: contactLists.length,
        contacts: contacts.length,
        company_agents: companyAgents.length,
        agent_runs: agentRuns.length,
        call_logs: callLogs.length,
        follow_up_queue: followUpQueue.length,
        voicemail_logs: voicemailLogs.length,
        notifications: notifications.length,
      },
    });
  } catch (error) {
    console.error('Seed error:', error);
    return NextResponse.json(
      { error: error instanceof Error ? error.message : 'Unknown error' },
      { status: 500 }
    );
  }
}

export async function DELETE() {
  try {
    const result = await getDemoUserCompany();
    if ('error' in result) {
      return NextResponse.json({ error: result.error }, { status: 404 });
    }

    const { companyId } = result;

    // Delete in correct order to respect foreign keys
    await supabaseAdmin.from('voicemail_logs').delete().eq('company_id', companyId);
    await supabaseAdmin.from('follow_up_queue').delete().eq('company_id', companyId);
    await supabaseAdmin.from('call_queue').delete().eq('company_id', companyId);
    await supabaseAdmin.from('calendar_events').delete().eq('company_id', companyId);
    await supabaseAdmin.from('call_logs').delete().eq('company_id', companyId);
    await supabaseAdmin.from('notifications').delete().eq('company_id', companyId);
    await supabaseAdmin.from('agent_runs').delete().eq('company_id', companyId);
    await supabaseAdmin.from('company_agents').delete().eq('company_id', companyId);
    await supabaseAdmin.from('contacts').delete().eq('company_id', companyId);
    await supabaseAdmin.from('contact_lists').delete().eq('company_id', companyId);
    await supabaseAdmin.from('usage_tracking').delete().eq('company_id', companyId);
    await supabaseAdmin.from('ai_conversations').delete().eq('company_id', companyId);

    return NextResponse.json({
      success: true,
      message: `All mock data removed for ${DEMO_USER_EMAIL}`,
    });
  } catch (error) {
    console.error('Cleanup error:', error);
    return NextResponse.json(
      { error: error instanceof Error ? error.message : 'Unknown error' },
      { status: 500 }
    );
  }
}
