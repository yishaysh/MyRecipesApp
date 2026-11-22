/**
 * Local-calendar-day utilities for per-recipe daily cooking tracking.
 * Always computes YYYY-MM-DD in the runtime's local timezone (never UTC or rolling 24h).
 */

const YYYY_MM_DD_RE = /^\d{4}-\d{2}-\d{2}$/;

export function getLocalCalendarDateKey(date: Date | string | number = new Date()): string {
  const d = date instanceof Date ? date : new Date(date);
  if (Number.isNaN(d.getTime())) return '';
  const year = d.getFullYear();
  const month = String(d.getMonth() + 1).padStart(2, '0');
  const day = String(d.getDate()).padStart(2, '0');
  return `${year}-${month}-${day}`;
}

export function getRecipeLastCookedLocalDate(
  recipe: { lastCookedDate?: string | null; lastCookedAt?: string | null } | null | undefined
): string {
  if (!recipe) return '';
  if (typeof recipe.lastCookedDate === 'string' && YYYY_MM_DD_RE.test(recipe.lastCookedDate.trim())) {
    return recipe.lastCookedDate.trim();
  }
  if (typeof recipe.lastCookedAt === 'string' && recipe.lastCookedAt.trim()) {
    return getLocalCalendarDateKey(recipe.lastCookedAt);
  }
  return '';
}

export function hasRecipeBeenCookedOnDate(
  recipe: { lastCookedDate?: string | null; lastCookedAt?: string | null } | null | undefined,
  dateOrKey: Date | string = new Date()
): boolean {
  const targetKey =
    typeof dateOrKey === 'string' && YYYY_MM_DD_RE.test(dateOrKey.trim())
      ? dateOrKey.trim()
      : getLocalCalendarDateKey(dateOrKey);
  if (!targetKey) return false;
  return getRecipeLastCookedLocalDate(recipe) === targetKey;
}

export function msUntilLocalMidnight(now: Date = new Date()): number {
  const nextMidnight = new Date(now.getFullYear(), now.getMonth(), now.getDate() + 1, 0, 0, 0, 250);
  return Math.max(1000, nextMidnight.getTime() - now.getTime());
}
