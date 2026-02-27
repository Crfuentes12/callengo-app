// components/skeletons/ContactsSkeleton.tsx
'use client';

import { Skeleton } from './SkeletonBase';

export default function ContactsSkeleton() {
  return (
    <div className="space-y-6">
      {/* Header Actions - Search + Add Contacts button */}
      <div className="flex flex-col sm:flex-row gap-4 justify-between items-start sm:items-center animate-skeleton-slide">
        <Skeleton className="h-10 w-64" />
        <div className="flex gap-3">
          <Skeleton className="h-10 w-32 rounded-lg" />
          <Skeleton className="h-10 w-40 rounded-lg" />
        </div>
      </div>

      {/* Stats Cards */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
        <div className="bg-gradient-to-br from-blue-50 to-sky-50 rounded-xl p-5 border border-blue-200 animate-skeleton-slide [animation-delay:100ms]">
          <Skeleton className="h-4 w-32 mb-3" />
          <Skeleton className="h-8 w-20" />
        </div>
        <div className="bg-gradient-to-br from-emerald-50 to-teal-50 rounded-xl p-5 border border-emerald-200 animate-skeleton-slide [animation-delay:150ms]">
          <Skeleton className="h-4 w-32 mb-3" />
          <Skeleton className="h-8 w-20" />
        </div>
        <div className="gradient-bg-subtle rounded-xl p-5 border border-[var(--color-primary)]/20 animate-skeleton-slide [animation-delay:200ms]">
          <Skeleton className="h-4 w-32 mb-3" />
          <Skeleton className="h-8 w-20" />
        </div>
      </div>

      {/* Contacts Table */}
      <div className="bg-white rounded-xl border border-slate-200 overflow-hidden animate-skeleton-slide [animation-delay:280ms]">
        <div className="p-4 border-b border-slate-200 flex items-center justify-between">
          <Skeleton className="h-5 w-40" />
          <Skeleton className="h-8 w-24 rounded-lg" />
        </div>
        <div className="divide-y divide-slate-100">
          {Array.from({ length: 8 }, (_, i) => (
            <div key={i} className={`p-4 flex items-center gap-4 animate-skeleton-slide`} style={{ animationDelay: `${320 + i * 30}ms` }}>
              <Skeleton variant="circular" className="w-10 h-10 flex-shrink-0" />
              <div className="flex-1 space-y-2">
                <Skeleton className="h-4 w-1/4" />
                <Skeleton className="h-3 w-1/3" />
              </div>
              <Skeleton className="h-6 w-16 rounded-full" />
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}
