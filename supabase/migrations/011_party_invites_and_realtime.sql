-- Party invite persistence + realtime publication for co-op raid / invite rows.
-- Invite mutations remain server-admin owned; authenticated clients may read participant rows.

create table if not exists public.party_invites (
  id uuid primary key default gen_random_uuid(),
  party_id uuid not null references public.parties(id) on delete cascade,
  inviter_id uuid not null references public.profiles(id) on delete cascade,
  invitee_id uuid not null references public.profiles(id) on delete cascade,
  status text not null check (status in ('pending', 'accepted', 'declined', 'cancelled', 'expired')),
  expires_at timestamptz not null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  check (inviter_id <> invitee_id)
);

create unique index if not exists party_invites_one_pending_per_invitee
  on public.party_invites (invitee_id) where status = 'pending';

create index if not exists party_invites_party_status_idx
  on public.party_invites (party_id, status);

create index if not exists party_invites_invitee_status_idx
  on public.party_invites (invitee_id, status, expires_at);

drop trigger if exists touch_party_invites_updated_at on public.party_invites;
create trigger touch_party_invites_updated_at
  before update on public.party_invites
  for each row execute function public.touch_multiplayer_session_updated_at();

alter table public.party_invites enable row level security;

drop policy if exists "invite participants can read invites" on public.party_invites;
create policy "invite participants can read invites"
  on public.party_invites for select
  to authenticated
  using ((select auth.uid()) in (inviter_id, invitee_id));

-- Trusted server handlers own invite writes (create / accept / decline / cancel / expire).
revoke insert, update, delete on public.party_invites from anon, authenticated;
grant select on public.party_invites to authenticated;

-- Realtime: participant clients can observe session / action / invite changes.
do $$
begin
  alter publication supabase_realtime add table public.coop_raid_sessions;
exception
  when duplicate_object then null;
end $$;

do $$
begin
  alter publication supabase_realtime add table public.coop_raid_actions;
exception
  when duplicate_object then null;
end $$;

do $$
begin
  alter publication supabase_realtime add table public.party_invites;
exception
  when duplicate_object then null;
end $$;
