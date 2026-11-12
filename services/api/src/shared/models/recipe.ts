export type IngredientCategory =
  | 'produce'
  | 'dairy'
  | 'meat'
  | 'pantry'
  | 'spices'
  | 'bakery'
  | 'other';

export type RecipePlatform =
  | 'instagram'
  | 'tiktok'
  | 'facebook'
  | 'youtube'
  | 'web';

export interface Ingredient {
  id: string;
  name: string;
  amount: number | null;
  unit: string | null;
  category: IngredientCategory;
  group?: string | null;
  originalText: string;
}

export interface InstructionStep {
  stepNumber: number;
  instruction: string;
  durationMinutes?: number | null;
  tip?: string | null;
}

export interface ShoppingCategoryItem {
  category: string;
  items: string[];
}

export interface StructuredRecipe {
  id: string;
  title: string;
  description: string;
  sourceUrl: string;
  platform: RecipePlatform;
  imageUrl?: string | null;
  isBookmarked?: boolean;
  isPinned?: boolean;
  isArchived?: boolean;
  category?: string | null;
  servings: number | null;
  prepTimeMinutes: number | null;
  cookTimeMinutes: number | null;
  totalTimeMinutes: number | null;
  difficulty?: 'קל' | 'בינוני' | 'מתקדם' | string | null;
  timeEstimated?: boolean;
  notes?: string | null;
  isUserEdited?: boolean;
  cookCount?: number;
  lastCookedAt?: string | null;
  ingredients: Ingredient[];
  instructions: InstructionStep[];
  shoppingList: ShoppingCategoryItem[];
  tags: string[];
  createdAt: string;
  updatedAt?: string;
}

export interface TrendingRecipe {
  id: string;
  rank: number;
  title: string;
  description: string;
  creator: string;
  platform: RecipePlatform;
  sourceUrl: string;
  imageUrl: string;
  viewsCount: string;
  likesCount: string;
  totalTimeMinutes?: number;
  category: string;
  tags: string[];
  recipe: StructuredRecipe;
}

export interface TrendingResponse {
  trends: TrendingRecipe[];
  categories: string[];
  platforms: string[];
  lastUpdated: string;
}
