import { create } from 'zustand';
import { StructuredRecipe } from '@myrecipes/shared';

export type TabType = 'extract' | 'recipe' | 'shopping' | 'library';

interface RecipeStoreState {
  currentRecipe: StructuredRecipe | null;
  savedRecipes: StructuredRecipe[];
  checkedIngredients: Record<string, boolean>;
  checkedShoppingItems: Record<string, boolean>;
  activeTab: TabType;
  setCurrentRecipe: (recipe: StructuredRecipe | null) => void;
  saveRecipe: (recipe: StructuredRecipe) => void;
  removeRecipe: (id: string) => void;
  toggleIngredient: (id: string) => void;
  toggleShoppingItem: (itemKey: string) => void;
  clearCheckedShopping: () => void;
  setActiveTab: (tab: TabType) => void;
}

export const useRecipeStore = create<RecipeStoreState>((set) => ({
  currentRecipe: null,
  savedRecipes: [],
  checkedIngredients: {},
  checkedShoppingItems: {},
  activeTab: 'extract',

  setCurrentRecipe: (recipe) => set({ currentRecipe: recipe, checkedIngredients: {} }),

  saveRecipe: (recipe) =>
    set((state) => {
      const exists = state.savedRecipes.some((r) => r.id === recipe.id);
      if (exists) {
        return {
          savedRecipes: state.savedRecipes.map((r) => (r.id === recipe.id ? recipe : r))
        };
      }
      return { savedRecipes: [recipe, ...state.savedRecipes] };
    }),

  removeRecipe: (id) =>
    set((state) => ({
      savedRecipes: state.savedRecipes.filter((r) => r.id !== id),
      currentRecipe: state.currentRecipe?.id === id ? null : state.currentRecipe
    })),

  toggleIngredient: (id) =>
    set((state) => ({
      checkedIngredients: {
        ...state.checkedIngredients,
        [id]: !state.checkedIngredients[id]
      }
    })),

  toggleShoppingItem: (itemKey) =>
    set((state) => ({
      checkedShoppingItems: {
        ...state.checkedShoppingItems,
        [itemKey]: !state.checkedShoppingItems[itemKey]
      }
    })),

  clearCheckedShopping: () =>
    set({ checkedShoppingItems: {} }),

  setActiveTab: (tab) => set({ activeTab: tab })
}));
