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
  Share
} from 'react-native';
import { useRecipeStore } from '../store/recipeStore';
import { ApiClient } from '../services/api.client';
import { StructuredRecipe } from '@myrecipes/shared';

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

  const [elapsedSeconds, setElapsedSeconds] = useState(0);
  const timerRef = useRef<NodeJS.Timeout | null>(null);

  const setCurrentRecipe = useRecipeStore((s) => s.setCurrentRecipe);
  const saveRecipe = useRecipeStore((s) => s.saveRecipe);
  const setActiveTab = useRecipeStore((s) => s.setActiveTab);
  const isDarkMode = useRecipeStore((s) => s.isDarkMode);
  const sharedUrl = useRecipeStore((s) => s.sharedUrl);
  const setSharedUrl = useRecipeStore((s) => s.setSharedUrl);

  // Auto-fill when app is opened with a shared link
  useEffect(() => {
    if (sharedUrl) {
      setUrl(sharedUrl);
      setSharedUrl(null);
      setLastError(null);
    }
  }, [sharedUrl, setSharedUrl]);

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

  const handleExtract = async (targetUrl: string) => {
    const cleanUrl = targetUrl.trim();
    if (!cleanUrl) {
      Alert.alert('חסר קישור', 'אנא הדבק קישור מסרטון מתכון בטיקטוק, אינסטגרם או יוטיוב');
      return;
    }

    setLastError(null);
    setLoading(true);
    setStepIndex(1);
    setStatusMessage('שלב 1/3: מתחבר לפוסט ושולף כתוביות ומטא-דאטה...');

    try {
      const result = await ApiClient.parseRecipe(cleanUrl);

      if ((result as any).status === 'failed') {
        throw new Error((result as any).error || 'נכשלה פעולת חילוץ המתכון מהסרטון');
      }

      setTimeout(() => {
        setStepIndex(2);
        setStatusMessage('שלב 2/3: מעבד תוכן ומנתח הוראות בישול...');
      }, 1000);

      setTimeout(() => {
        setStepIndex(3);
        setStatusMessage('שלב 3/3: מפעיל בינה מלאכותית לבניית מתכון בעברית...');
      }, 2500);

      let recipe: StructuredRecipe | undefined = (result as any).recipe;
      let attempts = 0;
      const maxAttempts = 30;

      while (!recipe && attempts < maxAttempts) {
        await new Promise((r) => setTimeout(r, 1000));
        attempts++;

        try {
          const job = await ApiClient.getJob(result.jobId);
          if (job.status === 'completed' && job.recipe) {
            recipe = job.recipe;
            break;
          }
          if (job.status === 'failed') {
            throw new Error(job.error || 'נכשלה פעולת חילוץ המתכון מהסרטון');
          }
          if (job.message) {
            setStatusMessage(`שלב 2/3: ${job.message}`);
          }
        } catch (pollErr: any) {
          // If the job explicitly failed or error was thrown, abort and display error immediately
          const msg = pollErr.message || '';
          const isTransientNetwork = msg.includes('Network request failed') || msg.includes('timeout') || msg.includes('fetch');
          if (!isTransientNetwork || attempts >= maxAttempts) {
            throw pollErr;
          }
        }
      }

      if (!recipe) {
        throw new Error('שרת החילוץ לא סיים את עיבוד הסרטון בזמן הקצוב. אנא ודא שהסרטון ציבורי ונסה שוב.');
      }

      setCurrentRecipe(recipe);
      saveRecipe(recipe);
      setLoading(false);
      setActiveTab('recipe');
    } catch (err: any) {
      setLoading(false);
      const errorMsg = err.message || 'שגיאה לא ידועה בחילוץ המתכון';
      setLastError({
        message: errorMsg,
        url: cleanUrl,
        timestamp: new Date().toLocaleString('he-IL'),
        rawDetails: err.stack || String(err)
      });
      setStatusMessage(`❌ ${errorMsg}`);
    }
  };

  const themeContainer = isDarkMode ? styles.darkContainer : styles.lightContainer;
  const themeText = isDarkMode ? styles.darkText : styles.lightText;
  const themeCard = isDarkMode ? styles.darkCard : styles.lightCard;

  return (
    <ScrollView style={[styles.container, themeContainer]} contentContainerStyle={styles.content}>
      <View style={styles.header}>
        <View style={styles.badge}>
          <Text style={styles.badgeText}>✨ מנוע חילוץ מתכונים ב-AI</Text>
        </View>
        <Text style={[styles.title, themeText]}>חילוץ מתכון חדש 🪄</Text>
        <Text style={styles.subtitle}>
          מדביקים קישור מסרטון TikTok, Reels או YouTube Shorts, וה-AI יבנה מתכון עברי מסודר עם רשימת קניות!
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
          {url.length > 0 && (
            <TouchableOpacity
              style={styles.clearBtn}
              onPress={() => {
                setUrl('');
                setLastError(null);
              }}
            >
              <Text style={styles.clearBtnText}>✕ נקה</Text>
            </TouchableOpacity>
          )}

          <TouchableOpacity
            style={[styles.extractButton, loading && styles.buttonDisabled, url.length > 0 && { flex: 1 }]}
            onPress={() => handleExtract(url)}
            disabled={loading}
          >
            {loading ? (
              <ActivityIndicator color="#064e3b" />
            ) : (
              <Text style={styles.extractButtonText}>✨ חלץ מתכון עם AI</Text>
            )}
          </TouchableOpacity>
        </View>
      </View>

      {/* Structured Error Diagnostics Card */}
      {lastError && !loading && (
        <View style={styles.errorCard}>
          <View style={styles.errorHeaderRow}>
            <Text style={styles.errorTitle}>⚠️ שגיאה בחילוץ המתכון</Text>
            <TouchableOpacity onPress={() => setLastError(null)}>
              <Text style={styles.errorDismiss}>✕</Text>
            </TouchableOpacity>
          </View>

          <Text style={styles.errorMessageText}>{lastError.message}</Text>

          <View style={styles.errorUrlBox}>
            <Text style={styles.errorUrlLabel}>קישור שנבדק:</Text>
            <Text style={styles.errorUrlText} numberOfLines={2}>
              {lastError.url}
            </Text>
          </View>

          <View style={styles.errorActionsRow}>
            <TouchableOpacity
              style={styles.exportErrorBtn}
              activeOpacity={0.8}
              onPress={handleShareError}
            >
              <Text style={styles.exportErrorBtnText}>📋 ייצא / שתף דוח שגיאה</Text>
            </TouchableOpacity>

            <TouchableOpacity
              style={styles.retryBtn}
              activeOpacity={0.8}
              onPress={() => handleExtract(url)}
            >
              <Text style={styles.retryBtnText}>🔄 נסה שוב</Text>
            </TouchableOpacity>
          </View>
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
            מדביקים כאן את הקישור ולוחצים על <Text style={styles.boldText}>'חלץ מתכון עם AI'</Text>.
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
    alignItems: 'center'
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
  extractButton: {
    backgroundColor: '#a8e6cf',
    paddingVertical: 14,
    borderRadius: 12,
    alignItems: 'center',
    justifyContent: 'center',
    width: '100%'
  },
  buttonDisabled: {
    opacity: 0.6
  },
  extractButtonText: {
    color: '#064e3b',
    fontSize: 15,
    fontWeight: '800'
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
    alignItems: 'center',
    marginBottom: 8
  },
  errorTitle: {
    fontSize: 16,
    fontWeight: '800',
    color: '#991b1b',
    textAlign: 'right'
  },
  errorDismiss: {
    fontSize: 16,
    color: '#991b1b',
    fontWeight: '700',
    padding: 4
  },
  errorMessageText: {
    fontSize: 14,
    color: '#7f1d1d',
    lineHeight: 20,
    textAlign: 'right',
    marginBottom: 12
  },
  errorUrlBox: {
    backgroundColor: '#fee2e2',
    borderRadius: 8,
    padding: 10,
    marginBottom: 14
  },
  errorUrlLabel: {
    fontSize: 11,
    color: '#991b1b',
    fontWeight: '700',
    textAlign: 'right',
    marginBottom: 2
  },
  errorUrlText: {
    fontSize: 12,
    color: '#5b0f0f',
    textAlign: 'left'
  },
  errorActionsRow: {
    flexDirection: 'row',
    gap: 10
  },
  exportErrorBtn: {
    flex: 1,
    backgroundColor: '#dc2626',
    paddingVertical: 12,
    borderRadius: 10,
    alignItems: 'center'
  },
  exportErrorBtnText: {
    color: '#ffffff',
    fontSize: 13,
    fontWeight: '700'
  },
  retryBtn: {
    backgroundColor: '#ffffff',
    borderWidth: 1,
    borderColor: '#fca5a5',
    paddingHorizontal: 16,
    paddingVertical: 12,
    borderRadius: 10,
    alignItems: 'center'
  },
  retryBtnText: {
    color: '#991b1b',
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
