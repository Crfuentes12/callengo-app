import { create } from 'zustand';
import { devtools } from 'zustand/middleware';

interface UserInfo {
  id: string;
  email: string;
  company_id: string;
  role: string;
  full_name?: string;
}

interface CompanyInfo {
  id: string;
  name: string;
  slug: string;
}

interface SubscriptionInfo {
  plan_slug: string;
  status: string;
  minutes_used: number;
  minutes_included: number;
}

interface AppState {
  // User state
  user: UserInfo | null;
  company: CompanyInfo | null;
  subscription: SubscriptionInfo | null;

  // UI state
  sidebarCollapsed: boolean;
  activeModal: string | null;

  // Actions
  setUser: (user: UserInfo | null) => void;
  setCompany: (company: CompanyInfo | null) => void;
  setSubscription: (subscription: SubscriptionInfo | null) => void;
  toggleSidebar: () => void;
  setSidebarCollapsed: (collapsed: boolean) => void;
  openModal: (modalId: string) => void;
  closeModal: () => void;
  reset: () => void;
}

const initialState = {
  user: null,
  company: null,
  subscription: null,
  sidebarCollapsed: false,
  activeModal: null,
};

export const useAppStore = create<AppState>()(
  devtools(
    (set) => ({
      ...initialState,

      setUser: (user) => set({ user }, false, 'setUser'),
      setCompany: (company) => set({ company }, false, 'setCompany'),
      setSubscription: (subscription) => set({ subscription }, false, 'setSubscription'),
      toggleSidebar: () => set((state) => ({ sidebarCollapsed: !state.sidebarCollapsed }), false, 'toggleSidebar'),
      setSidebarCollapsed: (collapsed) => set({ sidebarCollapsed: collapsed }, false, 'setSidebarCollapsed'),
      openModal: (modalId) => set({ activeModal: modalId }, false, 'openModal'),
      closeModal: () => set({ activeModal: null }, false, 'closeModal'),
      reset: () => set(initialState, false, 'reset'),
    }),
    { name: 'callengo-store' }
  )
);
