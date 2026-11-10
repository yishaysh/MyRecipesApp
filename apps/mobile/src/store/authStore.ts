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

const bootstrapGuestSession = async (set: any): Promise<{ token: string; user: UserProfile; usage: UsageQuota } | null> => {
  try {
    const guestAuth = await ApiClient.createGuestSession();
    const normalizedUser: UserProfile = {
      id: guestAuth.user.userId,
      userId: guestAuth.user.userId,
      email: guestAuth.user.email,
      name: guestAuth.user.name,
      isPro: guestAuth.user.isPro,
      proTier: guestAuth.user.proTier,
    };
    set({
      user: normalizedUser,
      token: guestAuth.token,
      usage: guestAuth.usage,
    });
    return { token: guestAuth.token, user: normalizedUser, usage: guestAuth.usage };
  } catch (e) {
    console.warn('[AUTH_STORE] Error creating guest session:', e);
    return null;
  }
};

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
        } catch (err: any) {
          console.warn('[AUTH_STORE] Error fetching usage:', err);
          // Auto-heal on 401 or 403 (stale token from old server secret)
          if (err?.status === 401 || err?.status === 403 || err?.message?.includes('401') || err?.message?.includes('403')) {
            console.log('[AUTH_STORE] Stale/invalid token detected on mobile, auto-healing with fresh guest session...');
            const guest = await bootstrapGuestSession(set);
            return guest ? guest.usage : null;
          }
        }
        return null;
      },

      syncWithCloud: async (localRecipes, onMerge) => {
        let { token, isSyncing } = get();
        if (isSyncing) return false;

        // Ensure token exists before syncing
        if (!token) {
          const guest = await bootstrapGuestSession(set);
          if (!guest) return false;
          token = guest.token;
        }

        set({ isSyncing: true });
        try {
          const res = await ApiClient.syncRecipes(token, localRecipes);
          if (res.usage) {
            set({ usage: res.usage });
          }
          if (Array.isArray(res.mergedRecipes) && res.mergedRecipes.length > 0) {
            onMerge(res.mergedRecipes);
          }

          set({ isSyncing: false, lastSyncedAt: new Date().toISOString() });
          return true;
        } catch (err: any) {
          console.error('[AUTH_STORE] Sync with cloud failed:', err);
          // Auto-heal on 401
          if (err?.status === 401 || err?.status === 403 || err?.message?.includes('401')) {
            console.log('[AUTH_STORE] Stale token detected during sync, purging and refreshing session...');
            set({ token: null, user: null });
            await get().fetchUsage();
          }
          set({ isSyncing: false });
          return false;
        }
      },

      redeemPromoCode: async (code: string) => {
        let { token } = get();

        // If no token exists yet, authenticate as guest first to attach promo code
        if (!token) {
          const guest = await bootstrapGuestSession(set);
          if (guest) token = guest.token;
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

