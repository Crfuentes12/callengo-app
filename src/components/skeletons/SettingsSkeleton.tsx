// components/skeletons/SettingsSkeleton.tsx
'use client';

import { Skeleton } from './SkeletonBase';

export default function SettingsSkeleton() {
  return (
    <div className="space-y-6">
      {/* Tabs */}
      <div className="bg-white rounded-xl border border-slate-200 overflow-hidden shadow-sm">
        <div className="border-b border-slate-100">
          <div className="flex">
            {[1, 2, 3].map((i) => (
              <div key={i} className="flex-1 px-6 py-4">
                <Skeleton className="h-6 w-32 mx-auto" />
              </div>
            ))}
          </div>
        </div>

        <div className="p-6 space-y-6">
          {/* Hero Section */}
          <div className="relative overflow-hidden bg-gradient-to-br from-slate-900 via-indigo-900 to-purple-900 rounded-2xl p-8">
            <div className="relative z-10 flex items-center gap-6">
              <Skeleton className="w-24 h-24 rounded-2xl" />
              <div className="flex-1 space-y-3">
                <Skeleton className="h-8 w-64 bg-white/20" />
                <Skeleton className="h-5 w-48 bg-white/20" />
                <div className="flex gap-4">
                  <Skeleton className="h-4 w-20 bg-white/20" />
                  <Skeleton className="h-4 w-20 bg-white/20" />
                </div>
              </div>
            </div>
          </div>

          {/* Form Fields */}
          <div className="grid md:grid-cols-2 gap-6">
            <div>
              <Skeleton className="h-5 w-32 mb-2" />
              <Skeleton className="h-12 w-full" />
            </div>
            <div>
              <Skeleton className="h-5 w-32 mb-2" />
              <Skeleton className="h-12 w-full" />
            </div>
          </div>

          <div>
            <Skeleton className="h-5 w-32 mb-2" />
            <Skeleton className="h-12 w-full" />
          </div>

          <div>
            <Skeleton className="h-5 w-32 mb-2" />
            <Skeleton className="h-32 w-full" />
          </div>

          <Skeleton className="h-14 w-full" />
        </div>
      </div>
    </div>
  );
}
