import React, { useState, useMemo } from 'react';
import {
  View,
  Text,
  TextInput,
  TouchableOpacity,
  ScrollView,
  Image,
  StyleSheet,
  Dimensions,
  Modal,
  Alert,
  Share
} from 'react-native';
import { useRecipeStore } from '../store/recipeStore';
import { StructuredRecipe } from '@myrecipes/shared';
import { TagEditorModal } from '../components/TagEditorModal';

const { width } = Dimensions.get('window');
const CARD_WIDTH = (width - 48) / 2;

export function HomeScreen() {
  const [searchQuery, setSearchQuery] = useState('');
  const [selectedCategory, setSelectedCategory] = useState('הכל');

  const savedRecipes = useRecipeStore((s) => s.savedRecipes);
  const setCurrentRecipe = useRecipeStore((s) => s.setCurrentRecipe);
  const setActiveTab = useRecipeStore((s) => s.setActiveTab);
  const toggleBookmark = useRecipeStore((s) => s.toggleBookmark);
  const togglePinRecipe = useRecipeStore((s) => s.togglePinRecipe);
  const toggleArchiveRecipe = useRecipeStore((s) => s.toggleArchiveRecipe);
  const removeRecipe = useRecipeStore((s) => s.removeRecipe);
  const addIngredientsToShoppingList = useRecipeStore((s) => s.addIngredientsToShoppingList);
  const isDarkMode = useRecipeStore((s) => s.isDarkMode);

  // Modals & Filter states
  const [selectedRecipeForMenu, setSelectedRecipeForMenu] = useState<StructuredRecipe | null>(null);
  const [recipeForTagEdit, setRecipeForTagEdit] = useState<StructuredRecipe | null>(null);
  const [isFilterModalOpen, setIsFilterModalOpen] = useState(false);
  const [sortBy, setSortBy] = useState<'newest' | 'fastest' | 'alphabetical' | 'favorites'>('newest');
  const [selectedPlatform, setSelectedPlatform] = useState<string>('all');
  const [showArchivedOnly, setShowArchivedOnly] = useState(false);

  const customTags = useRecipeStore((s) => s.customTags || []);

  // Compute dynamic category & tag filter pills (defaults + custom + any tag on saved recipes)
  const allAvailableTags = useMemo(() => {
    const defaultList = ['אסייתי', 'איטלקי', 'מהיר', 'טבעוני'];
    const set = new Set<string>([...defaultList, ...(customTags || [])]);
    savedRecipes.forEach((r) => {
      (r.tags || []).forEach((t) => {
        if (t && t.trim()) set.add(t.trim());
      });
      if (r.category && r.category.trim() && r.category !== 'all') {
        set.add(r.category.trim());
      }
    });
    return Array.from(set);
  }, [customTags, savedRecipes]);

  const categories = useMemo(() => ['הכל', ...allAvailableTags], [allAvailableTags]);

  const filteredRecipes = savedRecipes
    .filter((recipe) => {
      // Archive filter
      if (showArchivedOnly) {
        if (!recipe.isArchived) return false;
      } else {
        if (recipe.isArchived) return false;
      }

      // Platform filter
      if (selectedPlatform !== 'all' && recipe.platform !== selectedPlatform) {
        return false;
      }

      // Category filter (supports multi-tag matching!)
      const matchesCategory =
        selectedCategory === 'הכל' ||
        recipe.category === selectedCategory ||
        (Array.isArray(recipe.tags) && recipe.tags.includes(selectedCategory));
      if (!matchesCategory) return false;

      // Search query
      const q = searchQuery.toLowerCase().trim();
      if (!q) return true;
      return (
        recipe.title.toLowerCase().includes(q) ||
        recipe.tags.some((t) => t.toLowerCase().includes(q)) ||
        recipe.ingredients.some((ing) => ing.name.toLowerCase().includes(q))
      );
    })
    .sort((a, b) => {
      // Pinned recipes ALWAYS come first!
      if (a.isPinned && !b.isPinned) return -1;
      if (!a.isPinned && b.isPinned) return 1;

      if (sortBy === 'fastest') {
        return (a.totalTimeMinutes || 999) - (b.totalTimeMinutes || 999);
      }
      if (sortBy === 'alphabetical') {
        return a.title.localeCompare(b.title, 'he');
      }
      if (sortBy === 'favorites') {
        if (a.isBookmarked && !b.isBookmarked) return -1;
        if (!a.isBookmarked && b.isBookmarked) return 1;
      }
      return new Date(b.createdAt || 0).getTime() - new Date(a.createdAt || 0).getTime();
    });

  const handleShareRecipe = async (recipe: StructuredRecipe) => {
    try {
      const msg = `${recipe.title}\n\nמתכון שחולץ באפליקציית ספר המתכונים שלי ✨\n${recipe.sourceUrl ? `קישור למקור: ${recipe.sourceUrl}` : ''}`;
      await Share.share({ message: msg });
    } catch (err) {
      // Ignore
    }
  };

  const handleAddAllToShopping = (recipe: StructuredRecipe) => {
    if (recipe.ingredients && recipe.ingredients.length > 0) {
      addIngredientsToShoppingList(recipe.ingredients, recipe.title);
      Alert.alert('התווסף בהצלחה', `כל ${recipe.ingredients.length} המצרכים נוספו לרשימת הקניות! 🛒`);
    } else {
      Alert.alert('שים לב', 'לא נמצאו מצרכים במתכון זה.');
    }
  };

  const handleDeleteRecipe = (recipe: StructuredRecipe) => {
    Alert.alert(
      'מחיקת מתכון',
      `האם אתה בטוח שברצונך למחוק את "${recipe.title}"?`,
      [
        { text: 'ביטול', style: 'cancel' },
        {
          text: 'מחק',
          style: 'destructive',
          onPress: () => {
            removeRecipe(recipe.id);
            setSelectedRecipeForMenu(null);
          }
        }
      ]
    );
  };

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
        <TouchableOpacity
          style={[styles.filterBtn, (sortBy !== 'newest' || selectedPlatform !== 'all' || showArchivedOnly) && styles.filterBtnActive]}
          activeOpacity={0.7}
          onPress={() => setIsFilterModalOpen(true)}
        >
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
                style={[styles.card, themeCard, recipe.isPinned && styles.pinnedCard]}
                activeOpacity={0.88}
                onPress={() => handleSelectRecipe(recipe)}
                onLongPress={() => setSelectedRecipeForMenu(recipe)}
                delayLongPress={350}
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

                  {/* Pinned & Archived Badges */}
                  {recipe.isPinned && (
                    <View style={styles.pinnedBadge}>
                      <Text style={styles.pinnedBadgeText}>📌</Text>
                    </View>
                  )}
                  {recipe.isArchived && (
                    <View style={styles.archivedBadge}>
                      <Text style={styles.archivedBadgeText}>📦 ארכיון</Text>
                    </View>
                  )}
                </View>

                {/* Card Content */}
                <View style={styles.cardContent}>
                  <Text style={[styles.cardTitle, themeText]} numberOfLines={2}>
                    {recipe.title}
                  </Text>

                  {/* Recipe Tags Chips */}
                  {Array.isArray(recipe.tags) && recipe.tags.length > 0 && (
                    <View style={styles.cardTagsRow}>
                      {recipe.tags.slice(0, 2).map((t, idx) => (
                        <View key={idx} style={styles.cardTagBadge}>
                          <Text style={styles.cardTagBadgeText} numberOfLines={1}>
                            {t}
                          </Text>
                        </View>
                      ))}
                      {recipe.tags.length > 2 && (
                        <Text style={styles.cardTagMoreText}>+{recipe.tags.length - 2}</Text>
                      )}
                    </View>
                  )}

                  <View style={styles.cardFooter}>
                    <View style={styles.timeBadge}>
                      <Text style={styles.timeText}>
                        ⏱️ {recipe.totalTimeMinutes || 25} דק׳
                      </Text>
                    </View>

                    <View style={styles.cardActionsRow}>
                      <TouchableOpacity
                        style={styles.moreOptionsBtn}
                        activeOpacity={0.7}
                        onPress={() => setSelectedRecipeForMenu(recipe)}
                        accessibilityLabel="תפריט אפשרויות מתכון"
                      >
                        <Text style={styles.moreOptionsIcon}>⋮</Text>
                      </TouchableOpacity>

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
                </View>
              </TouchableOpacity>
            ))}
          </View>
        )}
      </ScrollView>

      {/* Action Sheet Modal (Long Press on Recipe) */}
      <Modal
        visible={!!selectedRecipeForMenu}
        transparent
        animationType="fade"
        onRequestClose={() => setSelectedRecipeForMenu(null)}
      >
        <TouchableOpacity
          style={styles.modalBackdrop}
          activeOpacity={1}
          onPress={() => setSelectedRecipeForMenu(null)}
        >
          <View style={[styles.actionSheetCard, themeCard]} onStartShouldSetResponder={() => true}>
            <View style={styles.sheetHandle} />

            <View style={styles.sheetHeader}>
              <Text style={[styles.sheetTitle, themeText]} numberOfLines={1}>
                {selectedRecipeForMenu?.title}
              </Text>
              <Text style={styles.sheetSubtitle}>בחר פעולה עבור מתכון זה:</Text>
            </View>

            {/* Action 1: Pin / Unpin */}
            <TouchableOpacity
              style={styles.actionRow}
              onPress={() => {
                if (selectedRecipeForMenu) {
                  togglePinRecipe(selectedRecipeForMenu.id);
                  setSelectedRecipeForMenu(null);
                }
              }}
            >
              <Text style={styles.actionIcon}>📌</Text>
              <Text style={[styles.actionText, themeText]}>
                {selectedRecipeForMenu?.isPinned ? 'בטל נעיצה מראש הרשימה' : 'נעץ מתכון בראש הרשימה'}
              </Text>
            </TouchableOpacity>

            {/* Action 2: Archive / Unarchive */}
            <TouchableOpacity
              style={styles.actionRow}
              onPress={() => {
                if (selectedRecipeForMenu) {
                  toggleArchiveRecipe(selectedRecipeForMenu.id);
                  setSelectedRecipeForMenu(null);
                }
              }}
            >
              <Text style={styles.actionIcon}>📦</Text>
              <Text style={[styles.actionText, themeText]}>
                {selectedRecipeForMenu?.isArchived ? 'החזר מתכון מהארכיון לרשימה' : 'העבר מתכון לארכיון'}
              </Text>
            </TouchableOpacity>

            {/* Action 3: Share */}
            <TouchableOpacity
              style={styles.actionRow}
              onPress={() => {
                if (selectedRecipeForMenu) {
                  handleShareRecipe(selectedRecipeForMenu);
                  setSelectedRecipeForMenu(null);
                }
              }}
            >
              <Text style={styles.actionIcon}>📤</Text>
              <Text style={[styles.actionText, themeText]}>שתף מתכון עם חברים</Text>
            </TouchableOpacity>

            {/* Action 4: Add to Shopping List */}
            <TouchableOpacity
              style={styles.actionRow}
              onPress={() => {
                if (selectedRecipeForMenu) {
                  handleAddAllToShopping(selectedRecipeForMenu);
                  setSelectedRecipeForMenu(null);
                }
              }}
            >
              <Text style={styles.actionIcon}>🛒</Text>
              <Text style={[styles.actionText, themeText]}>הוסף את כל המצרכים לרשימת הקניות</Text>
            </TouchableOpacity>

            {/* Action 5: Manage Tags */}
            <TouchableOpacity
              style={styles.actionRow}
              onPress={() => {
                if (selectedRecipeForMenu) {
                  const target = selectedRecipeForMenu;
                  setSelectedRecipeForMenu(null);
                  setRecipeForTagEdit(target);
                }
              }}
            >
              <Text style={styles.actionIcon}>🏷️</Text>
              <Text style={[styles.actionText, themeText]}>ניהול ועריכת תגיות מתכון</Text>
            </TouchableOpacity>

            {/* Action 5: Delete */}
            <TouchableOpacity
              style={[styles.actionRow, styles.actionRowDanger]}
              onPress={() => {
                if (selectedRecipeForMenu) {
                  handleDeleteRecipe(selectedRecipeForMenu);
                }
              }}
            >
              <Text style={styles.actionIcon}>🗑️</Text>
              <Text style={[styles.actionText, styles.actionTextDanger]}>מחק מתכון לצמיתות</Text>
            </TouchableOpacity>

            {/* Close Button */}
            <TouchableOpacity
              style={styles.sheetCancelBtn}
              onPress={() => setSelectedRecipeForMenu(null)}
            >
              <Text style={styles.sheetCancelBtnText}>ביטול</Text>
            </TouchableOpacity>
          </View>
        </TouchableOpacity>
      </Modal>

      {/* Filter & Sort Modal (Gear Icon) */}
      <Modal
        visible={isFilterModalOpen}
        transparent
        animationType="slide"
        onRequestClose={() => setIsFilterModalOpen(false)}
      >
        <TouchableOpacity
          style={styles.modalBackdrop}
          activeOpacity={1}
          onPress={() => setIsFilterModalOpen(false)}
        >
          <View style={[styles.filterModalCard, themeCard]} onStartShouldSetResponder={() => true}>
            <View style={styles.sheetHandle} />

            <View style={styles.filterHeader}>
              <Text style={[styles.filterHeaderTitle, themeText]}>סינון ומיון מתכונים ⚙️</Text>
              <TouchableOpacity
                onPress={() => {
                  setSortBy('newest');
                  setSelectedPlatform('all');
                  setShowArchivedOnly(false);
                }}
              >
                <Text style={styles.resetFilterText}>איפוס</Text>
              </TouchableOpacity>
            </View>

            {/* Sort Section */}
            <Text style={styles.filterSectionTitle}>סדר מיון:</Text>
            <View style={styles.filterChipsRow}>
              {[
                { id: 'newest', label: '⏱️ הכי חדש' },
                { id: 'fastest', label: '⚡ זמן קצר' },
                { id: 'alphabetical', label: '🔤 א-ב' },
                { id: 'favorites', label: '❤️ מועדפים' }
              ].map((opt) => (
                <TouchableOpacity
                  key={opt.id}
                  style={[styles.filterChip, sortBy === opt.id && styles.filterChipActive]}
                  onPress={() => setSortBy(opt.id as any)}
                >
                  <Text style={[styles.filterChipText, sortBy === opt.id && styles.filterChipTextActive]}>
                    {opt.label}
                  </Text>
                </TouchableOpacity>
              ))}
            </View>

            {/* Platform Filter Section */}
            <Text style={styles.filterSectionTitle}>פלטפורמת מקור:</Text>
            <View style={styles.filterChipsRow}>
              {[
                { id: 'all', label: 'הכל' },
                { id: 'instagram', label: '📸 Instagram' },
                { id: 'tiktok', label: '🎵 TikTok' },
                { id: 'youtube', label: '🔴 YouTube' }
              ].map((opt) => (
                <TouchableOpacity
                  key={opt.id}
                  style={[styles.filterChip, selectedPlatform === opt.id && styles.filterChipActive]}
                  onPress={() => setSelectedPlatform(opt.id)}
                >
                  <Text style={[styles.filterChipText, selectedPlatform === opt.id && styles.filterChipTextActive]}>
                    {opt.label}
                  </Text>
                </TouchableOpacity>
              ))}
            </View>

            {/* Archive Filter Toggle */}
            <Text style={styles.filterSectionTitle}>מצב ארכיון:</Text>
            <TouchableOpacity
              style={[styles.archiveToggleRow, showArchivedOnly && styles.archiveToggleRowActive]}
              onPress={() => setShowArchivedOnly(!showArchivedOnly)}
            >
              <Text style={[styles.archiveToggleText, themeText]}>
                📦 הצג רק מתכונים ששמורים בארכיון ({savedRecipes.filter((r) => r.isArchived).length})
              </Text>
              <View style={[styles.archiveCheckbox, showArchivedOnly && styles.archiveCheckboxActive]}>
                {showArchivedOnly && <Text style={styles.archiveCheckmark}>✓</Text>}
              </View>
            </TouchableOpacity>

            {/* Confirm Button */}
            <TouchableOpacity
              style={styles.filterConfirmBtn}
              onPress={() => setIsFilterModalOpen(false)}
            >
              <Text style={styles.filterConfirmBtnText}>החל סינון ({filteredRecipes.length} מתכונים)</Text>
            </TouchableOpacity>
          </View>
        </TouchableOpacity>
      </Modal>

      {/* Tag Editor Modal */}
      <TagEditorModal
        visible={!!recipeForTagEdit}
        recipe={recipeForTagEdit}
        onClose={() => setRecipeForTagEdit(null)}
        isDarkMode={isDarkMode}
      />
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
  filterBtnActive: {
    backgroundColor: '#10b981',
    borderColor: '#059669',
    borderWidth: 1,
  },
  pinnedCard: {
    borderColor: '#fbbf24',
    borderWidth: 2,
  },
  pinnedBadge: {
    position: 'absolute',
    top: 8,
    left: 8,
    backgroundColor: '#fef3c7',
    borderRadius: 12,
    paddingHorizontal: 6,
    paddingVertical: 3,
    borderWidth: 1,
    borderColor: '#fbbf24',
  },
  pinnedBadgeText: {
    fontSize: 12,
  },
  archivedBadge: {
    position: 'absolute',
    bottom: 8,
    right: 8,
    backgroundColor: 'rgba(71, 85, 105, 0.85)',
    borderRadius: 8,
    paddingHorizontal: 6,
    paddingVertical: 2,
  },
  archivedBadgeText: {
    fontSize: 10,
    color: '#ffffff',
    fontWeight: '700',
  },
  modalBackdrop: {
    flex: 1,
    backgroundColor: 'rgba(0, 0, 0, 0.5)',
    justifyContent: 'flex-end',
  },
  actionSheetCard: {
    backgroundColor: '#ffffff',
    borderTopLeftRadius: 24,
    borderTopRightRadius: 24,
    padding: 20,
    paddingBottom: 32,
  },
  sheetHandle: {
    width: 40,
    height: 4,
    backgroundColor: '#cbd5e1',
    borderRadius: 2,
    alignSelf: 'center',
    marginBottom: 16,
  },
  sheetHeader: {
    marginBottom: 16,
    alignItems: 'flex-end',
  },
  sheetTitle: {
    fontSize: 18,
    fontWeight: '800',
    textAlign: 'right',
  },
  sheetSubtitle: {
    fontSize: 13,
    color: '#64748b',
    marginTop: 4,
    textAlign: 'right',
  },
  actionRow: {
    flexDirection: 'row-reverse',
    alignItems: 'center',
    paddingVertical: 14,
    borderBottomWidth: 1,
    borderBottomColor: '#f1f5f9',
  },
  actionRowDanger: {
    borderBottomWidth: 0,
    marginTop: 4,
  },
  actionIcon: {
    fontSize: 20,
    marginLeft: 12,
  },
  actionText: {
    fontSize: 15,
    fontWeight: '600',
    textAlign: 'right',
    flex: 1,
  },
  actionTextDanger: {
    color: '#ef4444',
    fontWeight: '700',
  },
  sheetCancelBtn: {
    marginTop: 16,
    backgroundColor: '#f1f5f9',
    borderRadius: 14,
    paddingVertical: 14,
    alignItems: 'center',
  },
  sheetCancelBtnText: {
    fontSize: 15,
    fontWeight: '700',
    color: '#475569',
  },
  filterModalCard: {
    backgroundColor: '#ffffff',
    borderTopLeftRadius: 24,
    borderTopRightRadius: 24,
    padding: 20,
    paddingBottom: 32,
  },
  filterHeader: {
    flexDirection: 'row-reverse',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 16,
  },
  filterHeaderTitle: {
    fontSize: 18,
    fontWeight: '800',
  },
  resetFilterText: {
    color: '#10b981',
    fontWeight: '700',
    fontSize: 14,
  },
  filterSectionTitle: {
    fontSize: 14,
    fontWeight: '700',
    color: '#64748b',
    marginTop: 12,
    marginBottom: 8,
    textAlign: 'right',
  },
  filterChipsRow: {
    flexDirection: 'row-reverse',
    flexWrap: 'wrap',
    gap: 8,
  },
  filterChip: {
    paddingHorizontal: 12,
    paddingVertical: 8,
    borderRadius: 12,
    backgroundColor: '#f1f5f9',
  },
  filterChipActive: {
    backgroundColor: '#10b981',
  },
  filterChipText: {
    fontSize: 13,
    color: '#475569',
    fontWeight: '600',
  },
  filterChipTextActive: {
    color: '#ffffff',
    fontWeight: '700',
  },
  archiveToggleRow: {
    flexDirection: 'row-reverse',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingVertical: 12,
    paddingHorizontal: 14,
    backgroundColor: '#f8fafc',
    borderRadius: 12,
    marginTop: 4,
  },
  archiveToggleRowActive: {
    backgroundColor: '#eff6ff',
    borderColor: '#3b82f6',
    borderWidth: 1,
  },
  archiveToggleText: {
    fontSize: 13,
    fontWeight: '600',
  },
  archiveCheckbox: {
    width: 20,
    height: 20,
    borderRadius: 6,
    borderWidth: 2,
    borderColor: '#94a3b8',
    justifyContent: 'center',
    alignItems: 'center',
  },
  archiveCheckboxActive: {
    backgroundColor: '#3b82f6',
    borderColor: '#3b82f6',
  },
  archiveCheckmark: {
    color: '#ffffff',
    fontSize: 12,
    fontWeight: '800',
  },
  filterConfirmBtn: {
    backgroundColor: '#10b981',
    borderRadius: 14,
    paddingVertical: 14,
    alignItems: 'center',
    marginTop: 20,
  },
  filterConfirmBtnText: {
    color: '#ffffff',
    fontWeight: '800',
    fontSize: 15,
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
  cardTagsRow: {
    flexDirection: 'row-reverse',
    flexWrap: 'wrap',
    gap: 4,
    marginBottom: 8,
    alignItems: 'center'
  },
  cardTagBadge: {
    backgroundColor: '#ecfdf5',
    borderWidth: 1,
    borderColor: '#a7f3d0',
    paddingHorizontal: 6,
    paddingVertical: 2,
    borderRadius: 8,
    maxWidth: '75%'
  },
  cardTagBadgeText: {
    fontSize: 10,
    fontWeight: '700',
    color: '#065f46'
  },
  cardTagMoreText: {
    fontSize: 10,
    fontWeight: '700',
    color: '#10b981'
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
  cardActionsRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4
  },
  moreOptionsBtn: {
    paddingHorizontal: 6,
    paddingVertical: 2
  },
  moreOptionsIcon: {
    fontSize: 18,
    fontWeight: '800',
    color: '#64748b'
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
