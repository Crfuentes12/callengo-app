// app/contacts/loading.tsx
import LayoutShell from '@/components/layout/LayoutShell';
import ContactsSkeleton from '@/components/skeletons/ContactsSkeleton';

export default function Loading() {
  return (
    <LayoutShell>
      <ContactsSkeleton />
    </LayoutShell>
  );
}
