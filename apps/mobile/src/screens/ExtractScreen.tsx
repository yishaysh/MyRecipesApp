import React, { useState, useEffect, useRef } from 'react';
import {
  View,
  Text,
  TextInput,
  TouchableOpacity,
  ActivityIndicator,
  StyleSheet,
  ScrollView,
  Alert
} from 'react-native';
import { useRecipeStore } from '../store/recipeStore';
import { ApiClient } from '../services/api.client';
import { StructuredRecipe } from '@myrecipes/shared';

export const ExtractScreen: React.FC = () => {
  const [url, setUrl] = useState('');
  const [loading, setLoading] = useState(false);
  const [statusMessage, setStatusMessage] = useState('');
  const [stepIndex, setStepIndex] = useState(0);

  const [elapsedSeconds, setElapsedSeconds] = useState(0);
  const timerRef = useRef<NodeJS.Timeout | null>(null);

  const setCurrentRecipe = useRecipeStore((s) => s.setCurrentRecipe);
  const saveRecipe = useRecipeStore((s) => s.saveRecipe);
  const setActiveTab = useRecipeStore((s) => s.setActiveTab);
  const isDarkMode = useRecipeStore((s) => s.isDarkMode);

  const presets = [
    {
      title: '🍝 ספגטי קרבונרה אמיתי (אינסטגרם)',
      url: 'https://www.instagram.com/reel/carbonara-guanciale-authentic'
    },
    {
      title: '🍳 שקשוקה ים-תיכונית (טיקטוק)',
      url: 'https://www.tiktok.com/@chef/video/shakshuka-fresh'
    },
    {
      title: '🥞 פנקייקים אווריריים (יוטיוב שורטס)',
      url: 'https://youtube.com/shorts/fluffy-pancakes-recipe'
    }
  ];

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

  const handleExtract = async (targetUrl: string) => {
    if (!targetUrl.trim()) {
      Alert.alert('שגיאה', 'אנא הדבק קישור תקין מאינסטגרם או טיקטוק');
      return;
    }

    setLoading(true);
    setStepIndex(1);
    setStatusMessage('שלב 1/3: מתחבר לפוסט ושולף כתוביות ומדיה...');

    try {
      const result = await ApiClient.parseRecipe(targetUrl);

      setTimeout(() => {
        setStepIndex(2);
        setStatusMessage('שלב 2/3: מפעיל תמלול אודיו של הסרטון (Whisper AI)...');
      }, 1000);

      setTimeout(() => {
        setStepIndex(3);
        setStatusMessage('שלב 3/3: בונה מתכון מובנה בעברית עם בינה מלאכותית...');
      }, 2500);

      let recipe: StructuredRecipe | undefined = (result as any).recipe;
      let attempts = 0;
      const maxAttempts = 30; // 30 seconds max

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
            throw new Error(job.error || 'נכשלה מלאכת חילוץ המתכון מהפוסט');
          }
          if (job.message) {
            setStatusMessage(`שלב 2/3: ${job.message}`);
          }
        } catch (pollErr: any) {
          if (pollErr.message && pollErr.message.includes('נכשלה מלאכת חילוץ')) {
            throw pollErr;
          }
          // Continue polling on transient network hiccup
          if (attempts >= maxAttempts) break;
        }
      }

      if (!recipe) {
        throw new Error('שרת החילוץ לא השלים את פענוח הסרטון בזמן הקצוב. אנא ודא שהסרטון ציבורי ונסה שוב.');
      }

      setCurrentRecipe(recipe);
      saveRecipe(recipe);
      setLoading(false);
      setActiveTab('recipe');
    } catch (err: any) {
      setLoading(false);
      setStatusMessage(`❌ שגיאה: ${err.message || 'החילוץ נכשל'}`);
      Alert.alert('שגיאה בחילוץ המתכון', err.message || 'החילוץ נכשל, אנא נסה שוב.');
    }
  };

  const themeContainer = isDarkMode ? styles.darkContainer : styles.lightContainer;
  const themeText = isDarkMode ? styles.darkText : styles.lightText;
  const themeCard = isDarkMode ? styles.darkCard : styles.lightCard;

  return (
    <ScrollView style={[styles.container, themeContainer]} contentContainerStyle={styles.content}>
      <View style={styles.header}>
        <View style={styles.badge}>
          <Text style={styles.badgeText}>✨ חילוץ מתכונים חכם ב-AI</Text>
        </View>
        <Text style={[styles.title, themeText]}>חילוץ מתכון חדש 🪄</Text>
        <Text style={styles.subtitle}>
          מדביקים קישור מסרטון Reels, TikTok או YouTube, וה-AI בונה כרטיס מתכון ורשימת קניות אוטומטית!
        </Text>
      </View>

      <View style={[styles.inputCard, themeCard]}>
        <TextInput
          style={[styles.input, isDarkMode && styles.darkInput]}
          placeholder="הדבק לינק: https://www.instagram.com/reel/..."
          placeholderTextColor={isDarkMode ? '#94a3b8' : '#64748b'}
          value={url}
          onChangeText={setUrl}
          autoCapitalize="none"
          autoCorrect={false}
          textAlign="right"
        />

        <TouchableOpacity
          style={[styles.extractButton, loading && styles.buttonDisabled]}
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

      {/* Progress & Share Extension Modal Card */}
      {loading && (
        <View style={styles.progressCard}>
          <View style={styles.progressHeaderRow}>
            <Text style={styles.progressTitle}>⏳ מחלץ מתכון...</Text>
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

      <Text style={[styles.sectionTitle, themeText]}>או בחר דוגמה בלחיצה:</Text>

      {presets.map((preset, idx) => (
        <TouchableOpacity
          key={idx}
          style={[styles.presetCard, themeCard]}
          onPress={() => {
            setUrl(preset.url);
            handleExtract(preset.url);
          }}
        >
          <Text style={[styles.presetTitle, themeText]}>{preset.title}</Text>
          <Text style={styles.presetUrl} numberOfLines={1}>
            {preset.url}
          </Text>
        </TouchableOpacity>
      ))}

      <View style={styles.shareSheetBanner}>
        <Text style={styles.shareSheetTitle}>📲 מראה האפליקציה בשיתוף (Share Extension):</Text>
        <Text style={styles.shareSheetText}>
          כשתלחץ "שתף" באינסטגרם או בטיקטוק, האפליקציה תפתח חלונית קטנה, תחלץ את המתכון באופן אוטומטי ותעביר אותך לצפייה בכרטיס המתכון!
        </Text>
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
  lightText: {
    color: '#0f172a'
  },
  darkText: {
    color: '#f8fafc'
  },
  content: {
    padding: 20,
    paddingBottom: 40
  },
  header: {
    marginBottom: 20,
    alignItems: 'center'
  },
  badge: {
    backgroundColor: '#a8e6cf',
    paddingHorizontal: 14,
    paddingVertical: 4,
    borderRadius: 16,
    marginBottom: 10
  },
  badgeText: {
    color: '#064e3b',
    fontSize: 12,
    fontWeight: '800'
  },
  title: {
    fontSize: 24,
    fontWeight: '800',
    textAlign: 'center',
    marginBottom: 6
  },
  subtitle: {
    fontSize: 13,
    color: '#64748b',
    textAlign: 'center',
    lineHeight: 20
  },
  inputCard: {
    borderRadius: 18,
    padding: 16,
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
  input: {
    backgroundColor: '#f8fafc',
    borderRadius: 12,
    padding: 14,
    color: '#0f172a',
    fontSize: 14,
    borderWidth: 1,
    borderColor: '#cbd5e1',
    marginBottom: 14,
    textAlign: 'right'
  },
  darkInput: {
    backgroundColor: '#0f172a',
    color: '#ffffff',
    borderColor: '#334155'
  },
  extractButton: {
    backgroundColor: '#34d399',
    paddingVertical: 14,
    borderRadius: 12,
    alignItems: 'center'
  },
  buttonDisabled: {
    opacity: 0.6
  },
  extractButtonText: {
    color: '#064e3b',
    fontSize: 16,
    fontWeight: '800'
  },
  progressCard: {
    backgroundColor: '#ffffff',
    borderRadius: 18,
    padding: 18,
    borderWidth: 2,
    borderColor: '#34d399',
    marginBottom: 20
  },
  progressHeaderRow: {
    flexDirection: 'row-reverse',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 10
  },
  progressTitle: {
    color: '#059669',
    fontWeight: '800',
    fontSize: 15
  },
  timerChip: {
    backgroundColor: '#d1fae5',
    paddingHorizontal: 10,
    paddingVertical: 4,
    borderRadius: 8
  },
  timerText: {
    color: '#059669',
    fontWeight: '700',
    fontSize: 13
  },
  metricsRow: {
    flexDirection: 'row-reverse',
    justifyContent: 'space-between',
    backgroundColor: '#f8fafc',
    borderRadius: 10,
    padding: 10,
    marginBottom: 12
  },
  metricsText: {
    color: '#475569',
    fontSize: 12
  },
  boldText: {
    color: '#059669',
    fontWeight: '700'
  },
  progressMessage: {
    color: '#334155',
    fontSize: 13,
    textAlign: 'right',
    marginBottom: 16
  },
  stepperContainer: {
    flexDirection: 'row-reverse',
    alignItems: 'center',
    justifyContent: 'center',
    paddingHorizontal: 20
  },
  stepDot: {
    width: 14,
    height: 14,
    borderRadius: 7,
    backgroundColor: '#e2e8f0'
  },
  stepDotActive: {
    backgroundColor: '#34d399'
  },
  stepLine: {
    flex: 1,
    height: 3,
    backgroundColor: '#e2e8f0'
  },
  stepLineActive: {
    backgroundColor: '#34d399'
  },
  sectionTitle: {
    fontSize: 16,
    fontWeight: '700',
    textAlign: 'right',
    marginBottom: 12
  },
  presetCard: {
    borderRadius: 14,
    padding: 14,
    marginBottom: 10
  },
  presetTitle: {
    fontSize: 14,
    fontWeight: '700',
    textAlign: 'right',
    marginBottom: 4
  },
  presetUrl: {
    fontSize: 12,
    color: '#64748b',
    textAlign: 'right'
  },
  shareSheetBanner: {
    backgroundColor: '#e6f4ea',
    borderColor: '#a8e6cf',
    borderWidth: 1,
    borderRadius: 14,
    padding: 14,
    marginTop: 10
  },
  shareSheetTitle: {
    color: '#064e3b',
    fontWeight: '800',
    fontSize: 13,
    textAlign: 'right',
    marginBottom: 4
  },
  shareSheetText: {
    color: '#047857',
    fontSize: 12,
    lineHeight: 18,
    textAlign: 'right'
  }
});

