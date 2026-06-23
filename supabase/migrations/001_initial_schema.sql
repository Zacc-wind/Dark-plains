-- Dark Plains initial schema
-- Run in Supabase SQL Editor (Dashboard -> SQL -> New query)

create extension if not exists "pgcrypto";

-- Profiles (public identity)
create table if not exists public.profiles (
  id uuid primary key references auth.users(id) on delete cascade,
  username text unique not null,
  selected_model int not null default 3,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

-- Full commander + world save (jsonb for fast iteration with current game code)
create table if not exists public.player_states (
  user_id uuid primary key references public.profiles(id) on delete cascade,
  level int not null default 1,
  gold int not null default 100,
  exp int not null default 0,
  x int not null default 36,
  y int not null default 28,
  stats jsonb not null default '{}'::jsonb,
  inventory jsonb not null default '[]'::jsonb,
  equipment jsonb not null default '[]'::jsonb,
  equipped_slots jsonb not null default '{}'::jsonb,
  known_spell_ids text[] not null default array['arcane-bolt', 'sanctified-mend', 'ember-dart', 'warding-prayer'],
  equipped_spell_ids text[] not null default array['arcane-bolt', 'sanctified-mend', 'ember-dart', 'warding-prayer'],
  minions jsonb not null default '[]'::jsonb,
  job_queue jsonb not null default '[]'::jsonb,
  traveling jsonb,
  inventory_slots int not null default 20,
  inventory_upgrade_level int not null default 0,
  daily_quests jsonb not null default '{}'::jsonb,
  city_quests jsonb not null default '[]'::jsonb,
  story_quests jsonb not null default '[]'::jsonb,
  daily_run jsonb not null default '{}'::jsonb,
  social jsonb not null default '{}'::jsonb,
  activity_log jsonb not null default '[]'::jsonb,
  spell_unlock_version int not null default 1,
  game_sessions jsonb not null default '{}'::jsonb,
  updated_at timestamptz not null default now()
);

create table if not exists public.daily_run_records (
  id text primary key,
  user_id uuid not null references public.profiles(id) on delete cascade,
  run_date date not null,
  challenge_name text,
  weekly_reward_name text,
  wins int not null default 0,
  target_battles int not null default 1,
  units_standing int not null default 0,
  gold int not null default 0,
  exp int not null default 0,
  rare_gems int,
  score int not null default 0,
  duration_ms int not null default 0,
  bosses_defeated text[] not null default '{}',
  route_summary text[] not null default '{}',
  shop_buys text[] not null default '{}',
  omens text[] not null default '{}',
  unlocked_spell_names text[] not null default '{}',
  run_level_after int not null default 1,
  streak_after int not null default 0,
  completed_at timestamptz not null default now()
);

create table if not exists public.pvp_challenges (
  id text primary key,
  challenger_id uuid not null references public.profiles(id) on delete cascade,
  target_id uuid not null references public.profiles(id) on delete cascade,
  status text not null,
  confirmed_by uuid[] not null default '{}',
  expires_at timestamptz not null,
  created_at timestamptz not null default now()
);

create table if not exists public.battle_reports (
  id text primary key,
  attacker_id uuid references public.profiles(id) on delete set null,
  defender_id uuid references public.profiles(id) on delete set null,
  winner_id uuid references public.profiles(id) on delete set null,
  battle_type text not null,
  title text not null,
  summary jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default now()
);

create table if not exists public.friendships (
  requester_id uuid not null references public.profiles(id) on delete cascade,
  addressee_id uuid not null references public.profiles(id) on delete cascade,
  status text not null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  primary key (requester_id, addressee_id)
);

create table if not exists public.parties (
  id uuid primary key default gen_random_uuid(),
  leader_id uuid not null references public.profiles(id) on delete cascade,
  created_at timestamptz not null default now()
);

create table if not exists public.party_members (
  party_id uuid not null references public.parties(id) on delete cascade,
  user_id uuid not null references public.profiles(id) on delete cascade,
  joined_at timestamptz not null default now(),
  primary key (party_id, user_id)
);

create table if not exists public.chat_messages (
  id uuid primary key default gen_random_uuid(),
  channel text not null,
  party_id uuid references public.parties(id) on delete cascade,
  user_id uuid not null references public.profiles(id) on delete cascade,
  body text not null,
  created_at timestamptz not null default now()
);

-- Optional future content tables (seed from code later)
create table if not exists public.content_entries (
  id text primary key,
  category text not null,
  version int not null default 1,
  enabled boolean not null default true,
  payload jsonb not null default '{}'::jsonb,
  updated_at timestamptz not null default now()
);

create index if not exists daily_run_records_user_completed_idx
  on public.daily_run_records (user_id, completed_at desc);

create index if not exists profiles_username_idx
  on public.profiles (username);

-- Auto-create profile + starter save on signup
create or replace function public.handle_new_user()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
declare
  safe_username text;
begin
  safe_username := coalesce(nullif(trim(new.raw_user_meta_data->>'username'), ''), split_part(new.email, '@', 1));

  insert into public.profiles (id, username)
  values (new.id, safe_username)
  on conflict (id) do nothing;

  insert into public.player_states (
    user_id,
    stats,
    daily_run
  )
  values (
    new.id,
    jsonb_build_object(
      'armyPower', 5,
      'defensivePower', 5,
      'morale', 5,
      'spellPower', 3,
      'health', 100,
      'maxHealth', 100,
      'level', 1,
      'unallocatedPoints', 0
    ),
    jsonb_build_object(
      'streak', 0,
      'bestWins', 0,
      'completions', 0,
      'history', '[]'::jsonb,
      'runLevel', 1,
      'runExp', 0,
      'runUpgradePoints', 0,
      'permanentStats', jsonb_build_object(
        'armyPower', 0,
        'defensivePower', 0,
        'morale', 0,
        'spellPower', 0,
        'maxHealth', 0,
        'unitPower', 0,
        'unitWard', 0
      ),
      'claimedMilestoneIds', '[]'::jsonb
    )
  )
  on conflict (user_id) do nothing;

  return new;
end;
$$;

drop trigger if exists on_auth_user_created on auth.users;
create trigger on_auth_user_created
  after insert on auth.users
  for each row execute procedure public.handle_new_user();

-- RLS
alter table public.profiles enable row level security;
alter table public.player_states enable row level security;
alter table public.daily_run_records enable row level security;
alter table public.pvp_challenges enable row level security;
alter table public.battle_reports enable row level security;
alter table public.friendships enable row level security;
alter table public.parties enable row level security;
alter table public.party_members enable row level security;
alter table public.chat_messages enable row level security;
alter table public.content_entries enable row level security;

create policy "profiles are publicly readable"
  on public.profiles for select
  using (true);

create policy "users can update own profile"
  on public.profiles for update
  using (auth.uid() = id);

create policy "users can read own player state"
  on public.player_states for select
  using (auth.uid() = user_id);

create policy "users can update own player state"
  on public.player_states for update
  using (auth.uid() = user_id);

create policy "users can insert own player state"
  on public.player_states for insert
  with check (auth.uid() = user_id);

create policy "users can read own run records"
  on public.daily_run_records for select
  using (auth.uid() = user_id);

create policy "users can insert own run records"
  on public.daily_run_records for insert
  with check (auth.uid() = user_id);

create policy "public leaderboard run aggregates"
  on public.daily_run_records for select
  using (true);

create policy "content entries are readable"
  on public.content_entries for select
  using (enabled = true);

-- Leaderboard views
create or replace view public.leaderboard_power as
select
  p.username,
  ps.level,
  ps.gold,
  ps.stats,
  ps.minions,
  p.selected_model,
  ps.updated_at
from public.player_states ps
join public.profiles p on p.id = ps.user_id;

create or replace view public.leaderboard_daily as
select
  p.username,
  count(*)::int as completions,
  max(d.wins)::int as best_wins,
  max(d.completed_at) as last_completed_at
from public.daily_run_records d
join public.profiles p on p.id = d.user_id
group by p.username;

grant select on public.leaderboard_power to anon, authenticated;
grant select on public.leaderboard_daily to anon, authenticated;
