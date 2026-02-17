// components/skeletons/FinancesSkeleton.tsx
'use client';

import { Skeleton } from './SkeletonBase';

export default function FinancesSkeleton() {
  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <Skeleton className="h-8 w-64 mb-2" />
          <Skeleton className="h-4 w-80" />
        </div>
        <Skeleton className="h-10 w-48 rounded-lg" />
      </div>

      {/* Key Metrics Cards */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
        {/* Revenue Total */}
        <div className="bg-gradient-to-br from-emerald-50 to-emerald-100 border border-emerald-200 rounded-xl p-6">
          <div className="flex items-center justify-between mb-2">
            <Skeleton className="h-3 w-28" />
            <Skeleton className="w-5 h-5 rounded" />
          </div>
          <Skeleton className="h-9 w-32 mb-3" />
          <div className="flex items-center gap-2">
            <Skeleton className="h-3 w-16" />
            <Skeleton className="h-3 w-20" />
          </div>
        </div>

        {/* Cost Total */}
        <div className="bg-gradient-to-br from-red-50 to-red-100 border border-red-200 rounded-xl p-6">
          <div className="flex items-center justify-between mb-2">
            <Skeleton className="h-3 w-24" />
            <Skeleton className="w-5 h-5 rounded" />
          </div>
          <Skeleton className="h-9 w-32 mb-3" />
          <div className="flex items-center gap-2">
            <Skeleton className="h-3 w-16" />
            <Skeleton className="h-3 w-16" />
          </div>
        </div>

        {/* Gross Margin */}
        <div className="gradient-bg-subtle border border-[var(--color-primary)]/20 rounded-xl p-6">
          <div className="flex items-center justify-between mb-2">
            <Skeleton className="h-3 w-28" />
            <Skeleton className="w-5 h-5 rounded" />
          </div>
          <Skeleton className="h-9 w-32 mb-3" />
          <Skeleton className="h-8 w-20" />
        </div>

        {/* Active Companies */}
        <div className="gradient-bg-subtle border border-[var(--color-primary)]/20 rounded-xl p-6">
          <div className="flex items-center justify-between mb-2">
            <Skeleton className="h-3 w-32" />
            <Skeleton className="w-5 h-5 rounded" />
          </div>
          <Skeleton className="h-9 w-16 mb-3" />
          <Skeleton className="h-4 w-28" />
        </div>
      </div>

      {/* Bland AI Configuration */}
      <div className="bg-white rounded-xl border border-slate-200 p-6">
        <div className="flex items-center gap-2 mb-4">
          <Skeleton className="w-5 h-5 rounded" />
          <Skeleton className="h-6 w-48" />
        </div>

        <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
          <div className="p-4 bg-slate-50 rounded-lg border border-slate-200">
            <Skeleton className="h-3 w-24 mb-2" />
            <Skeleton className="h-6 w-32 mb-1" />
            <Skeleton className="h-4 w-20" />
          </div>

          <div className="p-4 bg-slate-50 rounded-lg border border-slate-200">
            <Skeleton className="h-3 w-20 mb-2" />
            <Skeleton className="h-6 w-28 mb-1" />
            <Skeleton className="h-4 w-32" />
          </div>

          <div className="p-4 bg-slate-50 rounded-lg border border-slate-200">
            <Skeleton className="h-3 w-16 mb-2" />
            <Skeleton className="h-4 w-32 mb-1" />
            <Skeleton className="h-4 w-28 mb-1" />
            <Skeleton className="h-4 w-24" />
          </div>
        </div>
      </div>

      {/* Usage Stats */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
        <div className="bg-white rounded-xl border border-slate-200 p-6">
          <Skeleton className="h-4 w-28 mb-3" />
          <Skeleton className="h-10 w-20 mb-2" />
          <Skeleton className="h-4 w-32 mb-2" />
          <Skeleton className="h-3 w-36" />
        </div>

        <div className="bg-white rounded-xl border border-slate-200 p-6">
          <Skeleton className="h-4 w-32 mb-3" />
          <Skeleton className="h-10 w-24 mb-2" />
          <Skeleton className="h-4 w-40" />
        </div>

        <div className="bg-white rounded-xl border border-slate-200 p-6">
          <Skeleton className="h-4 w-24 mb-3" />
          <Skeleton className="h-10 w-16 mb-2" />
          <Skeleton className="h-4 w-32" />
        </div>
      </div>

      {/* Cost Breakdown */}
      <div className="bg-white rounded-xl border border-slate-200 p-6">
        <Skeleton className="h-6 w-32 mb-4" />
        <div className="space-y-3">
          <div className="flex items-center justify-between p-3 bg-slate-50 rounded-lg">
            <Skeleton className="h-5 w-24" />
            <Skeleton className="h-6 w-28" />
          </div>
          <div className="flex items-center justify-between p-3 bg-slate-50 rounded-lg">
            <Skeleton className="h-5 w-20" />
            <Skeleton className="h-6 w-28" />
          </div>
          <div className="flex items-center justify-between p-3 bg-slate-50 rounded-lg">
            <Skeleton className="h-5 w-24" />
            <Skeleton className="h-6 w-28" />
          </div>
          <div className="flex items-center justify-between p-4 bg-slate-900 rounded-lg border border-slate-700">
            <Skeleton className="h-6 w-16 bg-white/20" />
            <Skeleton className="h-8 w-32 bg-white/20" />
          </div>
        </div>
      </div>
    </div>
  );
}
