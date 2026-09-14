import React from 'react';
import {
  View,
  Text,
  TouchableOpacity,
  StyleSheet,
  StatusBar,
  I18nManager
} from 'react-native';
import { SafeAreaView, SafeAreaProvider } from 'react-native-safe-area-context';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { useRecipeStore, TabType } from './src/store/recipeStore';
import { ExtractScreen } from './src/screens/ExtractScreen';
import { RecipeDetailScreen } from './src/screens/RecipeDetailScreen';
import { ShoppingListScreen } from './src/screens/ShoppingListScreen';
import { SavedRecipesScreen } from './src/screens/SavedRecipesScreen';

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

function MainApp() {
  const activeTab = useRecipeStore((s) => s.activeTab);
  const setActiveTab = useRecipeStore((s) => s.setActiveTab);
  const currentRecipe = useRecipeStore((s) => s.currentRecipe);
  const savedRecipes = useRecipeStore((s) => s.savedRecipes);

  const renderScreen = () => {
    switch (activeTab) {
      case 'extract':
        return <ExtractScreen />;
      case 'recipe':
        return <RecipeDetailScreen />;
      case 'shopping':
        return <ShoppingListScreen />;
      case 'library':
        return <SavedRecipesScreen />;
      default:
        return <ExtractScreen />;
    }
  };

  const tabs: { id: TabType; label: string; icon: string; badge?: number }[] = [
    { id: 'extract', label: 'חילוץ מתכון', icon: '✨' },
    {
      id: 'recipe',
      label: 'מתכון',
      icon: '🍳',
      badge: currentRecipe ? 1 : undefined
    },
    {
      id: 'shopping',
      label: 'רשימת קניות',
      icon: '🛒',
      badge: currentRecipe?.shoppingList?.reduce((acc, cat) => acc + cat.items.length, 0)
    },
    { id: 'library', label: 'השמורים שלי', icon: '📚', badge: savedRecipes.length }
  ];

  return (
    <SafeAreaView style={styles.safeArea} edges={['top', 'left', 'right']}>
      <StatusBar barStyle="light-content" backgroundColor="#0f172a" />

      {/* Top Navbar */}
      <View style={styles.topNav}>
        <View style={styles.logoRow}>
          <Text style={styles.logoEmoji}>🥑</Text>
          <Text style={styles.logoText}>ספר המתכונים שלי</Text>
        </View>
        <View style={styles.topNavBadge}>
          <Text style={styles.topNavBadgeText}>AI v1.0</Text>
        </View>
      </View>

      {/* Main Screen Content */}
      <View style={styles.screenContainer}>{renderScreen()}</View>

      {/* Bottom Tab Bar */}
      <View style={styles.tabBar}>
        {tabs.map((tab) => {
          const isActive = activeTab === tab.id;
          return (
            <TouchableOpacity
              key={tab.id}
              style={styles.tabItem}
              onPress={() => setActiveTab(tab.id)}
            >
              <View style={styles.iconContainer}>
                <Text style={styles.tabIcon}>{tab.icon}</Text>
                {tab.badge !== undefined && tab.badge > 0 && (
                  <View style={styles.badge}>
                    <Text style={styles.badgeText}>{tab.badge}</Text>
                  </View>
                )}
              </View>
              <Text style={[styles.tabLabel, isActive && styles.tabLabelActive]}>
                {tab.label}
              </Text>
              {isActive && <View style={styles.activeIndicator} />}
            </TouchableOpacity>
          );
        })}
      </View>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  safeArea: {
    flex: 1,
    backgroundColor: '#0f172a'
  },
  topNav: {
    height: 56,
    backgroundColor: '#0f172a',
    flexDirection: 'row-reverse',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: 20,
    borderBottomWidth: 1,
    borderBottomColor: '#1e293b'
  },
  logoRow: {
    flexDirection: 'row-reverse',
    alignItems: 'center'
  },
  logoEmoji: {
    fontSize: 22,
    marginLeft: 8
  },
  logoText: {
    color: '#ffffff',
    fontSize: 18,
    fontWeight: '800',
    letterSpacing: -0.3
  },
  topNavBadge: {
    backgroundColor: '#1e293b',
    paddingHorizontal: 8,
    paddingVertical: 3,
    borderRadius: 6,
    borderWidth: 1,
    borderColor: '#334155'
  },
  topNavBadgeText: {
    color: '#38bdf8',
    fontSize: 11,
    fontWeight: '700'
  },
  screenContainer: {
    flex: 1
  },
  tabBar: {
    height: 68,
    backgroundColor: '#0b1120',
    flexDirection: 'row-reverse',
    borderTopWidth: 1,
    borderTopColor: '#1e293b',
    paddingBottom: 6
  },
  tabItem: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    position: 'relative'
  },
  iconContainer: {
    position: 'relative'
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
    color: '#38bdf8',
    fontWeight: '700'
  },
  activeIndicator: {
    position: 'absolute',
    bottom: 0,
    width: 28,
    height: 3,
    backgroundColor: '#38bdf8',
    borderRadius: 2
  },
  badge: {
    position: 'absolute',
    top: -4,
    right: -10,
    backgroundColor: '#e11d48',
    borderRadius: 8,
    paddingHorizontal: 4,
    paddingVertical: 1,
    minWidth: 16,
    alignItems: 'center'
  },
  badgeText: {
    color: '#ffffff',
    fontSize: 9,
    fontWeight: 'bold'
  }
});
