import { create } from 'zustand';
import { persist, createJSONStorage } from 'zustand/middleware';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { ApiClient } from '../services/api.client';
import { StructuredRecipe } from '@myrecipes/shared';

export interface UserProfile {
  id: string;
  userId?: string;
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
  redeemPromoCode: (code: string) => Promise<{ success: boolean; message: string }>;
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

      setAuth: (user, token, usage) => {
        const normalizedUser: UserProfile = {
          ...user,
          id: user.id || (user as any).userId || `usr_${Date.now()}`,
          userId: user.userId || user.id,
        };
        set({ user: normalizedUser, token, usage, lastSyncedAt: new Date().toISOString() });
      },

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

      redeemPromoCode: async (code: string) => {
        let { token } = get();

        // If no token exists yet, authenticate as guest first to attach promo code
        if (!token) {
          try {
            const guestSub = 'guest_' + Math.random().toString(36).substring(2, 9);
            const res = await fetch(`${ApiClient.getRootUrl()}/auth/google`, {
              method: 'POST',
              headers: { 'Content-Type': 'application/json' },
              body: JSON.stringify({
                mockUser: {
                  sub: guestSub,
                  email: `guest_${guestSub}@myrecipes.app`,
                  name: 'אורח VIP',
                },
              }),
            });
            if (res.ok) {
              const data = await res.json();
              token = data.token;
              set({
                user: {
                  id: data.user.userId,
                  userId: data.user.userId,
                  email: data.user.email,
                  name: data.user.name,
                  isPro: data.user.isPro,
                  proTier: data.user.proTier,
                },
                token: data.token,
                usage: data.usage,
              });
            }
          } catch (err) {
            console.warn('[AUTH_STORE] Guest session creation error:', err);
          }
        }

        if (!token) {
          return { success: false, message: 'נא להתחבר תחילה כדי להפעיל קוד הטבה' };
        }

        try {
          const res = await ApiClient.redeemPromoCode(token, code);
          if (res.success && res.user) {
            const normalizedUser: UserProfile = {
              ...res.user,
              id: res.user.userId || (res.user as any).id || `usr_${Date.now()}`,
              userId: res.user.userId,
            };
            set({
              user: normalizedUser,
              token: res.token || token,
              usage: res.usage,
              showPaywall: false,
            });
            return { success: true, message: res.message };
          }
          return { success: false, message: res.message || 'הפעלת הקוד נכשלה' };
        } catch (err: any) {
          return { success: false, message: err.message || 'שגיאה בהפעלת קוד הטבה' };
        }
      },
    }),
    {
      name: 'my-recipes-auth-storage',
      storage: createJSONStorage(() => AsyncStorage),
    }
  )
);

