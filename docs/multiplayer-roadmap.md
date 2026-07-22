# Multiplayer Roadmap

Detailed progression, chapter production, level-path, Chronicle, and retention execution now lives in `docs/progression-content-roadmap.md`. Enemy, equipment, quest-item, and generation prompts live in `docs/content-asset-generation-plan.md`. This file remains the source of truth for multiplayer sessions, social flows, combat ownership, and deployment readiness.

## Goal
Turn the current shared world-map prototype into a real multiplayer layer without mixing it with singleplayer run progression. Multiplayer owns the persistent commander profile: world position, gear, gold, minions, quests, friends, parties, duels, trades, and cooperative dungeons.

## Current Baseline
- [x] Multiplayer mode exists at `/game`.
- [x] Singleplayer mode exists at `/singleplayer` with separate run progression.
- [x] Friends, friend requests, party invites, party membership, and party chat exist in local prototype state. Global chat now reads and writes authenticated Supabase rows through `/api/chat` and retains the latest 50 messages.
- [x] First-pass PVP challenge API route contracts exist.
- [x] Supabase-backed profiles, presence, and online PVP challenge transport exist.
- [x] Main-story introductions can open as two-character RPG conversations on the world map.
- [x] Challenge, trade, and party flows have in-game request popups and acceptance UX in the local multiplayer prototype. Server-backed synchronization remains deployment work.
- [x] The Black Pike Ledger Chronicle pilot provides 20 permanent free-track ranks driven by capped, genuine multiplayer action receipts.
- [x] Player-vs-player combat has a versioned local two-player duel session with captured rosters, formation readiness, ownership-checked actions, timeout passing, and idempotent rating settlement. Database transport remains deployment work.
- [x] Cooperative raids now have a complete local-authoritative session: PVE launch/resume, two independent formations, readiness, synchronized combat and AI actions, four boss phases, abandon handling, recovery, and duplicate-safe per-player settlement. Database transport remains deployment work.
- [x] PVE intel exposes two deterministic co-op boss incursions per five-hour cycle without routing them through the solo encounter flow.
- [x] The playable Drowned Moonwell core spans levels 6-10 with nine ordered quests, eight Moonbridge contracts, a named Blackroot elite, Mother Cindervein, exact encounter receipts, and an authored return to Naima.

## Phase 1: First-Login Mode Tutorial
- [x] Add a first-login mode tutorial before the user can choose Singleplayer or Multiplayer.
- [x] Ask whether the player wants the tutorial before explaining the modes.
- [x] Explain that Singleplayer and Multiplayer are separate games with separate progression.
- [x] Explain Singleplayer as roguelike runs: temporary army, run-only economy, permanent run-level progression, no world-map penalty.
- [x] Explain Multiplayer as shared world map: persistent commander, quests, gear, towns, players, parties, duels, trades, and co-op dungeons.

## Phase 1B: Narrative World Onboarding
- [x] Replace the passive multiplayer tutorial card with an active two-character conversation: player commander on one side, story contact on the other.
- [x] Show the active speaker clearly and hand the player one concrete objective at the end of each conversation.
- [x] Repair the missing First Banner introduction so one absent sequence cannot block every later story scene.
- [x] Rework the opening chain into a guided path: complete a job, reach Harborview, meet Marshal Orren, win a first battle, reach Riverside, then face the Black Pike threat.
- [x] Reuse the same conversation stage when speaking to world quest contacts, with the NPC task and reward presented after the dialogue.
- [x] Add contextual focus states for the first Jobs menu, town travel action, enemy inspect action, formation confirmation, and battle result claim.
- [x] Add a journal page that can replay completed story conversations without replaying their rewards.
- [x] Add a single explicit Skip Onboarding action; skipping marks only tutorial introductions complete and never completes quest objectives.
- [x] Persist the exact active dialogue line server-side so a disconnected first-time player resumes cleanly.
- [x] Add persistent oathbound, pragmatic, and defiant player responses to selected story scenes. The chosen line changes tone, survives reload/journal replay, and never blocks core progression; reputation effects remain deferred.

## Phase 2: Social Request Popups
- [x] Add a shared `SocialRequestOverlay` component for incoming requests. Party invitations use it now; the typed contract already reserves trade requests for the validated trade session.
- [x] Challenge request popup: sword icon burst, challenger sprite/name, accept/decline buttons, timeout state.
- [x] Trade request popup: requester portrait/name, accept/decline buttons, timeout state, request sound, and direct handoff into a real `TradeSession`.
- [x] Party invite popup: banner/group presentation, leader name, party size, accept/decline buttons, outside/Escape dismissal, and timeout cleanup.
- [x] Add request sounds: challenge received, trade received, party invite received, accept, decline.
- [x] Store request state with ids, sender, receiver, createdAt, expiresAt, status, and payload.

## Phase 3: Party UI
- [x] Add a compact party strip to the main map HUD showing leader, members, pending invites, health/level, and location status.
- [x] Add a party details popover with promote leader, leave party, invite player, kick member, and party chat shortcut.
- [x] Show party members on the world map with a distinct but subtle frame/glow that does not collide with quest/enemy markers.
- [x] In duo raids, show party readiness and who has confirmed entry.
- [x] Add party state validation: max 4 players, one leader, no duplicate invites, no player in two parties.

## Phase 4: Player Duels
- [x] Add `PvpDuelSession` state: challenger, defender, acceptedAt, phase, seed, combat snapshot, result.
- [x] Build a duel formation screen for both players using their persistent commanders and selected fielded minions.
- [x] Use existing battle engine with two human-controlled sides instead of AI side control.
- [x] Add turn ownership: only the player who owns the active commander/unit can act.
- [x] Add timeout auto-wait/auto-pass so duels cannot stall forever.
- [x] Show opponent nickname over their commander in combat.
- [x] Add duel result screen with no random-run rewards; use agreed PVP rules only.
- [x] Add anti-grief checks: level gap warning, decline/cancel without penalty before combat, explicit forfeit after combat starts.

## Phase 5: Trading
- [x] Add versioned `TradeSession` state: initiator, receiver, offers, locks, accepted flags, expiry, completed/cancelled status.
- [x] Trade gold, non-quest inventory, and unequipped gear only; spells, minions, quest items, equipped gear, and singleplayer resources never enter the session.
- [x] Add a responsive two-column trade window with editable own offer, read-only opposing offer, lock invalidation, and separate final confirmation.
- [x] Validate live ownership, gold, equipped state, duplicate gear ids, and receiver gear capacity atomically at completion in the local authoritative action layer.
- [x] Add mirrored trade history and idempotent `trade-completed` engagement receipts for both players.

## Phase 6: Cooperative Dungeons
- [x] Add the first `coop` battle-state contract with two human commanders, owned units, one AI raid team, synchronized actions, and a 15-second timeout.
- [x] Add a dedicated 15x9 raid arena with separate deployment wings and five non-commander field slots per player.
- [x] Add a four-phase boss contract: full health on every phase transition, escalating attack/defense/magic, refreshed boss abilities, and high raid loot metadata.
- [x] Add two deterministic raid bosses per five-hour rotation and show them in PVE intel.
- [x] Add `CoopRaidSession` state: party id, two members, readiness, formations, shared combat revision, result, and claim receipts.
- [x] Build collaborative duo formation; each player places only their own five field units and confirms independently.
- [x] Add local idempotent raid settlement, per-player loot, reload recovery, and forfeit/abandon rules.
- [ ] Replace local co-op session transport with database subscriptions and server-authoritative action validation.
- [ ] Add map interaction only after party readiness can prevent the old solo encounter path from opening a raid.
- [ ] Add the longer `CoopDungeonSession`: party id, members, dungeon level, route nodes, bosses, shared seed, and current chamber.
- [ ] Dungeon levels scale from 1 to 15, with longer routes as level rises.
- [ ] Level 1 dungeons should be about 4-10 fights; high-level dungeons can reach around 30 fights with multiple bosses.
- [ ] Consider four-player veteran dungeons only after the duo raid is reliable; do not make the first session solve both scales.
- [x] Each player controls only their commander and owned units during combat.
- [x] Turn order interleaves commanders and units by morale/speed, with the active command owner named in the turn banner and command rail.
- [x] Show player nickname above each commander on the combat grid.
- [ ] Co-op dungeons should have more hard roads, stronger enemy formations, and boss mechanics tuned for multiple commanders.

## Phase 6B: Multiplayer UI Simplification
- [x] Remove full-screen world-popup blur and replace the semi-opaque scroll asset with a transparent-edge derivative.
- [x] Use the scroll frame as an outer shell for map commands, Campaign, Progression, PVP, PVE, town services, HUD resources, quest tracking, and dramatic confirmations.
- [x] Keep dense lists as compact dark interiors inside the frame; do not texture every row or card as parchment.
- [x] Keep the world-map command rail focused on Menu, Chat, Campaign, PVP, and PVE.
- [x] Keep Commander, Gear, and Army inside Menu beside Overview, Jobs, Spells, Social, and Settings; keep Chat independent.
- [x] Show active city and daily orders under the main quest tracker with one direct route to Orders.
- [x] Sort multiplayer formation and run rosters by tier, class, or name while leaving singleplayer roster behavior unchanged.
- [x] Add a bottom-right retreat action and confirmation to both singleplayer and multiplayer run maps.
- [x] Recompose each town service into a concise service header, primary action, price/reward row, and inventory/result list; remove repeated explanatory paragraphs.
- [x] Restyle the spell archive with stable fantasy cards and internal scrolling so names and mana/target metadata never overlap.
- [x] Split the map quest ledger into Story and Daily tabs with direct daily claims, and add a shared bard music controller to map and run surfaces.
- [x] Finish visual QA at 1920x1080, 2560x1440, 3840x2160, and 390x844 after all shell conversions settle.

## Phase 6C: Economy And Recruitment Balance
- [x] Replace 20-second/1-minute/5-minute/15-minute jobs with 1-minute/10-minute/30-minute/1-hour jobs.
- [x] Reduce baseline job gold and XP to 30 percent of the previous values; rare gems are available only on the one-hour tier.
- [x] Move random gear thresholds to 10/30/60 minutes, roll drop chance before rarity, and keep the best rarity odds on the longest job.
- [x] Tune campaign rewards so a normal chapter step grants no more than about 80 percent of the intended level requirement.
- [x] Add level-band reward curves for jobs, contracts, PVE, PVP, and co-op so later levels remain useful without trivializing early progression.
- [x] Restrict town recruitment to one deterministic weekly Tier I offer in every town, with weekly Tier II specialist slots in Harborview and Riverside from level 4; Tier III acquisition begins at level 7.
- [x] Make daily, weekly, story, and Chronicle milestones the reliable unit sources; remove random unit rewards from city contracts and rotating town stock.
- [x] Add authored multiplayer achievement unit rewards; Chronicle milestone ranks 5/10/15/20 now grant fixed sidegrade and specialist units while random job recruitment stays uncommon.
- [x] Cap direct player spell damage against boss commanders at 18 percent of max health, and at 10 percent in four-phase co-op raids.
- [x] Gate decent, rare, epic, and legendary equipment at levels 3, 5, 10, and 15 and halve healing from the third successful heal on one battle unit.

## Phase 7: Multiplayer Combat Engine Refactor
- [ ] Generalize battle sides from `player` vs `enemy` into combat teams with ownership metadata.
- [x] Add `ownerUsername` and `teamId` to commanders and units while preserving legacy side rendering.
- [x] Keep AI only for NPC-owned units; human-owned units wait for that player input.
- [x] Make BattleModal capable of controlled and read-only states when the local player does not own the active unit.
- [x] Add revisioned action synchronization hooks with action receipts so database-backed play can replace local prototype storage later.

## Phase 8: Database Readiness
- [x] Mirror friends, parties, chat, challenges, trades, duel sessions, and co-op dungeon sessions in the database plan and migration `007_multiplayer_sessions.sql`.
- [x] Add optimistic-lock version fields to trade, duel, and dungeon session tables.
- [x] Add participant-only RLS reads and reserve multiplayer session writes for trusted server handlers.
- [ ] Add server-side validation for trade completion and combat actions before deployment.

## Phase 9: Progression Gates And Unlock Communication
- [x] Define one shared unlock registry consumed by HUD buttons, modal guards, API routes, and tutorial copy.
- [x] Level 1: jobs, towns, story quests, NPC encounters, inventory, and basic army management.
- [x] Level 2: city contracts, gear upgrades, and the first dungeon preview.
- [x] Level 3: PVP hub and duel challenges unlock with a short rules conversation backed by the shared gate and API enforcement.
- [x] Level 4: trading unlocks after inventory and value are explained.
- [x] Level 5: party creation and cooperative dungeon readiness unlock with an authored briefing and a guarded two-player raid entry.
- [x] Level 7: Dungeon Tier II entry is enforced by the shared unlock registry and shown on map/PVE dungeon previews; level 12+ Tier III roads require level 16.
- [ ] Later levels unlock harder regions, additional city services, dungeon tiers, boss rotations, and advanced social objectives.
- [ ] Enforce every gate on the server as well as the client; a hidden button is not an authorization rule.
- [x] Show locked features in a compact preview with level requirement and one-sentence value, rather than silently hiding the feature.

## Phase 10: Daily And Weekly Reasons To Return
- [x] Add a three-slot daily contract board: one combat task, one world/job task, and one social or co-op task. Allow one reroll per day.
- [x] Add a rotating regional threat that changes enemy composition and culminates in a deterministic weekly named boss target.
- [x] Add a weekly faction oath with several contribution paths so combat, jobs, trade, and co-op players can all progress it.
- [x] Add duplicate-safe daily first-win and first-dungeon-clear bonuses with moderate gold/XP rewards and genuine receipt requirements.
- [x] Add a seven-day return track with a missed-day buffer and no exclusive combat power.
- [x] Add a returning-player briefing after several inactive days: current threats, unfinished story objective, party activity, and one catch-up contract.
- [x] Add capped rested job XP or contract progress so returning players can catch up without making daily players irrelevant. Returning players receive at most three +25% job-XP charges, each capped at 50 XP.
- [x] Record completion telemetry for each loop before increasing reward volume or adding more currencies.

## Phase 11: Story Chapters And World Direction
- [ ] Give every main-story chapter a named guide, a regional conflict, a midpoint fight, and a boss resolution.
- [ ] Keep each quest objective explicit about the target, location, action, and reward source.
- [ ] Use quest contacts for authored dialogue; use compact objective cards for routine contracts.
- [x] Add visible chapter progress, guides, capstones, and replayable conversations to the Campaign view without covering the world map.
- [ ] Add faction reputation only after at least two factions have distinct rewards and repeatable activities.
- [ ] Let completed chapters change small world details, NPC lines, or available contracts without deleting required contacts.
- [ ] Build level-band content in batches: 1-5 onboarding, 6-10 regional mastery, 11-15 veteran systems, then expand the cap only with enough enemies and bosses.
- [x] Ship the playable core of the 6-10 Drowned Moonwell band with its guide pair, explicit objectives, named elite, capstone, return scene, and Moonbridge board.

## Phase 12: Multiplayer Scaling And Endgame
- [ ] Scale NPC formations by player level band, party size, equipment score, and encounter type; never scale directly to every temporary combat spike.
- [x] Add Easy, Fair, Hard, and Deadly scout labels based on commander, gear, spell, and formation pressure rather than level alone.
- [ ] Add veteran dungeon modifiers, rotating boss abilities, and optional hard paths before raising raw health totals.
- [ ] Add seasonal PVP rating resets with cosmetic/status rewards and placement protection for new level-3 players.
- [ ] Add party and guild goals only after party sessions, chat moderation, and reward validation are reliable.
- [ ] Keep permanent power sources limited and legible; new systems should expand build choice more often than they increase every stat.

## Design Rules
- Singleplayer rewards and random-run resources never transfer into Multiplayer.
- Multiplayer gear, gold, quests, and minions never affect Singleplayer random-run balance.
- Every incoming social action should be readable as a cinematic popup first, then a compact notification if ignored.
- Co-op combat must prioritize clarity: owner names, active player highlight, and action permissions should be obvious before adding extra mechanics.

## Recommended Implementation Order
1. [x] Add the shared genuine-action event foundation and Campaign/Progression shell described in `docs/progression-content-roadmap.md`.
2. [x] Finish the level 1-5 First Banner chapter, Black Pike capstone, and level 3/4/5 unlock conversations.
3. [x] Complete the shared request lifecycle and party invite overlay, then add the first regional threat and rested catch-up rules.
4. [x] Implement the validated local `TradeSession`, request popup, and first-win/first-dungeon-clear bonuses.
5. [x] Pilot the free Black Pike Ledger Chronicle using only implemented and validated activities.
6. [x] Complete local multiplayer sessions: duel ownership/synchronization and duo raid readiness, formation, combat, recovery, abandon, and settlement are implemented.
7. [x] Finish the concise town-service pass and verify the new scroll-shell composition at all target viewports.
8. [ ] Move duel, trade, and co-op session transport and validation to Supabase.
9. [x] Ship the playable levels 6-10 Drowned Moonwell core with exact story encounters, response choices, Moonbridge contracts, and Dungeon Tier II gating.
10. [ ] Complete its two side-story chains, bespoke enemy/item art, reputation prerequisites, and visible post-chapter world response.
11. [ ] Produce levels 11-30 as complete five-level content bands, one chapter at a time.
