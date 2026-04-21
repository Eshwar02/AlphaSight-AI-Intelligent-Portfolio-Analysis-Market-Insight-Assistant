-- AlphaSight AI — Full database schema
-- Run this against a fresh Supabase project.

-- =====================================================================
-- Extensions
-- =====================================================================
create extension if not exists "uuid-ossp";

-- =====================================================================
-- Custom ENUM types
-- =====================================================================
create type message_role as enum ('user', 'assistant');
create type market_type  as enum ('US', 'IN');

-- =====================================================================
-- Helper: auto-update updated_at column
-- =====================================================================
create or replace function update_updated_at_column()
returns trigger as $$
begin
  new.updated_at = now();
  return new;
end;
$$ language plpgsql;

-- =====================================================================
-- Tables
-- =====================================================================

-- conversations
create table conversations (
  id         uuid primary key default uuid_generate_v4(),
  user_id    uuid not null references auth.users(id) on delete cascade,
  title      text not null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create index idx_conversations_user_id on conversations(user_id);

create trigger conversations_updated_at
  before update on conversations
  for each row execute function update_updated_at_column();

-- messages
create table messages (
  id              uuid primary key default uuid_generate_v4(),
  conversation_id uuid not null references conversations(id) on delete cascade,
  role            message_role not null,
  content         text not null,
  metadata        jsonb,
  created_at      timestamptz not null default now()
);

create index idx_messages_conversation_id on messages(conversation_id);

-- portfolio_holdings
create table portfolio_holdings (
  id            uuid primary key default uuid_generate_v4(),
  user_id       uuid not null references auth.users(id) on delete cascade,
  symbol        text not null,
  quantity      numeric not null,
  avg_buy_price numeric not null,
  currency      text,
  notes         text,
  created_at    timestamptz not null default now(),
  updated_at    timestamptz not null default now()
);

create index idx_portfolio_holdings_user_id on portfolio_holdings(user_id);

create trigger portfolio_holdings_updated_at
  before update on portfolio_holdings
  for each row execute function update_updated_at_column();

-- watchlist
create table watchlist (
  id       uuid primary key default uuid_generate_v4(),
  user_id  uuid not null references auth.users(id) on delete cascade,
  symbol   text not null,
  added_at timestamptz not null default now(),

  unique (user_id, symbol)
);

create index idx_watchlist_user_id on watchlist(user_id);

-- daily_briefs
create table daily_briefs (
  id                 uuid primary key default uuid_generate_v4(),
  user_id            uuid not null references auth.users(id) on delete cascade,
  content            text not null,
  portfolio_snapshot jsonb not null default '{}'::jsonb,
  created_at         timestamptz not null default now()
);

create index idx_daily_briefs_user_id on daily_briefs(user_id);

-- user_preferences
create table user_preferences (
  id             uuid primary key default uuid_generate_v4(),
  user_id        uuid not null unique references auth.users(id) on delete cascade,
  default_market market_type not null default 'US',
  theme          text not null default 'system',
  created_at     timestamptz not null default now()
);

create index idx_user_preferences_user_id on user_preferences(user_id);

-- =====================================================================
-- Row-Level Security
-- =====================================================================

alter table conversations      enable row level security;
alter table messages           enable row level security;
alter table portfolio_holdings enable row level security;
alter table watchlist          enable row level security;
alter table daily_briefs       enable row level security;
alter table user_preferences   enable row level security;

-- conversations
create policy "Users can view their own conversations"
  on conversations for select
  using (auth.uid() = user_id);

create policy "Users can create their own conversations"
  on conversations for insert
  with check (auth.uid() = user_id);

create policy "Users can update their own conversations"
  on conversations for update
  using (auth.uid() = user_id);

create policy "Users can delete their own conversations"
  on conversations for delete
  using (auth.uid() = user_id);

-- messages (access scoped through conversation ownership)
create policy "Users can view messages in their conversations"
  on messages for select
  using (
    exists (
      select 1 from conversations
      where conversations.id = messages.conversation_id
        and conversations.user_id = auth.uid()
    )
  );

create policy "Users can insert messages in their conversations"
  on messages for insert
  with check (
    exists (
      select 1 from conversations
      where conversations.id = messages.conversation_id
        and conversations.user_id = auth.uid()
    )
  );

create policy "Users can delete messages in their conversations"
  on messages for delete
  using (
    exists (
      select 1 from conversations
      where conversations.id = messages.conversation_id
        and conversations.user_id = auth.uid()
    )
  );

-- portfolio_holdings
create policy "Users can view their own holdings"
  on portfolio_holdings for select
  using (auth.uid() = user_id);

create policy "Users can create their own holdings"
  on portfolio_holdings for insert
  with check (auth.uid() = user_id);

create policy "Users can update their own holdings"
  on portfolio_holdings for update
  using (auth.uid() = user_id);

create policy "Users can delete their own holdings"
  on portfolio_holdings for delete
  using (auth.uid() = user_id);

-- watchlist
create policy "Users can view their own watchlist"
  on watchlist for select
  using (auth.uid() = user_id);

create policy "Users can add to their own watchlist"
  on watchlist for insert
  with check (auth.uid() = user_id);

create policy "Users can remove from their own watchlist"
  on watchlist for delete
  using (auth.uid() = user_id);

-- daily_briefs
create policy "Users can view their own briefs"
  on daily_briefs for select
  using (auth.uid() = user_id);

create policy "Users can create their own briefs"
  on daily_briefs for insert
  with check (auth.uid() = user_id);

-- user_preferences
create policy "Users can view their own preferences"
  on user_preferences for select
  using (auth.uid() = user_id);

create policy "Users can create their own preferences"
  on user_preferences for insert
  with check (auth.uid() = user_id);

create policy "Users can update their own preferences"
  on user_preferences for update
  using (auth.uid() = user_id);
