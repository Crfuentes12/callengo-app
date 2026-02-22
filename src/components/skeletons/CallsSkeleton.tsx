// components/skeletons/CallsSkeleton.tsx
'use client';

import { Skeleton } from './SkeletonBase';

export default function CallsSkeleton() {
  return (
    <div className="space-y-6">
      {/* Hero Banner */}
      <div className="relative overflow-hidden gradient-bg-subtle rounded-2xl p-8 border border-[var(--color-primary)]/10">
        <div className="relative z-10">
          <div className="flex items-center gap-4 mb-6">
            <Skeleton className="w-20 h-20 rounded-2xl animate-skeleton-slide" />
            <div className="flex-1">
              <Skeleton className="h-12 w-80 mb-2 animate-skeleton-slide [animation-delay:50ms]" />
              <Skeleton className="h-5 w-96 animate-skeleton-slide [animation-delay:100ms]" />
            </div>
          </div>

          <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
            {[0, 1, 2, 3].map((i) => (
              <div key={i} className={`p-4 bg-white/60 backdrop-blur-sm rounded-xl border border-slate-200/60 animate-skeleton-slide [animation-delay:${150 + i * 50}ms]`}>
                <div className="flex items-center gap-2 mb-2">
                  <Skeleton className="w-2 h-2 rounded-full" />
                  <Skeleton className="h-3 w-24" />
                </div>
                <Skeleton className="h-8 w-16" />
              </div>
            ))}
          </div>
        </div>
      </div>

      {/* Filters */}
      <div className="bg-white rounded-2xl border border-slate-200/80 p-6 shadow-sm animate-skeleton-slide [animation-delay:350ms]">
        <div className="flex flex-col lg:flex-row gap-4">
          <div className="flex-1">
            <Skeleton className="h-11 w-full rounded-xl" />
          </div>
          <div className="flex gap-3 flex-wrap">
            <Skeleton className="h-11 w-32 rounded-xl" />
            <Skeleton className="h-11 w-32 rounded-xl" />
            <Skeleton className="h-11 w-32 rounded-xl" />
            <Skeleton className="h-11 w-24 rounded-xl" />
          </div>
        </div>
        <div className="mt-4">
          <Skeleton className="h-4 w-48" />
        </div>
      </div>

      {/* Calls Table */}
      <div className="bg-white rounded-2xl border border-slate-200/80 overflow-hidden shadow-sm animate-skeleton-slide [animation-delay:420ms]">
        <div className="overflow-x-auto">
          <table className="w-full">
            <thead>
              <tr className="bg-slate-50 border-b border-slate-200">
                {['Call ID', 'Contact', 'Status', 'Duration', 'Answered By', 'Date', 'Actions'].map((_, i) => (
                  <th key={i} className="text-left py-4 px-6">
                    <Skeleton className="h-3 w-20" />
                  </th>
                ))}
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100">
              {Array.from({ length: 10 }, (_, i) => (
                <tr key={i} className={`animate-skeleton-slide [animation-delay:${480 + i * 35}ms]`}>
                  <td className="py-4 px-6"><Skeleton className="h-4 w-32" /></td>
                  <td className="py-4 px-6">
                    <Skeleton className="h-4 w-40 mb-2" />
                    <Skeleton className="h-3 w-32" />
                  </td>
                  <td className="py-4 px-6"><Skeleton className="h-7 w-24 rounded-lg" /></td>
                  <td className="py-4 px-6"><Skeleton className="h-4 w-16" /></td>
                  <td className="py-4 px-6"><Skeleton className="h-6 w-20 rounded-lg" /></td>
                  <td className="py-4 px-6"><Skeleton className="h-4 w-32" /></td>
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
        <div className="px-6 py-4 bg-slate-50 border-t border-slate-200 flex items-center justify-between animate-skeleton-slide [animation-delay:850ms]">
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
