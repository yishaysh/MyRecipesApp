import { create } from 'zustand';
import { persist, createJSONStorage } from 'zustand/middleware';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { StructuredRecipe } from '@myrecipes/shared';

export type TabType = 'home' | 'discover' | 'extract' | 'recipe' | 'shopping' | 'profile' | 'library';

export interface CustomShoppingItem {
  id: string;
  name: string;
  category: string;
  recipeSource?: string;
  checked: boolean;
}

interface RecipeStoreState {
  currentRecipe: StructuredRecipe | null;
  savedRecipes: StructuredRecipe[];
  checkedIngredients: Record<string, boolean>;
  checkedShoppingItems: Record<string, boolean>;
  customShoppingItems: CustomShoppingItem[];
  activeTab: TabType;
  isKitchenModeOpen: boolean;
  kitchenStepIndex: number;
  isDarkMode: boolean;
  sharedUrl: string | null;
  setSharedUrl: (url: string | null) => void;

  setCurrentRecipe: (recipe: StructuredRecipe | null) => void;
  saveRecipe: (recipe: StructuredRecipe) => void;
  removeRecipe: (id: string) => void;
  toggleBookmark: (id: string) => void;
  toggleIngredient: (id: string) => void;
  toggleShoppingItem: (itemKey: string) => void;
  addCustomShoppingItem: (name: string, category?: string) => void;
  addIngredientsToShoppingList: (ingredients: { name: string; amount?: number | null; unit?: string | null; category?: string }[], recipeTitle: string) => void;
  toggleCustomShoppingItem: (id: string) => void;
  clearCheckedShopping: () => void;
  setActiveTab: (tab: TabType) => void;
  openKitchenMode: (recipe?: StructuredRecipe) => void;
  closeKitchenMode: () => void;
  setKitchenStepIndex: (index: number) => void;
  toggleDarkMode: () => void;
}

export const useRecipeStore = create<RecipeStoreState>()(
  persist(
    (set) => ({
      currentRecipe: null,
      savedRecipes: [],
      checkedIngredients: {},
      checkedShoppingItems: {},
      customShoppingItems: [],
      activeTab: 'home',
      isKitchenModeOpen: false,
      kitchenStepIndex: 0,
      isDarkMode: false,
      sharedUrl: null,
      setSharedUrl: (url) => set({ sharedUrl: url }),

      setCurrentRecipe: (recipe) => set({ currentRecipe: recipe, checkedIngredients: {} }),

      saveRecipe: (recipe) =>
        set((state) => {
          const exists = state.savedRecipes.some((r) => r.id === recipe.id);
          if (exists) {
            return {
              savedRecipes: state.savedRecipes.map((r) => (r.id === recipe.id ? recipe : r)),
              currentRecipe: recipe
            };
          }
          return { savedRecipes: [recipe, ...state.savedRecipes], currentRecipe: recipe };
        }),

      removeRecipe: (id) =>
        set((state) => ({
          savedRecipes: state.savedRecipes.filter((r) => r.id !== id),
          currentRecipe: state.currentRecipe?.id === id ? null : state.currentRecipe
        })),

      toggleBookmark: (id) =>
        set((state) => ({
          savedRecipes: state.savedRecipes.map((r) =>
            r.id === id ? { ...r, isBookmarked: !r.isBookmarked } : r
          ),
          currentRecipe:
            state.currentRecipe?.id === id
              ? { ...state.currentRecipe, isBookmarked: !state.currentRecipe.isBookmarked }
              : state.currentRecipe
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

      addCustomShoppingItem: (name, category = 'pantry') =>
        set((state) => ({
          customShoppingItems: [
            ...state.customShoppingItems,
            { id: `c-${Date.now()}-${Math.random().toString(36).substring(2, 6)}`, name, category, checked: false }
          ]
        })),

      addIngredientsToShoppingList: (ingredients, recipeTitle) =>
        set((state) => {
          const newItems: CustomShoppingItem[] = ingredients.map((ing, idx) => {
            const amountPart = ing.amount ? `${ing.amount} ` : '';
            const unitPart = ing.unit ? `${ing.unit} ` : '';
            const fullName = `${amountPart}${unitPart}${ing.name}`.trim();
            return {
              id: `c-${Date.now()}-${idx}-${Math.random().toString(36).substring(2, 6)}`,
              name: fullName,
              category: ing.category || 'pantry',
              recipeSource: recipeTitle,
              checked: false
            };
          });
          return { customShoppingItems: [...state.customShoppingItems, ...newItems] };
        }),

      toggleCustomShoppingItem: (id) =>
        set((state) => ({
          customShoppingItems: state.customShoppingItems.map((item) =>
            item.id === id ? { ...item, checked: !item.checked } : item
          )
        })),

      clearCheckedShopping: () =>
        set((state) => ({
          checkedShoppingItems: {},
          customShoppingItems: state.customShoppingItems.filter((item) => !item.checked)
        })),

      setActiveTab: (tab) => set({ activeTab: tab }),

      openKitchenMode: (recipe) =>
        set((state) => ({
          isKitchenModeOpen: true,
          kitchenStepIndex: 0,
          currentRecipe: recipe || state.currentRecipe || null
        })),

      closeKitchenMode: () => set({ isKitchenModeOpen: false }),

      setKitchenStepIndex: (index) => set({ kitchenStepIndex: index }),

      toggleDarkMode: () => set((state) => ({ isDarkMode: !state.isDarkMode }))
    }),
    {
      name: 'myrecipes-storage-v1',
      storage: createJSONStorage(() => AsyncStorage),
      partialize: (state) => ({
        savedRecipes: state.savedRecipes,
        customShoppingItems: state.customShoppingItems,
        checkedIngredients: state.checkedIngredients,
        checkedShoppingItems: state.checkedShoppingItems,
        isDarkMode: state.isDarkMode
      })
    }
  )
);

