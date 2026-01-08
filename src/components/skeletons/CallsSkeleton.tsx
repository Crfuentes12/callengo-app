// components/skeletons/CallsSkeleton.tsx
'use client';

import { Skeleton } from './SkeletonBase';

export default function CallsSkeleton() {
  return (
    <div className="space-y-6">
      {/* Hero Banner */}
      <div className="relative overflow-hidden bg-gradient-to-br from-slate-950 via-slate-900 to-slate-950 rounded-3xl p-10 shadow-2xl border-2 border-slate-800">
        <div className="relative z-10">
          <div className="flex items-center gap-4 mb-6">
            <Skeleton className="w-20 h-20 rounded-2xl bg-white/10" />
            <div className="flex-1">
              <Skeleton className="h-12 w-80 mb-2 bg-white/10" />
              <Skeleton className="h-5 w-96 bg-white/10" />
            </div>
          </div>

          {/* Quick Stats in Banner */}
          <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
            {[...Array(4)].map((_, i) => (
              <div key={i} className="p-4 bg-slate-900/50 backdrop-blur-sm rounded-xl border border-slate-800">
                <div className="flex items-center gap-2 mb-2">
                  <Skeleton className="w-2 h-2 rounded-full bg-white/20" />
                  <Skeleton className="h-3 w-24 bg-white/10" />
                </div>
                <Skeleton className="h-8 w-16 bg-white/10" />
              </div>
            ))}
          </div>
        </div>
      </div>

      {/* Filters */}
      <div className="bg-white rounded-2xl border-2 border-slate-200/80 p-6 shadow-sm">
        <div className="flex flex-col lg:flex-row gap-4">
          {/* Search */}
          <div className="flex-1">
            <Skeleton className="h-11 w-full rounded-xl" />
          </div>

          {/* Filters */}
          <div className="flex gap-3 flex-wrap">
            <Skeleton className="h-11 w-32 rounded-xl" />
            <Skeleton className="h-11 w-32 rounded-xl" />
            <Skeleton className="h-11 w-32 rounded-xl" />
            <Skeleton className="h-11 w-24 rounded-xl" />
          </div>
        </div>

        {/* Results count */}
        <div className="mt-4">
          <Skeleton className="h-4 w-48" />
        </div>
      </div>

      {/* Calls Table */}
      <div className="bg-white rounded-2xl border-2 border-slate-200/80 overflow-hidden shadow-sm">
        <div className="overflow-x-auto">
          <table className="w-full">
            <thead>
              <tr className="bg-slate-50 border-b-2 border-slate-200">
                {['Call ID', 'Contact', 'Status', 'Duration', 'Answered By', 'Date', 'Actions'].map((header, i) => (
                  <th key={i} className="text-left py-4 px-6">
                    <Skeleton className="h-3 w-20" />
                  </th>
                ))}
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100">
              {[...Array(10)].map((_, i) => (
                <tr key={i} className="hover:bg-indigo-50/50">
                  <td className="py-4 px-6">
                    <Skeleton className="h-4 w-32" />
                  </td>
                  <td className="py-4 px-6">
                    <Skeleton className="h-4 w-40 mb-2" />
                    <Skeleton className="h-3 w-32" />
                  </td>
                  <td className="py-4 px-6">
                    <Skeleton className="h-7 w-24 rounded-lg" />
                  </td>
                  <td className="py-4 px-6">
                    <Skeleton className="h-4 w-16" />
                  </td>
                  <td className="py-4 px-6">
                    <Skeleton className="h-6 w-20 rounded-lg" />
                  </td>
                  <td className="py-4 px-6">
                    <Skeleton className="h-4 w-32" />
                  </td>
                  <td className="py-4 px-6">
                    <div className="flex items-center gap-2">
                      <Skeleton className="w-8 h-8 rounded-lg" />
                      <Skeleton className="w-8 h-8 rounded-lg" />
                    </div>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>

        {/* Pagination */}
        <div className="px-6 py-4 bg-slate-50 border-t-2 border-slate-200 flex items-center justify-between">
          <Skeleton className="h-4 w-32" />
          <div className="flex gap-2">
            <Skeleton className="h-10 w-24 rounded-xl" />
            <Skeleton className="h-10 w-20 rounded-xl" />
          </div>
        </div>
      </div>
    </div>
  );
}
