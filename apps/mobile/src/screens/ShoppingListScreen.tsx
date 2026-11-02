import React, { useState } from 'react';
import {
  View,
  Text,
  ScrollView,
  TouchableOpacity,
  TextInput,
  StyleSheet,
  Modal
} from 'react-native';
import { useRecipeStore } from '../store/recipeStore';

export const ShoppingListScreen: React.FC = () => {
  const savedRecipes = useRecipeStore((s) => s.savedRecipes);
  const checkedItems = useRecipeStore((s) => s.checkedShoppingItems);
  const toggleShoppingItem = useRecipeStore((s) => s.toggleShoppingItem);
  const customShoppingItems = useRecipeStore((s) => s.customShoppingItems);
  const addCustomShoppingItem = useRecipeStore((s) => s.addCustomShoppingItem);
  const toggleCustomShoppingItem = useRecipeStore((s) => s.toggleCustomShoppingItem);
  const isDarkMode = useRecipeStore((s) => s.isDarkMode);

  const [isModalOpen, setIsModalOpen] = useState(false);
  const [newItemName, setNewItemName] = useState('');

  const handleAddItem = () => {
    if (!newItemName.trim()) return;
    addCustomShoppingItem(newItemName.trim(), 'pantry');
    setNewItemName('');
    setIsModalOpen(false);
  };

  const categoryHebrewMap: Record<string, { label: string; english: string }> = {
    produce: { label: 'ירקות ופירות', english: 'Produce' },
    dairy: { label: 'מוצרי חלב וביצים', english: 'Dairy' },
    meat: { label: 'בשר, עוף ודגים', english: 'Meat' },
    pantry: { label: 'מזווה ויבשים', english: 'Pantry' },
    spices: { label: 'תבלינים', english: 'Spices' },
    bakery: { label: 'מאפייה', english: 'Bakery' },
    other: { label: 'שונות', english: 'Other' }
  };

  // Consolidate all shopping items across recipes
  interface CombinedItem {
    key: string;
    text: string;
    recipeSource?: string;
    category: string;
    isChecked: boolean;
    isCustom?: boolean;
    customId?: string;
  }

  const activeGrouped: Record<string, CombinedItem[]> = {};
  const boughtItems: CombinedItem[] = [];

  savedRecipes.forEach((recipe) => {
    if (recipe.shoppingList) {
      recipe.shoppingList.forEach((group) => {
        const catKey = group.category.toLowerCase();
        if (!activeGrouped[catKey]) activeGrouped[catKey] = [];

        group.items.forEach((itemText) => {
          const itemKey = `${recipe.id}_${group.category}_${itemText}`;
          const isChecked = !!checkedItems[itemKey];

          const combinedObj: CombinedItem = {
            key: itemKey,
            text: itemText,
            recipeSource: recipe.title,
            category: catKey,
            isChecked
          };

          if (isChecked) {
            boughtItems.push(combinedObj);
          } else {
            activeGrouped[catKey].push(combinedObj);
          }
        });
      });
    }
  });

  // Include custom items
  customShoppingItems.forEach((cItem) => {
    const catKey = cItem.category.toLowerCase();
    if (!activeGrouped[catKey]) activeGrouped[catKey] = [];

    const combinedObj: CombinedItem = {
      key: cItem.id,
      text: cItem.name,
      category: catKey,
      isChecked: cItem.checked,
      isCustom: true,
      customId: cItem.id
    };

    if (cItem.checked) {
      boughtItems.push(combinedObj);
    } else {
      activeGrouped[catKey].push(combinedObj);
    }
  });

  const themeContainer = isDarkMode ? styles.darkContainer : styles.lightContainer;
  const themeText = isDarkMode ? styles.darkText : styles.lightText;
  const themeCard = isDarkMode ? styles.darkCard : styles.lightCard;

  return (
    <View style={[styles.container, themeContainer]}>
      {/* Header */}
      <View style={styles.header}>
        <Text style={[styles.title, themeText]}>רשימת קניות 🛒</Text>
        <TouchableOpacity style={styles.addBtn} onPress={() => setIsModalOpen(true)}>
          <Text style={styles.addBtnText}>+ הוסף מוצר</Text>
        </TouchableOpacity>
      </View>

      <ScrollView contentContainerStyle={styles.content} showsVerticalScrollIndicator={false}>
        {/* Active Items Grouped by Category */}
        {Object.keys(activeGrouped).map((catKey) => {
          const items = activeGrouped[catKey];
          if (!items || items.length === 0) return null;

          const catInfo = categoryHebrewMap[catKey] || {
            label: catKey,
            english: catKey
          };

          return (
            <View key={catKey} style={[styles.categoryCard, themeCard]}>
              <View style={styles.categoryHeader}>
                <Text style={[styles.categoryTitle, themeText]}>{catInfo.label}</Text>
                <Text style={styles.categoryEnglish}>{catInfo.english}</Text>
              </View>

              {items.map((item) => (
                <TouchableOpacity
                  key={item.key}
                  style={styles.itemRow}
                  onPress={() =>
                    item.isCustom && item.customId
                      ? toggleCustomShoppingItem(item.customId)
                      : toggleShoppingItem(item.key)
                  }
                >
                  <View style={styles.checkbox}>
                    {item.isChecked && <Text style={styles.checkmark}>✓</Text>}
                  </View>

                  <View style={styles.itemTextWrap}>
                    <Text style={[styles.itemText, themeText]}>
                      {item.text}{' '}
                      {item.recipeSource && (
                        <Text style={styles.recipeSourceTag}>({item.recipeSource})</Text>
                      )}
                    </Text>
                  </View>
                </TouchableOpacity>
              ))}
            </View>
          );
        })}

        {/* Purchased Items Section */}
        {boughtItems.length > 0 && (
          <View style={styles.boughtSection}>
            <Text style={styles.boughtTitle}>כבר נקנה ({boughtItems.length}) ✓</Text>
            {boughtItems.map((item) => (
              <TouchableOpacity
                key={item.key}
                style={[styles.itemRow, styles.itemRowBought]}
                onPress={() =>
                  item.isCustom && item.customId
                    ? toggleCustomShoppingItem(item.customId)
                    : toggleShoppingItem(item.key)
                }
              >
                <View style={[styles.checkbox, styles.checkboxBought]}>
                  <Text style={styles.checkmarkBought}>✓</Text>
                </View>
                <Text style={[styles.itemText, styles.textStrikethrough]}>
                  {item.text}{' '}
                  {item.recipeSource && (
                    <Text style={styles.recipeSourceTag}>({item.recipeSource})</Text>
                  )}
                </Text>
              </TouchableOpacity>
            ))}
          </View>
        )}
      </ScrollView>

      {/* Add Custom Item Modal */}
      <Modal visible={isModalOpen} transparent animationType="fade">
        <View style={styles.modalOverlay}>
          <View style={[styles.modalCard, themeCard]}>
            <Text style={[styles.modalTitle, themeText]}>הוספת מוצר לרשימת הקניות 🛒</Text>
            <TextInput
              style={[styles.modalInput, isDarkMode && styles.darkInput]}
              placeholder="שם המוצר (למשל: חלב, לחם, ביצים)"
              placeholderTextColor={isDarkMode ? '#94a3b8' : '#64748b'}
              value={newItemName}
              onChangeText={setNewItemName}
              autoFocus
              textAlign="right"
            />
            <View style={styles.modalActions}>
              <TouchableOpacity
                style={styles.modalCancelBtn}
                onPress={() => setIsModalOpen(false)}
              >
                <Text style={styles.modalCancelText}>ביטול</Text>
              </TouchableOpacity>
              <TouchableOpacity style={styles.modalSaveBtn} onPress={handleAddItem}>
                <Text style={styles.modalSaveText}>הוסף מוצר</Text>
              </TouchableOpacity>
            </View>
          </View>
        </View>
      </Modal>
    </View>
  );
};

const styles = StyleSheet.create({
  container: {
    flex: 1,
    paddingTop: 12
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
  header: {
    flexDirection: 'row-reverse',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingHorizontal: 18,
    marginBottom: 12
  },
  title: {
    fontSize: 24,
    fontWeight: '800'
  },
  addBtn: {
    backgroundColor: '#10b981',
    paddingHorizontal: 16,
    paddingVertical: 8,
    borderRadius: 20,
    shadowColor: '#10b981',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.25,
    shadowRadius: 4,
    elevation: 2
  },
  addBtnText: {
    color: '#ffffff',
    fontSize: 13,
    fontWeight: '700'
  },
  content: {
    paddingHorizontal: 18,
    paddingBottom: 40
  },
  categoryCard: {
    borderRadius: 18,
    padding: 16,
    marginBottom: 14,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 1 },
    shadowOpacity: 0.04,
    shadowRadius: 4,
    elevation: 2
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
  categoryHeader: {
    flexDirection: 'row-reverse',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingBottom: 8,
    borderBottomWidth: 1,
    borderBottomColor: '#f1f5f9',
    marginBottom: 10
  },
  categoryTitle: {
    fontSize: 16,
    fontWeight: '800'
  },
  categoryEnglish: {
    fontSize: 12,
    color: '#94a3b8',
    fontWeight: '600'
  },
  itemRow: {
    flexDirection: 'row-reverse',
    alignItems: 'center',
    paddingVertical: 8
  },
  itemRowBought: {
    opacity: 0.55
  },
  checkbox: {
    width: 22,
    height: 22,
    borderRadius: 6,
    borderWidth: 2,
    borderColor: '#34d399',
    marginLeft: 12,
    justifyContent: 'center',
    alignItems: 'center'
  },
  checkboxBought: {
    backgroundColor: '#34d399',
    borderColor: '#059669'
  },
  checkmark: {
    color: '#059669',
    fontSize: 12,
    fontWeight: '800'
  },
  checkmarkBought: {
    color: '#064e3b',
    fontSize: 12,
    fontWeight: '800'
  },
  itemTextWrap: {
    flex: 1
  },
  itemText: {
    fontSize: 14,
    fontWeight: '600',
    textAlign: 'right'
  },
  recipeSourceTag: {
    fontSize: 12,
    color: '#64748b',
    fontWeight: '400'
  },
  textStrikethrough: {
    textDecorationLine: 'line-through',
    color: '#94a3b8'
  },
  boughtSection: {
    marginTop: 10,
    paddingTop: 10
  },
  boughtTitle: {
    fontSize: 14,
    fontWeight: '800',
    color: '#059669',
    marginBottom: 10,
    textAlign: 'right'
  },
  modalOverlay: {
    flex: 1,
    backgroundColor: 'rgba(0,0,0,0.4)',
    justifyContent: 'center',
    alignItems: 'center',
    padding: 20
  },
  modalCard: {
    width: '100%',
    borderRadius: 20,
    padding: 20
  },
  modalTitle: {
    fontSize: 18,
    fontWeight: '800',
    marginBottom: 14,
    textAlign: 'right'
  },
  modalInput: {
    backgroundColor: '#f8fafc',
    borderRadius: 12,
    padding: 14,
    color: '#0f172a',
    fontSize: 14,
    borderWidth: 1,
    borderColor: '#cbd5e1',
    marginBottom: 16
  },
  darkInput: {
    backgroundColor: '#0f172a',
    color: '#ffffff',
    borderColor: '#334155'
  },
  modalActions: {
    flexDirection: 'row',
    justifyContent: 'flex-end'
  },
  modalCancelBtn: {
    paddingHorizontal: 16,
    paddingVertical: 10,
    marginRight: 10
  },
  modalCancelText: {
    color: '#64748b',
    fontWeight: '700'
  },
  modalSaveBtn: {
    backgroundColor: '#34d399',
    paddingHorizontal: 18,
    paddingVertical: 10,
    borderRadius: 12
  },
  modalSaveText: {
    color: '#064e3b',
    fontWeight: '800'
  }
});
