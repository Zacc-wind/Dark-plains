-- Durable duo coop dungeon sessions.
-- Session mutations remain server-admin owned; authenticated clients may read participant rows.

create table if not exists public.coop_dungeon_sessions (
  id text primary key,
  party_id uuid references public.parties(id) on delete set null,
  host_id uuid not null references public.profiles(id) on delete cascade,
  ally_id uuid not null references public.profiles(id) on delete cascade,
  dungeon_id text not null,
  seed text not null,
  phase text not null check (phase in ('lobby', 'chamber', 'complete', 'abandoned')),
  version bigint not null default 1 check (version > 0),
  chambers jsonb not null default '[]'::jsonb,
  current_chamber_index integer not null default 0 check (current_chamber_index >= 0),
  combat_snapshot jsonb,
  result jsonb,
  expires_at timestamptz not null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  check (host_id <> ally_id)
);

create index if not exists coop_dungeon_sessions_participants_phase_idx
  on public.coop_dungeon_sessions (host_id, ally_id, phase, updated_at desc);

create index if not exists coop_dungeon_sessions_dungeon_updated_idx
  on public.coop_dungeon_sessions (dungeon_id, updated_at desc);

drop trigger if exists touch_coop_dungeon_sessions_updated_at on public.coop_dungeon_sessions;
create trigger touch_coop_dungeon_sessions_updated_at
  before update on public.coop_dungeon_sessions
  for each row execute function public.touch_multiplayer_session_updated_at();

alter table public.coop_dungeon_sessions enable row level security;

drop policy if exists "dungeon participants can read sessions" on public.coop_dungeon_sessions;
create policy "dungeon participants can read sessions"
  on public.coop_dungeon_sessions for select
  to authenticated
  using ((select auth.uid()) in (host_id, ally_id));

-- Trusted server handlers own session writes (create / advance / abandon / start_chamber).
revoke insert, update, delete on public.coop_dungeon_sessions from anon, authenticated;
grant select on public.coop_dungeon_sessions to authenticated;

-- Realtime: participant clients can observe dungeon session changes.
do $$
begin
  alter publication supabase_realtime add table public.coop_dungeon_sessions;
exception
  when duplicate_object then null;
end $$;
