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
  Image
} from 'react-native';
import { SafeAreaView, SafeAreaProvider } from 'react-native-safe-area-context';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { useRecipeStore, TabType } from './src/store/recipeStore';
import { HomeScreen } from './src/screens/HomeScreen';
import { DiscoverScreen } from './src/screens/DiscoverScreen';
import { ExtractScreen } from './src/screens/ExtractScreen';
import { RecipeDetailScreen } from './src/screens/RecipeDetailScreen';
import { ShoppingListScreen } from './src/screens/ShoppingListScreen';
import { ProfileScreen } from './src/screens/ProfileScreen';
import { useShareIntent } from 'expo-share-intent';

const queryClient = new QueryClient();

export default function App() {
  return (
    <SafeAreaProvider>
      <QueryClientProvider client={queryClient}>
        <MainApp />
      </QueryClientProvider>
    </SafeAreaProvider>
  );
}

function KitchenStepTimer({ durationMinutes }: { durationMinutes?: number | null }) {
  const [timeLeft, setTimeLeft] = React.useState<number | null>(null);
  const [isRunning, setIsRunning] = React.useState(false);

  React.useEffect(() => {
    setTimeLeft(durationMinutes ? durationMinutes * 60 : null);
    setIsRunning(false);
  }, [durationMinutes]);

  React.useEffect(() => {
    let interval: any = null;
    if (isRunning && timeLeft !== null && timeLeft > 0) {
      interval = setInterval(() => {
        setTimeLeft((prev) => (prev !== null && prev > 0 ? prev - 1 : 0));
      }, 1000);
    } else if (timeLeft === 0 && isRunning) {
      setIsRunning(false);
    }
    return () => {
      if (interval) clearInterval(interval);
    };
  }, [isRunning, timeLeft]);

  if (!durationMinutes) return null;

  const totalSec = durationMinutes * 60;
  const currentSec = timeLeft ?? totalSec;
  const mins = Math.floor(currentSec / 60);
  const secs = currentSec % 60;
  const formatted = `${mins.toString().padStart(2, '0')}:${secs.toString().padStart(2, '0')}`;
  const isDone = timeLeft === 0;

  return (
    <View style={styles.timerCard}>
      <View style={styles.timerHeader}>
        <Text style={styles.timerBadge}>⏱️ טיימר לשלב זה ({durationMinutes} דק׳)</Text>
        <Text style={[styles.timerDigits, isDone && styles.timerDigitsDone]}>
          {isDone ? '🎉 הזמן הושלם!' : formatted}
        </Text>
      </View>
      <View style={styles.timerButtonsRow}>
        <TouchableOpacity
          style={[styles.timerToggleBtn, isRunning && styles.timerPauseBtn]}
          activeOpacity={0.8}
          onPress={() => {
            if (isDone) {
              setTimeLeft(totalSec);
              setIsRunning(true);
            } else {
              setIsRunning(!isRunning);
            }
          }}
        >
          <Text style={styles.timerToggleText}>
            {isRunning ? '⏸️ השהה' : isDone ? '🔄 התחל שוב' : '▶️ התחל טיימר'}
          </Text>
        </TouchableOpacity>
        <TouchableOpacity
          style={styles.timerResetBtn}
          activeOpacity={0.8}
          onPress={() => {
            setIsRunning(false);
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

  // Handle incoming deep links or shared URLs from social apps
  useEffect(() => {
    Linking.getInitialURL()
      .then((initialUrl) => {
        if (initialUrl) {
          console.log('[APP] Opened with URL:', initialUrl);
          const match = initialUrl.match(/https?:\/\/[^\s"'<>]+/i);
          const extracted = match ? match[0] : initialUrl;
          setSharedUrl(extracted);
          setActiveTab('extract');
        }
      })
      .catch((err) => console.warn('[APP] Failed to read initial URL:', err));

    const sub = Linking.addEventListener('url', (event) => {
      console.log('[APP] Received URL event:', event.url);
      if (event.url) {
        const match = event.url.match(/https?:\/\/[^\s"'<>]+/i);
        const extracted = match ? match[0] : event.url;
        setSharedUrl(extracted);
        setActiveTab('extract');
      }
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
          <Text style={[styles.topNavBadgeText, isDarkMode && styles.darkTopNavBadgeText]}>v1.3.5 (Build 15)</Text>
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

                {/* Built-in Step Cooking Timer */}
                <KitchenStepTimer durationMinutes={currentStep?.durationMinutes} />

                {/* Quick Peek Ingredients Toggle */}
                <TouchableOpacity
                  style={styles.peekIngredientsBtn}
                  activeOpacity={0.7}
                  onPress={() => setShowIngredientsPeek(!showIngredientsPeek)}
                >
                  <Text style={styles.peekIngredientsText}>
                    {showIngredientsPeek ? '▲ הסתר מצרכים לשלב זה' : '🥗 הצג רשימת מצרכים'}
                  </Text>
                </TouchableOpacity>

                {showIngredientsPeek && (
                  <View style={styles.ingredientsPeekBox}>
                    <Text style={styles.ingredientsPeekTitle}>מצרכים נדרשים למתכון:</Text>
                    {currentRecipe.ingredients.map((ing) => (
                      <Text key={ing.id} style={styles.ingredientsPeekItem}>
                        • {ing.amount ? `${ing.amount} ` : ''}{ing.unit ? `${ing.unit} ` : ''}{ing.name}
                      </Text>
                    ))}
                  </View>
                )}
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
    flexGrow: 1
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
    borderColor: '#334155'
  },
  timerHeader: {
    flexDirection: 'row-reverse',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 12
  },
  timerBadge: {
    color: '#10b981',
    fontSize: 13,
    fontWeight: '700'
  },
  timerDigits: {
    color: '#ffffff',
    fontSize: 22,
    fontWeight: '900',
    fontVariant: ['tabular-nums']
  },
  timerDigitsDone: {
    color: '#f59e0b'
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
  }
});

