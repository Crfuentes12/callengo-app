// components/skeletons/AnalyticsSkeleton.tsx
'use client';

import { Skeleton } from './SkeletonBase';

export default function AnalyticsSkeleton() {
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
              <div key={i} className={`p-4 bg-white/80 backdrop-blur-sm rounded-xl border border-slate-200 animate-skeleton-slide [animation-delay:${150 + i * 50}ms]`}>
                <div className="flex items-center gap-2 mb-2">
                  <Skeleton className="w-2 h-2 rounded-full" />
                  <Skeleton className="h-3 w-20" />
                </div>
                <Skeleton className="h-8 w-16" />
                <Skeleton className="h-3 w-20 mt-1" />
              </div>
            ))}
          </div>
        </div>
      </div>

      {/* Call Trends */}
      <div className="bg-white rounded-2xl border border-slate-200/80 p-6 shadow-sm animate-skeleton-slide [animation-delay:350ms]">
        <div className="flex items-center justify-between mb-6">
          <div>
            <Skeleton className="h-6 w-48 mb-2" />
            <Skeleton className="h-4 w-40" />
          </div>
          <div className="flex items-center gap-4">
            <Skeleton className="h-4 w-24" />
            <Skeleton className="h-4 w-20" />
          </div>
        </div>
        <div className="space-y-2">
          {Array.from({ length: 10 }, (_, i) => (
            <div key={i} className={`flex items-center gap-3 animate-skeleton-slide [animation-delay:${400 + i * 30}ms]`}>
              <Skeleton className="w-20 h-4" />
              <Skeleton className="flex-1 h-10 rounded-lg" />
              <Skeleton className="w-14 h-4" />
            </div>
          ))}
        </div>
      </div>

      {/* Agent Performance & Contact Status */}
      <div className="grid lg:grid-cols-2 gap-6">
        <div className="bg-white rounded-2xl border border-slate-200/80 overflow-hidden shadow-sm animate-skeleton-slide [animation-delay:700ms]">
          <div className="p-6 border-b border-slate-100 gradient-bg-subtle">
            <div className="flex items-center gap-3">
              <Skeleton className="w-10 h-10 rounded-xl" />
              <div>
                <Skeleton className="h-6 w-40 mb-2" />
                <Skeleton className="h-4 w-48" />
              </div>
            </div>
          </div>
          <div className="p-6 space-y-4">
            {[0, 1, 2].map((i) => (
              <div key={i} className={`p-4 bg-gradient-to-br from-slate-50 to-white rounded-xl border border-slate-200 animate-skeleton-slide [animation-delay:${750 + i * 50}ms]`}>
                <div className="flex items-start justify-between mb-3">
                  <div>
                    <Skeleton className="h-5 w-32 mb-2" />
                    <Skeleton className="h-3 w-24" />
                  </div>
                  <div className="text-right">
                    <Skeleton className="h-8 w-16 mb-1" />
                    <Skeleton className="h-3 w-12" />
                  </div>
                </div>
                <div className="grid grid-cols-2 gap-3">
                  {[0, 1].map((j) => (
                    <div key={j} className="bg-white/80 rounded-lg p-3 border border-slate-200">
                      <Skeleton className="h-3 w-20 mb-2" />
                      <Skeleton className="h-5 w-12" />
                    </div>
                  ))}
                </div>
              </div>
            ))}
          </div>
        </div>

        <div className="bg-white rounded-2xl border border-slate-200/80 overflow-hidden shadow-sm animate-skeleton-slide [animation-delay:750ms]">
          <div className="p-6 border-b border-slate-100 gradient-bg-subtle">
            <div className="flex items-center gap-3">
              <Skeleton className="w-10 h-10 rounded-xl" />
              <div>
                <Skeleton className="h-6 w-32 mb-2" />
                <Skeleton className="h-4 w-40" />
              </div>
            </div>
          </div>
          <div className="p-6 space-y-4">
            {[0, 1, 2, 3, 4].map((i) => (
              <div key={i} className={`animate-skeleton-slide [animation-delay:${800 + i * 40}ms]`}>
                <div className="flex items-center justify-between mb-2">
                  <Skeleton className="h-4 w-32" />
                  <div className="flex items-center gap-2">
                    <Skeleton className="h-4 w-12" />
                    <Skeleton className="h-3 w-16" />
                  </div>
                </div>
                <Skeleton className="h-3 w-full rounded-full" />
              </div>
            ))}
          </div>
        </div>
      </div>

      {/* Hourly Distribution */}
      <div className="bg-white rounded-2xl border border-slate-200/80 p-6 shadow-sm animate-skeleton-slide [animation-delay:1000ms]">
        <div className="flex items-center gap-3 mb-6">
          <Skeleton className="w-10 h-10 rounded-xl" />
          <div>
            <Skeleton className="h-6 w-48 mb-2" />
            <Skeleton className="h-4 w-56" />
          </div>
        </div>
        <div className="grid grid-cols-12 gap-2">
          {Array.from({ length: 24 }, (_, i) => {
            const heights = ['25%', '40%', '60%', '80%', '50%', '70%', '45%', '35%', '55%', '75%', '30%', '65%', '50%', '85%', '40%', '60%', '35%', '55%', '70%', '45%', '30%', '50%', '65%', '40%'];
            return (
              <div key={i} className={`flex flex-col items-center animate-skeleton-slide [animation-delay:${1050 + i * 20}ms]`}>
                <div className="w-full h-32 flex items-end">
                  <Skeleton className="w-full rounded-t-lg" height={heights[i]} />
                </div>
                <Skeleton className="h-3 w-6 mt-2" />
              </div>
            );
          })}
        </div>
      </div>
    </div>
  );
}
