import { StructuredRecipe } from '@myrecipes/shared';

export class RecipeStorageService {
  private static instance: RecipeStorageService;
  private recipes: Map<string, StructuredRecipe> = new Map();

  private constructor() {}

  public static getInstance(): RecipeStorageService {
    if (!RecipeStorageService.instance) {
      RecipeStorageService.instance = new RecipeStorageService();
    }
    return RecipeStorageService.instance;
  }

  public save(recipe: StructuredRecipe): StructuredRecipe {
    this.recipes.set(recipe.id, recipe);
    return recipe;
  }

  public getById(id: string): StructuredRecipe | undefined {
    return this.recipes.get(id);
  }

  public getAll(): StructuredRecipe[] {
    return Array.from(this.recipes.values()).sort(
      (a, b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime()
    );
  }

  public delete(id: string): boolean {
    return this.recipes.delete(id);
  }

  public clear(): void {
    this.recipes.clear();
  }
}
