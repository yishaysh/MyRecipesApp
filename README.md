# Social Recipe Extractor (MyRecipesApp)

A cross-platform mobile application and backend service designed to intercept shared URLs from social media platforms (Instagram, TikTok, YouTube Shorts, Facebook), extract recipe data, parse content using LLM into structured recipes, and render interactive recipe cards and grocery lists.

## Documentation
- [Technical Specification & Architecture Document (SPEC.md)](file:///c:/Users/yishay.shavlev/Desktop/Private%20Projects/MyRecipesApp/SPEC.md)

## Architecture Overview
- **Mobile Client (`/apps/mobile` or `/client`):** React Native (Expo) + TypeScript + NativeWind + TanStack Query + Zustand + SQLite
- **Backend API & Workers (`/backend` or `/server`):** Node.js + Fastify / Hono + Redis (BullMQ) + PostgreSQL / Supabase
- **AI / Pipeline:** Metadata & Video Fetcher (`yt-dlp` / scraper API) + Whisper (STT) + LLM Structured Parser (OpenAI / Gemini)
