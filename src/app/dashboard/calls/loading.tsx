// app/dashboard/calls/loading.tsx
import LayoutShell from '@/components/layout/LayoutShell';
import CallsSkeleton from '@/components/skeletons/CallsSkeleton';

export default function Loading() {
  return (
    <LayoutShell>
      <CallsSkeleton />
    </LayoutShell>
  );
}
