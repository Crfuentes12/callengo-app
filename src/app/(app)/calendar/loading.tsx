export default function CalendarLoading() {
  return (
    <div className="space-y-6">
      {/* Header skeleton */}
      <div className="rounded-2xl p-8 bg-slate-50 border border-slate-200">
        <div className="flex items-center gap-4">
          <div className="w-16 h-16 rounded-2xl skeleton"></div>
          <div className="space-y-2">
            <div className="w-32 h-6 skeleton"></div>
            <div className="w-64 h-4 skeleton"></div>
          </div>
        </div>
        <div className="grid grid-cols-4 gap-4 mt-6">
          {[1, 2, 3, 4].map(i => (
            <div key={i} className="h-24 rounded-xl skeleton"></div>
          ))}
        </div>
      </div>
      {/* Calendar skeleton */}
      <div className="bg-white rounded-2xl border border-slate-200 p-4">
        <div className="h-8 w-48 skeleton mb-4"></div>
        <div className="grid grid-cols-7 gap-2">
          {Array.from({ length: 35 }, (_, i) => (
            <div key={i} className="h-24 rounded-lg skeleton"></div>
          ))}
        </div>
      </div>
    </div>
  );
}
