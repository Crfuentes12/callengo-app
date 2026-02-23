// app/api/ai/chat/route.ts
import { NextRequest, NextResponse } from 'next/server';
import { createServerClient } from '@/lib/supabase/server';
import OpenAI from 'openai';

const openai = new OpenAI({
  apiKey: process.env.OPENAI_API_KEY,
});

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
  return `You are Cali, the Callengo AI Assistant. You have complete knowledge of the software and the user's specific data. Always refer to yourself as "Cali" — never "Callengo AI".

## ABOUT CALLENGO
Callengo is an AI-powered voice calling platform that helps businesses automate outbound calls using AI agents. Key features include:

### Core Features
- **Dashboard**: Overview of all activity - campaigns, calls, team, usage stats
- **Contacts**: Contact management with import (CSV/manual), status tracking (New, For Callback, No Answer, Answered, Completed, DNC), search, filtering, and bulk operations
- **Campaigns**: Create and manage AI calling campaigns. Each campaign uses an AI agent, targets a contact list, tracks progress/success rates, supports scheduling (timezone, working hours, interval between calls, max duration)
- **Agents (AI Agents Library)**: Pre-built and customizable AI voice agents for different purposes (sales, customer support, appointment setting, surveys, debt collection, lead qualification, real estate, insurance, etc.). Each agent has a name, description, voice, language, first message, prompt, and configurable parameters
- **Call History**: Complete log of all calls with status (completed, no_answer, voicemail, failed, busy), duration, recordings, transcripts, and AI analysis
- **Calendar**: Scheduling view with month/week/day/agenda modes, appointment types (call, follow-up, no-show retry, meeting), integration with Google Calendar and Microsoft Outlook, video call links (Google Meet, Zoom, Teams), availability checking, and overbooking prevention
- **Voicemails**: View and manage voicemails left during campaigns
- **Follow-ups**: Track and manage follow-up calls and callbacks
- **Analytics**: Comprehensive analytics with call trends, agent performance, contact status breakdown, hourly distribution, campaign performance metrics
- **Integrations**: Connect with Twilio (phone numbers), Google Calendar, Microsoft 365 Outlook, Slack, Zoom, Google Meet, Microsoft Teams, and more
- **Settings**: Company info, call settings (default voice, interval, max duration, timezone, working hours, language), billing, notifications
- **Team**: Team management with roles (Owner, Admin, Member), seat limits per plan, invitations
- **Billing**: Subscription plans (Free, Starter, Business, Teams, Enterprise) with minute-based usage tracking

### Plans & Pricing
- Free: 15 minutes, 1 seat
- Starter: More minutes, 1 seat
- Business: More minutes, 3 seats
- Teams: More minutes, 5 seats (+$79/extra seat)
- Enterprise: Unlimited

### Technical Stack
- Next.js 14+ with App Router
- Supabase (PostgreSQL + Auth + Realtime + Storage)
- Bland AI for voice calls
- Twilio for phone numbers
- OpenAI for call analysis and recommendations
- Stripe for payments

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
- [Integrations](/integrations)
- [Settings](/settings)
- [Billing](/billing)

Examples: "Go to [Campaigns](/campaigns) and click Create New Campaign", "You can check your usage in [Billing](/billing)", "Head over to [Contacts](/contacts) to import your list."

## YOUR BEHAVIOR
1. Be helpful, concise, and knowledgeable about ALL Callengo features
2. Reference the user's actual data when relevant (their contacts, campaigns, team, usage)
3. When mentioning any Callengo page, ALWAYS use the markdown link format shown above
4. Suggest optimizations based on their usage patterns
5. If asked about features that don't exist, clarify what IS available
6. Always maintain a professional but friendly tone
7. For technical support, provide step-by-step instructions
8. If you don't know something specific about their data, say so honestly
9. Use the user's name occasionally to be personable
10. Keep responses focused and actionable - avoid unnecessary fluff`;
}

export async function POST(request: NextRequest) {
  try {
    const supabase = await createServerClient();
    const { data: { user } } = await supabase.auth.getUser();

    if (!user) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
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

    const company = userData.companies as any;
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

    const plan = subscriptionResult.data?.subscription_plans as any;
    const campaigns = (campaignsResult.data || []).map((c: any) => ({
      name: c.name,
      status: c.status,
      total_calls: c.total_contacts || 0,
      completed_calls: c.completed_calls || 0,
    }));

    const systemPrompt = buildSystemPrompt({
      companyName: company?.name || 'Unknown',
      companyDescription: company?.description || '',
      companyIndustry: company?.industry || '',
      companyWebsite: company?.website || '',
      userName: userData.full_name || userData.email,
      userEmail: userData.email,
      userRole: userData.role,
      planName: plan?.name || 'Free',
      totalContacts: contactsResult.count || 0,
      totalCalls: callsResult.count || 0,
      totalCampaigns: campaigns.length,
      totalAgents: agentsResult.count || 0,
      teamMembers: (teamResult.data || []) as any[],
      recentCampaigns: campaigns,
      minutesUsed: usageResult.data?.minutes_used || 0,
      minutesIncluded: plan?.minutes_included || usageResult.data?.minutes_included || 15,
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
      model: 'gpt-4o-mini',
      messages: chatMessages,
      temperature: 0.7,
      max_tokens: 1000,
    });

    const reply = completion.choices[0].message.content || 'I apologize, I could not generate a response.';

    // Save to database
    let savedConversationId = conversationId;

    try {
      if (!savedConversationId) {
        // Create new conversation
        const title = message.length > 60 ? message.substring(0, 60) + '...' : message;
        // @ts-ignore - ai_conversations table from new migration
        const { data: conv } = await supabase
          .from('ai_conversations' as any)
          .insert({
            user_id: user.id,
            company_id: companyId,
            title,
          })
          .select('id')
          .single();

        if (conv) savedConversationId = (conv as any).id;
      } else {
        // Update conversation timestamp
        // @ts-ignore - ai_conversations table from new migration
        await supabase
          .from('ai_conversations' as any)
          .update({ updated_at: new Date().toISOString() })
          .eq('id', savedConversationId);
      }

      // Save messages
      if (savedConversationId) {
        // @ts-ignore - ai_messages table from new migration
        await supabase.from('ai_messages' as any).insert([
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
        ]);
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
        details: error instanceof Error ? error.message : 'Unknown error',
      },
      { status: 500 }
    );
  }
}
