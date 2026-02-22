import { Skeleton } from '@/components/skeletons/SkeletonBase';

export default function CalendarLoading() {
  return (
    <div className="space-y-6">
      {/* Header with icon, title, and buttons */}
      <div className="gradient-bg-subtle rounded-2xl p-8 border border-slate-200 overflow-hidden">
        <div className="relative z-10">
          <div className="flex items-center justify-between animate-skeleton-slide">
            <div className="flex items-center gap-4">
              <Skeleton className="w-16 h-16 rounded-2xl" />
              <div className="space-y-2">
                <Skeleton className="h-7 w-28" />
                <Skeleton className="h-4 w-72" />
              </div>
            </div>
            <div className="flex items-center gap-3">
              <Skeleton className="h-10 w-32 rounded-lg" />
              <Skeleton className="h-10 w-36 rounded-lg" />
            </div>
          </div>

          {/* Stats row */}
          <div className="grid grid-cols-2 md:grid-cols-4 gap-4 mt-6">
            {[0, 1, 2, 3].map((i) => (
              <div key={i} className={`p-4 bg-white/80 backdrop-blur-sm rounded-xl border border-slate-200 animate-skeleton-slide [animation-delay:${80 + i * 50}ms]`}>
                <div className="flex items-center gap-2 mb-2">
                  <Skeleton className="w-2 h-2 rounded-full" />
                  <Skeleton className="h-3 w-16" />
                </div>
                <Skeleton className="h-8 w-10" />
                <Skeleton className="h-3 w-24 mt-1" />
              </div>
            ))}
          </div>
        </div>
      </div>

      {/* Calendar controls and grid */}
      <div className="bg-white rounded-2xl border border-slate-200 shadow-sm overflow-hidden">
        {/* Controls bar */}
        <div className="p-4 border-b border-slate-100 flex items-center justify-between animate-skeleton-slide [animation-delay:280ms]">
          <div className="flex items-center gap-4">
            <div className="flex items-center gap-1">
              <Skeleton className="w-8 h-8 rounded-lg" />
              <Skeleton className="w-16 h-8 rounded-lg" />
              <Skeleton className="w-8 h-8 rounded-lg" />
            </div>
            <Skeleton className="h-6 w-40" />
          </div>
          <div className="flex items-center gap-3">
            {/* Filter tabs */}
            <div className="flex bg-slate-100 rounded-lg p-0.5 gap-0.5">
              {[0, 1, 2, 3, 4].map((i) => (
                <Skeleton key={i} className="h-7 w-20 rounded-md" />
              ))}
            </div>
            {/* View mode tabs */}
            <div className="flex bg-slate-100 rounded-lg p-0.5 gap-0.5">
              {[0, 1, 2, 3].map((i) => (
                <Skeleton key={i} className="h-7 w-16 rounded-md" />
              ))}
            </div>
          </div>
        </div>

        {/* Calendar month grid */}
        <div className="p-4">
          {/* Day headers */}
          <div className="grid grid-cols-7 mb-2">
            {['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'].map((day, i) => (
              <div key={day} className={`text-center py-2 animate-skeleton-slide [animation-delay:${330 + i * 20}ms]`}>
                <Skeleton className="h-3 w-8 mx-auto" />
              </div>
            ))}
          </div>
          {/* Calendar cells */}
          <div className="grid grid-cols-7 border-t border-l border-slate-200">
            {Array.from({ length: 35 }, (_, i) => {
              const hasEvents = [3, 7, 12, 15, 19, 23, 27, 31].includes(i);
              return (
                <div
                  key={i}
                  className={`min-h-[100px] p-1.5 border-r border-b border-slate-200 animate-skeleton-slide [animation-delay:${380 + i * 12}ms]`}
                >
                  <Skeleton className="w-6 h-6 rounded-full mb-1" />
                  {hasEvents && (
                    <div className="space-y-0.5">
                      <Skeleton className="h-4 w-full rounded" />
                      {i % 5 === 0 && <Skeleton className="h-4 w-3/4 rounded" />}
                    </div>
                  )}
                </div>
              );
            })}
          </div>
        </div>
      </div>
    </div>
  );
}
