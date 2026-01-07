// app/settings/loading.tsx
import LayoutShell from '@/components/layout/LayoutShell';
import SettingsSkeleton from '@/components/skeletons/SettingsSkeleton';

export default function Loading() {
  return (
    <LayoutShell>
      <SettingsSkeleton />
    </LayoutShell>
  );
}
