import React, { useState } from 'react';
import {
  View,
  Text,
  TextInput,
  TouchableOpacity,
  ScrollView,
  Image,
  StyleSheet,
  Dimensions
} from 'react-native';
import { useRecipeStore } from '../store/recipeStore';
import { StructuredRecipe } from '@myrecipes/shared';

const { width } = Dimensions.get('window');
const CARD_WIDTH = (width - 48) / 2;

export function HomeScreen() {
  const [searchQuery, setSearchQuery] = useState('');
  const [selectedCategory, setSelectedCategory] = useState('הכל');

  const savedRecipes = useRecipeStore((s) => s.savedRecipes);
  const setCurrentRecipe = useRecipeStore((s) => s.setCurrentRecipe);
  const setActiveTab = useRecipeStore((s) => s.setActiveTab);
  const toggleBookmark = useRecipeStore((s) => s.toggleBookmark);
  const isDarkMode = useRecipeStore((s) => s.isDarkMode);

  const categories = ['הכל', 'אסייתי', 'איטלקי', 'מהיר', 'טבעוני'];

  const filteredRecipes = savedRecipes.filter((recipe) => {
    const matchesSearch =
      recipe.title.toLowerCase().includes(searchQuery.toLowerCase()) ||
      recipe.tags.some((t) => t.toLowerCase().includes(searchQuery.toLowerCase()));
    const matchesCategory =
      selectedCategory === 'הכל' ||
      recipe.category === selectedCategory ||
      recipe.tags.includes(selectedCategory);
    return matchesSearch && matchesCategory;
  });

  const getPlatformIcon = (platform: string) => {
    switch (platform) {
      case 'instagram':
        return '📸';
      case 'tiktok':
        return '🎵';
      case 'youtube':
        return '🔴';
      default:
        return '🌐';
    }
  };

  const handleSelectRecipe = (recipe: StructuredRecipe) => {
    setCurrentRecipe(recipe);
    setActiveTab('recipe');
  };

  const themeContainer = isDarkMode ? styles.darkContainer : styles.lightContainer;
  const themeText = isDarkMode ? styles.darkText : styles.lightText;
  const themeCard = isDarkMode ? styles.darkCard : styles.lightCard;

  return (
    <View style={[styles.container, themeContainer]}>
      {/* Header Title */}
      <View style={styles.headerRow}>
        <View style={styles.headerTitleGroup}>
          <Image
            source={require('../../assets/logo.png')}
            style={styles.headerLogo}
            resizeMode="contain"
            accessible={false}
            accessibilityRole="image"
          />
          <Text style={[styles.headerTitle, themeText]}>המתכונים שלי</Text>
        </View>
        <TouchableOpacity
          style={styles.addBtnHeader}
          onPress={() => setActiveTab('extract')}
        >
          <Text style={styles.addBtnHeaderText}>+ חלץ חדש</Text>
        </TouchableOpacity>
      </View>

      {/* Search Bar & Filter Button */}
      <View style={styles.searchSection}>
        <View style={[styles.searchBar, isDarkMode && styles.darkSearchBar]}>
          <Text style={styles.searchIcon}>🔍</Text>
          <TextInput
            style={[styles.searchInput, isDarkMode && styles.darkSearchInput]}
            placeholder="חיפוש מתכון או מרכיב..."
            placeholderTextColor={isDarkMode ? '#94a3b8' : '#64748b'}
            value={searchQuery}
            onChangeText={setSearchQuery}
            textBreakStrategy="simple"
          />
        </View>
        <TouchableOpacity style={styles.filterBtn}>
          <Text style={styles.filterBtnIcon}>⚙️</Text>
        </TouchableOpacity>
      </View>

      {/* Category Chips */}
      <View style={styles.categoriesContainer}>
        <ScrollView horizontal showsHorizontalScrollIndicator={false}>
          {categories.map((cat) => {
            const isActive = selectedCategory === cat;
            return (
              <TouchableOpacity
                key={cat}
                style={[styles.chip, isActive && styles.chipActive]}
                onPress={() => setSelectedCategory(cat)}
              >
                <Text style={[styles.chipText, isActive && styles.chipTextActive]}>
                  {cat}
                </Text>
              </TouchableOpacity>
            );
          })}
        </ScrollView>
      </View>

      {/* Recipe Cards Grid */}
      <ScrollView
        contentContainerStyle={styles.gridContainer}
        showsVerticalScrollIndicator={false}
      >
        {savedRecipes.length === 0 ? (
          <View style={styles.emptyState}>
            <Image
              source={require('../../assets/logo.png')}
              style={styles.emptyLogo}
              resizeMode="contain"
              accessible={false}
              accessibilityRole="image"
            />
            <Text style={[styles.emptyTitle, themeText]}>ספר המתכונים שלך ריק</Text>
            <Text style={styles.emptySubtitle}>
              העתק קישור מסרטון מתכון ב-TikTok, Instagram או YouTube, ולחץ על 'חלץ מתכון' לקבלת מתכון מלא ורשימת קניות!
            </Text>
            <TouchableOpacity
              style={styles.emptyActionBtn}
              activeOpacity={0.85}
              onPress={() => setActiveTab('extract')}
            >
              <Text style={styles.emptyActionBtnText}>✨ חלץ מתכון ראשון עם AI</Text>
            </TouchableOpacity>
          </View>
        ) : filteredRecipes.length === 0 ? (
          <View style={styles.emptyState}>
            <Text style={styles.emptyEmoji}>🔍</Text>
            <Text style={[styles.emptyTitle, themeText]}>לא נמצאו תוצאות</Text>
            <Text style={styles.emptySubtitle}>
              נסה לחפש מילה אחרת או נקה את מסנני החיפוש
            </Text>
          </View>
        ) : (
          <View style={styles.grid}>
            {filteredRecipes.map((recipe) => (
              <TouchableOpacity
                key={recipe.id}
                style={[styles.card, themeCard]}
                activeOpacity={0.88}
                onPress={() => handleSelectRecipe(recipe)}
              >
                {/* Image & Platform Badge */}
                <View style={styles.imageWrapper}>
                  <Image
                    source={{
                      uri:
                        recipe.imageUrl ||
                        'https://images.unsplash.com/photo-1498837167922-ddd27525d352?w=600&auto=format&fit=crop'
                    }}
                    style={styles.cardImage}
                    resizeMode="cover"
                  />
                  <View style={styles.platformBadge}>
                    <Text style={styles.platformIcon}>
                      {getPlatformIcon(recipe.platform)}
                    </Text>
                  </View>
                </View>

                {/* Card Content */}
                <View style={styles.cardContent}>
                  <Text style={[styles.cardTitle, themeText]} numberOfLines={2}>
                    {recipe.title}
                  </Text>

                  <View style={styles.cardFooter}>
                    <View style={styles.timeBadge}>
                      <Text style={styles.timeText}>
                        ⏱️ {recipe.totalTimeMinutes || 25} דק׳
                      </Text>
                    </View>

                    <TouchableOpacity
                      style={styles.bookmarkBtn}
                      activeOpacity={0.7}
                      onPress={() => toggleBookmark(recipe.id)}
                    >
                      <Text style={styles.bookmarkIcon}>
                        {recipe.isBookmarked ? '❤️' : '🤍'}
                      </Text>
                    </TouchableOpacity>
                  </View>
                </View>
              </TouchableOpacity>
            ))}
          </View>
        )}
      </ScrollView>
    </View>
  );
}

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
  headerRow: {
    flexDirection: 'row-reverse',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingHorizontal: 18,
    marginBottom: 12
  },
  headerTitleGroup: {
    flexDirection: 'row-reverse',
    alignItems: 'center',
  },
  headerLogo: {
    width: 32,
    height: 32,
    borderRadius: 8,
    marginLeft: 8,
  },
  emptyLogo: {
    width: 64,
    height: 64,
    borderRadius: 16,
    marginBottom: 16,
  },
  headerTitle: {
    fontSize: 26,
    fontWeight: '800',
    fontFamily: 'System'
  },
  addBtnHeader: {
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
  addBtnHeaderText: {
    color: '#ffffff',
    fontSize: 13,
    fontWeight: '700'
  },
  searchSection: {
    flexDirection: 'row-reverse',
    alignItems: 'center',
    paddingHorizontal: 18,
    marginBottom: 12
  },
  searchBar: {
    flex: 1,
    flexDirection: 'row-reverse',
    alignItems: 'center',
    backgroundColor: '#ffffff',
    borderRadius: 14,
    paddingHorizontal: 14,
    height: 46,
    borderWidth: 1,
    borderColor: '#e2e8f0',
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 1 },
    shadowOpacity: 0.04,
    shadowRadius: 3,
    elevation: 1
  },
  darkSearchBar: {
    backgroundColor: '#1e293b',
    borderColor: '#334155'
  },
  searchIcon: {
    fontSize: 16,
    marginLeft: 8
  },
  searchInput: {
    flex: 1,
    fontSize: 14,
    color: '#1e293b',
    textAlign: 'right'
  },
  darkSearchInput: {
    color: '#f8fafc'
  },
  filterBtn: {
    width: 46,
    height: 46,
    backgroundColor: '#a8e6cf',
    borderRadius: 14,
    marginRight: 10,
    justifyContent: 'center',
    alignItems: 'center'
  },
  filterBtnIcon: {
    fontSize: 18
  },
  categoriesContainer: {
    paddingHorizontal: 14,
    marginBottom: 16
  },
  chip: {
    paddingHorizontal: 16,
    paddingVertical: 8,
    borderRadius: 20,
    backgroundColor: '#ffffff',
    marginLeft: 8,
    borderWidth: 1,
    borderColor: '#e2e8f0'
  },
  chipActive: {
    backgroundColor: '#10b981',
    borderColor: '#059669',
    shadowColor: '#10b981',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.2,
    shadowRadius: 4,
    elevation: 2
  },
  chipText: {
    fontSize: 13,
    color: '#475569',
    fontWeight: '600'
  },
  chipTextActive: {
    color: '#ffffff',
    fontWeight: '700'
  },
  gridContainer: {
    paddingHorizontal: 16,
    paddingBottom: 24
  },
  grid: {
    flexDirection: 'row-reverse',
    flexWrap: 'wrap',
    justifyContent: 'space-between'
  },
  card: {
    width: CARD_WIDTH,
    borderRadius: 18,
    marginBottom: 16,
    overflow: 'hidden',
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.06,
    shadowRadius: 8,
    elevation: 3
  },
  lightCard: {
    backgroundColor: '#ffffff',
    borderWidth: 1,
    borderColor: '#f1f5f9'
  },
  darkCard: {
    backgroundColor: '#1e293b',
    borderWidth: 1,
    borderColor: '#334155'
  },
  imageWrapper: {
    height: 130,
    width: '100%',
    position: 'relative'
  },
  cardImage: {
    width: '100%',
    height: '100%'
  },
  platformBadge: {
    position: 'absolute',
    top: 8,
    right: 8,
    backgroundColor: 'rgba(0,0,0,0.6)',
    borderRadius: 12,
    paddingHorizontal: 6,
    paddingVertical: 3
  },
  platformIcon: {
    fontSize: 12
  },
  cardContent: {
    padding: 12
  },
  cardTitle: {
    fontSize: 14,
    fontWeight: '700',
    marginBottom: 8,
    textAlign: 'right',
    height: 40
  },
  cardFooter: {
    flexDirection: 'row-reverse',
    justifyContent: 'space-between',
    alignItems: 'center'
  },
  timeBadge: {
    backgroundColor: '#f1f5f9',
    paddingHorizontal: 8,
    paddingVertical: 3,
    borderRadius: 8
  },
  timeText: {
    fontSize: 11,
    color: '#64748b',
    fontWeight: '600'
  },
  bookmarkBtn: {
    padding: 4
  },
  bookmarkIcon: {
    fontSize: 16
  },
  emptyActionBtn: {
    marginTop: 16,
    backgroundColor: '#a8e6cf',
    paddingHorizontal: 20,
    paddingVertical: 12,
    borderRadius: 12
  },
  emptyActionBtnText: {
    color: '#064e3b',
    fontWeight: '800',
    fontSize: 14
  },
  emptyState: {
    alignItems: 'center',
    justifyContent: 'center',
    paddingVertical: 60
  },
  emptyEmoji: {
    fontSize: 48,
    marginBottom: 12
  },
  emptyTitle: {
    fontSize: 18,
    fontWeight: '700',
    marginBottom: 6
  },
  emptySubtitle: {
    fontSize: 13,
    color: '#64748b',
    textAlign: 'center',
    paddingHorizontal: 30
  }
});
