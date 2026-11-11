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
    if (host === 'youtube.com' || host === 'm.youtube.com' || host === 'music.youtube.com') {
      const v = parsed.searchParams.get('v');
      if (v) return `youtube:video:${v}`;
      const pathMatch = parsed.pathname.match(/^\/(?:shorts|live|embed)\/([a-zA-Z0-9_-]+)/i);
      if (pathMatch) return `youtube:video:${pathMatch[1]}`;
    } else if (host === 'youtu.be') {
      const v = parsed.pathname.replace(/^\/+/, '').split('/')[0];
      if (v) return `youtube:video:${v}`;
    }

    // Instagram (Reels, Posts, IGTV, /username/reel/ID)
    if (host === 'instagram.com' || host === 'm.instagram.com') {
      const igMatch = parsed.pathname.match(/^(?:\/[a-zA-Z0-9._-]+)?\/(?:reel|reels|p|tv)\/([a-zA-Z0-9_-]+)/i);
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
 * If both recipes have the same source URL, they are duplicates UNLESS both recipes
 * have distinct titles (such as an Instagram/TikTok carousel with multiple different recipes).
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
    const urlsMatch =
      (normExisting && normIncoming && normExisting === normIncoming) ||
      existingUrl.toLowerCase() === incomingUrl.toLowerCase();

    if (urlsMatch) {
      // If both existing and incoming have titles, check if they are DIFFERENT recipes
      // sharing the same post URL (e.g. multi-recipe carousel or compilation)
      if (existing.title?.trim() && incoming.title?.trim()) {
        const normExistingTitle = normalizeTitle(existing.title);
        const normIncomingTitle = normalizeTitle(incoming.title);

        if (normExistingTitle === normIncomingTitle) {
          return true;
        }

        // Check if one title is a substantive substring of the other (e.g. truncated or slight variation)
        if (normExistingTitle.length >= 4 && normIncomingTitle.length >= 4) {
          if (
            normExistingTitle.includes(normIncomingTitle) ||
            normIncomingTitle.includes(normExistingTitle)
          ) {
            return true;
          }
          // The same URL but completely distinct titles (e.g. 'מרק כתום' vs 'מרק כרובית')
          // They are different recipes extracted from the same carousel / post!
          return false;
        }
      }

      // If one or both lack titles, default to matching by URL
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
