// app/admin/finances/page.tsx
'use client';

import { useEffect, useState } from 'react';
import { useRouter } from 'next/navigation';
import AdminFinances from '@/components/admin/AdminFinances';

export default function AdminFinancesPage() {
  const router = useRouter();
  const [isAuthorized, setIsAuthorized] = useState(false);
  const [isLoading, setIsLoading] = useState(true);

  useEffect(() => {
    // Check if user is admin
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
      } catch (error) {
        console.error('Error checking admin access:', error);
        router.push('/dashboard');
      } finally {
        setIsLoading(false);
      }
    };

    checkAdminAccess();
  }, [router]);

  if (isLoading) {
    return (
      <div className="min-h-screen bg-gradient-to-br from-slate-50 via-white to-slate-100 flex items-center justify-center">
        <div className="text-slate-600">Loading...</div>
      </div>
    );
  }

  if (!isAuthorized) {
    return null;
  }

  return (
    <div className="min-h-screen bg-gradient-to-br from-slate-50 via-white to-slate-100">
      <AdminFinances />
    </div>
  );
}
