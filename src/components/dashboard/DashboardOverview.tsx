// components/dashboard/DashboardOverview.tsx
'use client';

import { useMemo } from 'react';
import { Company } from '@/types/supabase';
import { Contact } from '@/types/call-agent';
import { formatCurrency, formatDuration } from '@/lib/call-agent-utils';

interface CallLog {
  id: string;
  company_id: string;
  contact_id: string | null;
  agent_template_id: string | null;
  call_id: string;
  status: string | null;
  completed: boolean;
  call_length: number | null;
  price: number | null;
  answered_by: string | null;
  recording_url: string | null;
  transcript: string | null;
  summary: string | null;
  analysis: any;
  error_message: string | null;
  metadata: any;
  created_at: string;
}

interface DashboardOverviewProps {
  contacts: any[];
  recentCalls: CallLog[];
  company: Company;
}

export default function DashboardOverview({ contacts, recentCalls, company }: DashboardOverviewProps) {
  const stats = useMemo(() => {
    const typedContacts = contacts as Contact[];

    const total = typedContacts.length;
    const pending = typedContacts.filter(c => c.status === 'Pending').length;
    const calling = typedContacts.filter(c => c.status === 'Calling').length;
    const verified = typedContacts.filter(c => c.status === 'Fully Verified').length;
    const noAnswer = typedContacts.filter(c => c.status === 'No Answer').length;
    const voicemail = typedContacts.filter(c => c.status === 'Voicemail Left').length;
    const callback = typedContacts.filter(c => c.status === 'For Callback').length;

    const totalCallDuration = typedContacts.reduce((sum, c) => sum + (c.call_duration || 0), 0);
    const totalCost = recentCalls.reduce((sum, c) => sum + (c.price || 0), 0);

    const calledContacts = typedContacts.filter(c => c.call_attempts > 0).length;
    const successRate = calledContacts > 0 ? (verified / calledContacts) * 100 : 0;
    const avgCallDuration = calledContacts > 0 ? totalCallDuration / calledContacts : 0;

    return {
      total,
      pending,
      calling,
      verified,
      noAnswer,
      voicemail,
      callback,
      totalCallDuration,
      totalCost,
      successRate,
      avgCallDuration,
    };
  }, [contacts, recentCalls]);

  const getStatusStyles = (status: string) => {
    switch (status) {
      case 'completed':
        return 'bg-emerald-50 text-emerald-700 border-emerald-100';
      case 'in_progress':
        return 'bg-blue-50 text-blue-700 border-blue-100';
      case 'failed':
        return 'bg-red-50 text-red-700 border-red-100';
      case 'no_answer':
        return 'bg-amber-50 text-amber-700 border-amber-100';
      default:
        return 'bg-slate-50 text-slate-600 border-slate-100';
    }
  };

  return (
    <div className="space-y-6">
      {/* Welcome Banner */}
      <div className="relative overflow-hidden bg-gradient-to-br from-indigo-600 via-indigo-700 to-purple-700 rounded-2xl p-6 text-white shadow-lg shadow-indigo-500/10">
        <div className="relative z-10">
          <h2 className="text-2xl font-semibold mb-1">Welcome back</h2>
          <p className="text-indigo-100">
            Here's what's happening with your calling campaigns today
          </p>
        </div>
        {/* Decorative elements */}
        <div className="absolute right-0 top-0 w-64 h-64 bg-white/5 rounded-full -translate-y-1/2 translate-x-1/3"></div>
        <div className="absolute right-20 bottom-0 w-32 h-32 bg-white/5 rounded-full translate-y-1/2"></div>
      </div>

      {/* Key Metrics */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
        {/* Total Contacts */}
        <div className="bg-white rounded-xl border border-slate-200/80 p-5 hover:shadow-md hover:border-slate-300/80 transition-all duration-200">
          <div className="flex items-start justify-between">
            <div>
              <p className="text-sm font-medium text-slate-500">Total Contacts</p>
              <p className="text-3xl font-semibold text-slate-900 mt-1">{stats.total}</p>
              <p className="text-sm text-slate-400 mt-1">{stats.pending} pending</p>
            </div>
            <div className="w-11 h-11 rounded-xl bg-indigo-50 flex items-center justify-center">
              <svg className="w-5 h-5 text-indigo-600" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.75}>
                <path strokeLinecap="round" strokeLinejoin="round" d="M15 19.128a9.38 9.38 0 002.625.372 9.337 9.337 0 004.121-.952 4.125 4.125 0 00-7.533-2.493M15 19.128v-.003c0-1.113-.285-2.16-.786-3.07M15 19.128v.106A12.318 12.318 0 018.624 21c-2.331 0-4.512-.645-6.374-1.766l-.001-.109a6.375 6.375 0 0111.964-3.07M12 6.375a3.375 3.375 0 11-6.75 0 3.375 3.375 0 016.75 0zm8.25 2.25a2.625 2.625 0 11-5.25 0 2.625 2.625 0 015.25 0z" />
              </svg>
            </div>
          </div>
        </div>

        {/* Verified */}
        <div className="bg-white rounded-xl border border-slate-200/80 p-5 hover:shadow-md hover:border-slate-300/80 transition-all duration-200">
          <div className="flex items-start justify-between">
            <div>
              <p className="text-sm font-medium text-slate-500">Verified</p>
              <p className="text-3xl font-semibold text-slate-900 mt-1">{stats.verified}</p>
              <p className="text-sm text-emerald-600 mt-1">{stats.successRate.toFixed(1)}% success rate</p>
            </div>
            <div className="w-11 h-11 rounded-xl bg-emerald-50 flex items-center justify-center">
              <svg className="w-5 h-5 text-emerald-600" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.75}>
                <path strokeLinecap="round" strokeLinejoin="round" d="M9 12.75L11.25 15 15 9.75M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
              </svg>
            </div>
          </div>
        </div>

        {/* Total Cost */}
        <div className="bg-white rounded-xl border border-slate-200/80 p-5 hover:shadow-md hover:border-slate-300/80 transition-all duration-200">
          <div className="flex items-start justify-between">
            <div>
              <p className="text-sm font-medium text-slate-500">Total Cost</p>
              <p className="text-3xl font-semibold text-slate-900 mt-1">{formatCurrency(stats.totalCost)}</p>
              <p className="text-sm text-slate-400 mt-1">{recentCalls.length} calls made</p>
            </div>
            <div className="w-11 h-11 rounded-xl bg-violet-50 flex items-center justify-center">
              <svg className="w-5 h-5 text-violet-600" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.75}>
                <path strokeLinecap="round" strokeLinejoin="round" d="M12 6v12m-3-2.818l.879.659c1.171.879 3.07.879 4.242 0 1.172-.879 1.172-2.303 0-3.182C13.536 12.219 12.768 12 12 12c-.725 0-1.45-.22-2.003-.659-1.106-.879-1.106-2.303 0-3.182s2.9-.879 4.006 0l.415.33M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
              </svg>
            </div>
          </div>
        </div>

        {/* Avg Duration */}
        <div className="bg-white rounded-xl border border-slate-200/80 p-5 hover:shadow-md hover:border-slate-300/80 transition-all duration-200">
          <div className="flex items-start justify-between">
            <div>
              <p className="text-sm font-medium text-slate-500">Avg Duration</p>
              <p className="text-3xl font-semibold text-slate-900 mt-1">{formatDuration(stats.avgCallDuration)}</p>
              <p className="text-sm text-slate-400 mt-1">per call</p>
            </div>
            <div className="w-11 h-11 rounded-xl bg-amber-50 flex items-center justify-center">
              <svg className="w-5 h-5 text-amber-600" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.75}>
                <path strokeLinecap="round" strokeLinejoin="round" d="M12 6v6h4.5m4.5 0a9 9 0 11-18 0 9 9 0 0118 0z" />
              </svg>
            </div>
          </div>
        </div>
      </div>

      {/* Status Breakdown */}
      <div className="bg-white rounded-xl border border-slate-200/80 p-6">
        <h3 className="text-base font-semibold text-slate-900 mb-4">Contact Status</h3>
        <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
          <div className="text-center p-4 bg-slate-50 rounded-xl border border-slate-100">
            <p className="text-2xl font-semibold text-slate-900">{stats.pending}</p>
            <p className="text-sm text-slate-500 mt-1">Pending</p>
          </div>
          <div className="text-center p-4 bg-blue-50 rounded-xl border border-blue-100">
            <p className="text-2xl font-semibold text-blue-900">{stats.calling}</p>
            <p className="text-sm text-blue-600 mt-1">In Progress</p>
          </div>
          <div className="text-center p-4 bg-amber-50 rounded-xl border border-amber-100">
            <p className="text-2xl font-semibold text-amber-900">{stats.noAnswer}</p>
            <p className="text-sm text-amber-600 mt-1">No Answer</p>
          </div>
          <div className="text-center p-4 bg-violet-50 rounded-xl border border-violet-100">
            <p className="text-2xl font-semibold text-violet-900">{stats.callback}</p>
            <p className="text-sm text-violet-600 mt-1">Callback</p>
          </div>
        </div>
      </div>

      {/* Recent Calls Table */}
      <div className="bg-white rounded-xl border border-slate-200/80 overflow-hidden">
        <div className="flex items-center justify-between p-5 border-b border-slate-100">
          <h3 className="text-base font-semibold text-slate-900">Recent Calls</h3>
          <a
            href="/dashboard/calls"
            className="text-sm font-medium text-indigo-600 hover:text-indigo-700 transition-colors"
          >
            View all
          </a>
        </div>

        {recentCalls.length === 0 ? (
          <div className="text-center py-16 px-6">
            <div className="w-14 h-14 rounded-2xl bg-slate-100 flex items-center justify-center mx-auto mb-4">
              <svg className="w-7 h-7 text-slate-400" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.5}>
                <path strokeLinecap="round" strokeLinejoin="round" d="M2.25 6.75c0 8.284 6.716 15 15 15h2.25a2.25 2.25 0 002.25-2.25v-1.372c0-.516-.351-.966-.852-1.091l-4.423-1.106c-.44-.11-.902.055-1.173.417l-.97 1.293c-.282.376-.769.542-1.21.38a12.035 12.035 0 01-7.143-7.143c-.162-.441.004-.928.38-1.21l1.293-.97c.363-.271.527-.734.417-1.173L6.963 3.102a1.125 1.125 0 00-1.091-.852H4.5A2.25 2.25 0 002.25 4.5v2.25z" />
              </svg>
            </div>
            <p className="text-slate-900 font-medium mb-1">No calls yet</p>
            <p className="text-sm text-slate-500">Start a campaign to begin making calls</p>
          </div>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full">
              <thead>
                <tr className="bg-slate-50/50">
                  <th className="text-left py-3 px-5 text-xs font-semibold text-slate-500 uppercase tracking-wider">
                    Call ID
                  </th>
                  <th className="text-left py-3 px-5 text-xs font-semibold text-slate-500 uppercase tracking-wider">
                    Status
                  </th>
                  <th className="text-left py-3 px-5 text-xs font-semibold text-slate-500 uppercase tracking-wider">
                    Duration
                  </th>
                  <th className="text-left py-3 px-5 text-xs font-semibold text-slate-500 uppercase tracking-wider">
                    Cost
                  </th>
                  <th className="text-left py-3 px-5 text-xs font-semibold text-slate-500 uppercase tracking-wider">
                    Date
                  </th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100">
                {recentCalls.slice(0, 5).map((call) => (
                  <tr key={call.id} className="hover:bg-slate-50/50 transition-colors">
                    <td className="py-3.5 px-5">
                      <p className="text-sm font-medium text-slate-900 font-mono">
                        {call.call_id.substring(0, 8)}...
                      </p>
                    </td>
                    <td className="py-3.5 px-5">
                      <span className={`inline-flex items-center px-2.5 py-1 rounded-lg text-xs font-medium border ${getStatusStyles(call.status || 'unknown')}`}>
                        {call.status || 'Unknown'}
                      </span>
                    </td>
                    <td className="py-3.5 px-5">
                      <p className="text-sm text-slate-700">
                        {formatDuration(call.call_length)}
                      </p>
                    </td>
                    <td className="py-3.5 px-5">
                      <p className="text-sm text-slate-700">
                        {formatCurrency(call.price)}
                      </p>
                    </td>
                    <td className="py-3.5 px-5">
                      <p className="text-sm text-slate-500">
                        {new Date(call.created_at).toLocaleDateString('en-US', {
                          month: 'short',
                          day: 'numeric',
                          hour: '2-digit',
                          minute: '2-digit',
                        })}
                      </p>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>

      {/* Quick Actions */}
      <div className="grid sm:grid-cols-2 lg:grid-cols-3 gap-4">
        <a
          href="/contacts"
          className="group bg-white rounded-xl border border-slate-200/80 p-5 hover:shadow-md hover:border-indigo-200 transition-all duration-200"
        >
          <div className="flex items-center gap-4">
            <div className="w-12 h-12 rounded-xl bg-gradient-to-br from-indigo-500 to-indigo-600 flex items-center justify-center shadow-lg shadow-indigo-500/20 group-hover:shadow-indigo-500/30 transition-shadow">
              <svg className="w-6 h-6 text-white" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                <path strokeLinecap="round" strokeLinejoin="round" d="M12 4.5v15m7.5-7.5h-15" />
              </svg>
            </div>
            <div>
              <h4 className="font-semibold text-slate-900 group-hover:text-indigo-600 transition-colors">
                Import Contacts
              </h4>
              <p className="text-sm text-slate-500 mt-0.5">Add contacts to call</p>
            </div>
          </div>
        </a>

        <a
          href="/agents"
          className="group bg-white rounded-xl border border-slate-200/80 p-5 hover:shadow-md hover:border-emerald-200 transition-all duration-200"
        >
          <div className="flex items-center gap-4">
            <div className="w-12 h-12 rounded-xl bg-gradient-to-br from-emerald-500 to-emerald-600 flex items-center justify-center shadow-lg shadow-emerald-500/20 group-hover:shadow-emerald-500/30 transition-shadow">
              <svg className="w-6 h-6 text-white" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                <path strokeLinecap="round" strokeLinejoin="round" d="M3.75 13.5l10.5-11.25L12 10.5h8.25L9.75 21.75 12 13.5H3.75z" />
              </svg>
            </div>
            <div>
              <h4 className="font-semibold text-slate-900 group-hover:text-emerald-600 transition-colors">
                Start Campaign
              </h4>
              <p className="text-sm text-slate-500 mt-0.5">Launch AI calling agent</p>
            </div>
          </div>
        </a>

        <a
          href="/settings"
          className="group bg-white rounded-xl border border-slate-200/80 p-5 hover:shadow-md hover:border-violet-200 transition-all duration-200"
        >
          <div className="flex items-center gap-4">
            <div className="w-12 h-12 rounded-xl bg-gradient-to-br from-violet-500 to-violet-600 flex items-center justify-center shadow-lg shadow-violet-500/20 group-hover:shadow-violet-500/30 transition-shadow">
              <svg className="w-6 h-6 text-white" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                <path strokeLinecap="round" strokeLinejoin="round" d="M9.594 3.94c.09-.542.56-.94 1.11-.94h2.593c.55 0 1.02.398 1.11.94l.213 1.281c.063.374.313.686.645.87.074.04.147.083.22.127.324.196.72.257 1.075.124l1.217-.456a1.125 1.125 0 011.37.49l1.296 2.247a1.125 1.125 0 01-.26 1.431l-1.003.827c-.293.24-.438.613-.431.992a6.759 6.759 0 010 .255c-.007.378.138.75.43.99l1.005.828c.424.35.534.954.26 1.43l-1.298 2.247a1.125 1.125 0 01-1.369.491l-1.217-.456c-.355-.133-.75-.072-1.076.124a6.57 6.57 0 01-.22.128c-.331.183-.581.495-.644.869l-.213 1.28c-.09.543-.56.941-1.11.941h-2.594c-.55 0-1.02-.398-1.11-.94l-.213-1.281c-.062-.374-.312-.686-.644-.87a6.52 6.52 0 01-.22-.127c-.325-.196-.72-.257-1.076-.124l-1.217.456a1.125 1.125 0 01-1.369-.49l-1.297-2.247a1.125 1.125 0 01.26-1.431l1.004-.827c.292-.24.437-.613.43-.992a6.932 6.932 0 010-.255c.007-.378-.138-.75-.43-.99l-1.004-.828a1.125 1.125 0 01-.26-1.43l1.297-2.247a1.125 1.125 0 011.37-.491l1.216.456c.356.133.751.072 1.076-.124.072-.044.146-.087.22-.128.332-.183.582-.495.644-.869l.214-1.281z" />
                <path strokeLinecap="round" strokeLinejoin="round" d="M15 12a3 3 0 11-6 0 3 3 0 016 0z" />
              </svg>
            </div>
            <div>
              <h4 className="font-semibold text-slate-900 group-hover:text-violet-600 transition-colors">
                Settings
              </h4>
              <p className="text-sm text-slate-500 mt-0.5">Configure your account</p>
            </div>
          </div>
        </a>
      </div>
    </div>
  );
}
