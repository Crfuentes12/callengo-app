// components/skeletons/ContactsSkeleton.tsx
'use client';

import { Skeleton, SkeletonTable } from './SkeletonBase';

export default function ContactsSkeleton() {
  return (
    <div className="space-y-6">
      {/* Filters Bar */}
      <div className="bg-white rounded-xl border border-slate-200/80 p-4 shadow-sm">
        <div className="flex items-center gap-3 flex-wrap">
          <Skeleton className="h-4 w-24" />
          <Skeleton className="h-8 w-20 rounded-lg" />
          <Skeleton className="h-8 w-24 rounded-lg" />
          <Skeleton className="h-8 w-20 rounded-lg" />
          <Skeleton className="h-8 w-28 rounded-lg" />
          <Skeleton className="h-8 w-8 rounded-lg" />
        </div>
      </div>

      {/* Header Actions */}
      <div className="flex flex-col sm:flex-row gap-4 justify-between items-start sm:items-center">
        <Skeleton className="h-10 w-64" />
        <div className="flex gap-3">
          <Skeleton className="h-10 w-32" />
          <Skeleton className="h-10 w-40" />
        </div>
      </div>

      {/* Stats Cards */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
        <div className="bg-gradient-to-br from-blue-50 to-indigo-50 rounded-xl p-5 border border-blue-200">
          <Skeleton className="h-4 w-32 mb-3" />
          <Skeleton className="h-8 w-20" />
        </div>
        <div className="bg-gradient-to-br from-emerald-50 to-teal-50 rounded-xl p-5 border border-emerald-200">
          <Skeleton className="h-4 w-32 mb-3" />
          <Skeleton className="h-8 w-20" />
        </div>
        <div className="bg-gradient-to-br from-purple-50 to-pink-50 rounded-xl p-5 border border-purple-200">
          <Skeleton className="h-4 w-32 mb-3" />
          <Skeleton className="h-8 w-20" />
        </div>
      </div>

      {/* Contacts Table */}
      <SkeletonTable rows={8} />
    </div>
  );
}
