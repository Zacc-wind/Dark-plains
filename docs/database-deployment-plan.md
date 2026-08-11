# Live Database And Deployment Plan

Goal: move the game from browser-only `localStorage` into a deployable online setup where accounts, world state, leaderboards, PVP challenges, reports, quests, shops, and editable content survive across devices.

## Recommended Stack

- Hosting: Vercel for the Next.js app.
- Database: Supabase Postgres.
- Auth: Supabase Auth, replacing the current plaintext local password system.
- Assets: keep generated images in `public/assets` for now; later move user-uploaded/generated seasonal assets to Supabase Storage if needed.

Why this stack fits the game:

- The app is already Next.js, and Vercel deployment is zero-config for normal Next.js projects.
- Supabase gives Postgres, Auth, Row Level Security, dashboard table editing, and local/staging/production workflows.
- Postgres works well for long-lived browser-game state: players, inventories, timers, reports, leaderboards, PVP challenges, and admin-editable content.

## Migration Phases

### Phase 1: Storage Boundary

Keep gameplay working, but stop calling `localStorage` directly from every system.

- Create a `gameStore` interface with methods like `getCurrentPlayer`, `savePlayerState`, `listPlayers`, `createBattleReport`, and `listLeaderboards`.
- Current implementation: local storage adapter.
- Future implementation: API/Supabase adapter.
- Keep local storage for fast prototyping until the remote version reaches feature parity.

### Phase 2: Server API

Add Next.js route handlers for game writes so important state changes are server-controlled.

Initial endpoints:

- `GET /api/me`
- `PATCH /api/me/state`
- `GET /api/leaderboards`
- `POST /api/battle-reports`
- `POST /api/daily-runs/complete`
- `POST /api/pvp/challenges`
- `PATCH /api/pvp/challenges/:id`

Current status: route contracts exist in the app, but mutating routes intentionally return `501` until Supabase Auth and the database adapter are connected. This keeps deployment probes explicit instead of accidentally pretending local browser state is global server state.

Avoid trusting client-only rewards. The server should validate daily lockouts, reward claims, battle results, inventory capacity, and PVP confirmation windows.

### Phase 3: Supabase Schema

Checked-in migration status:

- `001`-`006` create the profile/player-state foundation, world presence, PVP challenge policies, content registry, multiplayer daily records, and enemy-only unit flags.
- `007_multiplayer_sessions.sql` adds trade, human-duel, and duo-raid sessions with optimistic versions; co-op action receipts and duplicate-proof reward claims; participant-scoped RLS; and the missing friendship, party, and chat policies.
- `008_singleplayer_progression.sql` adds normalized singleplayer achievement/discovery mirrors, offer guarantees, legacy backfill, indexes, triggers, and owner-scoped RLS. **Hosted status (2026-08-11):** applied (`singleplayer_achievement_unlocks` / discovery tables live).
- `009_chat_history_retention.sql` adds the global/party history index and a security-definer pruning trigger that keeps only the latest 50 messages per channel or party. **Hosted status (2026-08-11):** applied.
- `011_party_invites_and_realtime.sql` adds `party_invites` (RLS read for participants; admin writes) and publishes `coop_raid_sessions`, `coop_raid_actions`, and `party_invites` to `supabase_realtime`. **Hosted status (2026-08-11):** applied.
- Session tables are readable only by their participants. Trade, duel, co-op action, and co-op claim mutations remain server-only until the route handlers validate inventory ownership, expected revisions, legal combat actions, expiration, and rewards.
- Multiplayer story response ids, tones, and timestamps remain inside the existing `player_states.story_quests` JSON payload, so the authored-choice work requires no additional schema migration.
- These files are local source of truth but have not yet been applied to or validated against the hosted project.

Staging deployment steps once the Supabase CLI and project access are available:

```powershell
supabase login
supabase link --project-ref <project-ref>
supabase db push
```

After deployment, use two authenticated staging accounts to verify that participants can read their shared session, a third account cannot, client-side mutations fail, and trusted handlers reject stale versions and duplicate claims.

First tables:

```sql
create table profiles (
  id uuid primary key references auth.users(id) on delete cascade,
  username text unique not null,
  selected_model int not null default 3,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table player_states (
  user_id uuid primary key references profiles(id) on delete cascade,
  level int not null default 1,
  gold int not null default 100,
  exp int not null default 0,
  x int not null default 28,
  y int not null default 28,
  stats jsonb not null,
  inventory jsonb not null default '[]'::jsonb,
  equipment jsonb not null default '[]'::jsonb,
  equipped_slots jsonb not null default '{}'::jsonb,
  known_spell_ids text[] not null default '{}',
  equipped_spell_ids text[] not null default '{}',
  minions jsonb not null default '[]'::jsonb,
  job_queue jsonb not null default '[]'::jsonb,
  traveling jsonb,
  inventory_slots int not null default 20,
  inventory_upgrade_level int not null default 0,
  updated_at timestamptz not null default now()
);

-- `equipment` JSON currently includes socketBonuses:
-- [{ id, stat, baseValue, upgradeLevel }].
-- Keep this JSON during prototype speed, then normalize later only if forge queries need indexing.

create table activity_logs (
  id text primary key,
  user_id uuid not null references profiles(id) on delete cascade,
  type text not null,
  title text not null,
  source text not null,
  rewards jsonb not null default '{}'::jsonb,
  description text,
  completed_at timestamptz not null
);

create table daily_run_records (
  id text primary key,
  user_id uuid not null references profiles(id) on delete cascade,
  run_date date not null,
  challenge_name text,
  weekly_reward_name text,
  wins int not null,
  target_battles int not null,
  units_standing int not null,
  gold int not null,
  exp int not null,
  rare_gems int,
  completed_at timestamptz not null,
  unique (user_id, run_date)
);

-- Future singleplayer progression mirrors. `player_states.daily_run` remains the
-- canonical prototype save until the server-authoritative migration is applied.
create table singleplayer_achievement_unlocks (
  user_id uuid not null references profiles(id) on delete cascade,
  achievement_id text not null,
  tier text not null,
  category text not null,
  unlocked_at timestamptz not null,
  reward_claimed_at timestamptz,
  metadata jsonb not null default '{}'::jsonb,
  primary key (user_id, achievement_id)
);

create table singleplayer_discovery_unlocks (
  user_id uuid not null references profiles(id) on delete cascade,
  discovery_id text not null,
  kind text not null check (kind in ('spell', 'unit')),
  content_id text not null,
  source_type text not null,
  source_id text not null,
  unlocked_at timestamptz not null,
  metadata jsonb not null default '{}'::jsonb,
  primary key (user_id, discovery_id),
  unique (user_id, kind, content_id)
);

create table singleplayer_discovery_offers (
  user_id uuid not null references profiles(id) on delete cascade,
  discovery_id text not null,
  offer_nodes_remaining int not null default 2 check (offer_nodes_remaining between 0 and 2),
  first_offered_at timestamptz,
  acquired_at timestamptz,
  updated_at timestamptz not null default now(),
  primary key (user_id, discovery_id),
  foreign key (user_id, discovery_id)
    references singleplayer_discovery_unlocks(user_id, discovery_id)
    on delete cascade
);

-- Add RLS ownership policies for all three tables in the migration that creates
-- them. The client must never be allowed to write another user's unlock rows.

The executable version is `supabase/migrations/008_singleplayer_progression.sql`.
It also backfills valid milestone/discovery records from `player_states.daily_run`,
adds indexes and timestamps, and keeps mutations server-only. It is prepared but
has not been applied to a Supabase project from this workspace.

create table pvp_challenges (
  id text primary key,
  challenger_id uuid not null references profiles(id) on delete cascade,
  target_id uuid not null references profiles(id) on delete cascade,
  status text not null,
  confirmed_by uuid[] not null default '{}',
  expires_at timestamptz not null,
  created_at timestamptz not null default now()
);

create table battle_reports (
  id text primary key,
  attacker_id uuid references profiles(id) on delete set null,
  defender_id uuid references profiles(id) on delete set null,
  winner_id uuid references profiles(id) on delete set null,
  battle_type text not null,
  title text not null,
  summary jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default now()
);

create table friendships (
  requester_id uuid not null references profiles(id) on delete cascade,
  addressee_id uuid not null references profiles(id) on delete cascade,
  status text not null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  primary key (requester_id, addressee_id)
);

create table parties (
  id uuid primary key default gen_random_uuid(),
  leader_id uuid not null references profiles(id) on delete cascade,
  created_at timestamptz not null default now()
);

create table party_members (
  party_id uuid not null references parties(id) on delete cascade,
  user_id uuid not null references profiles(id) on delete cascade,
  joined_at timestamptz not null default now(),
  primary key (party_id, user_id)
);

create table coop_raid_sessions (
  id text primary key,
  party_id uuid not null references parties(id) on delete cascade,
  host_id uuid not null references profiles(id) on delete cascade,
  ally_id uuid not null references profiles(id) on delete cascade,
  boss_id text not null,
  phase text not null check (phase in ('formation', 'active', 'completed', 'abandoned', 'expired')),
  version bigint not null default 1,
  boss_snapshot jsonb not null,
  host_snapshot jsonb not null,
  ally_snapshot jsonb not null,
  host_formation jsonb not null,
  ally_formation jsonb not null,
  combat_snapshot jsonb,
  result jsonb,
  expires_at timestamptz not null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table coop_raid_actions (
  session_id text not null references coop_raid_sessions(id) on delete cascade,
  action_id text not null,
  actor_id uuid not null references profiles(id) on delete cascade,
  expected_revision bigint not null,
  payload jsonb not null,
  created_at timestamptz not null default now(),
  primary key (session_id, action_id)
);

create table coop_raid_claims (
  session_id text not null references coop_raid_sessions(id) on delete cascade,
  user_id uuid not null references profiles(id) on delete cascade,
  reward jsonb not null,
  equipment_id text,
  claimed_at timestamptz not null default now(),
  primary key (session_id, user_id)
);

create table chat_messages (
  id uuid primary key default gen_random_uuid(),
  channel text not null,
  party_id uuid references parties(id) on delete cascade,
  user_id uuid not null references profiles(id) on delete cascade,
  body text not null,
  created_at timestamptz not null default now()
);
```

Leaderboard views:

```sql
create view leaderboard_power as
select
  p.username,
  ps.level,
  ps.gold,
  ps.stats,
  ps.minions,
  p.selected_model,
  ps.updated_at
from player_states ps
join profiles p on p.id = ps.user_id;

create view leaderboard_daily as
select
  p.username,
  count(*) as completions,
  max(wins) as best_wins,
  max(completed_at) as last_completed_at
from daily_run_records d
join profiles p on p.id = d.user_id
group by p.username;
```

Expose the views by mode: `/api/leaderboards?scope=world` must return only
multiplayer boards, while `scope=run` returns only singleplayer run records.
`scope=all` is reserved for admin/debug clients.

### Phase 4: Editable Content

Move balance/content from source files into editable database tables once the mechanics settle.

Candidate tables:

- `content_minion_templates`
- `content_equipment_tables`
- `content_shop_offers`
- `content_city_quests`
- `content_story_chapters`
- `content_spell_library`
- `content_travel_events`
- `content_world_events`

Each content row should include:

- `id`
- `version`
- `enabled`
- `payload jsonb`
- `updated_at`

This lets us edit live content in the database without redeploying for every number or text change.

## Current Leaderboard Bridge

The in-game Leaders panel now uses a reusable `getLeaderboardBoards()` shape:

- Commander Power
- Daily Run
- Vault Gold
- Battle Victories

Today these boards read local browser users. After Phase 2, the UI can call `/api/leaderboards` and render the same fields from Postgres.

## Security Notes

- Current passwords are local prototype data only and must not be used in production.
- Production auth should use Supabase Auth or another managed auth provider.
- Server endpoints must validate rewards and daily lockouts.
- Co-op actions must atomically compare the session version and combat revision before writing the next snapshot.
- Co-op reward claims must use the `(session_id, user_id)` primary key as the final duplicate barrier.
- Row Level Security should allow users to read public leaderboard/profile fields, but only update their own player state.
- Co-op session RLS should allow reads only to the host and ally; all combat and reward mutations should go through validated server handlers.
- Admin-editable content should be protected by an admin role, not client-side checks.
