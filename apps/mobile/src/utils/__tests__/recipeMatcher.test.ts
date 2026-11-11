import { normalizeUrl, normalizeTitle, areRecipesDuplicate, findDuplicateRecipe } from '../recipeMatcher';
import { StructuredRecipe } from '@myrecipes/shared';

function assert(condition: boolean, msg: string) {
  if (!condition) {
    throw new Error('Assertion failed: ' + msg);
  }
  console.log('✓ PASS:', msg);
}

// 1. Test Instagram URL Normalization
const ig1 = 'https://www.instagram.com/reel/DfSRWBFuroS/?exln=MWNiZmVzYjRxc3V5ag==';
const ig2 = 'https://instagram.com/reel/DfSRWBFuroS/';
const ig3 = 'https://www.instagram.com/p/DfSRWBFuroS?utm_source=ig_web_copy_link';
const igTv = 'https://www.instagram.com/tv/DfSRWBFuroS/';
const igUserReel = 'https://www.instagram.com/israelifoodie/reel/DfSRWBFuroS/?utm_source=ig_web_copy_link&exln=NTc4MTIwNjQ2YQ==';
assert(normalizeUrl(ig1) === 'instagram:post:DfSRWBFuroS', 'IG Reel normalized to canonical post ID with casing preserved');
assert(normalizeUrl(ig1) === normalizeUrl(ig2), 'IG with query params matches clean IG URL');
assert(normalizeUrl(ig1) === normalizeUrl(ig3), 'IG /reel matches IG /p with same ID');
assert(normalizeUrl(ig1) === normalizeUrl(igTv), 'IG /tv matches IG /reel with same ID');
assert(normalizeUrl(igUserReel) === 'instagram:post:DfSRWBFuroS', 'IG /username/reel/ID with exln matches canonical post ID');

// 2. Test YouTube URL Normalization (including query params preceding v=)
const yt1 = 'https://www.youtube.com/watch?feature=shared&v=abc123XYZ&t=45s';
const yt2 = 'https://youtu.be/abc123XYZ';
const yt3 = 'https://www.youtube.com/shorts/abc123XYZ?feature=share';
assert(normalizeUrl(yt1) === 'youtube:video:abc123XYZ', 'YouTube watch URL with preceding params normalized');
assert(normalizeUrl(yt1) === normalizeUrl(yt2), 'YouTube watch matches youtu.be with casing preserved');
assert(normalizeUrl(yt1) === normalizeUrl(yt3), 'YouTube watch matches YouTube shorts');

// 3. Test TikTok URL Normalization (including photo carousels & shortlinks)
const tt1 = 'https://www.tiktok.com/@chef_john/video/7123456789012345678?lang=he';
const tt2 = 'https://tiktok.com/@other/video/7123456789012345678';
const ttPhoto = 'https://www.tiktok.com/@chef/photo/7123456789012345678';
const ttShort1 = 'https://vt.tiktok.com/ZSpdQfLYR/';
const ttShort2 = 'https://vt.tiktok.com/ZSpdQfLYR?utm_campaign=...';
assert(normalizeUrl(tt1) === 'tiktok:video:7123456789012345678', 'TikTok video ID extracted');
assert(normalizeUrl(tt1) === normalizeUrl(tt2), 'TikTok same video ID matches across users');
assert(normalizeUrl(tt1) === normalizeUrl(ttPhoto), 'TikTok photo carousel matches video ID');
assert(normalizeUrl(ttShort1) === normalizeUrl(ttShort2), 'TikTok shortlinks match regardless of tracking');

// 4. Test Hebrew Title Normalization
assert(normalizeTitle('עוגת גבינה פירורים קלאסית! 🍰') === 'עוגתגבינהפירוריםקלאסית', 'Hebrew title strips emojis and exclamation marks');
assert(normalizeTitle('  "עוגת גבינה פירורים קלאסית" - מתכון מושלם  ') === 'עוגתגבינהפירוריםקלאסיתמתכוןמושלם', 'Hebrew title strips quotes and dashes');
assert(normalizeTitle('עוגת גבינה') === normalizeTitle('עוגת גבינה!'), 'Punctuation variance matches');

// 5. Test areRecipesDuplicate
const mockRecipe1: StructuredRecipe = {
  id: 'rec-1',
  title: 'עוגת שוקולד',
  description: 'עוגה טעימה מאת שף דניאל',
  sourceUrl: 'https://www.instagram.com/reel/DfSRWBFuroS/?exln=123',
  platform: 'instagram',
  servings: 8,
  prepTimeMinutes: 20,
  cookTimeMinutes: 40,
  totalTimeMinutes: 60,
  ingredients: [],
  instructions: [],
  shoppingList: [],
  tags: [],
  createdAt: new Date().toISOString()
};

// Match by different variation of URL
assert(areRecipesDuplicate(mockRecipe1, { url: 'https://instagram.com/reel/DfSRWBFuroS/' }), 'Matches by clean IG URL');

// CRITICAL TEST: Two recipes from DIFFERENT URLs sharing the same generic title "עוגת שוקולד"
// MUST NOT be classified as duplicates!
assert(
  !areRecipesDuplicate(mockRecipe1, {
    url: 'https://www.tiktok.com/@baker/video/999888777666555444',
    title: 'עוגת שוקולד'
  }),
  'Distinct URLs with identical generic title MUST NOT collide as duplicates'
);

// Manual recipe (no URL) matching by title
const manualRecipe: StructuredRecipe = {
  ...mockRecipe1,
  id: 'rec-manual',
  sourceUrl: ''
};
assert(
  areRecipesDuplicate(manualRecipe, { title: '  עוגת שוקולד! 🍫 ' }),
  'Matches manual recipe without URL by title similarity'
);

// 6. Test Carousel Multi-Recipe Collision Prevention
const carouselUrl = 'https://www.instagram.com/p/DfbtE_mjIZh/?dlrf=cTFhd2E0bGZoaWc1';
const carouselRecipeSoup1: StructuredRecipe = {
  ...mockRecipe1,
  id: 'rec-soup-1',
  title: 'מרק כתום',
  sourceUrl: carouselUrl
};

// Different recipe title from the SAME post URL MUST NOT be considered a duplicate!
assert(
  !areRecipesDuplicate(carouselRecipeSoup1, {
    url: carouselUrl,
    title: 'מרק כרובית'
  }),
  'Same carousel URL with distinct titles (מרק כתום vs מרק כרובית) MUST NOT collide as duplicates'
);

assert(
  !areRecipesDuplicate(carouselRecipeSoup1, {
    url: carouselUrl,
    title: 'מרק תירס'
  }),
  'Same carousel URL with distinct titles (מרק כתום vs מרק תירס) MUST NOT collide as duplicates'
);

// Same recipe title from the same URL SHOULD be considered a duplicate (re-extraction/update)
assert(
  areRecipesDuplicate(carouselRecipeSoup1, {
    url: carouselUrl,
    title: 'מרק כתום עשיר וטעים!'
  }),
  'Same carousel URL with matching title variant is identified as duplicate'
);

// 7. Test findDuplicateRecipe
const savedRecipes = [mockRecipe1];
const found = findDuplicateRecipe(savedRecipes, { url: 'https://instagram.com/p/DfSRWBFuroS/' });
assert(found?.id === 'rec-1', 'findDuplicateRecipe returns the existing recipe object');

const notFound = findDuplicateRecipe(savedRecipes, { url: 'https://vt.tiktok.com/NEW_RECIPE/' });
assert(notFound === undefined, 'findDuplicateRecipe returns undefined for new recipe');

console.log('\nALL 22 RECIPE MATCHER UNIT TESTS PASSED WITH 100% SUCCESS! 🎉\n');
