// app/api/contacts/ai-analyze/route.ts
// AI-powered contact analysis and list suggestions
import { NextRequest, NextResponse } from 'next/server';
import { createServerClient } from '@/lib/supabase/server';
import OpenAI from 'openai';

const openai = new OpenAI({
  apiKey: process.env.OPENAI_API_KEY,
});

export async function POST(request: NextRequest) {
  try {
    const supabase = await createServerClient();
    const { data: { user } } = await supabase.auth.getUser();
    if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

    const { data: userData } = await supabase
      .from('users')
      .select('company_id')
      .eq('id', user.id)
      .single();
    if (!userData?.company_id) return NextResponse.json({ error: 'No company found' }, { status: 404 });

    const body = await request.json();
    const { action, contactIds } = body as {
      action: 'suggest-lists' | 'analyze-quality';
      contactIds?: string[];
    };

    // Fetch contacts for analysis (limit to 500 for token efficiency)
    let query = supabase
      .from('contacts')
      .select('company_name, contact_name, email, phone_number, city, state, status, call_outcome, call_attempts, source, list_id, notes')
      .eq('company_id', userData.company_id)
      .limit(500);

    if (contactIds && contactIds.length > 0) {
      query = query.in('id', contactIds.slice(0, 200));
    }

    const { data: contacts, error } = await query;
    if (error) throw error;

    if (!contacts || contacts.length === 0) {
      return NextResponse.json({ error: 'No contacts to analyze' }, { status: 400 });
    }

    // Fetch contact lists for context
    const { data: lists } = await supabase
      .from('contact_lists')
      .select('id, name, color')
      .eq('company_id', userData.company_id);

    const listMap = Object.fromEntries((lists || []).map((l: { id: string; name: string }) => [l.id, l.name]));

    // Build prompt based on action
    let systemPrompt = '';
    let userPrompt = '';

    const contactSummary = contacts.map((c: Record<string, unknown>) => ({
      company: c.company_name,
      contact: c.contact_name,
      email: c.email ? 'yes' : 'no',
      city: c.city,
      state: c.state,
      status: c.status,
      outcome: c.call_outcome,
      attempts: c.call_attempts,
      source: c.source,
      list: c.list_id ? (listMap[c.list_id as string] || 'Unknown') : 'None',
    }));

    if (action === 'suggest-lists') {
      systemPrompt = `You are a CRM data analyst. Analyze the contact data and suggest intelligent contact lists.
You MUST return structured filter criteria so lists can be automatically created and populated with matching contacts.
The available filterable fields in the database are:
- status: one of "Pending", "Calling", "Fully Verified", "For Callback", "No Answer", "Voicemail Left", "Wrong Number", "Number Disconnected", "Research Needed"
- city: string (exact city name as it appears in the data)
- state: string (exact state as it appears in the data)
- source: string (exact source value)
- call_outcome: string
- call_attempts: number (use call_attempts_gte or call_attempts_eq)
- has_email: boolean (true = has email, false = no email)
- has_phone: boolean
Return JSON.`;
      userPrompt = `Analyze these ${contacts.length} contacts and suggest 3-5 smart contact lists based on patterns you find (geography, status, engagement, industry, etc.).

Contact data sample: ${JSON.stringify(contactSummary.slice(0, 100))}
${contacts.length > 100 ? `(Showing 100 of ${contacts.length} contacts)` : ''}

Unique states found: ${JSON.stringify([...new Set(contacts.map((c: Record<string, unknown>) => c.state).filter(Boolean))])}
Unique cities found: ${JSON.stringify([...new Set(contacts.map((c: Record<string, unknown>) => c.city).filter(Boolean))].slice(0, 30))}
Unique statuses found: ${JSON.stringify([...new Set(contacts.map((c: Record<string, unknown>) => c.status).filter(Boolean))])}
Unique sources found: ${JSON.stringify([...new Set(contacts.map((c: Record<string, unknown>) => c.source).filter(Boolean))])}

Current lists: ${JSON.stringify(Object.values(listMap))}

Return JSON with this EXACT structure:
{
  "lists": [
    {
      "name": "list name",
      "description": "why this list is useful",
      "criteria": "human-readable filter criteria description",
      "filters": {
        "status": ["Pending"],
        "city": ["New York"],
        "state": ["CA", "NY"],
        "source": ["google_sheets"],
        "has_email": true,
        "call_attempts_gte": 1,
        "call_attempts_eq": 0
      },
      "estimatedCount": 150,
      "color": "#3b82f6"
    }
  ],
  "insights": ["key insight 1", "key insight 2"]
}

IMPORTANT: The "filters" object must contain ONLY the filter keys that apply to this list. Use the exact values from the data. Do NOT include a filter key if it is not relevant to the list. Each filter narrows the results (AND logic).`;
    } else if (action === 'analyze-quality') {
      systemPrompt = 'You are a CRM data quality analyst. Analyze contact data quality and provide actionable recommendations. Return JSON.';
      userPrompt = `Analyze the data quality of these ${contacts.length} contacts.

Contact data sample: ${JSON.stringify(contactSummary.slice(0, 100))}

Return JSON with this structure:
{
  "overallScore": number (0-100),
  "issues": [
    { "type": "missing_emails" | "missing_names" | "duplicates" | "stale_contacts" | "unassigned", "count": number, "severity": "high" | "medium" | "low", "suggestion": "actionable fix" }
  ],
  "recommendations": ["recommendation 1", "recommendation 2"]
}`;
    } else {
      return NextResponse.json({ error: 'Invalid action' }, { status: 400 });
    }

    const completion = await openai.chat.completions.create({
      model: 'gpt-4o-mini',
      temperature: 0.3,
      response_format: { type: 'json_object' },
      messages: [
        { role: 'system', content: systemPrompt },
        { role: 'user', content: userPrompt },
      ],
    });

    const result = JSON.parse(completion.choices[0]?.message?.content || '{}');

    return NextResponse.json({ action, result, contactCount: contacts.length });
  } catch (error) {
    console.error('AI analysis error:', error);
    const message = error instanceof Error ? error.message : 'AI analysis failed';
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
