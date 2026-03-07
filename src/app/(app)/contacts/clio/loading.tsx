export default function Loading() {
  return (
    <div className="space-y-6 animate-pulse">
      <div className="h-8 w-48 bg-[var(--color-neutral-100)] rounded-lg" />
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-3">
          <div className="w-10 h-10 rounded-xl bg-[var(--color-neutral-100)]" />
          <div>
            <div className="h-5 w-40 bg-[var(--color-neutral-100)] rounded" />
            <div className="h-3 w-28 bg-[var(--color-neutral-100)] rounded mt-1" />
          </div>
        </div>
        <div className="h-10 w-36 bg-[var(--color-neutral-100)] rounded-lg" />
      </div>
      <div className="bg-white rounded-xl border border-[var(--border-default)] overflow-hidden">
        <div className="bg-[var(--color-neutral-50)] border-b border-[var(--border-default)] px-4 py-3 flex items-center gap-4">
          {Array.from({ length: 7 }, (_, i) => (
            <div key={i} className="h-4 bg-[var(--color-neutral-100)] rounded" style={{ width: `${60 + i * 10}px` }} />
          ))}
        </div>
        <div className="divide-y divide-[var(--border-subtle)]">
          {Array.from({ length: 8 }, (_, i) => (
            <div key={i} className="px-4 py-3.5 flex items-center gap-4" style={{ animationDelay: `${i * 50}ms` }}>
              <div className="w-5 h-5 rounded bg-[var(--color-neutral-100)] shrink-0" />
              <div className="w-4 h-4 rounded bg-[var(--color-neutral-100)] shrink-0" />
              <div className="h-4 w-28 rounded bg-[var(--color-neutral-100)]" />
              <div className="h-4 w-40 rounded bg-[var(--color-neutral-100)]" />
              <div className="h-4 w-24 rounded bg-[var(--color-neutral-100)]" />
              <div className="h-4 w-28 rounded bg-[var(--color-neutral-100)]" />
              <div className="h-5 w-14 rounded-full bg-[var(--color-neutral-100)]" />
              <div className="h-3 w-20 rounded bg-[var(--color-neutral-100)]" />
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}
