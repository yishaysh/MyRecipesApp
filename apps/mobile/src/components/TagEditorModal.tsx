import React, { useState, useEffect } from 'react';
import {
  Modal,
  View,
  Text,
  TouchableOpacity,
  TextInput,
  ScrollView,
  StyleSheet,
  Alert,
  KeyboardAvoidingView,
  Platform
} from 'react-native';
import { StructuredRecipe } from '@myrecipes/shared';
import { useRecipeStore } from '../store/recipeStore';

interface TagEditorModalProps {
  visible: boolean;
  recipe: StructuredRecipe | null;
  onClose: () => void;
  isDarkMode?: boolean;
}

const DEFAULT_SUGGESTED_TAGS = [
  'אסייתי',
  'איטלקי',
  'מהיר',
  'טבעוני',
  'צמחוני',
  'מרקים',
  'קינוחים',
  'בשרי',
  'חלבי',
  'פרווה',
  'ארוחת ערב',
  'ללא גלוטן'
];

export const TagEditorModal: React.FC<TagEditorModalProps> = ({
  visible,
  recipe,
  onClose,
  isDarkMode = false
}) => {
  const customTags = useRecipeStore((s) => s.customTags || []);
  const addCustomTag = useRecipeStore((s) => s.addCustomTag);
  const updateRecipeTags = useRecipeStore((s) => s.updateRecipeTags);

  const [selectedTags, setSelectedTags] = useState<string[]>([]);
  const [newTagInput, setNewTagInput] = useState('');

  useEffect(() => {
    if (recipe) {
      setSelectedTags(Array.isArray(recipe.tags) ? [...recipe.tags] : []);
    } else {
      setSelectedTags([]);
    }
    setNewTagInput('');
  }, [recipe, visible]);

  if (!recipe) return null;

  // Build unified list of unique available tags
  const allTagsSet = new Set<string>([...DEFAULT_SUGGESTED_TAGS, ...customTags, ...selectedTags]);
  const allAvailableTags = Array.from(allTagsSet).filter(Boolean);

  const handleToggleTag = (tag: string) => {
    if (selectedTags.includes(tag)) {
      setSelectedTags(selectedTags.filter((t) => t !== tag));
    } else {
      setSelectedTags([...selectedTags, tag]);
    }
  };

  const handleAddNewTag = () => {
    const trimmed = newTagInput.trim();
    if (!trimmed) {
      Alert.alert('שם תגית ריק', 'אנא הקלד שם לתגית החדשה (לדוגמה: מרקים, ילדים, פסח)');
      return;
    }

    // Add to global store tags
    addCustomTag(trimmed);

    // Select for current recipe if not already selected
    if (!selectedTags.includes(trimmed)) {
      setSelectedTags([...selectedTags, trimmed]);
    }

    setNewTagInput('');
  };

  const handleSave = () => {
    let finalTags = [...selectedTags];
    const pending = newTagInput.trim();
    if (pending) {
      addCustomTag(pending);
      if (!finalTags.includes(pending)) {
        finalTags.push(pending);
      }
    }
    updateRecipeTags(recipe.id, finalTags);
    onClose();
  };

  const themeCard = isDarkMode ? styles.darkCard : styles.lightCard;
  const themeText = isDarkMode ? styles.darkText : styles.lightText;
  const themeInput = isDarkMode ? styles.darkInput : styles.lightInput;

  return (
    <Modal
      visible={visible}
      transparent
      animationType="slide"
      onRequestClose={onClose}
    >
      <TouchableOpacity
        style={styles.modalBackdrop}
        activeOpacity={1}
        onPress={onClose}
      >
        <KeyboardAvoidingView
          behavior={Platform.OS === 'ios' ? 'padding' : undefined}
          style={{ width: '100%' }}
        >
          <View
            style={[styles.modalCard, themeCard]}
            onStartShouldSetResponder={() => true}
          >
          {/* Sheet Handle */}
          <View style={styles.sheetHandle} />

          {/* Modal Header */}
          <View style={styles.headerRow}>
            <Text style={[styles.headerTitle, themeText]}>🏷️ ניהול תגיות למתכון</Text>
            <TouchableOpacity onPress={onClose} style={styles.closeBtn}>
              <Text style={styles.closeBtnText}>✕</Text>
            </TouchableOpacity>
          </View>

          <Text style={styles.recipeTitleSub} numberOfLines={1}>
            {recipe.title}
          </Text>

          {/* Add New Custom Tag Input */}
          <View style={styles.inputSection}>
            <Text style={styles.sectionLabel}>הוספת תגית חדשה:</Text>
            <View style={styles.inputRow}>
              <TextInput
                style={[styles.tagInput, themeInput]}
                placeholder="למשל: מרקים, ארוחת ערב, מתוקים..."
                placeholderTextColor={isDarkMode ? '#64748b' : '#94a3b8'}
                value={newTagInput}
                onChangeText={setNewTagInput}
                onSubmitEditing={handleAddNewTag}
                returnKeyType="done"
              />
              <TouchableOpacity
                style={styles.addTagBtn}
                activeOpacity={0.8}
                onPress={handleAddNewTag}
              >
                <Text style={styles.addTagBtnText}>+ הוסף</Text>
              </TouchableOpacity>
            </View>
          </View>

          {/* Tag Selector Grid */}
          <Text style={styles.sectionLabel}>
            בחר תגיות למתכון (תומך בריבוי תיוגים):
          </Text>

          <ScrollView
            style={styles.tagsScrollView}
            contentContainerStyle={styles.tagsContainer}
            showsVerticalScrollIndicator={false}
          >
            {allAvailableTags.map((tag) => {
              const isSelected = selectedTags.includes(tag);
              return (
                <TouchableOpacity
                  key={tag}
                  style={[
                    styles.tagChip,
                    isDarkMode && styles.darkTagChip,
                    isSelected && styles.tagChipSelected
                  ]}
                  activeOpacity={0.7}
                  onPress={() => handleToggleTag(tag)}
                >
                  <Text
                    style={[
                      styles.tagChipText,
                      isDarkMode && styles.darkTagChipText,
                      isSelected && styles.tagChipTextSelected
                    ]}
                  >
                    {isSelected ? `✓ ${tag}` : tag}
                  </Text>
                </TouchableOpacity>
              );
            })}
          </ScrollView>

          {/* Active Tags Preview Summary */}
          <View style={styles.summaryRow}>
            <Text style={styles.summaryText}>
              נבחרו {selectedTags.length} תגיות למתכון זה
            </Text>
          </View>

          {/* Save Button */}
          <TouchableOpacity
            style={styles.saveBtn}
            activeOpacity={0.85}
            onPress={handleSave}
          >
            <Text style={styles.saveBtnText}>💾 שמור תגיות למתכון</Text>
          </TouchableOpacity>
        </View>
      </KeyboardAvoidingView>
    </TouchableOpacity>
  </Modal>
  );
};

const styles = StyleSheet.create({
  modalBackdrop: {
    flex: 1,
    backgroundColor: 'rgba(0, 0, 0, 0.55)',
    justifyContent: 'flex-end'
  },
  modalCard: {
    borderTopLeftRadius: 24,
    borderTopRightRadius: 24,
    padding: 20,
    paddingBottom: 36,
    maxHeight: '85%'
  },
  lightCard: {
    backgroundColor: '#ffffff'
  },
  darkCard: {
    backgroundColor: '#1e293b'
  },
  lightText: {
    color: '#0f172a'
  },
  darkText: {
    color: '#f8fafc'
  },
  sheetHandle: {
    width: 44,
    height: 5,
    backgroundColor: '#cbd5e1',
    borderRadius: 3,
    alignSelf: 'center',
    marginBottom: 16
  },
  headerRow: {
    flexDirection: 'row-reverse',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 4
  },
  headerTitle: {
    fontSize: 20,
    fontWeight: '800'
  },
  closeBtn: {
    padding: 6,
    borderRadius: 16,
    backgroundColor: '#f1f5f9'
  },
  closeBtnText: {
    fontSize: 16,
    fontWeight: '700',
    color: '#64748b'
  },
  recipeTitleSub: {
    fontSize: 14,
    color: '#059669',
    fontWeight: '700',
    textAlign: 'right',
    marginBottom: 16
  },
  inputSection: {
    marginBottom: 16
  },
  sectionLabel: {
    fontSize: 13,
    fontWeight: '700',
    color: '#64748b',
    textAlign: 'right',
    marginBottom: 8
  },
  inputRow: {
    flexDirection: 'row-reverse',
    gap: 8,
    alignItems: 'center'
  },
  tagInput: {
    flex: 1,
    height: 44,
    borderRadius: 12,
    paddingHorizontal: 14,
    fontSize: 14,
    textAlign: 'right',
    borderWidth: 1
  },
  lightInput: {
    backgroundColor: '#f8fafc',
    borderColor: '#e2e8f0',
    color: '#0f172a'
  },
  darkInput: {
    backgroundColor: '#0f172a',
    borderColor: '#334155',
    color: '#f8fafc'
  },
  addTagBtn: {
    backgroundColor: '#059669',
    paddingHorizontal: 16,
    height: 44,
    borderRadius: 12,
    justifyContent: 'center',
    alignItems: 'center'
  },
  addTagBtnText: {
    color: '#ffffff',
    fontWeight: '800',
    fontSize: 14
  },
  tagsScrollView: {
    maxHeight: 220,
    marginBottom: 12
  },
  tagsContainer: {
    flexDirection: 'row-reverse',
    flexWrap: 'wrap',
    gap: 8,
    paddingVertical: 4
  },
  tagChip: {
    paddingHorizontal: 14,
    paddingVertical: 8,
    borderRadius: 12,
    backgroundColor: '#f1f5f9',
    borderWidth: 1,
    borderColor: '#e2e8f0'
  },
  darkTagChip: {
    backgroundColor: '#0f172a',
    borderColor: '#334155'
  },
  tagChipSelected: {
    backgroundColor: '#059669',
    borderColor: '#047857'
  },
  tagChipText: {
    fontSize: 13,
    fontWeight: '700',
    color: '#475569'
  },
  darkTagChipText: {
    color: '#cbd5e1'
  },
  tagChipTextSelected: {
    color: '#ffffff'
  },
  summaryRow: {
    flexDirection: 'row-reverse',
    justifyContent: 'center',
    marginBottom: 14
  },
  summaryText: {
    fontSize: 12,
    color: '#64748b',
    fontWeight: '600'
  },
  saveBtn: {
    backgroundColor: '#059669',
    borderRadius: 14,
    paddingVertical: 14,
    alignItems: 'center',
    justifyContent: 'center',
    elevation: 2,
    shadowColor: '#059669',
    shadowOpacity: 0.3,
    shadowOffset: { width: 0, height: 2 },
    shadowRadius: 4
  },
  saveBtnText: {
    color: '#ffffff',
    fontSize: 16,
    fontWeight: '800'
  }
});
