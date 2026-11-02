import React, { useState } from 'react';
import {
  View,
  Text,
  ScrollView,
  TouchableOpacity,
  Image,
  StyleSheet,
  Alert
} from 'react-native';
import { useRecipeStore } from '../store/recipeStore';

export const RecipeDetailScreen: React.FC = () => {
  const recipe = useRecipeStore((s) => s.currentRecipe);
  const checkedIngredients = useRecipeStore((s) => s.checkedIngredients);
  const toggleIngredient = useRecipeStore((s) => s.toggleIngredient);
  const setActiveTab = useRecipeStore((s) => s.setActiveTab);
  const openKitchenMode = useRecipeStore((s) => s.openKitchenMode);
  const toggleBookmark = useRecipeStore((s) => s.toggleBookmark);
  const isDarkMode = useRecipeStore((s) => s.isDarkMode);
  const addIngredientsToShoppingList = useRecipeStore((s) => s.addIngredientsToShoppingList);

  const [activeSubTab, setActiveSubTab] = useState<'ingredients' | 'instructions'>('ingredients');
  const [servingMultiplier, setServingMultiplier] = useState(1);

  if (!recipe) {
    return (
      <View style={[styles.emptyContainer, isDarkMode && styles.darkContainer]}>
        <Text style={styles.emptyIcon}>🍳</Text>
        <Text style={[styles.emptyTitle, isDarkMode && styles.darkText]}>לא נבחר מתכון עדיין</Text>
        <Text style={styles.emptySubtitle}>
          בחר מתכון מהמסך הראשי או חלץ מתכון חדש מסרטון בבינה מלאכותית!
        </Text>
        <TouchableOpacity style={styles.ctaButton} onPress={() => setActiveTab('extract')}>
          <Text style={styles.ctaButtonText}>+ חלץ מתכון חדש עם AI</Text>
        </TouchableOpacity>
      </View>
    );
  }

  const baseServings = recipe.servings || 4;
  const currentServings = Math.round(baseServings * servingMultiplier);

  const categoryHebrew: Record<string, string> = {
    produce: 'ירקות ופירות',
    dairy: 'מוצרי חלב',
    meat: 'בשר ודגים',
    pantry: 'מזווה ויבשים',
    spices: 'תבלינים',
    bakery: 'מאפייה',
    other: 'שונות'
  };

  const handleAddToShoppingList = () => {
    if (recipe && recipe.ingredients) {
      addIngredientsToShoppingList(recipe.ingredients, recipe.title);
    }
    Alert.alert('נוסף בהצלחה! 🛒', 'הרכיבים התווספו לרשימת הקניות המרוכזת שלך', [
      { text: 'עבור לרשימה', onPress: () => setActiveTab('shopping') },
      { text: 'אישור' }
    ]);
  };

  const themeContainer = isDarkMode ? styles.darkContainer : styles.lightContainer;
  const themeText = isDarkMode ? styles.darkText : styles.lightText;
  const themeCard = isDarkMode ? styles.darkCard : styles.lightCard;

  return (
    <ScrollView style={[styles.container, themeContainer]} showsVerticalScrollIndicator={false}>
      {/* Hero Header Image Banner */}
      <View style={styles.heroContainer}>
        <Image
          source={{
            uri:
              recipe.imageUrl ||
              'https://images.unsplash.com/photo-1546069901-ba9599a7e63c?w=800&auto=format&fit=crop'
          }}
          style={styles.heroImage}
        />
        <View style={styles.heroOverlay}>
          <TouchableOpacity style={styles.bookmarkBadge} onPress={() => toggleBookmark(recipe.id)}>
            <Text style={styles.bookmarkText}>{recipe.isBookmarked ? '🔖 שמור' : '🏷️ שמירה'}</Text>
          </TouchableOpacity>
          <View style={styles.platformBadge}>
            <Text style={styles.platformText}>{recipe.platform.toUpperCase()}</Text>
          </View>
        </View>
      </View>

      <View style={styles.contentPadding}>
        {/* Title & Description */}
        <Text style={[styles.title, themeText]}>{recipe.title}</Text>
        <Text style={styles.description}>{recipe.description}</Text>

        {/* Kitchen Mode Main Action Button */}
        <TouchableOpacity
          style={styles.kitchenModeBtn}
          activeOpacity={0.85}
          onPress={() => openKitchenMode(recipe)}
        >
          <Text style={styles.kitchenModeBtnText}>🍳 התחל לבשל (מצב מטבח)</Text>
          <Text style={styles.kitchenModeBtnSub}>תצוגת מסך מלא עם גופן ענק וצעדים מוגדלים</Text>
        </TouchableOpacity>

        {/* Meta Bar */}
        <View style={[styles.metaRow, themeCard]}>
          <View style={styles.metaItem}>
            <Text style={styles.metaLabel}>הכנה</Text>
            <Text style={styles.metaValue}>{recipe.prepTimeMinutes || 10} דק׳</Text>
          </View>
          <View style={styles.metaDivider} />
          <View style={styles.metaItem}>
            <Text style={styles.metaLabel}>בישול</Text>
            <Text style={styles.metaValue}>{recipe.cookTimeMinutes || 15} דק׳</Text>
          </View>
          <View style={styles.metaDivider} />
          <View style={styles.metaItem}>
            <Text style={styles.metaLabel}>סה״כ זמן</Text>
            <Text style={styles.metaValue}>{recipe.totalTimeMinutes || 25} דק׳</Text>
          </View>
        </View>

        {/* Servings Scaler */}
        <View style={[styles.servingsCard, themeCard]}>
          <Text style={[styles.servingsText, themeText]}>👥 מנות: {currentServings}</Text>
          <View style={styles.scalerButtons}>
            <TouchableOpacity
              style={styles.scalerBtn}
              onPress={() => setServingMultiplier(Math.max(0.5, servingMultiplier - 0.5))}
            >
              <Text style={styles.scalerBtnText}>-</Text>
            </TouchableOpacity>
            <Text style={styles.multiplierText}>{servingMultiplier}x</Text>
            <TouchableOpacity
              style={styles.scalerBtn}
              onPress={() => setServingMultiplier(servingMultiplier + 0.5)}
            >
              <Text style={styles.scalerBtnText}>+</Text>
            </TouchableOpacity>
          </View>
        </View>

        {/* Inner Navigation Sub-Tabs */}
        <View style={styles.tabContainer}>
          <TouchableOpacity
            style={[styles.tabButton, activeSubTab === 'ingredients' && styles.tabButtonActive]}
            onPress={() => setActiveSubTab('ingredients')}
          >
            <Text style={[styles.tabText, activeSubTab === 'ingredients' && styles.tabTextActive]}>
              🥗 מצרכים ({recipe.ingredients.length})
            </Text>
          </TouchableOpacity>

          <TouchableOpacity
            style={[styles.tabButton, activeSubTab === 'instructions' && styles.tabButtonActive]}
            onPress={() => setActiveSubTab('instructions')}
          >
            <Text style={[styles.tabText, activeSubTab === 'instructions' && styles.tabTextActive]}>
              👨‍🍳 הוראות ({recipe.instructions.length})
            </Text>
          </TouchableOpacity>
        </View>

        {/* Ingredients Tab View */}
        {activeSubTab === 'ingredients' && (
          <View style={styles.section}>
            {recipe.ingredients.map((ing) => {
              const isChecked = !!checkedIngredients[ing.id];
              const scaledAmount =
                ing.amount !== null
                  ? (ing.amount * servingMultiplier).toFixed(ing.amount % 1 === 0 ? 0 : 1)
                  : null;
              const catLabel = categoryHebrew[ing.category] || ing.category;

              return (
                <TouchableOpacity
                  key={ing.id}
                  style={[styles.ingredientItem, themeCard, isChecked && styles.ingredientChecked]}
                  onPress={() => toggleIngredient(ing.id)}
                >
                  <View style={[styles.checkbox, isChecked && styles.checkboxActive]}>
                    {isChecked && <Text style={styles.checkmark}>✓</Text>}
                  </View>
                  <View style={styles.ingredientTextContainer}>
                    <Text style={[styles.ingredientName, themeText, isChecked && styles.textStrikethrough]}>
                      {scaledAmount && ing.unit ? `${scaledAmount} ${ing.unit} ` : ''}
                      {ing.name}
                    </Text>
                    <Text style={styles.ingredientCategory}>[{catLabel}]</Text>
                  </View>
                </TouchableOpacity>
              );
            })}

            <TouchableOpacity style={styles.addShoppingBtn} onPress={handleAddToShoppingList}>
              <Text style={styles.addShoppingBtnText}>🛒 הוסף מצרכים לרשימת הקניות</Text>
            </TouchableOpacity>
          </View>
        )}

        {/* Instructions Tab View */}
        {activeSubTab === 'instructions' && (
          <View style={styles.section}>
            {recipe.instructions.map((step) => (
              <View key={step.stepNumber} style={[styles.stepCard, themeCard]}>
                <View style={styles.stepHeader}>
                  <View style={styles.stepNumberBadge}>
                    <Text style={styles.stepNumberText}>{step.stepNumber}</Text>
                  </View>
                  {step.durationMinutes && (
                    <View style={styles.timerBadge}>
                      <Text style={styles.timerBadgeText}>⏱ {step.durationMinutes} דקות</Text>
                    </View>
                  )}
                </View>
                <Text style={[styles.stepInstruction, themeText]}>{step.instruction}</Text>
                {step.tip && (
                  <View style={styles.tipBox}>
                    <Text style={styles.tipText}>💡 טיפ שף: {step.tip}</Text>
                  </View>
                )}
              </View>
            ))}
          </View>
        )}
      </View>
    </ScrollView>
  );
};

const styles = StyleSheet.create({
  container: {
    flex: 1
  },
  lightContainer: {
    backgroundColor: '#f4f9f5'
  },
  darkContainer: {
    backgroundColor: '#0f172a'
  },
  lightText: {
    color: '#0f172a'
  },
  darkText: {
    color: '#f8fafc'
  },
  contentPadding: {
    padding: 18,
    paddingBottom: 40
  },
  emptyContainer: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    padding: 30
  },
  emptyIcon: {
    fontSize: 54,
    marginBottom: 16
  },
  emptyTitle: {
    fontSize: 22,
    fontWeight: '800',
    marginBottom: 8
  },
  emptySubtitle: {
    fontSize: 14,
    color: '#64748b',
    textAlign: 'center',
    marginBottom: 24,
    lineHeight: 22
  },
  ctaButton: {
    backgroundColor: '#34d399',
    paddingHorizontal: 22,
    paddingVertical: 12,
    borderRadius: 14
  },
  ctaButtonText: {
    color: '#064e3b',
    fontWeight: '800',
    fontSize: 15
  },
  heroContainer: {
    height: 220,
    width: '100%',
    position: 'relative'
  },
  heroImage: {
    width: '100%',
    height: '100%'
  },
  heroOverlay: {
    position: 'absolute',
    top: 0,
    left: 0,
    right: 0,
    bottom: 0,
    backgroundColor: 'rgba(0,0,0,0.25)',
    padding: 16,
    flexDirection: 'row-reverse',
    justifyContent: 'space-between',
    alignItems: 'flex-start'
  },
  bookmarkBadge: {
    backgroundColor: '#ffffff',
    paddingHorizontal: 12,
    paddingVertical: 6,
    borderRadius: 20
  },
  bookmarkText: {
    color: '#0f172a',
    fontSize: 12,
    fontWeight: '800'
  },
  platformBadge: {
    backgroundColor: 'rgba(0,0,0,0.6)',
    paddingHorizontal: 10,
    paddingVertical: 4,
    borderRadius: 12
  },
  platformText: {
    color: '#ffffff',
    fontSize: 11,
    fontWeight: '800'
  },
  title: {
    fontSize: 24,
    fontWeight: '800',
    textAlign: 'right',
    marginTop: 6,
    marginBottom: 6
  },
  description: {
    fontSize: 14,
    color: '#64748b',
    textAlign: 'right',
    lineHeight: 20,
    marginBottom: 16
  },
  kitchenModeBtn: {
    backgroundColor: '#059669',
    paddingVertical: 14,
    paddingHorizontal: 16,
    borderRadius: 16,
    alignItems: 'center',
    marginBottom: 16,
    shadowColor: '#059669',
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.25,
    shadowRadius: 8,
    elevation: 4
  },
  kitchenModeBtnText: {
    color: '#ffffff',
    fontSize: 17,
    fontWeight: '800'
  },
  kitchenModeBtnSub: {
    color: '#a7f3d0',
    fontSize: 12,
    marginTop: 2
  },
  metaRow: {
    flexDirection: 'row-reverse',
    borderRadius: 16,
    padding: 14,
    marginBottom: 14,
    alignItems: 'center',
    justifyContent: 'space-around'
  },
  lightCard: {
    backgroundColor: '#ffffff',
    borderWidth: 1,
    borderColor: '#e2e8f0'
  },
  darkCard: {
    backgroundColor: '#1e293b',
    borderWidth: 1,
    borderColor: '#334155'
  },
  metaItem: {
    alignItems: 'center'
  },
  metaLabel: {
    fontSize: 11,
    color: '#64748b',
    fontWeight: '600',
    marginBottom: 2
  },
  metaValue: {
    fontSize: 15,
    fontWeight: '800',
    color: '#059669'
  },
  metaDivider: {
    width: 1,
    height: 24,
    backgroundColor: '#e2e8f0'
  },
  servingsCard: {
    flexDirection: 'row-reverse',
    justifyContent: 'space-between',
    alignItems: 'center',
    borderRadius: 16,
    padding: 12,
    paddingHorizontal: 16,
    marginBottom: 20
  },
  servingsText: {
    fontSize: 14,
    fontWeight: '700'
  },
  scalerButtons: {
    flexDirection: 'row',
    alignItems: 'center'
  },
  scalerBtn: {
    width: 32,
    height: 32,
    borderRadius: 8,
    backgroundColor: '#a8e6cf',
    justifyContent: 'center',
    alignItems: 'center'
  },
  scalerBtnText: {
    color: '#064e3b',
    fontSize: 18,
    fontWeight: '800'
  },
  multiplierText: {
    color: '#059669',
    marginHorizontal: 10,
    fontWeight: '800',
    fontSize: 14
  },
  tabContainer: {
    flexDirection: 'row-reverse',
    marginBottom: 16,
    backgroundColor: '#e2e8f0',
    borderRadius: 14,
    padding: 3
  },
  tabButton: {
    flex: 1,
    paddingVertical: 10,
    alignItems: 'center',
    borderRadius: 12
  },
  tabButtonActive: {
    backgroundColor: '#ffffff'
  },
  tabText: {
    fontSize: 14,
    fontWeight: '700',
    color: '#64748b'
  },
  tabTextActive: {
    color: '#059669'
  },
  section: {
    marginBottom: 20
  },
  ingredientItem: {
    flexDirection: 'row-reverse',
    alignItems: 'center',
    padding: 12,
    borderRadius: 14,
    marginBottom: 8
  },
  ingredientChecked: {
    opacity: 0.5
  },
  checkbox: {
    width: 22,
    height: 22,
    borderRadius: 6,
    borderWidth: 2,
    borderColor: '#94a3b8',
    marginLeft: 12,
    justifyContent: 'center',
    alignItems: 'center'
  },
  checkboxActive: {
    backgroundColor: '#34d399',
    borderColor: '#059669'
  },
  checkmark: {
    color: '#064e3b',
    fontSize: 13,
    fontWeight: '900'
  },
  ingredientTextContainer: {
    flex: 1,
    flexDirection: 'row-reverse',
    justifyContent: 'space-between',
    alignItems: 'center'
  },
  ingredientName: {
    fontSize: 14,
    fontWeight: '600',
    textAlign: 'right'
  },
  ingredientCategory: {
    color: '#94a3b8',
    fontSize: 11
  },
  textStrikethrough: {
    textDecorationLine: 'line-through',
    color: '#94a3b8'
  },
  addShoppingBtn: {
    backgroundColor: '#a8e6cf',
    paddingVertical: 14,
    borderRadius: 14,
    alignItems: 'center',
    marginTop: 12
  },
  addShoppingBtnText: {
    color: '#064e3b',
    fontSize: 15,
    fontWeight: '800'
  },
  stepCard: {
    borderRadius: 16,
    padding: 16,
    marginBottom: 12
  },
  stepHeader: {
    flexDirection: 'row-reverse',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 8
  },
  stepNumberBadge: {
    width: 28,
    height: 28,
    borderRadius: 14,
    backgroundColor: '#34d399',
    justifyContent: 'center',
    alignItems: 'center'
  },
  stepNumberText: {
    color: '#064e3b',
    fontWeight: '800',
    fontSize: 13
  },
  timerBadge: {
    backgroundColor: '#fef3c7',
    paddingHorizontal: 10,
    paddingVertical: 3,
    borderRadius: 8
  },
  timerBadgeText: {
    color: '#d97706',
    fontSize: 11,
    fontWeight: '700'
  },
  stepInstruction: {
    fontSize: 14,
    lineHeight: 22,
    textAlign: 'right'
  },
  tipBox: {
    marginTop: 10,
    backgroundColor: '#fffbeb',
    borderRadius: 8,
    padding: 8,
    borderRightWidth: 3,
    borderRightColor: '#f59e0b'
  },
  tipText: {
    color: '#b45309',
    fontSize: 12,
    textAlign: 'right'
  }
});

