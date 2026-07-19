-- Durable multiplayer sessions and participant-scoped social access.
-- Session mutations intentionally remain server-only until action validation is deployed.

create table if not exists public.trade_sessions (
  id text primary key,
  initiator_id uuid not null references public.profiles(id) on delete cascade,
  recipient_id uuid not null references public.profiles(id) on delete cascade,
  status text not null check (status in ('offered', 'negotiating', 'locked', 'completed', 'cancelled', 'expired')),
  version bigint not null default 1 check (version > 0),
  initiator_offer jsonb not null default '{}'::jsonb,
  recipient_offer jsonb not null default '{}'::jsonb,
  locks jsonb not null default '{}'::jsonb,
  confirmations jsonb not null default '{}'::jsonb,
  expires_at timestamptz not null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  check (initiator_id <> recipient_id)
);

create table if not exists public.pvp_duel_sessions (
  id text primary key,
  challenge_id text references public.pvp_challenges(id) on delete set null,
  challenger_id uuid not null references public.profiles(id) on delete cascade,
  target_id uuid not null references public.profiles(id) on delete cascade,
  phase text not null check (phase in ('formation', 'active', 'completed', 'abandoned', 'expired')),
  version bigint not null default 1 check (version > 0),
  challenger_snapshot jsonb not null,
  target_snapshot jsonb not null,
  challenger_formation jsonb not null default '{}'::jsonb,
  target_formation jsonb not null default '{}'::jsonb,
  combat_snapshot jsonb,
  result jsonb,
  turn_deadline_at timestamptz,
  expires_at timestamptz not null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  check (challenger_id <> target_id)
);

create table if not exists public.coop_raid_sessions (
  id text primary key,
  party_id uuid references public.parties(id) on delete set null,
  host_id uuid not null references public.profiles(id) on delete cascade,
  ally_id uuid not null references public.profiles(id) on delete cascade,
  boss_id text not null,
  phase text not null check (phase in ('formation', 'active', 'completed', 'abandoned', 'expired')),
  version bigint not null default 1 check (version > 0),
  boss_snapshot jsonb not null,
  host_snapshot jsonb not null,
  ally_snapshot jsonb not null,
  host_formation jsonb not null default '{}'::jsonb,
  ally_formation jsonb not null default '{}'::jsonb,
  combat_snapshot jsonb,
  result jsonb,
  turn_deadline_at timestamptz,
  expires_at timestamptz not null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  check (host_id <> ally_id)
);

create table if not exists public.coop_raid_actions (
  session_id text not null references public.coop_raid_sessions(id) on delete cascade,
  action_id text not null,
  actor_id uuid not null references public.profiles(id) on delete cascade,
  expected_revision bigint not null check (expected_revision >= 0),
  payload jsonb not null,
  created_at timestamptz not null default now(),
  primary key (session_id, action_id)
);

create table if not exists public.coop_raid_claims (
  session_id text not null references public.coop_raid_sessions(id) on delete cascade,
  user_id uuid not null references public.profiles(id) on delete cascade,
  reward jsonb not null,
  equipment_id text,
  claimed_at timestamptz not null default now(),
  primary key (session_id, user_id)
);

create index if not exists trade_sessions_participants_status_idx
  on public.trade_sessions (initiator_id, recipient_id, status, updated_at desc);

create index if not exists pvp_duel_sessions_participants_phase_idx
  on public.pvp_duel_sessions (challenger_id, target_id, phase, updated_at desc);

create index if not exists coop_raid_sessions_participants_phase_idx
  on public.coop_raid_sessions (host_id, ally_id, phase, updated_at desc);

create index if not exists coop_raid_actions_session_created_idx
  on public.coop_raid_actions (session_id, created_at);

create or replace function public.touch_multiplayer_session_updated_at()
returns trigger
language plpgsql
set search_path = public
as $$
begin
  new.updated_at = now();
  return new;
end;
$$;

drop trigger if exists touch_trade_sessions_updated_at on public.trade_sessions;
create trigger touch_trade_sessions_updated_at
  before update on public.trade_sessions
  for each row execute function public.touch_multiplayer_session_updated_at();

drop trigger if exists touch_pvp_duel_sessions_updated_at on public.pvp_duel_sessions;
create trigger touch_pvp_duel_sessions_updated_at
  before update on public.pvp_duel_sessions
  for each row execute function public.touch_multiplayer_session_updated_at();

drop trigger if exists touch_coop_raid_sessions_updated_at on public.coop_raid_sessions;
create trigger touch_coop_raid_sessions_updated_at
  before update on public.coop_raid_sessions
  for each row execute function public.touch_multiplayer_session_updated_at();

create or replace function public.is_party_participant(
  target_party_id uuid,
  target_user_id uuid default auth.uid()
)
returns boolean
language sql
stable
security definer
set search_path = public
as $$
  select exists (
    select 1
    from public.parties p
    where p.id = target_party_id
      and (
        p.leader_id = target_user_id
        or exists (
          select 1
          from public.party_members pm
          where pm.party_id = target_party_id
            and pm.user_id = target_user_id
        )
      )
  );
$$;

create or replace function public.is_coop_raid_participant(
  target_session_id text,
  target_user_id uuid default auth.uid()
)
returns boolean
language sql
stable
security definer
set search_path = public
as $$
  select exists (
    select 1
    from public.coop_raid_sessions session
    where session.id = target_session_id
      and target_user_id in (session.host_id, session.ally_id)
  );
$$;

revoke all on function public.is_party_participant(uuid, uuid) from public;
grant execute on function public.is_party_participant(uuid, uuid) to authenticated;
revoke all on function public.is_coop_raid_participant(text, uuid) from public;
grant execute on function public.is_coop_raid_participant(text, uuid) to authenticated;

alter table public.trade_sessions enable row level security;
alter table public.pvp_duel_sessions enable row level security;
alter table public.coop_raid_sessions enable row level security;
alter table public.coop_raid_actions enable row level security;
alter table public.coop_raid_claims enable row level security;

drop policy if exists "trade participants can read sessions" on public.trade_sessions;
create policy "trade participants can read sessions"
  on public.trade_sessions for select
  using (auth.uid() in (initiator_id, recipient_id));

drop policy if exists "duel participants can read sessions" on public.pvp_duel_sessions;
create policy "duel participants can read sessions"
  on public.pvp_duel_sessions for select
  using (auth.uid() in (challenger_id, target_id));

drop policy if exists "raid participants can read sessions" on public.coop_raid_sessions;
create policy "raid participants can read sessions"
  on public.coop_raid_sessions for select
  using (auth.uid() in (host_id, ally_id));

drop policy if exists "raid participants can read actions" on public.coop_raid_actions;
create policy "raid participants can read actions"
  on public.coop_raid_actions for select
  using (public.is_coop_raid_participant(session_id));

drop policy if exists "players can read own raid claims" on public.coop_raid_claims;
create policy "players can read own raid claims"
  on public.coop_raid_claims for select
  using (auth.uid() = user_id and public.is_coop_raid_participant(session_id));

-- Fill the missing participant policies on social tables created in migration 001.
drop policy if exists "friendship participants can read" on public.friendships;
create policy "friendship participants can read"
  on public.friendships for select
  using (auth.uid() in (requester_id, addressee_id));

drop policy if exists "players can send friend requests" on public.friendships;
create policy "players can send friend requests"
  on public.friendships for insert
  with check (auth.uid() = requester_id and requester_id <> addressee_id);

drop policy if exists "friendship participants can update" on public.friendships;
create policy "friendship participants can update"
  on public.friendships for update
  using (auth.uid() in (requester_id, addressee_id))
  with check (auth.uid() in (requester_id, addressee_id));

drop policy if exists "friendship participants can delete" on public.friendships;
create policy "friendship participants can delete"
  on public.friendships for delete
  using (auth.uid() in (requester_id, addressee_id));

drop policy if exists "party participants can read parties" on public.parties;
create policy "party participants can read parties"
  on public.parties for select
  using (public.is_party_participant(id));

drop policy if exists "players can create own parties" on public.parties;
create policy "players can create own parties"
  on public.parties for insert
  with check (auth.uid() = leader_id);

drop policy if exists "party leaders can update parties" on public.parties;
create policy "party leaders can update parties"
  on public.parties for update
  using (auth.uid() = leader_id)
  with check (auth.uid() = leader_id);

drop policy if exists "party leaders can delete parties" on public.parties;
create policy "party leaders can delete parties"
  on public.parties for delete
  using (auth.uid() = leader_id);

drop policy if exists "party participants can read members" on public.party_members;
create policy "party participants can read members"
  on public.party_members for select
  using (public.is_party_participant(party_id));

drop policy if exists "party leaders can add members" on public.party_members;
create policy "party leaders can add members"
  on public.party_members for insert
  with check (
    exists (
      select 1 from public.parties p
      where p.id = party_id and p.leader_id = auth.uid()
    )
  );

drop policy if exists "members or leaders can remove party members" on public.party_members;
create policy "members or leaders can remove party members"
  on public.party_members for delete
  using (
    auth.uid() = user_id
    or exists (
      select 1 from public.parties p
      where p.id = party_id and p.leader_id = auth.uid()
    )
  );

drop policy if exists "players can read allowed chat" on public.chat_messages;
create policy "players can read allowed chat"
  on public.chat_messages for select
  using (
    (channel = 'global' and party_id is null)
    or (party_id is not null and public.is_party_participant(party_id))
  );

drop policy if exists "players can send allowed chat" on public.chat_messages;
create policy "players can send allowed chat"
  on public.chat_messages for insert
  with check (
    auth.uid() = user_id
    and (
      (channel = 'global' and party_id is null)
      or (party_id is not null and public.is_party_participant(party_id))
    )
  );

drop policy if exists "battle participants can read reports" on public.battle_reports;
create policy "battle participants can read reports"
  on public.battle_reports for select
  using (auth.uid() in (attacker_id, defender_id));

-- Authenticated clients may read participant rows, but trusted server handlers own session writes.
revoke insert, update, delete on public.trade_sessions from anon, authenticated;
revoke insert, update, delete on public.pvp_duel_sessions from anon, authenticated;
revoke insert, update, delete on public.coop_raid_sessions from anon, authenticated;
revoke insert, update, delete on public.coop_raid_actions from anon, authenticated;
revoke insert, update, delete on public.coop_raid_claims from anon, authenticated;

grant select on public.trade_sessions to authenticated;
grant select on public.pvp_duel_sessions to authenticated;
grant select on public.coop_raid_sessions to authenticated;
grant select on public.coop_raid_actions to authenticated;
grant select on public.coop_raid_claims to authenticated;
