-- Normalized singleplayer achievement and discovery mirrors.
-- The daily_run JSON document remains the client bridge until validated server
-- action handlers own progression writes.

create table if not exists public.singleplayer_achievement_unlocks (
  user_id uuid not null references public.profiles(id) on delete cascade,
  achievement_id text not null,
  tier text not null check (tier in ('bronze', 'silver', 'gold', 'legendary')),
  category text not null,
  unlocked_at timestamptz not null,
  reward_claimed_at timestamptz,
  metadata jsonb not null default '{}'::jsonb,
  primary key (user_id, achievement_id)
);

create table if not exists public.singleplayer_discovery_unlocks (
  user_id uuid not null references public.profiles(id) on delete cascade,
  discovery_id text not null,
  kind text not null check (kind in ('spell', 'unit')),
  content_id text not null,
  source_type text not null check (source_type in ('starter', 'run-level', 'achievement', 'boss', 'legacy')),
  source_id text not null,
  unlocked_at timestamptz not null,
  metadata jsonb not null default '{}'::jsonb,
  primary key (user_id, discovery_id),
  unique (user_id, kind, content_id)
);

create table if not exists public.singleplayer_discovery_offers (
  user_id uuid not null,
  discovery_id text not null,
  offer_nodes_remaining int not null default 2 check (offer_nodes_remaining between 0 and 2),
  first_offered_at timestamptz,
  acquired_at timestamptz,
  updated_at timestamptz not null default now(),
  primary key (user_id, discovery_id),
  foreign key (user_id, discovery_id)
    references public.singleplayer_discovery_unlocks(user_id, discovery_id)
    on delete cascade
);

create index if not exists singleplayer_achievement_unlocks_user_time_idx
  on public.singleplayer_achievement_unlocks (user_id, unlocked_at desc);

create index if not exists singleplayer_discovery_unlocks_user_kind_idx
  on public.singleplayer_discovery_unlocks (user_id, kind, unlocked_at desc);

create index if not exists singleplayer_discovery_offers_user_pending_idx
  on public.singleplayer_discovery_offers (user_id, offer_nodes_remaining, updated_at);

create or replace function public.touch_singleplayer_progression_updated_at()
returns trigger
language plpgsql
set search_path = public
as $$
begin
  new.updated_at = now();
  return new;
end;
$$;

drop trigger if exists touch_singleplayer_discovery_offers_updated_at
  on public.singleplayer_discovery_offers;
create trigger touch_singleplayer_discovery_offers_updated_at
  before update on public.singleplayer_discovery_offers
  for each row execute function public.touch_singleplayer_progression_updated_at();

-- Backfill milestone records already normalized into player_states.daily_run.
insert into public.singleplayer_achievement_unlocks (
  user_id,
  achievement_id,
  tier,
  category,
  unlocked_at,
  reward_claimed_at,
  metadata
)
select
  ps.user_id,
  unlock_record->>'id',
  case
    when unlock_record->>'tier' in ('bronze', 'silver', 'gold', 'legendary') then unlock_record->>'tier'
    else 'bronze'
  end,
  coalesce(nullif(unlock_record->>'category', ''), 'legacy'),
  case
    when unlock_record->>'unlockedAt' ~ '^[0-9]+([.][0-9]+)?$'
      then to_timestamp(greatest(1, (unlock_record->>'unlockedAt')::numeric) / 1000.0)
    else coalesce(ps.updated_at, now())
  end,
  case
    when coalesce(ps.daily_run->'claimedMilestoneIds', '[]'::jsonb) @> jsonb_build_array(unlock_record->>'id')
      then coalesce(ps.updated_at, now())
    else null
  end,
  jsonb_strip_nulls(jsonb_build_object(
    'title', unlock_record->>'title',
    'iconPath', unlock_record->>'iconPath'
  ))
from public.player_states ps
cross join lateral jsonb_array_elements(
  case
    when jsonb_typeof(ps.daily_run->'milestoneUnlocks') = 'array' then ps.daily_run->'milestoneUnlocks'
    else '[]'::jsonb
  end
) as unlock_record
where coalesce(unlock_record->>'id', '') <> ''
on conflict do nothing;

-- Backfill discovery ownership and source records from the versioned JSON state.
insert into public.singleplayer_discovery_unlocks (
  user_id,
  discovery_id,
  kind,
  content_id,
  source_type,
  source_id,
  unlocked_at,
  metadata
)
select
  ps.user_id,
  unlock_record->>'id',
  unlock_record->>'kind',
  unlock_record->>'contentId',
  case
    when unlock_record->>'sourceType' in ('starter', 'run-level', 'achievement', 'boss', 'legacy')
      then unlock_record->>'sourceType'
    else 'legacy'
  end,
  coalesce(nullif(unlock_record->>'sourceId', ''), 'pre-normalized-save'),
  case
    when unlock_record->>'unlockedAt' ~ '^[0-9]+([.][0-9]+)?$'
      then to_timestamp(greatest(1, (unlock_record->>'unlockedAt')::numeric) / 1000.0)
    else coalesce(ps.updated_at, now())
  end,
  jsonb_build_object(
    'discoveryVersion', coalesce(ps.daily_run->'discovery'->>'version', '1')
  )
from public.player_states ps
cross join lateral jsonb_array_elements(
  case
    when jsonb_typeof(ps.daily_run->'discovery'->'unlockRecords') = 'array'
      then ps.daily_run->'discovery'->'unlockRecords'
    else '[]'::jsonb
  end
) as unlock_record
where unlock_record->>'kind' in ('spell', 'unit')
  and coalesce(unlock_record->>'id', '') <> ''
  and coalesce(unlock_record->>'contentId', '') <> ''
on conflict do nothing;

-- Preserve unresolved next-offer guarantees. Offer/acquisition timestamps are
-- intentionally null when the old JSON state did not record them.
insert into public.singleplayer_discovery_offers (
  user_id,
  discovery_id,
  offer_nodes_remaining,
  updated_at
)
select
  ps.user_id,
  pending_offer->>'id',
  least(2, greatest(0, case
    when pending_offer->>'offerNodesRemaining' ~ '^[0-9]+$'
      then (pending_offer->>'offerNodesRemaining')::int
    else 2
  end)),
  coalesce(ps.updated_at, now())
from public.player_states ps
cross join lateral jsonb_array_elements(
  case
    when jsonb_typeof(ps.daily_run->'discovery'->'pendingOffers') = 'array'
      then ps.daily_run->'discovery'->'pendingOffers'
    else '[]'::jsonb
  end
) as pending_offer
join public.singleplayer_discovery_unlocks discovery
  on discovery.user_id = ps.user_id
  and discovery.discovery_id = pending_offer->>'id'
where coalesce(pending_offer->>'id', '') <> ''
on conflict (user_id, discovery_id) do nothing;

alter table public.singleplayer_achievement_unlocks enable row level security;
alter table public.singleplayer_discovery_unlocks enable row level security;
alter table public.singleplayer_discovery_offers enable row level security;

drop policy if exists "players can read own singleplayer achievements"
  on public.singleplayer_achievement_unlocks;
create policy "players can read own singleplayer achievements"
  on public.singleplayer_achievement_unlocks for select
  using (auth.uid() = user_id);

drop policy if exists "players can read own singleplayer discoveries"
  on public.singleplayer_discovery_unlocks;
create policy "players can read own singleplayer discoveries"
  on public.singleplayer_discovery_unlocks for select
  using (auth.uid() = user_id);

drop policy if exists "players can read own singleplayer offers"
  on public.singleplayer_discovery_offers;
create policy "players can read own singleplayer offers"
  on public.singleplayer_discovery_offers for select
  using (auth.uid() = user_id);

-- Trusted server handlers own mutations. Authenticated clients receive only
-- their RLS-filtered read view until server-side achievement validation lands.
revoke all on public.singleplayer_achievement_unlocks from anon;
revoke all on public.singleplayer_discovery_unlocks from anon;
revoke all on public.singleplayer_discovery_offers from anon;
revoke insert, update, delete on public.singleplayer_achievement_unlocks from authenticated;
revoke insert, update, delete on public.singleplayer_discovery_unlocks from authenticated;
revoke insert, update, delete on public.singleplayer_discovery_offers from authenticated;
grant select on public.singleplayer_achievement_unlocks to authenticated;
grant select on public.singleplayer_discovery_unlocks to authenticated;
grant select on public.singleplayer_discovery_offers to authenticated;
