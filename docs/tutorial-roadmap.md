# Tutorial Roadmap

Singleplayer and multiplayer keep separate onboarding because their economies and progression rules are separate. They share visual language, but not tutorial state or objectives.

## Singleplayer Current Coverage

- [x] Persist tutorial progress per account and sync it through the existing account tutorial payload.
- [x] Let players enable, disable, skip, and reset the guide from Settings.
- [x] Skip cinematic tutorial overlays on touch and phone layouts.
- [x] Explain mode selection before the first Singleplayer or Multiplayer choice.
- [x] Cover all nine singleplayer run checkpoints: lobby, setup, draft, route map, formation, combat, blessing, shop, and omen.
- [x] Use the Grave-Crowned Emperor as the consistent guide with the selected commander opposite him.
- [x] Highlight route node types in place instead of relying only on dialog text.
- [x] Force the first commander spell flow with Ember Dart available.
- [x] Teach the active-unit Wait orb and priest blessing setup.
- [x] Require a real blessing choice and a real first shop purchase before those lessons complete.
- [x] Highlight a valid attack target and require the player to hold its damage and retaliation forecast open.
- [x] Keep a battle-end completion fallback so unusual turn order or roster composition cannot trap the run.

## Next Tutorial Work

- [x] Add a first movement callout that highlights legal destinations and explains terrain movement costs.
- [x] Add an attack confirmation callout after the damage forecast has been read.
- [x] Explain positional guard versus class-specific Wait actions without presenting ordinary Wait as a hidden defense buff.
- [x] Require one movement undo and one spell cancel/reselection before those lessons complete.
- [x] Add a later commander lesson for intentionally saving mana instead of only focusing when mana is insufficient.
- [x] Add a compact first-gear and first-unit-upgrade explanation when those rewards first appear.
- [x] Add automated progression tests that reset a tutorial account and verify every checkpoint can complete in order.

## Multiplayer Current Coverage

- [x] Explain the mode split before the player enters the shared world.
- [x] Present story introductions as an RPG conversation between the selected player commander and a named world contact.
- [x] Focus the active speaker, advance one line at a time, and end with an explicit objective card.
- [x] Connect the first six conversations to real quest state: first job, Harborview, Marshal Orren, first fight, Riverside, and Black Pike.
- [x] Reuse the same conversation scene for quest NPC counsel.
- [x] Skip a missing authored sequence safely instead of blocking every later story introduction.

## Multiplayer Next Tutorial Work

- [x] Spotlight the Jobs button during First Banner and complete the lesson only after a real job starts.
- [x] Spotlight Harborview and the travel action during The Candle Road.
- [ ] Highlight Marshal Orren's quest marker and explain why story contacts can return after earlier quests.
- [x] Highlight enemy level, risk label, formation entry, and commander-loss rule before the first world battle.
- [x] Add a compact post-battle explanation of reports, wounded/dead persistent units, and reward claims.
- [ ] Add the level-3 PVP unlock conversation before the PVP hub becomes interactive.
- [ ] Add first-use conversations for gear upgrades, trade, party creation, and cooperative dungeon readiness.
- [x] Add a journal replay list and a single Skip Multiplayer Onboarding action that never grants progress or rewards.
- [x] Persist active dialogue line and tutorial callout state through Supabase account state.
- [ ] Add automated opening-chain tests for a fresh account and a returning partially completed account.

## Verification Matrix

- Desktop 1920x1080: every overlay remains above the current screen without changing layout dimensions.
- Desktop 2560x1440 and 3840x2160: guide art and coach text stay readable without covering the primary action.
- Touch or viewport at 820px and below: tutorial is skipped and gameplay remains usable.
- Reload during a run: completed checkpoints stay complete; unfinished interaction lessons return safely.
- Reduced motion: tutorial information remains visible while pulses and entrance animations are disabled.
- Multiplayer fresh account: First Banner opens once, every accepted objective remains actionable, and no missing sequence can block later quests.
- Multiplayer returning account: completed dialogue does not replay automatically; incomplete quest direction remains visible in the main quest tracker.
