// app/analytics/loading.tsx
import LayoutShell from '@/components/layout/LayoutShell';
import AnalyticsSkeleton from '@/components/skeletons/AnalyticsSkeleton';

export default function Loading() {
  return (
    <LayoutShell>
      <AnalyticsSkeleton />
    </LayoutShell>
  );
}
