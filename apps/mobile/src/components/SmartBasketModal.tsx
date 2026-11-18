import React, { useEffect, useState } from 'react';
import {
  ActivityIndicator,
  Alert,
  Linking,
  Modal,
  ScrollView,
  Share,
  StyleSheet,
  Text,
  TouchableOpacity,
  View,
} from 'react-native';
import { ApiClient } from '../services/api.client';
import { useRecipeStore } from '../store/recipeStore';

export interface SmartBasketModalItem {
  id: string;
  name: string;
  amount?: number | string | null;
  unit?: string | null;
  alreadyAtHome?: boolean;
}

interface SmartBasketModalProps {
  visible: boolean;
  onClose: () => void;
  items: SmartBasketModalItem[];
  recipeId?: string;
  recipeTitle?: string;
  fromShoppingList?: boolean;
  onAddToAppShoppingList?: () => void;
  onMarkItemsBought?: (itemIds: string[]) => void;
}

const STRIP_WORDS = new Set([
  'גרם', 'גר', 'ג', 'ק"ג', 'קג', 'קילו', 'קילוגרם', 'מ"ל', 'מל', 'ליטר', 'ל', 'ליטרים',
  'כוס', 'כוסות', 'כף', 'כפות', 'כפית', 'כפיות', 'יחידה', 'יחידות', 'יח', 'קורט', 'קמצוץ',
  'חבילה', 'חבילות', 'שקית', 'שקיות', 'קופסה', 'קופסאות', 'גביע', 'גביעים', 'פחית', 'פחיות',
  'צנצנת', 'שן', 'שיניים', 'שיני', 'ענף', 'ענפים', 'צרור', 'צרורות', 'פרוסה', 'פרוסות', 'עלה', 'עלים',
  'g', 'gr', 'gram', 'grams', 'kg', 'ml', 'l', 'liter', 'liters', 'cup', 'cups', 'tbsp', 'tsp', 'oz', 'lb', 'lbs', 'pcs', 'piece', 'pieces',
  'גדול', 'גדולה', 'גדולים', 'גדולות', 'קטן', 'קטנה', 'קטנים', 'קטנות', 'בינוני', 'בינונית', 'בינוניים', 'בינוניות',
  'טרי', 'טרייה', 'טריים', 'טריות', 'קצוץ', 'קצוצה', 'קצוצים', 'קצוצות', 'דק', 'גס',
  'מגורד', 'מגורדת', 'מגורדים', 'מגורדות', 'מגורר', 'מגוררת', 'מגוררים', 'כתוש', 'כתושה', 'כתושים', 'כתושות',
  'פרוס', 'פרוסה', 'פרוסים', 'פרוסות', 'טחון', 'טחונה', 'טחונים', 'טחונות', 'חתוך', 'חתוכה', 'חתוכים', 'חתוכות', 'לקוביות',
  'קלוף', 'קלופה', 'קלופים', 'מקולף', 'מקולפת', 'שטוף', 'שטופה', 'שטופים', 'מומס', 'מומסת', 'מומסים', 'רך', 'רכה',
  'מרוכך', 'מרוככת', 'טרוף', 'טרופה', 'טרופים', 'קלוי', 'קלויה', 'קלויים', 'קפוא', 'קפואה', 'קפואים', 'מבושל', 'מבושלת', 'אפוי', 'מאוד',
]);

function cleanIngredientQuery(rawName: string): string {
  let s = String(rawName || '').trim();
  s = s.replace(/\([^)]*\)/g, ' ').replace(/\[[^\]]*\]/g, ' ');
  s = s.replace(/[\u0591-\u05C7]/g, '');
  s = s.replace(/לפי הטעם|או לפי הטעם|לפי הצורך|לא חובה|מומלץ|אופציונלי|להגשה|לקישוט/g, ' ');
  s = s.replace(/^[\d.,/½¼¾⅓⅔\-\s]+/, ' ').replace(/[•·"'`״׳!?]/g, ' ');
  const tokens = s.replace(/[,;:\-–—]+/g, ' ').split(/\s+/).filter(Boolean);
  const kept = tokens.filter((t) => {
    if (/^[\d.,/½¼¾⅓⅔\-]+$/.test(t)) return false;
    return !STRIP_WORDS.has(t.trim().toLowerCase());
  });
  return kept.join(' ').trim() || String(rawName || '').trim();
}

export const SmartBasketModal: React.FC<SmartBasketModalProps> = ({
  visible,
  onClose,
  items,
  recipeId,
  recipeTitle,
  fromShoppingList = false,
  onAddToAppShoppingList,
  onMarkItemsBought,
}) => {
  const isDarkMode = useRecipeStore((s) => s.isDarkMode);
  const [loading, setLoading] = useState(false);
  const [openingStoreKey, setOpeningStoreKey] = useState<string | null>(null);
  const [merchants, setMerchants] = useState<
    Array<{
      id: string;
      displayName: string;
      status: string;
      selectable: boolean;
      disclosureText: string;
      estimatedTotal: number;
      matchedCount: number;
      totalCount: number;
      isCheapest: boolean;
    }>
  >([]);
  const [comparisonItems, setComparisonItems] = useState<
    Array<{
      query: string;
      normalizedQuery: string;
      matches: Record<
        string,
        {
          itemCode: string;
          productName: string;
          price: number;
          searchQuery: string;
          source: string;
        } | null
      >;
    }>
  >([]);
  const [selectedMerchantId, setSelectedMerchantId] = useState<string | null>(null);
  const [haveAtHomeIds, setHaveAtHomeIds] = useState<Record<string, boolean>>({});
  const [inCartIds, setInCartIds] = useState<Record<string, boolean>>({});

  const itemsSignature = items.map((it) => `${it.id}:${it.name}:${Boolean(it.alreadyAtHome)}`).join('|');

  useEffect(() => {
    if (!visible || items.length === 0) return;

    let cancelled = false;
    const initialAtHome: Record<string, boolean> = {};
    for (const it of items) {
      if (it.alreadyAtHome) {
        initialAtHome[it.id] = true;
      }
    }
    setHaveAtHomeIds(initialAtHome);
    setInCartIds({});
    setLoading(true);

    const queries = items.map((it) => cleanIngredientQuery(it.name)).filter(Boolean);

    ApiClient.compareSupermarketBasket(queries)
      .then((data) => {
        if (cancelled) return;
        const selectable = (data.merchants || []).filter((m) => m.selectable);
        setMerchants(selectable);
        setComparisonItems(data.items || []);

        if (selectable.length > 0) {
          const cheapest = selectable.find((m) => m.isCheapest);
          setSelectedMerchantId((cheapest || selectable[0]).id);
        }
      })
      .catch(() => {
        if (!cancelled) {
          setMerchants([]);
          setComparisonItems([]);
        }
      })
      .finally(() => {
        if (!cancelled) setLoading(false);
      });

    return () => {
      cancelled = true;
    };
  }, [visible, itemsSignature]);

  const activeMerchant = merchants.find((m) => m.id === selectedMerchantId) || merchants[0] || null;

  const findMatchForIngredient = (rawName: string, merchantId?: string | null) => {
    if (!merchantId) return null;
    const clean = cleanIngredientQuery(rawName).toLowerCase();
    const row = comparisonItems.find(
      (ci) =>
        String(ci.query || '').trim().toLowerCase() === clean ||
        String(ci.normalizedQuery || '').trim().toLowerCase() === clean
    );
    return row && row.matches ? row.matches[merchantId] || null : null;
  };

  const activeToBuy = items.filter((it) => !haveAtHomeIds[it.id]);
  const pendingCartItems = activeToBuy.filter((it) => !inCartIds[it.id]);
  const inCartCount = activeToBuy.length - pendingCartItems.length;
  const nextPendingItem = pendingCartItems.length > 0 ? pendingCartItems[0] : null;
  const nextPendingMatch = nextPendingItem
    ? findMatchForIngredient(nextPendingItem.name, activeMerchant?.id)
    : null;

  const handleOpenStoreForItem = async (item: SmartBasketModalItem) => {
    if (!activeMerchant) return;
    const query = cleanIngredientQuery(item.name);
    const match = findMatchForIngredient(item.name, activeMerchant.id);
    setOpeningStoreKey(item.id);
    try {
      const { fullRedirectUrl } = await ApiClient.createAffiliateStoreLink({
        merchantId: activeMerchant.id,
        query,
        productName: match?.productName || undefined,
        sku: match?.itemCode,
        recipeId,
      });
      setInCartIds((prev) => ({ ...prev, [item.id]: true }));
      await Linking.openURL(fullRedirectUrl);
    } catch (err: any) {
      Alert.alert('שגיאה בפתיחת החנות', err?.message || 'לא ניתן לפתוח את קישור החנות כעת');
    } finally {
      setOpeningStoreKey(null);
    }
  };

  const handleShareList = async () => {
    const text = activeToBuy
      .map((it) => {
        const qty = [it.amount, it.unit].filter(Boolean).join(' ');
        return `• ${qty ? `${qty} ` : ''}${it.name}`;
      })
      .join('\n');

    try {
      await Share.share({
        message: `${recipeTitle ? `סל מצרכים - ${recipeTitle}:\n` : 'סל מצרכים לקנייה:\n'}${text}`,
      });
    } catch {}
  };

  const handleCompleteShoppingList = () => {
    if (!onMarkItemsBought) return;
    const idsToMark =
      inCartCount > 0
        ? activeToBuy.filter((it) => inCartIds[it.id]).map((it) => it.id)
        : activeToBuy.map((it) => it.id);
    onMarkItemsBought(idsToMark);
    onClose();
  };

  return (
    <Modal visible={visible} transparent animationType="slide" onRequestClose={onClose}>
      <View style={styles.overlay}>
        <View style={[styles.sheet, isDarkMode && styles.darkSheet]}>
          {/* Header */}
          <View style={styles.header}>
            <TouchableOpacity style={styles.closeBtn} onPress={onClose}>
              <Text style={styles.closeBtnText}>✕</Text>
            </TouchableOpacity>
            <View style={styles.headerTitleWrap}>
              <Text style={[styles.title, isDarkMode && styles.darkText]}>
                🛍️ השוואת סלים וקנייה בסופר
              </Text>
              <Text style={styles.subtitle} numberOfLines={1}>
                {recipeTitle || 'רשימת הקניות שלי'} • {activeToBuy.length} מצרכים לקנייה
              </Text>
            </View>
          </View>

          {loading ? (
            <View style={styles.loadingWrap}>
              <ActivityIndicator size="large" color="#059669" />
              <Text style={[styles.loadingText, isDarkMode && styles.darkText]}>
                משווה מחירי מצרכים מול שופרסל, רמי לוי וחצי חינם...
              </Text>
            </View>
          ) : (
            <ScrollView style={styles.body} showsVerticalScrollIndicator={false}>
              {/* 1. Supermarket Chain Comparison Cards */}
              <Text style={[styles.sectionLabel, isDarkMode && styles.darkText]}>
                בחירת רשת שיווק והשוואת מחיר סל משוער:
              </Text>
              <View style={styles.merchantsRow}>
                {merchants.map((m) => {
                  const isSelected = activeMerchant?.id === m.id;
                  const hasTotal = typeof m.estimatedTotal === 'number' && m.estimatedTotal > 0;
                  return (
                    <TouchableOpacity
                      key={m.id}
                      style={[
                        styles.merchantCard,
                        isDarkMode && styles.darkCard,
                        isSelected && styles.merchantCardActive,
                      ]}
                      activeOpacity={0.8}
                      onPress={() => setSelectedMerchantId(m.id)}
                    >
                      {m.isCheapest && (
                        <View style={styles.cheapestBadge}>
                          <Text style={styles.cheapestBadgeText}>הכי משתלם 🏆</Text>
                        </View>
                      )}
                      <Text
                        style={[
                          styles.merchantName,
                          isDarkMode && styles.darkText,
                          isSelected && styles.merchantNameActive,
                        ]}
                      >
                        {m.displayName}
                      </Text>
                      <Text
                        style={[
                          styles.merchantPrice,
                          isSelected && styles.merchantPriceActive,
                        ]}
                      >
                        {hasTotal ? `~₪${m.estimatedTotal.toFixed(2)}` : 'זמין לחיפוש'}
                      </Text>
                      {hasTotal && (
                        <Text
                          style={[
                            styles.merchantMeta,
                            isSelected && styles.merchantMetaActive,
                          ]}
                        >
                          {m.matchedCount}/{m.totalCount} מוצרים זוהו
                        </Text>
                      )}
                    </TouchableOpacity>
                  );
                })}
              </View>

              {/* 2. Guided Cart Filler Banner */}
              {activeMerchant && activeToBuy.length > 0 && (
                <View style={styles.guidedCard}>
                  <View style={styles.guidedHeaderRow}>
                    <Text style={styles.guidedCounter}>
                      {inCartCount} מתוך {activeToBuy.length} בעגלה
                    </Text>
                    <Text style={styles.guidedTitle}>
                      🚀 מילוי עגלה מהיר ב-{activeMerchant.displayName}
                    </Text>
                  </View>

                  {nextPendingItem ? (
                    <>
                      <View style={styles.nextItemBox}>
                        <TouchableOpacity
                          style={styles.skipBtn}
                          onPress={() =>
                            setInCartIds((prev) => ({
                              ...prev,
                              [nextPendingItem.id]: true,
                            }))
                          }
                        >
                          <Text style={styles.skipBtnText}>סמן בעגלה ✓</Text>
                        </TouchableOpacity>
                        <View style={styles.nextItemTextWrap}>
                          <Text style={styles.nextItemLabel}>המוצר הבא להוספה:</Text>
                          <Text style={styles.nextItemName}>{nextPendingItem.name}</Text>
                          {nextPendingMatch && (
                            <Text style={styles.nextItemMatch}>
                              📦 {nextPendingMatch.productName} • ₪
                              {Number(nextPendingMatch.price).toFixed(2)}
                            </Text>
                          )}
                        </View>
                      </View>

                      <TouchableOpacity
                        style={styles.guidedPrimaryBtn}
                        disabled={openingStoreKey === nextPendingItem.id}
                        onPress={() => handleOpenStoreForItem(nextPendingItem)}
                      >
                        <Text style={styles.guidedPrimaryBtnText}>
                          {openingStoreKey === nextPendingItem.id
                            ? 'פותח מוצר בחנות...'
                            : `🛒 פתח מוצר ב-${activeMerchant.displayName} והמשך לבא ➜`}
                        </Text>
                      </TouchableOpacity>
                    </>
                  ) : (
                    <Text style={styles.allDoneText}>
                      🎉 כל {activeToBuy.length} המצרכים סומנו בעגלה של{' '}
                      {activeMerchant.displayName}!
                    </Text>
                  )}
                </View>
              )}

              {/* Attribution Disclosure */}
              {activeMerchant && (
                <View style={styles.disclosureBox}>
                  <Text style={styles.disclosureText}>
                    🔗 {activeMerchant.disclosureText} • לחיצה על "יש בבית" תוריד את המצרך מהסל.
                  </Text>
                </View>
              )}

              {/* 3. Ingredient Items List */}
              {items.map((item) => {
                const isAtHome = Boolean(haveAtHomeIds[item.id]);
                const isInCart = Boolean(inCartIds[item.id]);
                const match = findMatchForIngredient(item.name, activeMerchant?.id);
                const qtyStr = [item.amount, item.unit].filter(Boolean).join(' ');

                return (
                  <View
                    key={item.id}
                    style={[
                      styles.itemRow,
                      isDarkMode && styles.darkCard,
                      isInCart && !isAtHome && styles.itemRowInCart,
                      isAtHome && styles.itemRowAtHome,
                    ]}
                  >
                    <View style={styles.itemActionsLeft}>
                      {!isAtHome && activeMerchant && (
                        <TouchableOpacity
                          style={[
                            styles.buyItemBtn,
                            isInCart && styles.buyItemBtnDone,
                          ]}
                          disabled={openingStoreKey === item.id}
                          onPress={() => handleOpenStoreForItem(item)}
                        >
                          <Text
                            style={[
                              styles.buyItemBtnText,
                              isInCart && styles.buyItemBtnTextDone,
                            ]}
                          >
                            {isInCart ? '🔄 שוב' : '🛒 לקנייה'}
                          </Text>
                        </TouchableOpacity>
                      )}
                    </View>

                    <TouchableOpacity
                      style={styles.itemMainRight}
                      activeOpacity={0.7}
                      onPress={() =>
                        setHaveAtHomeIds((prev) => ({
                          ...prev,
                          [item.id]: !prev[item.id],
                        }))
                      }
                    >
                      <View style={styles.itemTextCol}>
                        <View style={styles.itemTitleLine}>
                          {isInCart && !isAtHome && (
                            <View style={styles.inCartPill}>
                              <Text style={styles.inCartPillText}>בעגלה ✓</Text>
                            </View>
                          )}
                          <Text
                            style={[
                              styles.itemName,
                              isDarkMode && styles.darkText,
                              isAtHome && styles.strikethrough,
                            ]}
                          >
                            {qtyStr ? `${qtyStr} ` : ''}
                            {item.name}
                          </Text>
                        </View>
                        <Text style={styles.itemSubText} numberOfLines={1}>
                          {isAtHome
                            ? 'סומן: יש בבית 🏠'
                            : match
                            ? `📦 ${match.productName} • ₪${Number(match.price).toFixed(2)}`
                            : `לחיפוש: ${cleanIngredientQuery(item.name)}`}
                        </Text>
                      </View>

                      <View
                        style={[
                          styles.homeCheck,
                          isAtHome && styles.homeCheckActive,
                        ]}
                      >
                        <Text style={styles.homeCheckIcon}>
                          {isAtHome ? '🏠' : '⬜'}
                        </Text>
                      </View>
                    </TouchableOpacity>
                  </View>
                );
              })}
            </ScrollView>
          )}

          {/* Footer Actions */}
          <View style={styles.footer}>
            <TouchableOpacity style={styles.secondaryBtn} onPress={handleShareList}>
              <Text style={styles.secondaryBtnText}>
                📤 שיתוף ({activeToBuy.length})
              </Text>
            </TouchableOpacity>

            {fromShoppingList && onMarkItemsBought ? (
              <TouchableOpacity
                style={styles.primaryBtn}
                onPress={handleCompleteShoppingList}
              >
                <Text style={styles.primaryBtnText}>
                  ✅ סמן שנקנו ({inCartCount || activeToBuy.length})
                </Text>
              </TouchableOpacity>
            ) : (
              onAddToAppShoppingList && (
                <TouchableOpacity
                  style={styles.primaryBtn}
                  onPress={() => {
                    onAddToAppShoppingList();
                    onClose();
                  }}
                >
                  <Text style={styles.primaryBtnText}>🛒 הוסף לרשימת הקניות</Text>
                </TouchableOpacity>
              )
            )}
          </View>
        </View>
      </View>
    </Modal>
  );
};

const styles = StyleSheet.create({
  overlay: {
    flex: 1,
    backgroundColor: 'rgba(15, 23, 42, 0.6)',
    justifyContent: 'flex-end',
  },
  sheet: {
    backgroundColor: '#f8fafc',
    borderTopLeftRadius: 24,
    borderTopRightRadius: 24,
    maxHeight: '90%',
    paddingBottom: 20,
    paddingHorizontal: 16,
    paddingTop: 14,
  },
  darkSheet: {
    backgroundColor: '#0f172a',
  },
  darkCard: {
    backgroundColor: '#1e293b',
    borderColor: '#334155',
  },
  darkText: {
    color: '#f8fafc',
  },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    marginBottom: 12,
    borderBottomWidth: 1,
    borderBottomColor: '#e2e8f0',
    paddingBottom: 10,
  },
  headerTitleWrap: {
    flex: 1,
    alignItems: 'flex-end',
  },
  title: {
    fontSize: 18,
    fontWeight: '900',
    color: '#064e3b',
    textAlign: 'right',
  },
  subtitle: {
    fontSize: 12,
    color: '#64748b',
    marginTop: 2,
    textAlign: 'right',
  },
  closeBtn: {
    width: 34,
    height: 34,
    borderRadius: 17,
    backgroundColor: '#e2e8f0',
    alignItems: 'center',
    justifyContent: 'center',
    marginRight: 10,
  },
  closeBtnText: {
    fontSize: 16,
    fontWeight: '800',
    color: '#334155',
  },
  loadingWrap: {
    paddingVertical: 45,
    alignItems: 'center',
    justifyContent: 'center',
  },
  loadingText: {
    marginTop: 12,
    fontSize: 14,
    fontWeight: '700',
    color: '#334155',
    textAlign: 'center',
  },
  body: {
    maxHeight: 500,
  },
  sectionLabel: {
    fontSize: 13,
    fontWeight: '800',
    color: '#064e3b',
    textAlign: 'right',
    marginBottom: 8,
  },
  merchantsRow: {
    flexDirection: 'row-reverse',
    flexWrap: 'wrap',
    gap: 8,
    marginBottom: 12,
  },
  merchantCard: {
    flex: 1,
    minWidth: 100,
    backgroundColor: '#ffffff',
    borderWidth: 1.5,
    borderColor: '#cbd5e1',
    borderRadius: 12,
    padding: 10,
    alignItems: 'flex-end',
  },
  merchantCardActive: {
    backgroundColor: '#064e3b',
    borderColor: '#059669',
  },
  cheapestBadge: {
    backgroundColor: '#f59e0b',
    borderRadius: 10,
    paddingHorizontal: 6,
    paddingVertical: 2,
    marginBottom: 4,
  },
  cheapestBadgeText: {
    color: '#ffffff',
    fontSize: 10,
    fontWeight: '900',
  },
  merchantName: {
    fontSize: 13,
    fontWeight: '800',
    color: '#0f172a',
    textAlign: 'right',
  },
  merchantNameActive: {
    color: '#ffffff',
  },
  merchantPrice: {
    fontSize: 15,
    fontWeight: '900',
    color: '#059669',
    marginTop: 2,
  },
  merchantPriceActive: {
    color: '#6ee7b7',
  },
  merchantMeta: {
    fontSize: 10,
    color: '#64748b',
    marginTop: 2,
  },
  merchantMetaActive: {
    color: '#d1fae5',
  },
  guidedCard: {
    backgroundColor: '#ecfdf5',
    borderWidth: 1.5,
    borderColor: '#10b981',
    borderRadius: 14,
    padding: 12,
    marginBottom: 10,
  },
  guidedHeaderRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 8,
  },
  guidedTitle: {
    fontSize: 12,
    fontWeight: '900',
    color: '#065f46',
  },
  guidedCounter: {
    fontSize: 11,
    fontWeight: '800',
    color: '#047857',
  },
  nextItemBox: {
    backgroundColor: '#ffffff',
    borderWidth: 1,
    borderColor: '#a7f3d0',
    borderRadius: 10,
    padding: 10,
    marginBottom: 8,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
  },
  nextItemTextWrap: {
    flex: 1,
    alignItems: 'flex-end',
    marginLeft: 8,
  },
  nextItemLabel: {
    fontSize: 11,
    fontWeight: '700',
    color: '#047857',
  },
  nextItemName: {
    fontSize: 15,
    fontWeight: '900',
    color: '#0f172a',
    textAlign: 'right',
  },
  nextItemMatch: {
    fontSize: 12,
    fontWeight: '700',
    color: '#059669',
    marginTop: 2,
    textAlign: 'right',
  },
  skipBtn: {
    backgroundColor: '#f1f5f9',
    borderWidth: 1,
    borderColor: '#cbd5e1',
    borderRadius: 8,
    paddingHorizontal: 8,
    paddingVertical: 5,
  },
  skipBtnText: {
    fontSize: 11,
    fontWeight: '700',
    color: '#334155',
  },
  guidedPrimaryBtn: {
    backgroundColor: '#059669',
    borderRadius: 10,
    paddingVertical: 11,
    alignItems: 'center',
  },
  guidedPrimaryBtnText: {
    color: '#ffffff',
    fontSize: 14,
    fontWeight: '900',
  },
  allDoneText: {
    color: '#065f46',
    fontWeight: '800',
    fontSize: 13,
    textAlign: 'center',
    paddingVertical: 4,
  },
  disclosureBox: {
    backgroundColor: '#f1f5f9',
    borderRadius: 8,
    paddingHorizontal: 10,
    paddingVertical: 6,
    marginBottom: 10,
  },
  disclosureText: {
    fontSize: 11,
    color: '#475569',
    textAlign: 'right',
  },
  itemRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    backgroundColor: '#ffffff',
    borderWidth: 1,
    borderColor: '#e2e8f0',
    borderRadius: 12,
    paddingVertical: 9,
    paddingHorizontal: 10,
    marginBottom: 7,
  },
  itemRowInCart: {
    backgroundColor: '#f0fdf4',
    borderColor: '#10b981',
  },
  itemRowAtHome: {
    opacity: 0.5,
  },
  itemActionsLeft: {
    marginRight: 8,
  },
  buyItemBtn: {
    backgroundColor: '#059669',
    borderRadius: 8,
    paddingHorizontal: 10,
    paddingVertical: 6,
  },
  buyItemBtnDone: {
    backgroundColor: '#d1fae5',
    borderWidth: 1,
    borderColor: '#10b981',
  },
  buyItemBtnText: {
    color: '#ffffff',
    fontSize: 12,
    fontWeight: '800',
  },
  buyItemBtnTextDone: {
    color: '#065f46',
  },
  itemMainRight: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'flex-end',
  },
  itemTextCol: {
    flex: 1,
    alignItems: 'flex-end',
    marginRight: 8,
  },
  itemTitleLine: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'flex-end',
    gap: 6,
  },
  itemName: {
    fontSize: 14,
    fontWeight: '800',
    color: '#0f172a',
    textAlign: 'right',
  },
  strikethrough: {
    textDecorationLine: 'line-through',
  },
  inCartPill: {
    backgroundColor: '#10b981',
    borderRadius: 10,
    paddingHorizontal: 6,
    paddingVertical: 1,
  },
  inCartPillText: {
    color: '#ffffff',
    fontSize: 10,
    fontWeight: '800',
  },
  itemSubText: {
    fontSize: 11,
    color: '#047857',
    fontWeight: '600',
    marginTop: 2,
    textAlign: 'right',
  },
  homeCheck: {
    width: 28,
    height: 28,
    alignItems: 'center',
    justifyContent: 'center',
  },
  homeCheckActive: {
    opacity: 1,
  },
  homeCheckIcon: {
    fontSize: 16,
  },
  footer: {
    flexDirection: 'row',
    gap: 10,
    marginTop: 12,
    paddingTop: 10,
    borderTopWidth: 1,
    borderTopColor: '#e2e8f0',
  },
  secondaryBtn: {
    flex: 1,
    backgroundColor: '#e2e8f0',
    borderRadius: 12,
    paddingVertical: 12,
    alignItems: 'center',
  },
  secondaryBtnText: {
    color: '#1e293b',
    fontSize: 13,
    fontWeight: '800',
  },
  primaryBtn: {
    flex: 1.4,
    backgroundColor: '#059669',
    borderRadius: 12,
    paddingVertical: 12,
    alignItems: 'center',
  },
  primaryBtnText: {
    color: '#ffffff',
    fontSize: 13,
    fontWeight: '900',
  },
});
