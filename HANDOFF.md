# Project Handoff: MyRecipesApp (Social Recipe Extractor)

**Session Date**: 2026-11-11  
**Repository Branch**: `main` (clean working tree, synced with `origin/main` at commit `6452ea1`)  
**Monorepo Root**: `c:\Users\yishay.shavlev\Desktop\Private Projects\MyRecipesApp`

---

## 1. Executive Summary & Tech Stack

`MyRecipesApp` is a cross-platform social recipe extraction and management platform. It ingests cooking videos and posts from Instagram Reels, TikTok, YouTube Shorts, and Facebook, extracts ingredients and step-by-step cooking instructions using LLM pipelines (DeepSeek & Gemini with deterministic fallback), normalizes quantities into Hebrew, and synchronizes recipes across web, mobile, and cloud databases.

### Core Stack
- **Monorepo Architecture**: npm workspaces (`packages/*`, `services/*`, `apps/*`).
- **Mobile Client (`apps/mobile`)**: React Native 0.86.3, Expo SDK 57, React 19.2.3, TypeScript 5.4, Zustand 4.5.2, `@tanstack/react-query` 5.32.0, `expo-share-intent` 8.0.1 (system share target).
- **Backend API (`services/api`)**: Node.js 20+, Fastify 4.x, TypeScript 5.4 (`tsx` runtime / `tsc` build).
- **Database & Cloud Storage**: PostgreSQL hosted on **Neon Serverless**, managed via **Drizzle ORM** (`drizzle-orm`, `drizzle-kit`).
- **Web Client (`public/` & `services/api/src/views/web-client.html.ts`)**: Single-page responsive PWA / web application with pure vanilla JS/CSS for zero-overhead loading, matched 1:1 with mobile UI. Also includes Expo Web export under `public/_expo/`.
- **Authentication**: Google Identity Services (GSI) OAuth 2.0 (`@react-native-google-signin/google-signin` and web bridge `/api/v1/auth/google/mobile-bridge`), guest sessions with device fingerprinting (`/api/v1/auth/guest`), and VIP promotional codes (`/api/v1/auth/redeem-code`).
- **Cloud Deployment**: Backend and static web app hosted on **Vercel** (`https://my-recipes-app-mu.vercel.app`). Mobile builds packaged via Expo Application Services (**EAS Build**).

---

## 2. Architecture & Directory Mapping

```
MyRecipesApp/
├── apps/
│   └── mobile/
│       ├── app.json                     # Expo configuration, version code (18), permissions, plugins
│       ├── App.tsx                      # Root component, navigation tabs, deep-linking listeners
│       └── src/
│           ├── screens/
│           │   ├── HomeScreen.tsx       # 2-column recipe library with category/tag pills & search
│           │   ├── ExtractScreen.tsx    # URL parser input, extraction animation, recipe viewer
│           │   ├── DiscoverScreen.tsx   # Live viral food trends feed (TikTok, Instagram, YouTube)
│           │   └── ProfileScreen.tsx    # Google login, Freemium quota badge, manual cloud sync
│           ├── store/
│           │   ├── authStore.ts         # User session, JWT tokens, quota state, auto-sync orchestration
│           │   └── recipeStore.ts       # Saved recipes list, current recipe, deduplication & bookmarks
│           ├── services/
│           │   └── api.client.ts        # Fetch wrapper for Fastify backend API
│           └── utils/
│               └── recipeMatcher.ts     # Canonical duplicate detection (URL cleaning & Hebrew normalization)
├── packages/
│   └── shared/
│       └── src/
│           ├── models/recipe.ts         # StructuredRecipe, RecipeIngredient, InstructionStep interfaces
│           └── schemas/recipe.schema.ts # Zod schemas for extraction, sync, and user validation
├── services/
│   └── api/
│       ├── src/
│       │   ├── server.ts                # Fastify server entry point, CORS, cookie/JWT plugins
│       │   ├── db/
│       │   │   ├── index.ts             # Neon DB pool connection & Drizzle client
│       │   │   └── schema.ts            # PostgreSQL tables (users, recipes, extraction_jobs, promo_codes)
│       │   ├── routes/
│       │   │   ├── auth.routes.ts       # /auth/google, /auth/guest, /auth/redeem-code, /mobile-bridge
│       │   │   ├── recipes.routes.ts    # /recipes/parse, /recipes/fast-parse, /image-proxy, /trends
│       │   │   └── sync.routes.ts       # /sync/recipes, /sync/push, /sync/pull, /sync/usage
│       │   ├── services/
│       │   │   ├── auth.service.ts      # Google ID token verification, session JWT signing
│       │   │   ├── extractor.service.ts # Social media metadata scraping & caption extraction
│       │   │   ├── llm-parser.service.ts# DeepSeek/Gemini structured parsing to Hebrew ingredients
│       │   │   └── sync.service.ts      # Cloud sync, recipe deduplication, Freemium quota checks
│       │   └── views/
│       │       └── web-client.html.ts   # Auto-generated string literal export of public/app.html
├── public/
│   ├── app.html                         # Canonical source of web client application
│   ├── index.html                       # Mirror of app.html for root Vercel routing
│   └── app/index.html                   # Static web build target
└── scripts/
    ├── build-web-client-ts.js           # Compiles public/app.html -> web-client.html.ts & index.html
    └── prepare-public.js                # Build hook preparing Vercel static assets
```

---

## 3. Current Implementation Status

### Completed in this Session
1. **Web Recipe Library 2-Column Grid (1:1 Android Parity)**:
   - Modified [`public/app.html`](file:///c:/Users/yishay.shavlev/Desktop/Private%20Projects/MyRecipesApp/public/app.html), [`public/index.html`](file:///c:/Users/yishay.shavlev/Desktop/Private%20Projects/MyRecipesApp/public/index.html), and [`services/api/src/views/web-client.html.ts`](file:///c:/Users/yishay.shavlev/Desktop/Private%20Projects/MyRecipesApp/services/api/src/views/web-client.html.ts).
   - Upgraded `#library-list` from 1-column cards to `display: grid; grid-template-columns: repeat(2, 1fr); gap: 12px`.
   - Tuned `.recipe-card`: cover height `125px`, compact title (`0.92rem`), single-line tags, and wrapped footer (`.recipe-card-footer { flex-wrap: wrap; gap: 4px; }`).
2. **Google OAuth GSI Origin 400 Resolution**:
   - Replaced `<meta name="referrer" content="no-referrer">` with `<meta name="referrer" content="strict-origin-when-cross-origin">` across all web and mobile-bridge HTML files.
   - Restored standard `Origin` and `Referer` headers on iframe requests to `accounts.google.com/gsi/button`, allowing Google GSI to validate against the configured `Authorized JavaScript origins` in Google Cloud Console (`https://my-recipes-app-mu.vercel.app` and `http://localhost:3000`).
3. **Hardened Social Media Image Proxy (HTTP 403 CDN Mitigation)**:
   - Implemented `GET /api/v1/recipes/image-proxy` in [`services/api/src/routes/recipes.routes.ts`](file:///c:/Users/yishay.shavlev/Desktop/Private%20Projects/MyRecipesApp/services/api/src/routes/recipes.routes.ts).
   - Added strict CDN domain whitelist: `cdninstagram.com`, `fbcdn.net`, `instagram.com`, `tiktokcdn.com`, `tiktokcdn-us.com`, `tiktokcdn-eu.com`, `byteoversea.com`, `ytimg.com`, `ggpht.com`.
   - Prevented SSRF by enforcing `https://`, blocking private IP ranges (`127.0.0.1`, `10.*`, `192.168.*`, `172.16.*`, `169.254.169.254`, `.internal`, `.local`), and adding a 6-second timeout with `AbortController`.
   - Guarded against XSS by restricting allowed `Content-Type` headers to raster image formats (`image/jpeg`, `image/png`, `image/webp`, `image/avif`, `image/gif`) and setting `Content-Disposition: inline`.
   - Enforced 5MB payload limit to prevent unbounded memory buffering and OOM crashes.
   - Updated `onImgError(img)` in `public/app.html` to route broken/expiring CDN URLs through `/api/v1/recipes/image-proxy?url=...` before falling back to Unsplash.
4. **Multi-Device Recipe Deduplication (Backend & Clients)**:
   - In [`services/api/src/services/sync.service.ts`](file:///c:/Users/yishay.shavlev/Desktop/Private%20Projects/MyRecipesApp/services/api/src/services/sync.service.ts) and [`services/api/src/routes/sync.routes.ts`](file:///c:/Users/yishay.shavlev/Desktop/Private%20Projects/MyRecipesApp/services/api/src/routes/sync.routes.ts):
     - Added URL-aware matching: if both recipes have a `sourceUrl`, uniqueness is determined by the normalized URL. Matching by normalized `title` is ONLY permitted when at least one recipe lacks a `sourceUrl` (e.g. manually entered recipe).
     - Active DB Cleanup: purges duplicate rows sharing canonical keys (`url:...` or `title:...`) in Neon DB per user upon synchronization.
   - In [`apps/mobile/src/store/recipeStore.ts`](file:///c:/Users/yishay.shavlev/Desktop/Private%20Projects/MyRecipesApp/apps/mobile/src/store/recipeStore.ts) and `public/app.html`:
     - Updated `setSavedRecipes` and `loadSavedRecipesFromStorage` with URL-aware deduplication.
5. **Favorites & Pins (`isBookmarked`, `isPinned`) Synchronization**:
   - Replaced flawed monotonic boolean OR logic with **Last-Write-Wins (LWW)** using `updatedAt` timestamps across `SyncService.pushRecipes`, `recipeStore.ts`, and `app.html`.
   - Users can now both favorite (❤️) and un-favorite (🤍) recipes across devices without stale states overriding them.
   - Added automatic silent cloud sync (`syncCloudRecipes({ silent: true })`) whenever a bookmark is toggled.
6. **Mobile Google Auth Bridge Diagnostics**:
   - In [`services/api/src/routes/auth.routes.ts`](file:///c:/Users/yishay.shavlev/Desktop/Private%20Projects/MyRecipesApp/services/api/src/routes/auth.routes.ts), enhanced `GET /api/v1/auth/google/mobile-bridge` with an onscreen error box and "העתק פרטי שגיאה" (Copy Error Details) button for instant debugging inside Android WebViews.
7. **App Icon / Branding**:
   - User requested to keep the original logo and branding intact. All temporary concept generation files have been cleaned up.

### Active Breaking Changes & Bug Status
- **Failing Tests**: 0. Test suite (`npm test`) passes 17/17 tests across 2 suites.
- **TypeScript Errors**: 0. API compiles cleanly (`npm run build --workspace=@myrecipes/api`), Mobile typechecks with 0 errors (`tsc --noEmit`).
- **Uncommitted Changes**: None. Working tree is clean. 5 commits pushed to `origin/main`.

---

## 4. Active Decisions & Constraints

1. **Do NOT Revert Referrer-Policy to `no-referrer`**:
   Google Identity Services (GSI) iframe integration requires `strict-origin-when-cross-origin` to send the `Origin` header. Reverting to `no-referrer` will immediately cause Google to throw HTTP 400 with `[GSI_LOGGER]: The given origin is not allowed for the given client ID`.
2. **Canonical Matching Logic (Do NOT Deduplicate Purely by Title)**:
   Two recipes from different creators on Instagram and TikTok sharing a common name (e.g. "עוגת שוקולד") have different `sourceUrl`s and MUST remain separate recipes. Title matching is only a fallback when `sourceUrl` is absent.
3. **Favorites LWW Timestamps**:
   `isBookmarked` and `isPinned` state transitions must always set `updatedAt = new Date().toISOString()`. Do not use a naive `||` union, which creates an irreversible favorite latch.
4. **Single Source of Truth for Web Client**:
   [`public/app.html`](file:///c:/Users/yishay.shavlev/Desktop/Private%20Projects/MyRecipesApp/public/app.html) is the canonical source for the web client. Whenever editing it, you MUST run `node scripts/build-web-client-ts.js` to update [`services/api/src/views/web-client.html.ts`](file:///c:/Users/yishay.shavlev/Desktop/Private%20Projects/MyRecipesApp/services/api/src/views/web-client.html.ts) and [`public/index.html`](file:///c:/Users/yishay.shavlev/Desktop/Private%20Projects/MyRecipesApp/public/index.html).
5. **No Autonomous Git Push**:
   Never run `git push` autonomously. Always prompt the user via `ask_question` with interactive choices before pushing to remote repositories.
6. **Side Project Exemption**:
   `MyRecipesApp` is a personal side project (no Made4Net DLL references). Time tracking and manual development hour estimates are **strictly prohibited**.

---

## 5. Immediate Next Step

### Task: Android Native App Build & Verification (v19)
The web client and backend changes are now live on Vercel. The mobile app needs to be built and verified with the new sync and auth bridge enhancements.

1. **Target File**: [`apps/mobile/app.json`](file:///c:/Users/yishay.shavlev/Desktop/Private%20Projects/MyRecipesApp/apps/mobile/app.json)
   - Bump `android.versionCode` from `18` to `19`.
   - Update `version` to `"1.5.1"`.
2. **Execute Build**:
   - Run `eas build --platform android --profile preview` to generate the new standalone Android APK.
3. **Validation Steps**:
   - Install APK v19 on Android test device.
   - Verify Google Sign-In via the enhanced mobile bridge: confirm token handoff back to `myrecipes://auth`.
   - Favorite a recipe on Android -> Open Web (`https://my-recipes-app-mu.vercel.app`) -> Confirm favorite heart status appears.
   - Unfavorite the recipe on Web -> Re-sync on Android -> Confirm heart status updates cleanly to un-favorited.

