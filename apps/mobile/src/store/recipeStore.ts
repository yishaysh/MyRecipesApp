import { create } from 'zustand';
import { persist, createJSONStorage } from 'zustand/middleware';
import AsyncStorage from '@react-native-async-storage/async-storage';
import {
  StructuredRecipe,
  getLocalCalendarDateKey,
  hasRecipeBeenCookedOnDate
} from '@myrecipes/shared';
import { areRecipesDuplicate } from '../utils/recipeMatcher';

export type TabType = 'home' | 'discover' | 'extract' | 'recipe' | 'shopping' | 'profile' | 'library';

export interface CustomShoppingItem {
  id: string;
  name: string;
  category: string;
  recipeId?: string;
  recipeSource?: string;
  checked: boolean;
}

interface RecipeStoreState {
  currentRecipe: StructuredRecipe | null;
  savedRecipes: StructuredRecipe[];
  checkedIngredients: Record<string, boolean>;
  checkedShoppingItems: Record<string, boolean>;
  dismissedShoppingItems: Record<string, boolean>;
  customShoppingItems: CustomShoppingItem[];
  customTags: string[];
  activeTab: TabType;
  isKitchenModeOpen: boolean;
  kitchenStepIndex: number;
  isDarkMode: boolean;
  sharedUrl: string | null;
  setSharedUrl: (url: string | null) => void;
  clearSharedUrl: () => void;

  setCurrentRecipe: (recipe: StructuredRecipe | null) => void;
  saveRecipe: (recipe: StructuredRecipe) => void;
  saveRecipes: (recipes: StructuredRecipe[], options?: { forceNew?: boolean }) => StructuredRecipe[];
  removeRecipe: (id: string) => void;
  toggleBookmark: (id: string) => void;
  togglePinRecipe: (id: string) => void;
  toggleArchiveRecipe: (id: string) => void;
  markRecipeCookedToday: (id: string, now?: Date) => { recorded: boolean; alreadyCookedToday: boolean; dateKey: string };
  removeShoppingItem: (itemKey: string) => void;
  removeCustomShoppingItem: (id: string) => void;
  clearAllShoppingItems: () => void;
  toggleIngredient: (id: string) => void;
  toggleShoppingItem: (itemKey: string) => void;
  addCustomShoppingItem: (name: string, category?: string) => void;
  addCustomTag: (tag: string) => void;
  deleteCustomTag: (tag: string) => void;
  updateRecipeTags: (recipeId: string, tags: string[]) => void;
  addIngredientsToShoppingList: (
    ingredients: { name: string; amount?: number | null; unit?: string | null; category?: string }[],
    recipeTitle: string,
    recipeId?: string
  ) => { addedCount: number; alreadyInList: boolean };
  toggleCustomShoppingItem: (id: string) => void;
  clearCheckedShopping: () => void;
  setActiveTab: (tab: TabType) => void;
  openKitchenMode: (recipe?: StructuredRecipe) => void;
  closeKitchenMode: () => void;
  setKitchenStepIndex: (index: number) => void;
  toggleDarkMode: () => void;
  clearAllRecipes: () => void;
  resetAllData: () => void;
  setSavedRecipes: (recipes: StructuredRecipe[]) => void;
}

export const useRecipeStore = create<RecipeStoreState>()(
  persist(
    (set) => ({
      currentRecipe: null,
      savedRecipes: [],
      checkedIngredients: {},
      checkedShoppingItems: {},
      dismissedShoppingItems: {},
      customShoppingItems: [],
      customTags: ['אסייתי', 'איטלקי', 'מהיר', 'טבעוני', 'מרקים', 'קינוחים'],
      activeTab: 'home',
      isKitchenModeOpen: false,
      kitchenStepIndex: 0,
      isDarkMode: false,
      sharedUrl: null,
      setSharedUrl: (url) => set({ sharedUrl: url }),

      setCurrentRecipe: (recipe) => set({ currentRecipe: recipe, checkedIngredients: {} }),

      clearSharedUrl: () => set({ sharedUrl: null }),

      saveRecipe: (recipe) =>
        set((state) => {
          const existsIndex = state.savedRecipes.findIndex(
            (r) =>
              r.id === recipe.id ||
              areRecipesDuplicate(r, {
                id: recipe.id,
                url: recipe.sourceUrl,
                title: recipe.title,
                allowDuplicate: Boolean(recipe.allowDuplicate)
              })
          );
          if (existsIndex >= 0) {
            const updated = [...state.savedRecipes];
            updated[existsIndex] = {
              ...updated[existsIndex],
              ...recipe,
              id: updated[existsIndex].id,
              isBookmarked: updated[existsIndex].isBookmarked ?? recipe.isBookmarked,
              createdAt: updated[existsIndex].createdAt || recipe.createdAt
            };
            return {
              savedRecipes: updated,
              currentRecipe: updated[existsIndex]
            };
          }
          return { savedRecipes: [recipe, ...state.savedRecipes], currentRecipe: recipe };
        }),

      saveRecipes: (newRecipes, options) => {
        if (!newRecipes || newRecipes.length === 0) return [];
        const forceNew = Boolean(options?.forceNew);
        const savedEntries: StructuredRecipe[] = [];
        set((state) => {
          let currentList = [...state.savedRecipes];
          for (const recipe of newRecipes) {
            if (forceNew) {
              const nowIso = new Date().toISOString();
              const cloned: StructuredRecipe = {
                ...recipe,
                id: `rec_${Date.now()}_re_${Math.random().toString(36).substring(2, 8)}`,
                allowDuplicate: true,
                isBookmarked: false,
                isPinned: false,
                isArchived: false,
                isUserEdited: false,
                notes: null,
                cookCount: 0,
                lastCookedAt: null,
                lastCookedDate: null,
                createdAt: nowIso,
                updatedAt: nowIso
              };
              currentList = [cloned, ...currentList];
              savedEntries.push(cloned);
              continue;
            }
            const existsIndex = currentList.findIndex(
              (r) =>
                r.id === recipe.id ||
                areRecipesDuplicate(r, {
                  id: recipe.id,
                  url: recipe.sourceUrl,
                  title: recipe.title,
                  allowDuplicate: Boolean((recipe as any).allowDuplicate)
                })
            );
            if (existsIndex >= 0) {
              const merged = {
                ...currentList[existsIndex],
                ...recipe,
                id: currentList[existsIndex].id,
                isBookmarked: currentList[existsIndex].isBookmarked ?? recipe.isBookmarked,
                createdAt: currentList[existsIndex].createdAt || recipe.createdAt
              };
              currentList[existsIndex] = merged;
              savedEntries.push(merged);
            } else {
              currentList = [recipe, ...currentList];
              savedEntries.push(recipe);
            }
          }
          return {
            savedRecipes: currentList,
            currentRecipe: savedEntries[0] || state.currentRecipe || newRecipes[0] || null
          };
        });
        return savedEntries;
      },

      setSavedRecipes: (recipes) =>
        set((state) => {
          if (!Array.isArray(recipes)) return { savedRecipes: [] };
          const deduped: StructuredRecipe[] = [];
          for (const recipe of recipes) {
            const existsIndex = deduped.findIndex(
              (r) =>
                r.id === recipe.id ||
                areRecipesDuplicate(r, {
                  id: recipe.id,
                  url: recipe.sourceUrl,
                  title: recipe.title,
                  allowDuplicate: Boolean((recipe as any).allowDuplicate)
                })
            );
            if (existsIndex >= 0) {
              const incomingIsNewer = recipe.updatedAt && deduped[existsIndex].updatedAt
                ? new Date(recipe.updatedAt).getTime() >= new Date(deduped[existsIndex].updatedAt).getTime()
                : true;
              deduped[existsIndex] = {
                ...deduped[existsIndex],
                ...recipe,
                id: deduped[existsIndex].id,
                isBookmarked: incomingIsNewer ? Boolean(recipe.isBookmarked) : Boolean(deduped[existsIndex].isBookmarked),
                isPinned: incomingIsNewer ? Boolean(recipe.isPinned) : Boolean(deduped[existsIndex].isPinned),
                tags: Array.from(new Set([...(deduped[existsIndex].tags || []), ...(recipe.tags || [])])),
                updatedAt: recipe.updatedAt || deduped[existsIndex].updatedAt || new Date().toISOString(),
              };
            } else {
              deduped.push(recipe);
            }
          }
          return { savedRecipes: deduped };
        }),

      removeRecipe: (id) =>
        set((state) => ({
          savedRecipes: state.savedRecipes.filter((r) => r.id !== id),
          currentRecipe: state.currentRecipe?.id === id ? null : state.currentRecipe
        })),

      toggleBookmark: (id) =>
        set((state) => {
          const nowIso = new Date().toISOString();
          return {
            savedRecipes: state.savedRecipes.map((r) =>
              r.id === id ? { ...r, isBookmarked: !r.isBookmarked, updatedAt: nowIso } : r
            ),
            currentRecipe:
              state.currentRecipe?.id === id
                ? { ...state.currentRecipe, isBookmarked: !state.currentRecipe.isBookmarked, updatedAt: nowIso }
                : state.currentRecipe
          };
        }),

      togglePinRecipe: (id) =>
        set((state) => ({
          savedRecipes: state.savedRecipes.map((r) =>
            r.id === id ? { ...r, isPinned: !r.isPinned } : r
          ),
          currentRecipe:
            state.currentRecipe?.id === id
              ? { ...state.currentRecipe, isPinned: !state.currentRecipe.isPinned }
              : state.currentRecipe
        })),

      toggleArchiveRecipe: (id) =>
        set((state) => ({
          savedRecipes: state.savedRecipes.map((r) =>
            r.id === id ? { ...r, isArchived: !r.isArchived } : r
          ),
          currentRecipe:
            state.currentRecipe?.id === id
              ? { ...state.currentRecipe, isArchived: !state.currentRecipe.isArchived }
              : state.currentRecipe
        })),

      markRecipeCookedToday: (id, now = new Date()) => {
        const dateKey = getLocalCalendarDateKey(now);
        const nowIso = now.toISOString();
        let result = { recorded: false, alreadyCookedToday: false, dateKey };
        set((state) => {
          const target =
            state.savedRecipes.find((r) => r.id === id) ||
            (state.currentRecipe?.id === id ? state.currentRecipe : null);
          if (!target) {
            return state;
          }
          if (hasRecipeBeenCookedOnDate(target, dateKey)) {
            result = { recorded: false, alreadyCookedToday: true, dateKey };
            return state;
          }
          const nextCount = (Number(target.cookCount) || 0) + 1;
          result = { recorded: true, alreadyCookedToday: false, dateKey };
          return {
            savedRecipes: state.savedRecipes.map((r) =>
              r.id === id
                ? { ...r, cookCount: nextCount, lastCookedAt: nowIso, lastCookedDate: dateKey, updatedAt: nowIso }
                : r
            ),
            currentRecipe:
              state.currentRecipe?.id === id
                ? {
                    ...state.currentRecipe,
                    cookCount: nextCount,
                    lastCookedAt: nowIso,
                    lastCookedDate: dateKey,
                    updatedAt: nowIso
                  }
                : state.currentRecipe
          };
        });
        return result;
      },

      removeShoppingItem: (itemKey) =>
        set((state) => ({
          customShoppingItems: state.customShoppingItems.filter((item) => item.id !== itemKey),
          dismissedShoppingItems: {
            ...state.dismissedShoppingItems,
            [itemKey]: true
          }
        })),

      removeCustomShoppingItem: (id) =>
        set((state) => ({
          customShoppingItems: state.customShoppingItems.filter((item) => item.id !== id)
        })),

      clearAllShoppingItems: () =>
        set({
          customShoppingItems: [],
          checkedShoppingItems: {},
          dismissedShoppingItems: {}
        }),

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

      addIngredientsToShoppingList: (ingredients, recipeTitle, recipeId) => {
        let result = { addedCount: 0, alreadyInList: false };
        set((state) => {
          const targetId = recipeId || (recipeTitle ? `title_${recipeTitle}` : undefined);
          const alreadyExists = state.customShoppingItems.some(
            (item) =>
              !item.checked &&
              ((targetId && item.recipeId === targetId) ||
                (!item.recipeId && recipeTitle && item.recipeSource === recipeTitle))
          );
          if (alreadyExists) {
            result = { addedCount: 0, alreadyInList: true };
            return state;
          }

          const newItems: CustomShoppingItem[] = ingredients.map((ing, idx) => {
            const amountPart = ing.amount ? `${ing.amount} ` : '';
            const unitPart = ing.unit ? `${ing.unit} ` : '';
            const fullName = `${amountPart}${unitPart}${ing.name}`.trim();
            return {
              id: `c-${Date.now()}-${idx}-${Math.random().toString(36).substring(2, 6)}`,
              name: fullName,
              category: ing.category || 'pantry',
              recipeId: targetId,
              recipeSource: recipeTitle,
              checked: false
            };
          });
          result = { addedCount: newItems.length, alreadyInList: false };
          return { customShoppingItems: [...state.customShoppingItems, ...newItems] };
        });
        return result;
      },

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

      addCustomTag: (tag) =>
        set((state) => {
          const clean = (tag || '').trim();
          if (!clean || (state.customTags && state.customTags.includes(clean))) return state;
          return { customTags: [...(state.customTags || []), clean] };
        }),

      deleteCustomTag: (tag) =>
        set((state) => {
          const target = (tag || '').trim();
          if (!target) return state;
          const updatedCustom = (state.customTags || []).filter((t) => t !== target);
          const updatedSaved = (state.savedRecipes || []).map((r) => ({
            ...r,
            tags: (r.tags || []).filter((t) => t !== target)
          }));
          const updatedCurrent = state.currentRecipe
            ? {
                ...state.currentRecipe,
                tags: (state.currentRecipe.tags || []).filter((t) => t !== target)
              }
            : state.currentRecipe;

          return {
            customTags: updatedCustom,
            savedRecipes: updatedSaved,
            currentRecipe: updatedCurrent
          };
        }),

      updateRecipeTags: (recipeId, tags) =>
        set((state) => {
          const cleanTags = (tags || []).map((t) => t.trim()).filter(Boolean);
          const newCustom = [...(state.customTags || [])];
          for (const t of cleanTags) {
            if (!newCustom.includes(t)) {
              newCustom.push(t);
            }
          }
          const updatedSaved = state.savedRecipes.map((r) =>
            r.id === recipeId || r.title === recipeId ? { ...r, tags: cleanTags } : r
          );
          const updatedCurrent =
            state.currentRecipe && (state.currentRecipe.id === recipeId || state.currentRecipe.title === recipeId)
              ? { ...state.currentRecipe, tags: cleanTags }
              : state.currentRecipe;

          return {
            savedRecipes: updatedSaved,
            currentRecipe: updatedCurrent,
            customTags: newCustom
          };
        }),

      setActiveTab: (tab) => set({ activeTab: tab }),

      openKitchenMode: (recipe) =>
        set((state) => ({
          isKitchenModeOpen: true,
          kitchenStepIndex: 0,
          currentRecipe: recipe || state.currentRecipe || null
        })),

      closeKitchenMode: () => set({ isKitchenModeOpen: false }),

      setKitchenStepIndex: (index) => set({ kitchenStepIndex: index }),

      toggleDarkMode: () => set((state) => ({ isDarkMode: !state.isDarkMode })),
      clearAllRecipes: () => set({ savedRecipes: [], currentRecipe: null }),
      resetAllData: () => set({ savedRecipes: [], currentRecipe: null, customShoppingItems: [], checkedIngredients: {}, checkedShoppingItems: {} })
    }),
    {
      name: 'myrecipes-storage-v2',
      storage: createJSONStorage(() => AsyncStorage),
      partialize: (state) => ({
        savedRecipes: state.savedRecipes,
        customTags: state.customTags,
        customShoppingItems: state.customShoppingItems,
        checkedIngredients: state.checkedIngredients,
        checkedShoppingItems: state.checkedShoppingItems,
        dismissedShoppingItems: state.dismissedShoppingItems,
        isDarkMode: state.isDarkMode
      })
    }
  )
);

