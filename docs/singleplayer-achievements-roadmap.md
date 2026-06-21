# Singleplayer Run Achievements & Unlocks Roadmap

## Goal
Build a dedicated singleplayer progression layer on top of random runs, separate from multiplayer world-map progress (`User` profile vs `User.dailyRun`).

## Progress Separation (implemented)
- **Multiplayer** (`/game`): map position, army, quests, gold, XP, social, dungeons/encounters on the world map.
- **Singleplayer** (`/singleplayer`): run level, permanent run bonuses, run history, active run session, future achievements.
- Mode choice stored in `wizardy_game_mode` via `lib/gameMode.ts`.

## Phase 1 — Run Overview Foundation
- [x] Post-login mode select screen with city backdrop.
- [x] First-login mode tutorial explains that Singleplayer and Multiplayer are separate progression tracks before choosing a mode.
- [x] Singleplayer Run Hall hub with run overview, ledger, and start/resume run.
- [x] Settings panel copy in singleplayer hub.
- [x] Retreat / run close returns to singleplayer hub instead of world map.
- [x] Remove random-run launcher from multiplayer command center and overview.
- [x] Add boss8-led first-run tutorial overlays for singleplayer lobby, draft, map, formation, combat, reward, shop, and omen phases.

## Phase 2 — Achievement Data Model
- [ ] Add `RunAchievementState` on `User.dailyRun` or a sibling `singleplayerProfile` object.
- [ ] Track unlock timestamps, tier, and display metadata per achievement id.
- [ ] Persist boss-first-kill flags, streak milestones, and spell unlock gallery entries.
- [ ] Migration helper in `lib/auth.ts` `normalizeDailyRunState()` for older saves.

## Phase 3 — Achievement Catalog
- [ ] Define static catalog in `lib/runAchievements.ts` with categories:
  - **Road**: first clear, hard-route clear, no-shop clear, full-streak clear.
  - **Boss**: first kill per boss id, flawless boss (no injuries), speed thresholds.
  - **Army**: recruit every class, promote to tier 3, finish with 7 living units.
  - **Economy**: spend 500 run gold in one run, buy 3 shop items, claim 5 omens.
  - **Meta**: reach run level 5/10/15, 10 lifetime clears, 5-win streak.
- [ ] Wire unlock checks into `RoguelikeRunModal` completion, shop buy, omen resolve, and boss defeat hooks.

## Phase 4 — Run Overview UI
- [ ] Replace placeholder card with category tabs: Milestones, Bosses, Unlocks, Recent.
- [ ] Show locked vs unlocked art, progress bars for partial achievements.
- [ ] Pin 3 featured achievements on the hub hero row.
- [ ] Toast / celebration card when a new achievement unlocks after a run.

## Phase 5 — Reward Hooks
- [ ] Optional cosmetic titles for commander in run lobby.
- [ ] Optional run-start blessings unlocked by achievements (small meta bonuses only).
- [ ] Export achievement summary to run completion report screen.

## Phase 6 — Database Readiness
- [ ] Mirror achievement tables in `docs/database-deployment-plan.md`.
- [ ] API route stub: `app/api/singleplayer/achievements/route.ts`.
- [ ] Leaderboard split: world-map boards vs run-only boards.

## Design Notes
- Achievements should never grant main-map gold, XP, or gear.
- Unlock feedback should use the existing `CompletionOverlay` report-card flow with `skipBurst`.
- Colorblind-safe badge colors should match combat indicator palette.

## Future Run Setup
- [x] Add interactive first-combat tutorial coaching for active unit wait, healer blessing, and the forced first commander spell cast.
- [ ] Add commander selection before a singleplayer run starts.
- [ ] Add three run lengths with clear difficulty/reward scaling.
- [ ] Give each player-model commander a distinct run-only passive or special identity: tank/templar, mage, healer, bleed, movement, sustain, or damage.
- [ ] Add first-run tutorial steps for commander choice, run length, and passive identity once these choices exist.
