// components/skeletons/SkeletonBase.tsx
'use client';

interface SkeletonProps {
  className?: string;
  variant?: 'default' | 'circular' | 'text';
  width?: string;
  height?: string;
}

export function Skeleton({ className = '', variant = 'default', width, height }: SkeletonProps) {
  const variantClasses = {
    default: 'rounded-xl',
    circular: 'rounded-full',
    text: 'rounded-md h-4',
  };

  const style = {
    width: width || undefined,
    height: height || undefined,
  };

  return (
    <div
      className={`bg-slate-200 skeleton-shimmer ${variantClasses[variant]} ${className}`}
      style={style}
    />
  );
}

export function SkeletonCard({ className = '' }: { className?: string }) {
  return (
    <div className={`bg-white rounded-xl border border-slate-200 p-6 ${className}`}>
      <div className="space-y-4">
        <Skeleton className="h-6 w-1/3" />
        <Skeleton className="h-4 w-full" />
        <Skeleton className="h-4 w-2/3" />
      </div>
    </div>
  );
}

export function SkeletonTable({ rows = 5 }: { rows?: number }) {
  return (
    <div className="bg-white rounded-xl border border-slate-200 overflow-hidden">
      <div className="p-4 border-b border-slate-200">
        <Skeleton className="h-8 w-64" />
      </div>
      <div className="divide-y divide-slate-100">
        {Array.from({ length: rows }).map((_, i) => (
          <div key={i} className="p-4 flex items-center gap-4">
            <Skeleton variant="circular" className="w-10 h-10 flex-shrink-0" />
            <div className="flex-1 space-y-2">
              <Skeleton className="h-4 w-1/4" />
              <Skeleton className="h-3 w-1/3" />
            </div>
            <Skeleton className="h-8 w-20" />
          </div>
        ))}
      </div>
    </div>
  );
}

export function SkeletonStat() {
  return (
    <div className="gradient-bg-subtle rounded-xl p-6 border border-[var(--color-primary)]/20">
      <div className="flex items-center justify-between mb-3">
        <Skeleton className="h-5 w-32" />
        <Skeleton variant="circular" className="w-10 h-10" />
      </div>
      <Skeleton className="h-10 w-24 mb-2" />
      <Skeleton className="h-3 w-40" />
    </div>
  );
}
