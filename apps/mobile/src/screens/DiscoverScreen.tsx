import React, { useState, useEffect, useCallback } from 'react';
import {
  View,
  Text,
  ScrollView,
  Image,
  TouchableOpacity,
  TextInput,
  StyleSheet,
  Dimensions,
  RefreshControl,
  Linking,
  Alert,
  ActivityIndicator
} from 'react-native';
import { useRecipeStore } from '../store/recipeStore';
import { TrendingRecipe } from '@myrecipes/shared';
import { ApiClient } from '../services/api.client';

const { width } = Dimensions.get('window');

const CATEGORIES = ['הכל', '🔥 ויראלי', '🍫 קינוחים', '🥩 בשר', '🍝 איטלקי', '⚡ מהיר', '🥗 בריא'];

const PLATFORMS = [
  { id: 'all', label: 'הכל' },
  { id: 'tiktok', label: '🎵 TikTok' },
  { id: 'instagram', label: '📸 Instagram' },
  { id: 'youtube', label: '🔴 YouTube' }
];

export function DiscoverScreen() {
  const saveRecipe = useRecipeStore((s) => s.saveRecipe);
  const setCurrentRecipe = useRecipeStore((s) => s.setCurrentRecipe);
  const setActiveTab = useRecipeStore((s) => s.setActiveTab);
  const isDarkMode = useRecipeStore((s) => s.isDarkMode);

  const [trends, setTrends] = useState<TrendingRecipe[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [isRefreshing, setIsRefreshing] = useState(false);
  const [selectedCategory, setSelectedCategory] = useState('הכל');
  const [selectedPlatform, setSelectedPlatform] = useState('all');
  const [searchQuery, setSearchQuery] = useState('');
  const [lastUpdated, setLastUpdated] = useState<string | null>(null);

  const fetchTrends = useCallback(async (isRefresh = false) => {
    if (isRefresh) {
      setIsRefreshing(true);
    } else {
      setIsLoading(true);
    }

    try {
      const res = await ApiClient.getTrends(selectedCategory, selectedPlatform, searchQuery);
      setTrends(res.trends || []);
      setLastUpdated(res.lastUpdated || new Date().toISOString());
    } catch (err) {
      console.warn('Failed to load trends:', err);
    } finally {
      setIsLoading(false);
      setIsRefreshing(false);
    }
  }, [selectedCategory, selectedPlatform, searchQuery]);

  useEffect(() => {
    fetchTrends(false);
  }, [fetchTrends]);

  const handleOpenSourceUrl = async (url: string) => {
    try {
      const canOpen = await Linking.canOpenURL(url);
      if (canOpen) {
        await Linking.openURL(url);
      } else {
        Alert.alert('שגיאה', 'לא ניתן לפתוח את הקישור במכשיר זה.');
      }
    } catch {
      Alert.alert('שגיאה', 'אירעה שגיאה בפתיחת הסרטון.');
    }
  };

  const handleImportTrend = (trend: TrendingRecipe) => {
    saveRecipe(trend.recipe);
    Alert.alert(
      'המתכון נוסף בהצלחה! 🎉',
      `"${trend.title}" נשמר בספר המתכונים שלך. תרצה לצפות בו כעת?`,
      [
        { text: 'הישאר בגילוי', style: 'cancel' },
        {
          text: 'פתח מתכון 📖',
          onPress: () => {
            setCurrentRecipe(trend.recipe);
            setActiveTab('recipe');
          }
        }
      ]
    );
  };

  const handleViewRecipe = (trend: TrendingRecipe) => {
    setCurrentRecipe(trend.recipe);
    setActiveTab('recipe');
  };

  const getPlatformBadge = (platform: string) => {
    switch (platform) {
      case 'tiktok':
        return { text: '🎵 TikTok', color: '#000000' };
      case 'instagram':
        return { text: '📸 Instagram', color: '#e1306c' };
      case 'youtube':
        return { text: '🔴 YouTube', color: '#ef4444' };
      default:
        return { text: '🌐 סושיאל', color: '#10b981' };
    }
  };

  const themeContainer = isDarkMode ? styles.darkContainer : styles.lightContainer;
  const themeText = isDarkMode ? styles.darkText : styles.lightText;
  const themeCard = isDarkMode ? styles.darkCard : styles.lightCard;

  const featuredTrend = trends.length > 0 ? trends[0] : null;
  const remainingTrends = trends.length > 1 ? trends.slice(1) : [];

  return (
    <ScrollView
      style={[styles.container, themeContainer]}
      showsVerticalScrollIndicator={false}
      refreshControl={
        <RefreshControl
          refreshing={isRefreshing}
          onRefresh={() => fetchTrends(true)}
          colors={['#10b981']}
          tintColor="#10b981"
        />
      }
    >
      {/* Header */}
      <View style={styles.header}>
        <View style={styles.headerTopRow}>
          <Text style={[styles.headerTitle, themeText]}>גילוי טרנדים חי 🧭</Text>
          <View style={styles.liveIndicator}>
            <View style={styles.liveDot} />
            <Text style={styles.liveText}>חי ברשת</Text>
          </View>
        </View>
        <Text style={styles.headerSubtitle}>
          סריקה חיה של סרטוני המתכונים המובילים ב-TikTok, Instagram ו-YouTube
        </Text>
      </View>

      {/* Search Input */}
      <View style={styles.searchSection}>
        <View style={[styles.searchBar, isDarkMode && styles.darkSearchBar]}>
          <Text style={styles.searchIcon}>🔍</Text>
          <TextInput
            style={[styles.searchInput, isDarkMode && styles.darkSearchInput]}
            placeholder="חפש טרנד, יוצר או מנה..."
            placeholderTextColor={isDarkMode ? '#94a3b8' : '#64748b'}
            value={searchQuery}
            onChangeText={setSearchQuery}
            textBreakStrategy="simple"
            textAlign="right"
          />
          {searchQuery.length > 0 && (
            <TouchableOpacity onPress={() => setSearchQuery('')} hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }}>
              <Text style={styles.clearSearchIcon}>✕</Text>
            </TouchableOpacity>
          )}
        </View>
      </View>

      {/* Platform Filter Buttons */}
      <View style={styles.platformRow}>
        {PLATFORMS.map((p) => {
          const isActive = selectedPlatform === p.id;
          return (
            <TouchableOpacity
              key={p.id}
              style={[styles.platformBtn, isActive && styles.platformBtnActive]}
              onPress={() => setSelectedPlatform(p.id)}
            >
              <Text style={[styles.platformBtnText, isActive && styles.platformBtnTextActive]}>
                {p.label}
              </Text>
            </TouchableOpacity>
          );
        })}
      </View>

      {/* Category Chips */}
      <View style={styles.categoriesContainer}>
        <ScrollView horizontal showsHorizontalScrollIndicator={false}>
          {CATEGORIES.map((cat) => {
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

      {isLoading ? (
        <View style={styles.loadingContainer}>
          <ActivityIndicator size="large" color="#10b981" />
          <Text style={styles.loadingText}>סורק טרנדים חמים ברשתות החברתיות...</Text>
        </View>
      ) : trends.length === 0 ? (
        <View style={styles.emptyContainer}>
          <Text style={styles.emptyIcon}>🍽️</Text>
          <Text style={[styles.emptyTitle, themeText]}>לא נמצאו טרנדים תואמים</Text>
          <Text style={styles.emptySub}>נסה לבחור קטגוריה אחרת או לנקות את מילות החיפוש</Text>
          <TouchableOpacity style={styles.emptyRetryBtn} onPress={() => fetchTrends(true)}>
            <Text style={styles.emptyRetryText}>🔄 רענן סריקה</Text>
          </TouchableOpacity>
        </View>
      ) : (
        <>
          {/* Featured Hero Banner for #1 Trend */}
          {featuredTrend && (
            <View style={styles.featuredSection}>
              <Text style={styles.sectionTitleHeader}>🏆 מקום 1 השבוע ברשתות</Text>
              <View style={[styles.featuredCard, themeCard]}>
                <View style={styles.featuredImageWrapper}>
                  <Image source={{ uri: featuredTrend.imageUrl }} style={styles.featuredImage} resizeMode="cover" />
                  <View style={styles.featuredGradientOverlay} />

                  <View style={styles.featuredBadgeRow}>
                    <View style={styles.rankBadge}>
                      <Text style={styles.rankBadgeText}>#1 🔥</Text>
                    </View>
                    <View style={[styles.platformTag, { backgroundColor: getPlatformBadge(featuredTrend.platform).color }]}>
                      <Text style={styles.platformTagText}>{getPlatformBadge(featuredTrend.platform).text}</Text>
                    </View>
                  </View>

                  <View style={styles.featuredMetaBottom}>
                    <Text style={styles.featuredViewsText}>👁️ {featuredTrend.viewsCount} • ❤️ {featuredTrend.likesCount}</Text>
                    <Text style={styles.featuredCreatorText}>{featuredTrend.creator}</Text>
                  </View>
                </View>

                <View style={styles.featuredContent}>
                  <Text style={[styles.featuredTitle, themeText]}>{featuredTrend.title}</Text>
                  <Text style={styles.featuredDescription}>{featuredTrend.description}</Text>

                  <View style={styles.featuredButtonsRow}>
                    <TouchableOpacity
                      style={styles.featuredImportBtn}
                      activeOpacity={0.85}
                      onPress={() => handleImportTrend(featuredTrend)}
                    >
                      <Text style={styles.featuredImportBtnText}>✨ חלץ מתכון למאגר שלי</Text>
                    </TouchableOpacity>

                    <TouchableOpacity
                      style={styles.featuredWatchBtn}
                      activeOpacity={0.85}
                      onPress={() => handleOpenSourceUrl(featuredTrend.sourceUrl)}
                    >
                      <Text style={styles.featuredWatchBtnText}>▶️ סרטון מקורי</Text>
                    </TouchableOpacity>
                  </View>
                </View>
              </View>
            </View>
          )}

          {/* Remaining Trending List */}
          {remainingTrends.length > 0 && (
            <View style={styles.trendsSection}>
              <Text style={[styles.sectionTitleHeader, themeText]}>טרנדים ויראליים נוספים ({remainingTrends.length})</Text>

              {remainingTrends.map((trend) => (
                <View key={trend.id} style={[styles.trendCard, themeCard]}>
                  {/* Card Thumbnail */}
                  <View style={styles.trendThumbWrap}>
                    <Image source={{ uri: trend.imageUrl }} style={styles.trendThumb} resizeMode="cover" />
                    <View style={styles.trendThumbRankBadge}>
                      <Text style={styles.trendThumbRankText}>#{trend.rank}</Text>
                    </View>
                    <View style={[styles.trendThumbPlatformBadge, { backgroundColor: getPlatformBadge(trend.platform).color }]}>
                      <Text style={styles.trendThumbPlatformText}>{getPlatformBadge(trend.platform).text}</Text>
                    </View>
                  </View>

                  {/* Card Details */}
                  <View style={styles.trendDetails}>
                    <View style={styles.trendMetaRow}>
                      <Text style={styles.trendCreatorText}>{trend.creator}</Text>
                      <Text style={styles.trendViewsText}>👁️ {trend.viewsCount}</Text>
                    </View>

                    <Text style={[styles.trendTitle, themeText]} numberOfLines={2}>
                      {trend.title}
                    </Text>

                    <Text style={styles.trendDescription} numberOfLines={2}>
                      {trend.description}
                    </Text>

                    {/* Action Buttons */}
                    <View style={styles.trendActionsRow}>
                      <TouchableOpacity
                        style={styles.trendImportBtn}
                        activeOpacity={0.85}
                        onPress={() => handleImportTrend(trend)}
                      >
                        <Text style={styles.trendImportBtnText}>✨ חלץ למאגר</Text>
                      </TouchableOpacity>

                      <TouchableOpacity
                        style={styles.trendViewBtn}
                        activeOpacity={0.8}
                        onPress={() => handleViewRecipe(trend)}
                      >
                        <Text style={styles.trendViewBtnText}>📖 מתכון</Text>
                      </TouchableOpacity>

                      <TouchableOpacity
                        style={styles.trendPlayBtn}
                        activeOpacity={0.8}
                        onPress={() => handleOpenSourceUrl(trend.sourceUrl)}
                      >
                        <Text style={styles.trendPlayBtnText}>▶️ סרטון</Text>
                      </TouchableOpacity>
                    </View>
                  </View>
                </View>
              ))}
            </View>
          )}
        </>
      )}

      <View style={{ height: 40 }} />
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1
  },
  lightContainer: {
    backgroundColor: '#f8fafc'
  },
  darkContainer: {
    backgroundColor: '#090d16'
  },
  lightText: {
    color: '#064e3b'
  },
  darkText: {
    color: '#f8fafc'
  },
  lightCard: {
    backgroundColor: '#ffffff',
    borderColor: '#e2e8f0',
    borderWidth: 1
  },
  darkCard: {
    backgroundColor: '#131c2e',
    borderColor: '#1e293b',
    borderWidth: 1
  },
  header: {
    paddingHorizontal: 18,
    paddingTop: 16,
    paddingBottom: 12
  },
  headerTopRow: {
    flexDirection: 'row-reverse',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 4
  },
  headerTitle: {
    fontSize: 24,
    fontWeight: '900'
  },
  liveIndicator: {
    flexDirection: 'row-reverse',
    alignItems: 'center',
    backgroundColor: '#dcfce7',
    paddingHorizontal: 8,
    paddingVertical: 4,
    borderRadius: 12,
    gap: 5
  },
  liveDot: {
    width: 8,
    height: 8,
    borderRadius: 4,
    backgroundColor: '#10b981'
  },
  liveText: {
    fontSize: 11,
    fontWeight: '800',
    color: '#15803d'
  },
  headerSubtitle: {
    fontSize: 13,
    color: '#64748b',
    textAlign: 'right'
  },
  searchSection: {
    paddingHorizontal: 16,
    marginBottom: 10
  },
  searchBar: {
    flexDirection: 'row-reverse',
    alignItems: 'center',
    backgroundColor: '#ffffff',
    borderRadius: 14,
    paddingHorizontal: 12,
    height: 44,
    borderWidth: 1,
    borderColor: '#e2e8f0'
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
    color: '#0f172a'
  },
  darkSearchInput: {
    color: '#ffffff'
  },
  clearSearchIcon: {
    fontSize: 14,
    color: '#94a3b8',
    paddingHorizontal: 4
  },
  platformRow: {
    flexDirection: 'row-reverse',
    paddingHorizontal: 16,
    gap: 8,
    marginBottom: 10
  },
  platformBtn: {
    flex: 1,
    paddingVertical: 7,
    borderRadius: 10,
    backgroundColor: '#f1f5f9',
    alignItems: 'center',
    justifyContent: 'center'
  },
  platformBtnActive: {
    backgroundColor: '#064e3b'
  },
  platformBtnText: {
    fontSize: 12,
    fontWeight: '600',
    color: '#475569'
  },
  platformBtnTextActive: {
    color: '#ffffff',
    fontWeight: '800'
  },
  categoriesContainer: {
    paddingHorizontal: 14,
    marginBottom: 14
  },
  chip: {
    paddingHorizontal: 14,
    paddingVertical: 6,
    borderRadius: 16,
    backgroundColor: '#ffffff',
    marginRight: 8,
    borderWidth: 1,
    borderColor: '#e2e8f0'
  },
  chipActive: {
    backgroundColor: '#10b981',
    borderColor: '#10b981'
  },
  chipText: {
    fontSize: 13,
    fontWeight: '600',
    color: '#475569'
  },
  chipTextActive: {
    color: '#ffffff',
    fontWeight: '800'
  },
  loadingContainer: {
    paddingVertical: 50,
    alignItems: 'center',
    justifyContent: 'center'
  },
  loadingText: {
    marginTop: 12,
    fontSize: 14,
    color: '#64748b',
    fontWeight: '600'
  },
  emptyContainer: {
    paddingVertical: 50,
    alignItems: 'center',
    justifyContent: 'center',
    paddingHorizontal: 24
  },
  emptyIcon: {
    fontSize: 48,
    marginBottom: 12
  },
  emptyTitle: {
    fontSize: 18,
    fontWeight: '800',
    marginBottom: 6
  },
  emptySub: {
    fontSize: 13,
    color: '#64748b',
    textAlign: 'center',
    marginBottom: 16
  },
  emptyRetryBtn: {
    backgroundColor: '#10b981',
    paddingHorizontal: 18,
    paddingVertical: 10,
    borderRadius: 12
  },
  emptyRetryText: {
    color: '#ffffff',
    fontWeight: '700',
    fontSize: 13
  },
  featuredSection: {
    paddingHorizontal: 16,
    marginBottom: 20
  },
  sectionTitleHeader: {
    fontSize: 16,
    fontWeight: '900',
    marginBottom: 10,
    textAlign: 'right'
  },
  featuredCard: {
    borderRadius: 20,
    overflow: 'hidden',
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.1,
    shadowRadius: 8,
    elevation: 4
  },
  featuredImageWrapper: {
    height: 190,
    position: 'relative'
  },
  featuredImage: {
    width: '100%',
    height: '100%'
  },
  featuredGradientOverlay: {
    position: 'absolute',
    top: 0,
    left: 0,
    right: 0,
    bottom: 0,
    backgroundColor: 'rgba(0,0,0,0.35)'
  },
  featuredBadgeRow: {
    position: 'absolute',
    top: 12,
    right: 12,
    flexDirection: 'row-reverse',
    gap: 8
  },
  rankBadge: {
    backgroundColor: '#f59e0b',
    paddingHorizontal: 10,
    paddingVertical: 4,
    borderRadius: 12
  },
  rankBadgeText: {
    color: '#ffffff',
    fontSize: 12,
    fontWeight: '900'
  },
  platformTag: {
    paddingHorizontal: 10,
    paddingVertical: 4,
    borderRadius: 12
  },
  platformTagText: {
    color: '#ffffff',
    fontSize: 11,
    fontWeight: '700'
  },
  featuredMetaBottom: {
    position: 'absolute',
    bottom: 10,
    right: 12,
    left: 12,
    flexDirection: 'row-reverse',
    justifyContent: 'space-between',
    alignItems: 'center'
  },
  featuredViewsText: {
    color: '#ffffff',
    fontSize: 12,
    fontWeight: '700',
    backgroundColor: 'rgba(0,0,0,0.5)',
    paddingHorizontal: 8,
    paddingVertical: 3,
    borderRadius: 8
  },
  featuredCreatorText: {
    color: '#f8fafc',
    fontSize: 12,
    fontWeight: '600'
  },
  featuredContent: {
    padding: 16
  },
  featuredTitle: {
    fontSize: 18,
    fontWeight: '900',
    textAlign: 'right',
    marginBottom: 6
  },
  featuredDescription: {
    fontSize: 13,
    color: '#64748b',
    textAlign: 'right',
    lineHeight: 19,
    marginBottom: 14
  },
  featuredButtonsRow: {
    flexDirection: 'row-reverse',
    gap: 10
  },
  featuredImportBtn: {
    flex: 1.5,
    backgroundColor: '#10b981',
    paddingVertical: 12,
    borderRadius: 14,
    alignItems: 'center',
    justifyContent: 'center'
  },
  featuredImportBtnText: {
    color: '#ffffff',
    fontWeight: '800',
    fontSize: 14
  },
  featuredWatchBtn: {
    flex: 1,
    backgroundColor: '#f1f5f9',
    paddingVertical: 12,
    borderRadius: 14,
    alignItems: 'center',
    justifyContent: 'center'
  },
  featuredWatchBtnText: {
    color: '#1e293b',
    fontWeight: '700',
    fontSize: 13
  },
  trendsSection: {
    paddingHorizontal: 16
  },
  trendCard: {
    borderRadius: 16,
    overflow: 'hidden',
    marginBottom: 14,
    flexDirection: 'row-reverse',
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.06,
    shadowRadius: 4,
    elevation: 2
  },
  trendThumbWrap: {
    width: 110,
    height: 130,
    position: 'relative'
  },
  trendThumb: {
    width: '100%',
    height: '100%'
  },
  trendThumbRankBadge: {
    position: 'absolute',
    top: 6,
    right: 6,
    backgroundColor: 'rgba(0,0,0,0.7)',
    borderRadius: 8,
    paddingHorizontal: 6,
    paddingVertical: 2
  },
  trendThumbRankText: {
    color: '#f59e0b',
    fontSize: 11,
    fontWeight: '900'
  },
  trendThumbPlatformBadge: {
    position: 'absolute',
    bottom: 6,
    right: 6,
    borderRadius: 6,
    paddingHorizontal: 5,
    paddingVertical: 2
  },
  trendThumbPlatformText: {
    color: '#ffffff',
    fontSize: 9,
    fontWeight: '700'
  },
  trendDetails: {
    flex: 1,
    padding: 10,
    justifyContent: 'space-between'
  },
  trendMetaRow: {
    flexDirection: 'row-reverse',
    justifyContent: 'space-between',
    alignItems: 'center'
  },
  trendCreatorText: {
    fontSize: 11,
    color: '#64748b',
    fontWeight: '600'
  },
  trendViewsText: {
    fontSize: 11,
    color: '#94a3b8'
  },
  trendTitle: {
    fontSize: 14,
    fontWeight: '800',
    textAlign: 'right',
    marginTop: 2
  },
  trendDescription: {
    fontSize: 12,
    color: '#64748b',
    textAlign: 'right',
    lineHeight: 16
  },
  trendActionsRow: {
    flexDirection: 'row-reverse',
    gap: 6,
    marginTop: 6
  },
  trendImportBtn: {
    flex: 1.3,
    backgroundColor: '#10b981',
    paddingVertical: 6,
    borderRadius: 8,
    alignItems: 'center'
  },
  trendImportBtnText: {
    color: '#ffffff',
    fontWeight: '800',
    fontSize: 11
  },
  trendViewBtn: {
    flex: 0.9,
    backgroundColor: '#e0f2fe',
    paddingVertical: 6,
    borderRadius: 8,
    alignItems: 'center'
  },
  trendViewBtnText: {
    color: '#0284c7',
    fontWeight: '700',
    fontSize: 11
  },
  trendPlayBtn: {
    flex: 0.9,
    backgroundColor: '#f1f5f9',
    paddingVertical: 6,
    borderRadius: 8,
    alignItems: 'center'
  },
  trendPlayBtnText: {
    color: '#475569',
    fontWeight: '700',
    fontSize: 11
  }
});
