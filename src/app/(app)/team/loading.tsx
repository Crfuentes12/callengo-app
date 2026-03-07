import { Skeleton } from '@/components/skeletons/SkeletonBase';

export default function TeamLoading() {
  return (
    <div className="space-y-6">
      {/* Header skeleton */}
      <div className="gradient-bg-subtle rounded-2xl p-8 border border-[var(--border-default)] overflow-hidden">
        <div className="relative z-10 flex items-center gap-4">
          <Skeleton className="w-16 h-16 rounded-2xl animate-skeleton-slide shrink-0" />
          <div className="space-y-2 flex-1 min-w-0">
            <Skeleton className="h-7 w-24 animate-skeleton-slide [animation-delay:50ms]" />
            <Skeleton className="h-4 w-72 max-w-full animate-skeleton-slide [animation-delay:100ms]" />
          </div>
        </div>
      </div>

      {/* Plan seat info skeleton */}
      <div className="bg-gradient-to-r from-[var(--color-neutral-50)] to-[var(--color-primary-50)] rounded-xl border border-[var(--border-default)] p-5">
        <div className="flex items-center justify-between">
          <div className="space-y-2">
            <div className="flex items-center gap-2">
              <Skeleton className="h-5 w-24 animate-skeleton-slide [animation-delay:150ms]" />
              <Skeleton className="h-5 w-20 rounded-full animate-skeleton-slide [animation-delay:200ms]" />
            </div>
            <Skeleton className="h-3 w-48 max-w-full animate-skeleton-slide [animation-delay:250ms]" />
          </div>
          <div className="text-right shrink-0">
            <Skeleton className="h-8 w-16 animate-skeleton-slide [animation-delay:300ms]" />
            <Skeleton className="h-2 w-24 rounded-full mt-1 animate-skeleton-slide [animation-delay:350ms]" />
          </div>
        </div>
      </div>

      {/* Invite section skeleton with tabs */}
      <div className="bg-white rounded-2xl border border-[var(--border-default)] overflow-hidden shadow-sm">
        <div className="border-b border-[var(--border-subtle)] px-5 pt-4 pb-0">
          <Skeleton className="h-4 w-40 mb-3 animate-skeleton-slide [animation-delay:400ms]" />
          <div className="flex gap-1">
            {[0, 1, 2].map((i) => (
              <Skeleton key={i} className={`h-10 w-28 rounded-t-lg animate-skeleton-slide [animation-delay:${450 + i * 40}ms]`} />
            ))}
          </div>
        </div>
        <div className="p-5">
          <div className="flex gap-3">
            <Skeleton className="h-11 flex-1 rounded-xl animate-skeleton-slide [animation-delay:600ms]" />
            <Skeleton className="h-11 w-28 rounded-xl animate-skeleton-slide [animation-delay:650ms]" />
            <Skeleton className="h-11 w-32 rounded-xl animate-skeleton-slide [animation-delay:700ms]" />
          </div>
        </div>
      </div>

      {/* Team members skeleton */}
      <div className="bg-white rounded-xl border border-[var(--border-default)] overflow-hidden">
        <div className="px-5 py-4 border-b border-[var(--border-subtle)]">
          <Skeleton className="h-4 w-36 animate-skeleton-slide [animation-delay:750ms]" />
        </div>
        <div className="divide-y divide-[var(--border-subtle)]">
          {[0, 1, 2].map((i) => (
            <div key={i} className="px-5 py-4 flex items-center justify-between gap-4">
              <div className="flex items-center gap-3 min-w-0">
                <Skeleton className={`w-10 h-10 rounded-full shrink-0 animate-skeleton-slide [animation-delay:${800 + i * 80}ms]`} />
                <div className="space-y-1.5 min-w-0">
                  <div className="flex items-center gap-2">
                    <Skeleton className={`h-4 w-32 animate-skeleton-slide [animation-delay:${850 + i * 80}ms]`} />
                    <Skeleton className={`h-4 w-16 rounded-full animate-skeleton-slide [animation-delay:${900 + i * 80}ms]`} />
                  </div>
                  <Skeleton className={`h-3 w-44 max-w-full animate-skeleton-slide [animation-delay:${950 + i * 80}ms]`} />
                </div>
              </div>
              <Skeleton className={`h-3 w-24 shrink-0 animate-skeleton-slide [animation-delay:${1000 + i * 80}ms]`} />
            </div>
          ))}
        </div>
      </div>

      {/* Permissions skeleton */}
      <div className="bg-[var(--color-neutral-50)] rounded-xl border border-[var(--border-default)] p-5">
        <Skeleton className="h-4 w-32 mb-3 animate-skeleton-slide [animation-delay:1200ms]" />
        <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
          {[0, 1, 2].map((i) => (
            <div key={i} className="p-3 bg-white rounded-lg border border-[var(--border-default)]">
              <Skeleton className={`h-5 w-16 rounded-full mb-2 animate-skeleton-slide [animation-delay:${1250 + i * 50}ms]`} />
              <div className="space-y-1.5">
                <Skeleton className={`h-3 w-full animate-skeleton-slide [animation-delay:${1300 + i * 50}ms]`} />
                <Skeleton className={`h-3 w-full animate-skeleton-slide [animation-delay:${1350 + i * 50}ms]`} />
                <Skeleton className={`h-3 w-3/4 animate-skeleton-slide [animation-delay:${1400 + i * 50}ms]`} />
              </div>
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}
