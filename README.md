# AlphaSight AI

<p align="center">
  <img src="./logos/final_logo.svg" alt="AlphaSight Logo" width="120" />
</p>

<p align="center">
  AI-first stock intelligence workspace with streaming chat, portfolio tracking, watchlist monitoring, and daily market briefs.
</p>

<p align="center">
  <img src="https://img.shields.io/badge/Next.js-15-black?logo=nextdotjs" alt="Next.js 15" />
  <img src="https://img.shields.io/badge/React-19-149ECA?logo=react&logoColor=white" alt="React 19" />
  <img src="https://img.shields.io/badge/TypeScript-5-3178C6?logo=typescript&logoColor=white" alt="TypeScript 5" />
  <img src="https://img.shields.io/badge/Supabase-Postgres-3ECF8E?logo=supabase&logoColor=white" alt="Supabase" />
  <img src="https://img.shields.io/badge/AI-Mistral-F97316" alt="Mistral" />
</p>

---

## What AlphaSight Does

- Streams AI answers in chat for low-latency UX.
- Supports stock-aware analysis using live quote/history/news context.
- Tracks portfolio holdings with valuation and P&L summaries.
- Manages watchlist symbols with real-time movement checks.
- Generates daily brief summaries for portfolio + market pulse.
- Uses **Contextual AI Synthesis** response style (summary + signals + risks + takeaway).

---

## Tech Stack

| Layer | Technology |
|---|---|
| Frontend | Next.js App Router, React 19, TypeScript, Tailwind CSS, Framer Motion |
| State | Zustand |
| Backend | Next.js Route Handlers |
| Auth + DB | Supabase (Postgres + RLS) |
| LLM Provider | Mistral |
| Market Data | Yahoo Finance endpoints |
| News | MarketAux, NewsData.io, Yahoo fallback |

---

## Architecture

```text
Client (Next.js + Zustand)
  ├─ Chat UI
  ├─ Portfolio UI
  ├─ Watchlist UI
  └─ Daily Brief UI

API (Route Handlers)
  ├─ /api/chat
  ├─ /api/conversations/*
  ├─ /api/portfolio*
  ├─ /api/watchlist
  ├─ /api/stock/*
  └─ /api/daily-brief

Services
  ├─ Mistral
  ├─ Yahoo market endpoints
  └─ News providers

Persistence
  └─ Supabase Postgres (RLS enforced)
```

---

## Project Structure

```text
src/
  app/
    (app)/                 # authenticated surfaces
    api/                   # route handlers
    auth/callback/         # OAuth callback
    login/, signup/        # auth pages
  components/              # chat, layout, portfolio, ui
  lib/                     # ai, stock, supabase, hooks, utils
  stores/                  # Zustand store
  types/                   # shared TS types
supabase/
  schema.sql
logos/
  final_logo.svg
```

---

## Quick Start

### 1) Install

```bash
npm install
```

### 2) Configure `.env.local`

```env
# Supabase (required)
NEXT_PUBLIC_SUPABASE_URL=
NEXT_PUBLIC_SUPABASE_ANON_KEY=
SUPABASE_SERVICE_ROLE_KEY=

# AI provider (required)
MISTRAL_API_KEY=

# News providers (optional but recommended)
MARKETAUX_API_KEY=
NEWSDATA_API_KEY=

# Optional cron auth secret
CRON_SECRET=
```

### 3) Run Dev Server

```bash
npm run dev
```

Open `http://localhost:3000`.

### 4) Production Commands

```bash
npm run build
npm run start
```

---

## NPM Scripts

- `npm run dev` - start dev server (Turbopack)
- `npm run build` - production build (Turbopack)
- `npm run start` - run built app
- `npm run lint` - lint via Next.js

---

## API Overview

| Route | Method | Purpose |
|---|---|---|
| `/api/chat` | POST | Stream AI response (general or stock-context mode) |
| `/api/conversations` | GET, POST | List/create conversations |
| `/api/conversations/[id]` | GET, DELETE | Read/delete conversation |
| `/api/conversations/[id]/messages` | GET | Paginated messages |
| `/api/portfolio` | GET, POST | List/add holdings |
| `/api/portfolio/[id]` | PUT, DELETE | Update/delete holding |
| `/api/watchlist` | GET, POST, DELETE | Manage watchlist |
| `/api/stock/search` | GET | Symbol/company search |
| `/api/stock/quote` | GET | Quote data |
| `/api/daily-brief` | GET, POST | Fetch/generate daily brief |
| `/api/test-ai` | GET | Quick provider readiness check |

---

## Response Model

Chat responses are tuned for **Contextual AI Synthesis**:

1. Direct answer
2. Context signals (price/technicals/fundamentals)
3. News synthesis (not raw link dump)
4. Risks and uncertainty
5. Practical takeaway

The UI is configured for **text-first outputs** (no forced chart/news card clutter in chat body).

---

## Security Notes

- Supabase auth gates protected routes.
- Row-Level Security isolates user-owned data.
- Conversation and message reads are user-scoped.
- Service role key is server-only and must never be exposed client-side.

---

## Deployment Notes

- Designed for Vercel-compatible Next.js deployment.
- Optional scheduled brief generation can run via cron hitting `/api/daily-brief`.
- Ensure env vars are set in deployment environment before first run.

---

## Status

- Local TypeScript check: passing (`npx tsc --noEmit`).
- Active AI provider: Mistral.
- Branding updated to custom AlphaSight logo.
