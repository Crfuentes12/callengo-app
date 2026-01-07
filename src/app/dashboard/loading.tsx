// app/dashboard/loading.tsx
import LayoutShell from '@/components/layout/LayoutShell';
import DashboardSkeleton from '@/components/skeletons/DashboardSkeleton';

export default function Loading() {
  return (
    <LayoutShell>
      <DashboardSkeleton />
    </LayoutShell>
  );
}
