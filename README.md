# AlphaSight AI

**Intelligent Portfolio Analysis & Market Insight Assistant**

AlphaSight AI is an intelligent stock market copilot that delivers deep company analysis, portfolio memory, geopolitical risk mapping, and AI-powered verdicts for smarter investing decisions.

---

## Highlights

- **AI market copilot** powered by Groq (`llama-3.3-70b-versatile`) with streaming responses
- **Stock-aware chat** with symbol resolution, technical context, macro risk framing, and news enrichment
- **Portfolio management** with live pricing, P&L analytics, and position-level notes
- **Watchlist tracking** with real-time quote updates
- **Daily portfolio brief generation** on-demand and scheduled (Vercel cron)
- **Secure auth + RLS data isolation** via Supabase (email/password + Google OAuth)
- **Modern UX** with Next.js App Router, Tailwind, Framer Motion, and markdown-rich chat rendering

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

- **Chat Workspace (`/`)**: contextual financial chat, stock analysis, streaming responses, saved conversation history
- **Portfolio (`/portfolio`)**: holdings CRUD, real-time valuation, P&L insights, best/worst performers
- **Watchlist (`/watchlist`)**: symbol tracking with live quote movement
- **Daily Brief (`/daily-brief`)**: generated market + portfolio brief with historical brief timeline

---

## Architecture Overview

```text
UI (Next.js App Router + Zustand)
   ├─ /api/chat                 -> Symbol detection -> Data/news/risks -> Groq stream
   ├─ /api/portfolio            -> Holdings CRUD + valuation
   ├─ /api/watchlist            -> Watchlist CRUD + quote enrich
   ├─ /api/daily-brief          -> Snapshot build + AI brief generation
   └─ /api/conversations/*      -> Conversation/message persistence

Supabase
   ├─ Auth (email/password + OAuth)
   ├─ Postgres tables
   └─ RLS policies per user
```

---

## Database

Database schema is provided in:

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

Schema includes enum types, indexes, `updated_at` triggers, and full Row-Level Security policies.

---

## Environment Variables

Create `.env.local`:

```env
NEXT_PUBLIC_SUPABASE_URL=
NEXT_PUBLIC_SUPABASE_ANON_KEY=
SUPABASE_SERVICE_ROLE_KEY=

GROQ_API_KEY=

MARKETAUX_API_KEY=
NEWSDATA_API_KEY=

CRON_SECRET=
```

---

## Local Development

```bash
npm install
npm run dev
```

Open `http://localhost:3000`.

Production:

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
| `/api/conversations/[id]` | GET, DELETE | Retrieve/delete a conversation |
| `/api/conversations/[id]/messages` | GET | Paginated messages |
| `/api/portfolio` | GET, POST | Holdings list/create |
| `/api/portfolio/[id]` | PUT, DELETE | Update/delete holding |
| `/api/watchlist` | GET, POST, DELETE | Watchlist operations |
| `/api/stock/search` | GET | Symbol search/autocomplete |
| `/api/stock/quote` | GET | Quick quote |
| `/api/daily-brief` | GET, POST | Fetch/generate briefs |

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

Modes:

1. **User mode** (authenticated): generate brief for current user
2. **Cron/admin mode** (secure): generate briefs for all users with holdings

---

## Security Model

- Middleware-protected routes with session refresh
- Supabase Auth for identity
- Per-user data isolation via RLS
- Service-role client restricted to trusted server contexts

---

## Project Structure

```text
src/
  app/
    (app)/                 # authenticated pages
    api/                   # route handlers
    auth/callback/         # OAuth callback
    login/, signup/        # auth pages
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

✅ Production build passes successfully.

