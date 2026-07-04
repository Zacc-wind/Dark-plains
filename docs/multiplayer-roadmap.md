# Multiplayer Roadmap

## Goal
Turn the current shared world-map prototype into a real multiplayer layer without mixing it with singleplayer run progression. Multiplayer owns the persistent commander profile: world position, gear, gold, minions, quests, friends, parties, duels, trades, and cooperative dungeons.

## Current Baseline
- [x] Multiplayer mode exists at `/game`.
- [x] Singleplayer mode exists at `/singleplayer` with separate run progression.
- [x] Friends, friend requests, party invites, party membership, global chat, and party chat exist in local prototype state.
- [x] First-pass PVP challenge API route contracts exist.
- [ ] Challenge, trade, and party flows need polished in-game request popups and acceptance UX.
- [ ] Player-vs-player combat still needs a real two-player battle session model.
- [ ] Cooperative dungeon combat still needs multi-commander formation, turn order, and ownership rules.

## Phase 1: First-Login Mode Tutorial
- [x] Add a first-login mode tutorial before the user can choose Singleplayer or Multiplayer.
- [x] Ask whether the player wants the tutorial before explaining the modes.
- [x] Explain that Singleplayer and Multiplayer are separate games with separate progression.
- [x] Explain Singleplayer as roguelike runs: temporary army, run-only economy, permanent run-level progression, no world-map penalty.
- [x] Explain Multiplayer as shared world map: persistent commander, quests, gear, towns, players, parties, duels, trades, and co-op dungeons.

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

## Design Rules
- Singleplayer rewards and random-run resources never transfer into Multiplayer.
- Multiplayer gear, gold, quests, and minions never affect Singleplayer random-run balance.
- Every incoming social action should be readable as a cinematic popup first, then a compact notification if ignored.
- Co-op combat must prioritize clarity: owner names, active player highlight, and action permissions should be obvious before adding extra mechanics.
