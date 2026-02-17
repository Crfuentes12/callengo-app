// components/skeletons/AnalyticsSkeleton.tsx
'use client';

import { Skeleton } from './SkeletonBase';

export default function AnalyticsSkeleton() {
  return (
    <div className="space-y-6">
      {/* Hero Banner */}
      <div className="relative overflow-hidden bg-gradient-to-br from-slate-950 via-slate-900 to-slate-950 rounded-3xl p-10 shadow-2xl border border-slate-800">
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
                <Skeleton className="h-3 w-24 mb-2 bg-white/10" />
                <Skeleton className="h-8 w-16 bg-white/10" />
                <Skeleton className="h-3 w-20 mt-1 bg-white/10" />
              </div>
            ))}
          </div>
        </div>
      </div>

      {/* Key Metrics Grid */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
        {[...Array(4)].map((_, i) => (
          <div key={i} className="bg-white rounded-xl border border-slate-200/80 p-6">
            <div className="flex items-start justify-between mb-4">
              <div className="flex-1">
                <Skeleton className="h-4 w-32 mb-3" />
                <Skeleton className="h-10 w-24 mb-2" />
                <Skeleton className="h-4 w-28" />
              </div>
              <Skeleton className="w-14 h-14 rounded-2xl" />
            </div>
            <Skeleton className="h-1 w-full rounded-full" />
          </div>
        ))}
      </div>

      {/* Call Trends - Last 30 Days */}
      <div className="bg-white rounded-2xl border border-slate-200/80 p-6 shadow-sm">
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
          {[...Array(10)].map((_, i) => (
            <div key={i} className="flex items-center gap-3">
              <Skeleton className="w-20 h-4" />
              <Skeleton className="flex-1 h-10 rounded-lg" />
              <Skeleton className="w-14 h-4" />
            </div>
          ))}
        </div>
      </div>

      {/* Agent Performance & Contact Status */}
      <div className="grid lg:grid-cols-2 gap-6">
        {/* Agent Performance */}
        <div className="bg-white rounded-2xl border border-slate-200/80 overflow-hidden shadow-sm">
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
            {[...Array(3)].map((_, i) => (
              <div key={i} className="p-4 bg-gradient-to-br from-slate-50 to-white rounded-xl border border-slate-200">
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
                  <div className="bg-white/80 rounded-lg p-3 border border-slate-200">
                    <Skeleton className="h-3 w-20 mb-2" />
                    <Skeleton className="h-5 w-12" />
                  </div>
                  <div className="bg-white/80 rounded-lg p-3 border border-slate-200">
                    <Skeleton className="h-3 w-20 mb-2" />
                    <Skeleton className="h-5 w-12" />
                  </div>
                </div>
              </div>
            ))}
          </div>
        </div>

        {/* Contact Status */}
        <div className="bg-white rounded-2xl border border-slate-200/80 overflow-hidden shadow-sm">
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
            {[...Array(5)].map((_, i) => (
              <div key={i}>
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
      <div className="bg-white rounded-2xl border border-slate-200/80 p-6 shadow-sm">
        <div className="flex items-center gap-3 mb-6">
          <Skeleton className="w-10 h-10 rounded-xl" />
          <div>
            <Skeleton className="h-6 w-48 mb-2" />
            <Skeleton className="h-4 w-56" />
          </div>
        </div>
        <div className="grid grid-cols-12 gap-2">
          {[...Array(24)].map((_, i) => {
            const heights = ['25%', '40%', '60%', '80%', '50%', '70%', '45%', '35%', '55%', '75%', '30%', '65%', '50%', '85%', '40%', '60%', '35%', '55%', '70%', '45%', '30%', '50%', '65%', '40%'];
            return (
              <div key={i} className="flex flex-col items-center">
                <div className="w-full h-32 flex items-end">
                  <Skeleton className="w-full rounded-t-lg" height={heights[i]} />
                </div>
                <Skeleton className="h-3 w-6 mt-2" />
              </div>
            );
          })}
        </div>
      </div>

      {/* Campaign Performance */}
      <div className="bg-white rounded-2xl border border-slate-200/80 overflow-hidden shadow-sm">
        <div className="p-6 border-b border-slate-100 bg-gradient-to-r from-emerald-50 to-white">
          <div className="flex items-center gap-3">
            <Skeleton className="w-10 h-10 rounded-xl" />
            <div>
              <Skeleton className="h-6 w-44 mb-2" />
              <Skeleton className="h-4 w-48" />
            </div>
          </div>
        </div>
        <div className="p-6 space-y-4">
          {[...Array(3)].map((_, i) => (
            <div key={i} className="p-5 bg-gradient-to-br from-slate-50 to-white rounded-xl border border-slate-200">
              <div className="flex items-center justify-between mb-3">
                <Skeleton className="h-6 w-40" />
                <Skeleton className="h-6 w-20 rounded-lg" />
              </div>
              <div className="grid grid-cols-4 gap-3 mb-3">
                {[...Array(4)].map((_, j) => (
                  <div key={j} className="text-center p-2 bg-white/80 rounded-lg border border-slate-200">
                    <Skeleton className="h-3 w-12 mb-1 mx-auto" />
                    <Skeleton className="h-6 w-8 mx-auto" />
                  </div>
                ))}
              </div>
              <div>
                <div className="flex items-center justify-between mb-2">
                  <Skeleton className="h-3 w-16" />
                  <Skeleton className="h-3 w-12" />
                </div>
                <Skeleton className="h-3 w-full rounded-full" />
              </div>
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}
