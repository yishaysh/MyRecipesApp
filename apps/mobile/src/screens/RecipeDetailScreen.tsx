import React, { useState } from 'react';
import {
  View,
  Text,
  ScrollView,
  TouchableOpacity,
  StyleSheet
} from 'react-native';
import { useRecipeStore } from '../store/recipeStore';

export const RecipeDetailScreen: React.FC = () => {
  const recipe = useRecipeStore((s) => s.currentRecipe);
  const checkedIngredients = useRecipeStore((s) => s.checkedIngredients);
  const toggleIngredient = useRecipeStore((s) => s.toggleIngredient);
  const setActiveTab = useRecipeStore((s) => s.setActiveTab);

  const [servingMultiplier, setServingMultiplier] = useState(1);
  const [activeTimerStep, setActiveTimerStep] = useState<number | null>(null);

  if (!recipe) {
    return (
      <View style={styles.emptyContainer}>
        <Text style={styles.emptyIcon}>📖</Text>
        <Text style={styles.emptyTitle}>לא נבחר מתכון עדיין</Text>
        <Text style={styles.emptySubtitle}>
          חלץ מתכון מסרטון באינסטגרם, טיקטוק או יוטיוב כדי לצפות בו כאן.
        </Text>
        <TouchableOpacity
          style={styles.ctaButton}
          onPress={() => setActiveTab('extract')}
        >
          <Text style={styles.ctaButtonText}>עבור למסך החילוץ</Text>
        </TouchableOpacity>
      </View>
    );
  }

  const baseServings = recipe.servings || 4;
  const currentServings = Math.round(baseServings * servingMultiplier);

  const categoryHebrew: Record<string, string> = {
    produce: 'ירקות ופירות',
    dairy: 'מוצרי חלב',
    meat: 'בשר ודגים',
    pantry: 'מזווה ויבשים',
    spices: 'תבלינים',
    bakery: 'מאפייה',
    other: 'שונות'
  };

  return (
    <ScrollView style={styles.container} contentContainerStyle={styles.content}>
      {/* Header Info */}
      <View style={styles.header}>
        <View style={styles.platformBadge}>
          <Text style={styles.platformBadgeText}>{recipe.platform.toUpperCase()}</Text>
        </View>
        <Text style={styles.title}>{recipe.title}</Text>
        <Text style={styles.description}>{recipe.description}</Text>
      </View>

      {/* Meta Bar */}
      <View style={styles.metaRow}>
        <View style={styles.metaItem}>
          <Text style={styles.metaLabel}>הכנה</Text>
          <Text style={styles.metaValue}>
            {recipe.prepTimeMinutes ? `${recipe.prepTimeMinutes} דק'` : '--'}
          </Text>
        </View>
        <View style={styles.metaDivider} />
        <View style={styles.metaItem}>
          <Text style={styles.metaLabel}>בישול</Text>
          <Text style={styles.metaValue}>
            {recipe.cookTimeMinutes ? `${recipe.cookTimeMinutes} דק'` : '--'}
          </Text>
        </View>
        <View style={styles.metaDivider} />
        <View style={styles.metaItem}>
          <Text style={styles.metaLabel}>סה"כ זמן</Text>
          <Text style={styles.metaValue}>
            {recipe.totalTimeMinutes ? `${recipe.totalTimeMinutes} דק'` : '--'}
          </Text>
        </View>
      </View>

      {/* Servings Scaler */}
      <View style={styles.servingsCard}>
        <Text style={styles.servingsText}>מספר מנות: {currentServings}</Text>
        <View style={styles.scalerButtons}>
          <TouchableOpacity
            style={styles.scalerBtn}
            onPress={() => setServingMultiplier(Math.max(0.5, servingMultiplier - 0.5))}
          >
            <Text style={styles.scalerBtnText}>-</Text>
          </TouchableOpacity>
          <Text style={styles.multiplierText}>{servingMultiplier}x</Text>
          <TouchableOpacity
            style={styles.scalerBtn}
            onPress={() => setServingMultiplier(servingMultiplier + 0.5)}
          >
            <Text style={styles.scalerBtnText}>+</Text>
          </TouchableOpacity>
        </View>
      </View>

      {/* Ingredients Section */}
      <View style={styles.section}>
        <View style={styles.sectionTitleRow}>
          <Text style={styles.sectionTitle}>מצרכים ({recipe.ingredients.length})</Text>
          <TouchableOpacity onPress={() => setActiveTab('shopping')}>
            <Text style={styles.linkText}>לרשימת הקניות המרוכזת ←</Text>
          </TouchableOpacity>
        </View>

        {recipe.ingredients.map((ing) => {
          const isChecked = !!checkedIngredients[ing.id];
          const scaledAmount =
            ing.amount !== null
              ? (ing.amount * servingMultiplier).toFixed(ing.amount % 1 === 0 ? 0 : 1)
              : null;
          const catLabel = categoryHebrew[ing.category] || ing.category;

          return (
            <TouchableOpacity
              key={ing.id}
              style={[styles.ingredientItem, isChecked && styles.ingredientChecked]}
              onPress={() => toggleIngredient(ing.id)}
            >
              <View style={[styles.checkbox, isChecked && styles.checkboxActive]}>
                {isChecked && <Text style={styles.checkmark}>✓</Text>}
              </View>
              <View style={styles.ingredientTextContainer}>
                <Text style={[styles.ingredientName, isChecked && styles.textStrikethrough]}>
                  {scaledAmount && ing.unit ? `${scaledAmount} ${ing.unit} ` : ''}
                  {ing.name}
                </Text>
                <Text style={styles.ingredientCategory}>[{catLabel}]</Text>
              </View>
            </TouchableOpacity>
          );
        })}
      </View>

      {/* Instructions Section */}
      <View style={styles.section}>
        <Text style={styles.sectionTitle}>שלבי הכנה</Text>
        {recipe.instructions.map((step) => {
          const isTimerRunning = activeTimerStep === step.stepNumber;
          return (
            <View key={step.stepNumber} style={styles.stepCard}>
              <View style={styles.stepHeader}>
                <View style={styles.stepNumberBadge}>
                  <Text style={styles.stepNumberText}>{step.stepNumber}</Text>
                </View>
                {step.durationMinutes && (
                  <TouchableOpacity
                    style={[styles.timerBadge, isTimerRunning && styles.timerBadgeActive]}
                    onPress={() =>
                      setActiveTimerStep(isTimerRunning ? null : step.stepNumber)
                    }
                  >
                    <Text style={styles.timerBadgeText}>
                      ⏱ {step.durationMinutes} דק' {isTimerRunning ? '(טיימר פעיל)' : ''}
                    </Text>
                  </TouchableOpacity>
                )}
              </View>
              <Text style={styles.stepInstruction}>{step.instruction}</Text>
              {step.tip && (
                <View style={styles.tipBox}>
                  <Text style={styles.tipText}>💡 טיפ שף: {step.tip}</Text>
                </View>
              )}
            </View>
          );
        })}
      </View>
    </ScrollView>
  );
};

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#0f172a'
  },
  content: {
    padding: 20,
    paddingBottom: 40
  },
  emptyContainer: {
    flex: 1,
    backgroundColor: '#0f172a',
    justifyContent: 'center',
    alignItems: 'center',
    padding: 30
  },
  emptyIcon: {
    fontSize: 48,
    marginBottom: 16
  },
  emptyTitle: {
    fontSize: 22,
    fontWeight: '700',
    color: '#f8fafc',
    marginBottom: 8
  },
  emptySubtitle: {
    fontSize: 14,
    color: '#94a3b8',
    textAlign: 'center',
    marginBottom: 24,
    lineHeight: 22
  },
  ctaButton: {
    backgroundColor: '#3b82f6',
    paddingHorizontal: 22,
    paddingVertical: 12,
    borderRadius: 10
  },
  ctaButtonText: {
    color: '#ffffff',
    fontWeight: '700',
    fontSize: 15
  },
  header: {
    marginBottom: 20,
    alignItems: 'flex-end'
  },
  platformBadge: {
    backgroundColor: '#e11d48',
    paddingHorizontal: 10,
    paddingVertical: 4,
    borderRadius: 8,
    marginBottom: 10
  },
  platformBadgeText: {
    color: '#ffffff',
    fontSize: 11,
    fontWeight: '800'
  },
  title: {
    fontSize: 26,
    fontWeight: '800',
    color: '#f8fafc',
    textAlign: 'right',
    marginBottom: 8
  },
  description: {
    fontSize: 14,
    color: '#94a3b8',
    textAlign: 'right',
    lineHeight: 22
  },
  metaRow: {
    flexDirection: 'row-reverse',
    backgroundColor: '#1e293b',
    borderRadius: 14,
    padding: 16,
    marginBottom: 16,
    alignItems: 'center',
    justifyContent: 'space-around',
    borderWidth: 1,
    borderColor: '#334155'
  },
  metaItem: {
    alignItems: 'center'
  },
  metaLabel: {
    fontSize: 11,
    color: '#64748b',
    fontWeight: '700',
    marginBottom: 4
  },
  metaValue: {
    fontSize: 16,
    fontWeight: '700',
    color: '#38bdf8'
  },
  metaDivider: {
    width: 1,
    height: 24,
    backgroundColor: '#334155'
  },
  servingsCard: {
    flexDirection: 'row-reverse',
    justifyContent: 'space-between',
    alignItems: 'center',
    backgroundColor: '#1e293b',
    borderRadius: 14,
    padding: 14,
    marginBottom: 24,
    borderWidth: 1,
    borderColor: '#334155'
  },
  servingsText: {
    color: '#f1f5f9',
    fontSize: 15,
    fontWeight: '600'
  },
  scalerButtons: {
    flexDirection: 'row',
    alignItems: 'center'
  },
  scalerBtn: {
    width: 34,
    height: 34,
    borderRadius: 8,
    backgroundColor: '#334155',
    justifyContent: 'center',
    alignItems: 'center'
  },
  scalerBtnText: {
    color: '#ffffff',
    fontSize: 18,
    fontWeight: '700'
  },
  multiplierText: {
    color: '#38bdf8',
    marginHorizontal: 12,
    fontWeight: '700',
    fontSize: 15
  },
  section: {
    marginBottom: 24
  },
  sectionTitleRow: {
    flexDirection: 'row-reverse',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 12
  },
  sectionTitle: {
    fontSize: 18,
    fontWeight: '700',
    color: '#f1f5f9',
    textAlign: 'right'
  },
  linkText: {
    color: '#38bdf8',
    fontSize: 13,
    fontWeight: '600'
  },
  ingredientItem: {
    flexDirection: 'row-reverse',
    alignItems: 'center',
    backgroundColor: '#1e293b',
    padding: 14,
    borderRadius: 12,
    marginBottom: 8,
    borderWidth: 1,
    borderColor: '#334155'
  },
  ingredientChecked: {
    opacity: 0.5,
    borderColor: '#10b981'
  },
  checkbox: {
    width: 22,
    height: 22,
    borderRadius: 6,
    borderWidth: 2,
    borderColor: '#64748b',
    marginLeft: 12,
    justifyContent: 'center',
    alignItems: 'center'
  },
  checkboxActive: {
    backgroundColor: '#10b981',
    borderColor: '#10b981'
  },
  checkmark: {
    color: '#ffffff',
    fontSize: 13,
    fontWeight: '900'
  },
  ingredientTextContainer: {
    flex: 1,
    flexDirection: 'row-reverse',
    justifyContent: 'space-between',
    alignItems: 'center'
  },
  ingredientName: {
    color: '#f8fafc',
    fontSize: 15,
    fontWeight: '500',
    textAlign: 'right'
  },
  ingredientCategory: {
    color: '#64748b',
    fontSize: 11
  },
  textStrikethrough: {
    textDecorationLine: 'line-through',
    color: '#94a3b8'
  },
  stepCard: {
    backgroundColor: '#1e293b',
    borderRadius: 14,
    padding: 16,
    marginBottom: 12,
    borderWidth: 1,
    borderColor: '#334155'
  },
  stepHeader: {
    flexDirection: 'row-reverse',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 10
  },
  stepNumberBadge: {
    width: 28,
    height: 28,
    borderRadius: 14,
    backgroundColor: '#3b82f6',
    justifyContent: 'center',
    alignItems: 'center'
  },
  stepNumberText: {
    color: '#ffffff',
    fontWeight: '800',
    fontSize: 13
  },
  timerBadge: {
    backgroundColor: '#334155',
    paddingHorizontal: 12,
    paddingVertical: 5,
    borderRadius: 8
  },
  timerBadgeActive: {
    backgroundColor: '#f59e0b'
  },
  timerBadgeText: {
    color: '#ffffff',
    fontSize: 12,
    fontWeight: '600'
  },
  stepInstruction: {
    color: '#f1f5f9',
    fontSize: 15,
    lineHeight: 22,
    textAlign: 'right'
  },
  tipBox: {
    marginTop: 10,
    backgroundColor: 'rgba(245, 158, 11, 0.1)',
    borderRadius: 8,
    padding: 10,
    borderRightWidth: 3,
    borderRightColor: '#f59e0b'
  },
  tipText: {
    color: '#fbbf24',
    fontSize: 13,
    textAlign: 'right'
  }
});
