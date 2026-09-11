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
  originalText: string;
}

export interface InstructionStep {
  stepNumber: number;
  instruction: string;
  durationMinutes?: number;
  tip?: string;
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
  servings: number | null;
  prepTimeMinutes: number | null;
  cookTimeMinutes: number | null;
  totalTimeMinutes: number | null;
  ingredients: Ingredient[];
  instructions: InstructionStep[];
  shoppingList: ShoppingCategoryItem[];
  tags: string[];
  createdAt: string;
}
