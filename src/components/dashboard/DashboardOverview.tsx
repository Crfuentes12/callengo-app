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

  const getStatusColor = (status: string) => {
    switch (status) {
      case 'completed':
        return 'bg-emerald-100 text-emerald-700';
      case 'in_progress':
        return 'bg-blue-100 text-blue-700';
      case 'failed':
        return 'bg-red-100 text-red-700';
      case 'no_answer':
        return 'bg-amber-100 text-amber-700';
      default:
        return 'bg-slate-100 text-slate-700';
    }
  };

  return (
    <div className="space-y-6">
      {/* Welcome Section */}
      <div className="bg-gradient from-blue-600 to-indigo-600 rounded-xl p-6 text-white">
        <h2 className="text-2xl font-bold mb-2">Welcome back to {company.name}</h2>
        <p className="text-blue-100">
          Here's what's happening with your calling operations today
        </p>
      </div>

      {/* Key Metrics */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6">
        <div className="bg-white rounded-xl border border-slate-200 p-6">
          <div className="flex items-center justify-between mb-2">
            <p className="text-sm font-medium text-slate-600">Total Contacts</p>
            <div className="w-10 h-10 rounded-lg bg-blue-100 flex items-center justify-center">
              <svg className="w-5 h-5 text-blue-600" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M17 20h5v-2a3 3 0 00-5.356-1.857M17 20H7m10 0v-2c0-.656-.126-1.283-.356-1.857M7 20H2v-2a3 3 0 015.356-1.857M7 20v-2c0-.656.126-1.283.356-1.857m0 0a5.002 5.002 0 019.288 0M15 7a3 3 0 11-6 0 3 3 0 016 0zm6 3a2 2 0 11-4 0 2 2 0 014 0zM7 10a2 2 0 11-4 0 2 2 0 014 0z" />
              </svg>
            </div>
          </div>
          <p className="text-3xl font-bold text-slate-900">{stats.total}</p>
          <p className="text-sm text-slate-500 mt-1">{stats.pending} pending</p>
        </div>

        <div className="bg-white rounded-xl border border-slate-200 p-6">
          <div className="flex items-center justify-between mb-2">
            <p className="text-sm font-medium text-slate-600">Verified</p>
            <div className="w-10 h-10 rounded-lg bg-emerald-100 flex items-center justify-center">
              <svg className="w-5 h-5 text-emerald-600" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 12l2 2 4-4m6 2a9 9 0 11-18 0 9 9 0 0118 0z" />
              </svg>
            </div>
          </div>
          <p className="text-3xl font-bold text-slate-900">{stats.verified}</p>
          <p className="text-sm text-slate-500 mt-1">{stats.successRate.toFixed(1)}% success rate</p>
        </div>

        <div className="bg-white rounded-xl border border-slate-200 p-6">
          <div className="flex items-center justify-between mb-2">
            <p className="text-sm font-medium text-slate-600">Total Cost</p>
            <div className="w-10 h-10 rounded-lg bg-purple-100 flex items-center justify-center">
              <svg className="w-5 h-5 text-purple-600" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 8c-1.657 0-3 .895-3 2s1.343 2 3 2 3 .895 3 2-1.343 2-3 2m0-8c1.11 0 2.08.402 2.599 1M12 8V7m0 1v8m0 0v1m0-1c-1.11 0-2.08-.402-2.599-1M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
              </svg>
            </div>
          </div>
          <p className="text-3xl font-bold text-slate-900">{formatCurrency(stats.totalCost)}</p>
          <p className="text-sm text-slate-500 mt-1">{recentCalls.length} recent calls</p>
        </div>

        <div className="bg-white rounded-xl border border-slate-200 p-6">
          <div className="flex items-center justify-between mb-2">
            <p className="text-sm font-medium text-slate-600">Avg Duration</p>
            <div className="w-10 h-10 rounded-lg bg-amber-100 flex items-center justify-center">
              <svg className="w-5 h-5 text-amber-600" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 8v4l3 3m6-3a9 9 0 11-18 0 9 9 0 0118 0z" />
              </svg>
            </div>
          </div>
          <p className="text-3xl font-bold text-slate-900">{formatDuration(stats.avgCallDuration)}</p>
          <p className="text-sm text-slate-500 mt-1">per call</p>
        </div>
      </div>

      {/* Status Breakdown */}
      <div className="bg-white rounded-xl border border-slate-200 p-6">
        <h3 className="text-lg font-bold text-slate-900 mb-4">Contact Status Breakdown</h3>
        <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
          <div className="text-center p-4 bg-slate-50 rounded-lg">
            <p className="text-2xl font-bold text-slate-900">{stats.pending}</p>
            <p className="text-sm text-slate-600 mt-1">Pending</p>
          </div>
          <div className="text-center p-4 bg-blue-50 rounded-lg">
            <p className="text-2xl font-bold text-blue-900">{stats.calling}</p>
            <p className="text-sm text-blue-600 mt-1">Calling</p>
          </div>
          <div className="text-center p-4 bg-amber-50 rounded-lg">
            <p className="text-2xl font-bold text-amber-900">{stats.noAnswer}</p>
            <p className="text-sm text-amber-600 mt-1">No Answer</p>
          </div>
          <div className="text-center p-4 bg-purple-50 rounded-lg">
            <p className="text-2xl font-bold text-purple-900">{stats.callback}</p>
            <p className="text-sm text-purple-600 mt-1">Callback</p>
          </div>
        </div>
      </div>

      {/* Recent Calls */}
      <div className="bg-white rounded-xl border border-slate-200 p-6">
        <div className="flex items-center justify-between mb-4">
          <h3 className="text-lg font-bold text-slate-900">Recent Calls</h3>
          <a
            href="/dashboard/calls"
            className="text-sm text-blue-600 hover:text-blue-700 font-medium"
          >
            View all →
          </a>
        </div>

        {recentCalls.length === 0 ? (
          <div className="text-center py-12 text-slate-500">
            <svg className="w-12 h-12 mx-auto mb-3 text-slate-400" fill="none" viewBox="0 0 24 24" stroke="currentColor">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M3 5a2 2 0 012-2h3.28a1 1 0 01.948.684l1.498 4.493a1 1 0 01-.502 1.21l-2.257 1.13a11.042 11.042 0 005.516 5.516l1.13-2.257a1 1 0 011.21-.502l4.493 1.498a1 1 0 01.684.949V19a2 2 0 01-2 2h-1C9.716 21 3 14.284 3 6V5z" />
            </svg>
            <p className="text-sm">No calls yet</p>
            <p className="text-xs mt-1">Start a campaign to begin calling</p>
          </div>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full">
              <thead>
                <tr className="border-b border-slate-200">
                  <th className="text-left py-3 px-4 text-xs font-semibold text-slate-600 uppercase tracking-wider">
                    Call ID
                  </th>
                  <th className="text-left py-3 px-4 text-xs font-semibold text-slate-600 uppercase tracking-wider">
                    Status
                  </th>
                  <th className="text-left py-3 px-4 text-xs font-semibold text-slate-600 uppercase tracking-wider">
                    Duration
                  </th>
                  <th className="text-left py-3 px-4 text-xs font-semibold text-slate-600 uppercase tracking-wider">
                    Cost
                  </th>
                  <th className="text-left py-3 px-4 text-xs font-semibold text-slate-600 uppercase tracking-wider">
                    Date
                  </th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-200">
                {recentCalls.map((call) => (
                  <tr key={call.id} className="hover:bg-slate-50">
                    <td className="py-3 px-4">
                      <p className="text-sm font-medium text-slate-900 font-mono">
                        {call.call_id.substring(0, 8)}...
                      </p>
                    </td>
                    <td className="py-3 px-4">
                      <span className={`inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium ${getStatusColor(call.status || 'unknown')}`}>
                        {call.status || 'Unknown'}
                      </span>
                    </td>
                    <td className="py-3 px-4">
                      <p className="text-sm text-slate-900">
                        {formatDuration(call.call_length)}
                      </p>
                    </td>
                    <td className="py-3 px-4">
                      <p className="text-sm text-slate-900">
                        {formatCurrency(call.price)}
                      </p>
                    </td>
                    <td className="py-3 px-4">
                      <p className="text-sm text-slate-600">
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
      <div className="grid md:grid-cols-3 gap-6">
        <a
          href="/dashboard/contacts"
          className="bg-white rounded-xl border border-slate-200 p-6 hover:shadow-lg transition-all group"
        >
          <div className="flex items-center gap-4">
            <div className="w-12 h-12 rounded-lg bg-gradient from-blue-500 to-blue-600 flex items-center justify-center">
              <svg className="w-6 h-6 text-white" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 4v16m8-8H4" />
              </svg>
            </div>
            <div>
              <h4 className="font-semibold text-slate-900 group-hover:text-blue-600">Import Contacts</h4>
              <p className="text-sm text-slate-500">Add new contacts to call</p>
            </div>
          </div>
        </a>

        <a
          href="/dashboard/agents"
          className="bg-white rounded-xl border border-slate-200 p-6 hover:shadow-lg transition-all group"
        >
          <div className="flex items-center gap-4">
            <div className="w-12 h-12 rounded-lg bg-gradient from-emerald-500 to-emerald-600 flex items-center justify-center">
              <svg className="w-6 h-6 text-white" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M13 10V3L4 14h7v7l9-11h-7z" />
              </svg>
            </div>
            <div>
              <h4 className="font-semibold text-slate-900 group-hover:text-emerald-600">Start Campaign</h4>
              <p className="text-sm text-slate-500">Launch AI calling agent</p>
            </div>
          </div>
        </a>

        <a
          href="/dashboard/settings"
          className="bg-white rounded-xl border border-slate-200 p-6 hover:shadow-lg transition-all group"
        >
          <div className="flex items-center gap-4">
            <div className="w-12 h-12 rounded-lg bg-gradient from-purple-500 to-purple-600 flex items-center justify-center">
              <svg className="w-6 h-6 text-white" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M10.325 4.317c.426-1.756 2.924-1.756 3.35 0a1.724 1.724 0 002.573 1.066c1.543-.94 3.31.826 2.37 2.37a1.724 1.724 0 001.065 2.572c1.756.426 1.756 2.924 0 3.35a1.724 1.724 0 00-1.066 2.573c.94 1.543-.826 3.31-2.37 2.37a1.724 1.724 0 00-2.572 1.065c-.426 1.756-2.924 1.756-3.35 0a1.724 1.724 0 00-2.573-1.066c-1.543.94-3.31-.826-2.37-2.37a1.724 1.724 0 00-1.065-2.572c-1.756-.426-1.756-2.924 0-3.35a1.724 1.724 0 001.066-2.573c-.94-1.543.826-3.31 2.37-2.37.996.608 2.296.07 2.572-1.065z" />
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 12a3 3 0 11-6 0 3 3 0 016 0z" />
              </svg>
            </div>
            <div>
              <h4 className="font-semibold text-slate-900 group-hover:text-purple-600">Settings</h4>
              <p className="text-sm text-slate-500">Configure your account</p>
            </div>
          </div>
        </a>
      </div>
    </div>
  );
}