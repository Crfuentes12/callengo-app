import { Skeleton } from '@/components/skeletons/SkeletonBase';

export default function Loading() {
  return (
    <div className="space-y-6">
      <div className="animate-skeleton-slide">
        <Skeleton className="h-8 w-48 mb-2" />
        <Skeleton className="h-4 w-72" />
      </div>
      {/* Plan card skeleton */}
      <div className="bg-white rounded-xl border border-slate-200 p-6 animate-skeleton-slide [animation-delay:80ms]">
        <div className="flex items-center justify-between mb-4">
          <div className="flex items-center gap-3">
            <Skeleton className="w-10 h-10 rounded-lg" />
            <div>
              <Skeleton className="h-4 w-28" />
              <Skeleton className="h-3 w-20 mt-1" />
            </div>
          </div>
          <Skeleton className="h-6 w-16 rounded-full" />
        </div>
        <Skeleton className="h-3 w-full rounded-full" />
      </div>
      <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
        {[0, 1, 2].map((i) => (
          <div key={i} className={`bg-white rounded-xl border border-slate-200 p-5 animate-skeleton-slide [animation-delay:${160 + i * 50}ms]`}>
            <div className="flex items-center justify-between mb-3">
              <Skeleton className="h-4 w-24" />
              <Skeleton className="w-8 h-8 rounded-lg" />
            </div>
            <Skeleton className="h-7 w-20" />
            <Skeleton className="h-3 w-16 mt-2" />
          </div>
        ))}
      </div>
      <div className="bg-white rounded-xl border border-slate-200 p-6 animate-skeleton-slide [animation-delay:340ms]">
        <div className="space-y-4">
          {[0, 1, 2, 3, 4].map((i) => (
            <div key={i} className={`flex gap-6 animate-skeleton-slide [animation-delay:${390 + i * 40}ms]`}>
              <Skeleton className="h-4 w-28" />
              <Skeleton className="h-4 w-40" />
              <Skeleton className="h-4 w-20" />
              <Skeleton className="h-4 w-16" />
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}
