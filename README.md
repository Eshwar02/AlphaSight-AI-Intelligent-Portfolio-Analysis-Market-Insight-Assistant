# 🚀 AlphaSight AI

### Intelligent Portfolio Analysis & Market Insight Assistant

AlphaSight AI is a professional, AI-first stock intelligence platform for investors who want **real-time insights**, **portfolio clarity**, and **actionable daily market context** in one sleek workspace.

![Next.js](https://img.shields.io/badge/Next.js-15-black?logo=nextdotjs)
![React](https://img.shields.io/badge/React-19-149ECA?logo=react&logoColor=white)
![TypeScript](https://img.shields.io/badge/TypeScript-5-3178C6?logo=typescript&logoColor=white)
![Supabase](https://img.shields.io/badge/Supabase-Postgres-3ECF8E?logo=supabase&logoColor=white)
![Groq](https://img.shields.io/badge/AI-Groq-FF6B35)
![Vercel](https://img.shields.io/badge/Deploy-Vercel-black?logo=vercel)

---

## ✨ Core Features

### 💬 AI Chat Intelligence
- Streaming AI responses for natural, low-latency interactions
- Stock-aware context injection (quote, technicals, macro risks, news)
- Persistent conversation history with secure user scoping

### 📊 Portfolio Analytics
- Add, edit, and manage holdings
- Live valuation, P&L, and performance breakdowns
- Clean summaries for top gainers/losers and portfolio health

### 👀 Watchlist Tracking
- Rapid symbol add/remove workflow
- Real-time quote updates and movement tracking

### ☀️ Daily Market Briefing
- AI-generated daily portfolio brief
- Market pulse + holdings snapshot + action-oriented highlights
- Scheduled generation support via Vercel cron

---

## 🧰 Tools & Technologies

| Category | Stack |
|---|---|
| **Frontend** | Next.js App Router, React 19, TypeScript, Tailwind CSS, Framer Motion |
| **State Management** | Zustand |
| **Backend APIs** | Next.js Route Handlers |
| **Database & Auth** | Supabase (PostgreSQL + RLS + OAuth) |
| **AI Layer** | Groq SDK (`llama-3.3-70b-versatile`) |
| **Market Data** | `yahoo-finance2` |
| **News Sources** | MarketAux, NewsData.io |
| **Deployment** | Vercel |

---

## 🧠 System Design (High-Level)

```text
Client UI (Next.js + Zustand)
   ├─ Chat Panel
   ├─ Portfolio Dashboard
   ├─ Watchlist
   └─ Daily Brief

API Layer (Route Handlers)
   ├─ /api/chat
   ├─ /api/portfolio
   ├─ /api/watchlist
   ├─ /api/daily-brief
   └─ /api/conversations/*

Services
   ├─ Groq (LLM responses)
   ├─ Yahoo Finance (quotes/history/search)
   └─ News APIs (MarketAux + NewsData)

Persistence
   └─ Supabase Postgres (RLS enabled)
```

---

## 🗂️ Product Surfaces

| Route | Purpose |
|---|---|
| `/` | AI chat assistant for stock and market analysis |
| `/portfolio` | Portfolio holdings, valuation, and P&L views |
| `/watchlist` | Watch symbols and monitor movement |
| `/daily-brief` | Generate/read daily AI portfolio briefs |
| `/login`, `/signup` | Authentication |

---

## 🛡️ Security & Data Isolation

- Supabase Auth (email/password + Google OAuth)
- Row-Level Security on all user-owned tables
- Middleware-based session refresh and route protection
- Service-role operations isolated to trusted server contexts

---

## 🗄️ Database

Schema file:

```bash
supabase/schema.sql
```

Primary tables:

- `conversations`
- `messages`
- `portfolio_holdings`
- `watchlist`
- `daily_briefs`
- `user_preferences`

Includes enums, indexes, triggers, and RLS policies.

---

## ⚙️ Environment Setup

Create `.env.local` in project root:

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

## 🧪 Local Development

```bash
npm install
npm run dev
```

Open: `http://localhost:3000`

Production run:

```bash
npm run build
npm run start
```

---

## 🔌 API Endpoints

| Route | Method | Description |
|---|---|---|
| `/api/chat` | POST | Stream AI response with optional stock context |
| `/api/conversations` | GET, POST | List or create conversations |
| `/api/conversations/[id]` | GET, DELETE | Read/delete a conversation |
| `/api/conversations/[id]/messages` | GET | Fetch paginated messages |
| `/api/portfolio` | GET, POST | List/add holdings |
| `/api/portfolio/[id]` | PUT, DELETE | Update/delete holding |
| `/api/watchlist` | GET, POST, DELETE | Manage watchlist |
| `/api/stock/search` | GET | Search symbols |
| `/api/stock/quote` | GET | Get quote |
| `/api/daily-brief` | GET, POST | Fetch or generate daily brief |

---

## ⏱️ Scheduled Brief Automation

Configured via `vercel.json`:

```json
{
  "crons": [
    { "path": "/api/daily-brief", "schedule": "0 3 * * *" }
  ]
}
```

Modes:

1. **User mode**: generate the logged-in user’s brief
2. **Cron mode**: generate briefs for all users with holdings

---

## 📁 Project Structure

```text
src/
  app/
    (app)/                 # authenticated app pages
    api/                   # route handlers
    auth/callback/         # OAuth callback
    login/, signup/        # auth pages
  components/              # chat, layout, portfolio, shared UI
  lib/                     # ai, stock, supabase, hooks, utils
  stores/                  # Zustand store
  types/                   # shared TS types
supabase/
  schema.sql
```

---

## ✅ Status

Production build passes successfully.

