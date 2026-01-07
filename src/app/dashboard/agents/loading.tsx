// app/dashboard/agents/loading.tsx
import LayoutShell from '@/components/layout/LayoutShell';
import AgentsSkeleton from '@/components/skeletons/AgentsSkeleton';

export default function Loading() {
  return (
    <LayoutShell>
      <AgentsSkeleton />
    </LayoutShell>
  );
}
