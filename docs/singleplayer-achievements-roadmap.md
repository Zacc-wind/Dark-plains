# Singleplayer Run Achievements & Unlocks Roadmap

The detailed achievement-driven spell discovery, unit blueprint, migration, and Run Archive plan lives in `docs/progression-content-roadmap.md`. The local progression model and UI are implemented; the normalized Supabase migration remains deployment work.

## Goal
Build a dedicated singleplayer progression layer on top of random runs, separate from multiplayer world-map progress (`User` profile vs `User.dailyRun`).

## Progress Separation (implemented)
- **Multiplayer** (`/game`): map position, army, quests, gold, XP, social, dungeons/encounters on the world map.
- **Singleplayer** (`/singleplayer`): run level, permanent run bonuses, run history, active run session, future achievements.
- Mode choice stored in `wizardy_game_mode` via `lib/gameMode.ts`.

## Phase 1 — Run Overview Foundation
- [x] Post-login mode select screen with city backdrop.
- [x] First-login mode tutorial explains that Singleplayer and Multiplayer are separate progression tracks before choosing a mode.
- [x] Singleplayer Run Hall hub with compact run overview, hidden menu, and start/resume run.
- [x] Settings panel copy in singleplayer hub.
- [x] Retreat / run close returns to singleplayer hub instead of world map.
- [x] Remove random-run launcher from multiplayer command center and overview.
- [x] Add boss8-led first-run tutorial overlays for singleplayer lobby, draft, map, formation, combat, reward, shop, and omen phases.

## Phase 2 — Achievement Data Model
- [x] Store claimed milestone ids on `User.dailyRun`.
- [x] Track unlock timestamps, tier, and display metadata per achievement id.
- [x] Persist boss kills, route notes, shop buys, omens, spell unlocks, unit classes, unit templates, and tier III recruits in run history.
- [x] Migration helper in `lib/auth.ts` `normalizeDailyRunState()` for older saves.

## Phase 3 — Achievement Catalog
- [x] Define static catalog in `lib/runMilestones.ts` with categories:
  - **Road**: first clear, hard-route clear, no-shop clear, full-streak clear.
  - **Boss**: first kill per boss id, flawless boss (no injuries), speed thresholds.
  - **Army**: recruit every class, promote to tier 3, finish with 7 living units.
  - **Economy**: spend 500 run gold in one run, buy 3 shop items, claim 5 omens.
  - **Meta**: reach run level 5/10/15, 10 lifetime clears, 5-win streak.
- [x] Wire unlock checks into run completion history for boss, road, army, economy, meta, and spell milestones.
- [x] Add exact run-report counters and milestones for no-shop clears, flawless boss wins, 90-second boss wins, and spending 500 run gold.

## Phase 4 — Run Overview UI
- [x] Replace placeholder card with category tabs: Milestones, Bosses, Spellbook, Warband, Recent.
- [x] Show compact category summaries and partial progress labels for tracked milestone counters.
- [x] Move achievements entry into the Trophies & Unlocks header and keep the hub summary compact.
- [x] Pin 3 featured achievements on the hub overview.
- [x] Toast / celebration card when a new achievement unlocks after a run.
- [x] Let players spend run upgrade points freely on any permanent bonus without a run-level per-stat cap.

## Phase 5 — Reward Hooks
- [ ] Optional cosmetic titles for commander in run lobby.
- [ ] Optional run-start blessings unlocked by achievements (small meta bonuses only).
- [x] Export achievement summary to run completion report screen, including newly completed deeds and total claimable run XP.

## Phase 5B - Achievement-Driven Discovery
- [x] Split singleplayer spell ownership from multiplayer `User.knownSpellIds` without relocking existing players.
- [x] Replace the random permanent spell chance with deterministic achievement and boss rewards.
- [x] Add singleplayer-owned unlocked spell ids, unit blueprint ids, timestamps, sources, and idempotent migration state.
- [x] Gate 4 Tier I sidegrades, 8 Tier II units, and 8 Tier III specialists behind visible deeds.
- [x] Guarantee a newly unlocked spell or unit appears within the next two valid run offer nodes.
- [x] Keep run shops temporary: unlocking expands the future run pool instead of granting a complete build.

## Phase 6 — Database Readiness
- [x] Mirror achievement tables in `docs/database-deployment-plan.md`; the unapplied, idempotent migration is `supabase/migrations/008_singleplayer_progression.sql`.
- [x] API route stub: `app/api/singleplayer/achievements/route.ts`.
- [x] Leaderboard split: world-map boards vs run-only boards.

## Design Notes
- Achievements should never grant main-map gold, XP, or gear.
- Unlock feedback should use the existing `CompletionOverlay` report-card flow with `skipBurst`.
- Colorblind-safe badge colors should match combat indicator palette.

## Future Run Setup
- [x] Add interactive first-combat tutorial coaching for active unit wait, healer blessing, and the forced first commander spell cast.
- [x] Replace static commander selection with a forced four-choice randomized commander draft before each singleplayer run starts.
- [x] Add four run lengths with clear difficulty/reward scaling, including a five-fight quick road, with Long Road gated to run level 5.
- [x] Give each player-model commander an initial run-only stat passive identity: tank/templar, mage, healer, damage, skirmish, or durable mixed.
- [x] Add first commander unit-family synergies so commander choices buff matching run units.
- [ ] Add deeper commander special identities where useful: bleed, movement, sustain, or unique combat triggers.
- [x] Add first-run tutorial steps for commander choice, run length, and passive identity once these choices exist.
