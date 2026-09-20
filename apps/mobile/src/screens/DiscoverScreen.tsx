import React from 'react';
import {
  View,
  Text,
  ScrollView,
  Image,
  TouchableOpacity,
  StyleSheet,
  Dimensions
} from 'react-native';
import { useRecipeStore } from '../store/recipeStore';
import { StructuredRecipe } from '@myrecipes/shared';

const { width } = Dimensions.get('window');

const TRENDING_DISCOVERIES: Partial<StructuredRecipe>[] = [
  {
    id: 'disc-1',
    title: 'סלט קינואה ועשבי תיבול מרענן',
    description: 'סלט ים-תיכוני בריא עם קינואה מבושלת, מלפפונים, עגבניות שרי, חמוציות ולימון סחוט.',
    platform: 'instagram',
    imageUrl: 'https://images.unsplash.com/photo-1512621776951-a57141f2eefd?w=600&auto=format&fit=crop',
    totalTimeMinutes: 15,
    category: 'בריא'
  },
  {
    id: 'disc-2',
    title: 'קערת אסאי ופירות יער משגעת',
    description: 'סופרפוד מרענן לפתיחת הבוקר עם בננות קפואות, גרנולה קראנצ׳ית וזילוף דבש.',
    platform: 'tiktok',
    imageUrl: 'https://images.unsplash.com/photo-1590301157890-4810ed352733?w=600&auto=format&fit=crop',
    totalTimeMinutes: 10,
    category: 'קינוחים'
  },
  {
    id: 'disc-3',
    title: 'המבורגר עסיסי בלחמניה בריוש',
    description: 'קציצת בקר איכותית נצלית על מחבת פסים עם גבינת צ׳דר נמסה ורוטב סודי.',
    platform: 'youtube',
    imageUrl: 'https://images.unsplash.com/photo-1568901346375-23c9450c58cd?w=600&auto=format&fit=crop',
    totalTimeMinutes: 30,
    category: 'בשר'
  }
];

export function DiscoverScreen() {
  const saveRecipe = useRecipeStore((s) => s.saveRecipe);
  const setCurrentRecipe = useRecipeStore((s) => s.setCurrentRecipe);
  const setActiveTab = useRecipeStore((s) => s.setActiveTab);
  const isDarkMode = useRecipeStore((s) => s.isDarkMode);

  const handleSaveDiscovery = (disc: Partial<StructuredRecipe>) => {
    const fullRecipe: StructuredRecipe = {
      id: disc.id || `disc-${Date.now()}`,
      title: disc.title || 'מתכון מומלץ',
      description: disc.description || '',
      sourceUrl: 'https://instagram.com',
      platform: disc.platform || 'instagram',
      imageUrl: disc.imageUrl,
      category: disc.category,
      servings: 2,
      prepTimeMinutes: 10,
      cookTimeMinutes: 10,
      totalTimeMinutes: disc.totalTimeMinutes || 20,
      ingredients: [
        { id: 'di1', name: 'מצרך מומלץ 1', amount: 1, unit: 'יחידה', category: 'produce', originalText: 'מצרך טרי' },
        { id: 'di2', name: 'מצרך מומלץ 2', amount: 2, unit: 'כפות', category: 'pantry', originalText: 'תבלין איכותי' }
      ],
      instructions: [
        { stepNumber: 1, instruction: 'מכינים את הרכיבים בקערה מרכזית.' },
        { stepNumber: 2, instruction: 'מערבבים היטב ומגישים צונן או חם.' }
      ],
      shoppingList: [
        { category: 'produce', items: ['מצרך טרי'] },
        { category: 'pantry', items: ['תבלין איכותי'] }
      ],
      tags: ['מומלץ', 'גילוי'],
      createdAt: new Date().toISOString()
    };

    saveRecipe(fullRecipe);
    setCurrentRecipe(fullRecipe);
    setActiveTab('recipe');
  };

  const themeContainer = isDarkMode ? styles.darkContainer : styles.lightContainer;
  const themeText = isDarkMode ? styles.darkText : styles.lightText;
  const themeCard = isDarkMode ? styles.darkCard : styles.lightCard;

  return (
    <ScrollView style={[styles.container, themeContainer]} showsVerticalScrollIndicator={false}>
      {/* Header */}
      <View style={styles.header}>
        <Text style={[styles.headerTitle, themeText]}>גילוי מתכונים 🧭</Text>
        <Text style={styles.headerSubtitle}>
          טרנדים קולינריים מובילים מאינסטגרם וטיקטוק בלחיצת כפתור
        </Text>
      </View>

      {/* Featured Banner */}
      <View style={styles.banner}>
        <Image
          source={{
            uri: 'https://images.unsplash.com/photo-1555396273-367ea4eb4db5?w=800&auto=format&fit=crop'
          }}
          style={styles.bannerImage}
        />
        <View style={styles.bannerOverlay}>
          <Text style={styles.bannerBadge}>🔥 הטרנד החם של השבוע</Text>
          <Text style={styles.bannerTitle}>סודות הטיגון האסייתי</Text>
          <Text style={styles.bannerSub}>5 מתכונים מנצחים שמכינים ב-10 דקות</Text>
        </View>
      </View>

      {/* Section Title */}
      <Text style={[styles.sectionTitle, themeText]}>מתכונים מומלצים עבורך</Text>

      {/* Trending List */}
      <View style={styles.list}>
        {TRENDING_DISCOVERIES.map((disc) => (
          <View key={disc.id} style={[styles.card, themeCard]}>
            <Image source={{ uri: disc.imageUrl }} style={styles.cardImage} />
            <View style={styles.cardContent}>
              <View style={styles.cardHeaderRow}>
                <Text style={styles.categoryBadge}>{disc.category}</Text>
                <Text style={styles.timeBadge}>⏱️ {disc.totalTimeMinutes} דק׳</Text>
              </View>
              <Text style={[styles.cardTitle, themeText]}>{disc.title}</Text>
              <Text style={styles.cardDesc} numberOfLines={2}>
                {disc.description}
              </Text>
              <TouchableOpacity
                style={styles.saveBtn}
                onPress={() => handleSaveDiscovery(disc)}
              >
                <Text style={styles.saveBtnText}>+ שמור למתכונים שלי</Text>
              </TouchableOpacity>
            </View>
          </View>
        ))}
      </View>
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    paddingHorizontal: 18,
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
    marginBottom: 16
  },
  headerTitle: {
    fontSize: 26,
    fontWeight: '800'
  },
  headerSubtitle: {
    fontSize: 13,
    color: '#64748b',
    marginTop: 4
  },
  banner: {
    height: 160,
    borderRadius: 20,
    overflow: 'hidden',
    marginBottom: 20,
    position: 'relative'
  },
  bannerImage: {
    width: '100%',
    height: '100%'
  },
  bannerOverlay: {
    position: 'absolute',
    top: 0,
    left: 0,
    right: 0,
    bottom: 0,
    backgroundColor: 'rgba(0,0,0,0.45)',
    padding: 16,
    justifyContent: 'flex-end'
  },
  bannerBadge: {
    color: '#34d399',
    fontSize: 12,
    fontWeight: '800',
    marginBottom: 4
  },
  bannerTitle: {
    color: '#ffffff',
    fontSize: 20,
    fontWeight: '800'
  },
  bannerSub: {
    color: '#e2e8f0',
    fontSize: 12,
    marginTop: 2
  },
  sectionTitle: {
    fontSize: 18,
    fontWeight: '800',
    marginBottom: 14
  },
  list: {
    paddingBottom: 30
  },
  card: {
    flexDirection: 'row-reverse',
    borderRadius: 18,
    marginBottom: 16,
    overflow: 'hidden',
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.05,
    shadowRadius: 6,
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
  cardImage: {
    width: 110,
    height: 120
  },
  cardContent: {
    flex: 1,
    padding: 12,
    justifyContent: 'space-between'
  },
  cardHeaderRow: {
    flexDirection: 'row-reverse',
    justifyContent: 'space-between'
  },
  categoryBadge: {
    color: '#059669',
    backgroundColor: '#d1fae5',
    paddingHorizontal: 8,
    paddingVertical: 2,
    borderRadius: 8,
    fontSize: 10,
    fontWeight: '700'
  },
  timeBadge: {
    fontSize: 11,
    color: '#64748b'
  },
  cardTitle: {
    fontSize: 14,
    fontWeight: '700',
    marginTop: 4
  },
  cardDesc: {
    fontSize: 12,
    color: '#64748b',
    marginTop: 2
  },
  saveBtn: {
    backgroundColor: '#a8e6cf',
    paddingVertical: 6,
    borderRadius: 10,
    alignItems: 'center',
    marginTop: 6
  },
  saveBtnText: {
    color: '#064e3b',
    fontSize: 12,
    fontWeight: '700'
  }
});
