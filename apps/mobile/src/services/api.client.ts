import { ParseRecipeJobResponse, StructuredRecipe, TrendingResponse } from '@myrecipes/shared';

// Support both full endpoint or base host in EXPO_PUBLIC_API_URL
const rawBase = process.env.EXPO_PUBLIC_API_URL || 'https://my-recipes-app-mu.vercel.app';
const API_BASE_URL = rawBase.endsWith('/api/v1/recipes')
  ? rawBase
  : `${rawBase.replace(/\/+$/, '')}/api/v1/recipes`;

const ROOT_API_URL = API_BASE_URL.replace(/\/recipes\/?$/, '');

export interface AuthResponse {
  user: {
    userId: string;
    email: string;
    name?: string;
    avatarUrl?: string;
    isPro: boolean;
    proTier: string;
  };
  token: string;
  usage: {
    allowed: boolean;
    remaining: number;
    totalLimit: number;
    used: number;
    isPro: boolean;
    period: string;
  };
}

export class ApiClient {
  public static getBaseUrl(): string {
    return API_BASE_URL;
  }

  public static getRootUrl(): string {
    return ROOT_API_URL;
  }

  /**
   * Authenticate with backend using Google ID token
   */
  public static async loginWithGoogle(idToken: string): Promise<AuthResponse> {
    const response = await fetch(`${ROOT_API_URL}/auth/google`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ idToken }),
    });

    if (!response.ok) {
      const err = await response.json().catch(() => ({ error: 'Authentication failed' }));
      throw new Error(err.message || err.error || 'התחברות באמצעות Google נכשלה');
    }

    return await response.json();
  }

  /**
   * Fetch current authenticated user profile & quota
   */
  public static async getMe(token: string): Promise<AuthResponse> {
    const response = await fetch(`${ROOT_API_URL}/auth/me`, {
      headers: {
        Authorization: `Bearer ${token}`,
      },
    });

    if (!response.ok) {
      throw new Error('לא ניתן לאמת את הטוקן');
    }

    return await response.json();
  }

  /**
   * Get current usage quota status
   */
  public static async getUsage(token: string): Promise<AuthResponse['usage']> {
    const response = await fetch(`${ROOT_API_URL}/sync/usage`, {
      headers: {
        Authorization: `Bearer ${token}`,
      },
    });

    if (!response.ok) {
      const err: any = new Error(`נכשלה קריאת מכסת החילוצים (${response.status})`);
      err.status = response.status;
      throw err;
    }

    return await response.json();
  }

  /**
   * Unified bidirectional sync: push local recipes & pull merged cloud recipes
   */
  public static async syncRecipes(
    token: string,
    localRecipes: StructuredRecipe[]
  ): Promise<{ success: boolean; mergedRecipes: StructuredRecipe[]; usage?: AuthResponse['usage'] }> {
    const response = await fetch(`${ROOT_API_URL}/sync/recipes`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${token}`,
      },
      body: JSON.stringify({ localRecipes }),
    });

    const data = await response.json().catch(() => ({}));
    if (!response.ok) {
      const err: any = new Error(data.message || data.error || `סנכרון נכשל (${response.status})`);
      err.status = response.status;
      throw err;
    }

    return data;
  }

  /**
   * Push local recipes batch to cloud
   */
  public static async syncPush(token: string, recipes: StructuredRecipe[]): Promise<{ success: boolean; savedCount: number }> {
    const response = await fetch(`${ROOT_API_URL}/sync/push`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${token}`,
      },
      body: JSON.stringify({ recipes }),
    });

    if (!response.ok) {
      throw new Error('נכשל סנכרון מתכונים לענן');
    }

    return await response.json();
  }

  /**
   * Pull user recipes from cloud
   */
  public static async syncPull(token: string): Promise<{ recipes: StructuredRecipe[]; usage?: AuthResponse['usage'] }> {
    const response = await fetch(`${ROOT_API_URL}/sync/pull`, {
      method: 'POST',
      headers: {
        Authorization: `Bearer ${token}`,
      },
    });

    if (!response.ok) {
      throw new Error('נכשלה משיכת מתכונים מהענן');
    }

    return await response.json();
  }

  /**
   * Create an anonymous guest session
   */
  public static async createGuestSession(): Promise<AuthResponse> {
    const response = await fetch(`${ROOT_API_URL}/auth/guest`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
    });

    const data = await response.json().catch(() => ({}));
    if (!response.ok) {
      throw new Error(data.error || 'יצירת סשן אורח נכשלה');
    }

    return data;
  }

  /**
   * Redeem promo or VIP code for Chef Pro access
   */
  public static async redeemPromoCode(
    token: string,
    code: string
  ): Promise<{ success: boolean; message: string; user: AuthResponse['user']; token?: string; usage: AuthResponse['usage'] }> {
    const response = await fetch(`${ROOT_API_URL}/auth/redeem-code`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${token}`,
      },
      body: JSON.stringify({ code }),
    });

    const data = await response.json().catch(() => ({}));
    if (!response.ok) {
      throw new Error(data.error || 'קוד ההטבה שהוזן אינו תקף');
    }

    return data;
  }

  public static async parseRecipe(sourceUrl: string, token?: string | null): Promise<{ jobId: string; status: string }> {
    const controller = new AbortController();
    const timeout = setTimeout(() => controller.abort(), 90000);

    try {
      const headers: Record<string, string> = { 'Content-Type': 'application/json' };
      if (token) {
        headers['Authorization'] = `Bearer ${token}`;
      }

      const response = await fetch(`${API_BASE_URL}/parse`, {
        method: 'POST',
        headers,
        body: JSON.stringify({ sourceUrl }),
        signal: controller.signal
      });

      if (!response.ok) {
        if (response.status === 403) {
          const quotaErr = await response.json().catch(() => ({}));
          const error: any = new Error(quotaErr.message || 'מיצית את מכסת 5 החילוצים החודשית החינמית');
          error.isQuotaExceeded = true;
          error.usage = quotaErr.usage;
          throw error;
        }
        const errorText = await response.text();
        throw new Error(`שגיאת שרת (${response.status}): ${errorText || response.statusText}`);
      }

      return await response.json();
    } catch (err: any) {
      if (err.isQuotaExceeded) {
        throw err;
      }
      if (err.name === 'AbortError' || err.name === 'TimeoutError' || (err.message && (err.message.includes('canceled') || err.message.includes('aborted') || err.message.includes('Timeout')))) {
        throw new Error('בקשת החילוץ עברה את הזמן הקצוב (Timeout). השרת בענן מתעורר משינה, אנא נסה שוב בעוד מספר שניות.');
      }
      throw new Error(err.message || 'לא ניתן להתחבר לשרת החילוץ');
    } finally {
      clearTimeout(timeout);
    }
  }

  public static async getJob(jobId: string): Promise<ParseRecipeJobResponse> {
    const controller = new AbortController();
    const timeout = setTimeout(() => controller.abort(), 12000);

    try {
      const response = await fetch(`${API_BASE_URL}/jobs/${jobId}`, {
        signal: controller.signal
      });
      if (!response.ok) {
        throw new Error(`נכשל איתור משימה ${jobId}`);
      }
      return await response.json();
    } finally {
      clearTimeout(timeout);
    }
  }

  public static async getRecipes(): Promise<{ recipes: StructuredRecipe[]; total: number }> {
    try {
      const response = await fetch(`${API_BASE_URL}`);
      if (!response.ok) throw new Error('נכשלה טעינת מתכונים');
      return await response.json();
    } catch {
      return { recipes: [], total: 0 };
    }
  }

  public static async deleteRecipe(id: string): Promise<boolean> {
    try {
      const response = await fetch(`${API_BASE_URL}/${id}`, { method: 'DELETE' });
      return response.ok;
    } catch {
      return false;
    }
  }

  public static async getTrends(category?: string, platform?: string, search?: string): Promise<TrendingResponse> {
    try {
      const params = new URLSearchParams();
      if (category && category !== 'הכל') params.append('category', category);
      if (platform && platform !== 'all') params.append('platform', platform);
      if (search) params.append('search', search);

      const query = params.toString();
      const url = query ? `${API_BASE_URL}/trends?${query}` : `${API_BASE_URL}/trends`;
      const response = await fetch(url);
      if (!response.ok) throw new Error('נכשלה טעינת טרנדים');
      return await response.json();
    } catch (err) {
      console.warn('[ApiClient] Failed to fetch live trends:', err);
      return {
        trends: [],
        categories: ['הכל', '🔥 ויראלי', '🍫 קינוחים', '🥩 בשר', '🍝 איטלקי', '⚡ מהיר', '🥗 בריא'],
        platforms: ['all', 'tiktok', 'instagram', 'youtube'],
        lastUpdated: new Date().toISOString()
      };
    }
  }
}
