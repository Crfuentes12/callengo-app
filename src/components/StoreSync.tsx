'use client';

import { useEffect } from 'react';
import { useAuth } from '@/contexts/AuthContext';
import { useAppStore } from '@/stores/app-store';

export function StoreSync() {
  const { user } = useAuth();
  const setUser = useAppStore((state) => state.setUser);
  const reset = useAppStore((state) => state.reset);

  useEffect(() => {
    if (user) {
      setUser({
        id: user.id,
        email: user.email || '',
        company_id: user.user_metadata?.company_id || '',
        role: user.user_metadata?.role || 'member',
        full_name: user.user_metadata?.full_name,
      });
    } else {
      reset();
    }
  }, [user, setUser, reset]);

  return null;
}
