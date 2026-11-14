import React, { useEffect } from 'react';
import {
  View,
  Text,
  TouchableOpacity,
  ScrollView,
  StyleSheet,
  StatusBar,
  Modal,
  BackHandler,
  Linking,
  Image,
  AppState,
  Vibration
} from 'react-native';
import { SafeAreaView, SafeAreaProvider } from 'react-native-safe-area-context';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { Ingredient, KitchenStepInput, getKitchenStepTimerInfo } from '@myrecipes/shared';
import { useRecipeStore, TabType } from './src/store/recipeStore';
import { useAuthStore } from './src/store/authStore';
import { HomeScreen } from './src/screens/HomeScreen';
import { DiscoverScreen } from './src/screens/DiscoverScreen';
import { ExtractScreen } from './src/screens/ExtractScreen';
import { RecipeDetailScreen, groupIngredientsForDisplay } from './src/screens/RecipeDetailScreen';
import { ShoppingListScreen } from './src/screens/ShoppingListScreen';
import { ProfileScreen } from './src/screens/ProfileScreen';
import { ChefProPaywallModal } from './src/components/ChefProPaywallModal';
import { useShareIntent } from 'expo-share-intent';
import { APP_VERSION_LABEL } from './src/constants/version';

const queryClient = new QueryClient();

const STEP_INGREDIENT_STOP_WORDS = new Set([
  'או', 'של', 'עם', 'לפי', 'הטעם', 'מעט', 'קורט', 'גדול', 'גדולה', 'קטן', 'קטנה',
  'בינוני', 'בינונית', 'טרי', 'טרייה', 'טריים', 'טריות', 'קצוץ', 'קצוצה', 'קצוצים',
  'כתוש', 'כתושה', 'כתושים', 'מגורר', 'מגוררת', 'טחון', 'גרוס', 'דק', 'גס', 'חם',
  'חמים', 'קר', 'קרים', 'פושרים', 'יבש', 'יבשים', 'איכותי', 'ביתי', 'מלא', 'מנופה',
  'רך', 'רכה', 'מומס', 'מומסת', 'חתוך', 'חתוכים', 'פרוס', 'פרוסים', 'שיני', 'שן',
  'ראשי', 'ראש', 'עלי', 'עלה', 'גבעולי', 'גבעול', 'כוס', 'כוסות', 'כף', 'כפות',
  'כפית', 'כפיות', 'גרם', 'קילו', 'ליטר', 'יחידה', 'יחידות', 'חבילה', 'פחית'
]);

function getHebrewStemVariants(word: string): string[] {
  const clean = word.replace(/[^\u0590-\u05FFa-zA-Z]/g, '').toLowerCase();
  if (clean.length < 2) return [];
  const variants = new Set<string>([clean]);
  if (clean.startsWith('ה') && clean.length >= 4) {
    variants.add(clean.slice(1));
  }
  for (const v of Array.from(variants)) {
    if ((v.endsWith('ים') || v.endsWith('ות')) && v.length >= 5) {
      variants.add(v.slice(0, -2));
    } else if (v.endsWith('י') && v.length >= 4) {
      variants.add(v.slice(0, -1));
    } else if (v.endsWith('ה') && v.length >= 4) {
      variants.add(v.slice(0, -1));
    }
  }
  return Array.from(variants).filter((s) => s.length >= 2);
}

function stepWordsMatchToken(stepWords: string[], token: string): boolean {
  const stems = getHebrewStemVariants(token);
  if (stems.length === 0) return false;
  for (const sw of stepWords) {
    for (const stem of stems) {
      if (sw === stem) return true;
      // Match with Hebrew prefix (ו, ב, ל, מ, כ, ה, ש)
      const prefixRegex = new RegExp(`^[ובלמכהש]{1,2}${stem}(?:ים|ות|ה)?$`);
      if (prefixRegex.test(sw)) return true;
      if (stem.length >= 3 && sw.startsWith(stem) && sw.length - stem.length <= 2) {
        return true;
      }
    }
  }
  return false;
}

function getStepRelevantIngredients(
  stepInstruction: string,
  stepTip: string | null | undefined,
  allIngredients: Ingredient[]
): Ingredient[] {
  const grouped = groupIngredientsForDisplay(allIngredients);
  const flatIngredients: Ingredient[] = [];
  for (const sec of grouped) {
    for (const item of sec.items) {
      flatIngredients.push(sec.groupTitle && !item.group ? { ...item, group: sec.groupTitle } : item);
    }
  }

  const stepText = `${stepInstruction || ''} ${stepTip || ''}`.toLowerCase();
  if (!stepText.trim() || flatIngredients.length === 0) return [];

  if (/כל המצרכים|כל החומרים|שאר המצרכים/.test(stepText)) {
    return flatIngredients;
  }

  const stepWords = stepText
    .replace(/[^\u0590-\u05FFa-zA-Z0-9\s]/g, ' ')
    .split(/\s+/)
    .filter((w) => w.length >= 2);

  const matchedIds = new Set<string>();

  for (const ing of flatIngredients) {
    const cleanName = (ing.name || '')
      .replace(/\([^)]*\)/g, ' ')
      .replace(/[^\u0590-\u05FFa-zA-Z\s]/g, ' ')
      .toLowerCase()
      .trim();
    if (!cleanName) continue;

    // 1. Direct full-phrase substring match
    if (cleanName.length >= 3 && stepText.includes(cleanName)) {
      matchedIds.add(ing.id);
      continue;
    }

    const rawTokens = cleanName.split(/\s+/).filter((t) => t.length >= 2);
    const coreTokens = rawTokens.filter((t) => !STEP_INGREDIENT_STOP_WORDS.has(t));
    const tokensToCheck = coreTokens.length > 0 ? coreTokens : rawTokens;

    // Guard for 'פלפל שחור' vs 'פלפל אדום/מתוק/חריף':
    if (rawTokens.includes('פלפל') && rawTokens.includes('שחור')) {
      const hasBlackOrSpice =
        stepWordsMatchToken(stepWords, 'שחור') ||
        /תבלינ|מתבל|גרוס/.test(stepText);
      const hasOtherPepper = flatIngredients.some(
        (other) => other.id !== ing.id && (other.name || '').includes('פלפל') && !(other.name || '').includes('שחור')
      );
      if (hasOtherPepper && !hasBlackOrSpice) {
        continue;
      }
    }

    if (tokensToCheck.some((tok) => stepWordsMatchToken(stepWords, tok))) {
      matchedIds.add(ing.id);
    }
  }

  // 2. Collective category / section group match
  if (/תבלינים|התבלינים|מתבלים/.test(stepText)) {
    for (const ing of flatIngredients) {
      if (ing.category === 'spices') {
        matchedIds.add(ing.id);
      }
    }
  }

  for (const sec of grouped) {
    if (!sec.groupTitle) continue;
    const cleanGroup = sec.groupTitle
      .replace(/^[להבמוכ]+/, '')
      .replace(/[^\u0590-\u05FFa-zA-Z\s]/g, ' ')
      .trim();
    const groupWords = cleanGroup.split(/\s+/).filter((w) => w.length >= 3);
    if (groupWords.some((gw) => stepWordsMatchToken(stepWords, gw))) {
      // Check if any ingredient from this group was already matched; if not (e.g. "מערבבים את כל חומרי הרוטב"), add the whole group
      const anyFromGroupMatched = sec.items.some((i) => matchedIds.has(i.id));
      if (!anyFromGroupMatched || /מרכיבי|חומרי|כל ה/.test(stepText)) {
        for (const item of sec.items) {
          matchedIds.add(item.id);
        }
      }
    }
  }

  return flatIngredients.filter((ing) => matchedIds.has(ing.id));
}

export default function App() {
  return (
    <SafeAreaProvider>
      <QueryClientProvider client={queryClient}>
        <MainApp />
      </QueryClientProvider>
    </SafeAreaProvider>
  );
}

function KitchenStepTimer({
  step,
  stepKey
}: {
  step?: KitchenStepInput | null;
  stepKey: number;
}) {
  const timerInfo = React.useMemo(
    () => getKitchenStepTimerInfo(step),
    [step?.instruction, step?.durationMinutes]
  );
  const durationMinutes = timerInfo?.durationMinutes ?? null;
  const [isExpanded, setIsExpanded] = React.useState(false);
  const [timeLeft, setTimeLeft] = React.useState<number | null>(null);
  const [isRunning, setIsRunning] = React.useState(false);
  const endTimeRef = React.useRef<number | null>(null);

  React.useEffect(() => {
    endTimeRef.current = null;
    setIsExpanded(false);
    setIsRunning(false);
    setTimeLeft(durationMinutes ? Math.round(durationMinutes * 60) : null);
  }, [durationMinutes, step?.instruction, stepKey]);

  const syncRemainingFromClock = React.useCallback(() => {
    if (!endTimeRef.current) return;
    const remaining = Math.max(0, Math.ceil((endTimeRef.current - Date.now()) / 1000));
    setTimeLeft(remaining);
    if (remaining <= 0) {
      endTimeRef.current = null;
      setIsRunning(false);
      try {
        Vibration.vibrate([0, 400, 200, 400]);
      } catch {
        // ignore vibration permission error
      }
    }
  }, []);

  React.useEffect(() => {
    if (!isRunning) return;

    const interval = setInterval(syncRemainingFromClock, 500);
    const appStateSub = AppState.addEventListener('change', (nextState) => {
      if (nextState === 'active') {
        syncRemainingFromClock();
      }
    });

    return () => {
      clearInterval(interval);
      appStateSub.remove();
    };
  }, [isRunning, syncRemainingFromClock]);

  if (!timerInfo || !durationMinutes) return null;

  const totalSec = Math.round(durationMinutes * 60);

  if (!isExpanded) {
    return (
      <View style={styles.kitchenStartTimerWrap}>
        <TouchableOpacity
          style={styles.kitchenStartTimerBtn}
          activeOpacity={0.8}
          onPress={() => {
            endTimeRef.current = Date.now() + totalSec * 1000;
            setTimeLeft(totalSec);
            setIsExpanded(true);
            setIsRunning(true);
          }}
        >
          <Text style={styles.kitchenStartTimerBtnText}>
            ⏱️ התחל טיימר ({durationMinutes} דק׳)
          </Text>
        </TouchableOpacity>
      </View>
    );
  }

  const currentSec = timeLeft ?? totalSec;
  const mins = Math.floor(currentSec / 60);
  const secs = currentSec % 60;
  const formatted = `${mins.toString().padStart(2, '0')}:${secs.toString().padStart(2, '0')}`;
  const isDone = timeLeft === 0;

  return (
    <View style={styles.timerCard}>
      <View style={styles.timerHeader}>
        <Text style={styles.timerBadge}>⏱️ {timerInfo.labelHe} ({durationMinutes} דק׳)</Text>
        <View style={styles.timerClockBox}>
          <Text style={[styles.timerDigits, isDone && styles.timerDigitsDone]}>
            {isDone ? '🎉 הזמן הושלם!' : formatted}
          </Text>
        </View>
      </View>
      <View style={styles.timerButtonsRow}>
        <TouchableOpacity
          style={[styles.timerToggleBtn, isRunning && styles.timerPauseBtn]}
          activeOpacity={0.8}
          onPress={() => {
            if (isDone) {
              endTimeRef.current = Date.now() + totalSec * 1000;
              setTimeLeft(totalSec);
              setIsRunning(true);
            } else if (isRunning) {
              const remaining = endTimeRef.current
                ? Math.max(0, Math.ceil((endTimeRef.current - Date.now()) / 1000))
                : currentSec;
              endTimeRef.current = null;
              setTimeLeft(remaining);
              setIsRunning(false);
            } else {
              endTimeRef.current = Date.now() + currentSec * 1000;
              setIsRunning(true);
            }
          }}
        >
          <Text style={styles.timerToggleText}>
            {isRunning ? '⏸️ השהה' : isDone ? '🔄 התחל שוב' : (timeLeft !== null && timeLeft < totalSec ? '▶️ המשך טיימר' : '▶️ התחל טיימר')}
          </Text>
        </TouchableOpacity>
        <TouchableOpacity
          style={styles.timerResetBtn}
          activeOpacity={0.8}
          onPress={() => {
            endTimeRef.current = null;
            setIsRunning(false);
            setIsExpanded(false);
            setTimeLeft(totalSec);
          }}
        >
          <Text style={styles.timerResetText}>איפוס</Text>
        </TouchableOpacity>
      </View>
    </View>
  );
}

function MainApp() {
  const activeTab = useRecipeStore((s) => s.activeTab);
  const setActiveTab = useRecipeStore((s) => s.setActiveTab);
  const setSharedUrl = useRecipeStore((s) => s.setSharedUrl);
  const isDarkMode = useRecipeStore((s) => s.isDarkMode);

  // Kitchen Mode Modal State
  const isKitchenModeOpen = useRecipeStore((s) => s.isKitchenModeOpen);
  const closeKitchenMode = useRecipeStore((s) => s.closeKitchenMode);
  const currentRecipe = useRecipeStore((s) => s.currentRecipe);
  const kitchenStepIndex = useRecipeStore((s) => s.kitchenStepIndex);
  const setKitchenStepIndex = useRecipeStore((s) => s.setKitchenStepIndex);
  const [showIngredientsPeek, setShowIngredientsPeek] = React.useState(false);
  const [showAllKitchenIngredients, setShowAllKitchenIngredients] = React.useState(false);

  useEffect(() => {
    setShowAllKitchenIngredients(false);
  }, [kitchenStepIndex, isKitchenModeOpen]);

  // Auto-heal session and fetch current usage quota on startup after Zustand finishes hydration
  useEffect(() => {
    const initUsage = async () => {
      try {
        if (useAuthStore.persist?.hasHydrated()) {
          await useAuthStore.getState().fetchUsage();
        } else if (useAuthStore.persist?.onFinishHydration) {
          const unsub = useAuthStore.persist.onFinishHydration(() => {
            useAuthStore.getState().fetchUsage();
            unsub();
          });
        }
      } catch (err) {
        console.warn('[APP] Startup fetchUsage error:', err);
      }
    };
    initUsage();
  }, []);

  // Hook for system share sheet intents (e.g. sharing from Instagram, TikTok)
  const { hasShareIntent, shareIntent, resetShareIntent } = useShareIntent();

  useEffect(() => {
    if (hasShareIntent && (shareIntent.text || shareIntent.webUrl)) {
      const raw = (shareIntent.webUrl || shareIntent.text || '').trim();
      console.log('[APP] Received Share Intent content:', raw);
      const match = raw.match(/https?:\/\/[^\s"'<>]+/i);
      const extracted = match ? match[0] : raw;
      if (extracted) {
        setSharedUrl(extracted);
        setActiveTab('extract');
        resetShareIntent(true);
      }
    }
  }, [hasShareIntent, shareIntent, setSharedUrl, setActiveTab, resetShareIntent]);

  // Handle incoming deep links or shared URLs from social apps & Google OAuth callback
  useEffect(() => {
    const processIncomingUrl = (url: string) => {
      console.log('[APP] Processing incoming URL:', url);
      if (!url) return;

      // Handle mobile Google auth bridge deep link: myrecipes://auth?token=...&user=...
      if (url.startsWith('myrecipes://auth')) {
        try {
          const queryPart = url.includes('?') ? url.split('?')[1] : '';
          const params = new URLSearchParams(queryPart);
          const token = params.get('token');
          const rawUser = params.get('user');
          if (token && rawUser) {
            const userObj = JSON.parse(decodeURIComponent(rawUser));
            useAuthStore.getState().setAuth(userObj, token, {
              allowed: true,
              remaining: 5,
              totalLimit: 5,
              used: 0,
              isPro: userObj.isPro || false,
              period: 'month',
            });
            useAuthStore.getState().fetchUsage();
            setActiveTab('profile');
            return;
          }
        } catch (e) {
          console.error('[APP] Error parsing auth deep link:', e);
        }
      }

      // Handle recipe URLs
      const match = url.match(/https?:\/\/[^\s"'<>]+/i);
      const extracted = match ? match[0] : url;
      if (extracted && (extracted.startsWith('http://') || extracted.startsWith('https://'))) {
        setSharedUrl(extracted);
        setActiveTab('extract');
      }
    };

    Linking.getInitialURL()
      .then((initialUrl) => {
        if (initialUrl) processIncomingUrl(initialUrl);
      })
      .catch((err) => console.warn('[APP] Failed to read initial URL:', err));

    const sub = Linking.addEventListener('url', (event) => {
      if (event.url) processIncomingUrl(event.url);
    });

    return () => sub.remove();
  }, [setSharedUrl, setActiveTab]);

  // Android Hardware Back Handler
  useEffect(() => {
    const onBackPress = () => {
      if (isKitchenModeOpen) {
        closeKitchenMode();
        return true;
      }
      if (activeTab !== 'home') {
        setActiveTab('home');
        return true;
      }
      return false; // let system exit app
    };

    const subscription = BackHandler.addEventListener('hardwareBackPress', onBackPress);
    return () => subscription.remove();
  }, [activeTab, isKitchenModeOpen, closeKitchenMode, setActiveTab]);

  const renderScreen = () => {
    switch (activeTab) {
      case 'home':
        return <HomeScreen />;
      case 'discover':
        return <DiscoverScreen />;
      case 'extract':
        return <ExtractScreen />;
      case 'shopping':
        return <ShoppingListScreen />;
      case 'profile':
        return <ProfileScreen />;
      case 'recipe' as any:
        return <RecipeDetailScreen />;
      default:
        return <HomeScreen />;
    }
  };

  const totalSteps = currentRecipe?.instructions.length || 1;
  const currentStep = currentRecipe?.instructions[kitchenStepIndex];
  const progressPercent = ((kitchenStepIndex + 1) / totalSteps) * 100;

  const tabs: { id: TabType; label: string; icon: string; isCentral?: boolean }[] = [
    { id: 'home', label: 'בית', icon: '🏠' },
    { id: 'discover', label: 'גילוי', icon: '🧭' },
    { id: 'extract', label: 'הוסף', icon: '➕', isCentral: true },
    { id: 'shopping', label: 'רשימת קניות', icon: '🛒' },
    { id: 'profile', label: 'פרופיל', icon: '👤' }
  ];

  const themeSafeArea = isDarkMode ? styles.darkSafeArea : styles.lightSafeArea;
  const themeTopNav = isDarkMode ? styles.darkTopNav : styles.lightTopNav;
  const themeText = isDarkMode ? styles.darkText : styles.lightText;
  const themeTabBar = isDarkMode ? styles.darkTabBar : styles.lightTabBar;

  return (
    <SafeAreaView style={[styles.safeArea, themeSafeArea]} edges={['top', 'left', 'right']}>
      <StatusBar
        barStyle={isDarkMode ? 'light-content' : 'dark-content'}
        backgroundColor={isDarkMode ? '#0f172a' : '#a8e6cf'}
      />

      {/* Top Navbar */}
      <View style={[styles.topNav, themeTopNav]}>
        <View style={styles.logoRow}>
          <Image
            source={require('./assets/logo.png')}
            style={styles.logoImage}
            resizeMode="contain"
            accessible={false}
            accessibilityRole="image"
          />
          <Text style={[styles.logoText, themeText]}>ספר המתכונים שלי</Text>
        </View>
        <View style={[styles.topNavBadge, isDarkMode && styles.darkTopNavBadge]}>
          <Text style={[styles.topNavBadgeText, isDarkMode && styles.darkTopNavBadgeText]}>{APP_VERSION_LABEL}</Text>
        </View>
      </View>

      {/* Main Screen Content */}
      <View style={styles.screenContainer}>{renderScreen()}</View>

      {/* Bottom Tab Bar matching mockup image */}
      <View style={[styles.tabBar, themeTabBar]}>
        {tabs.map((tab) => {
          const isActive = activeTab === tab.id;

          if (tab.isCentral) {
            return (
              <TouchableOpacity
                key={tab.id}
                style={styles.centralTabItem}
                activeOpacity={0.85}
                onPress={() => setActiveTab(tab.id)}
              >
                <View style={styles.centralButton}>
                  <Text style={styles.centralIcon}>{tab.icon}</Text>
                </View>
                <Text style={[styles.tabLabel, styles.centralTabLabel]}>{tab.label}</Text>
              </TouchableOpacity>
            );
          }

          return (
            <TouchableOpacity
              key={tab.id}
              style={styles.tabItem}
              onPress={() => setActiveTab(tab.id)}
            >
              <Text style={styles.tabIcon}>{tab.icon}</Text>
              <Text style={[styles.tabLabel, isActive && styles.tabLabelActive]}>
                {tab.label}
              </Text>
              {isActive && <View style={styles.activeIndicator} />}
            </TouchableOpacity>
          );
        })}
      </View>

      {/* Kitchen Mode Fullscreen Modal ("מצב מטבח") */}
      {isKitchenModeOpen && currentRecipe && (
        <Modal visible={isKitchenModeOpen} animationType="slide" transparent={false}>
          <SafeAreaView style={styles.kitchenModalContainer}>
            <View style={styles.kitchenHeader}>
              <TouchableOpacity style={styles.closeBtn} onPress={closeKitchenMode}>
                <Text style={styles.closeBtnText}>✕ סגור</Text>
              </TouchableOpacity>
              <View style={styles.kitchenTitleWrap}>
                <Text style={styles.kitchenBadge}>🍳 Kitchen Mode</Text>
                <Text style={styles.kitchenRecipeTitle}>{currentRecipe.title}</Text>
              </View>
            </View>

            {/* Mint Green Progress Bar */}
            <View style={styles.progressTrack}>
              <View style={[styles.progressBar, { width: `${progressPercent}%` }]} />
            </View>

            {/* Giant Step Content */}
            <View style={styles.stepContentBox}>
              <Text style={styles.stepCounterText}>
                שלב {kitchenStepIndex + 1} מתוך {totalSteps}
              </Text>

              <ScrollView contentContainerStyle={styles.stepTextScroll}>
                <Text style={styles.giantStepNumber}>{kitchenStepIndex + 1}.</Text>
                <Text style={styles.giantStepText}>
                  {currentStep?.instruction || 'סיימתם את כל השלבים! בתיאבון!'}
                </Text>

                {currentStep?.tip && (
                  <View style={styles.giantTipBox}>
                    <Text style={styles.giantTipText}>💡 טיפ שף: {currentStep.tip}</Text>
                  </View>
                )}

                {/* Optional Step Waiting Timer (baking / proofing / cooling only) */}
                <KitchenStepTimer
                  step={currentStep}
                  stepKey={kitchenStepIndex}
                />

                {/* Quick Peek Ingredients Toggle */}
                {(() => {
                  const allNormalizedIngredients = groupIngredientsForDisplay(currentRecipe.ingredients).reduce<Ingredient[]>(
                    (acc, sec) => {
                      for (const item of sec.items) {
                        acc.push(sec.groupTitle && !item.group ? { ...item, group: sec.groupTitle } : item);
                      }
                      return acc;
                    },
                    []
                  );
                  const stepIngredients = getStepRelevantIngredients(
                    currentStep?.instruction || '',
                    currentStep?.tip,
                    currentRecipe.ingredients
                  );
                  const displayedIngredients = showAllKitchenIngredients
                    ? allNormalizedIngredients
                    : stepIngredients;

                  return (
                    <>
                      <TouchableOpacity
                        style={styles.peekIngredientsBtn}
                        activeOpacity={0.7}
                        onPress={() => setShowIngredientsPeek(!showIngredientsPeek)}
                      >
                        <Text style={styles.peekIngredientsText}>
                          {showIngredientsPeek
                            ? '▲ הסתר מצרכים לשלב זה'
                            : `🥗 הצג מצרכים לשלב זה (${stepIngredients.length})`}
                        </Text>
                      </TouchableOpacity>

                      {showIngredientsPeek && (
                        <View style={styles.ingredientsPeekBox}>
                          <Text style={styles.ingredientsPeekTitle}>
                            {showAllKitchenIngredients
                              ? `כל מצרכי המתכון (${allNormalizedIngredients.length}):`
                              : `מצרכים לשלב ${kitchenStepIndex + 1} (${stepIngredients.length}):`}
                          </Text>

                          {displayedIngredients.length > 0 ? (
                            displayedIngredients.map((ing) => (
                              <Text key={ing.id} style={styles.ingredientsPeekItem}>
                                • {ing.amount ? `${ing.amount} ` : ''}
                                {ing.unit ? `${ing.unit} ` : ''}
                                {ing.name}
                                {ing.group ? ` (${ing.group})` : ''}
                              </Text>
                            ))
                          ) : (
                            <Text style={styles.ingredientsPeekEmptyText}>
                              בשלב זה לא זוהו מצרכים ספציפיים (למשל פעולת חימום, ערבוב או הגשה).
                            </Text>
                          )}

                          {stepIngredients.length < allNormalizedIngredients.length && (
                            <TouchableOpacity
                              style={styles.peekSwitchModeBtn}
                              activeOpacity={0.7}
                              onPress={() => setShowAllKitchenIngredients(!showAllKitchenIngredients)}
                            >
                              <Text style={styles.peekSwitchModeText}>
                                {showAllKitchenIngredients
                                  ? `🎯 הצג רק מצרכים לשלב זה (${stepIngredients.length})`
                                  : `📋 הצג את כל מצרכי המתכון (${allNormalizedIngredients.length})`}
                              </Text>
                            </TouchableOpacity>
                          )}
                        </View>
                      )}
                    </>
                  );
                })()}
              </ScrollView>
            </View>

            {/* Step Controls */}
            <View style={styles.kitchenFooter}>
              <TouchableOpacity
                style={[
                  styles.navStepBtn,
                  kitchenStepIndex === 0 && styles.navStepBtnDisabled
                ]}
                disabled={kitchenStepIndex === 0}
                onPress={() => setKitchenStepIndex(kitchenStepIndex - 1)}
              >
                <Text style={styles.navStepBtnText}>← הקודם</Text>
              </TouchableOpacity>

              <TouchableOpacity
                style={[
                  styles.navStepBtn,
                  styles.navStepBtnPrimary,
                  kitchenStepIndex === totalSteps - 1 && styles.navStepBtnDisabled
                ]}
                onPress={() => {
                  if (kitchenStepIndex < totalSteps - 1) {
                    setKitchenStepIndex(kitchenStepIndex + 1);
                  } else {
                    closeKitchenMode();
                  }
                }}
              >
                <Text style={styles.navStepBtnPrimaryText}>
                  {kitchenStepIndex === totalSteps - 1 ? 'סיום בישול 🎉' : 'הבא →'}
                </Text>
              </TouchableOpacity>
            </View>
          </SafeAreaView>
        </Modal>
      )}
      <ChefProPaywallModal />
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  safeArea: {
    flex: 1
  },
  lightSafeArea: {
    backgroundColor: '#f4f9f5'
  },
  darkSafeArea: {
    backgroundColor: '#0f172a'
  },
  topNav: {
    height: 56,
    flexDirection: 'row-reverse',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: 20,
    borderBottomWidth: 1
  },
  lightTopNav: {
    backgroundColor: '#a8e6cf',
    borderBottomColor: '#86efac'
  },
  darkTopNav: {
    backgroundColor: '#0f172a',
    borderBottomColor: '#1e293b'
  },
  logoRow: {
    flexDirection: 'row-reverse',
    alignItems: 'center'
  },
  logoImage: {
    width: 28,
    height: 28,
    borderRadius: 7,
    marginLeft: 8,
  },
  logoText: {
    fontSize: 18,
    fontWeight: '800'
  },
  lightText: {
    color: '#064e3b'
  },
  darkText: {
    color: '#ffffff'
  },
  topNavBadge: {
    backgroundColor: '#ffffff',
    paddingHorizontal: 10,
    paddingVertical: 4,
    borderRadius: 14,
    borderWidth: 1,
    borderColor: '#e2e8f0'
  },
  darkTopNavBadge: {
    backgroundColor: '#1e293b',
    borderColor: '#334155'
  },
  topNavBadgeText: {
    color: '#059669',
    fontSize: 11,
    fontWeight: '800'
  },
  darkTopNavBadgeText: {
    color: '#34d399'
  },
  screenContainer: {
    flex: 1
  },
  tabBar: {
    height: 68,
    flexDirection: 'row-reverse',
    borderTopWidth: 1,
    paddingBottom: 6
  },
  lightTabBar: {
    backgroundColor: '#ffffff',
    borderTopColor: '#e2e8f0'
  },
  darkTabBar: {
    backgroundColor: '#0f172a',
    borderTopColor: '#1e293b'
  },
  tabItem: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    position: 'relative'
  },
  centralTabItem: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    marginTop: -10
  },
  centralButton: {
    width: 44,
    height: 44,
    borderRadius: 14,
    backgroundColor: '#34d399',
    justifyContent: 'center',
    alignItems: 'center',
    shadowColor: '#059669',
    shadowOffset: { width: 0, height: 3 },
    shadowOpacity: 0.3,
    shadowRadius: 5,
    elevation: 4
  },
  centralIcon: {
    fontSize: 18,
    color: '#064e3b'
  },
  centralTabLabel: {
    color: '#059669',
    fontWeight: '800',
    marginTop: 2
  },
  tabIcon: {
    fontSize: 20,
    marginBottom: 2
  },
  tabLabel: {
    fontSize: 11,
    color: '#64748b',
    fontWeight: '600'
  },
  tabLabelActive: {
    color: '#059669',
    fontWeight: '800'
  },
  activeIndicator: {
    position: 'absolute',
    bottom: 0,
    width: 24,
    height: 3,
    backgroundColor: '#34d399',
    borderRadius: 2
  },

  /* Kitchen Mode Modal Styles */
  kitchenModalContainer: {
    flex: 1,
    backgroundColor: '#f8fafc',
    paddingHorizontal: 20
  },
  kitchenHeader: {
    flexDirection: 'row-reverse',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingVertical: 14,
    borderBottomWidth: 1,
    borderBottomColor: '#e2e8f0'
  },
  closeBtn: {
    padding: 6
  },
  closeBtnText: {
    color: '#ef4444',
    fontSize: 15,
    fontWeight: '800'
  },
  kitchenTitleWrap: {
    alignItems: 'flex-end'
  },
  kitchenBadge: {
    fontSize: 12,
    color: '#059669',
    fontWeight: '800'
  },
  kitchenRecipeTitle: {
    fontSize: 16,
    fontWeight: '800',
    color: '#0f172a'
  },
  progressTrack: {
    height: 8,
    backgroundColor: '#e2e8f0',
    borderRadius: 4,
    marginVertical: 16,
    overflow: 'hidden'
  },
  progressBar: {
    height: '100%',
    backgroundColor: '#34d399',
    borderRadius: 4
  },
  stepContentBox: {
    flex: 1,
    backgroundColor: '#ffffff',
    borderRadius: 24,
    padding: 24,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.05,
    shadowRadius: 10,
    elevation: 3,
    marginBottom: 20
  },
  stepCounterText: {
    fontSize: 14,
    color: '#64748b',
    fontWeight: '700',
    textAlign: 'right',
    marginBottom: 16
  },
  stepTextScroll: {
    flexGrow: 1,
    paddingTop: 6,
    paddingBottom: 12
  },
  giantStepNumber: {
    fontSize: 36,
    fontWeight: '900',
    color: '#059669',
    textAlign: 'right',
    marginBottom: 8
  },
  giantStepText: {
    fontSize: 24,
    fontWeight: '700',
    color: '#0f172a',
    lineHeight: 38,
    textAlign: 'right'
  },
  giantTipBox: {
    marginTop: 20,
    backgroundColor: '#fffbeb',
    borderRadius: 14,
    padding: 14,
    borderRightWidth: 4,
    borderRightColor: '#f59e0b'
  },
  giantTipText: {
    fontSize: 15,
    color: '#b45309',
    fontWeight: '600',
    textAlign: 'right'
  },
  kitchenFooter: {
    flexDirection: 'row-reverse',
    justifyContent: 'space-between',
    paddingVertical: 16
  },
  navStepBtn: {
    paddingHorizontal: 20,
    paddingVertical: 14,
    borderRadius: 14,
    backgroundColor: '#e2e8f0'
  },
  navStepBtnDisabled: {
    opacity: 0.4
  },
  navStepBtnText: {
    color: '#475569',
    fontWeight: '700',
    fontSize: 15
  },
  navStepBtnPrimary: {
    backgroundColor: '#34d399',
    flex: 1,
    marginRight: 12,
    alignItems: 'center'
  },
  navStepBtnPrimaryText: {
    color: '#064e3b',
    fontWeight: '800',
    fontSize: 16
  },
  timerCard: {
    marginTop: 20,
    backgroundColor: '#0f172a',
    borderRadius: 18,
    padding: 16,
    borderWidth: 1,
    borderColor: '#334155',
    overflow: 'hidden'
  },
  kitchenStartTimerWrap: {
    marginTop: 20,
    alignItems: 'center'
  },
  kitchenStartTimerBtn: {
    backgroundColor: '#0f172a',
    borderWidth: 1.5,
    borderColor: '#10b981',
    borderRadius: 14,
    paddingVertical: 10,
    paddingHorizontal: 18,
    alignItems: 'center',
    justifyContent: 'center'
  },
  kitchenStartTimerBtnText: {
    color: '#34d399',
    fontSize: 15,
    fontWeight: '800'
  },
  timerHeader: {
    flexDirection: 'column',
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: 14,
    width: '100%'
  },
  timerBadge: {
    color: '#34d399',
    fontSize: 14,
    fontWeight: '700',
    textAlign: 'center',
    marginBottom: 8
  },
  timerClockBox: {
    backgroundColor: '#1e293b',
    borderRadius: 14,
    paddingVertical: 10,
    paddingHorizontal: 28,
    borderWidth: 1,
    borderColor: '#334155',
    alignItems: 'center',
    justifyContent: 'center',
    minWidth: 160
  },
  timerDigits: {
    color: '#ffffff',
    fontSize: 36,
    fontWeight: '900',
    textAlign: 'center',
    letterSpacing: 2,
    fontVariant: ['tabular-nums']
  },
  timerDigitsDone: {
    color: '#f59e0b',
    fontSize: 24,
    letterSpacing: 0
  },
  timerButtonsRow: {
    flexDirection: 'row-reverse',
    alignItems: 'center',
    gap: 10
  },
  timerToggleBtn: {
    flex: 1,
    backgroundColor: '#10b981',
    paddingVertical: 10,
    borderRadius: 12,
    alignItems: 'center'
  },
  timerPauseBtn: {
    backgroundColor: '#f59e0b'
  },
  timerToggleText: {
    color: '#ffffff',
    fontSize: 14,
    fontWeight: '800'
  },
  timerResetBtn: {
    paddingHorizontal: 16,
    paddingVertical: 10,
    backgroundColor: '#334155',
    borderRadius: 12,
    alignItems: 'center'
  },
  timerResetText: {
    color: '#94a3b8',
    fontSize: 13,
    fontWeight: '700'
  },
  peekIngredientsBtn: {
    marginTop: 16,
    paddingVertical: 10,
    paddingHorizontal: 14,
    borderRadius: 12,
    backgroundColor: '#f1f5f9',
    alignItems: 'center'
  },
  peekIngredientsText: {
    color: '#059669',
    fontSize: 14,
    fontWeight: '700'
  },
  ingredientsPeekBox: {
    marginTop: 10,
    backgroundColor: '#f8fafc',
    borderRadius: 14,
    padding: 14,
    borderWidth: 1,
    borderColor: '#e2e8f0'
  },
  ingredientsPeekTitle: {
    fontSize: 14,
    fontWeight: '800',
    color: '#0f172a',
    textAlign: 'right',
    marginBottom: 8
  },
  ingredientsPeekItem: {
    fontSize: 14,
    color: '#334155',
    textAlign: 'right',
    lineHeight: 22
  },
  ingredientsPeekEmptyText: {
    fontSize: 13,
    color: '#64748b',
    textAlign: 'right',
    fontStyle: 'italic',
    marginBottom: 6
  },
  peekSwitchModeBtn: {
    marginTop: 10,
    paddingTop: 8,
    borderTopWidth: 1,
    borderTopColor: '#e2e8f0',
    alignItems: 'center'
  },
  peekSwitchModeText: {
    color: '#059669',
    fontSize: 13,
    fontWeight: '700'
  }
});

