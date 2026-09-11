# Technical Specification & Architecture Document: Social Recipe Extractor (Mobile)

## 1. System Overview
A cross-platform mobile application designed to intercept shared URLs from social media platforms (Instagram, TikTok, YouTube Shorts, Facebook), extract recipe data (metadata, captions, audio transcription, or OCR if needed), parse the content using an LLM into structured recipe schemas, and render interactive recipe cards and grocery lists.

---

## 2. Core Architecture & Tech Stack

### 2.1 Mobile Client (Frontend)
- **Framework:** React Native (bare workflow or Expo with config plugins).
- **Language:** TypeScript (strict mode enabled).
- **Navigation:** React Navigation (Native Stack + Bottom Tabs).
- **Deep Linking & OS Integration:**
  - `react-native-receive-sharing-intent` or custom Native Intent Filter (Android `ACTION_SEND`) and iOS Share Extension.
- **Local Storage / Persistence:** SQLite (via `expo-sqlite` or `@op-engineering/op-sqlite`) with WatermelonDB or Drizzle ORM for local caching and offline-first recipe viewing.
- **State Management:** TanStack Query (React Query) for server state; Zustand for local client state.
- **UI Kit:** Tailwind CSS via NativeWind for modular, predictable styling.

### 2.2 Backend & Orchestration (API Gateway / Serverless)
- **Runtime:** Node.js (v20+) with TypeScript, hosted on a serverless platform (AWS Lambda, Cloudflare Workers, or Google Cloud Run).
- **Framework:** Fastify or Hono (minimal overhead, fast startup times).
- **Database:** PostgreSQL (Supabase or Neon) with `pgvector` for recipe semantic search.
- **Queue/Worker System:** Redis (Upstash or BullMQ) to handle asynchronous parsing jobs (video downloading, transcription, LLM processing) to prevent mobile timeout on long video extractions.

### 2.3 Extraction & AI Pipeline
- **Metadata/Video Fetcher:**
  - Specialized scrapers/APIs (e.g., dedicated scraper services like Apify, Bright Data, or self-hosted `yt-dlp` instances on containerized runners).
- **Speech-to-Text (Fallback when captions are empty):**
  - OpenAI Whisper API (or Groq Whisper endpoint for sub-second inference).
- **LLM Structured Parser:**
  - OpenAI GPT-4o-mini or Gemini 1.5 Flash using Structured Outputs (JSON Schema mode / Pydantic validation equivalent).

---

## 3. Data Flow & Execution Pipeline

```
[Social App (IG/TikTok)]
│ (OS Share Sheet)
▼
[React Native App / Share Extension]
│ (POST /api/v1/recipes/extract { url })
▼
[Fastify API Gateway] ──► [Redis Job Queue] ──► [Worker]
│
┌────────────────────────────────┴────────────────────────┐
▼                                                         ▼
[Source Has Full Caption]                               [Caption Incomplete/Empty]
│                                                         │
│                                              [Download Audio Stream]
│                                                         │
│                                              [Whisper Transcription]
└────────────────────────┬────────────────────────────────┘
▼
[LLM Structured Parsing]
(Enforces Recipe JSON Schema)
│
▼
[Persist to Postgres DB]
│
▼
[TanStack Query Poll / Webhook Push]
│
▼
[Render Recipe UI + Checklist]
```

---

## 4. API Specification & Schemas

### 4.1 Ingestion Endpoint
- **Method:** `POST`
- **Route:** `/api/v1/recipes/parse`
- **Request Body:**
```json
{
  "sourceUrl": "https://www.instagram.com/reel/...",
  "userId": "usr_uuid_123"
}
```

- **Response (Synchronous Fallback / Fast-path):**
```json
{
  "jobId": "job_98765",
  "status": "processing"
}
```

### 4.2 Recipe Canonical Data Model (Target LLM Output)

```typescript
export interface Ingredient {
  id: string;
  name: string;
  amount: number | null;
  unit: string | null;
  category: 'produce' | 'dairy' | 'meat' | 'pantry' | 'spices' | 'bakery' | 'other';
  originalText: string;
}

export interface InstructionStep {
  stepNumber: number;
  instruction: string;
  durationMinutes?: number;
  tip?: string;
}

export interface StructuredRecipe {
  id: string;
  title: string;
  description: string;
  sourceUrl: string;
  platform: 'instagram' | 'tiktok' | 'facebook' | 'youtube' | 'web';
  servings: number | null;
  prepTimeMinutes: number | null;
  cookTimeMinutes: number | null;
  totalTimeMinutes: number | null;
  ingredients: Ingredient[];
  instructions: InstructionStep[];
  shoppingList: {
    category: string;
    items: string[];
  }[];
  tags: string[];
  createdAt: string;
}
```

---

## 5. Mobile Native Integration Requirements

### 5.1 Android Intent Filter (`AndroidManifest.xml`)

Must register an activity to listen to standard plaintext/URL send intents:

```xml
<intent-filter>
    <action android:name="android.intent.action.SEND" />
    <category android:name="android.intent.category.DEFAULT" />
    <data android:mimeType="text/plain" />
</intent-filter>
```

### 5.2 iOS Share Extension

- Configure an Action/Share Extension target in Xcode.
- Extract `NSItemProvider` containing `kUTTypeURL` or `kUTTypeText`.
- Transmit the URL to the main app container via App Groups / `UserDefaults` or trigger background upload directly from the extension.

---

## 6. Edge Cases & Resilience Strategy

1. **Rate Limiting & Anti-Scraping:**
   - Social networks block residential/datacenter IPs aggressively. Scraping layer must rotate proxies or use headless browser clusters with session/cookie pools.

2. **Missing Written Caption:**
   - Fall back to extracting the audio track via `yt-dlp`, sending to Whisper for transcription, and concatenating OCR keyframes if text overlays are present.

3. **Hallucination Prevention in Quantities:**
   - LLM system prompt must enforce strict instructions: `"If an ingredient quantity or cooking duration is not mentioned in the text/audio, set the field to null. Do not infer or invent missing measurements."`

4. **Multilingual Content:**
   - Auto-detect source language in transcription; parse and optionally normalize output ingredients to Hebrew/English based on the user's mobile app locale.
