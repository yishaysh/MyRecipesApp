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
        <Text style={styles.emptyTitle}>Shopping List is Empty</Text>
        <Text style={styles.emptySubtitle}>
          Select or extract a recipe to view its categorized grocery shopping list.
        </Text>
        <TouchableOpacity
          style={styles.ctaButton}
          onPress={() => setActiveTab('extract')}
        >
          <Text style={styles.ctaButtonText}>Extract Recipe</Text>
        </TouchableOpacity>
      </View>
    );
  }

  const categoryEmoji: Record<string, string> = {
    produce: '🥬',
    dairy: '🧀',
    meat: '🥩',
    pantry: '🥫',
    spices: '🧂',
    bakery: '🥖',
    other: '📦'
  };

  return (
    <ScrollView style={styles.container} contentContainerStyle={styles.content}>
      <View style={styles.header}>
        <Text style={styles.recipeTitle}>{recipe.title}</Text>
        <Text style={styles.title}>Grocery Shopping List</Text>
        <Text style={styles.subtitle}>
          Categorized automatically from your recipe ingredients
        </Text>
      </View>

      <TouchableOpacity
        style={styles.clearButton}
        onPress={clearCheckedShopping}
      >
        <Text style={styles.clearButtonText}>Clear Checked Items</Text>
      </TouchableOpacity>

      {recipe.shoppingList.map((group, gIdx) => {
        const emoji = categoryEmoji[group.category.toLowerCase()] || '📦';
        return (
          <View key={gIdx} style={styles.categoryCard}>
            <View style={styles.categoryHeader}>
              <Text style={styles.categoryTitle}>
                {emoji} {group.category.toUpperCase()}
              </Text>
              <Text style={styles.itemCount}>{group.items.length} items</Text>
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
    lineHeight: 20
  },
  ctaButton: {
    backgroundColor: '#3b82f6',
    paddingHorizontal: 20,
    paddingVertical: 12,
    borderRadius: 10
  },
  ctaButtonText: {
    color: '#ffffff',
    fontWeight: '700',
    fontSize: 15
  },
  header: {
    marginBottom: 16
  },
  recipeTitle: {
    color: '#38bdf8',
    fontSize: 13,
    fontWeight: '700',
    textTransform: 'uppercase',
    marginBottom: 4
  },
  title: {
    fontSize: 26,
    fontWeight: '800',
    color: '#f8fafc',
    marginBottom: 4
  },
  subtitle: {
    fontSize: 14,
    color: '#94a3b8'
  },
  clearButton: {
    alignSelf: 'flex-start',
    backgroundColor: '#334155',
    paddingHorizontal: 14,
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
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingBottom: 10,
    borderBottomWidth: 1,
    borderBottomColor: '#334155',
    marginBottom: 10
  },
  categoryTitle: {
    color: '#f8fafc',
    fontSize: 15,
    fontWeight: '700'
  },
  itemCount: {
    color: '#64748b',
    fontSize: 12
  },
  itemRow: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingVertical: 10
  },
  itemRowChecked: {
    opacity: 0.5
  },
  checkbox: {
    width: 20,
    height: 20,
    borderRadius: 6,
    borderWidth: 2,
    borderColor: '#64748b',
    marginRight: 12,
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
    fontSize: 15
  },
  textStrikethrough: {
    textDecorationLine: 'line-through',
    color: '#94a3b8'
  }
});
