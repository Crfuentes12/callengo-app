// app/(app)/admin/command-center/page.tsx
'use client';

import { useEffect, useState } from 'react';
import { useRouter } from 'next/navigation';
import AdminCommandCenter from '@/components/admin/AdminCommandCenter';

export default function AdminCommandCenterPage() {
  const router = useRouter();
  const [isAuthorized, setIsAuthorized] = useState(false);
  const [isLoading, setIsLoading] = useState(true);

  useEffect(() => {
    const checkAdminAccess = async () => {
      try {
        const response = await fetch('/api/auth/check-admin');
        if (response.ok) {
          const data = await response.json();
          if (data.isAdmin) {
            setIsAuthorized(true);
          } else {
            router.push('/home');
          }
        } else {
          router.push('/home');
        }
      } catch {
        router.push('/home');
      } finally {
        setIsLoading(false);
      }
    };

    checkAdminAccess();
  }, [router]);

  if (isLoading) {
    return (
      <div className="flex items-center justify-center py-20">
        <div className="text-center">
          <div className="w-8 h-8 border border-[var(--color-primary)]/30 border-t-[var(--color-primary)] rounded-full animate-spin mx-auto mb-3" />
          <p className="text-sm text-[var(--color-neutral-500)]">Loading...</p>
        </div>
      </div>
    );
  }

  if (!isAuthorized) return null;

  return <AdminCommandCenter />;
}
