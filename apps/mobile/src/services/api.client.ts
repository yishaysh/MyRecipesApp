import { ParseRecipeJobResponse, StructuredRecipe, TrendingResponse } from '@myrecipes/shared';

// Support both full endpoint or base host in EXPO_PUBLIC_API_URL
const rawBase = process.env.EXPO_PUBLIC_API_URL || 'https://my-recipes-app-mu.vercel.app';
const API_BASE_URL = rawBase.endsWith('/api/v1/recipes')
  ? rawBase
  : `${rawBase.replace(/\/+$/, '')}/api/v1/recipes`;

export class ApiClient {
  public static getBaseUrl(): string {
    return API_BASE_URL;
  }

  public static async parseRecipe(sourceUrl: string): Promise<{ jobId: string; status: string }> {
    const controller = new AbortController();
    const timeout = setTimeout(() => controller.abort(), 45000);

    try {
      const response = await fetch(`${API_BASE_URL}/parse`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ sourceUrl }),
        signal: controller.signal
      });

      if (!response.ok) {
        const errorText = await response.text();
        throw new Error(`שגיאת שרת (${response.status}): ${errorText || response.statusText}`);
      }

      return await response.json();
    } catch (err: any) {
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
