import { Skeleton } from '@/components/skeletons/SkeletonBase';

export default function Loading() {
  return (
    <div className="space-y-8">
      {/* Hero Section */}
      <div className="relative overflow-hidden rounded-2xl bg-gradient-to-br from-slate-700 via-slate-800 to-slate-900">
        <div className="px-8 py-10">
          <div className="flex flex-col lg:flex-row lg:items-center lg:justify-between gap-8">
            <div className="max-w-xl">
              <Skeleton className="h-8 w-80 mb-3 !bg-white/10 animate-skeleton-slide" />
              <Skeleton className="h-4 w-96 max-w-full mb-1 !bg-white/10 animate-skeleton-slide [animation-delay:50ms]" />
              <Skeleton className="h-4 w-72 max-w-full !bg-white/10 animate-skeleton-slide [animation-delay:100ms]" />
              <div className="flex items-center gap-5 mt-6">
                {[0, 1, 2].map((i) => (
                  <div key={i} className="flex items-center gap-2">
                    <Skeleton className={`w-9 h-9 rounded-lg !bg-white/10 animate-skeleton-slide [animation-delay:${150 + i * 50}ms]`} />
                    <Skeleton className={`h-3 w-12 !bg-white/10 animate-skeleton-slide [animation-delay:${175 + i * 50}ms]`} />
                  </div>
                ))}
              </div>
            </div>
            <div className="flex flex-col items-end gap-4">
              <div className="flex items-center -space-x-2">
                {[0, 1, 2, 3, 4, 5].map((i) => (
                  <Skeleton key={i} className={`w-9 h-9 rounded-full !bg-white/15 border-2 border-white/10 animate-skeleton-slide [animation-delay:${300 + i * 30}ms]`} />
                ))}
              </div>
              <div className="flex items-center gap-2">
                {[0, 1, 2, 3].map((i) => (
                  <Skeleton key={i} className={`h-6 w-16 rounded-full !bg-white/10 animate-skeleton-slide [animation-delay:${500 + i * 30}ms]`} />
                ))}
              </div>
            </div>
          </div>
        </div>
      </div>

      {/* Upgrade CTA */}
      <div className="flex items-center justify-between gap-4 px-5 py-3.5 rounded-xl bg-slate-50 border border-slate-200 animate-skeleton-slide [animation-delay:600ms]">
        <div className="flex items-center gap-3">
          <Skeleton className="w-8 h-8 rounded-lg" />
          <div>
            <Skeleton className="h-4 w-56 mb-1" />
            <Skeleton className="h-3 w-40" />
          </div>
        </div>
        <Skeleton className="h-9 w-36 rounded-lg shrink-0" />
      </div>

      {/* Filters */}
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3 animate-skeleton-slide [animation-delay:700ms]">
        <div className="flex items-center gap-1 p-1 bg-slate-100/80 rounded-xl">
          {[0, 1, 2, 3, 4, 5].map((i) => (
            <Skeleton key={i} className="h-9 w-24 rounded-lg" />
          ))}
        </div>
        <div className="flex items-center gap-1 p-1 bg-slate-100/80 rounded-xl">
          {[0, 1, 2, 3].map((i) => (
            <Skeleton key={i} className="h-7 w-16 rounded-lg" />
          ))}
        </div>
      </div>

      {/* Grid */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-4">
        {[0, 1, 2, 3, 4, 5, 6, 7, 8, 9, 10, 11].map((i) => (
          <div key={i} className={`flex flex-col p-5 rounded-2xl border border-slate-200 bg-white animate-skeleton-slide [animation-delay:${800 + i * 40}ms]`}>
            <div className="flex items-start gap-3 mb-3">
              <Skeleton className="w-11 h-11 rounded-xl shrink-0" />
              <div className="flex-1 min-w-0">
                <Skeleton className="h-4 w-24 mb-1.5" />
                <Skeleton className="h-3 w-16" />
              </div>
            </div>
            <Skeleton className="h-3 w-full mb-1.5" />
            <Skeleton className="h-3 w-3/4 mb-4" />
            <Skeleton className="h-9 w-full rounded-xl mt-auto" />
          </div>
        ))}
      </div>
    </div>
  );
}
