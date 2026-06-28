-- Engagement systems: multiplayer daily gauntlet records + optional player state fields.
-- Run in Supabase SQL Editor after 004_unit_content_templates.sql

create table if not exists public.mp_daily_dungeon_records (
  id text primary key,
  user_id uuid not null references public.profiles(id) on delete cascade,
  run_date date not null,
  challenge_name text not null,
  boss_name text not null,
  wins int not null default 0,
  duration_ms int not null default 0,
  reward_gold int not null default 0,
  reward_exp int not null default 0,
  reward_gems int not null default 0,
  completed_at timestamptz not null default now()
);

create index if not exists mp_daily_dungeon_records_user_date_idx
  on public.mp_daily_dungeon_records (user_id, run_date desc);

alter table public.player_states
  add column if not exists mp_daily_dungeon jsonb not null default '{}'::jsonb;

alter table public.player_states
  add column if not exists gear_set_bonus_snapshot jsonb not null default '{}'::jsonb;

alter table public.mp_daily_dungeon_records enable row level security;

drop policy if exists "players can read own mp daily records"
  on public.mp_daily_dungeon_records;

create policy "players can read own mp daily records"
  on public.mp_daily_dungeon_records for select
  using (auth.uid() = user_id);

drop policy if exists "players can insert own mp daily records"
  on public.mp_daily_dungeon_records;

create policy "players can insert own mp daily records"
  on public.mp_daily_dungeon_records for insert
  with check (auth.uid() = user_id);

-- PVP policies from 003 should already exist. Re-run safe if needed:
-- See supabase/migrations/003_pvp_challenge_policies.sql
