import { Skeleton } from '@/components/skeletons/SkeletonBase';

export default function Loading() {
  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between animate-skeleton-slide">
        <div>
          <Skeleton className="h-8 w-32 mb-2" />
          <Skeleton className="h-5 w-72" />
        </div>
      </div>

      {/* Summary Cards */}
      <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
        {[0, 1, 2, 3].map((i) => (
          <div key={i} className={`bg-white rounded-xl border border-slate-200 p-5 animate-skeleton-slide [animation-delay:${80 + i * 50}ms]`}>
            <Skeleton className="h-4 w-28 mb-2" />
            <Skeleton className="h-8 w-16 mb-1" />
            <Skeleton className="h-3 w-20" />
          </div>
        ))}
      </div>

      {/* Reports Grid */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        {[0, 1, 2, 3].map((i) => (
          <div key={i} className={`bg-white rounded-xl border border-slate-200 p-6 animate-skeleton-slide [animation-delay:${280 + i * 60}ms]`}>
            <div className="flex items-center gap-3 mb-4">
              <Skeleton className="w-10 h-10 rounded-lg" />
              <div>
                <Skeleton className="h-5 w-40 mb-1" />
                <Skeleton className="h-3 w-56" />
              </div>
            </div>
            <Skeleton className="h-48 w-full rounded-lg" />
          </div>
        ))}
      </div>
    </div>
  );
}
