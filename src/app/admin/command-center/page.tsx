// app/admin/command-center/page.tsx
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
            router.push('/dashboard');
          }
        } else {
          router.push('/dashboard');
        }
      } catch {
        router.push('/dashboard');
      } finally {
        setIsLoading(false);
      }
    };

    checkAdminAccess();
  }, [router]);

  if (isLoading) {
    return (
      <div className="min-h-screen bg-gradient-to-br from-[var(--color-neutral-50)] via-white to-[var(--color-neutral-100)] flex items-center justify-center">
        <div className="text-[var(--color-neutral-600)]">Loading...</div>
      </div>
    );
  }

  if (!isAuthorized) return null;

  return (
    <div className="min-h-screen bg-gradient-to-br from-[var(--color-neutral-50)] via-white to-[var(--color-neutral-100)]">
      <AdminCommandCenter />
    </div>
  );
}
