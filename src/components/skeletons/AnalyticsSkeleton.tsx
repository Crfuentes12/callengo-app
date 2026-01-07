// components/skeletons/AnalyticsSkeleton.tsx
'use client';

import { Skeleton, SkeletonStat } from './SkeletonBase';

export default function AnalyticsSkeleton() {
  return (
    <div className="space-y-6">
      {/* Date Range Picker */}
      <div className="flex justify-end">
        <Skeleton className="h-10 w-64" />
      </div>

      {/* KPI Cards */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6">
        <SkeletonStat />
        <SkeletonStat />
        <SkeletonStat />
        <SkeletonStat />
      </div>

      {/* Main Charts */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        <div className="bg-white rounded-xl border border-slate-200 p-6">
          <div className="flex items-center justify-between mb-6">
            <Skeleton className="h-6 w-48" />
            <Skeleton className="h-8 w-24" />
          </div>
          <Skeleton className="h-80 w-full" />
        </div>
        <div className="bg-white rounded-xl border border-slate-200 p-6">
          <div className="flex items-center justify-between mb-6">
            <Skeleton className="h-6 w-48" />
            <Skeleton className="h-8 w-24" />
          </div>
          <Skeleton className="h-80 w-full" />
        </div>
      </div>

      {/* Additional Charts */}
      <div className="bg-white rounded-xl border border-slate-200 p-6">
        <Skeleton className="h-6 w-48 mb-6" />
        <Skeleton className="h-96 w-full" />
      </div>
    </div>
  );
}
