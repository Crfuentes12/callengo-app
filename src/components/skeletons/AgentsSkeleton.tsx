// components/skeletons/AgentsSkeleton.tsx
'use client';

import { Skeleton } from './SkeletonBase';

export default function AgentsSkeleton() {
  return (
    <div className="space-y-8">
      {/* Hero Banner - Agent Style */}
      <div className="relative overflow-hidden bg-gradient-to-br from-slate-950 via-slate-900 to-slate-950 rounded-3xl p-10 shadow-2xl border-2 border-slate-800">
        <div className="relative z-10">
          <div className="flex items-center gap-4 mb-4">
            <Skeleton className="w-16 h-16 rounded-2xl" />
            <div className="flex-1">
              <Skeleton className="h-10 w-80 mb-2" />
              <Skeleton className="h-5 w-96" />
            </div>
          </div>
        </div>
      </div>

      {/* Agents Grid */}
      <div>
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
          {[...Array(6)].map((_, i) => (
            <div
              key={i}
              className="group relative bg-gradient-to-br from-white to-slate-50 rounded-2xl border-2 border-slate-200 p-6 shadow-sm hover:shadow-xl transition-all duration-300"
            >
              {/* Agent Avatar */}
              <div className="flex items-start gap-4 mb-4">
                <Skeleton className="w-16 h-16 rounded-xl" />
                <div className="flex-1">
                  <Skeleton className="h-6 w-32 mb-2" />
                  <Skeleton className="h-4 w-24 rounded-full" />
                </div>
              </div>

              {/* Description */}
              <div className="space-y-2 mb-4">
                <Skeleton className="h-3 w-full" />
                <Skeleton className="h-3 w-full" />
                <Skeleton className="h-3 w-3/4" />
              </div>

              {/* Features */}
              <div className="space-y-2 mb-4">
                <Skeleton className="h-4 w-20 mb-2" />
                <div className="flex flex-wrap gap-2">
                  <Skeleton className="h-6 w-16 rounded" />
                  <Skeleton className="h-6 w-20 rounded" />
                  <Skeleton className="h-6 w-18 rounded" />
                </div>
              </div>

              {/* Actions */}
              <div className="flex gap-2 pt-4 border-t border-slate-200">
                <Skeleton className="h-10 flex-1 rounded-xl" />
                <Skeleton className="h-10 w-10 rounded-xl" />
              </div>
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}
