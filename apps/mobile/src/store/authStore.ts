import { create } from 'zustand';
import { persist, createJSONStorage } from 'zustand/middleware';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { ApiClient } from '../services/api.client';
import { StructuredRecipe } from '@myrecipes/shared';

export interface UserProfile {
  id: string;
  email: string;
  name?: string;
  avatarUrl?: string;
  isPro: boolean;
  proTier: string;
}

export interface UsageQuota {
  allowed: boolean;
  remaining: number;
  totalLimit: number;
  used: number;
  isPro: boolean;
  period: string;
}

interface AuthState {
  user: UserProfile | null;
  token: string | null;
  usage: UsageQuota | null;
  isSyncing: boolean;
  lastSyncedAt: string | null;
  showPaywall: boolean;

  setAuth: (user: UserProfile, token: string, usage: UsageQuota) => void;
  setUsage: (usage: UsageQuota) => void;
  setShowPaywall: (show: boolean) => void;
  logout: () => void;
  fetchUsage: () => Promise<UsageQuota | null>;
  syncWithCloud: (localRecipes: StructuredRecipe[], onMerge: (merged: StructuredRecipe[]) => void) => Promise<boolean>;
}

export const useAuthStore = create<AuthState>()(
  persist(
    (set, get) => ({
      user: null,
      token: null,
      usage: null,
      isSyncing: false,
      lastSyncedAt: null,
      showPaywall: false,

      setAuth: (user, token, usage) => set({ user, token, usage, lastSyncedAt: new Date().toISOString() }),

      setUsage: (usage) => set({ usage }),

      setShowPaywall: (showPaywall) => set({ showPaywall }),

      logout: () => set({ user: null, token: null, usage: null, lastSyncedAt: null }),

      fetchUsage: async () => {
        const { token } = get();
        if (!token) return null;
        try {
          const usage = await ApiClient.getUsage(token);
          if (usage) {
            set({ usage });
            return usage;
          }
        } catch (err) {
          console.warn('[AUTH_STORE] Error fetching usage:', err);
        }
        return null;
      },

      syncWithCloud: async (localRecipes, onMerge) => {
        const { token, isSyncing } = get();
        if (!token || isSyncing) return false;

        set({ isSyncing: true });
        try {
          // 1. Push local recipes to cloud
          await ApiClient.syncPush(token, localRecipes);

          // 2. Pull all cloud recipes
          const { recipes: cloudRecipes, usage } = await ApiClient.syncPull(token);

          if (usage) {
            set({ usage });
          }

          if (Array.isArray(cloudRecipes) && cloudRecipes.length > 0) {
            // Merge cloud recipes with local recipes (cloud wins on newer updatedAt, local keeps new unpushed)
            const map = new Map<string, StructuredRecipe>();
            for (const r of localRecipes) {
              map.set(r.id, r);
            }
            for (const cr of cloudRecipes) {
              map.set(cr.id, cr);
            }
            const merged = Array.from(map.values());
            onMerge(merged);
          }

          set({ isSyncing: false, lastSyncedAt: new Date().toISOString() });
          return true;
        } catch (err) {
          console.error('[AUTH_STORE] Sync with cloud failed:', err);
          set({ isSyncing: false });
          return false;
        }
      },
    }),
    {
      name: 'my-recipes-auth-storage',
      storage: createJSONStorage(() => AsyncStorage),
    }
  )
);
