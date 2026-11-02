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

const SAMPLE_RECIPES: StructuredRecipe[] = [
  {
    id: 'rec-1',
    title: 'נודלס טופו חריף',
    description: 'נודלס אסייתי מוקפץ עם טופו קריספי, ירקות טריים ברוטב סויה, שומשום וצ׳ילי חריף.',
    sourceUrl: 'https://instagram.com/reel/sample1',
    platform: 'instagram',
    imageUrl: 'https://images.unsplash.com/photo-1569718212165-3a8278d5f624?w=600&auto=format&fit=crop',
    isBookmarked: true,
    category: 'אסייתי',
    servings: 2,
    prepTimeMinutes: 10,
    cookTimeMinutes: 15,
    totalTimeMinutes: 25,
    ingredients: [
      { id: 'i1', name: 'טופו קשה', amount: 300, unit: 'גרם', category: 'produce', originalText: '300 גרם טופו קשה חתוך לקוביות' },
      { id: 'i2', name: 'נודלס אורז / אטריות שואו', amount: 200, unit: 'גרם', category: 'pantry', originalText: '200 גרם נודלס' },
      { id: 'i3', name: 'סויה חה / סויה מתוקה', amount: 3, unit: 'כפות', category: 'spices', originalText: '3 כפות רוטב סויה' },
      { id: 'i4', name: 'צ׳ילי חריף קצוץ', amount: 1, unit: 'יחידה', category: 'produce', originalText: '1 צ׳ילי חריף קצוץ' },
      { id: 'i5', name: 'שמן שומשום', amount: 1, unit: 'כף', category: 'spices', originalText: '1 כף שמן שומשום' },
      { id: 'i6', name: 'בצל ירוק', amount: 2, unit: 'גבעולים', category: 'produce', originalText: '2 גבעולי בצל ירוק' }
    ],
    instructions: [
      { stepNumber: 1, instruction: 'חותכים את הטופו לקוביות ומייבשים היטב בנייר סופג.' },
      { stepNumber: 2, instruction: 'מבשלים את הנודלס לפי הוראות היצרן במים רותחים ומסננים.' },
      { stepNumber: 3, instruction: 'מחממים מחבת עם שמן שומשום ומטגנים את הטופו עד שמזהיב ונעשה קריספי.' },
      { stepNumber: 4, instruction: 'מוסיפים את הצ׳ילי, הנודלס ורוטב הסויה, מוקפצים כ-3 דקות יחד.' },
      { stepNumber: 5, instruction: 'מקשטים בבצל ירוק ושומשום קלוי ומגישים חם.' }
    ],
    shoppingList: [
      { category: 'produce', items: ['300 גרם טופו קשה', '1 צ׳ילי חריף', '2 גבעולי בצל ירוק'] },
      { category: 'pantry', items: ['200 גרם נודלס'] },
      { category: 'spices', items: ['רוטב סויה', 'שמן שומשום'] }
    ],
    tags: ['אסייתי', 'חריף', 'טבעוני', 'מהיר'],
    createdAt: new Date().toISOString()
  },
  {
    id: 'rec-2',
    title: 'פסטה בולונז ב-15 דקות',
    description: 'פסטה איטלקית קלאסית ברוטב עגבניות עשיר, בשר טחון ותבלינים ארומטיים.',
    sourceUrl: 'https://tiktok.com/@chef/video/sample2',
    platform: 'tiktok',
    imageUrl: 'https://images.unsplash.com/photo-1621996346565-e3d5d6281318?w=600&auto=format&fit=crop',
    isBookmarked: true,
    category: 'איטלקי',
    servings: 4,
    prepTimeMinutes: 5,
    cookTimeMinutes: 20,
    totalTimeMinutes: 25,
    ingredients: [
      { id: 'i21', name: 'פסטה ספגטי', amount: 500, unit: 'גרם', category: 'pantry', originalText: '500 גרם פסטה ספגטי' },
      { id: 'i22', name: 'בשר בקר טחון', amount: 400, unit: 'גרם', category: 'meat', originalText: '400 גרם בשר בקר טחון' },
      { id: 'i23', name: 'עגבניות מרוסקות', amount: 1, unit: 'פחית', category: 'pantry', originalText: '1 פחית עגבניות מרוסקות' },
      { id: 'i24', name: 'בצל צהוב', amount: 1, unit: 'יחידה', category: 'produce', originalText: '1 בצל קצוץ' },
      { id: 'i25', name: 'שיני שום', amount: 3, unit: 'שיניים', category: 'produce', originalText: '3 שיני שום כתושות' }
    ],
    instructions: [
      { stepNumber: 1, instruction: 'מטגנים את הבצל והשום במעט שמן זית עד להזהבה.' },
      { stepNumber: 2, instruction: 'מוסיפים את הבשר הטחון ומפוררים אותו בעזרת כף עץ עד שמשנה את צבעו.' },
      { stepNumber: 3, instruction: 'יוצקים את העגבניות המרוסקות, מתבלים במלח, פלפל ואורגנו ומבשלים 15 דקות.' },
      { stepNumber: 4, instruction: 'מבשלים את הספגטי אל-דנטה ומערבבים ישירות לתוך הרוטב.' }
    ],
    shoppingList: [
      { category: 'meat', items: ['400 גרם בשר בקר טחון'] },
      { category: 'pantry', items: ['500 גרם פסטה ספגטי', '1 פחית עגבניות מרוסקות'] },
      { category: 'produce', items: ['1 בצל צהוב', '3 שיני שום'] }
    ],
    tags: ['איטלקי', 'בשר', 'ערב'],
    createdAt: new Date().toISOString()
  },
  {
    id: 'rec-3',
    title: 'פיצה מרגריטה ביתית',
    description: 'פיצה איטלקית קריספית עם רוטב עגבניות טריות, גבינת מוצרלה ועלי בזיליקום.',
    sourceUrl: 'https://youtube.com/shorts/sample3',
    platform: 'youtube',
    imageUrl: 'https://images.unsplash.com/photo-1513104890138-7c749659a591?w=600&auto=format&fit=crop',
    isBookmarked: false,
    category: 'איטלקי',
    servings: 3,
    prepTimeMinutes: 15,
    cookTimeMinutes: 12,
    totalTimeMinutes: 27,
    ingredients: [
      { id: 'i31', name: 'בצק פיצה מוכן', amount: 1, unit: 'יחידה', category: 'bakery', originalText: '1 בצק פיצה מוכן' },
      { id: 'i32', name: 'גבינת מוצרלה מגוררת', amount: 200, unit: 'גרם', category: 'dairy', originalText: '200 גרם גבינת מוצרלה' },
      { id: 'i33', name: 'רוטב פיצה עגבניות', amount: 4, unit: 'כפות', category: 'pantry', originalText: '4 כפות רוטב עגבניות' },
      { id: 'i34', name: 'עלי בזיליקום טריים', amount: 1, unit: 'חופן', category: 'produce', originalText: 'חופן עלי בזיליקום' }
    ],
    instructions: [
      { stepNumber: 1, instruction: 'מחממים תנור ל-220 מעלות (חום עליון ותחתון).' },
      { stepNumber: 2, instruction: 'פורסים את הבצק על תבנית עם נייר אפייה ומורחים רוטב עגבניות.' },
      { stepNumber: 3, instruction: 'מפזרים את גבינת המוצרלה באופן שווה ומכניסים לתנור ל-10-12 דקות.' },
      { stepNumber: 4, instruction: 'מוציאים מהתנור ומקשטים בעלי בזיליקום טריים.' }
    ],
    shoppingList: [
      { category: 'dairy', items: ['200 גרם גבינת מוצרלה'] },
      { category: 'bakery', items: ['בצק פיצה מוכן'] },
      { category: 'produce', items: ['עלי בזיליקום טריים'] }
    ],
    tags: ['איטלקי', 'פיצה', 'חלבי'],
    createdAt: new Date().toISOString()
  }
];

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
      currentRecipe: SAMPLE_RECIPES[0],
      savedRecipes: SAMPLE_RECIPES,
      checkedIngredients: {},
      checkedShoppingItems: {},
      customShoppingItems: [
        { id: 'c1', name: 'חלב תנובה 3%', category: 'dairy', checked: false },
        { id: 'c2', name: 'ביצים L (12 יחידות)', category: 'dairy', checked: false }
      ],
      activeTab: 'home',
      isKitchenModeOpen: false,
      kitchenStepIndex: 0,
      isDarkMode: false,

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
          currentRecipe: recipe || state.currentRecipe || SAMPLE_RECIPES[0]
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

