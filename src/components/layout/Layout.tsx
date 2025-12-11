// components/layout/Layout.tsx
'use client';

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

const handleLogout = async () => {
  await supabase.auth.signOut();
  router.push('/login');
  router.refresh();
};

  return (
    <div className="flex h-screen overflow-hidden">
      <Sidebar company={company} onLogout={handleLogout} />
      <div className="flex-1 flex flex-col overflow-hidden">
        <Header
          user={user}
          title={headerTitle}
          subtitle={headerSubtitle}
          actions={headerActions}
        />
        <Main>{children}</Main>
      </div>
    </div>
  );
}