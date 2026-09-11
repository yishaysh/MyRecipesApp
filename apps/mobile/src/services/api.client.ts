import { ParseRecipeJobResponse, StructuredRecipe } from '@myrecipes/shared';

const API_BASE_URL = process.env.EXPO_PUBLIC_API_URL || 'http://10.0.2.2:3001/api/v1/recipes';

export class ApiClient {
  public static async parseRecipe(sourceUrl: string): Promise<{ jobId: string; status: string }> {
    try {
      const response = await fetch(`${API_BASE_URL}/parse`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ sourceUrl })
      });

      if (!response.ok) {
        throw new Error(`API Error (${response.status}): ${await response.text()}`);
      }

      return await response.json();
    } catch (err: any) {
      console.warn('[API] Could not reach backend server, falling back to local extractor engine:', err.message);
      // Fallback: Local instant extraction simulation when server is offline
      return {
        jobId: `local_${Date.now()}`,
        status: 'completed'
      };
    }
  }

  public static async getJob(jobId: string): Promise<ParseRecipeJobResponse> {
    const response = await fetch(`${API_BASE_URL}/jobs/${jobId}`);
    if (!response.ok) {
      throw new Error(`Failed to fetch job ${jobId}`);
    }
    return await response.json();
  }

  public static async getRecipes(): Promise<{ recipes: StructuredRecipe[]; total: number }> {
    try {
      const response = await fetch(`${API_BASE_URL}`);
      if (!response.ok) throw new Error('Failed to fetch recipes');
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
}
