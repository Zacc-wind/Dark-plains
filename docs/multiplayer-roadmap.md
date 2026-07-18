# Multiplayer Roadmap

## Goal
Turn the current shared world-map prototype into a real multiplayer layer without mixing it with singleplayer run progression. Multiplayer owns the persistent commander profile: world position, gear, gold, minions, quests, friends, parties, duels, trades, and cooperative dungeons.

## Current Baseline
- [x] Multiplayer mode exists at `/game`.
- [x] Singleplayer mode exists at `/singleplayer` with separate run progression.
- [x] Friends, friend requests, party invites, party membership, global chat, and party chat exist in local prototype state.
- [x] First-pass PVP challenge API route contracts exist.
- [x] Supabase-backed profiles, presence, and online PVP challenge transport exist.
- [x] Main-story introductions can open as two-character RPG conversations on the world map.
- [ ] Challenge, trade, and party flows need polished in-game request popups and acceptance UX.
- [ ] Player-vs-player combat still needs a real two-player battle session model.
- [ ] Cooperative dungeon combat still needs multi-commander formation, turn order, and ownership rules.

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
- [ ] Add authored player response choices to selected story scenes; choices may change tone or faction reputation but must not silently block core progression.

## Phase 2: Social Request Popups
- [ ] Add a shared `SocialRequestOverlay` component for incoming requests.
- [x] Challenge request popup: sword icon burst, challenger sprite/name, accept/decline buttons, timeout state.
- [ ] Trade request popup: gold icon burst, requester sprite/name, accept/decline buttons, timeout state.
- [ ] Party invite popup: banner/group icon burst, leader name, party member preview, accept/decline buttons.
- [ ] Add request sounds: challenge received, trade received, party invite received, accept, decline.
- [ ] Store request state with ids, sender, receiver, createdAt, expiresAt, status, and payload.

## Phase 3: Party UI
- [x] Add a compact party strip to the main map HUD showing leader, members, pending invites, health/level, and location status.
- [x] Add a party details popover with promote leader, leave party, invite player, kick member, and party chat shortcut.
- [ ] Show party members on the world map with a distinct but subtle frame/glow that does not collide with quest/enemy markers.
- [ ] In dungeons, show party readiness and who has confirmed entry.
- [x] Add party state validation: max 4 players, one leader, no duplicate invites, no player in two parties.

## Phase 4: Player Duels
- [ ] Add `PvpDuelSession` state: challenger, defender, acceptedAt, phase, seed, combat snapshot, result.
- [ ] Build a duel formation screen for both players using their persistent commanders and selected fielded minions.
- [ ] Use existing battle engine with two human-controlled sides instead of AI side control.
- [ ] Add turn ownership: only the player who owns the active commander/unit can act.
- [ ] Add timeout auto-wait/auto-pass so duels cannot stall forever.
- [ ] Show opponent nickname over their commander in combat.
- [ ] Add duel result screen with no random-run rewards; use agreed PVP rules only.
- [ ] Add anti-grief checks: level gap warning, safe zones if needed, decline without penalty.

## Phase 5: Trading
- [ ] Add `TradeSession` state: initiator, receiver, offers, locks, accepted flags, completed/cancelled.
- [ ] Trade gold and allowed inventory/gear only; never trade singleplayer run resources.
- [ ] Add two-column trade window with both players' offers, lock state, and final accept confirmation.
- [ ] Validate ownership at completion so stale local state cannot duplicate items.
- [ ] Add trade history activity entries for both players.

## Phase 6: Cooperative Dungeons
- [ ] Add `CoopDungeonSession` state: party id, members, dungeon level, route nodes, bosses, shared seed, current chamber.
- [ ] Dungeon levels scale from 1 to 15, with longer routes as level rises.
- [ ] Level 1 dungeons should be about 4-10 fights; high-level dungeons can reach around 30 fights with multiple bosses.
- [ ] Co-op formation supports up to 4 commanders.
- [ ] Total fielded non-commander unit cap is 8 across the party.
- [ ] Formation draft is collaborative: players place their own units one by one until the shared cap is filled.
- [ ] Each player controls only their commander and owned units during combat.
- [ ] Turn order interleaves commanders and units normally, but the UI must clearly show whose turn it is.
- [ ] Show player nickname above each commander on the combat grid.
- [ ] Co-op dungeons should have more hard roads, stronger enemy formations, and boss mechanics tuned for multiple commanders.

## Phase 7: Multiplayer Combat Engine Refactor
- [ ] Generalize battle sides from `player` vs `enemy` into combat teams with ownership metadata.
- [ ] Add `ownerUsername` to commanders and units.
- [ ] Keep AI only for NPC-owned units; human-owned units wait for that player input.
- [ ] Make BattleModal capable of read-only spectator state for party members when it is not their turn.
- [ ] Add action synchronization hooks so browser/database-backed play can replace local prototype state later.

## Phase 8: Database Readiness
- [ ] Mirror friends, parties, chat, challenges, trades, duel sessions, and co-op dungeon sessions in the database plan.
- [ ] Add optimistic-lock version fields to trade, duel, and dungeon session tables.
- [ ] Add RLS rules so players can read only sessions they participate in.
- [ ] Add server-side validation for trade completion and combat actions before deployment.

## Phase 9: Progression Gates And Unlock Communication
- [ ] Define one shared unlock registry consumed by HUD buttons, modal guards, API routes, and tutorial copy.
- [ ] Level 1: jobs, towns, story quests, NPC encounters, inventory, and basic army management.
- [ ] Level 2: city contracts, gear upgrades, and the first dungeon preview.
- [ ] Level 3: PVP hub and duel challenges unlock with a short rules conversation.
- [ ] Level 4: trading unlocks after inventory and value are explained.
- [ ] Level 5: party creation and cooperative dungeon entry unlock.
- [ ] Later levels unlock harder regions, additional city services, dungeon tiers, boss rotations, and advanced social objectives.
- [ ] Enforce every gate on the server as well as the client; a hidden button is not an authorization rule.
- [ ] Show locked features in a compact preview with level requirement and one-sentence value, rather than silently hiding the feature.

## Phase 10: Daily And Weekly Reasons To Return
- [ ] Add a three-slot daily contract board: one combat task, one world/job task, and one social or co-op task. Allow one reroll per day.
- [ ] Add a rotating regional threat that changes enemy composition and culminates in a shared boss target.
- [ ] Add a weekly faction oath with several contribution paths so combat, jobs, trade, and co-op players can all progress it.
- [ ] Add first-win and first-dungeon-clear bonuses with moderate rewards; avoid mandatory multi-hour streak pressure.
- [ ] Add a seven-day return track with a missed-day buffer and no exclusive combat power.
- [ ] Add a returning-player briefing after several inactive days: current threats, unfinished story objective, party activity, and one catch-up contract.
- [ ] Add capped rested job XP or contract progress so returning players can catch up without making daily players irrelevant.
- [ ] Record completion telemetry for each loop before increasing reward volume or adding more currencies.

## Phase 11: Story Chapters And World Direction
- [ ] Give every main-story chapter a named guide, a regional conflict, a midpoint fight, and a boss resolution.
- [ ] Keep each quest objective explicit about the target, location, action, and reward source.
- [ ] Use quest contacts for authored dialogue; use compact objective cards for routine contracts.
- [ ] Add visible chapter progress to the quest journal without covering the world map.
- [ ] Add faction reputation only after at least two factions have distinct rewards and repeatable activities.
- [ ] Let completed chapters change small world details, NPC lines, or available contracts without deleting required contacts.
- [ ] Build level-band content in batches: 1-5 onboarding, 6-10 regional mastery, 11-15 veteran systems, then expand the cap only with enough enemies and bosses.

## Phase 12: Multiplayer Scaling And Endgame
- [ ] Scale NPC formations by player level band, party size, equipment score, and encounter type; never scale directly to every temporary combat spike.
- [ ] Add difficulty labels based on predicted formation pressure rather than level alone.
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
1. Finish contextual onboarding spotlights, tutorial replay/skip controls, and journal integration for the implemented opening story chain.
2. Build the shared unlock registry and apply the level gates consistently to the HUD, modals, and server-side actions.
3. Complete the shared social-request overlay for trade and party invites, including expiry and duplicate-request handling.
4. Add the first daily contract board and returning-player briefing using existing jobs, encounters, and quest state.
5. Refactor battle ownership and synchronization before implementing the first real player-versus-player duel session.
