import React, { useState, useEffect, useRef } from 'react';
import {
  View,
  Text,
  TextInput,
  TouchableOpacity,
  ActivityIndicator,
  StyleSheet,
  ScrollView,
  Alert,
  Share,
  Linking
} from 'react-native';
import * as Clipboard from 'expo-clipboard';
import { useRecipeStore } from '../store/recipeStore';
import { useAuthStore } from '../store/authStore';
import { ApiClient } from '../services/api.client';
import { StructuredRecipe } from '@myrecipes/shared';
import { findDuplicateRecipe } from '../utils/recipeMatcher';

interface ErrorReport {
  message: string;
  url: string;
  timestamp: string;
  rawDetails?: string;
}

export const ExtractScreen: React.FC = () => {
  const [url, setUrl] = useState('');
  const [loading, setLoading] = useState(false);
  const [statusMessage, setStatusMessage] = useState('');
  const [stepIndex, setStepIndex] = useState(0);
  const [lastError, setLastError] = useState<ErrorReport | null>(null);
  const [showTechDetails, setShowTechDetails] = useState(false);

  const [elapsedSeconds, setElapsedSeconds] = useState(0);
  const timerRef = useRef<NodeJS.Timeout | null>(null);
  const isMountedRef = useRef(true);
  const timeoutsRef = useRef<ReturnType<typeof setTimeout>[]>([]);

  const setCurrentRecipe = useRecipeStore((s) => s.setCurrentRecipe);
  const saveRecipe = useRecipeStore((s) => s.saveRecipe);
  const saveRecipes = useRecipeStore((s) => s.saveRecipes);
  const setActiveTab = useRecipeStore((s) => s.setActiveTab);
  const isDarkMode = useRecipeStore((s) => s.isDarkMode);
  const sharedUrl = useRecipeStore((s) => s.sharedUrl);
  const clearSharedUrl = useRecipeStore((s) => s.clearSharedUrl);

  // Track mounted state and clean up pending timeouts
  useEffect(() => {
    isMountedRef.current = true;
    return () => {
      isMountedRef.current = false;
      timeoutsRef.current.forEach((t) => clearTimeout(t));
      timeoutsRef.current = [];
    };
  }, []);

  // Update input when a shared link is passed from outside
  useEffect(() => {
    if (sharedUrl) {
      setUrl(sharedUrl);
      clearSharedUrl();
      setLastError(null);
    }
  }, [sharedUrl, clearSharedUrl]);

  const pasteFromClipboard = async () => {
    try {
      const text = await Clipboard.getStringAsync();
      if (!text) {
        Alert.alert('הלוח ריק', 'לא נמצא טקסט או קישור מועתק בלוח ההעתקות של המכשיר.');
        return;
      }
      const match = text.match(/https?:\/\/[^\s"'<>]+/i);
      const clean = match ? match[0] : text.trim();
      setUrl(clean);
      setLastError(null);
    } catch (e: any) {
      Alert.alert('שגיאת קריאת לוח', e.message || 'לא ניתן לגשת ללוח ההעתקות');
    }
  };

  useEffect(() => {
    if (loading) {
      setElapsedSeconds(0);
      timerRef.current = setInterval(() => {
        setElapsedSeconds((prev) => prev + 1);
      }, 1000);
    } else {
      if (timerRef.current) clearInterval(timerRef.current);
    }
    return () => {
      if (timerRef.current) clearInterval(timerRef.current);
    };
  }, [loading]);

  const formatTimer = (totalSec: number) => {
    const mins = Math.floor(totalSec / 60);
    const secs = totalSec % 60;
    return `${mins < 10 ? '0' : ''}${mins}:${secs < 10 ? '0' : ''}${secs}`;
  };

  const estimatedRemaining = Math.max(0, 15 - elapsedSeconds);

  const handleShareError = async () => {
    if (!lastError) return;
    const report = [
      '📋 דוח שגיאה באפליקציית ספר המתכונים',
      '────────────────────────────',
      `⏰ זמן: ${lastError.timestamp}`,
      `🔗 קישור שהוזן: ${lastError.url}`,
      `❌ הודעת שגיאה: ${lastError.message}`,
      `🌐 שרת Vercel: ${ApiClient.getBaseUrl()}`,
      `🔍 פרטים טכניים: ${lastError.rawDetails || 'אין פירוט נוסף'}`,
      '────────────────────────────'
    ].join('\n');

    try {
      await Share.share({
        title: 'דוח שגיאה בחילוץ מתכון',
        message: report
      });
    } catch (e: any) {
      Alert.alert('שגיאה בשיתוף הדוח', e.message);
    }
  };

  const handleSendWhatsAppError = async () => {
    if (!lastError) return;
    const text = [
      '📋 דיווח על תקלה בחילוץ מתכון באפליקציה:',
      '────────────────────',
      `⏰ זמן: ${lastError.timestamp}`,
      `🔗 קישור: ${lastError.url}`,
      `❌ שגיאה: ${lastError.message}`,
      `🌐 שרת: ${ApiClient.getBaseUrl()}`,
      `🔍 פרטים טכניים: ${lastError.rawDetails || 'אין פירוט נוסף'}`,
      '────────────────────'
    ].join('\n');

    const whatsappUrl = `https://api.whatsapp.com/send?phone=972528613494&text=${encodeURIComponent(text)}`;
    try {
      await Linking.openURL(whatsappUrl);
    } catch {
      Alert.alert('שגיאה בפתיחת WhatsApp', 'ניתן לפנות למספר: 052-8613494');
    }
  };

  const handleSendEmailError = async () => {
    if (!lastError) return;
    const body = [
      'שלום ישי,',
      '',
      'נתקלתי בתקלה בעת חילוץ מתכון באפליקציה:',
      '',
      `⏰ זמן: ${lastError.timestamp}`,
      `🔗 קישור למתכון: ${lastError.url}`,
      `❌ שגיאה: ${lastError.message}`,
      `🌐 שרת: ${ApiClient.getBaseUrl()}`,
      `🔍 פרטים טכניים: ${lastError.rawDetails || 'אין פירוט נוסף'}`,
      '',
      'תודה!'
    ].join('\n');

    const mailUrl = `mailto:familymyrecipes@gmail.com?subject=${encodeURIComponent('דיווח על תקלה בחילוץ מתכון')}&body=${encodeURIComponent(body)}`;
    try {
      await Linking.openURL(mailUrl);
    } catch {
      Alert.alert('לא ניתן לפתוח אפליקציית מייל', 'ניתן לשלוח מייל לכתובת: familymyrecipes@gmail.com');
    }
  };

  const extractUrlFromText = (raw: string): string => {
    const trimmed = (raw || '').trim();
    const match = trimmed.match(/https?:\/\/[^\s"'<>]+/i);
    return match ? match[0] : trimmed;
  };

  const runExtraction = async (cleanUrl: string) => {
    setLastError(null);
    setLoading(true);
    setStepIndex(1);
    setStatusMessage('שלב 1/3: מתחבר לפוסט ושולף כתוביות ומטא-דאטה...');

    try {
      const token = useAuthStore.getState().token;
      const result = await ApiClient.parseRecipe(cleanUrl, token);

      if ((result as any).status === 'failed') {
        throw new Error((result as any).error || 'נכשלה פעולת חילוץ המתכון מהסרטון');
      }

      timeoutsRef.current.forEach((t) => clearTimeout(t));
      timeoutsRef.current = [];

      const t1 = setTimeout(() => {
        if (!isMountedRef.current) return;
        setStepIndex(2);
        setStatusMessage('שלב 2/3: מעבד תוכן ומנתח הוראות בישול...');
      }, 1000);

      const t2 = setTimeout(() => {
        if (!isMountedRef.current) return;
        setStepIndex(3);
        setStatusMessage('שלב 3/3: מפעיל בינה מלאכותית לבניית מתכון בעברית...');
      }, 2500);

      timeoutsRef.current.push(t1, t2);

      let recipe: StructuredRecipe | undefined = (result as any).recipe;
      let recipes: StructuredRecipe[] | undefined = (result as any).recipes;
      let attempts = 0;
      const maxAttempts = 30;

      while (!recipe && attempts < maxAttempts) {
        if (!isMountedRef.current) return;
        await new Promise((r) => setTimeout(r, 1000));
        if (!isMountedRef.current) return;
        attempts++;

        try {
          const job = await ApiClient.getJob(result.jobId);
          if (job.status === 'completed') {
            if (job.recipes && job.recipes.length > 0) {
              recipes = job.recipes;
              recipe = job.recipes[0];
              break;
            } else if (job.recipe) {
              recipe = job.recipe;
              recipes = [job.recipe];
              break;
            }
          }
          if (job.status === 'failed') {
            throw new Error(job.error || 'נכשלה פעולת חילוץ המתכון מהסרטון');
          }
          if (job.message && isMountedRef.current) {
            setStatusMessage(`שלב 2/3: ${job.message}`);
          }
        } catch (pollErr: any) {
          const msg = pollErr.message || '';
          const isTransientNetwork = msg.includes('Network request failed') || msg.includes('timeout') || msg.includes('fetch');
          if (!isTransientNetwork || attempts >= maxAttempts) {
            throw pollErr;
          }
        }
      }

      const allExtractedRecipes: StructuredRecipe[] = (recipes && recipes.length > 0)
        ? recipes
        : (recipe ? [recipe] : []);

      if (allExtractedRecipes.length === 0) {
        throw new Error('שרת החילוץ לא סיים את עיבוד הסרטון בזמן הקצוב. אנא ודא שהסרטון ציבורי ונסה שוב.');
      }

      // Save all extracted recipes atomically (supports carousels with multiple recipes)
      saveRecipes(allExtractedRecipes);

      // Trigger background cloud sync if authenticated
      if (token) {
        useAuthStore.getState().syncWithCloud(useRecipeStore.getState().savedRecipes, (merged) => {
          useRecipeStore.getState().setSavedRecipes(merged);
        });
      }

      const primaryRecipe = allExtractedRecipes[0];
      setCurrentRecipe(primaryRecipe);
      setLoading(false);
      setStatusMessage('');
      setStepIndex(0);
      setUrl('');
      clearSharedUrl();
      setLastError(null);

      timeoutsRef.current.forEach((t) => clearTimeout(t));
      timeoutsRef.current = [];

      if (allExtractedRecipes.length > 1) {
        Alert.alert(
          'חילוץ רב-מתכונים הצליח! 🍲',
          `חולצו בהצלחה ${allExtractedRecipes.length} מתכונים מהקרוסלה ונשמרו בספר המתכונים שלך!\n(המתכון "${primaryRecipe.title}" מוצג כעת, וכל שאר המתכונים זמינים בלשונית "המתכונים שלי")`,
          [
            {
              text: 'צפה במתכון',
              onPress: () => setActiveTab('recipe')
            }
          ]
        );
      } else {
        setActiveTab('recipe');
      }
    } catch (err: any) {
      timeoutsRef.current.forEach((t) => clearTimeout(t));
      timeoutsRef.current = [];
      if (!isMountedRef.current) return;
      setLoading(false);

      if (err.isQuotaExceeded) {
        useAuthStore.getState().setShowPaywall(true);
        setStatusMessage('');
        return;
      }

      const errorMsg = err.message || 'שגיאה לא ידועה בחילוץ המתכון';
      setLastError({
        message: errorMsg,
        url: cleanUrl,
        timestamp: new Date().toLocaleString('he-IL'),
        rawDetails: err.stack || String(err)
      });
      setShowTechDetails(false);
      setStatusMessage('');
    }
  };

  const handleExtract = async (targetUrl: string) => {
    const cleanUrl = extractUrlFromText(targetUrl);
    if (!cleanUrl || !cleanUrl.startsWith('http')) {
      Alert.alert('חסר קישור תקין', 'אנא הדבק קישור מסרטון מתכון או אתר מתכונים');
      return;
    }

    // Read savedRecipes dynamically from store to avoid unnecessary re-renders & stale closures
    const savedRecipes = useRecipeStore.getState().savedRecipes;

    // 1. Pre-check: Fast check if URL is already saved in collection
    const existingBefore = findDuplicateRecipe(savedRecipes, { url: cleanUrl });
    if (existingBefore) {
      Alert.alert(
        'המתכון כבר קיים במאגר! 📖',
        `המתכון "${existingBefore.title}" כבר שמור בספר המתכונים שלך.\nהאם ברצונך לחלץ מחדש (מתאים לקרוסלות מתכונים) או לצפות במתכון?`,
        [
          {
            text: 'חלץ מחדש 🔄',
            onPress: () => {
              runExtraction(cleanUrl);
            }
          },
          {
            text: 'צפה במתכון',
            onPress: () => {
              setCurrentRecipe(existingBefore);
              setUrl('');
              clearSharedUrl();
              setLastError(null);
              setActiveTab('recipe');
            }
          },
          {
            text: 'סגור',
            style: 'cancel',
            onPress: () => {
              setUrl('');
              clearSharedUrl();
              setLastError(null);
            }
          }
        ]
      );
      return;
    }

    await runExtraction(cleanUrl);
  };

  const themeContainer = isDarkMode ? styles.darkContainer : styles.lightContainer;
  const themeText = isDarkMode ? styles.darkText : styles.lightText;
  const themeCard = isDarkMode ? styles.darkCard : styles.lightCard;

  return (
    <ScrollView
      style={[styles.container, themeContainer]}
      contentContainerStyle={styles.content}
      keyboardShouldPersistTaps="handled"
    >
      <View style={styles.header}>
        <View style={styles.badge}>
          <Text style={styles.badgeText}>👨‍🍳 SousChef AI • הסו-שף הדיגיטלי שלך</Text>
        </View>
        <Text style={[styles.title, themeText]}>חילוץ מתכון עם SousChef AI 🪄</Text>
        <Text style={styles.subtitle}>
          מדביקים קישור מסרטון TikTok, Reels או YouTube Shorts — ו-SousChef AI יבנה מתכון עברי מסודר עם רשימת קניות!
        </Text>
      </View>

      <View style={[styles.inputCard, themeCard]}>
        <TextInput
          style={[styles.input, isDarkMode && styles.darkInput]}
          placeholder="הדבק כאן קישור מסרטון TikTok / Instagram..."
          placeholderTextColor={isDarkMode ? '#94a3b8' : '#64748b'}
          value={url}
          onChangeText={(txt) => {
            setUrl(txt);
            if (lastError) setLastError(null);
          }}
          autoCapitalize="none"
          autoCorrect={false}
          textAlign="right"
          selectTextOnFocus
        />

        <View style={styles.buttonRow}>
          <TouchableOpacity
            style={[styles.extractButton, loading && styles.buttonDisabled]}
            onPress={() => handleExtract(url)}
            disabled={loading}
          >
            {loading ? (
              <ActivityIndicator color="#064e3b" />
            ) : (
              <Text style={styles.extractButtonText}>👨‍🍳 חלץ עם SousChef AI</Text>
            )}
          </TouchableOpacity>

          {url.length > 0 ? (
            <TouchableOpacity
              style={styles.clearBtn}
              onPress={() => {
                setUrl('');
                setLastError(null);
              }}
            >
              <Text style={styles.clearBtnText}>✕ נקה</Text>
            </TouchableOpacity>
          ) : (
            <TouchableOpacity
              style={styles.pasteBtn}
              onPress={pasteFromClipboard}
            >
              <Text style={styles.pasteBtnText}>📋 הדבק</Text>
            </TouchableOpacity>
          )}
        </View>
      </View>

      {/* Structured Error Diagnostics Card */}
      {lastError && !loading && (
        <View style={styles.errorCard}>
          <View style={styles.errorHeaderRow}>
            <View style={styles.errorHeaderTitleGroup}>
              <Text style={styles.errorIcon}>⚠️</Text>
              <Text style={styles.errorTitle}>לא הצלחנו לחלץ את המתכון מהקישור</Text>
            </View>
            <TouchableOpacity
              onPress={() => { setLastError(null); setShowTechDetails(false); }}
              hitSlop={{ top: 10, bottom: 10, left: 10, right: 10 }}
              accessibilityRole="button"
              accessibilityLabel="סגור שגיאה"
            >
              <Text style={styles.errorDismiss}>✕</Text>
            </TouchableOpacity>
          </View>

          <Text style={styles.errorFriendlyText}>
            {!lastError.message || lastError.message.includes('לא נמצאו מצרכים') || lastError.message.includes('כתוביות')
              ? 'לא נמצאו מצרכים או הוראות הכנה בטקסט הסרטון או הפוסט (לדוגמה: אם המתכון מופיע כתמונה בלבד בקרוסלה, או שהסרטון ללא פירוט מצרכים בטקסט).'
              : lastError.message}
          </Text>

          <View style={styles.errorSubActions}>
            <Text style={styles.errorSubTitle}>
              פרטי התקלה המלאים נשמרו. באפשרותך לשלוח אותם ישירות למפתח (ישי) לבדיקה ושיפור:
            </Text>
            <View style={styles.errorContactButtonsRow}>
              <TouchableOpacity
                style={styles.whatsAppBtn}
                activeOpacity={0.8}
                onPress={handleSendWhatsAppError}
              >
                <Text style={styles.whatsAppBtnText}>📱 שלח ב-WhatsApp (ישי)</Text>
              </TouchableOpacity>

              <TouchableOpacity
                style={styles.emailBtn}
                activeOpacity={0.8}
                onPress={handleSendEmailError}
              >
                <Text style={styles.emailBtnText}>✉️ שלח במייל</Text>
              </TouchableOpacity>
            </View>
          </View>

          <View style={styles.errorActionsRow}>
            <TouchableOpacity
              style={styles.retryBtn}
              activeOpacity={0.8}
              onPress={() => handleExtract(url)}
            >
              <Text style={styles.retryBtnText}>🔄 נסה שוב</Text>
            </TouchableOpacity>

            <TouchableOpacity
              style={styles.toggleTechBtn}
              activeOpacity={0.8}
              onPress={() => setShowTechDetails((prev) => !prev)}
            >
              <Text style={styles.toggleTechBtnText}>
                {showTechDetails ? 'הסתר פרטים טכניים ▲' : 'פרטים טכניים למפתח ▾'}
              </Text>
            </TouchableOpacity>
          </View>

          {showTechDetails && (
            <View style={styles.techDetailsBox}>
              <Text style={styles.techDetailsLabel}>הודעת שגיאה מקורית:</Text>
              <Text style={styles.techDetailsMessage}>{lastError.message}</Text>
              <Text style={styles.techDetailsLabel}>קישור שנבדק:</Text>
              <Text style={styles.techDetailsUrl} numberOfLines={2}>{lastError.url}</Text>
              <Text style={styles.techDetailsTime}>זמן: {lastError.timestamp}</Text>
              <TouchableOpacity
                style={styles.shareReportBtn}
                activeOpacity={0.8}
                onPress={handleShareError}
              >
                <Text style={styles.shareReportBtnText}>📋 שיתוף כללי של הדוח</Text>
              </TouchableOpacity>
            </View>
          )}
        </View>
      )}

      {/* Progress Card */}
      {loading && (
        <View style={styles.progressCard}>
          <View style={styles.progressHeaderRow}>
            <Text style={styles.progressTitle}>⏳ מחלץ מתכון מהסרטון...</Text>
            <View style={styles.timerChip}>
              <Text style={styles.timerText}>{formatTimer(elapsedSeconds)}</Text>
            </View>
          </View>

          <View style={styles.metricsRow}>
            <Text style={styles.metricsText}>
              ⏱ חלף: <Text style={styles.boldText}>{elapsedSeconds} שניות</Text>
            </Text>
            <Text style={styles.metricsText}>
              ⌛ זמן משוער: <Text style={styles.boldText}>כ-{estimatedRemaining} שניות</Text>
            </Text>
          </View>

          <Text style={styles.progressMessage}>{statusMessage}</Text>

          <View style={styles.stepperContainer}>
            <View style={[styles.stepDot, stepIndex >= 1 && styles.stepDotActive]} />
            <View style={[styles.stepLine, stepIndex >= 2 && styles.stepLineActive]} />
            <View style={[styles.stepDot, stepIndex >= 2 && styles.stepDotActive]} />
            <View style={[styles.stepLine, stepIndex >= 3 && styles.stepLineActive]} />
            <View style={[styles.stepDot, stepIndex >= 3 && styles.stepDotActive]} />
          </View>
        </View>
      )}

      {/* User Guidance Instructions Card */}
      <View style={[styles.guideCard, themeCard]}>
        <Text style={[styles.guideTitle, themeText]}>💡 כיצד מחלצים מתכון?</Text>
        <View style={styles.guideStepRow}>
          <Text style={styles.guideStepNum}>1</Text>
          <Text style={[styles.guideStepText, themeText]}>
            נכנסים לסרטון מתכון ב-TikTok, Reels או YouTube.
          </Text>
        </View>
        <View style={styles.guideStepRow}>
          <Text style={styles.guideStepNum}>2</Text>
          <Text style={[styles.guideStepText, themeText]}>
            לוחצים על כפתור השיתוף בסרטון ובוחרים <Text style={styles.boldText}>'העתק קישור'</Text>.
          </Text>
        </View>
        <View style={styles.guideStepRow}>
          <Text style={styles.guideStepNum}>3</Text>
          <Text style={[styles.guideStepText, themeText]}>
            מדביקים כאן את הקישור ולוחצים על <Text style={styles.boldText}>'חלץ עם SousChef AI'</Text>.
          </Text>
        </View>
      </View>
    </ScrollView>
  );
};

const styles = StyleSheet.create({
  container: {
    flex: 1
  },
  lightContainer: {
    backgroundColor: '#f4f9f5'
  },
  darkContainer: {
    backgroundColor: '#0f172a'
  },
  content: {
    padding: 20,
    paddingBottom: 40
  },
  header: {
    alignItems: 'center',
    marginBottom: 20
  },
  badge: {
    backgroundColor: '#d1fae5',
    paddingHorizontal: 12,
    paddingVertical: 5,
    borderRadius: 20,
    marginBottom: 8
  },
  badgeText: {
    color: '#065f46',
    fontWeight: '700',
    fontSize: 12
  },
  title: {
    fontSize: 24,
    fontWeight: '800',
    marginBottom: 6,
    textAlign: 'center'
  },
  subtitle: {
    fontSize: 13,
    color: '#64748b',
    textAlign: 'center',
    lineHeight: 18,
    maxWidth: 320
  },
  lightText: {
    color: '#1e293b'
  },
  darkText: {
    color: '#f8fafc'
  },
  inputCard: {
    borderRadius: 16,
    padding: 16,
    marginBottom: 16,
    borderWidth: 1,
    borderColor: '#e2e8f0',
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.05,
    shadowRadius: 8,
    elevation: 2
  },
  lightCard: {
    backgroundColor: '#ffffff'
  },
  darkCard: {
    backgroundColor: '#1e293b',
    borderColor: '#334155'
  },
  input: {
    borderWidth: 1.5,
    borderColor: '#cbd5e1',
    borderRadius: 12,
    paddingHorizontal: 14,
    paddingVertical: 12,
    fontSize: 14,
    color: '#0f172a',
    backgroundColor: '#f8fafc',
    marginBottom: 12
  },
  darkInput: {
    borderColor: '#475569',
    backgroundColor: '#0f172a',
    color: '#f8fafc'
  },
  buttonRow: {
    flexDirection: 'row',
    gap: 8,
    alignItems: 'center',
    width: '100%'
  },
  extractButton: {
    backgroundColor: '#a8e6cf',
    paddingVertical: 14,
    borderRadius: 12,
    alignItems: 'center',
    justifyContent: 'center',
    flex: 1
  },
  buttonDisabled: {
    opacity: 0.6
  },
  extractButtonText: {
    color: '#064e3b',
    fontSize: 15,
    fontWeight: '800'
  },
  clearBtn: {
    paddingHorizontal: 14,
    paddingVertical: 14,
    borderRadius: 12,
    backgroundColor: '#fee2e2',
    alignItems: 'center',
    justifyContent: 'center'
  },
  clearBtnText: {
    color: '#b91c1c',
    fontWeight: '700',
    fontSize: 13
  },
  pasteBtn: {
    paddingHorizontal: 14,
    paddingVertical: 14,
    borderRadius: 12,
    backgroundColor: '#e0f2fe',
    alignItems: 'center',
    justifyContent: 'center'
  },
  pasteBtnText: {
    color: '#0369a1',
    fontWeight: '700',
    fontSize: 13
  },
  errorCard: {
    backgroundColor: '#fef2f2',
    borderWidth: 1.5,
    borderColor: '#fca5a5',
    borderRadius: 16,
    padding: 16,
    marginBottom: 16
  },
  errorHeaderRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'flex-start',
    marginBottom: 8
  },
  errorHeaderTitleGroup: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    flex: 1
  },
  errorIcon: {
    fontSize: 20
  },
  errorTitle: {
    fontSize: 15.5,
    fontWeight: '800',
    color: '#991b1b',
    textAlign: 'right',
    flex: 1
  },
  errorDismiss: {
    fontSize: 16,
    color: '#991b1b',
    fontWeight: '700',
    padding: 4
  },
  errorFriendlyText: {
    fontSize: 13.5,
    color: '#7f1d1d',
    lineHeight: 20,
    textAlign: 'right',
    marginBottom: 12
  },
  toggleTechBtn: {
    paddingVertical: 10,
    paddingHorizontal: 12,
    alignItems: 'center',
    justifyContent: 'center'
  },
  toggleTechBtnText: {
    fontSize: 12,
    color: '#991b1b',
    textDecorationLine: 'underline',
    fontWeight: '600'
  },
  techDetailsBox: {
    marginTop: 12,
    paddingTop: 12,
    borderTopWidth: 1,
    borderTopColor: '#fca5a5'
  },
  techDetailsLabel: {
    fontSize: 11,
    fontWeight: '700',
    color: '#991b1b',
    textAlign: 'right',
    marginTop: 4
  },
  techDetailsMessage: {
    fontSize: 11.5,
    color: '#7f1d1d',
    fontFamily: 'monospace',
    textAlign: 'left',
    backgroundColor: 'rgba(254, 202, 202, 0.4)',
    padding: 6,
    borderRadius: 6,
    marginTop: 2
  },
  techDetailsUrl: {
    fontSize: 11,
    color: '#5b0f0f',
    textAlign: 'left',
    marginTop: 2
  },
  techDetailsTime: {
    fontSize: 10.5,
    color: '#991b1b',
    textAlign: 'right',
    marginTop: 4
  },
  shareReportBtn: {
    marginTop: 8,
    paddingVertical: 6,
    alignItems: 'center'
  },
  shareReportBtnText: {
    fontSize: 11.5,
    color: '#475569',
    fontWeight: '600'
  },
  errorSubActions: {
    marginBottom: 12
  },
  errorSubTitle: {
    fontSize: 12,
    color: '#7f1d1d',
    textAlign: 'right',
    marginBottom: 8,
    lineHeight: 17
  },
  errorContactButtonsRow: {
    flexDirection: 'row',
    gap: 8,
    marginBottom: 4
  },
  whatsAppBtn: {
    flex: 1,
    backgroundColor: '#25d366',
    paddingVertical: 10,
    borderRadius: 10,
    alignItems: 'center',
    justifyContent: 'center'
  },
  whatsAppBtnText: {
    color: '#ffffff',
    fontSize: 12.5,
    fontWeight: '700'
  },
  emailBtn: {
    flex: 1,
    backgroundColor: '#2563eb',
    paddingVertical: 10,
    borderRadius: 10,
    alignItems: 'center',
    justifyContent: 'center'
  },
  emailBtnText: {
    color: '#ffffff',
    fontSize: 12.5,
    fontWeight: '700'
  },
  errorActionsRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    gap: 10
  },
  retryBtn: {
    backgroundColor: '#ffffff',
    borderWidth: 1,
    borderColor: '#fca5a5',
    paddingHorizontal: 16,
    paddingVertical: 10,
    borderRadius: 10,
    alignItems: 'center'
  },
  retryBtnText: {
    color: '#b91c1c',
    fontSize: 13,
    fontWeight: '700'
  },
  progressCard: {
    backgroundColor: '#ecfdf5',
    borderWidth: 1.5,
    borderColor: '#6ee7b7',
    borderRadius: 16,
    padding: 16,
    marginBottom: 16
  },
  progressHeaderRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 10
  },
  progressTitle: {
    fontSize: 15,
    fontWeight: '800',
    color: '#065f46'
  },
  timerChip: {
    backgroundColor: '#a8e6cf',
    paddingHorizontal: 8,
    paddingVertical: 3,
    borderRadius: 8
  },
  timerText: {
    fontSize: 12,
    fontWeight: '700',
    color: '#064e3b'
  },
  metricsRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    marginBottom: 10
  },
  metricsText: {
    fontSize: 12,
    color: '#047857'
  },
  boldText: {
    fontWeight: '700'
  },
  progressMessage: {
    fontSize: 13,
    color: '#064e3b',
    fontWeight: '600',
    textAlign: 'right',
    marginBottom: 14
  },
  stepperContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    paddingVertical: 4
  },
  stepDot: {
    width: 12,
    height: 12,
    borderRadius: 6,
    backgroundColor: '#cbd5e1'
  },
  stepDotActive: {
    backgroundColor: '#10b981'
  },
  stepLine: {
    flex: 1,
    height: 3,
    backgroundColor: '#cbd5e1',
    marginHorizontal: 4
  },
  stepLineActive: {
    backgroundColor: '#10b981'
  },
  guideCard: {
    borderRadius: 16,
    padding: 18,
    borderWidth: 1,
    borderColor: '#e2e8f0',
    marginTop: 8
  },
  guideTitle: {
    fontSize: 16,
    fontWeight: '800',
    marginBottom: 12,
    textAlign: 'right'
  },
  guideStepRow: {
    flexDirection: 'row-reverse',
    alignItems: 'center',
    marginBottom: 10,
    gap: 10
  },
  guideStepNum: {
    width: 24,
    height: 24,
    borderRadius: 12,
    backgroundColor: '#a8e6cf',
    color: '#064e3b',
    textAlign: 'center',
    lineHeight: 24,
    fontWeight: '800',
    fontSize: 13
  },
  guideStepText: {
    fontSize: 13,
    flex: 1,
    textAlign: 'right',
    lineHeight: 18
  }
});
