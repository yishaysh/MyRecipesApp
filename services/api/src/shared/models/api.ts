import { StructuredRecipe } from './recipe.js';

export interface ParseRecipeRequest {
  sourceUrl: string;
  userId?: string;
}

export type JobStatus = 'pending' | 'processing' | 'completed' | 'failed';

export interface ParseRecipeJobResponse {
  jobId: string;
  status: JobStatus;
  progress?: number;
  message?: string;
  recipe?: StructuredRecipe;
  error?: string;
}

export interface RecipeListResponse {
  recipes: StructuredRecipe[];
  total: number;
}
