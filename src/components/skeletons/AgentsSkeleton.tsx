// components/skeletons/AgentsSkeleton.tsx
'use client';

import { Skeleton } from './SkeletonBase';

export default function AgentsSkeleton() {
  return (
    <div className="space-y-8">
      {/* Hero Banner */}
      <div className="relative overflow-hidden rounded-2xl border border-[var(--border-default)]">
        <div className="absolute inset-0 bg-gradient-to-br from-[var(--color-primary-50)] via-white to-blue-50" />
        <div className="relative px-8 py-8">
          <div className="flex items-center gap-5 mb-5">
            <Skeleton className="w-16 h-16 rounded-2xl animate-skeleton-slide" />
            <div className="flex-1">
              <Skeleton className="h-8 w-48 mb-2 animate-skeleton-slide [animation-delay:50ms]" />
              <Skeleton className="h-5 w-80 animate-skeleton-slide [animation-delay:100ms]" />
            </div>
          </div>
          <div className="flex items-center gap-6 p-4 bg-white/80 rounded-xl border border-[var(--border-default)]">
            <Skeleton className="h-8 w-32 animate-skeleton-slide [animation-delay:150ms]" />
            <Skeleton className="h-8 w-32 animate-skeleton-slide [animation-delay:200ms]" />
            <Skeleton className="h-8 w-40 animate-skeleton-slide [animation-delay:250ms]" />
          </div>
        </div>
      </div>

      {/* Agent Cards Grid */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
        {[0, 1, 2].map((i) => (
          <div
            key={i}
            className={`relative rounded-2xl overflow-hidden bg-white border border-[var(--border-default)] shadow-sm animate-skeleton-slide [animation-delay:${300 + i * 80}ms]`}
          >
            {/* Gradient bar */}
            <Skeleton className="h-1 w-full rounded-none" />
            <div className="p-5">
              <div className="flex items-start gap-4 mb-4">
                <Skeleton className="w-14 h-14 rounded-xl" />
                <div className="flex-1">
                  <Skeleton className="h-5 w-36 mb-2" />
                  <Skeleton className="h-5 w-20 rounded-full" />
                </div>
              </div>
              <div className="space-y-2 mb-4">
                <Skeleton className="h-3.5 w-full" />
                <Skeleton className="h-3.5 w-3/4" />
              </div>
              <div className="pt-3 border-t border-[var(--border-default)]">
                <Skeleton className="h-4 w-16" />
              </div>
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}
