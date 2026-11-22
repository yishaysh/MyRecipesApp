import React, { useEffect, useMemo, useRef, useState } from 'react';
import {
  ActivityIndicator,
  Alert,
  Linking,
  Modal,
  Platform,
  ScrollView,
  Share,
  StyleSheet,
  Text,
  TextInput,
  TouchableOpacity,
  View,
} from 'react-native';
import * as Clipboard from 'expo-clipboard';
import {
  buildCleanStorePasteList,
  buildPersonalReferenceList,
  canonicalIngredientKey,
  extractDietaryConstraints,
  MIN_MATCH_CONFIDENCE,
  PreparedShoppingItem,
  prepareShoppingIngredients,
} from '@myrecipes/shared';
import { ApiClient } from '../services/api.client';
import { useRecipeStore } from '../store/recipeStore';

export interface SmartBasketModalItem {
  id: string;
  name: string;
  amount?: number | string | null;
  unit?: string | null;
  alreadyAtHome?: boolean;
  qtyMode?: string | null;
}

interface SmartBasketModalProps {
  visible: boolean;
  onClose: () => void;
  items: SmartBasketModalItem[];
  recipeId?: string;
  recipeTitle?: string;
  baseServings?: number;
  initialMultiplier?: number;
  fromShoppingList?: boolean;
  onAddToAppShoppingList?: () => void;
  onMarkItemsBought?: (itemIds: string[]) => void;
}

interface ItemCustomOverride {
  shoppingName?: string;
  amount?: number | null;
  unit?: string;
}

interface ScopedHandoffFeedback {
  merchantId: string;
  listRevision: number;
  tone: 'success' | 'warning' | 'error';
  message: string;
  fallbackStoreUrl?: string;
}

const CHAIN_SPECIFIC_GUIDE_HE: Record<
  string,
  {
    menuPathHe: string;
    summaryHe: string;
    stepsHe: string[];
  }
> = {
  hazi_hinam: {
    menuPathHe: 'קנייה מהירה מרשימה (quickbuy/editor)',
    summaryHe:
      'חצי חינם: נפתח ישירות בעורך הקנייה המהירה (quickbuy/editor) — הדביקו את הרשימה (שורה לכל מצרך), בדקו מוצרים וכמויות, והוסיפו לסל בחנות.',
    stepsHe: [
      'העתיקו את הרשימה הנקייה (מצרך אחד בכל שורה, ללא כמויות)',
      'החנות נפתחת ישירות בעורך הקנייה המהירה (quickbuy/editor) — הדביקו את הרשימה בתיבה',
      'בדקו את המוצרים והכמויות שנבחרו ואשרו הוספה לסל בחנות',
    ],
  },
  shufersal: {
    menuPathHe: 'רשימות והזמנות ← הזמנה מהירה',
    summaryHe:
      'שופרסל אונליין: באתר שופרסל לחצו על רשימות והזמנות ← הזמנה מהירה, הדביקו את הרשימה פעם אחת, ובדקו את המוצרים והכמויות לפני אישור.',
    stepsHe: [
      'העתיקו את הרשימה הנקייה (מצרך אחד בכל שורה)',
      'באתר שופרסל לחצו על רשימות והזמנות ← הזמנה מהירה והדביקו את הרשימה פעם אחת',
      'בדקו את המוצרים והכמויות לפני אישור בחנות',
    ],
  },
  rami_levy: {
    menuPathHe: 'סרגל עליון ← קניה מהירה ← הדבקת הרשימה ← המשך',
    summaryHe:
      'רמי לוי באינטרנט: בסרגל העליון לחצו על קניה מהירה, הדביקו את הרשימה ולחצו המשך לבחירת המוצרים והכמויות.',
    stepsHe: [
      'העתיקו את הרשימה הנקייה (מצרך אחד בכל שורה)',
      'בסרגל העליון באתר רמי לוי לחצו על קניה מהירה והדביקו את הרשימה',
      'לחצו המשך לבחירת המוצרים והכמויות בחנות',
    ],
  },
};

const QUANTITY_TRANSFER_REMINDER_HE =
  'שימו לב: כמויות אינן עוברות אוטומטית בהדבקת רשימה, ובחירות המוצרים בחנות הן בגדר הצעה בלבד — יש לבדוק ולאשר מוצרים וכמויות באתר הרשת.';

const PROVENANCE_EXCLUSIONS_NOTE_HE =
  'המחירים הם אומדן מקטלוג השקיפות ואינם כוללים דמי משלוח, מינימום הזמנה, מבצעי מועדון או זמינות במלאי';

async function copyTextSafe(text: string, timeoutMs = 2000): Promise<boolean> {
  if (!text) return false;
  const withTimeout = (promise: Promise<boolean>): Promise<boolean> =>
    Promise.race([
      promise.catch(() => false),
      new Promise<boolean>((resolve) => setTimeout(() => resolve(false), timeoutMs)),
    ]);

  try {
    if (Platform.OS === 'web' && typeof document !== 'undefined') {
      try {
        const ta = document.createElement('textarea');
        ta.value = text;
        ta.setAttribute('readonly', '');
        ta.style.position = 'fixed';
        ta.style.top = '-9999px';
        ta.style.opacity = '0';
        document.body.appendChild(ta);
        ta.focus();
        ta.select();
        const ok = document.execCommand && document.execCommand('copy');
        document.body.removeChild(ta);
        if (ok) return true;
      } catch {}
      if (typeof navigator !== 'undefined' && navigator.clipboard?.writeText) {
        return await withTimeout(navigator.clipboard.writeText(text).then(() => true));
      }
    }
    return await withTimeout(Clipboard.setStringAsync(text).then(() => true));
  } catch {
    return false;
  }
}

export const SmartBasketModal: React.FC<SmartBasketModalProps> = ({
  visible,
  onClose,
  items,
  recipeId,
  recipeTitle,
  baseServings = 4,
  initialMultiplier = 1,
  fromShoppingList = false,
  onAddToAppShoppingList,
  onMarkItemsBought,
}) => {
  const isDarkMode = useRecipeStore((s) => s.isDarkMode);
  const [loading, setLoading] = useState(false);
  const [openingStoreKey, setOpeningStoreKey] = useState<string | null>(null);
  const [multiplier, setMultiplier] = useState<number>(initialMultiplier || 1);
  const [listRevision, setListRevision] = useState<number>(1);
  const compareSeqRef = useRef<number>(0);

  const [merchants, setMerchants] = useState<
    Array<{
      id: string;
      displayName: string;
      status: string;
      selectable: boolean;
      disclosureText: string;
      entryUrl?: string;
      handoffMode?: string;
      menuPathHe?: string;
      instructionsStepsHe?: string[];
      quantityTransferNoteHe?: string;
      estimatedTotal: number;
      purchasableTotal?: number;
      consumptionTotal?: number;
      matchedCount: number;
      totalCount: number;
      missingCount?: number;
      missingItems?: string[];
      isCompleteBasket?: boolean;
      hasUnknownPackSize?: boolean;
      exclusionsNote?: string;
      isCheapest: boolean;
    }>
  >([]);

  const [comparisonItems, setComparisonItems] = useState<
    Array<{
      itemId?: string;
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
          confidence?: number;
          pricingBasis?: string;
          pricingBasisLabel?: string;
          packSizeLabel?: string | null;
          packSizeUnknown?: boolean;
          packsNeeded?: number;
          purchasableCost?: number;
          consumptionCost?: number;
        } | null
      >;
    }>
  >([]);

  const [fetchError, setFetchError] = useState<string | null>(null);
  const [retryNonce, setRetryNonce] = useState<number>(0);
  const [minMatchConfidence, setMinMatchConfidence] = useState<number>(MIN_MATCH_CONFIDENCE);
  const [comparisonRevisionKey, setComparisonRevisionKey] = useState<string>('');
  const [selectedMerchantId, setSelectedMerchantId] = useState<string | null>(null);
  const [haveAtHomeIds, setHaveAtHomeIds] = useState<Record<string, boolean>>({});
  const [skippedIds, setSkippedIds] = useState<Record<string, boolean>>({});
  const [selfReportedBoughtIds, setSelfReportedBoughtIds] = useState<Record<string, boolean>>({});
  const [selectedAlternatives, setSelectedAlternatives] = useState<Record<string, string>>({});
  const [customOverrides, setCustomOverrides] = useState<Record<string, ItemCustomOverride>>({});
  const [editingItemId, setEditingItemId] = useState<string | null>(null);
  const [editNameDraft, setEditNameDraft] = useState<string>('');
  const [editAmountDraft, setEditAmountDraft] = useState<string>('');
  const [editUnitDraft, setEditUnitDraft] = useState<string>('');
  const [showPlainCopyBox, setShowPlainCopyBox] = useState<boolean>(false);
  const [showChainDetails, setShowChainDetails] = useState<boolean>(false);
  const [showHandoffDetails, setShowHandoffDetails] = useState<boolean>(false);
  const [handoffFeedback, setHandoffFeedback] = useState<ScopedHandoffFeedback | null>(null);

  const itemsSignature = items
    .map((it) => `${it.id}:${it.name}:${it.amount ?? ''}:${it.unit ?? ''}:${Boolean(it.alreadyAtHome)}`)
    .join('|');

  // Reset modal session state when opened with a new recipe/list
  useEffect(() => {
    if (!visible) return;
    setMultiplier(initialMultiplier || 1);
    setSkippedIds({});
    setSelfReportedBoughtIds({});
    setSelectedAlternatives({});
    setCustomOverrides({});
    setEditingItemId(null);
    setShowPlainCopyBox(false);
    setShowChainDetails(false);
    setShowHandoffDetails(false);
    setHandoffFeedback(null);
    setListRevision((r) => r + 1);
  }, [visible, itemsSignature, initialMultiplier]);

  const preparedItems: PreparedShoppingItem[] = useMemo(() => {
    const rawPrepared = prepareShoppingIngredients(
      [
        {
          id: recipeId || 'modal_recipe',
          title: recipeTitle || 'רשימת הקניות שלי',
          servings: baseServings,
          ingredients: items.map((it) => ({
            name: it.name,
            amount: it.amount,
            unit: it.unit,
            qtyMode: it.qtyMode,
          })),
        },
      ],
      multiplier
    );

    return rawPrepared.map((prep) => {
      const altChoice = selectedAlternatives[prep.id];
      const override = customOverrides[prep.id];
      const effectiveShoppingName =
        (override?.shoppingName && override.shoppingName.trim()) ||
        altChoice ||
        prep.shoppingName;
      const effectiveAmount =
        override && override.amount !== undefined ? override.amount : prep.amount;
      const effectiveUnit =
        override && override.unit !== undefined ? override.unit : prep.unit;
      const effectiveDisplayQuantity =
        override && (override.amount !== undefined || override.unit !== undefined)
          ? [
              effectiveAmount !== null && effectiveAmount !== undefined ? String(effectiveAmount) : '',
              effectiveUnit || '',
            ]
              .filter(Boolean)
              .join(' ') || prep.displayQuantity
          : prep.displayQuantity;
      const mergedConstraints = Array.from(
        new Set([
          ...prep.dietaryConstraints,
          ...extractDietaryConstraints(effectiveShoppingName),
        ])
      );

      return {
        ...prep,
        shoppingName: effectiveShoppingName,
        searchQuery: effectiveShoppingName,
        displayName: effectiveShoppingName,
        selectedAlternative: altChoice || prep.selectedAlternative,
        amount: effectiveAmount,
        unit: effectiveUnit,
        displayQuantity: effectiveDisplayQuantity,
        dietaryConstraints: mergedConstraints,
      };
    });
  }, [items, recipeId, recipeTitle, baseServings, multiplier, selectedAlternatives, customOverrides]);

  // Initialize "have at home" from caller's checked state when items change
  useEffect(() => {
    if (!visible || items.length === 0) return;
    const nextHome: Record<string, boolean> = {};
    for (const src of items) {
      if (src.alreadyAtHome) {
        const preparedFromSrc = prepareShoppingIngredients(
          [{ ingredients: [{ name: src.name, amount: src.amount, unit: src.unit }] }],
          1
        );
        for (const p of preparedFromSrc) {
          nextHome[p.id] = true;
        }
      }
    }
    setHaveAtHomeIds(nextHome);
  }, [visible, itemsSignature]);

  const activeItems = useMemo(
    () =>
      preparedItems.filter(
        (it) => !haveAtHomeIds[it.id] && !skippedIds[it.id]
      ),
    [preparedItems, haveAtHomeIds, skippedIds]
  );

  const activeItemsPayloadKey = useMemo(
    () =>
      activeItems
        .map(
          (it) =>
            `${it.id}:${it.shoppingName}:${it.amount ?? ''}:${it.unit ?? ''}:${it.dietaryConstraints.join(',')}`
        )
        .join('|'),
    [activeItems]
  );

  // Trigger POST /api/public/basket-compare with compareSeq request counter
  useEffect(() => {
    if (!visible) return;
    if (activeItems.length === 0) {
      setComparisonItems([]);
      setFetchError(null);
      setLoading(false);
      setComparisonRevisionKey(`${listRevision}:empty`);
      return;
    }

    const seq = ++compareSeqRef.current;
    const revSnapshot = listRevision;
    setLoading(true);
    setFetchError(null);

    const structuredPayload = activeItems.map((it) => ({
      id: it.id,
      query: it.shoppingName,
      amount: it.amount,
      unit: it.unit || null,
      dietaryConstraints: it.dietaryConstraints,
    }));

    ApiClient.compareSupermarketBasket({
      items: structuredPayload,
      queries: structuredPayload.map((s) => s.query),
    })
      .then((data) => {
        if (seq !== compareSeqRef.current) return;
        const selectable = (data.merchants || []).filter((m) => m.selectable);
        setMerchants(selectable);
        setComparisonItems(data.items || []);
        if (typeof data.minMatchConfidence === 'number') {
          setMinMatchConfidence(data.minMatchConfidence);
        }
        setFetchError(null);
        setComparisonRevisionKey(`${revSnapshot}:${activeItemsPayloadKey}`);

        setSelectedMerchantId((prevId) => {
          if (prevId && selectable.some((m) => m.id === prevId)) {
            return prevId;
          }
          if (selectable.length === 0) return null;
          const completeCheapest = selectable.find(
            (m) =>
              m.isCheapest &&
              !m.hasUnknownPackSize &&
              (m.isCompleteBasket === true ||
                (m.totalCount > 0 && m.matchedCount === m.totalCount))
          );
          return (completeCheapest || selectable[0]).id;
        });
      })
      .catch(() => {
        if (seq !== compareSeqRef.current) return;
        setFetchError('לא ניתן לטעון את רשתות השיווק כרגע. בדקו חיבור ונסו שוב.');
      })
      .finally(() => {
        if (seq === compareSeqRef.current) {
          setLoading(false);
        }
      });
  }, [visible, activeItemsPayloadKey, listRevision, retryNonce]);

  const activeMerchant =
    merchants.find((m) => m.id === selectedMerchantId) || merchants[0] || null;

  const findMatchForIngredient = (
    itemOrName: PreparedShoppingItem | string,
    merchantId?: string | null
  ) => {
    if (!merchantId) return null;
    const itemId =
      typeof itemOrName === 'string'
        ? canonicalIngredientKey(itemOrName)
        : canonicalIngredientKey(itemOrName.id || itemOrName.shoppingName);
    const clean =
      typeof itemOrName === 'string'
        ? canonicalIngredientKey(itemOrName)
        : canonicalIngredientKey(itemOrName.shoppingName);

    const row = comparisonItems.find(
      (ci) =>
        (ci.itemId && canonicalIngredientKey(ci.itemId) === itemId) ||
        canonicalIngredientKey(ci.query || '') === clean ||
        canonicalIngredientKey(ci.normalizedQuery || '') === clean
    );
    const match = row && row.matches ? row.matches[merchantId] || null : null;
    if (match && typeof match.confidence === 'number' && match.confidence < minMatchConfidence) {
      return null;
    }
    return match;
  };

  const computeChainPricingStats = (m: (typeof merchants)[number]) => {
    const totalCount = activeItems.length;
    let purchasableSum = 0;
    let consumptionSum = 0;
    const countedRows: Array<{
      shoppingName: string;
      productName: string;
      packSizeLabel: string;
      packsNeeded: number;
      purchasableCost: number;
      packSizeUnknown: boolean;
    }> = [];
    const missingNames: string[] = [];
    let hasUnknownPackSize = false;

    for (const it of activeItems) {
      const match = findMatchForIngredient(it, m.id);
      if (match && typeof match.price === 'number' && match.price > 0) {
        const pCost =
          typeof match.purchasableCost === 'number' && match.purchasableCost > 0
            ? match.purchasableCost
            : match.price;
        const cCost =
          typeof match.consumptionCost === 'number' && match.consumptionCost > 0
            ? match.consumptionCost
            : match.price;
        purchasableSum += pCost;
        consumptionSum += cCost;
        if (match.packSizeUnknown) hasUnknownPackSize = true;
        countedRows.push({
          shoppingName: it.shoppingName,
          productName: match.productName,
          packSizeLabel: match.packSizeLabel || '',
          packsNeeded: match.packsNeeded || 1,
          purchasableCost: Math.round(pCost * 100) / 100,
          packSizeUnknown: Boolean(match.packSizeUnknown),
        });
      } else {
        missingNames.push(it.shoppingName);
      }
    }

    const matchedCount = countedRows.length;
    const invariantOk = matchedCount + missingNames.length === totalCount;
    const purchasableTotal = Math.round(purchasableSum * 100) / 100;
    const consumptionTotal = Math.round(consumptionSum * 100) / 100;
    const isComplete = invariantOk && totalCount > 0 && matchedCount === totalCount && missingNames.length === 0;

    return {
      totalCount,
      matchedCount,
      countedRows,
      missingItems: missingNames,
      isCompleteBasket: isComplete,
      hasUnknownPackSize,
      estimateUnavailable: !invariantOk,
      purchasableTotal,
      consumptionTotal,
    };
  };

  const cleanStorePasteText = useMemo(
    () =>
      buildCleanStorePasteList(
        activeItems.map((it) => ({
          shoppingName: it.shoppingName,
          excluded: false,
          haveAtHome: false,
        }))
      ),
    [activeItems]
  );

  const personalReferenceText = useMemo(
    () =>
      buildPersonalReferenceList(
        activeItems.map((it) => ({
          shoppingName: it.shoppingName,
          displayQuantity: it.displayQuantity,
          originalRecipeRequirement: it.originalRecipeRequirement,
          conversionNote: it.conversionNote,
          excluded: false,
          haveAtHome: false,
        }))
      ),
    [activeItems]
  );

  const currentScopedFeedback =
    handoffFeedback &&
    activeMerchant &&
    handoffFeedback.merchantId === activeMerchant.id &&
    handoffFeedback.listRevision === listRevision
      ? handoffFeedback
      : null;

  const handleAdjustServings = (delta: number) => {
    const maxServings = Math.max(20, baseServings);
    const currentServings = Math.max(1, Math.min(maxServings, Math.round(baseServings * multiplier)));
    const nextServings = Math.max(1, Math.min(maxServings, currentServings + delta));
    if (nextServings !== currentServings) {
      setMultiplier(nextServings / baseServings);
      setListRevision((r) => r + 1);
    }
  };

  const handleSelectAlternative = (itemId: string, altName: string) => {
    setSelectedAlternatives((prev) => ({ ...prev, [itemId]: altName }));
    setCustomOverrides((prev) => {
      if (!prev[itemId]) return prev;
      const next = { ...prev };
      delete next[itemId];
      return next;
    });
    setListRevision((r) => r + 1);
  };

  const handleStartEditItem = (item: PreparedShoppingItem) => {
    setEditingItemId(item.id);
    setEditNameDraft(item.shoppingName);
    setEditAmountDraft(item.amount !== null && item.amount !== undefined ? String(item.amount) : '');
    setEditUnitDraft(item.unit || '');
  };

  const handleSaveEditItem = (itemId: string) => {
    const cleanName = editNameDraft.trim();
    const parsedAmt = editAmountDraft.trim()
      ? Number.parseFloat(editAmountDraft.trim().replace(',', '.'))
      : null;
    setCustomOverrides((prev) => ({
      ...prev,
      [itemId]: {
        shoppingName: cleanName || undefined,
        amount: parsedAmt !== null && Number.isFinite(parsedAmt) && parsedAmt > 0 ? parsedAmt : null,
        unit: editUnitDraft.trim(),
      },
    }));
    setEditingItemId(null);
    setListRevision((r) => r + 1);
  };

  // Primary Action 1: Copy Clean List + Open Selected Supermarket Bulk Handoff
  const handleCopyAndOpenStore = async () => {
    if (!activeMerchant || activeItems.length === 0) return;
    setOpeningStoreKey('__bulk_copy_open__');
    const copyOk = await copyTextSafe(cleanStorePasteText);
    if (!copyOk) {
      setShowPlainCopyBox(true);
    }

    let openOk = false;
    let resolvedUrl = '';
    try {
      const linkRes = await ApiClient.createAffiliateStoreLink({
        merchantId: activeMerchant.id,
        mode: 'bulk_handoff',
        itemCount: activeItems.length,
        recipeId,
      });
      resolvedUrl = linkRes.fullRedirectUrl;
      await Linking.openURL(resolvedUrl);
      openOk = true;
    } catch {
      openOk = false;
    } finally {
      setOpeningStoreKey(null);
    }

    if (copyOk && openOk) {
      setHandoffFeedback({
        merchantId: activeMerchant.id,
        listRevision,
        tone: 'success',
        message: `הרשימה הנקייה (${activeItems.length} מצרכים) הועתקה ללוח ופתחנו את ${activeMerchant.displayName}. הדביקו את הרשימה בכלי הקנייה המהירה בחנות ובדקו כמויות.`,
      });
    } else if (copyOk && !openOk) {
      setHandoffFeedback({
        merchantId: activeMerchant.id,
        listRevision,
        tone: 'warning',
        message: `הרשימה הנקייה הועתקה ללוח 📋, אך הפתיחה האוטומטית של ${activeMerchant.displayName} נחסמה או נכשלה. השתמשו בכפתור הפתיחה הישירה למטה.`,
        fallbackStoreUrl: resolvedUrl || activeMerchant.entryUrl,
      });
    } else if (!copyOk && openOk) {
      setHandoffFeedback({
        merchantId: activeMerchant.id,
        listRevision,
        tone: 'warning',
        message: `פתחנו את ${activeMerchant.displayName} ↗, אך ההעתקה האוטומטית ללוח נחסמה. פתחנו עבורכם את תיבת הטקסט הנקייה למטה להעתקה ידנית.`,
      });
    } else {
      setHandoffFeedback({
        merchantId: activeMerchant.id,
        listRevision,
        tone: 'error',
        message: `ההעתקה האוטומטית והפתיחה של ${activeMerchant.displayName} לא הושלמו. העתיקו ידנית מתיבת הטקסט למטה ונסו לפתוח את החנות שוב.`,
        fallbackStoreUrl: resolvedUrl || activeMerchant.entryUrl,
      });
    }
  };

  // Action 2: Copy Clean List for Store Only
  const handleCopyStoreListOnly = async () => {
    if (activeItems.length === 0) return;
    const copyOk = await copyTextSafe(cleanStorePasteText);
    if (copyOk) {
      if (activeMerchant) {
        setHandoffFeedback({
          merchantId: activeMerchant.id,
          listRevision,
          tone: 'success',
          message: `הרשימה הנקייה לסופר (${activeItems.length} מצרכים, שורה לכל מצרך ללא כמויות) הועתקה ללוח 📋.`,
        });
      } else {
        Alert.alert('הועתק ללוח 📋', 'הרשימה הנקייה לסופר הועתקה ללוח.');
      }
    } else {
      setShowPlainCopyBox(true);
      if (activeMerchant) {
        setHandoffFeedback({
          merchantId: activeMerchant.id,
          listRevision,
          tone: 'warning',
          message: 'ההעתקה האוטומטית נחסמה במכשיר זה — העתיקו ידנית מתיבת הטקסט הנקייה שנפתחה למטה.',
        });
      }
    }
  };

  // Action 3: Open Store Only (Bulk Handoff entry point without claiming copy)
  const handleOpenStoreOnly = async () => {
    if (!activeMerchant) return;
    setOpeningStoreKey('__bulk_open_only__');
    try {
      const { fullRedirectUrl } = await ApiClient.createAffiliateStoreLink({
        merchantId: activeMerchant.id,
        mode: 'bulk_handoff',
        itemCount: activeItems.length,
        recipeId,
      });
      await Linking.openURL(fullRedirectUrl);
      setHandoffFeedback({
        merchantId: activeMerchant.id,
        listRevision,
        tone: 'success',
        message: `פתחנו את ${activeMerchant.displayName} ↗. זכרו להעתיק את הרשימה הנקייה ולהדביק בכלי הקנייה המהירה בחנות.`,
      });
    } catch (err: any) {
      setHandoffFeedback({
        merchantId: activeMerchant.id,
        listRevision,
        tone: 'error',
        message: err?.message || `לא ניתן לפתוח את ${activeMerchant.displayName} כעת.`,
        fallbackStoreUrl: activeMerchant.entryUrl,
      });
    } finally {
      setOpeningStoreKey(null);
    }
  };

  // Action 4: Copy Personal Reference List WITH Quantities (never confused with store paste list)
  const handleCopyPersonalListWithQuantities = async () => {
    if (activeItems.length === 0) return;
    const header = recipeTitle ? `${recipeTitle} — רשימת מצרכים עם כמויות:\n` : '';
    const fullText = `${header}${personalReferenceText}`;
    const copyOk = await copyTextSafe(fullText);
    if (copyOk) {
      Alert.alert(
        'רשימה אישית עם כמויות הועתקה 📝',
        'הרשימה המפורטת (כולל כמויות ודרישות המתכון) הועתקה לשימוש אישי.'
      );
    } else {
      try {
        await Share.share({ message: fullText });
      } catch {}
    }
  };

  // Secondary Per-Item Search Fallback (mode: 'item_search', NEVER claims cart addition)
  const handleSearchSingleItemInStore = async (item: PreparedShoppingItem) => {
    if (!activeMerchant) return;
    const match = findMatchForIngredient(item, activeMerchant.id);
    setOpeningStoreKey(item.id);
    try {
      const { fullRedirectUrl } = await ApiClient.createAffiliateStoreLink({
        merchantId: activeMerchant.id,
        mode: 'item_search',
        query: item.shoppingName,
        productName:
          match && (match.confidence === undefined || match.confidence >= 85)
            ? match.productName
            : undefined,
        sku: match?.itemCode,
        recipeId,
      });
      await Linking.openURL(fullRedirectUrl);
    } catch (err: any) {
      Alert.alert('שגיאה בפתיחת החנות', err?.message || 'לא ניתן לפתוח את החיפוש בחנות כעת');
    } finally {
      setOpeningStoreKey(null);
    }
  };

  const handleCompleteSelfReportedChecklist = () => {
    if (!onMarkItemsBought) return;
    const explicitIds = Object.keys(selfReportedBoughtIds).filter((k) => selfReportedBoughtIds[k]);
    const idsToMark =
      explicitIds.length > 0 ? explicitIds : activeItems.map((it) => it.id);
    onMarkItemsBought(idsToMark);
    onClose();
  };

  const scaledServings = Math.max(0.5, Math.round(baseServings * multiplier * 10) / 10);
  const chainGuide = activeMerchant
    ? CHAIN_SPECIFIC_GUIDE_HE[activeMerchant.id] || {
        menuPathHe: activeMerchant.menuPathHe || 'קנייה מהירה מרשימה',
        summaryHe: `${activeMerchant.displayName}: פתחו את כלי הקנייה המהירה באתר הרשת, הדביקו את הרשימה הנקייה ובדקו מוצרים וכמויות.`,
        stepsHe: activeMerchant.instructionsStepsHe || [],
      }
    : null;

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
                🛍️ הכנת רשימת קניות והעברה לסופר
              </Text>
              <Text style={styles.subtitle} numberOfLines={2}>
                {recipeTitle || 'רשימת הקניות שלי'} • {activeItems.length} מצרכים להעברה לרשת
              </Text>
            </View>
          </View>

          {/* Single Clean ScrollView Container (No Nested Scroll Traps) */}
          <ScrollView
            style={styles.body}
            contentContainerStyle={styles.bodyContent}
            showsVerticalScrollIndicator={false}
            keyboardShouldPersistTaps="handled"
          >
            {/* Step A Header + Servings Control */}
            {!fromShoppingList && (
              <View style={[styles.servingsBar, isDarkMode && styles.darkCard]}>
                <View style={styles.servingsControls}>
                  <TouchableOpacity
                    style={styles.servingsStepBtn}
                    onPress={() => handleAdjustServings(-1)}
                  >
                    <Text style={styles.servingsStepBtnText}>-</Text>
                  </TouchableOpacity>
                  <Text style={[styles.servingsCountText, isDarkMode && styles.darkText]}>
                    {scaledServings} מנות
                  </Text>
                  <TouchableOpacity
                    style={styles.servingsStepBtn}
                    onPress={() => handleAdjustServings(1)}
                  >
                    <Text style={styles.servingsStepBtnText}>+</Text>
                  </TouchableOpacity>
                </View>
                <Text style={[styles.servingsLabel, isDarkMode && styles.darkText]}>
                  🍽️ התאמת מנות (מעדכן כמויות ואומדן מחיר):
                </Text>
              </View>
            )}

            {/* Step B: Chain Selection Row (3 side-by-side) & Expandable Details */}
            <View style={{ flexDirection: 'row-reverse', justifyContent: 'space-between', alignItems: 'center', marginBottom: 8 }}>
              <Text style={[styles.sectionLabel, { marginBottom: 0 }, isDarkMode && styles.darkText]}>
                1. בחירת רשת שיווק:
              </Text>
              {!loading && merchants.length > 0 && (
                <TouchableOpacity onPress={() => setShowChainDetails((prev) => !prev)}>
                  <Text style={{ fontSize: 12, fontWeight: '800', color: '#059669', textDecorationLine: 'underline' }}>
                    {showChainDetails ? 'הסתר מידע נוסף ▴' : 'למידע נוסף ואיך חושב הסכום ▾'}
                  </Text>
                </TouchableOpacity>
              )}
            </View>

            {loading && merchants.length === 0 ? (
              <View style={styles.inlineLoadingBox}>
                <ActivityIndicator size="small" color="#059669" />
                <Text style={[styles.inlineLoadingText, isDarkMode && styles.darkText]}>
                  טוען רשתות שיווק ואומדני מחיר...
                </Text>
              </View>
            ) : fetchError ? (
              <View style={[styles.disclosureBox, { backgroundColor: '#fef2f2', borderColor: '#fecaca', flexDirection: 'row-reverse', alignItems: 'center', justifyContent: 'space-between', gap: 8 }]}>
                <Text style={[styles.disclosureText, { color: '#991b1b', flex: 1 }]}>
                  ⚠️ {fetchError}
                </Text>
                <TouchableOpacity
                  style={{ backgroundColor: '#dc2626', paddingHorizontal: 10, paddingVertical: 6, borderRadius: 8 }}
                  onPress={() => setRetryNonce((n) => n + 1)}
                >
                  <Text style={{ color: '#fff', fontSize: 12, fontWeight: '800' }}>נסה שוב 🔄</Text>
                </TouchableOpacity>
              </View>
            ) : merchants.length > 0 ? (
              <View style={{ marginBottom: 10 }}>
                <View style={{ flexDirection: 'row-reverse', gap: 6, opacity: loading ? 0.65 : 1 }}>
                  {merchants.map((m) => {
                    const isSelected = activeMerchant?.id === m.id;
                    const stats = computeChainPricingStats(m);
                    const showCheapestBadge = m.isCheapest && stats.isCompleteBasket && !stats.hasUnknownPackSize && !stats.estimateUnavailable;
                    const priceText = loading
                      ? '⏳ מעדכן...'
                      : stats.estimateUnavailable
                      ? 'אומדן לא זמין'
                      : `${stats.hasUnknownPackSize ? 'מינימום ' : '~'}₪${stats.purchasableTotal.toFixed(0)}`;

                    return (
                      <TouchableOpacity
                        key={`${m.id}:${comparisonRevisionKey}`}
                        style={[
                          styles.merchantCard,
                          { flex: 1, alignItems: 'center', justifyContent: 'center', paddingVertical: 9, paddingHorizontal: 5, marginBottom: 0 },
                          isDarkMode && styles.darkCard,
                          isSelected && styles.merchantCardActive,
                        ]}
                        activeOpacity={0.85}
                        onPress={() => setSelectedMerchantId(m.id)}
                      >
                        <Text
                          style={[
                            styles.merchantName,
                            { fontSize: 13, textAlign: 'center' },
                            isDarkMode && styles.darkText,
                            isSelected && styles.merchantNameActive,
                          ]}
                          numberOfLines={2}
                        >
                          {isSelected ? '✓ ' : ''}{m.displayName}
                        </Text>

                        {stats.matchedCount > 0 || loading ? (
                          <>
                            <Text
                              style={[
                                styles.merchantPriceLine,
                                { fontSize: 12, marginTop: 3, textAlign: 'center' },
                                isSelected && styles.merchantPriceLineActive,
                              ]}
                            >
                              {priceText}
                            </Text>
                            <Text
                              style={[
                                { fontSize: 10, fontWeight: '700', color: isSelected ? '#d1fae5' : '#64748b', textAlign: 'center', marginTop: 1 },
                              ]}
                              numberOfLines={1}
                            >
                              {loading
                                ? 'מחשב מחדש'
                                : showCheapestBadge
                                ? '🏆 הכי משתלם'
                                : stats.isCompleteBasket
                                ? `${stats.matchedCount}/${stats.totalCount} זוהו`
                                : `חלקי ${stats.matchedCount}/${stats.totalCount}`}
                            </Text>
                          </>
                        ) : (
                          <Text
                            style={{ fontSize: 10, color: isSelected ? '#d1fae5' : '#64748b', marginTop: 3, textAlign: 'center' }}
                            numberOfLines={1}
                          >
                            0/{stats.totalCount} זוהו
                          </Text>
                        )}
                      </TouchableOpacity>
                    );
                  })}
                </View>

                {showChainDetails && (
                  <View style={[styles.provenanceBox, { marginTop: 8, marginBottom: 0 }]}>
                    {activeMerchant && (() => {
                      const activeStats = computeChainPricingStats(activeMerchant);
                      return (
                        <View style={{ marginBottom: 6 }}>
                          <Text style={{ fontSize: 12, fontWeight: '900', color: '#0f172a', textAlign: 'right', marginBottom: 3 }}>
                            איך חושב הסכום ב-{activeMerchant.displayName}:
                          </Text>
                          {activeStats.estimateUnavailable ? (
                            <Text style={{ fontSize: 11, fontWeight: '800', color: '#b91c1c', textAlign: 'right' }}>
                              ⚠️ אומדן המחיר אינו זמין כרגע עקב אי-התאמה בנתונים.
                            </Text>
                          ) : activeStats.matchedCount > 0 ? (
                            <>
                              <Text style={styles.provenanceText}>
                                • אומדן קנייה בקופה{activeStats.hasUnknownPackSize ? ' (מינימום — גודל מארז לא ידוע לחלק מהפריטים)' : ''}: ~₪{activeStats.purchasableTotal.toFixed(2)} ({activeStats.matchedCount} מתוך {activeStats.totalCount} מצרכים זוהו)
                              </Text>
                              <Text style={styles.provenanceText}>
                                • עלות יחסית למתכון: ~₪{activeStats.consumptionTotal.toFixed(2)}
                              </Text>
                              <View style={{ marginTop: 5, paddingTop: 5, borderTopWidth: 1, borderTopColor: '#cbd5e1' }}>
                                <Text style={{ fontSize: 11, fontWeight: '800', color: '#0f172a', textAlign: 'right', marginBottom: 3 }}>
                                  פירוט שורות שנכללו בסכום ({activeStats.countedRows.length}):
                                </Text>
                                {activeStats.countedRows.map((cr, idx) => (
                                  <View key={idx} style={{ flexDirection: 'row-reverse', justifyContent: 'space-between', gap: 6, paddingVertical: 1 }}>
                                    <Text style={{ fontSize: 11, color: '#334155', flex: 1, textAlign: 'right' }}>
                                      • {cr.productName}{cr.packSizeLabel ? ` (${cr.packSizeLabel})` : ''}{cr.packsNeeded > 1 ? ` × ${cr.packsNeeded}` : ''}{cr.packSizeUnknown ? ' ⚠️' : ''}
                                    </Text>
                                    <Text style={{ fontSize: 11, fontWeight: '800', color: '#0f172a' }}>
                                      ₪{cr.purchasableCost.toFixed(2)}
                                    </Text>
                                  </View>
                                ))}
                              </View>
                            </>
                          ) : (
                            <Text style={styles.provenanceText}>
                              • לא נמצאו התאמות בביטחון גבוה בקטלוג הרשת (זמין להעברת רשימה מרוכזת).
                            </Text>
                          )}
                          {activeStats.missingItems.length > 0 && (
                            <Text style={[styles.missingItemsLine, { marginTop: 4 }]}>
                              • חסר / דורש בחירה ידנית ({activeStats.missingItems.length}, לא נכלל בסכום): {activeStats.missingItems.join(', ')}
                            </Text>
                          )}
                        </View>
                      );
                    })()}
                    <Text style={styles.provenanceText}>
                      ℹ️ {PROVENANCE_EXCLUSIONS_NOTE_HE}.
                      {activeMerchant?.disclosureText ? ` • 🔗 ${activeMerchant.disclosureText}` : ''}
                    </Text>
                  </View>
                )}
              </View>
            ) : (
              <View style={styles.disclosureBox}>
                <Text style={styles.disclosureText}>
                  רשתות השיווק אינן זמינות כרגע לקישור ישיר — ניתן לערוך ולהעתיק את הרשימה הנקייה למטה.
                </Text>
              </View>
            )}

            {/* Step C: Primary Bulk-List Handoff Action Card & Expandable Chain Instructions */}
            {activeMerchant && (
              <View style={styles.handoffCard}>
                <View style={{ flexDirection: 'row-reverse', justifyContent: 'space-between', alignItems: 'center', marginBottom: 6 }}>
                  <Text style={[styles.handoffTitle, { marginBottom: 0 }]}>
                    2. העברה ל-{activeMerchant.displayName}
                  </Text>
                  {chainGuide && (
                    <TouchableOpacity onPress={() => setShowHandoffDetails((prev) => !prev)}>
                      <Text style={{ fontSize: 12, fontWeight: '800', color: '#047857', textDecorationLine: 'underline' }}>
                        {showHandoffDetails ? 'הסתר הסבר מפורט ▴' : 'להסבר מפורט ▾'}
                      </Text>
                    </TouchableOpacity>
                  )}
                </View>

                <Text style={{ fontSize: 12, color: '#0f172a', textAlign: 'right', lineHeight: 18, marginBottom: 9 }}>
                  העתיקו את הרשימה הנקייה בלחיצה אחת והדביקו בכלי הקנייה המהירה של {activeMerchant.displayName}.
                </Text>

                {chainGuide && showHandoffDetails && (
                  <View style={styles.chainGuideBox}>
                    <Text style={styles.chainMenuPath}>
                      🧭 נתיב בחנות: {chainGuide.menuPathHe}
                    </Text>
                    <Text style={styles.chainSummaryText}>{chainGuide.summaryHe}</Text>
                    {chainGuide.stepsHe.map((stepStr, idx) => (
                      <Text key={idx} style={styles.chainStepItem}>
                        {idx + 1}. {stepStr}
                      </Text>
                    ))}
                    <Text style={styles.quantityReminderText}>
                      ⚠️ {QUANTITY_TRANSFER_REMINDER_HE}
                    </Text>
                  </View>
                )}

                {/* Prominent Primary CTA */}
                <TouchableOpacity
                  style={[
                    styles.primaryHandoffBtn,
                    activeItems.length === 0 && styles.disabledBtn,
                  ]}
                  disabled={activeItems.length === 0 || openingStoreKey === '__bulk_copy_open__'}
                  onPress={handleCopyAndOpenStore}
                >
                  <Text style={styles.primaryHandoffBtnText}>
                    {openingStoreKey === '__bulk_copy_open__'
                      ? 'מעתיק ופותח את החנות...'
                      : `📋 העתק רשימה נקייה ופתח את ${activeMerchant.displayName} ↗`}
                  </Text>
                </TouchableOpacity>

                {/* Split Secondary Handoff Buttons */}
                <View style={styles.splitActionsRow}>
                  <TouchableOpacity
                    style={styles.splitActionBtn}
                    disabled={activeItems.length === 0}
                    onPress={handleCopyStoreListOnly}
                  >
                    <Text style={styles.splitActionBtnText}>📋 העתק רשימה לסופר בלבד</Text>
                  </TouchableOpacity>

                  <TouchableOpacity
                    style={styles.splitActionBtn}
                    disabled={openingStoreKey === '__bulk_open_only__'}
                    onPress={handleOpenStoreOnly}
                  >
                    <Text style={styles.splitActionBtnText}>
                      🏪 פתח את {activeMerchant.displayName} בלבד
                    </Text>
                  </TouchableOpacity>
                </View>

                <View style={styles.secondaryUtilityRow}>
                  <TouchableOpacity
                    style={styles.personalCopyBtn}
                    disabled={activeItems.length === 0}
                    onPress={handleCopyPersonalListWithQuantities}
                  >
                    <Text style={styles.personalCopyBtnText}>
                      📝 העתק רשימה עם כמויות (לשימוש אישי)
                    </Text>
                  </TouchableOpacity>

                  <TouchableOpacity
                    style={styles.togglePlainBoxBtn}
                    onPress={() => setShowPlainCopyBox((v) => !v)}
                  >
                    <Text style={styles.togglePlainBoxBtnText}>
                      {showPlainCopyBox ? 'הסתר תיבת העתקה ידנית ▲' : 'תיבת טקסט להעתקה ידנית ▼'}
                    </Text>
                  </TouchableOpacity>
                </View>

                {/* Truthful Scoped Feedback Banner */}
                {currentScopedFeedback && (
                  <View
                    style={[
                      styles.feedbackBanner,
                      currentScopedFeedback.tone === 'warning' && styles.feedbackBannerWarning,
                      currentScopedFeedback.tone === 'error' && styles.feedbackBannerError,
                    ]}
                  >
                    <Text style={styles.feedbackBannerText}>{currentScopedFeedback.message}</Text>
                    {currentScopedFeedback.fallbackStoreUrl && (
                      <TouchableOpacity
                        style={styles.fallbackLinkBtn}
                        onPress={() => Linking.openURL(currentScopedFeedback.fallbackStoreUrl!)}
                      >
                        <Text style={styles.fallbackLinkBtnText}>
                          לחצו כאן לפתיחה ישירה של {activeMerchant.displayName} ↗
                        </Text>
                      </TouchableOpacity>
                    )}
                  </View>
                )}

                {/* Collapsible/Visible Plain-Text Copy Box */}
                {showPlainCopyBox && (
                  <View style={styles.plainCopyBoxWrap}>
                    <Text style={styles.plainCopyBoxLabel}>
                      רשימה נקייה להדבקה בסופר (מצרך אחד בכל שורה, ללא כמויות):
                    </Text>
                    <TextInput
                      style={styles.plainCopyInput}
                      value={cleanStorePasteText}
                      multiline
                      editable={false}
                      selectTextOnFocus
                      textAlign="right"
                    />
                  </View>
                )}
              </View>
            )}

            {/* Step A: Ingredient Review List Before Leaving */}
            <Text style={[styles.sectionLabel, isDarkMode && styles.darkText]}>
              3. בדיקת מצרכים, חלופות וכמויות לפני העברה ({activeItems.length} פעילים מתוך{' '}
              {preparedItems.length}):
            </Text>

            {preparedItems.map((item) => {
              const isAtHome = Boolean(haveAtHomeIds[item.id]);
              const isSkipped = Boolean(skippedIds[item.id]);
              const isSelfBought = Boolean(selfReportedBoughtIds[item.id]);
              const isExcluded = isAtHome || isSkipped;
              const match = findMatchForIngredient(item, activeMerchant?.id);
              const isHighConfMatch =
                match && (match.confidence === undefined || match.confidence >= 80);
              const isEditing = editingItemId === item.id;

              const reviewBadgeText = item.conversionNote
                ? item.shoppingName.startsWith('ביצים')
                  ? '⚠️ הומר מחלמונים לביצים — בדקו כמות מארז'
                  : `⚠️ ${item.conversionNote}`
                : null;

              return (
                <View
                  key={item.id}
                  style={[
                    styles.itemCard,
                    isDarkMode && styles.darkCard,
                    isExcluded && styles.itemCardExcluded,
                  ]}
                >
                  {/* Top Line: Purchasable Shopping Name + Recipe Requirement */}
                  <View style={styles.itemHeaderRow}>
                    <View style={styles.itemTitleCol}>
                      <Text
                        style={[
                          styles.itemShoppingName,
                          isDarkMode && styles.darkText,
                          isExcluded && styles.strikethrough,
                        ]}
                      >
                        {item.shoppingName}
                        {item.displayQuantity ? ` • ${item.displayQuantity}` : ''}
                      </Text>

                      {item.originalRecipeRequirement && (
                        <Text style={styles.recipeReqText}>
                          דרישת המתכון: {item.originalRecipeRequirement}
                        </Text>
                      )}

                      {item.dietaryConstraints.length > 0 && (
                        <View style={styles.dietaryRow}>
                          {item.dietaryConstraints.map((dc) => (
                            <View key={dc} style={styles.dietaryPill}>
                              <Text style={styles.dietaryPillText}>🛡️ {dc}</Text>
                            </View>
                          ))}
                        </View>
                      )}

                      {reviewBadgeText && (
                        <View style={styles.conversionBadge}>
                          <Text style={styles.conversionBadgeText}>{reviewBadgeText}</Text>
                        </View>
                      )}
                    </View>
                  </View>

                  {/* 1-Tap Alternative Selector Pills (" או ") */}
                  {item.alternatives.length >= 2 && !isExcluded && (
                    <View style={styles.alternativesWrap}>
                      <Text style={styles.alternativesLabel}>בחרו חלופה לקנייה:</Text>
                      <View style={styles.alternativesPillsRow}>
                        {item.alternatives.map((alt) => {
                          const isAltSelected = item.shoppingName === alt;
                          return (
                            <TouchableOpacity
                              key={alt}
                              style={[
                                styles.altPill,
                                isAltSelected && styles.altPillActive,
                              ]}
                              onPress={() => handleSelectAlternative(item.id, alt)}
                            >
                              <Text
                                style={[
                                  styles.altPillText,
                                  isAltSelected && styles.altPillTextActive,
                                ]}
                              >
                                {isAltSelected ? `✓ ${alt}` : alt}
                              </Text>
                            </TouchableOpacity>
                          );
                        })}
                      </View>
                    </View>
                  )}

                  {/* Inline Edit Form for shoppingName / amount / unit */}
                  {isEditing && (
                    <View style={styles.inlineEditBox}>
                      <Text style={styles.inlineEditLabel}>עריכת שם מצרך לסופר וכמות:</Text>
                      <TextInput
                        style={styles.inlineEditInput}
                        value={editNameDraft}
                        onChangeText={setEditNameDraft}
                        placeholder="שם מצרך לחיפוש בסופר"
                        textAlign="right"
                      />
                      <View style={styles.inlineEditQtyRow}>
                        <TextInput
                          style={[styles.inlineEditInput, styles.inlineEditUnitInput]}
                          value={editUnitDraft}
                          onChangeText={setEditUnitDraft}
                          placeholder="יחידה (גרם/יח׳)"
                          textAlign="right"
                        />
                        <TextInput
                          style={[styles.inlineEditInput, styles.inlineEditAmtInput]}
                          value={editAmountDraft}
                          onChangeText={setEditAmountDraft}
                          placeholder="כמות"
                          keyboardType="numeric"
                          textAlign="right"
                        />
                      </View>
                      <View style={styles.inlineEditBtnsRow}>
                        <TouchableOpacity
                          style={styles.inlineEditCancelBtn}
                          onPress={() => setEditingItemId(null)}
                        >
                          <Text style={styles.inlineEditCancelText}>ביטול</Text>
                        </TouchableOpacity>
                        <TouchableOpacity
                          style={styles.inlineEditSaveBtn}
                          onPress={() => handleSaveEditItem(item.id)}
                        >
                          <Text style={styles.inlineEditSaveText}>שמור שינוי</Text>
                        </TouchableOpacity>
                      </View>
                    </View>
                  )}

                  {/* Catalog Match Info (never overwrites shoppingName) */}
                  <Text style={styles.itemCatalogSubText}>
                    {isAtHome
                      ? 'סומן: יש בבית 🏠 (לא ייכלל ברשימה לסופר)'
                      : isSkipped
                      ? 'דולג בהעברה זו ⏭️ (לא ייכלל ברשימה לסופר)'
                      : isHighConfMatch && match
                      ? `📦 התאמה בקטלוג: ${match.productName} • ${
                          match.pricingBasisLabel || `₪${Number(match.price).toFixed(2)}`
                        }`
                      : `לחיפוש ברשת: ${item.shoppingName} (ללא התאמה ודאית בקטלוג)`}
                  </Text>

                  {/* Action Controls Row: Have at Home | Reversible Skip | Self-Reported Checklist | Inline Edit | Secondary Store Search */}
                  <View style={styles.itemControlsRow}>
                    <TouchableOpacity
                      style={[styles.stateChip, isAtHome && styles.stateChipHomeActive]}
                      onPress={() => {
                        setHaveAtHomeIds((prev) => ({
                          ...prev,
                          [item.id]: !prev[item.id],
                        }));
                        setListRevision((r) => r + 1);
                      }}
                    >
                      <Text
                        style={[
                          styles.stateChipText,
                          isAtHome && styles.stateChipTextActive,
                        ]}
                      >
                        {isAtHome ? '✓ יש בבית 🏠' : 'יש בבית 🏠'}
                      </Text>
                    </TouchableOpacity>

                    <TouchableOpacity
                      style={[styles.stateChip, isSkipped && styles.stateChipSkipActive]}
                      onPress={() => {
                        setSkippedIds((prev) => ({
                          ...prev,
                          [item.id]: !prev[item.id],
                        }));
                        setListRevision((r) => r + 1);
                      }}
                    >
                      <Text
                        style={[
                          styles.stateChipText,
                          isSkipped && styles.stateChipTextActive,
                        ]}
                      >
                        {isSkipped ? 'בטל דילוג ↩️' : 'דלג'}
                      </Text>
                    </TouchableOpacity>

                    {!isExcluded && (
                      <TouchableOpacity
                        style={styles.stateChip}
                        onPress={() => handleStartEditItem(item)}
                      >
                        <Text style={styles.stateChipText}>✏️ עריכת שם/כמות</Text>
                      </TouchableOpacity>
                    )}

                    {fromShoppingList && !isExcluded && (
                      <TouchableOpacity
                        style={[
                          styles.stateChip,
                          isSelfBought && styles.stateChipChecklistActive,
                        ]}
                        onPress={() =>
                          setSelfReportedBoughtIds((prev) => ({
                            ...prev,
                            [item.id]: !prev[item.id],
                          }))
                        }
                      >
                        <Text
                          style={[
                            styles.stateChipText,
                            isSelfBought && styles.stateChipTextActive,
                          ]}
                        >
                          {isSelfBought
                            ? '✓ סומן שנקנה ברשימה שלי'
                            : 'סמן שנקנה ברשימה שלי'}
                        </Text>
                      </TouchableOpacity>
                    )}

                    {!isExcluded && activeMerchant && (
                      <TouchableOpacity
                        style={styles.itemSearchStoreBtn}
                        disabled={openingStoreKey === item.id}
                        onPress={() => handleSearchSingleItemInStore(item)}
                      >
                        <Text style={styles.itemSearchStoreBtnText}>
                          {openingStoreKey === item.id ? 'פותח...' : '🔍 חפש בחנות'}
                        </Text>
                      </TouchableOpacity>
                    )}
                  </View>
                </View>
              );
            })}
          </ScrollView>

          {/* Sticky Footer Actions */}
          <View style={styles.footer}>
            <TouchableOpacity
              style={styles.secondaryBtn}
              onPress={handleCopyPersonalListWithQuantities}
            >
              <Text style={styles.secondaryBtnText}>
                📝 העתק עם כמויות ({activeItems.length})
              </Text>
            </TouchableOpacity>

            {fromShoppingList && onMarkItemsBought ? (
              <TouchableOpacity
                style={styles.primaryBtn}
                onPress={handleCompleteSelfReportedChecklist}
              >
                <Text style={styles.primaryBtnText}>
                  ✅ סמן שנקנה ברשימה שלי
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
                  <Text style={styles.primaryBtnText}>🛒 הוסף לרשימת הקניות באפליקציה</Text>
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
    maxHeight: '92%',
    paddingBottom: 16,
    paddingHorizontal: 14,
    paddingTop: 12,
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
    marginBottom: 10,
    borderBottomWidth: 1,
    borderBottomColor: '#e2e8f0',
    paddingBottom: 8,
  },
  headerTitleWrap: {
    flex: 1,
    alignItems: 'flex-end',
  },
  title: {
    fontSize: 16,
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
    width: 32,
    height: 32,
    borderRadius: 16,
    backgroundColor: '#e2e8f0',
    alignItems: 'center',
    justifyContent: 'center',
    marginRight: 8,
  },
  closeBtnText: {
    fontSize: 15,
    fontWeight: '800',
    color: '#334155',
  },
  body: {
    flexGrow: 0,
  },
  bodyContent: {
    paddingBottom: 14,
  },
  servingsBar: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    backgroundColor: '#ffffff',
    borderWidth: 1,
    borderColor: '#cbd5e1',
    borderRadius: 12,
    paddingHorizontal: 10,
    paddingVertical: 8,
    marginBottom: 10,
    flexWrap: 'wrap',
    gap: 8,
  },
  servingsLabel: {
    fontSize: 12,
    fontWeight: '800',
    color: '#0f172a',
    textAlign: 'right',
  },
  servingsControls: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
  },
  servingsStepBtn: {
    width: 30,
    height: 30,
    borderRadius: 8,
    backgroundColor: '#ecfdf5',
    borderWidth: 1,
    borderColor: '#10b981',
    alignItems: 'center',
    justifyContent: 'center',
  },
  servingsStepBtnText: {
    fontSize: 16,
    fontWeight: '900',
    color: '#065f46',
  },
  servingsCountText: {
    fontSize: 13,
    fontWeight: '900',
    color: '#0f172a',
    minWidth: 54,
    textAlign: 'center',
  },
  sectionLabel: {
    fontSize: 13,
    fontWeight: '800',
    color: '#064e3b',
    textAlign: 'right',
    marginBottom: 6,
    marginTop: 4,
  },
  inlineLoadingBox: {
    flexDirection: 'row-reverse',
    alignItems: 'center',
    gap: 8,
    padding: 12,
    backgroundColor: '#f1f5f9',
    borderRadius: 10,
    marginBottom: 10,
  },
  inlineLoadingText: {
    fontSize: 12,
    fontWeight: '700',
    color: '#334155',
    flex: 1,
    textAlign: 'right',
  },
  merchantsList: {
    flexDirection: 'column',
    gap: 8,
    marginBottom: 8,
  },
  merchantCard: {
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
  merchantHeaderRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    width: '100%',
    flexWrap: 'wrap',
    gap: 6,
  },
  cheapestBadge: {
    backgroundColor: '#f59e0b',
    borderRadius: 8,
    paddingHorizontal: 7,
    paddingVertical: 2,
  },
  cheapestBadgeText: {
    color: '#ffffff',
    fontSize: 10,
    fontWeight: '900',
  },
  partialBadge: {
    backgroundColor: '#fef3c7',
    borderWidth: 1,
    borderColor: '#f59e0b',
    borderRadius: 8,
    paddingHorizontal: 7,
    paddingVertical: 2,
  },
  partialBadgeText: {
    color: '#92400e',
    fontSize: 10,
    fontWeight: '800',
  },
  completeBadge: {
    backgroundColor: '#d1fae5',
    borderRadius: 8,
    paddingHorizontal: 7,
    paddingVertical: 2,
  },
  completeBadgeText: {
    color: '#065f46',
    fontSize: 10,
    fontWeight: '800',
  },
  merchantName: {
    fontSize: 14,
    fontWeight: '900',
    color: '#0f172a',
    textAlign: 'right',
  },
  merchantNameActive: {
    color: '#ffffff',
  },
  merchantEstimatesWrap: {
    marginTop: 4,
    alignItems: 'flex-end',
    width: '100%',
  },
  merchantPriceLine: {
    fontSize: 13,
    fontWeight: '900',
    color: '#059669',
    textAlign: 'right',
  },
  merchantPriceLineActive: {
    color: '#6ee7b7',
  },
  merchantConsumptionLine: {
    fontSize: 11,
    fontWeight: '700',
    color: '#475569',
    marginTop: 2,
    textAlign: 'right',
  },
  merchantMetaActive: {
    color: '#d1fae5',
  },
  missingItemsLine: {
    fontSize: 11,
    color: '#b45309',
    fontWeight: '700',
    marginTop: 3,
    textAlign: 'right',
  },
  missingItemsLineActive: {
    color: '#fde68a',
  },
  provenanceBox: {
    backgroundColor: '#f1f5f9',
    borderRadius: 8,
    paddingHorizontal: 10,
    paddingVertical: 6,
    marginBottom: 10,
  },
  provenanceText: {
    fontSize: 11,
    color: '#475569',
    textAlign: 'right',
    lineHeight: 16,
  },
  handoffCard: {
    backgroundColor: '#ecfdf5',
    borderWidth: 1.5,
    borderColor: '#10b981',
    borderRadius: 14,
    padding: 12,
    marginBottom: 12,
  },
  handoffTitle: {
    fontSize: 14,
    fontWeight: '900',
    color: '#065f46',
    textAlign: 'right',
    marginBottom: 6,
  },
  chainGuideBox: {
    backgroundColor: '#ffffff',
    borderWidth: 1,
    borderColor: '#a7f3d0',
    borderRadius: 10,
    padding: 9,
    marginBottom: 10,
  },
  chainMenuPath: {
    fontSize: 12,
    fontWeight: '900',
    color: '#047857',
    textAlign: 'right',
    marginBottom: 4,
  },
  chainSummaryText: {
    fontSize: 12,
    fontWeight: '700',
    color: '#0f172a',
    textAlign: 'right',
    lineHeight: 17,
    marginBottom: 4,
  },
  chainStepItem: {
    fontSize: 11,
    color: '#334155',
    textAlign: 'right',
    lineHeight: 16,
  },
  quantityReminderText: {
    fontSize: 11,
    fontWeight: '800',
    color: '#92400e',
    backgroundColor: '#fffbeb',
    borderRadius: 6,
    padding: 6,
    marginTop: 6,
    textAlign: 'right',
    lineHeight: 15,
  },
  primaryHandoffBtn: {
    backgroundColor: '#059669',
    borderRadius: 11,
    paddingVertical: 12,
    paddingHorizontal: 10,
    alignItems: 'center',
    marginBottom: 8,
  },
  disabledBtn: {
    opacity: 0.5,
  },
  primaryHandoffBtnText: {
    color: '#ffffff',
    fontSize: 14,
    fontWeight: '900',
    textAlign: 'center',
  },
  splitActionsRow: {
    flexDirection: 'row-reverse',
    flexWrap: 'wrap',
    gap: 6,
    marginBottom: 6,
  },
  splitActionBtn: {
    flex: 1,
    minWidth: 135,
    backgroundColor: '#ffffff',
    borderWidth: 1,
    borderColor: '#059669',
    borderRadius: 9,
    paddingVertical: 8,
    paddingHorizontal: 8,
    alignItems: 'center',
  },
  splitActionBtnText: {
    color: '#065f46',
    fontSize: 12,
    fontWeight: '800',
    textAlign: 'center',
  },
  secondaryUtilityRow: {
    flexDirection: 'row-reverse',
    flexWrap: 'wrap',
    justifyContent: 'space-between',
    alignItems: 'center',
    gap: 6,
  },
  personalCopyBtn: {
    paddingVertical: 5,
    paddingHorizontal: 6,
  },
  personalCopyBtnText: {
    fontSize: 11,
    fontWeight: '800',
    color: '#047857',
    textDecorationLine: 'underline',
  },
  togglePlainBoxBtn: {
    paddingVertical: 5,
    paddingHorizontal: 6,
  },
  togglePlainBoxBtnText: {
    fontSize: 11,
    fontWeight: '700',
    color: '#334155',
  },
  feedbackBanner: {
    backgroundColor: '#d1fae5',
    borderWidth: 1,
    borderColor: '#059669',
    borderRadius: 9,
    padding: 8,
    marginTop: 8,
  },
  feedbackBannerWarning: {
    backgroundColor: '#fef3c7',
    borderColor: '#d97706',
  },
  feedbackBannerError: {
    backgroundColor: '#fee2e2',
    borderColor: '#dc2626',
  },
  feedbackBannerText: {
    fontSize: 12,
    fontWeight: '700',
    color: '#0f172a',
    textAlign: 'right',
    lineHeight: 17,
  },
  fallbackLinkBtn: {
    marginTop: 6,
    backgroundColor: '#059669',
    borderRadius: 8,
    paddingVertical: 7,
    paddingHorizontal: 10,
    alignItems: 'center',
  },
  fallbackLinkBtnText: {
    color: '#ffffff',
    fontSize: 12,
    fontWeight: '900',
  },
  plainCopyBoxWrap: {
    marginTop: 8,
    backgroundColor: '#ffffff',
    borderWidth: 1,
    borderColor: '#cbd5e1',
    borderRadius: 9,
    padding: 8,
  },
  plainCopyBoxLabel: {
    fontSize: 11,
    fontWeight: '800',
    color: '#334155',
    textAlign: 'right',
    marginBottom: 4,
  },
  plainCopyInput: {
    fontSize: 13,
    color: '#0f172a',
    backgroundColor: '#f8fafc',
    borderWidth: 1,
    borderColor: '#e2e8f0',
    borderRadius: 6,
    padding: 8,
    minHeight: 72,
    textAlignVertical: 'top',
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
  itemCard: {
    backgroundColor: '#ffffff',
    borderWidth: 1,
    borderColor: '#e2e8f0',
    borderRadius: 12,
    padding: 10,
    marginBottom: 8,
  },
  itemCardExcluded: {
    opacity: 0.58,
    backgroundColor: '#f8fafc',
  },
  itemHeaderRow: {
    flexDirection: 'row-reverse',
    justifyContent: 'space-between',
    alignItems: 'flex-start',
  },
  itemTitleCol: {
    flex: 1,
    alignItems: 'flex-end',
  },
  itemShoppingName: {
    fontSize: 14,
    fontWeight: '900',
    color: '#0f172a',
    textAlign: 'right',
  },
  strikethrough: {
    textDecorationLine: 'line-through',
  },
  recipeReqText: {
    fontSize: 11,
    color: '#64748b',
    marginTop: 2,
    textAlign: 'right',
  },
  dietaryRow: {
    flexDirection: 'row-reverse',
    flexWrap: 'wrap',
    gap: 4,
    marginTop: 4,
  },
  dietaryPill: {
    backgroundColor: '#ede9fe',
    borderRadius: 6,
    paddingHorizontal: 6,
    paddingVertical: 2,
  },
  dietaryPillText: {
    fontSize: 10,
    fontWeight: '800',
    color: '#5b21b6',
  },
  conversionBadge: {
    backgroundColor: '#fffbeb',
    borderWidth: 1,
    borderColor: '#fde68a',
    borderRadius: 6,
    paddingHorizontal: 7,
    paddingVertical: 3,
    marginTop: 4,
  },
  conversionBadgeText: {
    fontSize: 11,
    fontWeight: '800',
    color: '#92400e',
    textAlign: 'right',
  },
  alternativesWrap: {
    marginTop: 6,
    width: '100%',
    alignItems: 'flex-end',
  },
  alternativesLabel: {
    fontSize: 11,
    fontWeight: '800',
    color: '#047857',
    marginBottom: 4,
  },
  alternativesPillsRow: {
    flexDirection: 'row-reverse',
    flexWrap: 'wrap',
    gap: 6,
  },
  altPill: {
    backgroundColor: '#f1f5f9',
    borderWidth: 1,
    borderColor: '#cbd5e1',
    borderRadius: 999,
    paddingHorizontal: 10,
    paddingVertical: 4,
  },
  altPillActive: {
    backgroundColor: '#059669',
    borderColor: '#059669',
  },
  altPillText: {
    fontSize: 11,
    fontWeight: '800',
    color: '#334155',
  },
  altPillTextActive: {
    color: '#ffffff',
  },
  inlineEditBox: {
    marginTop: 8,
    backgroundColor: '#f8fafc',
    borderWidth: 1,
    borderColor: '#cbd5e1',
    borderRadius: 8,
    padding: 8,
    width: '100%',
  },
  inlineEditLabel: {
    fontSize: 11,
    fontWeight: '800',
    color: '#334155',
    textAlign: 'right',
    marginBottom: 4,
  },
  inlineEditInput: {
    backgroundColor: '#ffffff',
    borderWidth: 1,
    borderColor: '#cbd5e1',
    borderRadius: 6,
    paddingHorizontal: 8,
    paddingVertical: 5,
    fontSize: 12,
    color: '#0f172a',
    marginBottom: 6,
  },
  inlineEditQtyRow: {
    flexDirection: 'row',
    gap: 6,
  },
  inlineEditAmtInput: {
    flex: 1,
  },
  inlineEditUnitInput: {
    flex: 1,
  },
  inlineEditBtnsRow: {
    flexDirection: 'row',
    justifyContent: 'flex-end',
    gap: 6,
  },
  inlineEditCancelBtn: {
    paddingHorizontal: 10,
    paddingVertical: 5,
    borderRadius: 6,
    backgroundColor: '#e2e8f0',
  },
  inlineEditCancelText: {
    fontSize: 11,
    fontWeight: '700',
    color: '#334155',
  },
  inlineEditSaveBtn: {
    paddingHorizontal: 10,
    paddingVertical: 5,
    borderRadius: 6,
    backgroundColor: '#059669',
  },
  inlineEditSaveText: {
    fontSize: 11,
    fontWeight: '800',
    color: '#ffffff',
  },
  itemCatalogSubText: {
    fontSize: 11,
    color: '#047857',
    fontWeight: '600',
    marginTop: 5,
    textAlign: 'right',
  },
  itemControlsRow: {
    flexDirection: 'row-reverse',
    flexWrap: 'wrap',
    alignItems: 'center',
    gap: 6,
    marginTop: 8,
  },
  stateChip: {
    backgroundColor: '#f1f5f9',
    borderWidth: 1,
    borderColor: '#cbd5e1',
    borderRadius: 8,
    paddingHorizontal: 8,
    paddingVertical: 5,
  },
  stateChipHomeActive: {
    backgroundColor: '#0f172a',
    borderColor: '#0f172a',
  },
  stateChipSkipActive: {
    backgroundColor: '#d97706',
    borderColor: '#d97706',
  },
  stateChipChecklistActive: {
    backgroundColor: '#059669',
    borderColor: '#059669',
  },
  stateChipText: {
    fontSize: 11,
    fontWeight: '700',
    color: '#334155',
  },
  stateChipTextActive: {
    color: '#ffffff',
  },
  itemSearchStoreBtn: {
    backgroundColor: '#ecfdf5',
    borderWidth: 1,
    borderColor: '#a7f3d0',
    borderRadius: 8,
    paddingHorizontal: 8,
    paddingVertical: 5,
  },
  itemSearchStoreBtnText: {
    color: '#065f46',
    fontSize: 11,
    fontWeight: '800',
  },
  footer: {
    flexDirection: 'row',
    gap: 8,
    marginTop: 8,
    paddingTop: 8,
    borderTopWidth: 1,
    borderTopColor: '#e2e8f0',
  },
  secondaryBtn: {
    flex: 1,
    backgroundColor: '#e2e8f0',
    borderRadius: 11,
    paddingVertical: 11,
    paddingHorizontal: 6,
    alignItems: 'center',
    justifyContent: 'center',
  },
  secondaryBtnText: {
    color: '#1e293b',
    fontSize: 12,
    fontWeight: '800',
    textAlign: 'center',
  },
  primaryBtn: {
    flex: 1.3,
    backgroundColor: '#059669',
    borderRadius: 11,
    paddingVertical: 11,
    paddingHorizontal: 6,
    alignItems: 'center',
    justifyContent: 'center',
  },
  primaryBtnText: {
    color: '#ffffff',
    fontSize: 12,
    fontWeight: '900',
    textAlign: 'center',
  },
});
