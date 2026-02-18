// components/layout/Layout.tsx
'use client';

import { useState, useEffect } from 'react';
import { useRouter } from 'next/navigation';
import { createClient } from '@/lib/supabase/client';
import Sidebar from './Sidebar';
import Header from './Header';
import Main from './Main';
import { Database } from '@/types/supabase';

type Company = Database['public']['Tables']['companies']['Row'];
type User = {
  id: string;
  email: string;
  full_name: string | null;
};

interface LayoutProps {
  children: React.ReactNode;
  user: User;
  company: Company;
  headerTitle: string;
  headerSubtitle?: string;
  headerActions?: React.ReactNode;
}

export default function Layout({
  children,
  user,
  company: initialCompany,
  headerTitle,
  headerSubtitle,
  headerActions,
}: LayoutProps) {
  const router = useRouter();
  const supabase = createClient();
  const [isSidebarOpen, setIsSidebarOpen] = useState(false);
  const [isSidebarCollapsed, setIsSidebarCollapsed] = useState(false);
  const [userRole, setUserRole] = useState<string>('user');
  const [company, setCompany] = useState<Company>(initialCompany);

  // Subscribe to company changes in real-time
  useEffect(() => {
    const channel = supabase
      .channel('company-changes')
      .on(
        'postgres_changes',
        {
          event: 'UPDATE',
          schema: 'public',
          table: 'companies',
          filter: `id=eq.${initialCompany.id}`,
        },
        (payload) => {
          console.log('Company updated:', payload.new);
          setCompany(payload.new as Company);
        }
      )
      .subscribe();

    return () => {
      supabase.removeChannel(channel);
    };
  }, [initialCompany.id, supabase]);

  useEffect(() => {
    const fetchUserRole = async () => {
      try {
        const { data } = await supabase
          .from('users')
          .select('role')
          .eq('id', user.id)
          .single();

        if (data?.role) {
          setUserRole(data.role);
        }
      } catch (error) {
        console.error('Error fetching user role:', error);
      }
    };

    fetchUserRole();
  }, [user.id, supabase]);

  const handleLogout = async () => {
    await supabase.auth.signOut();
    router.push('/login');
    router.refresh();
  };

  return (
    <div className="flex h-screen overflow-hidden">
      <Sidebar
        company={company}
        userRole={userRole}
        onLogout={handleLogout}
        isOpen={isSidebarOpen}
        onClose={() => setIsSidebarOpen(false)}
        isCollapsed={isSidebarCollapsed}
        onToggleCollapse={() => setIsSidebarCollapsed(!isSidebarCollapsed)}
      />
      <div className="flex-1 flex flex-col overflow-hidden">
        <Header
          user={user}
          title={headerTitle}
          subtitle={headerSubtitle}
          actions={headerActions}
          onMenuClick={() => setIsSidebarOpen(true)}
          onLogout={handleLogout}
          companyId={company.id}
        />
        <Main>{children}</Main>
      </div>

      {/* Mobile Overlay */}
      {isSidebarOpen && (
        <div
          className="fixed inset-0 bg-slate-900/60 backdrop-blur-sm z-40 lg:hidden"
          onClick={() => setIsSidebarOpen(false)}
        />
      )}
    </div>
  );
}