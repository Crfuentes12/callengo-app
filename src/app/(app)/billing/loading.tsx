export default function Loading() {
  return (
    <div className="space-y-6 animate-pulse">
      <div>
        <div className="h-8 w-48 bg-slate-200 rounded-lg" />
        <div className="h-4 w-72 bg-slate-100 rounded mt-2" />
      </div>
      {/* Plan card skeleton */}
      <div className="bg-white rounded-xl border border-slate-200 p-6">
        <div className="flex items-center justify-between mb-4">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 bg-slate-100 rounded-lg" />
            <div>
              <div className="h-4 w-28 bg-slate-200 rounded" />
              <div className="h-3 w-20 bg-slate-100 rounded mt-1" />
            </div>
          </div>
          <div className="h-6 w-16 bg-slate-100 rounded-full" />
        </div>
        <div className="h-3 bg-slate-100 rounded-full" />
      </div>
      <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
        {[...Array(3)].map((_, i) => (
          <div key={i} className="bg-white rounded-xl border border-slate-200 p-5">
            <div className="flex items-center justify-between mb-3">
              <div className="h-4 w-24 bg-slate-100 rounded" />
              <div className="w-8 h-8 bg-slate-100 rounded-lg" />
            </div>
            <div className="h-7 w-20 bg-slate-200 rounded" />
            <div className="h-3 w-16 bg-slate-100 rounded mt-2" />
          </div>
        ))}
      </div>
      <div className="bg-white rounded-xl border border-slate-200 p-6">
        <div className="space-y-4">
          {[...Array(5)].map((_, i) => (
            <div key={i} className="flex gap-6">
              <div className="h-4 w-28 bg-slate-100 rounded" />
              <div className="h-4 w-40 bg-slate-100 rounded" />
              <div className="h-4 w-20 bg-slate-100 rounded" />
              <div className="h-4 w-16 bg-slate-100 rounded" />
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}
