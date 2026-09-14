import React from 'react';
import {
  View,
  Text,
  ScrollView,
  TouchableOpacity,
  StyleSheet
} from 'react-native';
import { useRecipeStore } from '../store/recipeStore';

export const ShoppingListScreen: React.FC = () => {
  const recipe = useRecipeStore((s) => s.currentRecipe);
  const checkedItems = useRecipeStore((s) => s.checkedShoppingItems);
  const toggleShoppingItem = useRecipeStore((s) => s.toggleShoppingItem);
  const clearCheckedShopping = useRecipeStore((s) => s.clearCheckedShopping);
  const setActiveTab = useRecipeStore((s) => s.setActiveTab);

  if (!recipe || !recipe.shoppingList || recipe.shoppingList.length === 0) {
    return (
      <View style={styles.emptyContainer}>
        <Text style={styles.emptyIcon}>🛒</Text>
        <Text style={styles.emptyTitle}>רשימת הקניות ריקה</Text>
        <Text style={styles.emptySubtitle}>
          בחר או חלץ מתכון כדי לצפות ברשימת המצרכים הממוינת לקניות בסופר.
        </Text>
        <TouchableOpacity
          style={styles.ctaButton}
          onPress={() => setActiveTab('extract')}
        >
          <Text style={styles.ctaButtonText}>חלץ מתכון עכשיו</Text>
        </TouchableOpacity>
      </View>
    );
  }

  const categoryHebrewEmoji: Record<string, { label: string; emoji: string }> = {
    produce: { label: 'ירקות ופירות', emoji: '🥬' },
    dairy: { label: 'מוצרי חלב וביצים', emoji: '🧀' },
    meat: { label: 'בשר, עוף ודגים', emoji: '🥩' },
    pantry: { label: 'מזווה ויבשים', emoji: '🥫' },
    spices: { label: 'תבלינים ורטבים', emoji: '🧂' },
    bakery: { label: 'מאפייה ולחמים', emoji: '🥖' },
    other: { label: 'שונות', emoji: '📦' }
  };

  return (
    <ScrollView style={styles.container} contentContainerStyle={styles.content}>
      <View style={styles.header}>
        <Text style={styles.recipeTitle}>{recipe.title}</Text>
        <Text style={styles.title}>רשימת קניות מרוכזת</Text>
        <Text style={styles.subtitle}>
          ממוינת אוטומטית לפי מחלקות בסופר על ידי ה-AI
        </Text>
      </View>

      <TouchableOpacity
        style={styles.clearButton}
        onPress={clearCheckedShopping}
      >
        <Text style={styles.clearButtonText}>נקה פריטים שנקנו</Text>
      </TouchableOpacity>

      {recipe.shoppingList.map((group, gIdx) => {
        const catConfig =
          categoryHebrewEmoji[group.category.toLowerCase()] || {
            label: group.category,
            emoji: '📦'
          };

        return (
          <View key={gIdx} style={styles.categoryCard}>
            <View style={styles.categoryHeader}>
              <Text style={styles.categoryTitle}>
                {catConfig.emoji} {catConfig.label}
              </Text>
              <Text style={styles.itemCount}>{group.items.length} מצרכים</Text>
            </View>

            {group.items.map((item, iIdx) => {
              const itemKey = `${recipe.id}_${group.category}_${item}`;
              const isChecked = !!checkedItems[itemKey];

              return (
                <TouchableOpacity
                  key={iIdx}
                  style={[styles.itemRow, isChecked && styles.itemRowChecked]}
                  onPress={() => toggleShoppingItem(itemKey)}
                >
                  <View style={[styles.checkbox, isChecked && styles.checkboxActive]}>
                    {isChecked && <Text style={styles.checkmark}>✓</Text>}
                  </View>
                  <Text style={[styles.itemText, isChecked && styles.textStrikethrough]}>
                    {item}
                  </Text>
                </TouchableOpacity>
              );
            })}
          </View>
        );
      })}
    </ScrollView>
  );
};

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#0f172a'
  },
  content: {
    padding: 20,
    paddingBottom: 40
  },
  emptyContainer: {
    flex: 1,
    backgroundColor: '#0f172a',
    justifyContent: 'center',
    alignItems: 'center',
    padding: 30
  },
  emptyIcon: {
    fontSize: 48,
    marginBottom: 16
  },
  emptyTitle: {
    fontSize: 22,
    fontWeight: '700',
    color: '#f8fafc',
    marginBottom: 8
  },
  emptySubtitle: {
    fontSize: 14,
    color: '#94a3b8',
    textAlign: 'center',
    marginBottom: 24,
    lineHeight: 22
  },
  ctaButton: {
    backgroundColor: '#3b82f6',
    paddingHorizontal: 22,
    paddingVertical: 12,
    borderRadius: 10
  },
  ctaButtonText: {
    color: '#ffffff',
    fontWeight: '700',
    fontSize: 15
  },
  header: {
    marginBottom: 16,
    alignItems: 'flex-end'
  },
  recipeTitle: {
    color: '#38bdf8',
    fontSize: 13,
    fontWeight: '700',
    marginBottom: 4,
    textAlign: 'right'
  },
  title: {
    fontSize: 26,
    fontWeight: '800',
    color: '#f8fafc',
    textAlign: 'right',
    marginBottom: 4
  },
  subtitle: {
    fontSize: 14,
    color: '#94a3b8',
    textAlign: 'right'
  },
  clearButton: {
    alignSelf: 'flex-end',
    backgroundColor: '#334155',
    paddingHorizontal: 16,
    paddingVertical: 8,
    borderRadius: 8,
    marginBottom: 18
  },
  clearButtonText: {
    color: '#cbd5e1',
    fontSize: 13,
    fontWeight: '600'
  },
  categoryCard: {
    backgroundColor: '#1e293b',
    borderRadius: 14,
    padding: 16,
    marginBottom: 14,
    borderWidth: 1,
    borderColor: '#334155'
  },
  categoryHeader: {
    flexDirection: 'row-reverse',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingBottom: 10,
    borderBottomWidth: 1,
    borderBottomColor: '#334155',
    marginBottom: 10
  },
  categoryTitle: {
    color: '#f8fafc',
    fontSize: 16,
    fontWeight: '700'
  },
  itemCount: {
    color: '#64748b',
    fontSize: 12
  },
  itemRow: {
    flexDirection: 'row-reverse',
    alignItems: 'center',
    paddingVertical: 10
  },
  itemRowChecked: {
    opacity: 0.5
  },
  checkbox: {
    width: 22,
    height: 22,
    borderRadius: 6,
    borderWidth: 2,
    borderColor: '#64748b',
    marginLeft: 12,
    justifyContent: 'center',
    alignItems: 'center'
  },
  checkboxActive: {
    backgroundColor: '#10b981',
    borderColor: '#10b981'
  },
  checkmark: {
    color: '#ffffff',
    fontSize: 12,
    fontWeight: '800'
  },
  itemText: {
    color: '#f1f5f9',
    fontSize: 15,
    textAlign: 'right',
    flex: 1
  },
  textStrikethrough: {
    textDecorationLine: 'line-through',
    color: '#94a3b8'
  }
});
