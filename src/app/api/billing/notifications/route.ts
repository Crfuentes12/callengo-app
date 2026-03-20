// app/api/billing/notifications/route.ts
// Returns unread billing alerts for the current user's company
import { NextRequest, NextResponse } from 'next/server';
import { createServerClient } from '@/lib/supabase/server';
import { supabaseAdmin } from '@/lib/supabase/service';

const ALERT_EVENT_TYPES = [
  'usage_alert',
  'overage_alert',
  'overage_budget_exceeded',
];

export async function GET(request: NextRequest) {
  try {
    const supabase = await createServerClient();
    const { data: { user } } = await supabase.auth.getUser();

    if (!user) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    // Get user's company
    const { data: userData } = await supabase
      .from('users')
      .select('company_id')
      .eq('id', user.id)
      .single();

    if (!userData?.company_id) {
      return NextResponse.json({ notifications: [] });
    }

    const { searchParams } = new URL(request.url);
    const since = searchParams.get('since');

    // Default: alerts from the last 30 days
    const sinceDate = since || new Date(Date.now() - 30 * 24 * 60 * 60 * 1000).toISOString();

    const { data: events } = await supabaseAdmin
      .from('billing_events')
      .select('id, event_type, event_data, cost_usd, created_at')
      .eq('company_id', userData.company_id)
      .in('event_type', ALERT_EVENT_TYPES)
      .gte('created_at', sinceDate)
      .order('created_at', { ascending: false })
      .limit(20);

    const notifications = (events || []).map(ev => {
      const data = ev.event_data as Record<string, unknown>;
      let title = '';
      let message = '';
      let severity: 'info' | 'warning' | 'critical' = 'info';

      switch (ev.event_type) {
        case 'usage_alert': {
          const level = data.level as number;
          const percent = data.percent as number;
          if (level >= 3) {
            title = 'Minutes Exhausted';
            message = `You've used 100% of your included minutes. ${data.message || 'Upgrade your plan or enable overage to continue.'}`;
            severity = 'critical';
          } else if (level >= 2) {
            title = 'Usage Warning';
            message = `You've used ${percent}% of your included minutes. ${data.message || 'Consider upgrading or enabling overage.'}`;
            severity = 'warning';
          } else {
            title = 'Usage Notice';
            message = `You've used ${percent}% of your included minutes.`;
            severity = 'info';
          }
          break;
        }
        case 'overage_alert': {
          const level = data.level as number;
          const percent = data.percent as number;
          if (level >= 3) {
            title = 'Overage Budget Almost Depleted';
            message = `${percent}% of your overage budget ($${data.budget}) has been used.`;
            severity = 'critical';
          } else if (level >= 2) {
            title = 'Overage Budget Warning';
            message = `${percent}% of your overage budget has been used ($${(data.spent as number)?.toFixed(2)} of $${data.budget}).`;
            severity = 'warning';
          } else {
            title = 'Overage Budget Notice';
            message = `${percent}% of your overage budget has been used.`;
            severity = 'info';
          }
          break;
        }
        case 'overage_budget_exceeded': {
          title = 'Overage Budget Exceeded';
          message = `Your overage budget of $${data.budget} has been fully used. Additional calls will be blocked.`;
          severity = 'critical';
          break;
        }
      }

      return {
        id: ev.id,
        type: ev.event_type,
        title,
        message,
        severity,
        createdAt: ev.created_at,
      };
    });

    return NextResponse.json({ notifications });
  } catch (error) {
    console.error('Error fetching billing notifications:', error);
    return NextResponse.json({ error: 'Failed to fetch notifications' }, { status: 500 });
  }
}
