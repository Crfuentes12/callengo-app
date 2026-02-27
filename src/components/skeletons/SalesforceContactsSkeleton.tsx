// components/skeletons/SalesforceContactsSkeleton.tsx
'use client';

import { Skeleton } from './SkeletonBase';

export default function SalesforceContactsSkeleton() {
  return (
    <div className="space-y-6">
      {/* Breadcrumbs */}
      <div className="flex items-center gap-2 animate-skeleton-slide">
        <Skeleton className="h-4 w-16 rounded-md" />
        <Skeleton className="h-4 w-3 rounded-md" />
        <Skeleton className="h-4 w-20 rounded-md" />
      </div>

      {/* Header */}
      <div className="flex items-center justify-between animate-skeleton-slide [animation-delay:60ms]">
        <div className="flex items-center gap-3">
          <Skeleton className="w-10 h-10 rounded-xl" />
          <div className="space-y-2">
            <Skeleton className="h-6 w-48" />
            <Skeleton className="h-4 w-64" />
          </div>
        </div>
        <Skeleton className="h-10 w-36 rounded-lg" />
      </div>

      {/* Connection Info Bar */}
      <div className="bg-gradient-to-r from-blue-50 to-slate-50 rounded-xl border border-blue-100 p-4 flex items-center justify-between animate-skeleton-slide [animation-delay:120ms]">
        <div className="flex items-center gap-3">
          <Skeleton className="h-6 w-20 rounded-full" />
          <Skeleton className="h-4 w-48" />
        </div>
        <Skeleton className="h-4 w-32" />
      </div>

      {/* Search + Tabs */}
      <div className="flex items-center justify-between gap-4 animate-skeleton-slide [animation-delay:180ms]">
        <div className="flex items-center gap-2">
          <Skeleton className="h-10 w-28 rounded-lg" />
          <Skeleton className="h-10 w-24 rounded-lg" />
        </div>
        <Skeleton className="h-10 w-64 rounded-lg" />
      </div>

      {/* Stats Bar */}
      <div className="flex items-center gap-3 animate-skeleton-slide [animation-delay:220ms]">
        <Skeleton className="h-4 w-16" />
        <Skeleton className="h-5 w-20 rounded-full" />
        <Skeleton className="h-5 w-24 rounded-full" />
      </div>

      {/* Table */}
      <div className="bg-white rounded-xl border border-slate-200 overflow-hidden animate-skeleton-slide [animation-delay:280ms]">
        {/* Table Header */}
        <div className="bg-slate-50 border-b border-slate-200 px-4 py-3 flex items-center gap-4">
          <Skeleton className="w-5 h-5 rounded" />
          <Skeleton className="w-5 h-5" />
          <Skeleton className="h-4 w-24" />
          <Skeleton className="h-4 w-32" />
          <Skeleton className="h-4 w-24" />
          <Skeleton className="h-4 w-28" />
          <Skeleton className="h-4 w-20" />
          <Skeleton className="h-4 w-16" />
          <Skeleton className="h-4 w-20" />
        </div>
        {/* Table Rows */}
        <div className="divide-y divide-slate-100">
          {Array.from({ length: 8 }, (_, i) => (
            <div key={i} className="px-4 py-3 flex items-center gap-4" style={{ animationDelay: `${320 + i * 25}ms` }}>
              <Skeleton className="w-5 h-5 rounded flex-shrink-0" />
              <Skeleton className="w-4 h-4 flex-shrink-0" />
              <Skeleton className="h-4 w-28" />
              <Skeleton className="h-4 w-40" />
              <Skeleton className="h-4 w-24" />
              <Skeleton className="h-4 w-28" />
              <Skeleton className="h-4 w-20" />
              <Skeleton className="h-5 w-14 rounded-full" />
              <Skeleton className="h-3 w-20" />
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}
