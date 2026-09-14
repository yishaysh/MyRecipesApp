import React, { useState } from 'react';
import {
  View,
  Text,
  ScrollView,
  TouchableOpacity,
  TextInput,
  StyleSheet
} from 'react-native';
import { useRecipeStore } from '../store/recipeStore';
import { StructuredRecipe } from '@myrecipes/shared';

export const SavedRecipesScreen: React.FC = () => {
  const savedRecipes = useRecipeStore((s) => s.savedRecipes);
  const setCurrentRecipe = useRecipeStore((s) => s.setCurrentRecipe);
  const removeRecipe = useRecipeStore((s) => s.removeRecipe);
  const setActiveTab = useRecipeStore((s) => s.setActiveTab);

  const [search, setSearch] = useState('');
  const [selectedPlatform, setSelectedPlatform] = useState<string>('all');

  const filtered = savedRecipes.filter((r) => {
    const matchesSearch =
      r.title.toLowerCase().includes(search.toLowerCase()) ||
      r.description.toLowerCase().includes(search.toLowerCase()) ||
      r.tags.some((t) => t.toLowerCase().includes(search.toLowerCase()));

    const matchesPlatform =
      selectedPlatform === 'all' || r.platform === selectedPlatform;

    return matchesSearch && matchesPlatform;
  });

  const handleSelect = (recipe: StructuredRecipe) => {
    setCurrentRecipe(recipe);
    setActiveTab('recipe');
  };

  const platforms = [
    { id: 'all', label: 'הכל' },
    { id: 'instagram', label: 'אינסטגרם' },
    { id: 'tiktok', label: 'טיקטוק' },
    { id: 'youtube', label: 'יוטיוב' }
  ];

  return (
    <View style={styles.container}>
      <View style={styles.header}>
        <Text style={styles.title}>ספר המתכונים שלי</Text>
        <Text style={styles.subtitle}>
          {savedRecipes.length} מתכונים שמורים זמינים לבישול גם ללא אינטרנט (Offline)
        </Text>

        {/* Search */}
        <TextInput
          style={styles.searchInput}
          placeholder="חפש לפי שם מתכון, מצרך או תגית..."
          placeholderTextColor="#64748b"
          value={search}
          onChangeText={setSearch}
          textAlign="right"
        />

        {/* Platform Filters */}
        <View style={styles.filterRow}>
          {platforms.map((p) => (
            <TouchableOpacity
              key={p.id}
              style={[
                styles.filterChip,
                selectedPlatform === p.id && styles.filterChipActive
              ]}
              onPress={() => setSelectedPlatform(p.id)}
            >
              <Text
                style={[
                  styles.filterChipText,
                  selectedPlatform === p.id && styles.filterChipTextActive
                ]}
              >
                {p.label}
              </Text>
            </TouchableOpacity>
          ))}
        </View>
      </View>

      {filtered.length === 0 ? (
        <View style={styles.emptyContainer}>
          <Text style={styles.emptyIcon}>🍽️</Text>
          <Text style={styles.emptyTitle}>לא נמצאו מתכונים</Text>
          <Text style={styles.emptySubtitle}>
            {savedRecipes.length === 0
              ? 'טרם חילצת מתכונים. נסה להדביק סרטון מאינסטגרם או טיקטוק!'
              : 'אין מתכונים התואמים את החיפוש והסינון הנוכחי.'}
          </Text>
          {savedRecipes.length === 0 && (
            <TouchableOpacity
              style={styles.ctaButton}
              onPress={() => setActiveTab('extract')}
            >
              <Text style={styles.ctaButtonText}>חלץ את המתכון הראשון שלך</Text>
            </TouchableOpacity>
          )}
        </View>
      ) : (
        <ScrollView style={styles.list} contentContainerStyle={styles.listContent}>
          {filtered.map((recipe) => (
            <View key={recipe.id} style={styles.recipeCard}>
              <TouchableOpacity
                style={styles.cardMain}
                onPress={() => handleSelect(recipe)}
              >
                <View style={styles.cardHeader}>
                  <View style={styles.badge}>
                    <Text style={styles.badgeText}>{recipe.platform.toUpperCase()}</Text>
                  </View>
                  <Text style={styles.dateText}>
                    {recipe.totalTimeMinutes ? `⏱ ${recipe.totalTimeMinutes} דק'` : ''}
                  </Text>
                </View>

                <Text style={styles.cardTitle}>{recipe.title}</Text>
                <Text style={styles.cardDesc} numberOfLines={2}>
                  {recipe.description}
                </Text>

                <View style={styles.tagsRow}>
                  {recipe.tags.slice(0, 3).map((tag, idx) => (
                    <View key={idx} style={styles.tagChip}>
                      <Text style={styles.tagText}>#{tag}</Text>
                    </View>
                  ))}
                  <Text style={styles.ingredientCount}>
                    {recipe.ingredients.length} מצרכים
                  </Text>
                </View>
              </TouchableOpacity>

              <TouchableOpacity
                style={styles.deleteBtn}
                onPress={() => removeRecipe(recipe.id)}
              >
                <Text style={styles.deleteText}>✕</Text>
              </TouchableOpacity>
            </View>
          ))}
        </ScrollView>
      )}
    </View>
  );
};

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#0f172a'
  },
  header: {
    padding: 20,
    paddingBottom: 10,
    alignItems: 'flex-end'
  },
  title: {
    fontSize: 26,
    fontWeight: '800',
    color: '#f8fafc',
    marginBottom: 4,
    textAlign: 'right'
  },
  subtitle: {
    fontSize: 14,
    color: '#94a3b8',
    marginBottom: 16,
    textAlign: 'right'
  },
  searchInput: {
    width: '100%',
    backgroundColor: '#1e293b',
    borderRadius: 10,
    padding: 12,
    color: '#ffffff',
    fontSize: 14,
    borderWidth: 1,
    borderColor: '#334155',
    marginBottom: 14
  },
  filterRow: {
    flexDirection: 'row-reverse',
    width: '100%',
    marginBottom: 6
  },
  filterChip: {
    backgroundColor: '#1e293b',
    paddingHorizontal: 14,
    paddingVertical: 6,
    borderRadius: 16,
    marginLeft: 8,
    borderWidth: 1,
    borderColor: '#334155'
  },
  filterChipActive: {
    backgroundColor: '#3b82f6',
    borderColor: '#3b82f6'
  },
  filterChipText: {
    color: '#94a3b8',
    fontSize: 12,
    fontWeight: '700'
  },
  filterChipTextActive: {
    color: '#ffffff'
  },
  list: {
    flex: 1
  },
  listContent: {
    padding: 20,
    paddingTop: 10,
    paddingBottom: 40
  },
  recipeCard: {
    backgroundColor: '#1e293b',
    borderRadius: 14,
    marginBottom: 12,
    borderWidth: 1,
    borderColor: '#334155',
    flexDirection: 'row-reverse',
    overflow: 'hidden'
  },
  cardMain: {
    flex: 1,
    padding: 16
  },
  cardHeader: {
    flexDirection: 'row-reverse',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 8
  },
  badge: {
    backgroundColor: '#3b82f6',
    paddingHorizontal: 8,
    paddingVertical: 3,
    borderRadius: 6
  },
  badgeText: {
    color: '#ffffff',
    fontSize: 10,
    fontWeight: '800'
  },
  dateText: {
    color: '#38bdf8',
    fontSize: 12,
    fontWeight: '600'
  },
  cardTitle: {
    fontSize: 17,
    fontWeight: '700',
    color: '#f8fafc',
    marginBottom: 6,
    textAlign: 'right'
  },
  cardDesc: {
    fontSize: 13,
    color: '#94a3b8',
    lineHeight: 18,
    marginBottom: 10,
    textAlign: 'right'
  },
  tagsRow: {
    flexDirection: 'row-reverse',
    alignItems: 'center',
    flexWrap: 'wrap'
  },
  tagChip: {
    backgroundColor: '#0f172a',
    paddingHorizontal: 8,
    paddingVertical: 2,
    borderRadius: 6,
    marginLeft: 6
  },
  tagText: {
    color: '#cbd5e1',
    fontSize: 11
  },
  ingredientCount: {
    color: '#64748b',
    fontSize: 11,
    marginRight: 'auto'
  },
  deleteBtn: {
    width: 44,
    justifyContent: 'center',
    alignItems: 'center',
    borderRightWidth: 1,
    borderRightColor: '#334155',
    backgroundColor: 'rgba(239, 68, 68, 0.05)'
  },
  deleteText: {
    color: '#ef4444',
    fontSize: 16,
    fontWeight: 'bold'
  },
  emptyContainer: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    padding: 30
  },
  emptyIcon: {
    fontSize: 48,
    marginBottom: 16
  },
  emptyTitle: {
    fontSize: 20,
    fontWeight: '700',
    color: '#f8fafc',
    marginBottom: 6
  },
  emptySubtitle: {
    fontSize: 14,
    color: '#94a3b8',
    textAlign: 'center',
    marginBottom: 20,
    lineHeight: 20
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
    fontSize: 14
  }
});
