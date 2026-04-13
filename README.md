# AlphaSight AI

**Intelligent Portfolio Analysis & Market Insight Assistant**

AlphaSight AI is a production-ready, full-stack financial intelligence platform that combines real-time market data, AI-powered analysis, portfolio tracking, watchlists, and automated daily briefings in a premium chat-first experience.

---

## Highlights

- **AI market copilot** powered by Groq (`llama-3.3-70b-versatile`) with streaming responses
- **Stock-aware chat** with symbol resolution, technical context, macro risk framing, and news enrichment
- **Portfolio management** with live pricing, P&L analytics, and position-level notes
- **Watchlist tracking** with real-time quote updates
- **Daily portfolio brief generation** on-demand and scheduled (Vercel cron)
- **Secure auth + RLS data isolation** via Supabase (email/password + Google OAuth)
- **Modern UI/UX** built with Next.js App Router, Tailwind, Framer Motion, and markdown-rich chat rendering

---

## Tech Stack

| Layer | Technology |
|---|---|
| Frontend | Next.js 15, React 19, TypeScript, Tailwind CSS, Framer Motion |
| State | Zustand |
| Backend/API | Next.js Route Handlers (App Router) |
| Auth + DB | Supabase (Postgres + Row Level Security) |
| Market Data | Yahoo Finance (`yahoo-finance2`) |
| News | MarketAux, NewsData.io (with fallback strategy) |
| AI | Groq SDK |
| Deployment | Vercel (with cron for daily briefs) |

---

## Core Product Surfaces

- **Chat Workspace (`/`)**
  - Contextual financial chat + stock analysis
  - Conversation history persistence
  - Streaming model output
- **Portfolio (`/portfolio`)**
  - Add/edit/remove holdings
  - Real-time valuation and P&L
  - Best/worst performer summaries
- **Watchlist (`/watchlist`)**
  - Add/remove symbols
  - Live quote movement monitoring
- **Daily Brief (`/daily-brief`)**
  - AI-generated market + portfolio briefing
  - Snapshot analytics and previous brief history

---

## Architecture Overview

```text
UI (Next.js App Router + Zustand)
   ├─ /api/chat                 -> Symbol detection -> Market data + news + risks -> Groq stream
   ├─ /api/portfolio            -> CRUD holdings + valuation
   ├─ /api/watchlist            -> CRUD watchlist + live quote enrich
   ├─ /api/daily-brief          -> Snapshot build + AI brief generation
   └─ /api/conversations/*      -> Conversation/message persistence

Supabase
   ├─ Auth (email/password + OAuth)
   ├─ Postgres tables
   └─ RLS policies per user
```

---

## Database

Schema is provided in:

```bash
supabase/schema.sql
```

Main tables:

- `conversations`
- `messages`
- `portfolio_holdings`
- `watchlist`
- `daily_briefs`
- `user_preferences`

The schema includes:

- Enum types (`message_role`, `market_type`)
- Indexes for key query paths
- `updated_at` trigger automation
- Full Row-Level Security policies

---

## Environment Variables

Create `.env.local` in the project root:

```env
NEXT_PUBLIC_SUPABASE_URL=
NEXT_PUBLIC_SUPABASE_ANON_KEY=
SUPABASE_SERVICE_ROLE_KEY=

GROQ_API_KEY=

MARKETAUX_API_KEY=
NEWSDATA_API_KEY=

CRON_SECRET=
```

> `SUPABASE_SERVICE_ROLE_KEY` is required for admin-mode daily brief generation via secure cron.

---

## Local Development

```bash
npm install
npm run dev
```

Open:

```text
http://localhost:3000
```

Production build:

```bash
npm run build
npm run start
```

---

## API Surface

| Route | Method | Purpose |
|---|---|---|
| `/api/chat` | POST | Streaming AI chat + stock analysis context |
| `/api/conversations` | GET, POST | List/create conversations |
| `/api/conversations/[id]` | GET, DELETE | Retrieve/delete single conversation |
| `/api/conversations/[id]/messages` | GET | Conversation messages (paginated) |
| `/api/portfolio` | GET, POST | Holdings list/create |
| `/api/portfolio/[id]` | PUT, DELETE | Update/delete holding |
| `/api/watchlist` | GET, POST, DELETE | Watchlist operations |
| `/api/stock/search` | GET | Symbol autocomplete/search |
| `/api/stock/quote` | GET | Quick quote lookup |
| `/api/daily-brief` | GET, POST | Fetch/generate daily briefs |

---

## Scheduled Daily Briefs

Configured in `vercel.json`:

```json
{
  "crons": [
    { "path": "/api/daily-brief", "schedule": "0 3 * * *" }
  ]
}
```

The endpoint supports:

1. **Authenticated user mode**: generate brief for the current user
2. **Cron/admin mode**: generate briefs for all users with holdings (requires `CRON_SECRET`)

---

## Security Model

- Middleware-protected routes with session refresh
- Supabase Auth for identity
- Strict per-user access enforcement with RLS
- Server-side admin client isolated to trusted contexts only

---

## Project Structure

```text
src/
  app/
    (app)/                 # Authenticated app pages
    api/                   # Route handlers
    auth/callback/         # OAuth callback
    login/, signup/        # Auth pages
  components/
    chat/, layout/, portfolio/, ui/
  lib/
    ai/, stock/, supabase/, hooks/
  stores/
    app-store.ts
  types/
    database.ts, stock.ts
supabase/
  schema.sql
```

---

## Status

✅ Build, type-check, and lint pass in production build mode.

---

## License

This project is currently unlicensed. Add a `LICENSE` file if you want to define reuse terms.

