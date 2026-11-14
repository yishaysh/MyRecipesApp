export type KitchenTimerCategory = 'baking' | 'proofing' | 'cooling';

export interface KitchenStepInput {
  instruction?: string | null;
  durationMinutes?: number | null;
}

export interface KitchenStepTimerInfo {
  eligible: true;
  category: KitchenTimerCategory;
  durationMinutes: number;
  labelHe: string;
}

const CATEGORY_LABELS_HE: Record<KitchenTimerCategory, string> = {
  baking: 'טיימר אפייה',
  proofing: 'טיימר התפחה',
  cooling: 'טיימר קירור',
};

/**
 * Normalizes a recipe step and strips utensil / ingredient phrases that mention
 * baking/rising/cooling nouns without representing an actual waiting step
 * (e.g. "נייר אפייה", "קמח תופח", "מהמקרר", "הקדאיף המצונן").
 */
function sanitizeStepTextForTimerDetection(rawText: string): string {
  return rawText
    .replace(/[\u0591-\u05C7]/g, '')
    .toLowerCase()
    .replace(/תבני(?:ת|ות)\s+ל?אפיי?ה|נייר\s+ל?אפיי?ה|אבקת\s+אפיי?ה|סודה\s+לאפיי?ה|רשת\s+ל?אפיי?ה|כלי\s+ל?אפיי?ה|שקי(?:ת|ות)\s+ל?אפיי?ה|שוקולד\s+לאפיי?ה/g, ' ')
    .replace(/קמח\s+תופח|self[\s-]+rising/gi, ' ')
    .replace(/baking\s+(?:powder|soda|sheet|pan|dish|paper|tray|rack|cup|cups|tin|mat|stone)/gi, ' ')
    .replace(/(?:^|[^א-ת])המצוננ(?:ים|ות|ת)?(?=$|[^א-ת])/g, ' ')
    .replace(/(?:^|[^א-ת])(?:מן\s+ה|מה[- ]?|מ)(?:מקרר|מקפיא)(?=$|[^א-ת])/g, ' ');
}

/**
 * Extracts explicit step duration in minutes from text when structured
 * durationMinutes is missing.
 */
export function extractDurationMinutesFromStepText(rawText: string): number | null {
  if (!rawText || typeof rawText !== 'string') return null;
  const text = rawText.replace(/[\u0591-\u05C7]/g, '').trim();
  if (!text) return null;

  const minMatch = text.match(
    /(?:^|[^\d])(?:כ-?|במשך\s+|למשך\s+|ל-?)?(\d+(?:[.,]\d+)?)(?:\s*(?:-|–|עד|to)\s*\d+(?:[.,]\d+)?)?\s*(?:דקות|דק׳|דק'|דק(?=$|[^א-ת])|minutes?|mins?|min(?=$|[^a-z]))/i
  );
  if (minMatch && minMatch[1]) {
    const mins = Number(minMatch[1].replace(',', '.'));
    if (Number.isFinite(mins) && mins > 0) {
      return mins;
    }
  }

  if (/שעה\s+וחצי/.test(text)) return 90;
  if (/חצי\s+שעה|half\s+(?:an\s+)?hour/i.test(text)) return 30;
  if (/(?:^|[^א-ת])[והבכלמ]?שעתיים(?=$|[^א-ת])/.test(text)) return 120;

  const hourNumMatch = text.match(/(\d+(?:[.,]\d+)?)\s*(?:שעות|hours?|hrs?)/i);
  if (hourNumMatch && hourNumMatch[1]) {
    const hrs = Number(hourNumMatch[1].replace(',', '.'));
    if (Number.isFinite(hrs) && hrs > 0) {
      return Math.round(hrs * 60);
    }
  }

  if (/(?:כשעה|לשעה|במשך\s+שעה|למשך\s+שעה|(?:^|[^א-ת])שעה(?=$|[^א-ת])|\b(?:an|1)\s+hour\b)/i.test(text)) {
    return 60;
  }

  return null;
}

/**
 * Detects whether a recipe step genuinely requires an exact waiting timer in
 * Kitchen Mode: baking in the oven, proofing/rising, or cooling/chilling.
 * Returns null for all prep/cooking/sautéing/preheat steps.
 */
export function getKitchenStepTimerInfo(step?: KitchenStepInput | null): KitchenStepTimerInfo | null {
  if (!step || typeof step.instruction !== 'string' || !step.instruction.trim()) {
    return null;
  }

  const cleaned = sanitizeStepTextForTimerDetection(step.instruction);
  let category: KitchenTimerCategory | null = null;

  const hasExplicitBakeVerb =
    /(?:^|[^א-ת])[והבכלמש]?(?:אופים|אופה|לאפות|נאפה|תיאפה|יאפה|אפייה|אפיה)(?=$|[^א-ת])/.test(cleaned)
    || /(?:^|[^א-ת])(?:מכניסים|הכניסו|מעבירים|להכניס|להעביר|צולים|לצלות|צלייה)[^\n.]{0,40}(?:ל|ב)תנור(?=$|[^א-ת])/.test(cleaned)
    || /(?:^|[^א-ת])בתנור\s+(?:למשך|במשך|ל-|כ-|\d)/.test(cleaned)
    || /\b(?:bake|baking)\b/i.test(cleaned)
    || /\b(?:put|place|transfer|roast|bake)\b[^\n.]{0,40}\b(?:in|into)\s+(?:the\s+)?oven\b/i.test(cleaned)
    || /\bin\s+(?:the\s+)?oven\s+(?:for|until)\b/i.test(cleaned);

  const isPreheatOnly =
    /(?:מחממים|להדליק|מדליקים|לחמם|חימום(?:\s+מראש)?)\s+(?:את\s+)?(?:ה)?תנור/.test(cleaned)
    || /\bpre-?heat\b/i.test(cleaned);

  const hasOvenKeyword =
    /(?:^|[^א-ת])[לב]?תנור(?=$|[^א-ת])|\boven\b/i.test(cleaned);

  if (hasExplicitBakeVerb || (!isPreheatOnly && hasOvenKeyword)) {
    category = 'baking';
  } else if (
    /(?:^|[^א-ת])[והבכלמש]?(?:התפחה|התפחות|תפיחה|להתפיח|מתפיחים|מתפיחה|התפיחו|תתפיחו|לתפוח|יתפח|יתפחו|תופח|תופחים|מכפיל(?:ה|ים)?\s+(?:את\s+)?נפח)(?=$|[^א-ת])|\b(?:proof|proofing|rise|rising|ferment|fermenting|double\s+in\s+size)\b/i.test(cleaned)
  ) {
    category = 'proofing';
  } else if (
    /(?:^|[^א-ת])(?:[והבכלמש]?(?:קירור|צינון|הקפאה|מקררים|לקרר|מצננים|מצננת|לצנן|מתקרר|מתקררת|להתקרר|מקפיאים|להקפיא)|[בל]מקרר|[בל]מקפיא)(?=$|[^א-ת])|\b(?:cool|cooling|chill|chilling|refrigerate|refrigerating)\b|\b(?:in|into)\s+(?:the\s+)?(?:fridge|refrigerator|freezer)\b|\bfreeze\s+(?:for|until)\b/i.test(cleaned)
  ) {
    category = 'cooling';
  }

  if (!category) {
    return null;
  }

  const structuredDuration =
    typeof step.durationMinutes === 'number' && Number.isFinite(step.durationMinutes) && step.durationMinutes > 0
      ? step.durationMinutes
      : null;

  const durationMinutes = structuredDuration ?? extractDurationMinutesFromStepText(step.instruction);
  if (!durationMinutes || durationMinutes <= 0) {
    return null;
  }

  return {
    eligible: true,
    category,
    durationMinutes,
    labelHe: CATEGORY_LABELS_HE[category],
  };
}
