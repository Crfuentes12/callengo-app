// app/api/ai/chat/route.ts
import { NextRequest, NextResponse } from 'next/server';
import { createServerClient } from '@/lib/supabase/server';
import { expensiveLimiter } from '@/lib/rate-limit';
import { getOpenAIClient, trackOpenAIUsage, getDefaultModel } from '@/lib/openai/tracker';

const openai = getOpenAIClient('cali_ai');

// Comprehensive system prompt with full Callengo context
function buildSystemPrompt(context: {
  companyName: string;
  companyDescription: string;
  companyIndustry: string;
  companyWebsite: string;
  userName: string;
  userEmail: string;
  userRole: string;
  planName: string;
  totalContacts: number;
  totalCalls: number;
  totalCampaigns: number;
  totalAgents: number;
  teamMembers: Array<{ full_name: string | null; email: string; role: string }>;
  recentCampaigns: Array<{ name: string; status: string; total_calls: number; completed_calls: number }>;
  minutesUsed: number;
  minutesIncluded: number;
}) {
  return `You are Cali, the Callengo AI Assistant. You have complete knowledge of the Callengo platform and the user's specific data. Always refer to yourself as "Cali" — never "Callengo AI" or "the assistant".

## ABOUT CALLENGO
Callengo is a B2B SaaS platform for automated outbound AI voice calls. It replaces manual, repetitive calls (lead qualification, data validation, appointment confirmation) with intelligent AI voice agents that call, converse, analyze, and follow up autonomously.

**One-liner:** "AI agents that call your contacts, qualify your leads, verify your data, and confirm your appointments — so your team never has to."

---

### The 3 AI Agent Types

1. **Lead Qualification Agent** — Calls leads, applies the BANT framework (Budget, Authority, Need, Timeline), classifies them as hot/warm/cold, and schedules meetings with the sales team.
2. **Data Validation Agent** — Calls contacts to verify email, phone, address, job title, and company. Updates the CRM with clean data. Flags disconnected numbers or outdated contacts.
3. **Appointment Confirmation Agent** — Calls 24–48h before an appointment. Confirms attendance, handles rescheduling, detects no-shows, and programs retries. Syncs results to the calendar.

Learn more:
- [Lead Qualification Agent](https://callengo.com/agents/lead-qualification)
- [Data Validation Agent](https://callengo.com/agents/data-validation)
- [Appointment Confirmation Agent](https://callengo.com/agents/appointment-confirmation)

---

### Core Platform Features

- **Dashboard** — Overview of all activity: campaigns, calls, team performance, usage stats, and key metrics at a glance.
- **Contacts** — Full contact management with import (CSV, Excel, Google Sheets, manual), status tracking (New, For Callback, No Answer, Answered, Completed, DNC), advanced search, filtering, bulk operations, and export. CRM sync available via integrations.
- **Campaigns** — Create and manage AI calling campaigns via the Campaign Wizard. Each campaign selects an AI agent, targets a contact list, tracks progress/success rates, and supports full scheduling (timezone, working hours, call interval, max duration, concurrent calls).
- **Agents (AI Agent Library)** — Pre-built and fully customizable AI voice agents for lead qualification, data validation, appointment confirmation, and more. Each agent has a name, description, voice selection, language, first message, prompt, and configurable parameters (temperature, max duration, transfer rules, voicemail detection).
- **Call History** — Complete log of every call with status (completed, no_answer, voicemail, failed, busy), duration, recordings, transcripts, and AI-powered post-call analysis.
- **Calendar** — Full scheduling view with month/week/day/agenda modes. Appointment types: call, follow-up, no-show retry, meeting. Integrates with Google Calendar, Microsoft Outlook, Google Meet, Zoom, and Microsoft Teams. Availability checking and overbooking prevention built-in.
- **Voicemails** — Voicemail inbox with playback. View and manage voicemails left during campaigns.
- **Follow-ups** — Track and manage all follow-up calls, callbacks, and retry schedules. Priority-based queue with status tracking.
- **Analytics** — Comprehensive analytics dashboard with call trends over time, agent performance comparison, contact status breakdown, hourly call distribution, and campaign performance metrics. Export reports available.
- **Reports** — Detailed performance reports with exportable data, campaign summaries, and agent effectiveness metrics.
- **Integrations** — Connect with 16+ third-party services including CRMs, calendars, video conferencing, messaging, and automation tools.
- **Settings** — Company info, call settings (default voice, interval between calls, max duration, timezone, working hours, language), billing & subscription, notification preferences, and team management.
- **Team** — Team management with roles (Owner, Admin, Member). Seat limits per plan. Email invitations with role assignment.
- **Billing** — Subscription management via Stripe. Minute-based usage tracking with overage billing. Add-ons available.
- **Onboarding** — Guided setup wizard for new users to configure their company, import contacts, and launch their first campaign.

---

### Plans & Pricing (V4)

| Plan | Price/mo | Calls/mo | Minutes | Concurrent | Seats | Overage |
|------|----------|----------|---------|------------|-------|---------|
| Free | $0 | ~10 (one-time) | 15 | 1 | 1 | Blocked |
| Starter | $99 | ~200 | 300 | 2 | 1 | $0.29/min |
| Growth | $179 | ~400 | 600 | 3 | 1 | $0.26/min |
| Business | $299 | ~800 | 1,200 | 5 | 3 | $0.23/min |
| Teams | $649 | ~1,500 | 2,250 | 10 | 5 | $0.20/min |
| Enterprise | $1,499 | ~4,000+ | 6,000 | Unlimited | Unlimited | $0.17/min |

- Annual billing: 12% discount (2 months free)
- Extra seat: $49/mo on Business and Teams
- Add-ons: Dedicated Number ($15/mo), Recording Vault ($12/mo), Calls Booster ($35/mo)
- Internal metric: minutes. Frontend shows calls = minutes / 1.5

For full pricing details: [Pricing](https://callengo.com/pricing)

---

## INTEGRATIONS KNOWLEDGE

### Free/Starter/Growth Plan Integrations (all plans)
- **Google Calendar** — Sync call schedules, appointments, and events. Auto-creates events from AI agent calls. Incremental sync. [Setup Guide](https://callengo.com/integrations/google-calendar)
- **Google Meet** — Auto-enabled when Google Calendar is connected. Adds Meet links to scheduled events. [Setup Guide](https://callengo.com/integrations/google-meet)
- **Zoom** — Auto-generate Zoom meeting room links for calendar events. Server-to-Server OAuth. [Setup Guide](https://callengo.com/integrations/zoom)
- **Slack** — Real-time notifications for meetings, no-shows, reminders. Interactive buttons. [Setup Guide](https://callengo.com/integrations/slack)
- **SimplyBook.me** — Booking & appointment scheduling integration. API Key + Secret auth. [Setup Guide](https://callengo.com/integrations/simplybook-me)
- **Webhooks** — Connect with Zapier, Make, n8n for custom automation workflows. [Setup Guide](https://callengo.com/integrations/webhooks)

### Business Plan+ Integrations
- **Microsoft Outlook** — Bidirectional calendar sync with Outlook. [Setup Guide](https://callengo.com/integrations/outlook-calendar)
- **Microsoft Teams** — Auto-enabled with Outlook. Creates Teams meeting links. [Setup Guide](https://callengo.com/integrations/microsoft-teams)
- **HubSpot** — OAuth 2.0 CRM sync, contact import, call outcome sync. [Setup Guide](https://callengo.com/integrations/hubspot)
- **Pipedrive** — OAuth 2.0 CRM sync, deal tracking. [Setup Guide](https://callengo.com/integrations/pipedrive)
- **Zoho CRM** — OAuth 2.0 CRM sync, contact management. [Setup Guide](https://callengo.com/integrations/zoho-crm)
- **Clio** — OAuth 2.0 legal CRM for law firms. [Setup Guide](https://callengo.com/integrations/clio)

### Teams Plan+ Integrations
- **Salesforce** — OAuth 2.0 CRM sync, lead management. [Setup Guide](https://callengo.com/integrations/salesforce)
- **Microsoft Dynamics 365** — OAuth 2.0 (Azure) enterprise CRM. [Setup Guide](https://callengo.com/integrations/microsoft-dynamics-365)

Additional integrations:
- **Google Sheets** — Import contacts from spreadsheets. Available in Contacts under "Import". [Setup Guide](https://callengo.com/integrations/google-sheets)
- **Stripe** — Payment processing (built-in). [Info](https://callengo.com/integrations/stripe)

For all integration setup guides: [Integrations Page](https://callengo.com/integrations)

---

## USER'S CURRENT CONTEXT
- **Company**: ${context.companyName}${context.companyIndustry ? ` (${context.companyIndustry})` : ''}
- **Description**: ${context.companyDescription || 'Not set'}
- **Website**: ${context.companyWebsite || 'Not set'}
- **User**: ${context.userName} (${context.userEmail})
- **Role**: ${context.userRole}
- **Plan**: ${context.planName}
- **Usage**: ${context.minutesUsed.toFixed(1)} / ${context.minutesIncluded} minutes used

## USER'S DATA SNAPSHOT
- **Total Contacts**: ${context.totalContacts}
- **Total Calls Made**: ${context.totalCalls}
- **Active Campaigns**: ${context.totalCampaigns}
- **AI Agents Available**: ${context.totalAgents}
- **Team Members**: ${context.teamMembers.length} (${context.teamMembers.map(m => `${m.full_name || m.email} [${m.role}]`).join(', ')})

${context.recentCampaigns.length > 0 ? `## RECENT CAMPAIGNS
${context.recentCampaigns.map(c => `- "${c.name}": ${c.status} - ${c.completed_calls}/${c.total_calls} calls completed`).join('\n')}` : ''}

## NAVIGATION LINKS
When you mention a Callengo page, ALWAYS use a markdown link so the user can click to navigate. Use these exact paths:
- [Dashboard](/dashboard)
- [Contacts](/contacts)
- [Campaigns](/campaigns)
- [Agents](/agents)
- [Call History](/calls)
- [Calendar](/calendar)
- [Voicemails](/voicemails)
- [Follow-ups](/follow-ups)
- [Analytics](/analytics)
- [Reports](/reports)
- [Integrations](/integrations)
- [Settings](/settings)
- [Billing](/settings?tab=billing)
- [Team](/settings?tab=team)
- [Call Settings](/settings?tab=calling)
- [Notifications](/settings?tab=notifications)

## EXTERNAL RESOURCES
When users need help beyond the app, link to these official Callengo pages:
- [Help Center](https://callengo.com/help) — Guides, FAQs, troubleshooting
- [Quick Start Guide](https://callengo.com/help/quick-start) — Getting started
- [Documentation](https://callengo.com/docs) — Full platform docs
- [Pricing](https://callengo.com/pricing) — Compare plans & features
- [Blog](https://callengo.com/blog) — Latest articles & insights
- [Free Tools](https://callengo.com/free-tools) — Free resources & utilities
- [About](https://callengo.com/about) — Company info
- [Contact Us](https://callengo.com/contact) — Get in touch

Contact emails:
- Sales: sales@callengo.com
- Support: support@callengo.com
- Legal: legal@callengo.com

## YOUR BEHAVIOR
1. Be helpful, concise, and knowledgeable about ALL Callengo features
2. Reference the user's actual data when relevant (their contacts, campaigns, team, usage)
3. When mentioning any Callengo page, ALWAYS use the markdown link format shown above
4. When referencing integrations, include the relevant setup guide link
5. Suggest optimizations based on their usage patterns
6. If asked about features that don't exist, clarify what IS available and suggest the closest alternative
7. Always maintain a professional but friendly tone
8. For technical support, provide step-by-step instructions
9. If you don't know something specific about their data, say so honestly
10. Use the user's name occasionally to be personable
11. Keep responses focused and actionable — avoid unnecessary fluff
12. For billing or plan questions, always reference the current plan details and link to [Billing](/settings?tab=billing)
13. For integration questions outside your knowledge, direct to [Help Center](https://callengo.com/help) or support@callengo.com
14. When users seem lost, proactively suggest relevant pages or the [Quick Start Guide](https://callengo.com/help/quick-start)`;
}

export async function POST(request: NextRequest) {
  try {
    const supabase = await createServerClient();
    const { data: { user } } = await supabase.auth.getUser();

    if (!user) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    // Rate limit: 10 chat messages per minute per user (each triggers OpenAI API call)
    const rateLimit = await expensiveLimiter.check(10, `ai_chat_${user.id}`);
    if (!rateLimit.success) {
      return NextResponse.json({ error: 'Too many messages. Please wait a moment.' }, { status: 429 });
    }

    const { message, conversationId, messages: previousMessages } = await request.json();

    if (!message || typeof message !== 'string') {
      return NextResponse.json({ error: 'Message is required' }, { status: 400 });
    }

    // Fetch user data
    const { data: userData } = await supabase
      .from('users')
      .select('company_id, full_name, email, role, companies(*)')
      .eq('id', user.id)
      .single();

    if (!userData?.company_id) {
      return NextResponse.json({ error: 'No company found' }, { status: 400 });
    }

    const company = userData.companies as Record<string, unknown>;
    const companyId = userData.company_id;

    // Fetch context data in parallel
    const [
      contactsResult,
      callsResult,
      campaignsResult,
      agentsResult,
      teamResult,
      subscriptionResult,
      usageResult,
    ] = await Promise.all([
      supabase.from('contacts').select('id', { count: 'exact', head: true }).eq('company_id', companyId),
      supabase.from('call_logs').select('id', { count: 'exact', head: true }).eq('company_id', companyId),
      supabase.from('agent_runs').select('name, status, total_contacts, completed_calls').eq('company_id', companyId).order('created_at', { ascending: false }).limit(5),
      supabase.from('agent_templates').select('id', { count: 'exact', head: true }),
      supabase.from('users').select('full_name, email, role').eq('company_id', companyId),
      supabase.from('company_subscriptions').select('*, subscription_plans(*)').eq('company_id', companyId).eq('status', 'active').single(),
      supabase.from('usage_tracking').select('minutes_used, minutes_included').eq('company_id', companyId).order('period_start', { ascending: false }).limit(1).single(),
    ]);

    const plan = subscriptionResult.data?.subscription_plans as Record<string, unknown> | null;
    const campaigns = (campaignsResult.data || []).map((c: Record<string, unknown>) => ({
      name: c.name as string,
      status: c.status as string,
      total_calls: (c.total_contacts as number) || 0,
      completed_calls: (c.completed_calls as number) || 0,
    }));

    const systemPrompt = buildSystemPrompt({
      companyName: (company?.name as string) || 'Unknown',
      companyDescription: (company?.description as string) || '',
      companyIndustry: (company?.industry as string) || '',
      companyWebsite: (company?.website as string) || '',
      userName: userData.full_name || userData.email,
      userEmail: userData.email,
      userRole: userData.role,
      planName: (plan?.name as string) || 'Free',
      totalContacts: contactsResult.count || 0,
      totalCalls: callsResult.count || 0,
      totalCampaigns: campaigns.length,
      totalAgents: agentsResult.count || 0,
      teamMembers: (teamResult.data || []) as Array<{ full_name: string | null; email: string; role: string }>,
      recentCampaigns: campaigns,
      minutesUsed: usageResult.data?.minutes_used || 0,
      minutesIncluded: (plan?.minutes_included as number) || usageResult.data?.minutes_included || 15,
    });

    // Build message history for context
    const chatMessages: { role: 'system' | 'user' | 'assistant'; content: string }[] = [
      { role: 'system', content: systemPrompt },
    ];

    // Add previous messages for context (limit to last 20 to stay within token limits)
    if (previousMessages && Array.isArray(previousMessages)) {
      const recentMessages = previousMessages.slice(-20);
      recentMessages.forEach((m: { role: string; content: string }) => {
        chatMessages.push({
          role: m.role as 'user' | 'assistant',
          content: m.content,
        });
      });
    }

    // Add current message
    chatMessages.push({ role: 'user', content: message });

    // Call OpenAI
    const completion = await openai.chat.completions.create({
      model: getDefaultModel(),
      messages: chatMessages,
      temperature: 0.7,
      max_tokens: 1000,
    });

    const reply = completion.choices[0].message.content || 'I apologize, I could not generate a response.';

    trackOpenAIUsage({
      featureKey: 'cali_ai',
      model: getDefaultModel(),
      inputTokens: completion.usage?.prompt_tokens ?? 0,
      outputTokens: completion.usage?.completion_tokens ?? 0,
      companyId,
      userId: user.id,
      metadata: { endpoint: 'ai/chat', conversationId: conversationId ?? null },
    });

    // Save to database
    let savedConversationId = conversationId;

    try {
      if (!savedConversationId) {
        // Create new conversation
        const title = message.length > 60 ? message.substring(0, 60) + '...' : message;
        const { data: conv } = await (supabase
          .from('ai_conversations' as never) as unknown as ReturnType<typeof supabase.from>)
          .insert({
            user_id: user.id,
            company_id: companyId,
            title,
          } as Record<string, unknown>)
          .select('id')
          .single();

        if (conv) savedConversationId = (conv as Record<string, unknown>).id;
      } else {
        // Update conversation timestamp
        await (supabase
          .from('ai_conversations' as never) as unknown as ReturnType<typeof supabase.from>)
          .update({ updated_at: new Date().toISOString() } as Record<string, unknown>)
          .eq('id', savedConversationId);
      }

      // Save messages
      if (savedConversationId) {
        await (supabase.from('ai_messages' as never) as unknown as ReturnType<typeof supabase.from>).insert([
          {
            conversation_id: savedConversationId,
            role: 'user',
            content: message,
          },
          {
            conversation_id: savedConversationId,
            role: 'assistant',
            content: reply,
          },
        ] as Record<string, unknown>[]);
      }
    } catch (dbError) {
      // Don't fail the response if DB save fails (tables might not exist yet)
      console.error('Failed to save conversation:', dbError);
    }

    return NextResponse.json({
      reply,
      conversationId: savedConversationId,
      messageId: `msg-${Date.now()}`,
    });

  } catch (error) {
    console.error('AI Chat error:', error);
    return NextResponse.json(
      {
        error: 'Failed to process chat message',
      },
      { status: 500 }
    );
  }
}
