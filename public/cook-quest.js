// Cook Quest v2.1.3 (Build 43) — Standalone Zero-Dependency Lazy-Loaded Interactive First-Run Experience
// Loaded dynamically ONLY when needed (zero cost for completed/skipped returning users).

export const QUEST_STORAGE_KEY = 'recipes_quest_v2';

export const QUEST_STRINGS = {
  he: {
    brandName: 'SousChef AI',
    introLines: [
      'סרטון בטיקטוק.',
      'מתכון מלא.',
      'בלי לעצור, בלי לרשום.'
    ],
    introCta: 'בוא נתחיל',
    introSkip: 'דלג',
    introSoundOn: 'צליל פועל',
    introSoundOff: 'צליל כבוי',
    introTapHint: 'הקש בכל מקום כדי להמשיך מהר',
    exitLabel: 'יציאה',
    skipMission: 'דלג על המשימה',
    xpChip: '+20 XP',
    questTitle: 'משימת השף',
    missionPrefix: 'משימה',
    of: 'מתוך',
    demoBadge: 'הדגמה',
    demoTitle: 'פסטה עגבניות שרי ובזיליקום',
    demoScanning: 'סורק את הסרטון ומזהה מצרכים...',
    demoAssembling: 'מרכיב מתכון מסודר בעברית...',
    demoSkipTap: 'הקש לדילוג על ההדגמה',
    demoTipTitle: 'טיפ השף 💡',
    demoTipText: 'שומרים חצי כוס ממי הפסטה — הם הופכים את הרוטב לקטיפתי!',
    demoTryNow: 'עכשיו נסה בעצמך! הדבק כאן קישור (אופציונלי) או המשך למשימה הבאה.',
    demoContinueBtn: 'המשך למשימה הבאה ←',
    demoIngredients: [
      { name: 'פסטה פנה', amount: 400, unit: 'גרם' },
      { name: 'עגבניות שרי', amount: 300, unit: 'גרם' },
      { name: 'שיני שום', amount: 4, unit: 'יחידות' },
      { name: 'שמן זית', amount: 3, unit: 'כפות' }
    ],
    demoSteps: [
      'מבשלים את הפסטה אל-דנטה במי מלח.',
      'מקפיצים עגבניות שרי ושום בשמן זית 6 דקות.',
      'מערבבים עם הפסטה ובזיליקום טרי ומגישים חם!'
    ],
    missions: [
      {
        id: 'open_collection',
        icon: '🗂️',
        title: 'פתח קבוצה',
        coach: 'המתכונים מאורגנים בקבוצות לפי אווירה. לחץ על אחת מקלפי הקבוצות כדי לפתוח אותה!',
        sr: 'משימה 1 מתוך 5: פתח קבוצת מתכונים'
      },
      {
        id: 'open_recipe',
        icon: '📖',
        title: 'פתח מתכון',
        coach: 'מעולה! עכשיו פתח מתכון כדי לראות מצרכים, כמויות ושלבי הכנה מסודרים.',
        sr: 'משימה 2 מתוך 5: פתח מתכון'
      },
      {
        id: 'kitchen_mode',
        icon: '👨‍🍳',
        title: 'מצב מטבח',
        coach: 'מבשלים בלי לגעת במסך! לחץ על "מצב מטבח" לתצוגת טקסט גדול וטיימרים חכמים.',
        coachInKitchen: 'כך נראה מצב מטבח — טקסט גדול ונוח. אפשר לצאת ממנו כדי להמשיך למשימה הבאה!',
        sr: 'משימה 3 מתוך 5: כנס למצב מטבח'
      },
      {
        id: 'demo_extract',
        icon: '🎬',
        title: 'חלץ מתכון מסרטון',
        coach: 'תראה איך סרטון הופך למתכון מלא תוך שניות — הדגמה חיה ללא ניצול מכסה!',
        sr: 'משימה 4 מתוך 5: הדגמת חילוץ מתכון מסרטון'
      },
      {
        id: 'shopping_list',
        icon: '🛒',
        title: 'קנה את המצרכים',
        coach: 'משימה אחרונה! פתח את רשימת הקניות והוסף פריט אחד (או לחץ "קנה מצרכים").',
        sr: 'משימה 5 מתוך 5: פתח את רשימת הקניות והוסף פריט'
      }
    ],
    finaleTitle: 'כל הכבוד, השלמת את משימת השף!',
    badgeTitle: 'שף מתחיל',
    badgeSubtitleEn: 'Chef Initiate',
    badgeCollectionSingle: 'קבוצה אחת זמינה',
    badgeCollectionsLabel: 'קבוצות זמינות',
    shareBtn: 'שתף הישג',
    shareText: 'השלמתי את Cook Quest וקיבלתי תג שף מתחיל ב-SousChef AI! 👨‍🍳',
    ctaExtract: 'חלץ מתכון ראשון',
    ctaDiscover: 'גלה מתכונים',
    ctaSignIn: 'התחבר לשמירה בענן',
    closeFinale: 'סגור'
  },
  en: {
    brandName: 'SousChef AI',
    introLines: [
      'A TikTok video.',
      'A complete recipe.',
      'No pausing, no writing.'
    ],
    introCta: 'Let us begin',
    introSkip: 'Skip',
    introSoundOn: 'Sound on',
    introSoundOff: 'Sound off',
    introTapHint: 'Tap anywhere to fast-forward',
    exitLabel: 'Exit',
    skipMission: 'Skip mission',
    xpChip: '+20 XP',
    questTitle: 'Cook Quest',
    missionPrefix: 'Mission',
    of: 'of',
    demoBadge: 'Demo',
    demoTitle: 'Cherry Tomato & Basil Pasta',
    demoScanning: 'Scanning video and detecting ingredients...',
    demoAssembling: 'Assembling structured recipe...',
    demoSkipTap: 'Tap to skip demo',
    demoTipTitle: 'Chef Tip 💡',
    demoTipText: 'Save half a cup of pasta water to make the sauce silky!',
    demoTryNow: 'Now try it yourself! Paste a link here (optional) or continue.',
    demoContinueBtn: 'Continue to next mission →',
    demoIngredients: [
      { name: 'Penne pasta', amount: 400, unit: 'g' },
      { name: 'Cherry tomatoes', amount: 300, unit: 'g' },
      { name: 'Garlic cloves', amount: 4, unit: 'pcs' },
      { name: 'Olive oil', amount: 3, unit: 'tbsp' }
    ],
    demoSteps: [
      'Boil pasta al dente in salted water.',
      'Saute cherry tomatoes and garlic in olive oil for 6 minutes.',
      'Toss with pasta and fresh basil and serve hot!'
    ],
    missions: [
      { id: 'open_collection', icon: '🗂️', title: 'Open a collection', coach: 'Tap any collection card to explore its recipes!', sr: 'Mission 1 of 5: Open a collection' },
      { id: 'open_recipe', icon: '📖', title: 'Open a recipe', coach: 'Now open a recipe to see clean ingredients and steps.', sr: 'Mission 2 of 5: Open a recipe' },
      { id: 'kitchen_mode', icon: '👨‍🍳', title: 'Kitchen mode', coach: 'Enter Kitchen Mode for big hands-free text and timers!', coachInKitchen: 'This is Kitchen Mode! Exit whenever ready for the next mission.', sr: 'Mission 3 of 5: Enter Kitchen Mode' },
      { id: 'demo_extract', icon: '🎬', title: 'Extract a recipe', coach: 'Watch a live demo of turning a video into a full recipe — zero quota used!', sr: 'Mission 4 of 5: Demo recipe extraction' },
      { id: 'shopping_list', icon: '🛒', title: 'Buy ingredients', coach: 'Last mission! Open the shopping list and add 1 item.', sr: 'Mission 5 of 5: Open shopping list and add 1 item' }
    ],
    finaleTitle: 'Well done! You completed Cook Quest!',
    badgeTitle: 'Chef Initiate',
    badgeSubtitleEn: 'Chef Initiate',
    badgeCollectionSingle: '1 Collection',
    badgeCollectionsLabel: 'Collections',
    shareBtn: 'Share badge',
    shareText: 'I earned the Chef Initiate badge in SousChef AI!',
    ctaExtract: 'Extract first recipe',
    ctaDiscover: 'Discover recipes',
    ctaSignIn: 'Sign in to save in cloud',
    closeFinale: 'Close'
  }
};

export function detectQuestRuntimeCaps() {
  const isReducedMotion = typeof window !== 'undefined' && typeof window.matchMedia === 'function'
    ? window.matchMedia('(prefers-reduced-motion: reduce)').matches
    : false;
  const cores = typeof navigator !== 'undefined' && typeof navigator.hardwareConcurrency === 'number'
    ? navigator.hardwareConcurrency
    : 8;
  const mem = typeof navigator !== 'undefined' && typeof navigator.deviceMemory === 'number'
    ? navigator.deviceMemory
    : 8;
  const isLiteMode = Boolean(isReducedMotion || cores <= 4 || mem <= 2);
  return { isReducedMotion, isLiteMode };
}

/**
 * Pure viewport-clamped positioning helper for the Cook Quest coach card.
 * Guarantees the card stays within [12px .. viewportWidth - cardWidth - 12px]
 * and respects safe-area insets across mobile (320-414px) and desktop (1280-1920px).
 */
export function computeCoachCardPosition(targetRect, viewport, cardSize, safeInsets = {}) {
  const vw = Math.max(0, Number(viewport?.width) || 0);
  const vh = Math.max(0, Number(viewport?.height) || 0);
  const maxAllowedWidth = Math.max(0, Math.min(340, vw - 24));
  const rawW = Number(cardSize?.width) || maxAllowedWidth;
  const cw = Math.min(rawW, maxAllowedWidth);
  const ch = Math.max(80, Number(cardSize?.height) || 170);

  const insetLeft = Math.max(12, 12 + (Number(safeInsets.left) || 0));
  const insetRight = Math.max(12, 12 + (Number(safeInsets.right) || 0));
  const insetTop = Math.max(60, 60 + (Number(safeInsets.top) || 0));
  const insetBottom = Math.max(12, 12 + (Number(safeInsets.bottom) || 0));

  const minLeft = insetLeft;
  const maxLeft = Math.max(minLeft, vw - cw - insetRight);
  const minTop = insetTop;
  const maxTop = Math.max(minTop, vh - ch - insetBottom);
  const clamp = (val, lo, hi) => Math.max(lo, Math.min(hi, val));

  const hasValidTarget = Boolean(targetRect && targetRect.w > 4 && targetRect.h > 4);
  if (!hasValidTarget) {
    return {
      left: Math.round(clamp((vw - cw) / 2, minLeft, maxLeft)),
      top: Math.round(clamp((vh - ch) / 2, minTop, maxTop)),
      width: Math.round(cw),
      placement: 'center'
    };
  }

  const gap = 14;
  const centeredDesiredLeft = targetRect.x + (targetRect.w / 2) - (cw / 2);

  // 1. Prefer below target
  const belowTop = targetRect.y + targetRect.h + gap;
  if (belowTop + ch <= vh - insetBottom) {
    return {
      left: Math.round(clamp(centeredDesiredLeft, minLeft, maxLeft)),
      top: Math.round(clamp(belowTop, minTop, maxTop)),
      width: Math.round(cw),
      placement: 'below'
    };
  }

  // 2. Fallback above target
  const aboveTop = targetRect.y - gap - ch;
  if (aboveTop >= minTop) {
    return {
      left: Math.round(clamp(centeredDesiredLeft, minLeft, maxLeft)),
      top: Math.round(clamp(aboveTop, minTop, maxTop)),
      width: Math.round(cw),
      placement: 'above'
    };
  }

  // 3. Fallback beside target (desktop / tall targets)
  const leftSide = targetRect.x - gap - cw;
  if (leftSide >= minLeft) {
    return {
      left: Math.round(clamp(leftSide, minLeft, maxLeft)),
      top: Math.round(clamp(targetRect.y, minTop, maxTop)),
      width: Math.round(cw),
      placement: 'left'
    };
  }
  const rightSide = targetRect.x + targetRect.w + gap;
  if (rightSide + cw <= vw - insetRight) {
    return {
      left: Math.round(clamp(rightSide, minLeft, maxLeft)),
      top: Math.round(clamp(targetRect.y, minTop, maxTop)),
      width: Math.round(cw),
      placement: 'right'
    };
  }

  // 4. Clamped fallback on small viewports
  const spaceBelow = vh - (targetRect.y + targetRect.h);
  const spaceAbove = targetRect.y;
  const fallbackTop = spaceBelow >= spaceAbove ? belowTop : aboveTop;
  return {
    left: Math.round(clamp(centeredDesiredLeft, minLeft, maxLeft)),
    top: Math.round(clamp(fallbackTop, minTop, maxTop)),
    width: Math.round(cw),
    placement: 'clamped'
  };
}

/**
 * Formats the finale badge metadata line.
 * Omits the collections count segment and separator completely when colsCount <= 0.
 */
export function formatFinaleMeta(dateStr, colsCount, strings) {
  const count = Number(colsCount) || 0;
  const datePart = `📅 ${dateStr}`;
  if (count <= 0) return datePart;
  const label = count === 1 && strings?.badgeCollectionSingle
    ? strings.badgeCollectionSingle
    : `${count} ${strings?.badgeCollectionsLabel || 'קבוצות זמינות'}`;
  return `${datePart} • 🗂️ ${label}`;
}

const BUILTIN_DEMO_RECIPE = {
  id: 'rec_quest_demo_local',
  title: 'שקשוקה ביתית מהירה (מתכון הדגמה)',
  description: 'מתכון הדגמה מקומי עבור Cook Quest — לא נשמר בספר המתכונים שלך.',
  platform: 'web',
  sourceUrl: '',
  servings: 4,
  prepTimeMinutes: 5,
  cookTimeMinutes: 15,
  totalTimeMinutes: 20,
  difficulty: 'קל',
  imageUrl: 'https://images.unsplash.com/photo-1590301157890-4810ed352733?w=800&auto=format&fit=crop',
  ingredients: [
    { id: 'd1', name: 'עגבניות בשלות', amount: 5, unit: 'יחידות', category: 'produce', originalText: '5 עגבניות בשלות' },
    { id: 'd2', name: 'ביצים גדולות', amount: 4, unit: 'יחידות', category: 'dairy', originalText: '4 ביצים גדולות' },
    { id: 'd3', name: 'שום כתוש', amount: 3, unit: 'שיניים', category: 'produce', originalText: '3 שיני שום' }
  ],
  instructions: [
    { stepNumber: 1, instruction: 'מחממים שמן זית במחבת ומטגנים שום כדקה.', durationMinutes: 2 },
    { stepNumber: 2, instruction: 'מוסיפים עגבניות ומבשלים 10 דקות עד שהרוטב מסמיך.', durationMinutes: 10 },
    { stepNumber: 3, instruction: 'שוברים ביצים מעל, מכסים ומבשלים 4 דקות.', durationMinutes: 4 }
  ],
  tags: ['הדגמה', 'מהיר'],
  __isQuestDemo: true
};

class CookQuestController {
  constructor(hooks, lang = 'he') {
    this.hooks = hooks || {};
    this.lang = QUEST_STRINGS[lang] ? lang : 'he';
    this.str = QUEST_STRINGS[this.lang];
    this.caps = detectQuestRuntimeCaps();
    this.root = null;
    this.styleEl = null;
    this.active = false;
    this.missionIndex = 0; // 0..4
    this.soundEnabled = false;
    this.audioCtx = null;
    this.rafIds = [];
    this.timers = [];
    this.cleanupFns = [];
    this.spotRect = { x: 20, y: 80, w: 280, h: 120 };
    this.targetRect = { x: 20, y: 80, w: 280, h: 120 };
    this.missingSince = 0;
    this.centeredFallback = false;
    this.resizeObs = null;
    this.mutObs = null;
    this.demoCompletedForMission4 = false;
    this.inKitchenSeen = false;
    this.missionCompleting = false;
    this.previouslyFocusedEl = null;
  }

  safeRun(fn) {
    try {
      return fn();
    } catch (err) {
      console.warn('[CookQuest] Caught error, ending quest safely:', err);
      this.abortWithSkipped(true);
      return null;
    }
  }

  track(eventName, meta = {}) {
    try {
      if (typeof this.hooks.trackEvent === 'function') {
        this.hooks.trackEvent(eventName, meta);
      }
    } catch (_e) {}
  }

  readState() {
    try {
      const raw = localStorage.getItem(QUEST_STORAGE_KEY);
      if (!raw) return { status: 'new', mission: 0, badge: false };
      const parsed = JSON.parse(raw);
      return {
        status: ['new', 'in_progress', 'done', 'skipped'].includes(parsed?.status) ? parsed.status : 'new',
        mission: Math.max(0, Math.min(4, Number(parsed?.mission) || 0)),
        badge: Boolean(parsed?.badge)
      };
    } catch (_e) {
      return { status: 'new', mission: 0, badge: false };
    }
  }

  writeState(patch) {
    const next = { ...this.readState(), ...patch };
    try {
      localStorage.setItem(QUEST_STORAGE_KEY, JSON.stringify(next));
    } catch (_e) {}
    try {
      if (typeof this.hooks.syncPreferences === 'function') {
        this.hooks.syncPreferences(next);
      }
    } catch (_e) {}
    return next;
  }

  playTone(freq = 520, durationMs = 90) {
    if (!this.soundEnabled || typeof window === 'undefined') return;
    try {
      const Ctx = window.AudioContext || window.webkitAudioContext;
      if (!Ctx) return;
      if (!this.audioCtx) this.audioCtx = new Ctx();
      const osc = this.audioCtx.createOscillator();
      const gain = this.audioCtx.createGain();
      osc.type = 'sine';
      osc.frequency.value = freq;
      gain.gain.setValueAtTime(0.06, this.audioCtx.currentTime);
      gain.gain.exponentialRampToValueAtTime(0.001, this.audioCtx.currentTime + durationMs / 1000);
      osc.connect(gain);
      gain.connect(this.audioCtx.destination);
      osc.start();
      osc.stop(this.audioCtx.currentTime + durationMs / 1000);
    } catch (_e) {}
  }

  injectStyles() {
    if (document.getElementById('cook-quest-styles')) return;
    const style = document.createElement('style');
    style.id = 'cook-quest-styles';
    style.textContent = `
      .cq-root { position: fixed; inset: 0; z-index: 9995; pointer-events: none; font-family: inherit; direction: rtl; }
      .cq-intro { position: fixed; inset: 0; z-index: 9998; pointer-events: auto; display: flex; flex-direction: column; align-items: center; justify-content: center; padding: max(20px, env(safe-area-inset-top)) 20px max(24px, env(safe-area-inset-bottom)); background: linear-gradient(145deg, #0b1320 0%, #092e25 48%, #261422 100%); color: #fff; overflow: hidden; text-align: center; }
      .cq-aurora-blob { position: absolute; border-radius: 50%; filter: blur(68px); opacity: 0.42; pointer-events: none; will-change: transform; }
      .cq-blob-1 { width: 320px; height: 320px; background: #10b981; top: -80px; right: -60px; animation: cqDrift 9s ease-in-out infinite alternate; }
      .cq-blob-2 { width: 290px; height: 290px; background: #f59e0b; bottom: -70px; left: -60px; animation: cqDrift 11s ease-in-out infinite alternate-reverse; }
      .cq-blob-3 { width: 240px; height: 240px; background: #ec4899; top: 40%; left: 30%; animation: cqDrift 13s ease-in-out infinite alternate; }
      .cq-lite .cq-aurora-blob { display: none; }
      @keyframes cqDrift { from { transform: translate3d(0,0,0) scale(1); } to { transform: translate3d(28px,-24px,0) scale(1.12); } }
      .cq-float-layer { position: absolute; inset: 0; pointer-events: none; overflow: hidden; }
      .cq-float-emoji { position: absolute; font-size: 2rem; opacity: 0.28; will-change: transform; transition: transform 0.12s linear; }
      .cq-intro-stage { position: relative; z-index: 2; max-width: 440px; width: 100%; display: flex; flex-direction: column; align-items: center; gap: 18px; }
      .cq-kinetic-line { min-height: 76px; display: flex; flex-wrap: wrap; justify-content: center; align-items: center; gap: 8px; font-size: clamp(1.65rem, 6vw, 2.35rem); font-weight: 900; line-height: 1.25; }
      .cq-word { display: inline-block; opacity: 0; transform: translateY(18px) scale(0.92); animation: cqWordIn 0.42s cubic-bezier(0.22, 1.35, 0.36, 1) forwards; }
      @keyframes cqWordIn { to { opacity: 1; transform: translateY(0) scale(1); } }
      .cq-logo-assemble { display: flex; flex-direction: column; align-items: center; gap: 6px; opacity: 0; transform: scale(0.85); transition: opacity 0.45s ease, transform 0.45s cubic-bezier(0.22, 1.35, 0.36, 1); }
      .cq-logo-assemble.show { opacity: 1; transform: scale(1); }
      .cq-logo-pieces { font-size: 1.8rem; letter-spacing: 6px; }
      .cq-logo-title { font-size: 2rem; font-weight: 900; background: linear-gradient(90deg, #34d399, #fde68a); -webkit-background-clip: text; -webkit-text-fill-color: transparent; }
      .cq-intro-actions { display: flex; flex-direction: column; align-items: center; gap: 10px; margin-top: 10px; width: 100%; }
      .cq-btn-primary { background: linear-gradient(135deg, #10b981, #059669); color: #fff; border: none; border-radius: 16px; padding: 13px 28px; font-family: inherit; font-size: 1rem; font-weight: 900; cursor: pointer; box-shadow: 0 10px 24px rgba(16,185,129,0.35); min-width: 190px; }
      .cq-btn-ghost { background: transparent; border: none; color: rgba(255,255,255,0.78); font-family: inherit; font-size: 0.88rem; font-weight: 700; cursor: pointer; padding: 6px 12px; }
      .cq-sound-toggle { position: absolute; top: max(14px, env(safe-area-inset-top)); left: 14px; z-index: 5; background: rgba(255,255,255,0.14); color: #fff; border: 1px solid rgba(255,255,255,0.24); border-radius: 999px; padding: 6px 12px; font-size: 0.8rem; font-weight: 700; cursor: pointer; }
      .cq-static-cards { display: grid; gap: 10px; width: 100%; }
      .cq-static-card { background: rgba(255,255,255,0.1); border: 1px solid rgba(255,255,255,0.2); border-radius: 14px; padding: 12px 16px; font-weight: 800; font-size: 1.05rem; }

      /* Act 2: Spotlight, Guard, Progress Pill, Mascot & Glass Card */
      .cq-spotlight-svg { position: fixed; inset: 0; width: 100vw; height: 100vh; z-index: 9995; pointer-events: none; }
      .cq-blocker { position: fixed; z-index: 9995; pointer-events: auto; background: transparent; }
      .cq-neon-ring { position: fixed; top: 0; left: 0; right: auto; bottom: auto; box-sizing: border-box; z-index: 9996; pointer-events: none; border-radius: 16px; border: 2.5px solid #34d399; box-shadow: 0 0 18px rgba(52,211,153,0.65), inset 0 0 10px rgba(52,211,153,0.28); animation: cqPulseRing 1.8s ease-in-out infinite; }
      .cq-lite .cq-neon-ring { animation: none; box-shadow: 0 0 0 2px rgba(52,211,153,0.6); }
      @keyframes cqPulseRing { 0%, 100% { transform: scale(1); opacity: 0.95; } 50% { transform: scale(1.015); opacity: 0.72; } }

      .cq-top-pill { position: fixed; top: max(10px, env(safe-area-inset-top)); left: 50%; transform: translateX(-50%); z-index: 9998; pointer-events: auto; display: flex; align-items: center; gap: 10px; padding: 8px 14px; border-radius: 999px; background: rgba(15, 23, 42, 0.86); backdrop-filter: blur(12px); -webkit-backdrop-filter: blur(12px); border: 1px solid rgba(52,211,153,0.4); color: #fff; box-shadow: 0 8px 24px rgba(0,0,0,0.28); max-width: calc(100vw - 20px); }
      .cq-lite .cq-top-pill { backdrop-filter: none; -webkit-backdrop-filter: none; background: #0f172a; }
      .cq-dots { display: flex; align-items: center; gap: 6px; }
      .cq-dot { width: 26px; height: 26px; border-radius: 50%; display: flex; align-items: center; justify-content: center; font-size: 0.82rem; background: rgba(255,255,255,0.12); border: 1.5px solid rgba(255,255,255,0.25); transition: transform 0.25s ease, background 0.25s ease; }
      .cq-dot.active { border-color: #34d399; transform: scale(1.12); background: rgba(16,185,129,0.25); }
      .cq-dot.done { background: #10b981; border-color: #6ee7b7; transform: scale(1.06); }
      .cq-exit-btn { background: rgba(255,255,255,0.14); color: #fff; border: none; border-radius: 999px; width: 28px; height: 28px; font-weight: 900; cursor: pointer; display: flex; align-items: center; justify-content: center; }

      .cq-coach-wrap { position: fixed; top: 0; left: 0; right: auto; bottom: auto; z-index: 9998; pointer-events: auto; width: min(340px, calc(100vw - 24px)); max-width: calc(100vw - 24px); box-sizing: border-box; transition: transform 0.35s cubic-bezier(0.22, 1.15, 0.36, 1); will-change: transform; }
      .cq-lite .cq-coach-wrap { transition: none; }
      .cq-glass-card { background: rgba(15, 23, 42, 0.9); backdrop-filter: blur(14px); -webkit-backdrop-filter: blur(14px); border: 1.5px solid rgba(52, 211, 153, 0.45); box-shadow: 0 18px 38px rgba(0,0,0,0.35), inset 0 1px 0 rgba(255,255,255,0.14); border-radius: 20px; padding: 15px 16px; color: #f8fafc; text-align: right; }
      .cq-lite .cq-glass-card { backdrop-filter: none; -webkit-backdrop-filter: none; background: #0f172a; }
      .cq-coach-head { display: flex; align-items: center; gap: 10px; margin-bottom: 8px; }
      .cq-mascot-svg { width: 42px; height: 42px; flex-shrink: 0; animation: cqBob 2.2s ease-in-out infinite; }
      .cq-lite .cq-mascot-svg { animation: none; }
      @keyframes cqBob { 0%,100% { transform: translateY(0); } 50% { transform: translateY(-4px); } }
      .cq-coach-title { font-weight: 900; font-size: 0.98rem; color: #6ee7b7; }
      .cq-coach-text { font-size: 0.9rem; line-height: 1.5; color: #f1f5f9; min-height: 40px; cursor: pointer; }
      .cq-coach-foot { display: flex; align-items: center; justify-content: space-between; gap: 8px; margin-top: 10px; }
      .cq-skip-link { background: transparent; border: none; color: #cbd5e1; font-family: inherit; font-size: 0.8rem; font-weight: 700; cursor: pointer; text-decoration: underline; padding: 4px; }
      .cq-xp-toast { position: fixed; top: 64px; left: 50%; transform: translateX(-50%); z-index: 9999; background: #10b981; color: #fff; font-weight: 900; font-size: 0.9rem; padding: 6px 14px; border-radius: 999px; box-shadow: 0 8px 20px rgba(16,185,129,0.4); animation: cqXpPop 1.1s ease forwards; pointer-events: none; }
      @keyframes cqXpPop { 0% { opacity: 0; transform: translate(-50%, 10px) scale(0.8); } 20% { opacity: 1; transform: translate(-50%, 0) scale(1.06); } 100% { opacity: 0; transform: translate(-50%, -22px) scale(0.95); } }

      /* Mission 4 Demo Extraction Modal */
      .cq-demo-overlay { position: fixed; inset: 0; z-index: 9998; pointer-events: auto; background: rgba(11, 19, 32, 0.82); display: flex; align-items: center; justify-content: center; padding: 16px; }
      .cq-demo-card { width: min(440px, 100%); max-height: 88vh; overflow-y: auto; border-radius: 20px; background: rgba(15, 23, 42, 0.95); border: 1.5px solid rgba(52,211,153,0.48); padding: 18px; color: #f8fafc; box-shadow: 0 24px 48px rgba(0,0,0,0.45); }
      .cq-demo-video { position: relative; height: 118px; border-radius: 14px; background: linear-gradient(135deg, #7c2d12, #065f46); overflow: hidden; display: flex; align-items: center; justify-content: center; margin-bottom: 12px; }
      .cq-scan-line { position: absolute; left: 0; right: 0; height: 3px; background: #34d399; box-shadow: 0 0 14px #34d399; top: 0; animation: cqScan 1.6s linear infinite; }
      @keyframes cqScan { 0% { transform: translateY(0); } 100% { transform: translateY(116px); } }
      .cq-demo-chip { display: inline-flex; align-items: center; gap: 6px; background: rgba(16,185,129,0.18); border: 1px solid rgba(52,211,153,0.45); border-radius: 999px; padding: 5px 10px; font-size: 0.8rem; font-weight: 800; opacity: 0; transform: translateY(-14px) scale(0.85); transition: all 0.35s cubic-bezier(0.22, 1.35, 0.36, 1); }
      .cq-demo-chip.in { opacity: 1; transform: translateY(0) scale(1); }
      .cq-demo-step { font-size: 0.84rem; padding: 7px 10px; border-radius: 10px; background: rgba(255,255,255,0.07); margin-bottom: 6px; opacity: 0; transform: translateX(12px); transition: all 0.32s ease; }
      .cq-demo-step.in { opacity: 1; transform: translateX(0); }
      .cq-tip-flip { margin-top: 10px; padding: 10px 12px; border-radius: 12px; background: rgba(245,158,11,0.18); border: 1px solid rgba(251,191,36,0.45); transform: rotateX(85deg); opacity: 0; transition: all 0.45s cubic-bezier(0.22, 1.25, 0.36, 1); }
      .cq-tip-flip.in { transform: rotateX(0deg); opacity: 1; }

      /* Act 3 Finale */
      .cq-finale { position: fixed; inset: 0; z-index: 9998; pointer-events: auto; background: rgba(11, 19, 32, 0.88); display: flex; align-items: center; justify-content: center; padding: 16px; }
      .cq-confetti-canvas { position: fixed; inset: 0; width: 100vw; height: 100vh; pointer-events: none; z-index: 9999; }
      .cq-badge-card { background: linear-gradient(145deg, #064e3b, #0f172a); border: 2px solid #34d399; border-radius: 22px; padding: 20px; text-align: center; margin: 12px 0 16px; box-shadow: 0 14px 32px rgba(16,185,129,0.28); }
      .cq-cta-row { display: flex; flex-wrap: wrap; gap: 8px; justify-content: center; }
      .cq-cta-btn { flex: 1 1 120px; padding: 10px 12px; border-radius: 12px; border: 1px solid rgba(52,211,153,0.4); background: rgba(255,255,255,0.08); color: #fff; font-family: inherit; font-weight: 800; font-size: 0.82rem; cursor: pointer; }
    `;
    document.head.appendChild(style);
    this.styleEl = style;
  }

  mascotSvg(state = 'idle') {
    const mouth = state === 'celebrating'
      ? '<path d="M18 33 Q24 40 30 33" stroke="#065f46" stroke-width="2.5" fill="none" stroke-linecap="round"/>'
      : state === 'talking'
        ? '<ellipse cx="24" cy="34" rx="4" ry="3" fill="#065f46"/>'
        : '<path d="M19 34 Q24 37 29 34" stroke="#065f46" stroke-width="2.2" fill="none" stroke-linecap="round"/>';
    return `<svg class="cq-mascot-svg" viewBox="0 0 48 48" aria-hidden="true">
      <circle cx="24" cy="27" r="16" fill="#ecfdf5" stroke="#10b981" stroke-width="2.2"/>
      <path d="M12 20 C8 12, 16 7, 21 10 C23 5, 29 5, 31 10 C37 8, 42 14, 36 20 Z" fill="#ffffff" stroke="#10b981" stroke-width="2"/>
      <rect x="13" y="18" width="22" height="5" rx="2" fill="#d1fae5" stroke="#10b981" stroke-width="1.5"/>
      <circle cx="19" cy="28" r="2.1" fill="#064e3b"/>
      <circle cx="29" cy="28" r="2.1" fill="#064e3b"/>
      ${mouth}
    </svg>`;
  }

  ensureRoot() {
    if (this.root) this.root.remove();
    this.injectStyles();
    const div = document.createElement('div');
    div.id = 'cook-quest-root';
    div.className = 'cq-root' + (this.caps.isLiteMode ? ' cq-lite' : '');
    document.body.appendChild(div);
    this.root = div;
    return div;
  }

  clearRuntime() {
    this.rafIds.forEach((id) => cancelAnimationFrame(id));
    this.rafIds = [];
    this.timers.forEach((id) => clearTimeout(id));
    this.timers = [];
    this.cleanupFns.forEach((fn) => { try { fn(); } catch (_e) {} });
    this.cleanupFns = [];
    if (this.resizeObs) { try { this.resizeObs.disconnect(); } catch (_e) {} this.resizeObs = null; }
    if (this.mutObs) { try { this.mutObs.disconnect(); } catch (_e) {} this.mutObs = null; }
  }

  destroyDom() {
    this.clearRuntime();
    if (this.root) { this.root.remove(); this.root = null; }
    // Ensure no leftover confetti canvases or stuck scroll locks remain
    try {
      document.querySelectorAll('.cq-confetti-canvas').forEach((c) => c.remove());
      if (document.body && document.body.style && document.body.style.overflow === 'hidden') {
        document.body.style.overflow = '';
      }
    } catch (_e) {}
    this.active = false;
    this.missionCompleting = false;
    if (this.previouslyFocusedEl && typeof this.previouslyFocusedEl.focus === 'function') {
      try { this.previouslyFocusedEl.focus(); } catch (_e) {}
    }
    this.previouslyFocusedEl = null;
  }

  abortWithSkipped(silent = false) {
    const at = this.missionIndex + 1;
    this.destroyDom();
    this.writeState({ status: 'skipped', mission: this.missionIndex });
    if (!silent) this.track('quest_skipped', { at });
  }

  start({ replay = false, introOnly = false, resumeMission = null } = {}) {
    return this.safeRun(() => {
      if (this.active) return;
      this.active = true;
      this.previouslyFocusedEl = typeof document !== 'undefined' ? document.activeElement : null;
      this.ensureRoot();

      if (introOnly) {
        this.runAct1Intro({ introOnly: true });
        return;
      }

      const prev = this.readState();
      if (replay) {
        this.missionIndex = 0;
        this.writeState({ status: 'in_progress', mission: 0 });
        this.track('quest_started', { replay: true });
        this.runAct1Intro({ introOnly: false });
        return;
      }

      if (resumeMission !== null && resumeMission >= 0 && prev.status === 'in_progress') {
        this.missionIndex = Math.min(4, resumeMission);
        this.runAct2Mission(this.missionIndex);
        return;
      }

      this.missionIndex = 0;
      this.writeState({ status: 'in_progress', mission: 0 });
      this.track('quest_started', { replay: false });
      this.runAct1Intro({ introOnly: false });
    });
  }

  // =========================================================================
  // ACT 1: CINEMATIC INTRO (~8s, skippable any moment)
  // =========================================================================
  runAct1Intro({ introOnly = false } = {}) {
    this.safeRun(() => {
      this.clearRuntime();
      const s = this.str;
      const overlay = document.createElement('div');
      overlay.className = 'cq-intro';
      overlay.setAttribute('role', 'dialog');
      overlay.setAttribute('aria-modal', 'true');
      overlay.setAttribute('aria-label', s.brandName);

      const emojis = ['🍅', '🧄', '🌿', '🥩', '🍋', '🌶️', '🥖', '🍳'];
      const floatHtml = this.caps.isReducedMotion ? '' : emojis.map((em, idx) => {
        const top = 10 + ((idx * 17) % 75);
        const left = 8 + ((idx * 23) % 82);
        return `<span class="cq-float-emoji" data-depth="${(idx % 3) + 1}" style="top:${top}%; left:${left}%;">${em}</span>`;
      }).join('');

      overlay.innerHTML = `
        <div class="cq-aurora-blob cq-blob-1"></div>
        <div class="cq-aurora-blob cq-blob-2"></div>
        <div class="cq-aurora-blob cq-blob-3"></div>
        <div class="cq-float-layer" id="cq-float-layer">${floatHtml}</div>
        <button type="button" class="cq-sound-toggle" id="cq-sound-btn" aria-pressed="false">🔇 ${s.introSoundOff}</button>
        <div class="cq-intro-stage">
          ${this.caps.isReducedMotion
            ? `<div class="cq-static-cards">${s.introLines.map((l) => `<div class="cq-static-card">${l}</div>`).join('')}</div>`
            : `<div class="cq-kinetic-line" id="cq-kinetic-line" aria-live="polite"></div>`}
          <div class="cq-logo-assemble ${this.caps.isReducedMotion ? 'show' : ''}" id="cq-logo-assemble">
            <div class="cq-logo-pieces">🍅 🧄 🌿 👨‍🍳</div>
            <div class="cq-logo-title">${s.brandName}</div>
          </div>
          <div class="cq-intro-actions">
            <button type="button" class="cq-btn-primary" id="cq-intro-start-btn">${s.introCta}</button>
            <button type="button" class="cq-btn-ghost" id="cq-intro-skip-btn">${s.introSkip}</button>
            ${this.caps.isReducedMotion ? '' : `<div style="font-size:0.75rem; opacity:0.65;">${s.introTapHint}</div>`}
          </div>
        </div>
      `;
      this.root.innerHTML = '';
      this.root.appendChild(overlay);

      // Sound toggle (off by default, no autoplay)
      const soundBtn = overlay.querySelector('#cq-sound-btn');
      if (soundBtn) {
        soundBtn.onclick = (e) => {
          e.stopPropagation();
          this.soundEnabled = !this.soundEnabled;
          soundBtn.setAttribute('aria-pressed', String(this.soundEnabled));
          soundBtn.textContent = this.soundEnabled ? `🔊 ${s.introSoundOn}` : `🔇 ${s.introSoundOff}`;
          if (this.soundEnabled) this.playTone(620, 80);
        };
      }

      // Desktop pointer & mobile DeviceOrientation parallax
      if (!this.caps.isReducedMotion) {
        const floatEls = Array.from(overlay.querySelectorAll('.cq-float-emoji'));
        const applyParallax = (dx, dy) => {
          for (const el of floatEls) {
            const depth = Number(el.getAttribute('data-depth')) || 1;
            el.style.transform = `translate3d(${(dx * depth * 12).toFixed(1)}px, ${(dy * depth * 12).toFixed(1)}px, 0)`;
          }
        };
        const onPointer = (e) => {
          const dx = (e.clientX / Math.max(1, window.innerWidth)) - 0.5;
          const dy = (e.clientY / Math.max(1, window.innerHeight)) - 0.5;
          applyParallax(dx, dy);
        };
        const onTilt = (e) => {
          if (typeof e.gamma === 'number' && typeof e.beta === 'number') {
            applyParallax(Math.max(-1, Math.min(1, e.gamma / 30)), Math.max(-1, Math.min(1, (e.beta - 45) / 30)));
          }
        };
        window.addEventListener('pointermove', onPointer, { passive: true });
        window.addEventListener('deviceorientation', onTilt, { passive: true });
        this.cleanupFns.push(() => {
          window.removeEventListener('pointermove', onPointer);
          window.removeEventListener('deviceorientation', onTilt);
        });
      }

      // Kinetic lines sequence (~6.5s total, tap anywhere to fast-forward)
      let lineIdx = 0;
      const lineEl = overlay.querySelector('#cq-kinetic-line');
      const logoEl = overlay.querySelector('#cq-logo-assemble');
      const showNextLine = () => {
        if (!lineEl || this.caps.isReducedMotion) return;
        if (lineIdx < s.introLines.length) {
          const words = s.introLines[lineIdx].split(' ');
          lineEl.innerHTML = words.map((w, i) => `<span class="cq-word" style="animation-delay:${i * 110}ms;">${w}</span>`).join('');
          this.playTone(440 + lineIdx * 80, 75);
          lineIdx++;
          this.timers.push(setTimeout(showNextLine, 1900));
        } else if (logoEl) {
          logoEl.classList.add('show');
          this.playTone(680, 120);
        }
      };
      if (!this.caps.isReducedMotion) showNextLine();

      overlay.addEventListener('click', (e) => {
        if (e.target.closest('button')) return;
        this.timers.forEach((t) => clearTimeout(t));
        this.timers = [];
        showNextLine();
      });

      const onKey = (e) => {
        if (e.key === 'Escape') {
          if (introOnly) this.destroyDom();
          else this.abortWithSkipped(false);
        }
      };
      document.addEventListener('keydown', onKey);
      this.cleanupFns.push(() => document.removeEventListener('keydown', onKey));

      overlay.querySelector('#cq-intro-start-btn').onclick = () => {
        if (introOnly) { this.destroyDom(); return; }
        this.runAct2Mission(0);
      };
      overlay.querySelector('#cq-intro-skip-btn').onclick = () => {
        if (introOnly) { this.destroyDom(); return; }
        this.abortWithSkipped(false);
      };
    });
  }

  // =========================================================================
  // ACT 2: COOK QUEST — 5 AUTO-DETECTED INTERACTIVE MISSIONS
  // =========================================================================
  getMissionTargetSelectors(missionId) {
    // Ordered by priority: Mission 1 strictly targets the first group card (.collection-card),
    // including the lone "ללא קבוצה" card on fresh accounts — never the toggle button.
    if (missionId === 'open_collection') return ['.collection-card'];
    if (missionId === 'open_recipe') return ['.curated-showcase-card', '#collection-detail-section .recipe-card', '#library-list .recipe-card'];
    if (missionId === 'kitchen_mode') return ['.btn-kitchen-mode'];
    if (missionId === 'demo_extract') return ['#url-input'];
    if (missionId === 'shopping_list') return ['#tab-btn-shopping'];
    return [];
  }

  getMissionTargetSelector(missionId) {
    return this.getMissionTargetSelectors(missionId)[0] || null;
  }

  findMissionTarget(missionId) {
    const selectors = this.getMissionTargetSelectors(missionId);
    for (const sel of selectors) {
      const nodes = document.querySelectorAll(sel);
      for (const el of nodes) {
        if (!el || el.offsetParent === null) continue;
        const r = el.getBoundingClientRect();
        if (r.width > 4 && r.height > 4) return el;
      }
    }
    return null;
  }

  prepareMissionStage(missionId) {
    const h = this.hooks;
    if (missionId === 'open_collection') {
      h.switchTab?.('library');
      h.setCollectionsView?.();
    } else if (missionId === 'open_recipe') {
      if (!h.hasAnyVisibleRecipeCard?.()) {
        h.openLocalDemoRecipe?.(BUILTIN_DEMO_RECIPE);
      }
    } else if (missionId === 'kitchen_mode') {
      if (!h.hasOpenRecipe?.()) {
        h.openLocalDemoRecipe?.(BUILTIN_DEMO_RECIPE);
      }
      h.switchTab?.('recipe');
    } else if (missionId === 'demo_extract') {
      h.switchTab?.('extract');
    } else if (missionId === 'shopping_list') {
      h.switchTab?.('shopping');
    }
  }

  runAct2Mission(idx) {
    this.safeRun(() => {
      this.clearRuntime();
      this.missionCompleting = false;
      if (idx >= this.str.missions.length) {
        this.runAct3Finale();
        return;
      }
      this.missionIndex = idx;
      this.writeState({ status: 'in_progress', mission: idx });
      const mission = this.str.missions[idx];

      this.prepareMissionStage(mission.id);

      // Mission 4 starts with the zero-network Demo Extraction wow moment!
      if (mission.id === 'demo_extract' && !this.demoCompletedForMission4) {
        this.runDemoExtraction(() => {
          this.demoCompletedForMission4 = true;
          this.renderMissionSpotlight(mission, this.str.demoTryNow, true);
        });
        return;
      }

      this.renderMissionSpotlight(mission, mission.coach, false);
    });
  }

  renderMissionSpotlight(mission, coachText, showContinueBtn) {
    const s = this.str;
    this.root.innerHTML = '';

    // 1. SVG Spotlight Mask
    const svgNS = 'http://www.w3.org/2000/svg';
    const svg = document.createElementNS(svgNS, 'svg');
    svg.setAttribute('class', 'cq-spotlight-svg');
    svg.innerHTML = `
      <defs>
        <mask id="cq-spot-mask">
          <rect x="0" y="0" width="100%" height="100%" fill="white"/>
          <rect id="cq-mask-hole" x="20" y="80" width="280" height="120" rx="16" ry="16" fill="black"/>
        </mask>
      </defs>
      <rect x="0" y="0" width="100%" height="100%" fill="rgba(11,19,32,0.68)" mask="url(#cq-spot-mask)"/>
    `;
    this.root.appendChild(svg);

    // 2. 4-Quadrant Pointer-Events Guard (real UI stays clickable ONLY inside cutout!)
    const blockers = ['top', 'bottom', 'left', 'right'].map((side) => {
      const b = document.createElement('div');
      b.className = 'cq-blocker';
      b.dataset.side = side;
      this.root.appendChild(b);
      return b;
    });

    // 3. Breathing Neon Glow Ring
    const ring = document.createElement('div');
    ring.className = 'cq-neon-ring';
    this.root.appendChild(ring);

    // 4. Top Dish-Building Progress Pill
    const topPill = document.createElement('div');
    topPill.className = 'cq-top-pill';
    topPill.innerHTML = `
      <span style="font-size:0.78rem; font-weight:800; color:#6ee7b7; white-space:nowrap;">${s.missionPrefix} ${this.missionIndex + 1}/${s.missions.length}</span>
      <div class="cq-dots">
        ${s.missions.map((m, i) => `<span class="cq-dot ${i < this.missionIndex ? 'done' : (i === this.missionIndex ? 'active' : '')}" title="${m.title}">${i < this.missionIndex ? '✓' : m.icon}</span>`).join('')}
      </div>
      <button type="button" class="cq-exit-btn" id="cq-exit-btn" aria-label="${s.exitLabel}">✕</button>
    `;
    this.root.appendChild(topPill);

    // 5. Floating Coach Mascot + Glass Speech Bubble
    const coachWrap = document.createElement('div');
    coachWrap.className = 'cq-coach-wrap';
    coachWrap.setAttribute('role', 'dialog');
    coachWrap.setAttribute('aria-modal', 'false');
    coachWrap.setAttribute('aria-label', mission.sr);
    coachWrap.innerHTML = `
      <div class="cq-glass-card">
        <div class="cq-coach-head">
          ${this.mascotSvg('talking')}
          <div>
            <div class="cq-coach-title">${mission.icon} ${mission.title}</div>
            <div style="font-size:0.74rem; color:#94a3b8;">${s.questTitle}</div>
          </div>
        </div>
        <div class="cq-coach-text" id="cq-coach-text" aria-live="polite"></div>
        <div class="cq-coach-foot">
          <button type="button" class="cq-skip-link" id="cq-skip-mission-btn">${s.skipMission}</button>
          ${showContinueBtn ? `<button type="button" class="cq-btn-primary" style="padding:7px 14px; font-size:0.82rem; min-width:0;" id="cq-demo-next-btn">${s.demoContinueBtn}</button>` : ''}
        </div>
      </div>
    `;
    this.root.appendChild(coachWrap);

    // Typewriter text (~25 chars/sec, tap to complete immediately)
    const textEl = coachWrap.querySelector('#cq-coach-text');
    let typeIdx = 0;
    let typeDone = false;
    const finishType = () => {
      typeDone = true;
      if (textEl) textEl.textContent = coachText;
    };
    if (this.caps.isReducedMotion) {
      finishType();
    } else {
      const tickType = () => {
        if (typeDone || !textEl) return;
        typeIdx++;
        textEl.textContent = coachText.slice(0, typeIdx);
        if (typeIdx < coachText.length) {
          this.timers.push(setTimeout(tickType, 38));
        } else {
          typeDone = true;
        }
      };
      tickType();
      textEl.onclick = finishType;
    }

    // Wire buttons & keyboard Esc
    topPill.querySelector('#cq-exit-btn').onclick = () => this.abortWithSkipped(false);
    coachWrap.querySelector('#cq-skip-mission-btn').onclick = () => this.completeCurrentMission(true);
    const demoNextBtn = coachWrap.querySelector('#cq-demo-next-btn');
    if (demoNextBtn) demoNextBtn.onclick = () => this.completeCurrentMission(false);

    const onKey = (e) => {
      if (e.key === 'Escape') this.abortWithSkipped(false);
    };
    document.addEventListener('keydown', onKey);
    this.cleanupFns.push(() => document.removeEventListener('keydown', onKey));

    // Dynamic target tracking + spotlight + 1.5s missing-target fallback
    const hole = svg.querySelector('#cq-mask-hole');
    this.missingSince = 0;
    this.centeredFallback = false;
    let hasLockedTargetOnce = false;
    let hasScrolledToTarget = false;
    let boundTargetEl = null;

    // Capture-phase click handler for Mission 1 (.collection-card) so tapping the card
    // completes Mission 1 directly without relying on toggle state (guarded against double fire).
    const onMission1TargetClick = () => {
      if (this.active && this.str.missions[this.missionIndex]?.id === 'open_collection') {
        this.completeCurrentMission(false);
      }
    };
    const bindTargetListener = (el) => {
      if (mission.id !== 'open_collection' || el === boundTargetEl) return;
      if (boundTargetEl) {
        boundTargetEl.removeEventListener('click', onMission1TargetClick, true);
      }
      boundTargetEl = el;
      if (boundTargetEl) {
        boundTargetEl.addEventListener('click', onMission1TargetClick, true);
      }
    };
    this.cleanupFns.push(() => {
      if (boundTargetEl) {
        boundTargetEl.removeEventListener('click', onMission1TargetClick, true);
        boundTargetEl = null;
      }
    });

    const updateTargetRect = () => {
      const el = this.findMissionTarget(mission.id);
      if (el) {
        bindTargetListener(el);
        if (!hasScrolledToTarget) {
          hasScrolledToTarget = true;
          try {
            if (typeof el.scrollIntoView === 'function') {
              el.scrollIntoView({ block: 'center', inline: 'nearest', behavior: 'instant' });
            }
          } catch (_e) {
            try { el.scrollIntoView(false); } catch (_e2) {}
          }
        }
        const r = el.getBoundingClientRect();
        if (r.width > 4 && r.height > 4) {
          this.missingSince = 0;
          this.centeredFallback = false;
          const nextRect = {
            x: Math.max(4, r.left - 6),
            y: Math.max(4, r.top - 6),
            w: Math.min(window.innerWidth - 8, r.width + 12),
            h: Math.min(window.innerHeight - 8, r.height + 12)
          };
          this.targetRect = nextRect;
          if (!hasLockedTargetOnce) {
            hasLockedTargetOnce = true;
            this.spotRect = { ...nextRect };
          }
          return;
        }
      }
      if (!this.missingSince) this.missingSince = Date.now();
      if (Date.now() - this.missingSince >= 1500) {
        this.centeredFallback = true;
      }
    };

    const applyGeometry = (r) => {
      const vw = window.innerWidth;
      const vh = window.innerHeight;
      const cw = coachWrap.offsetWidth || Math.min(340, Math.max(0, vw - 24));
      const ch = coachWrap.offsetHeight || 170;

      if (this.centeredFallback || !hasLockedTargetOnce) {
        hole.setAttribute('width', '0');
        hole.setAttribute('height', '0');
        ring.style.display = 'none';
        blockers.forEach((b) => { b.style.display = 'none'; });
        const pos = computeCoachCardPosition(null, { width: vw, height: vh }, { width: cw, height: ch });
        coachWrap.style.transform = `translate3d(${pos.left}px, ${pos.top}px, 0)`;
        return;
      }
      ring.style.display = 'block';
      hole.setAttribute('x', String(r.x));
      hole.setAttribute('y', String(r.y));
      hole.setAttribute('width', String(r.w));
      hole.setAttribute('height', String(r.h));
      ring.style.left = r.x + 'px';
      ring.style.top = r.y + 'px';
      ring.style.width = r.w + 'px';
      ring.style.height = r.h + 'px';

      // Position 4 blocker quadrants strictly around the spotlight cutout (hole stays clickable)
      blockers[0].style.cssText = `display:block; top:0; left:0; width:${vw}px; height:${Math.max(0, r.y)}px;`;
      blockers[1].style.cssText = `display:block; top:${r.y + r.h}px; left:0; width:${vw}px; height:${Math.max(0, vh - (r.y + r.h))}px;`;
      blockers[2].style.cssText = `display:block; top:${r.y}px; left:0; width:${Math.max(0, r.x)}px; height:${r.h}px;`;
      blockers[3].style.cssText = `display:block; top:${r.y}px; left:${r.x + r.w}px; width:${Math.max(0, vw - (r.x + r.w))}px; height:${r.h}px;`;

      // Viewport-clamped coach placement (works identically in RTL and LTR because .cq-coach-wrap is anchored left:0 top:0)
      const pos = computeCoachCardPosition(r, { width: vw, height: vh }, { width: cw, height: ch });
      coachWrap.style.transform = `translate3d(${pos.left}px, ${pos.top}px, 0)`;
    };

    const animLoop = () => {
      if (!this.active) return;
      updateTargetRect();
      const lerp = this.caps.isReducedMotion ? 1 : 0.18;
      this.spotRect.x += (this.targetRect.x - this.spotRect.x) * lerp;
      this.spotRect.y += (this.targetRect.y - this.spotRect.y) * lerp;
      this.spotRect.w += (this.targetRect.w - this.spotRect.w) * lerp;
      this.spotRect.h += (this.targetRect.h - this.spotRect.h) * lerp;
      applyGeometry(this.spotRect);
      this.rafIds.push(requestAnimationFrame(animLoop));
    };
    const refreshAfterLayout = () => {
      updateTargetRect();
      applyGeometry(this.spotRect);
    };
    this.rafIds.push(requestAnimationFrame(() => {
      refreshAfterLayout();
      this.rafIds.push(requestAnimationFrame(animLoop));
    }));

    if (typeof ResizeObserver !== 'undefined') {
      this.resizeObs = new ResizeObserver(refreshAfterLayout);
      this.resizeObs.observe(document.body);
    }
    if (typeof MutationObserver !== 'undefined') {
      this.mutObs = new MutationObserver(refreshAfterLayout);
      this.mutObs.observe(document.body, { childList: true, subtree: true, attributes: true });
    }
    window.addEventListener('scroll', refreshAfterLayout, { passive: true });
    window.addEventListener('resize', refreshAfterLayout, { passive: true });
    window.addEventListener('orientationchange', refreshAfterLayout, { passive: true });
    this.cleanupFns.push(() => {
      window.removeEventListener('scroll', refreshAfterLayout);
      window.removeEventListener('resize', refreshAfterLayout);
      window.removeEventListener('orientationchange', refreshAfterLayout);
    });
  }

  notifyAction(actionName) {
    this.safeRun(() => {
      if (!this.active) return;
      const mission = this.str.missions[this.missionIndex];
      if (!mission) return;
      if (mission.id === 'open_collection' && actionName === 'collection_opened') {
        this.completeCurrentMission(false);
      } else if (mission.id === 'open_recipe' && actionName === 'recipe_opened') {
        this.completeCurrentMission(false);
      } else if (mission.id === 'kitchen_mode' && actionName === 'kitchen_entered') {
        this.inKitchenSeen = true;
        const textEl = document.getElementById('cq-coach-text');
        if (textEl && mission.coachInKitchen) textEl.textContent = mission.coachInKitchen;
        this.timers.push(setTimeout(() => {
          if (this.active && this.str.missions[this.missionIndex]?.id === 'kitchen_mode') {
            this.completeCurrentMission(false);
          }
        }, 2800));
      } else if (mission.id === 'kitchen_mode' && actionName === 'kitchen_exited' && this.inKitchenSeen) {
        this.completeCurrentMission(false);
      } else if (mission.id === 'shopping_list' && (actionName === 'shopping_opened' || actionName === 'shopping_item_added')) {
        this.completeCurrentMission(false);
      }
    });
  }

  completeCurrentMission(wasSkipped = false) {
    this.safeRun(() => {
      if (this.missionCompleting) return;
      this.missionCompleting = true;
      const completedNum = this.missionIndex + 1;
      if (!wasSkipped) {
        this.track('mission_completed', { mission: completedNum });
        this.fireMicroCelebration();
      }
      const nextIdx = this.missionIndex + 1;
      this.timers.push(setTimeout(() => this.runAct2Mission(nextIdx), wasSkipped ? 120 : 650));
    });
  }

  fireMicroCelebration() {
    if (typeof navigator !== 'undefined' && typeof navigator.vibrate === 'function') {
      try { navigator.vibrate(10); } catch (_e) {}
    }
    this.playTone(740, 110);
    const chip = document.createElement('div');
    chip.className = 'cq-xp-toast';
    chip.textContent = this.str.xpChip;
    document.body.appendChild(chip);
    setTimeout(() => chip.remove(), 1150);
    if (!this.caps.isReducedMotion) {
      this.launchConfetti(this.caps.isLiteMode ? 18 : 32, 900);
    }
  }

  // =========================================================================
  // MISSION 4: DEMO EXTRACTION (Pure Client-Side, ZERO Network, ZERO Quota)
  // =========================================================================
  runDemoExtraction(onDone) {
    this.safeRun(() => {
      const s = this.str;
      this.root.innerHTML = '';
      const overlay = document.createElement('div');
      overlay.className = 'cq-demo-overlay';
      overlay.setAttribute('role', 'dialog');
      overlay.setAttribute('aria-modal', 'true');
      overlay.innerHTML = `
        <div class="cq-demo-card">
          <div style="display:flex; align-items:center; justify-content:space-between; margin-bottom:10px;">
            <span style="background:#f59e0b; color:#111827; font-weight:900; font-size:0.75rem; padding:3px 10px; border-radius:999px;">✨ ${s.demoBadge}</span>
            <span style="font-size:0.76rem; color:#94a3b8;">${s.demoSkipTap}</span>
          </div>
          <div class="cq-demo-video">
            <div style="font-size:2.4rem;">🍝🎬</div>
            ${this.caps.isReducedMotion ? '' : '<div class="cq-scan-line"></div>'}
          </div>
          <div id="cq-demo-status" style="font-weight:800; color:#6ee7b7; font-size:0.9rem; margin-bottom:8px;">${s.demoScanning}</div>
          <div style="font-weight:900; font-size:1.08rem; margin-bottom:10px;">${s.demoTitle}</div>
          <div id="cq-demo-ings" style="display:flex; flex-wrap:wrap; gap:6px; margin-bottom:10px;"></div>
          <div id="cq-demo-steps"></div>
          <div class="cq-tip-flip" id="cq-demo-tip">
            <div style="font-weight:900; font-size:0.84rem; color:#fde68a;">${s.demoTipTitle}</div>
            <div style="font-size:0.82rem; color:#fef3c7;">${s.demoTipText}</div>
          </div>
        </div>
      `;
      this.root.appendChild(overlay);

      let finished = false;
      const done = () => {
        if (finished) return;
        finished = true;
        this.timers.forEach((t) => clearTimeout(t));
        this.timers = [];
        onDone();
      };
      overlay.onclick = done;

      const ingsBox = overlay.querySelector('#cq-demo-ings');
      const stepsBox = overlay.querySelector('#cq-demo-steps');
      const statusEl = overlay.querySelector('#cq-demo-status');
      const tipEl = overlay.querySelector('#cq-demo-tip');

      // Assemble ingredients with count-up
      s.demoIngredients.forEach((ing, i) => {
        const delay = this.caps.isReducedMotion ? 50 : 650 + i * 320;
        this.timers.push(setTimeout(() => {
          if (statusEl && i === 0) statusEl.textContent = s.demoAssembling;
          const chip = document.createElement('span');
          chip.className = 'cq-demo-chip';
          chip.innerHTML = `<span>${ing.name}</span><strong class="cq-qty">0</strong><span>${ing.unit}</span>`;
          ingsBox.appendChild(chip);
          requestAnimationFrame(() => chip.classList.add('in'));
          const qtyEl = chip.querySelector('.cq-qty');
          if (this.caps.isReducedMotion) {
            qtyEl.textContent = String(ing.amount);
          } else {
            let cur = 0;
            const stepVal = Math.max(1, Math.ceil(ing.amount / 8));
            const tick = () => {
              cur = Math.min(ing.amount, cur + stepVal);
              qtyEl.textContent = String(cur);
              if (cur < ing.amount) this.timers.push(setTimeout(tick, 35));
            };
            tick();
          }
          this.playTone(500 + i * 50, 50);
        }, delay));
      });

      // Assemble steps
      s.demoSteps.forEach((st, i) => {
        const delay = this.caps.isReducedMotion ? 100 : 2100 + i * 620;
        this.timers.push(setTimeout(() => {
          const row = document.createElement('div');
          row.className = 'cq-demo-step';
          row.textContent = `✅ ${i + 1}. ${st}`;
          stepsBox.appendChild(row);
          requestAnimationFrame(() => row.classList.add('in'));
        }, delay));
      });

      // Flip chef-tip card
      this.timers.push(setTimeout(() => {
        if (tipEl) tipEl.classList.add('in');
      }, this.caps.isReducedMotion ? 150 : 4200));

      // Auto-advance after ~6s
      this.timers.push(setTimeout(done, this.caps.isReducedMotion ? 2200 : 6000));
    });
  }

  // =========================================================================
  // ACT 3: FINALE (Canvas Confetti + Chef Initiate Badge + Soft CTAs)
  // =========================================================================
  runAct3Finale() {
    this.safeRun(() => {
      this.clearRuntime();
      const s = this.str;
      this.writeState({ status: 'done', mission: 5, badge: true });
      this.track('quest_finished', { badge: true });
      this.hooks.onBadgeEarned?.();

      if (!this.caps.isReducedMotion) {
        this.launchConfetti(this.caps.isLiteMode ? 45 : 110, 2100);
      }

      const firstName = this.hooks.getUserFirstName?.() || '';
      const isGuest = Boolean(this.hooks.isGuest?.());
      const colsCount = Number(this.hooks.getCollectionsCount?.()) || 0;
      const dateStr = new Date().toLocaleDateString('he-IL');
      const metaText = formatFinaleMeta(dateStr, colsCount, s);
      const canNativeShare = typeof navigator !== 'undefined' && typeof navigator.share === 'function';

      this.root.innerHTML = '';
      const finale = document.createElement('div');
      finale.className = 'cq-finale';
      finale.setAttribute('role', 'dialog');
      finale.setAttribute('aria-modal', 'true');
      finale.setAttribute('aria-label', s.finaleTitle);
      finale.innerHTML = `
        <div class="cq-glass-card" style="width:min(420px, 100%); text-align:center;">
          <div style="display:flex; justify-content:center; margin-bottom:6px;">${this.mascotSvg('celebrating')}</div>
          <h2 style="font-size:1.25rem; font-weight:900; color:#6ee7b7; margin-bottom:4px;">${s.finaleTitle}</h2>
          <div class="cq-badge-card">
            <div style="font-size:2.4rem; margin-bottom:4px;">🏅</div>
            <div style="font-size:1.3rem; font-weight:900; color:#fff;">${s.badgeTitle}</div>
            <div style="font-size:0.82rem; color:#6ee7b7; font-weight:700; margin-bottom:8px;">${s.badgeSubtitleEn}</div>
            ${firstName ? `<div style="font-size:0.95rem; font-weight:800; color:#fde68a; margin-bottom:6px;">${firstName}</div>` : ''}
            <div class="cq-finale-meta" style="font-size:0.78rem; color:#cbd5e1;">${metaText}</div>
          </div>
          ${canNativeShare ? `<button type="button" class="cq-btn-primary" style="width:100%; margin-bottom:10px; padding:10px;" id="cq-share-badge-btn">🔗 ${s.shareBtn}</button>` : ''}
          <div class="cq-cta-row">
            <button type="button" class="cq-cta-btn" id="cq-cta-extract">✨ ${s.ctaExtract}</button>
            <button type="button" class="cq-cta-btn" id="cq-cta-discover">🔥 ${s.ctaDiscover}</button>
            ${isGuest ? `<button type="button" class="cq-cta-btn" id="cq-cta-signin">☁️ ${s.ctaSignIn}</button>` : ''}
          </div>
          <button type="button" class="cq-btn-ghost" style="margin-top:10px;" id="cq-finale-close">${s.closeFinale}</button>
        </div>
      `;
      this.root.appendChild(finale);

      const closeFinale = () => this.destroyDom();
      const shareBtn = finale.querySelector('#cq-share-badge-btn');
      if (shareBtn) {
        shareBtn.addEventListener('click', () => {
          navigator.share({ title: s.brandName, text: s.shareText, url: window.location.origin + '/app' }).catch(() => {});
        });
      }
      finale.querySelector('#cq-cta-extract')?.addEventListener('click', () => { closeFinale(); this.hooks.switchTab?.('extract'); });
      finale.querySelector('#cq-cta-discover')?.addEventListener('click', () => { closeFinale(); this.hooks.switchTab?.('discover'); });
      const signInBtn = finale.querySelector('#cq-cta-signin');
      if (signInBtn) signInBtn.addEventListener('click', () => { closeFinale(); this.hooks.switchTab?.('profile'); });
      const closeBtn = finale.querySelector('#cq-finale-close');
      if (closeBtn) {
        closeBtn.addEventListener('click', (e) => {
          e.stopPropagation();
          closeFinale();
        });
        try { closeBtn.focus(); } catch (_e) {}
      }
      // Close on backdrop tap outside the glass card
      finale.addEventListener('click', (e) => {
        if (e.target === finale) closeFinale();
      });
      // Close on Escape key
      const onFinaleKey = (e) => {
        if (e.key === 'Escape') closeFinale();
      };
      document.addEventListener('keydown', onFinaleKey);
      this.cleanupFns.push(() => document.removeEventListener('keydown', onFinaleKey));
    });
  }

  launchConfetti(maxParticles = 100, durationMs = 2000) {
    try {
      const canvas = document.createElement('canvas');
      canvas.className = 'cq-confetti-canvas';
      canvas.width = window.innerWidth;
      canvas.height = window.innerHeight;
      document.body.appendChild(canvas);
      this.cleanupFns.push(() => canvas.remove());
      const ctx = canvas.getContext('2d');
      if (!ctx) { canvas.remove(); return; }

      const count = Math.min(120, maxParticles);
      const colors = ['#10b981', '#34d399', '#f59e0b', '#f43f5e', '#38bdf8', '#fde68a'];
      const particles = Array.from({ length: count }, () => ({
        x: Math.random() * canvas.width,
        y: -20 - Math.random() * 140,
        vx: (Math.random() - 0.5) * 4.5,
        vy: 2.5 + Math.random() * 4.5,
        size: 5 + Math.random() * 6,
        color: colors[Math.floor(Math.random() * colors.length)],
        rot: Math.random() * Math.PI * 2,
        vrot: (Math.random() - 0.5) * 0.2
      }));

      const start = performance.now();
      const step = (now) => {
        const elapsed = now - start;
        ctx.clearRect(0, 0, canvas.width, canvas.height);
        for (const p of particles) {
          p.x += p.vx;
          p.y += p.vy;
          p.rot += p.vrot;
          ctx.save();
          ctx.translate(p.x, p.y);
          ctx.rotate(p.rot);
          ctx.fillStyle = p.color;
          ctx.fillRect(-p.size / 2, -p.size / 2, p.size, p.size * 0.6);
          ctx.restore();
        }
        if (elapsed < durationMs) {
          this.rafIds.push(requestAnimationFrame(step));
        } else {
          canvas.remove();
        }
      };
      this.rafIds.push(requestAnimationFrame(step));
    } catch (_e) {}
  }
}

let singletonInstance = null;

export function startCookQuest(hooks, options = {}) {
  try {
    if (!singletonInstance) {
      singletonInstance = new CookQuestController(hooks, options.lang || 'he');
    } else {
      singletonInstance.hooks = hooks || singletonInstance.hooks;
    }
    singletonInstance.start(options);
    return singletonInstance;
  } catch (err) {
    console.warn('[CookQuest] Init error, marking skipped:', err);
    try { localStorage.setItem(QUEST_STORAGE_KEY, JSON.stringify({ status: 'skipped', mission: 0, badge: false })); } catch (_e) {}
    return null;
  }
}

export function notifyCookQuestAction(actionName) {
  if (singletonInstance) singletonInstance.notifyAction(actionName);
}
