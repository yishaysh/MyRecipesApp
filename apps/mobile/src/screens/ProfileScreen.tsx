import React, { useState } from 'react';
import {
  View,
  Text,
  TouchableOpacity,
  Switch,
  ScrollView,
  StyleSheet,
  Alert
} from 'react-native';
import { useRecipeStore } from '../store/recipeStore';

export function ProfileScreen() {
  const isDarkMode = useRecipeStore((s) => s.isDarkMode);
  const toggleDarkMode = useRecipeStore((s) => s.toggleDarkMode);
  const savedRecipesCount = useRecipeStore((s) => s.savedRecipes.length);
  const clearCheckedShopping = useRecipeStore((s) => s.clearCheckedShopping);
  const resetAllData = useRecipeStore((s) => s.resetAllData);

  const [language, setLanguage] = useState<'he' | 'en'>('he');

  const themeContainer = isDarkMode ? styles.darkContainer : styles.lightContainer;
  const themeText = isDarkMode ? styles.darkText : styles.lightText;
  const themeCard = isDarkMode ? styles.darkCard : styles.lightCard;

  const handleClearShopping = () => {
    clearCheckedShopping();
    Alert.alert('ניקוי הושלם', 'רשימת הקניות נוקתה בהצלחה');
  };

  const handleResetApp = () => {
    Alert.alert(
      'איפוס מלא של האפליקציה',
      'האם אתה בטוח שברצונך למחוק את כל המתכונים והנתונים מהמכשיר?',
      [
        { text: 'ביטול', style: 'cancel' },
        {
          text: 'אפס הכל',
          style: 'destructive',
          onPress: () => {
            resetAllData();
            Alert.alert('איפוס הושלם ✨', 'כל המתכונים נמחקו והאפליקציה אופסה בהצלחה!');
          }
        }
      ]
    );
  };

  return (
    <ScrollView style={[styles.container, themeContainer]} showsVerticalScrollIndicator={false}>
      {/* Profile Card Header */}
      <View style={[styles.profileHeader, themeCard]}>
        <View style={styles.avatarContainer}>
          <Text style={styles.avatarEmoji}>👨‍🍳</Text>
        </View>
        <Text style={[styles.profileName, themeText]}>שף המטבח שלי</Text>
        <Text style={styles.profileEmail}>chef@myrecipes.app</Text>

        <View style={styles.statsRow}>
          <View style={styles.statBox}>
            <Text style={styles.statNumber}>{savedRecipesCount}</Text>
            <Text style={styles.statLabel}>מתכונים שנשמרו</Text>
          </View>
          <View style={styles.statDivider} />
          <View style={styles.statBox}>
            <Text style={styles.statNumber}>Gemini AI</Text>
            <Text style={styles.statLabel}>מנוע חילוץ</Text>
          </View>
        </View>
      </View>

      {/* General Settings */}
      <Text style={[styles.sectionTitle, themeText]}>הגדרות אפליקציה</Text>

      <View style={[styles.settingsGroup, themeCard]}>
        {/* Dark Mode Toggle */}
        <View style={styles.settingItem}>
          <View style={styles.settingLabelRow}>
            <Text style={styles.settingIcon}>🌙</Text>
            <Text style={[styles.settingTitle, themeText]}>מצב כהה (Dark Mode)</Text>
          </View>
          <Switch
            value={isDarkMode}
            onValueChange={toggleDarkMode}
            trackColor={{ false: '#cbd5e1', true: '#34d399' }}
            thumbColor={isDarkMode ? '#059669' : '#f8fafc'}
          />
        </View>

        <View style={styles.divider} />

        {/* Language Selection */}
        <View style={styles.settingItem}>
          <View style={styles.settingLabelRow}>
            <Text style={styles.settingIcon}>🌐</Text>
            <Text style={[styles.settingTitle, themeText]}>שפת הממשק</Text>
          </View>
          <View style={styles.langPicker}>
            <TouchableOpacity
              style={[styles.langBtn, language === 'he' && styles.langBtnActive]}
              onPress={() => setLanguage('he')}
            >
              <Text style={[styles.langBtnText, language === 'he' && styles.langBtnTextActive]}>
                עברית
              </Text>
            </TouchableOpacity>
            <TouchableOpacity
              style={[styles.langBtn, language === 'en' && styles.langBtnActive]}
              onPress={() => setLanguage('en')}
            >
              <Text style={[styles.langBtnText, language === 'en' && styles.langBtnTextActive]}>
                English
              </Text>
            </TouchableOpacity>
          </View>
        </View>
      </View>

      {/* AI & Data Settings */}
      <Text style={[styles.sectionTitle, themeText]}>מנוע AI ונתונים</Text>

      <View style={[styles.settingsGroup, themeCard]}>
        <View style={styles.settingItem}>
          <View style={styles.settingLabelRow}>
            <Text style={styles.settingIcon}>🤖</Text>
            <View>
              <Text style={[styles.settingTitle, themeText]}>מפתח Gemini API</Text>
              <Text style={styles.settingSub}>פעיל ומחובר (Fastify Backend API)</Text>
            </View>
          </View>
          <View style={styles.statusBadge}>
            <Text style={styles.statusBadgeText}>פעיל ✓</Text>
          </View>
        </View>

        <View style={styles.divider} />

        <TouchableOpacity style={styles.settingItem} onPress={handleClearShopping}>
          <View style={styles.settingLabelRow}>
            <Text style={styles.settingIcon}>🧹</Text>
            <Text style={[styles.settingTitle, { color: '#ef4444' }]}>
              איפוס וניקוי רשימת קניות
            </Text>
          </View>
          <Text style={styles.chevron}>›</Text>
        </TouchableOpacity>
        <View style={styles.divider} />

        <TouchableOpacity style={styles.settingItem} onPress={handleResetApp}>
          <View style={styles.settingLabelRow}>
            <Text style={styles.settingIcon}>🗑️</Text>
            <Text style={[styles.settingTitle, { color: '#dc2626', fontWeight: '700' }]}>
              איפוס מלא ומחיקת כל המתכונים
            </Text>
          </View>
          <Text style={styles.chevron}>›</Text>
        </TouchableOpacity>
      </View>

      {/* App Info */}
      <View style={styles.appInfoContainer}>
        <Text style={styles.appInfoText}>Social Recipe Extractor v1.1.0 (Build 8)</Text>
        <Text style={styles.appInfoSub}>נבנה בטכנולוגיית React Native + Fastify + AI</Text>
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
  profileHeader: {
    borderRadius: 20,
    padding: 20,
    alignItems: 'center',
    marginBottom: 20,
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
  avatarContainer: {
    width: 72,
    height: 72,
    borderRadius: 36,
    backgroundColor: '#a8e6cf',
    justifyContent: 'center',
    alignItems: 'center',
    marginBottom: 10
  },
  avatarEmoji: {
    fontSize: 36
  },
  profileName: {
    fontSize: 20,
    fontWeight: '800'
  },
  profileEmail: {
    fontSize: 13,
    color: '#64748b',
    marginTop: 2,
    marginBottom: 16
  },
  statsRow: {
    flexDirection: 'row-reverse',
    width: '100%',
    justifyContent: 'space-around',
    borderTopWidth: 1,
    borderTopColor: '#f1f5f9',
    paddingTop: 14
  },
  statBox: {
    alignItems: 'center'
  },
  statNumber: {
    fontSize: 18,
    fontWeight: '800',
    color: '#059669'
  },
  statLabel: {
    fontSize: 11,
    color: '#64748b',
    marginTop: 2
  },
  statDivider: {
    width: 1,
    backgroundColor: '#e2e8f0'
  },
  sectionTitle: {
    fontSize: 16,
    fontWeight: '800',
    marginBottom: 10
  },
  settingsGroup: {
    borderRadius: 16,
    paddingHorizontal: 16,
    marginBottom: 20
  },
  settingItem: {
    flexDirection: 'row-reverse',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingVertical: 14
  },
  settingLabelRow: {
    flexDirection: 'row-reverse',
    alignItems: 'center'
  },
  settingIcon: {
    fontSize: 18,
    marginLeft: 10
  },
  settingTitle: {
    fontSize: 14,
    fontWeight: '700'
  },
  settingSub: {
    fontSize: 11,
    color: '#64748b',
    marginTop: 1
  },
  divider: {
    height: 1,
    backgroundColor: '#f1f5f9'
  },
  langPicker: {
    flexDirection: 'row',
    backgroundColor: '#f1f5f9',
    borderRadius: 10,
    padding: 2
  },
  langBtn: {
    paddingHorizontal: 10,
    paddingVertical: 4,
    borderRadius: 8
  },
  langBtnActive: {
    backgroundColor: '#34d399'
  },
  langBtnText: {
    fontSize: 12,
    color: '#64748b',
    fontWeight: '600'
  },
  langBtnTextActive: {
    color: '#ffffff',
    fontWeight: '700'
  },
  statusBadge: {
    backgroundColor: '#d1fae5',
    paddingHorizontal: 8,
    paddingVertical: 3,
    borderRadius: 8
  },
  statusBadgeText: {
    color: '#059669',
    fontSize: 11,
    fontWeight: '700'
  },
  chevron: {
    fontSize: 18,
    color: '#94a3b8'
  },
  appInfoContainer: {
    alignItems: 'center',
    paddingVertical: 20
  },
  appInfoText: {
    fontSize: 12,
    color: '#94a3b8',
    fontWeight: '600'
  },
  appInfoSub: {
    fontSize: 11,
    color: '#cbd5e1',
    marginTop: 2
  }
});
