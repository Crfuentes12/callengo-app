// components/layout/Layout.tsx
'use client';

import { useState } from 'react';
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
  company,
  headerTitle,
  headerSubtitle,
  headerActions,
}: LayoutProps) {
  const router = useRouter();
  const supabase = createClient();
  const [isSidebarOpen, setIsSidebarOpen] = useState(false);

  const handleLogout = async () => {
    await supabase.auth.signOut();
    router.push('/login');
    router.refresh();
  };

  return (
    <div className="flex h-screen overflow-hidden">
      <Sidebar
        company={company}
        onLogout={handleLogout}
        isOpen={isSidebarOpen}
        onClose={() => setIsSidebarOpen(false)}
      />
      <div className="flex-1 flex flex-col overflow-hidden">
        <Header
          user={user}
          title={headerTitle}
          subtitle={headerSubtitle}
          actions={headerActions}
          onMenuClick={() => setIsSidebarOpen(true)}
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