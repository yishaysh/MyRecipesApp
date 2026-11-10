import React, { useState } from 'react';
import {
  View,
  Text,
  TouchableOpacity,
  Switch,
  ScrollView,
  StyleSheet,
  Alert,
  ActivityIndicator,
  Modal,
  TextInput,
  Linking,
} from 'react-native';
import { useRecipeStore } from '../store/recipeStore';
import { useAuthStore } from '../store/authStore';
import { ApiClient } from '../services/api.client';
import { APP_VERSION_LABEL } from '../constants/version';
import * as Clipboard from 'expo-clipboard';

export function ProfileScreen() {
  const isDarkMode = useRecipeStore((s) => s.isDarkMode);
  const toggleDarkMode = useRecipeStore((s) => s.toggleDarkMode);
  const savedRecipes = useRecipeStore((s) => s.savedRecipes);
  const savedRecipesCount = savedRecipes.length;
  const clearCheckedShopping = useRecipeStore((s) => s.clearCheckedShopping);
  const resetAllData = useRecipeStore((s) => s.resetAllData);
  const setSavedRecipes = useRecipeStore((s) => s.setSavedRecipes);

  const user = useAuthStore((s) => s.user);
  const usage = useAuthStore((s) => s.usage);
  const isSyncing = useAuthStore((s) => s.isSyncing);
  const lastSyncedAt = useAuthStore((s) => s.lastSyncedAt);
  const setAuth = useAuthStore((s) => s.setAuth);
  const logout = useAuthStore((s) => s.logout);
  const syncWithCloud = useAuthStore((s) => s.syncWithCloud);
  const setShowPaywall = useAuthStore((s) => s.setShowPaywall);
  const redeemPromoCode = useAuthStore((s) => s.redeemPromoCode);

  const [language, setLanguage] = useState<'he' | 'en'>('he');
  const [isLoggingIn, setIsLoggingIn] = useState(false);
  const [isPromoModalVisible, setIsPromoModalVisible] = useState(false);
  const [promoCodeInput, setPromoCodeInput] = useState('');
  const [isRedeeming, setIsRedeeming] = useState(false);

  const handleRedeemCode = async () => {
    if (!promoCodeInput.trim()) {
      Alert.alert('קוד חסר', 'נא להזין קוד הטבה או VIP');
      return;
    }
    setIsRedeeming(true);
    const res = await redeemPromoCode(promoCodeInput.trim());
    setIsRedeeming(false);
    if (res.success) {
      setIsPromoModalVisible(false);
      setPromoCodeInput('');
      Alert.alert('שודרגת בהצלחה! 👑🎉', res.message);
    } else {
      Alert.alert('שגיאה', res.message);
    }
  };

  const themeContainer = isDarkMode ? styles.darkContainer : styles.lightContainer;
  const themeText = isDarkMode ? styles.darkText : styles.lightText;
  const themeSubtext = isDarkMode ? styles.darkSubtext : styles.lightSubtext;
  const themeCard = isDarkMode ? styles.darkCard : styles.lightCard;

  const isGoogleLinked = Boolean(
    user &&
    user.email &&
    !user.email.endsWith('@guest.myrecipes.app') &&
    !user.email.includes('guest_')
  );

  const handleGoogleSignIn = async () => {
    setIsLoggingIn(true);
    const bridgeUrl = `${ApiClient.getRootUrl()}/auth/google/mobile-bridge`;

    try {
      console.log('[AUTH_MOBILE] Opening mobile Google auth bridge:', bridgeUrl);
      const canOpen = await Linking.canOpenURL(bridgeUrl).catch(() => true);
      if (canOpen) {
        await Linking.openURL(bridgeUrl);
        return;
      }
      throw new Error(`לא ניתן לפתוח את הדפדפן במכשיר: ${bridgeUrl}`);
    } catch (err: any) {
      console.error('[AUTH_MOBILE_ERROR]', err);
      const fullErrorMsg = `קוד שגיאה: Browser Opening Failure\nפירוט: ${err?.message || 'שגיאה לא ידועה'}\nכתובת יעד: ${bridgeUrl}`;
      Alert.alert(
        'שגיאת התחברות Google',
        `חלה שגיאה בפתיחת מסך ההתחברות של Google:\n\n${err?.message || 'שגיאה לא ידועה'}`,
        [
          { text: 'סגור', style: 'cancel' },
          {
            text: 'העתק פרטים טכניים 📋',
            onPress: async () => {
              await Clipboard.setStringAsync(fullErrorMsg);
              Alert.alert('הועתק ללוח', 'פרטי השגיאה הועתקו ללוח בהצלחה.');
            }
          }
        ]
      );
    } finally {
      setIsLoggingIn(false);
    }
  };

  const handleManualSync = async () => {
    const success = await syncWithCloud(savedRecipes, (merged) => {
      setSavedRecipes(merged);
    });
    if (success) {
      Alert.alert('סנכרון ענן ☁️', 'הסנכרון הצליח! ☁️');
    } else {
      Alert.alert(
        'שגיאה בסנכרון',
        'סנכרון ענן נכשל. אנא ודא חיבור תקין לרשת ונסה שוב.',
        [{ text: 'אישור' }]
      );
    }
  };

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
          <Text style={styles.avatarEmoji}>{user?.isPro ? '👑' : '👨‍🍳'}</Text>
        </View>
        <Text style={[styles.profileName, themeText]}>
          {isGoogleLinked ? (user?.name || 'שף פרטי') : 'שף אורח 👨‍🍳'}
        </Text>
        <Text style={[styles.profileEmail, themeSubtext]}>
          {isGoogleLinked
            ? `${user?.email} • מקושר לענן ☁️`
            : 'חשבון מקומי • התחבר לשמירה וגיבוי בענן ☁️'}
        </Text>

        {/* VIP / Pro Tier or Free Quota Badge */}
        <View style={styles.userBadgeRow}>
          <View style={[styles.tierBadge, user?.isPro ? styles.proTierBadge : styles.freeTierBadge]}>
            <Text style={user?.isPro ? styles.proTierBadgeText : styles.freeTierBadgeText}>
              {user?.proTier === 'family_vip'
                ? 'משפחה וחברים VIP 👑'
                : user?.proTier === 'promo_vip'
                ? 'חבר VIP קוד הטבה 👑'
                : user?.isPro
                ? 'חבר Chef Pro 👑'
                : `${usage ? usage.remaining : 5}/5 חילוצים חינם החודש`}
            </Text>
          </View>
          {isGoogleLinked ? (
            <TouchableOpacity style={styles.logoutBtn} onPress={logout}>
              <Text style={styles.logoutBtnText}>התנתק</Text>
            </TouchableOpacity>
          ) : null}
        </View>

        {!isGoogleLinked && (
          <TouchableOpacity
            style={styles.googleSignInBtn}
            onPress={handleGoogleSignIn}
            disabled={isLoggingIn}
            activeOpacity={0.8}
          >
            {isLoggingIn ? (
              <ActivityIndicator color="#ffffff" size="small" />
            ) : (
              <Text style={styles.googleSignInBtnText}>🔗 התחבר עם חשבון Google</Text>
            )}
          </TouchableOpacity>
        )}

        <View style={styles.statsRow}>
          <View style={styles.statBox}>
            <Text style={styles.statNumber}>{savedRecipesCount}</Text>
            <Text style={[styles.statLabel, themeSubtext]}>מתכונים שנשמרו</Text>
          </View>
          <View style={styles.statDivider} />
          <View style={styles.statBox}>
            <Text style={styles.statNumber}>
              {user?.isPro ? '∞' : `${usage ? usage.remaining : 5}`}
            </Text>
            <Text style={[styles.statLabel, themeSubtext]}>חילוצים חינם החודש</Text>
          </View>
          <View style={styles.statDivider} />
          <View style={styles.statBox}>
            <Text style={styles.statNumber}>Gemini AI</Text>
            <Text style={[styles.statLabel, themeSubtext]}>מנוע חילוץ</Text>
          </View>
        </View>
      </View>

      {/* Pro Membership Promotion Banner */}
      {!user?.isPro && (
        <TouchableOpacity
          style={styles.proBannerCard}
          onPress={() => setShowPaywall(true)}
          activeOpacity={0.85}
        >
          <View style={styles.proBannerContent}>
            <View style={styles.proBannerTextWrap}>
              <View style={styles.proCrownRow}>
                <Text style={styles.proCrownEmoji}>👑</Text>
                <Text style={styles.proBannerTitle}>שדרג ל-Chef Pro</Text>
              </View>
              <Text style={styles.proBannerSubtitle}>
                חילוצים ללא הגבלה, גיבוי ענן אוטומטי ותיוגים חכמים ב-19.90 ₪/חודש
              </Text>
            </View>
            <View style={styles.proUpgradeBadge}>
              <Text style={styles.proUpgradeBadgeText}>שדרג עכשיו ←</Text>
            </View>
          </View>
        </TouchableOpacity>
      )}

      {/* Promo / VIP Code Card */}
      {!user?.isPro && (
        <TouchableOpacity
          style={[styles.promoCodeButton, themeCard]}
          onPress={() => setIsPromoModalVisible(true)}
          activeOpacity={0.8}
        >
          <Text style={styles.promoCodeButtonEmoji}>🎁</Text>
          <View style={styles.promoCodeButtonTextWrap}>
            <Text style={[styles.promoCodeButtonTitle, themeText]}>יש לך קוד הטבה או VIP למשפחה?</Text>
            <Text style={[styles.promoCodeButtonSub, themeSubtext]}>הקש כאן להזנת קוד ולהפעלת מנוי חופשי</Text>
          </View>
          <Text style={styles.promoCodeChevron}>←</Text>
        </TouchableOpacity>
      )}

      {/* VIP Active Card */}
      {user?.isPro && (
        <View style={[styles.vipActiveCard, isDarkMode ? styles.vipActiveCardDark : styles.vipActiveCardLight]}>
          <Text style={styles.vipActiveEmoji}>👑</Text>
          <View style={styles.vipActiveTextWrap}>
            <Text style={styles.vipActiveTitle}>מנוי Chef Pro פעיל ללא הגבלה!</Text>
            <Text style={styles.vipActiveSub}>
              {user.proTier === 'family_vip'
                ? 'גישת VIP בלתי מוגבלת למשפחה וחברים לכל החיים 🌟'
                : user.proTier === 'promo_vip'
                ? 'מופעל באמצעות קוד הטבה VIP ייחודי 🌟'
                : 'נהנה מחילוץ ללא הגבלה וגיבוי ענן אוטומטי 🌟'}
            </Text>
          </View>
        </View>
      )}

      {/* Cloud Sync Section */}
      <Text style={[styles.sectionTitle, themeText]}>גיבוי וסנכרון ענן ☁️</Text>
      <View style={[styles.settingsGroup, themeCard]}>
        <View style={styles.settingItem}>
          <View style={styles.settingLabelRow}>
            <Text style={styles.settingIcon}>☁️</Text>
            <View>
              <Text style={[styles.settingTitle, themeText]}>סטטוס סנכרון ענן</Text>
              <Text style={[styles.settingSub, themeSubtext]}>
                {lastSyncedAt
                  ? `סונכרן לאחרונה: ${new Date(lastSyncedAt).toLocaleTimeString('he-IL', { hour: '2-digit', minute: '2-digit' })}`
                  : 'טרם סונכרן לענן'}
              </Text>
            </View>
          </View>
          <TouchableOpacity
            style={[styles.syncNowBtn, isSyncing && styles.syncNowBtnDisabled]}
            onPress={handleManualSync}
            disabled={isSyncing}
          >
            {isSyncing ? (
              <ActivityIndicator color="#059669" size="small" />
            ) : (
              <Text style={styles.syncNowBtnText}>סנכרן כעת</Text>
            )}
          </TouchableOpacity>
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
              <Text style={[styles.settingSub, themeSubtext]}>פעיל ומחובר (Fastify Backend API)</Text>
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
        <Text style={styles.appInfoText}>Social Recipe Extractor {APP_VERSION_LABEL}</Text>
        <Text style={styles.appInfoSub}>נבנה בטכנולוגיית React Native + Fastify + AI + Neon DB</Text>
      </View>

      {/* Promo Code Entry Modal */}
      <Modal
        visible={isPromoModalVisible}
        transparent
        animationType="fade"
        onRequestClose={() => setIsPromoModalVisible(false)}
      >
        <View style={styles.modalOverlay}>
          <View style={[styles.promoModalBox, isDarkMode ? styles.darkCard : styles.lightCard]}>
            <Text style={styles.promoModalEmoji}>🎁</Text>
            <Text style={[styles.promoModalTitle, themeText]}>הפעלת קוד הטבה / VIP</Text>
            <Text style={[styles.promoModalSubtitle, themeSubtext]}>
              קבל גישה חופשית ללא הגבלה לחילוצי מתכונים, גיבוי ענן אוטומטי וכל תכונות ה-Chef Pro.
            </Text>

            <TextInput
              style={[styles.promoInput, isDarkMode ? styles.promoInputDark : styles.promoInputLight]}
              placeholder="הזן קוד (למשל: FAMILY2026)"
              placeholderTextColor="#94a3b8"
              value={promoCodeInput}
              onChangeText={setPromoCodeInput}
              autoCapitalize="characters"
              autoCorrect={false}
            />

            <View style={styles.promoModalButtons}>
              <TouchableOpacity
                style={[styles.promoSubmitBtn, isRedeeming && styles.disabledBtn]}
                onPress={handleRedeemCode}
                disabled={isRedeeming}
              >
                {isRedeeming ? (
                  <ActivityIndicator color="#ffffff" size="small" />
                ) : (
                  <Text style={styles.promoSubmitBtnText}>הפעל מנוי VIP 🌟</Text>
                )}
              </TouchableOpacity>

              <TouchableOpacity
                style={styles.promoCancelBtn}
                onPress={() => setIsPromoModalVisible(false)}
                disabled={isRedeeming}
              >
                <Text style={styles.promoCancelBtnText}>ביטול</Text>
              </TouchableOpacity>
            </View>
          </View>
        </View>
      </Modal>
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
  lightSubtext: {
    color: '#64748b'
  },
  darkSubtext: {
    color: '#94a3b8'
  },
  profileHeader: {
    borderRadius: 20,
    padding: 20,
    alignItems: 'center',
    marginBottom: 16,
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
    marginTop: 2,
    marginBottom: 14
  },
  userBadgeRow: {
    flexDirection: 'row-reverse',
    alignItems: 'center',
    gap: 10,
    marginBottom: 16,
  },
  tierBadge: {
    paddingHorizontal: 12,
    paddingVertical: 4,
    borderRadius: 12,
  },
  proTierBadge: {
    backgroundColor: '#fef3c7',
    borderWidth: 1,
    borderColor: '#f59e0b',
  },
  proTierBadgeText: {
    color: '#b45309',
    fontSize: 12,
    fontWeight: '800',
  },
  freeTierBadge: {
    backgroundColor: '#ecfdf5',
    borderWidth: 1,
    borderColor: '#34d399',
  },
  freeTierBadgeText: {
    color: '#065f46',
    fontSize: 12,
    fontWeight: '700',
  },
  logoutBtn: {
    paddingHorizontal: 10,
    paddingVertical: 4,
  },
  logoutBtnText: {
    color: '#ef4444',
    fontSize: 12,
    fontWeight: '700',
  },
  googleSignInBtn: {
    backgroundColor: '#059669',
    paddingHorizontal: 18,
    paddingVertical: 10,
    borderRadius: 14,
    marginBottom: 16,
  },
  googleSignInBtnText: {
    color: '#ffffff',
    fontSize: 14,
    fontWeight: '800',
  },
  proBannerCard: {
    backgroundColor: '#fffbeb',
    borderRadius: 18,
    borderWidth: 1.5,
    borderColor: '#f59e0b',
    padding: 16,
    marginBottom: 16,
    shadowColor: '#f59e0b',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.15,
    shadowRadius: 6,
    elevation: 3,
  },
  proBannerContent: {
    flexDirection: 'row-reverse',
    alignItems: 'center',
    justifyContent: 'space-between',
  },
  proBannerTextWrap: {
    flex: 1,
    alignItems: 'flex-end',
    marginLeft: 10,
  },
  proCrownRow: {
    flexDirection: 'row-reverse',
    alignItems: 'center',
  },
  proCrownEmoji: {
    fontSize: 18,
    marginLeft: 6,
  },
  proBannerTitle: {
    fontSize: 16,
    fontWeight: '800',
    color: '#92400e',
  },
  proBannerSubtitle: {
    fontSize: 12,
    color: '#78350f',
    textAlign: 'right',
    marginTop: 4,
    lineHeight: 16,
  },
  proUpgradeBadge: {
    backgroundColor: '#f59e0b',
    paddingHorizontal: 12,
    paddingVertical: 8,
    borderRadius: 12,
  },
  proUpgradeBadgeText: {
    color: '#ffffff',
    fontSize: 13,
    fontWeight: '800',
  },
  syncNowBtn: {
    paddingHorizontal: 12,
    paddingVertical: 6,
    borderRadius: 10,
    backgroundColor: '#ecfdf5',
    borderWidth: 1,
    borderColor: '#34d399',
  },
  syncNowBtnDisabled: {
    opacity: 0.5,
  },
  syncNowBtnText: {
    color: '#059669',
    fontSize: 12,
    fontWeight: '700',
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
  },
  promoCodeButton: {
    flexDirection: 'row-reverse',
    alignItems: 'center',
    padding: 14,
    borderRadius: 16,
    marginBottom: 14,
    gap: 12,
  },
  promoCodeButtonEmoji: {
    fontSize: 24,
  },
  promoCodeButtonTextWrap: {
    flex: 1,
    alignItems: 'flex-end',
  },
  promoCodeButtonTitle: {
    fontSize: 14,
    fontWeight: '700',
    textAlign: 'right',
  },
  promoCodeButtonSub: {
    fontSize: 12,
    marginTop: 2,
    textAlign: 'right',
  },
  promoCodeChevron: {
    fontSize: 16,
    color: '#f59e0b',
    fontWeight: '800',
  },
  vipActiveCard: {
    flexDirection: 'row-reverse',
    alignItems: 'center',
    padding: 16,
    borderRadius: 16,
    marginBottom: 14,
    borderWidth: 1.5,
    borderColor: '#f59e0b',
    gap: 12,
  },
  vipActiveCardLight: {
    backgroundColor: '#fffbeb',
  },
  vipActiveCardDark: {
    backgroundColor: '#1e293b',
  },
  vipActiveEmoji: {
    fontSize: 26,
  },
  vipActiveTextWrap: {
    flex: 1,
    alignItems: 'flex-end',
  },
  vipActiveTitle: {
    fontSize: 15,
    fontWeight: '800',
    color: '#f59e0b',
    textAlign: 'right',
  },
  vipActiveSub: {
    fontSize: 12,
    color: '#64748b',
    marginTop: 2,
    textAlign: 'right',
  },
  modalOverlay: {
    flex: 1,
    backgroundColor: 'rgba(0,0,0,0.6)',
    justifyContent: 'center',
    alignItems: 'center',
    padding: 24,
  },
  promoModalBox: {
    width: '100%',
    borderRadius: 24,
    padding: 24,
    alignItems: 'center',
  },
  promoModalEmoji: {
    fontSize: 40,
    marginBottom: 10,
  },
  promoModalTitle: {
    fontSize: 18,
    fontWeight: '800',
    textAlign: 'center',
    marginBottom: 6,
  },
  promoModalSubtitle: {
    fontSize: 13,
    textAlign: 'center',
    marginBottom: 18,
    lineHeight: 18,
  },
  promoInput: {
    width: '100%',
    height: 48,
    borderRadius: 14,
    borderWidth: 1.5,
    paddingHorizontal: 14,
    textAlign: 'center',
    fontWeight: '800',
    fontSize: 16,
    letterSpacing: 2,
    marginBottom: 16,
  },
  promoInputLight: {
    backgroundColor: '#f8fafc',
    borderColor: '#cbd5e1',
    color: '#0f172a',
  },
  promoInputDark: {
    backgroundColor: '#0f172a',
    borderColor: '#334155',
    color: '#f8fafc',
  },
  promoModalButtons: {
    width: '100%',
    gap: 8,
  },
  promoSubmitBtn: {
    backgroundColor: '#10b981',
    width: '100%',
    height: 46,
    borderRadius: 14,
    justifyContent: 'center',
    alignItems: 'center',
  },
  promoSubmitBtnText: {
    color: '#ffffff',
    fontWeight: '800',
    fontSize: 15,
  },
  promoCancelBtn: {
    width: '100%',
    height: 40,
    justifyContent: 'center',
    alignItems: 'center',
  },
  promoCancelBtnText: {
    color: '#94a3b8',
    fontWeight: '700',
    fontSize: 14,
  },
  disabledBtn: {
    opacity: 0.6,
  },
});
