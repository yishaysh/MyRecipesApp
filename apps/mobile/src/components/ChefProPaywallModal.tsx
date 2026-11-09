import React, { useState } from 'react';
import {
  Modal,
  View,
  Text,
  TouchableOpacity,
  StyleSheet,
  ScrollView,
  ActivityIndicator,
  Alert,
} from 'react-native';
import { useAuthStore } from '../store/authStore';
import { useRecipeStore } from '../store/recipeStore';

export function ChefProPaywallModal() {
  const showPaywall = useAuthStore((s) => s.showPaywall);
  const setShowPaywall = useAuthStore((s) => s.setShowPaywall);
  const isDarkMode = useRecipeStore((s) => s.isDarkMode);
  const user = useAuthStore((s) => s.user);
  const usage = useAuthStore((s) => s.usage);

  const [selectedPlan, setSelectedPlan] = useState<'monthly' | 'yearly'>('yearly');
  const [isProcessing, setIsProcessing] = useState(false);

  const themeContainer = isDarkMode ? styles.darkModal : styles.lightModal;
  const themeText = isDarkMode ? styles.darkText : styles.lightText;
  const themeSubtext = isDarkMode ? styles.darkSubtext : styles.lightSubtext;

  const handleSubscribe = async () => {
    setIsProcessing(true);
    // In Phase 1: Simulate purchase completion & upgrade user session
    setTimeout(() => {
      setIsProcessing(false);
      setShowPaywall(false);

      const currentUser = useAuthStore.getState().user;
      const updatedUser = {
        id: currentUser?.id || 'usr_chef_pro',
        email: currentUser?.email || 'chef@myrecipes.app',
        name: currentUser?.name || 'שף מוביל',
        isPro: true,
        proTier: selectedPlan,
      };

      useAuthStore.setState({
        user: updatedUser,
        usage: {
          allowed: true,
          remaining: 9999,
          totalLimit: 9999,
          used: 0,
          isPro: true,
          period: 'unlimited',
        },
      });

      Alert.alert(
        'ברוך הבא ל-Chef Pro! 👑✨',
        'המנוי שלך הופעל בהצלחה. כעת תוכל לחלץ מתכונים ללא כל הגבלה ולסנכרן את כל האוסף לענן!',
        [{ text: 'איזה כיף, תודה!', style: 'default' }]
      );
    }, 1200);
  };

  const handleRestore = () => {
    Alert.alert('שחזור רכישות', 'לא נמצאו מנויים קודמים המשויכים לחשבון זה בחנות.');
  };

  return (
    <Modal
      visible={showPaywall}
      animationType="slide"
      transparent={true}
      onRequestClose={() => setShowPaywall(false)}
    >
      <View style={styles.overlay}>
        <View style={[styles.modalCard, themeContainer]}>
          {/* Close Button */}
          <TouchableOpacity
            style={styles.closeBtn}
            onPress={() => setShowPaywall(false)}
            hitSlop={{ top: 12, bottom: 12, left: 12, right: 12 }}
          >
            <Text style={[styles.closeBtnText, themeSubtext]}>✕</Text>
          </TouchableOpacity>

          <ScrollView showsVerticalScrollIndicator={false} contentContainerStyle={styles.scrollContent}>
            {/* Header Badge */}
            <View style={styles.badgeRow}>
              <View style={styles.crownBadge}>
                <Text style={styles.crownEmoji}>👑</Text>
              </View>
            </View>

            <Text style={[styles.title, themeText]}>שדרג ל-Chef Pro</Text>
            <Text style={[styles.subtitle, themeSubtext]}>
              {usage && !usage.allowed
                ? 'מיצית את מכסת 5 החילוצים החינמית לחודש זה. פתח גישה בלתי מוגבלת עכשיו!'
                : 'הפוך את ספר המתכונים שלך למקצועי עם חילוצים וגיבוי ענן ללא הגבלה'}
            </Text>

            {/* Feature List */}
            <View style={styles.featureList}>
              <View style={styles.featureItem}>
                <Text style={styles.featureIcon}>⚡</Text>
                <View style={styles.featureTexts}>
                  <Text style={[styles.featureTitle, themeText]}>חילוץ מתכונים ללא הגבלה</Text>
                  <Text style={[styles.featureDesc, themeSubtext]}>חלץ מטיקטוק, אינסטגרם ויוטיוב ללא מגבלה חודשית</Text>
                </View>
              </View>

              <View style={styles.featureItem}>
                <Text style={styles.featureIcon}>☁️</Text>
                <View style={styles.featureTexts}>
                  <Text style={[styles.featureTitle, themeText]}>גיבוי וסנכרון ענן אוטומטי</Text>
                  <Text style={[styles.featureDesc, themeSubtext]}>המתכונים שלך שמורים בבטחה ונגישים מכל מכשיר</Text>
                </View>
              </View>

              <View style={styles.featureItem}>
                <Text style={styles.featureIcon}>🏷️</Text>
                <View style={styles.featureTexts}>
                  <Text style={[styles.featureTitle, themeText]}>תיוג וסינון אישי חכם</Text>
                  <Text style={[styles.featureDesc, themeSubtext]}>ניהול תגיות ומועדפים ללא הגבלת כמות</Text>
                </View>
              </View>

              <View style={styles.featureItem}>
                <Text style={styles.featureIcon}>🚀</Text>
                <View style={styles.featureTexts}>
                  <Text style={[styles.featureTitle, themeText]}>עיבוד מהיר מבוסס AI מתקדם</Text>
                  <Text style={[styles.featureDesc, themeSubtext]}>עדיפות עליונה בשרתים ותגובה מיידית מהמטמון</Text>
                </View>
              </View>
            </View>

            {/* Pricing Tiers */}
            <View style={styles.planSelector}>
              {/* Yearly Plan (Best Value) */}
              <TouchableOpacity
                style={[
                  styles.planCard,
                  selectedPlan === 'yearly' && styles.planCardActive,
                  isDarkMode && styles.planCardDark,
                  selectedPlan === 'yearly' && isDarkMode && styles.planCardActiveDark,
                ]}
                onPress={() => setSelectedPlan('yearly')}
                activeOpacity={0.8}
              >
                <View style={styles.bestValueBadge}>
                  <Text style={styles.bestValueText}>הכי משתלם • 37% הנחה 🔥</Text>
                </View>
                <View style={styles.planHeader}>
                  <Text style={[styles.planPeriod, themeText]}>מנוי שנתי</Text>
                  <Text style={styles.planPrice}>149.90 ₪</Text>
                </View>
                <Text style={[styles.planSub, themeSubtext]}>רק 12.50 ₪ לחודש • חיוב שנתי</Text>
              </TouchableOpacity>

              {/* Monthly Plan */}
              <TouchableOpacity
                style={[
                  styles.planCard,
                  selectedPlan === 'monthly' && styles.planCardActive,
                  isDarkMode && styles.planCardDark,
                  selectedPlan === 'monthly' && isDarkMode && styles.planCardActiveDark,
                ]}
                onPress={() => setSelectedPlan('monthly')}
                activeOpacity={0.8}
              >
                <View style={styles.planHeader}>
                  <Text style={[styles.planPeriod, themeText]}>מנוי חודשי</Text>
                  <Text style={styles.planPrice}>19.90 ₪</Text>
                </View>
                <Text style={[styles.planSub, themeSubtext]}>גמיש לחלוטין • ניתן לביטול בכל עת</Text>
              </TouchableOpacity>
            </View>

            {/* CTA Button */}
            <TouchableOpacity
              style={styles.ctaButton}
              onPress={handleSubscribe}
              disabled={isProcessing}
              activeOpacity={0.85}
            >
              {isProcessing ? (
                <ActivityIndicator color="#ffffff" size="small" />
              ) : (
                <Text style={styles.ctaButtonText}>
                  {selectedPlan === 'yearly' ? 'התחל שבוע ניסיון חינם 👑' : 'שדרג עכשיו ל-Chef Pro'}
                </Text>
              )}
            </TouchableOpacity>

            {/* Trial & Guarantee Subtext */}
            <Text style={styles.guaranteeText}>
              7 ימי ניסיון חינם • ללא התחייבות • ביטול בכל עת בהגדרות החשבון
            </Text>

            {/* Restore Purchase */}
            <TouchableOpacity style={styles.restoreBtn} onPress={handleRestore}>
              <Text style={styles.restoreBtnText}>שחזר רכישות קודמות</Text>
            </TouchableOpacity>
          </ScrollView>
        </View>
      </View>
    </Modal>
  );
}

const styles = StyleSheet.create({
  overlay: {
    flex: 1,
    backgroundColor: 'rgba(0,0,0,0.65)',
    justifyContent: 'flex-end',
  },
  modalCard: {
    borderTopLeftRadius: 28,
    borderTopRightRadius: 28,
    paddingHorizontal: 22,
    paddingTop: 16,
    paddingBottom: 32,
    maxHeight: '90%',
  },
  lightModal: {
    backgroundColor: '#ffffff',
  },
  darkModal: {
    backgroundColor: '#1e293b',
  },
  scrollContent: {
    alignItems: 'center',
    paddingBottom: 20,
  },
  closeBtn: {
    position: 'absolute',
    top: 16,
    left: 20,
    zIndex: 10,
    padding: 6,
  },
  closeBtnText: {
    fontSize: 22,
    fontWeight: 'bold',
  },
  badgeRow: {
    marginTop: 10,
    marginBottom: 8,
  },
  crownBadge: {
    width: 60,
    height: 60,
    borderRadius: 30,
    backgroundColor: '#fef3c7',
    justifyContent: 'center',
    alignItems: 'center',
    borderWidth: 2,
    borderColor: '#f59e0b',
  },
  crownEmoji: {
    fontSize: 32,
  },
  title: {
    fontSize: 24,
    fontWeight: '800',
    textAlign: 'center',
    marginTop: 6,
  },
  subtitle: {
    fontSize: 14,
    textAlign: 'center',
    marginTop: 6,
    lineHeight: 20,
    paddingHorizontal: 12,
  },
  lightText: {
    color: '#0f172a',
  },
  darkText: {
    color: '#f8fafc',
  },
  lightSubtext: {
    color: '#64748b',
  },
  darkSubtext: {
    color: '#94a3b8',
  },
  featureList: {
    width: '100%',
    marginVertical: 18,
    gap: 12,
  },
  featureItem: {
    flexDirection: 'row-reverse',
    alignItems: 'center',
    backgroundColor: '#f8fafc',
    padding: 12,
    borderRadius: 14,
  },
  featureIcon: {
    fontSize: 22,
    marginLeft: 12,
  },
  featureTexts: {
    flex: 1,
    alignItems: 'flex-end',
  },
  featureTitle: {
    fontSize: 15,
    fontWeight: '700',
    textAlign: 'right',
  },
  featureDesc: {
    fontSize: 12,
    textAlign: 'right',
    marginTop: 2,
  },
  planSelector: {
    width: '100%',
    gap: 12,
    marginVertical: 8,
  },
  planCard: {
    borderWidth: 2,
    borderColor: '#e2e8f0',
    borderRadius: 16,
    padding: 14,
    backgroundColor: '#ffffff',
    position: 'relative',
  },
  planCardDark: {
    backgroundColor: '#0f172a',
    borderColor: '#334155',
  },
  planCardActive: {
    borderColor: '#f59e0b',
    backgroundColor: '#fffbeb',
  },
  planCardActiveDark: {
    borderColor: '#f59e0b',
    backgroundColor: '#1e293b',
  },
  bestValueBadge: {
    position: 'absolute',
    top: -11,
    left: 14,
    backgroundColor: '#f59e0b',
    paddingHorizontal: 10,
    paddingVertical: 2,
    borderRadius: 8,
  },
  bestValueText: {
    color: '#ffffff',
    fontSize: 11,
    fontWeight: '800',
  },
  planHeader: {
    flexDirection: 'row-reverse',
    justifyContent: 'space-between',
    alignItems: 'center',
  },
  planPeriod: {
    fontSize: 16,
    fontWeight: '700',
  },
  planPrice: {
    fontSize: 18,
    fontWeight: '900',
    color: '#f59e0b',
  },
  planSub: {
    fontSize: 12,
    textAlign: 'right',
    marginTop: 4,
  },
  ctaButton: {
    width: '100%',
    backgroundColor: '#f59e0b',
    paddingVertical: 15,
    borderRadius: 16,
    alignItems: 'center',
    marginTop: 14,
    shadowColor: '#f59e0b',
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.3,
    shadowRadius: 8,
    elevation: 4,
  },
  ctaButtonText: {
    color: '#ffffff',
    fontSize: 16,
    fontWeight: '800',
  },
  guaranteeText: {
    fontSize: 11,
    color: '#94a3b8',
    textAlign: 'center',
    marginTop: 10,
  },
  restoreBtn: {
    marginTop: 12,
    paddingVertical: 4,
  },
  restoreBtnText: {
    fontSize: 12,
    color: '#64748b',
    textDecorationLine: 'underline',
  },
});

