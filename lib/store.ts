import { create } from 'zustand';
import { persist } from 'zustand/middleware';

interface User {
  id: string;
  email: string;
  full_name?: string;
  role?: string;
}

interface AuthState {
  user: User | null;
  isLoading: boolean;
  setUser: (user: User | null) => void;
  setLoading: (loading: boolean) => void;
  logout: () => void;
}

interface DashboardStats {
  total_documents: number;
  total_graduates: number;
  pending_requests: number;
  total_verifications: number;
  documents_today: number;
  revenue_this_month: number;
}

interface AppState {
  // Auth state
  auth: AuthState;
  
  // Dashboard stats cache
  dashboardStats: DashboardStats | null;
  setDashboardStats: (stats: DashboardStats | null) => void;
  
  // Global loading state
  isGlobalLoading: boolean;
  setGlobalLoading: (loading: boolean) => void;
  
  // Clear all cached data
  clearCache: () => void;
}

export const useAppStore = create<AppState>()(
  persist(
    (set, get) => ({
      // Auth state
      auth: {
        user: null,
        isLoading: false,
        setUser: (user) => set((state) => ({ 
          auth: { ...state.auth, user } 
        })),
        setLoading: (isLoading) => set((state) => ({ 
          auth: { ...state.auth, isLoading } 
        })),
        logout: () => set((state) => ({ 
          auth: { ...state.auth, user: null } 
        })),
      },
      
      // Dashboard stats
      dashboardStats: null,
      setDashboardStats: (dashboardStats) => set({ dashboardStats }),
      
      // Global loading
      isGlobalLoading: false,
      setGlobalLoading: (isGlobalLoading) => set({ isGlobalLoading }),
      
      // Clear cache
      clearCache: () => set({
        dashboardStats: null,
        auth: { ...get().auth, user: null },
      }),
    }),
    {
      name: 'app-store',
      partialize: (state) => ({
        auth: state.auth,
      }),
    }
  )
);
