import { create } from 'zustand';

interface IntegrationStatus {
  provider: string;
  connected: boolean;
  lastSync?: string;
  error?: string;
}

interface IntegrationState {
  integrations: Record<string, IntegrationStatus>;
  setIntegrationStatus: (provider: string, status: Partial<IntegrationStatus>) => void;
  setAllIntegrations: (integrations: Record<string, IntegrationStatus>) => void;
}

export const useIntegrationStore = create<IntegrationState>((set) => ({
  integrations: {},

  setIntegrationStatus: (provider, status) =>
    set((state) => ({
      integrations: {
        ...state.integrations,
        [provider]: { ...state.integrations[provider], provider, ...status },
      },
    })),

  setAllIntegrations: (integrations) => set({ integrations }),
}));
