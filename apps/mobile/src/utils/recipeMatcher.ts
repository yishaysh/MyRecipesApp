import { StructuredRecipe } from '@myrecipes/shared';

/**
 * Normalizes any social media or web URL to a canonical identifier.
 * Preserves the exact case of IDs/shortcodes while normalizing domains and protocols.
 */
export function normalizeUrl(rawUrl: string): string {
  if (!rawUrl) return '';
  const clean = rawUrl.trim();

  try {
    const parsed = new URL(clean.startsWith('http') ? clean : `https://${clean}`);
    const host = parsed.hostname.replace(/^www\./, '').toLowerCase();

    // YouTube
    if (host === 'youtube.com' || host === 'm.youtube.com') {
      const v = parsed.searchParams.get('v');
      if (v) return `youtube:video:${v}`;
      const pathMatch = parsed.pathname.match(/^\/(?:shorts|live|embed)\/([a-zA-Z0-9_-]+)/i);
      if (pathMatch) return `youtube:video:${pathMatch[1]}`;
    } else if (host === 'youtu.be') {
      const v = parsed.pathname.replace(/^\/+/, '').split('/')[0];
      if (v) return `youtube:video:${v}`;
    }

    // Instagram (Reels, Posts, IGTV)
    if (host === 'instagram.com') {
      const igMatch = parsed.pathname.match(/^\/(?:reel|reels|p|tv)\/([a-zA-Z0-9_-]+)/i);
      if (igMatch) return `instagram:post:${igMatch[1]}`;
    }

    // TikTok (Video, Photo carousel, Shortlinks)
    if (host === 'tiktok.com' || host === 'm.tiktok.com') {
      const ttMatch = parsed.pathname.match(/(?:video|photo|v)\/(\d+)/i);
      if (ttMatch) return `tiktok:video:${ttMatch[1]}`;
    } else if (host === 'vt.tiktok.com' || host === 'vm.tiktok.com') {
      const code = parsed.pathname.replace(/^\/+/, '').split('/')[0];
      if (code) return `tiktok:short:${code}`;
    }

    // General fallback: lowercase host + clean path without query params or trailing slash
    const path = parsed.pathname.replace(/\/+$/, '').toLowerCase();
    return `${host}${path}`;
  } catch {
    return clean
      .toLowerCase()
      .replace(/^https?:\/\//, '')
      .replace(/^www\./, '')
      .split('?')[0]
      .replace(/\/+$/, '');
  }
}

/**
 * Normalizes recipe title for semantic equality comparison.
 * Removes emojis, punctuation, symbols, whitespace, and lowercases.
 * e.g. "עוגת שוקולד עסיסית 🍫!" -> "עוגתשוקולדעסיסית"
 */
export function normalizeTitle(title: string): string {
  if (!title) return '';
  return title
    .toLowerCase()
    .replace(/[^\p{L}\p{N}]/gu, '')
    .trim();
}

/**
 * Checks whether two recipes are duplicates of each other.
 * If both recipes have source URLs and the URLs differ, they are NOT duplicates,
 * preventing false collisions on common recipe names like "עוגת שוקולד".
 */
export function areRecipesDuplicate(
  existing: StructuredRecipe,
  incoming: { url?: string; title?: string }
): boolean {
  const existingUrl = existing.sourceUrl?.trim();
  const incomingUrl = incoming.url?.trim();

  // 1. If BOTH recipes have valid source URLs:
  if (existingUrl && incomingUrl) {
    const normExisting = normalizeUrl(existingUrl);
    const normIncoming = normalizeUrl(incomingUrl);
    if (normExisting && normIncoming && normExisting === normIncoming) {
      return true;
    }
    if (existingUrl.toLowerCase() === incomingUrl.toLowerCase()) {
      return true;
    }
    // Distinct source URLs -> distinct recipes!
    return false;
  }

  // 2. If at least ONE recipe lacks a source URL (e.g. manual recipe):
  if (incoming.title && existing.title) {
    const normExistingTitle = normalizeTitle(existing.title);
    const normIncomingTitle = normalizeTitle(incoming.title);
    if (normExistingTitle.length >= 4 && normIncomingTitle.length >= 4) {
      if (normExistingTitle === normIncomingTitle) {
        return true;
      }
    }
  }

  return false;
}

/**
 * Searches `savedRecipes` for an existing duplicate.
 */
export function findDuplicateRecipe(
  savedRecipes: StructuredRecipe[],
  target: { url?: string; title?: string }
): StructuredRecipe | undefined {
  return savedRecipes.find((existing) => areRecipesDuplicate(existing, target));
}
