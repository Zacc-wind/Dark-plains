# Progression and Content Roadmap

Updated: 2026-08-09

## Purpose

Turn the existing systems into two coherent reasons to keep playing:

- Multiplayer is a persistent world campaign with level unlocks, authored chapters, rotating objectives, social play, bosses, and a non-expiring seasonal Chronicle.
- Singleplayer is a replayable roguelike where permanent progression expands future build choices through run levels, achievements, boss trophies, and collection discovery.

This document is the execution plan for progression, retention, narrative content, and their UI. The detailed combat, social-session, tutorial, database, and map plans remain in their existing roadmap files.

## Audited Baseline

### Multiplayer

- The level cap is 30.
- The shared unlock registry already covers the level 1 core, level 2 contracts/forge/PVE, level 3 PVP, level 4 trading, level 5 parties/co-op, and level 6 veteran regions.
- Daily contracts, a weekly oath, a seven-day return track, returning-player briefing, and engagement telemetry already exist.
- The internal Black Pike Ledger now provides a persistent 40-rank free Chronicle with capped genuine-action Renown, duplicate-safe claims, modest resources, lore, banners, frames, and titles. Archive/featured rotation remains later.
- There are 37 main-story quest definitions across the two existing acts, grouped into six five-level campaign bands.
- 25 story quests have authored dialogue ids. The complete First Banner opening and Drowned Moonwell core both use authored scenes.
- Levels 1-5 form a playable opening chapter. Levels 6-10 now add nine ordered Moonwell objectives, a named Blackroot elite, Mother Cindervein, a post-boss return, two three-step side stories, post-chapter NPC/contract response, and persistent three-tone player responses.
- Levels 11-15 now form The Broken Crown: Yara and Serat guides, Blackwater Gate march, Iron Choir Marshal midpoint, and Emperor Grave-Aurel with exact enemy receipts.
- Levels 16-20 now form The Glass Road: Serat and Sable guides, Mirror Road Captain elite, Prior Moon Voss capstone, return seal, and eight Blackwater/Eclipse contracts each.
- Levels 21-25 now form The Candle Key: Kaito guide, Ser Kael elite, fragment gather, Key-Saint Ardan, and return seal.
- Levels 26-30 now form The Lady In Glass: Letho guide, Scarlet Matron elite, Lady Mirror-Veyra inspect/defeat, and court seal return.
- There are 49 city contracts. Harborview, Riverside, Ashford, Blackwater Gate, and Eclipse Hold own 8 each; Moonbridge owns 9 (including the eastern-march preview after Moonwell seal).
- Levels 16-30 now include three later-band side stories (Ash Pilgrim, Forged Writs, Synod Bell) outside Moonwell, with named elites and return NPCs.
- There are 8 boss profiles, 24 unit templates, and 20 commander spells.
- Campaign, Level Path, Chronicle, named threat markers, and the quest tracker expose the active chapter, next unlock, exact target, and long-term collection track. Bespoke level 6-10 enemy/item art remains production work.

### Singleplayer

- Run level, permanent stat spending, run lengths, run history, achievements, commander draft, route choices, bosses, shops, omens, and temporary spell learning already exist.
- The unit catalog is evenly split into 8 Tier I, 8 Tier II, and 8 Tier III templates.
- Four spells are the current starter set and 16 additional spells exist.
- Milestones currently observe many accomplishments and award run XP, but most do not unlock build content.
- A daily run has a 1 percent random chance to permanently unlock an unknown spell.
- Singleplayer currently seeds its run spell pool from the account-level `User.knownSpellIds`. That field also belongs to multiplayer progression, so this is a separation issue that must be migrated before achievement-driven discovery is implemented.

## Product Rules

1. Multiplayer and singleplayer ownership remain separate even when they reuse the same spell, unit, boss, or art definition.
2. A level unlock opens a system or content band. It should not merely add a hidden stat.
3. An achievement unlock expands future choices. It does not need to hand the player an overpowered item immediately.
4. Multiplayer story, boss, and reputation rewards may grant persistent combat options. The Chronicle grants cosmetics, status, lore, and modest catch-up resources, never exclusive combat power.
5. Singleplayer shops sell temporary run choices. They do not randomly sell permanent ownership.
6. Every locked item shows its exact requirement and current progress. Do not hide the catalog to manufacture mystery.
7. Every objective advances from a genuine gameplay event. Opening a menu, refreshing a page, or polling an old counter cannot fake completion.
8. Do not add a currency when a progress counter works. Chronicle Renown is a track value, not a wallet.
9. Missed days must slow progress at most; they must not permanently remove gameplay content.
10. Add content in complete level bands. Do not raise the cap until the preceding band has quests, enemies, a boss, town use, and rewards.

## Core Loop Hierarchy

| Horizon | Multiplayer promise | Singleplayer promise |
| --- | --- | --- |
| Next action | One explicit story, contract, job, battle, or travel objective | One route node and a visible build decision |
| Session | 20-40 minutes to complete an order, improve the army, and advance a chapter | Finish or materially advance one selected road |
| Daily | Three optional orders with one reroll | Optional daily seed and personal record attempt |
| Weekly | One oath with several contribution paths and one rotating threat | Weekly challenge ruleset with run XP and a cosmetic record |
| Chapter | Five player levels, a named conflict, midpoint encounter, and boss resolution | Boss and feat sets that unlock new draft-pool options |
| Long term | Level path, collections, parties, PVP/co-op, and archived Chronicles | Run levels, spellbook discovery, unit blueprints, blessings, titles, and records |

## Shared UI Direction

Multiplayer uses the gothic scroll as a recognizable outer frame for map commands, town services, Campaign, Progression, PVP, PVE, the HUD resource bar, quest tracking, tutorials, story conversations, the formation spellbook, and dramatic confirmations. Dense lists remain compact dark operational interiors inside that frame; individual rows and cards do not become parchment. The transparent-edge asset, no-blur overlay rule, and aspect-safe frame prevent black corners, stretched artwork, and expensive full-screen blur.

The world-map command rail stays focused on `Menu`, `Chat`, `Campaign`, `PVP`, and `PVE`. `Commander`, `Gear`, and `Army` live inside Menu beside Overview, Jobs, Spells, Social, and Settings. The map ledger separates Story and Daily tabs, keeps city contracts with Story, and allows completed daily orders to be claimed in place.

### Multiplayer Campaign And Progression

The map HUD `Campaign` command opens a large responsive modal. Four tabs are implemented and a fifth remains planned:

1. `Orders`: active main objective, three daily contracts, weekly oath, regional threat, and returning briefing.
2. `Campaign`: six chapter rows with guide, conflict, quest progress, midpoint, boss, rewards, and replayable conversations.
3. `Chronicle`: the featured 40-rank Black Pike Ledger, challenge sources, claim states, and permanent honor collection. Archives remain later work.
4. `Level Path`: levels 1-30, claimed rewards, next three unlocks, and a direct link to the newly opened feature.
5. `Deeds`: multiplayer achievements, boss trophies, titles, cosmetic collection, and account records.

The first view always answers three questions without scrolling: what should I do now, what unlocks next, and what can I claim?

### Singleplayer Run Archive

Expand the current Trophies & Unlocks surface into five tabs:

1. `Overview`: run level, permanent bonuses, featured objective, latest record, and next unlock.
2. `Spellbook`: 20 spell entries with unlocked/locked state, requirement, progress, and run-pool explanation.
3. `Warband`: 24 unit blueprints grouped by tier and class.
4. `Deeds`: boss, route, army, spell, economy, and challenge achievements.
5. `Records`: run history, best streaks, bosses, route lengths, and personal bests.

Locked entries use readable silhouettes plus the requirement. Newly unlocked entries get a one-time highlight and a guaranteed discovery opportunity in a future run.

### Interaction Requirements

- Full keyboard navigation, visible focus, focus containment in modals, Escape and close-button dismissal.
- Mobile layout becomes a full-screen tab surface with sticky tab and claim bars.
- No nested cards, browser scrollbar shifts, full-screen blur, or parchment behind dense lists.
- A level-up or major unlock may use the existing completion overlay, then deep-link to the relevant tab.
- Claim operations are idempotent and remain claimed after reload.

## Multiplayer Content Structure

### Reframe Two Acts Into Six Chapters

Keep the existing quest ids and two major arcs where possible. Add chapter grouping metadata so save compatibility is not dependent on renaming old ids.

| Act | Chapter | Levels | Main conflict | Capstone |
| --- | --- | --- | --- | --- |
| The Eclipsed Banner | I. The First Banner | 1-5 | A new commander is tested while the Black Pike taxes the western road | Defeat the Black Pike lieutenant and earn Orren's recognition |
| The Eclipsed Banner | II. The Drowned Moonwell | 6-10 | Moonwell recruitment, candle cults, and the first regional breach | Mother Cindervein |
| The Eclipsed Banner | III. The Broken Crown | 11-15 | The eastern march and Grave-Aurel's iron choir | Emperor Grave-Aurel |
| The Mirror Court | IV. The Glass Road | 16-20 | Mirror scouts rewrite the roads and open the ossuaries | Prior Moon Voss |
| The Mirror Court | V. The Candle Key | 21-25 | Rival factions race to assemble the key to the court | Key-Saint Ardan |
| The Mirror Court | VI. The Lady In Glass | 26-30 | The court reflects the player's old victories back as veteran armies | Lady Mirror Veyra |

Use Ser Kael Duskplate, Blackroot Vessel, and Scarlet Matron Yvane as rotating regional bosses rather than spending every existing boss on a chapter finale.

### Narrative Spine And Factions

The current 44 city contracts use many local faction labels. Keep those names as local orders, guilds, and religious houses, but group progression under five powers the player can remember:

| Umbrella power | Included groups | Story role |
| --- | --- | --- |
| Candle Compact | Candlewardens, Hospitaller Lanterns, Salt Chapel, Candle Synod | Protects the western road but distrusts independent commanders |
| River Concord | Star Lawkeepers, Bridge Bell Monks, River Shrine, River Council, Lotus Scriptorium | Controls records, bridges, tolls, and the lawful eastern route |
| Ashen Orders | Ash Rite, Iron Yard, Road Pilgrims, Abbey Masons, mountain hermits | Preserves king-magic and dangerous oath traditions outside town law |
| Blackwater League | Blackwater Syndicate, Relic Weighers, Gate Watch, Ossuary Order | Trades in relics, contracts, dungeon access, and morally gray information |
| Mirror Court | Moon Court, Glass Reliquary, Eclipse Tribunal, Moon Observers | Converts memory, reflection, and old victories into control of the roads |

Only the Candle Compact and Blackwater League receive reputation tracks first, after both have repeatable work and distinct rewards. The other powers remain story affiliations until they meet that requirement.

Give the existing cast stable jobs across the campaign:

- Sister Avel is the emotional anchor and explains the cost of command.
- Marshal Orren is the early military guide and owner of the Black Pike conflict.
- Scribe Naima represents law, contracts, and the River Concord.
- Brother Kaito owns bell, bridge, and Candle Key mysteries.
- Ash Hermit Yara teaches king-magic, mana restraint, omens, and dangerous power.
- Veil Captain Serat scouts the Broken Crown and exposes the Mirror Court threat.
- Gate Warden Sable is the player's practical Blackwater contact and faction counterweight.
- Archivist Letho begins as an enemy scribe and becomes the ambiguous guide inside the Mirror Court.

Each chapter names one primary guide and one countervoice. This keeps the cast recurring and lets player response tone matter without branching the core campaign into unmaintainable paths.

### Chapter Production Contract

Every five-level chapter ships as one complete batch:

- 7-9 main quests with no empty level stretch longer than one level.
- At least 4 authored conversations: opening, midpoint, pre-boss, and resolution.
- 2 three-step side stories tied to named NPCs or factions.
- 8 town contracts for the chapter's main settlement, including at least 4 different requirement types.
- 1 named elite encounter and 1 chapter boss.
- 1 new regional rule, encounter modifier, or service so the chapter changes play rather than only text.
- 1 visible world-state response after completion, such as an NPC line, marker state, contract pool, or town service.
- A reward preview and chapter-complete claim with no duplicate reward on reload.

Full 1-30 production target:

- 48 main-story quests across 6 chapters.
- 36 named side-story quests across 12 short chains.
- 49 city contracts (8 per town, plus Moonbridge's eastern-march preview).
- 6 chapter bosses plus 3 rotating regional bosses.
- 6 regional threat variants and at least 3 veteran dungeon modifier sets.

The existing definitions count toward these totals. This is a rewrite-and-fill plan, not a demand for 132 entirely new quests.

### First Shippable Chapter: Levels 1-5 - Complete 2026-07-19

Preserve the six onboarding ids because journal/tests depend on them. Confirmed remake (2026-08-09): rewrite First Banner so teaching is inside dialogue and forced first actions; demote spotlight tutorials to failsafe-only. Do not change ids:

1. [x] `First Banner`: start and complete a real road job.
2. [x] `The Candle Road`: travel to Harborview.
3. [x] `Marshal's Muster`: meet Marshal Orren.
4. [x] `Trial by Steel`: inspect a real enemy, confirm formation, win, and claim the report.
5. [x] `River Law`: travel to Riverside and hear why the Black Pike matters.
6. [x] `Black Pike Warning`: inspect the named threat and learn the risk rules.
7. [x] `The Broken Toll`: defeat the Black Pike lieutenant, not two unrelated battles.
8. [x] `Banner Recognized`: return to Orren, claim the chapter reward, and preview the level 6 Moonwell conflict.

- [x] Continuity remake: fold MP tutorial teaching into `story-01`…`story-06` dialogue/actions; keep skip non-granting.

Add three short system conversations at their real unlock moments:

- [x] Level 3: duel charter, loss policy, and rating protection.
- [x] Level 4: merchant seal, item value, confirmation, and trade safety.
- [x] Level 5: company banner, party ownership, and co-op readiness.

These conversations explain a real available feature. If the feature is not implemented, show it as a preview and do not create a dead call to action.

### Level Path

| Level | Player-facing unlock or milestone |
| --- | --- |
| 1 | Jobs, towns, story, contacts, inventory, army, four starter spells |
| 2 | City contracts, forge upgrades, PVE intel, first dungeon preview |
| 3 | PVP hub and duel charter conversation |
| 4 | Trading, merchant-safety conversation, and Tier II unit acquisition |
| 5 | Parties and co-op entry preview/session when available |
| 6 | Veteran roads, regional threat board, Moonbridge contract pool |
| 7 | Enforced Dungeon Tier II entry, first named regional boss bounty, and Tier III unit acquisition |
| 8 | Second saved formation preset and first town reputation track |
| 9 | Blackwater Gate contracts and chapter-two pre-finale chain |
| 10 | First major boss challenge and veteran Tier III reward sources |
| 11-14 | Eastern road services, veteran contracts, named elites, and escalating boss preparation |
| 15 | Eclipsed Banner act completion, permanent title/banner cosmetic, and Mirror Court preview |
| 16-20 | Mirror Court act, Eclipse Hold access, first veteran co-op dungeon, and second reputation track |
| 21-25 | Candle Key chain, elite dungeon modifiers, advanced town services, and boss rotation expansion |
| 26-29 | High-war encounters, hard-path bosses, and endgame preparation |
| 30 | Lady in Glass finale, endgame challenge board, status title, and veteran rating access |

Levels 11-30 should be expanded into individual registry entries only when each feature has an implemented guard and content. Until then the UI shows the level-band promise, not a fake unlocked button.

### Quest Writing Standard

Each authored quest answers:

1. Who wants this and what do they risk?
2. Why must it happen now?
3. What exact target, location, and action does the player perform?
4. What changes or is revealed midway?
5. Who receives the result?
6. What visible reward or world response follows?

Player responses use three stable tones: oathbound, pragmatic, and defiant. Early choices alter follow-up lines only. Reputation changes may be added after two factions have distinct activities and rewards. A tone choice never blocks the main campaign.

Avoid story objectives that are only `reach player level`, `complete eight jobs`, or `recruit six minions`. Those counters belong in deeds and contracts. Main quests use named locations, enemies, contacts, items, formations, and bosses.

## Multiplayer Banner Chronicle

### Format

- Player-facing name: `Banner Chronicle`.
- Featured duration: 8-10 weeks.
- Launch size: 40 ranks after an internal 20-rank balance pilot.
- First public version: one free track only.
- Old Chronicles remain available in an archive and do not expire.
- A featured Chronicle receives current challenge bonuses, but archived tracks can still be progressed at a slower baseline rate.
- Chronicle Renown is a progress number, not spendable currency.

This follows the useful parts of non-expiring Warbonds and free cosmetic progression systems: players receive a visible long-term goal without losing gameplay content because they took a break.

### Progress Sources

- Daily contract claim.
- Weekly oath claim.
- Main and side-story completion.
- City contract completion.
- First battle win and first dungeon clear of the week.
- Regional threat contribution and boss resolution.
- Genuine social, party, trade, PVP, and co-op actions only after those sessions are server-valid.

Repeated low-risk battle farming and self-trading do not grant unlimited Renown. Apply daily contribution caps to repeatable events, while authored quest and first-clear rewards remain uncapped.

### Reward Mix

- Banner patterns and profile frames.
- Commander titles and nameplate treatments.
- Victory poses, emotes, and social signals when their presentation exists.
- Lore pages and replayable Chronicle conversations.
- Town or faction cosmetic themes.
- Moderate gold, rare gems, and catch-up materials at filler ranks.
- No Chronicle-only spell, unit, gear stat, socket effect, or permanent combat multiplier.

Every fifth rank should feel visually meaningful. Rank 40 awards a title plus a banner set, not a mandatory power spike.

Do not add a paid track until all of the following are true:

- Reward claims and entitlement history are server-authoritative.
- The core campaign, battle, social, and return loops retain players without a pass.
- The team can produce a complete cosmetic set without weakening quest and boss production.
- Old paid content has a documented no-expiry or archive policy.

### Season Zero Theme

Use `The Black Pike Ledger` for the first pilot because it reinforces the level 1-5 story instead of inventing unrelated lore.

- Chronicle guide: Marshal Orren.
- Featured activities: road jobs, Harborview/Riverside contracts, Black Pike patrols, first duels, and party signals.
- Narrative pages: the Pike's toll records, defectors, Orren's failed expedition, and the source of the Moonwell payments.
- Final cosmetic: a repaired Eclipsed Banner variant and `Roadsworn` title.

## Multiplayer Data And Event Foundation

Before adding more counters, expand the semantic engagement event vocabulary beyond the current four event kinds:

- `job-started`, `job-completed`
- `travel-completed`
- `enemy-inspected`, `battle-won`, `battle-result-claimed`
- `story-quest-completed`, `city-contract-completed`
- `boss-defeated`, `dungeon-cleared`
- `friend-action`, `party-action`, `trade-completed`
- `pvp-completed`, `coop-completed`

Each event needs a stable id, actor, target/context id, occurrence time, and server receipt time when deployed. Consumers use the same event for tutorials, quests, daily orders, deeds, Chronicle progress, and telemetry. This prevents another class of bugs where one menu records progress while the real action does not.

Add versioned definitions for:

- Level-path entries.
- Chapter and quest metadata.
- Deeds and their rewards.
- Chronicle ranks and challenge sources.
- Entitlement/claim records.

Prototype state may remain in the existing account JSON. Database deployment still requires server validation, idempotency keys, and entitlement history before real multiplayer rewards or paid content.

## Singleplayer Discovery Plan

This section is plan-only until the multiplayer chapter and progression foundation is stable.

### Ownership Model

Add singleplayer-owned fields under `User.dailyRun`:

```ts
interface RunDiscoveryState {
  version: number;
  unlockedSpellIds: string[];
  unlockedUnitTemplateIds: string[];
  unlockRecords: Array<{
    id: string;
    sourceType: 'starter' | 'run-level' | 'achievement' | 'boss' | 'legacy';
    sourceId: string;
    unlockedAt: number;
  }>;
}
```

Singleplayer run setup reads this state, never multiplayer `User.knownSpellIds`. On migration, copy currently known account spells into the run discovery state once so existing players lose nothing, then separate future ownership. Normalize old saves and make every grant idempotent.

The permanent 1 percent random spell grant is removed only after migration and deterministic achievement rewards are live.

### Discovery Rules

- `Unlock` means an item can appear in future drafts, rewards, shops, or recruitment nodes.
- `Acquire` means the player selected it for the current run.
- Shops and reward nodes continue to create temporary run builds from the unlocked pool.
- A newly unlocked spell or unit is guaranteed to appear within the next two valid offer nodes, then returns to normal rarity.
- Tier III units are rare specialist capstones. Start balance testing with at most one fielded Tier III per run.
- Early unlocks should take 1-3 runs. Advanced sidegrades should take 3-8 runs. Prestige feats may take longer but cannot block the base game.
- Alternate-progress or cumulative versions are added for precision feats if telemetry shows repeated near-misses.

### Unit Blueprint Plan

Start with four core Tier I units: Apprentice Wizard, Squire, Templar Initiate, and Acolyte.

| Blueprint | Tier | Deterministic requirement |
| --- | --- | --- |
| Witch Doctor | I | Choose three omens in one run |
| Crossbowman | I | Win five battles in one run |
| Road Thief | I | Clear a hard route branch |
| Dark Priest | I | Win a run after the commander fell below 20 percent health |
| Battle Magus | II | Clear a run with a wizard-class unit |
| Void Enchanter | II | Learn four temporary spells in one run |
| Man-at-Arms | II | Clear with seven units standing |
| Firelord | II | Defeat Mother Cindervein |
| Road Archer | II | Clear a run without buying from a shop |
| Crusader | II | Clear a run with a templar-class unit |
| Bell Warden | II | Clear a run without losing a unit |
| Cleric | II | Restore 250 health in one run |
| Archmage | III | Defeat Lady Mirror Veyra |
| Plague Doctor | III | Defeat Blackroot Vessel |
| Champion Knight | III | Defeat Ser Kael Duskplate |
| Fallen Wing Knight | III | Defeat Key-Saint Ardan |
| Grave Mercenary | III | Defeat Emperor Grave-Aurel |
| Crowblade Assassin | III | Defeat Scarlet Matron Yvane |
| Templar Paragon | III | Defeat Mother Cindervein under a challenge modifier |
| High Priest | III | Defeat Prior Moon Voss without losing a unit |

Requirements that need new counters are implemented and tested before the blueprint is shown as earnable.

### Spell Discovery Plan

Keep the four current starters: Arcane Bolt, Sanctified Mend, Ember Dart, and Warding Prayer.

| Spell | Deterministic requirement |
| --- | --- |
| Thorn Ward | Clear a run with a templar-class unit |
| Withering Curse | Choose three omens in one run |
| Rallying Hymn | Clear with seven units standing |
| Chain Spark | Win five battles in one run |
| Gravity Snare | Clear a hard route branch |
| Ashen Step | Clear a run without buying from a shop |
| Judgement | Defeat any boss for the first time |
| Royal Command | Clear five runs |
| Moonlit Veil | Win a battle without taking commander damage |
| Blood Star | Defeat Scarlet Matron Yvane |
| Iron Benediction | Clear a run without losing a unit |
| Soul Tether | Restore 250 health in one run |
| Frost Lance | Defeat Mother Cindervein |
| Eclipse Nova | Defeat Emperor Grave-Aurel |
| Saint-King Aegis | Defeat Key-Saint Ardan |
| Time Crown Edict | Defeat all eight bosses |

Bosses may unlock both a Tier III blueprint and a spell because those are pool expansions, not immediate ownership of a complete build.

### Run-Level Path

Run levels provide broad system access while achievements provide specific content:

| Run level | Permanent unlock |
| --- | --- |
| 1 | Core draft, four core units, four starter spells, decent gear cap |
| 3 | Rare gear pool and first run-start blessing slot |
| 5 | Long Road, epic gear pool, and Tier II blueprint eligibility |
| 8 | Tier III blueprint eligibility and advanced challenge deeds |
| 10 | Legendary gear pool and veteran boss variants |
| 15 | Prestige blessing choice, title track, and mastery records |

Existing freely allocated permanent stat points remain, but new progression should favor sidegrades, draft variety, and special rules over stacking universal damage and health.

### Achievement Roles

- `Discovery deeds` unlock spells, unit blueprints, blessing options, or draft rules.
- `Mastery deeds` award titles, frames, and cosmetic records.
- `Challenge deeds` award small run-start blessings or additional choice, never mandatory base power.
- `Record deeds` celebrate personal bests and do not need a reward.

Do not make every achievement a power grant. Players need goals after the gameplay catalog is complete.

## Execution Order

### Multiplayer Now

1. `MP-C0 Event foundation` - complete: semantic genuine-action events, idempotent receipts, legacy normalization, definition versioning, and tests.
2. `MP-C1 Progression UI` - first slice complete: Campaign and Progression now unifies Orders, Campaign, and Level Path with six chapter bands and registry-backed unlock previews.
3. `MP-C2 Levels 1-5` - complete: The First Banner is an eight-step playable chapter with a persistent named threat, level-five Black Pike capstone, genuine post-boss return, rank briefings, chapter presentation, and focused tests.
4. `MP-C3 Social and return completion` - complete: shared request records, party/trade invitation overlays, a versioned local `TradeSession`, the first rotating regional threat, daily first-completion bonuses, and rested job catch-up all use genuine action receipts and duplicate-safe claims.
5. `MP-C4 Chronicle pilot` - complete: the Black Pike Ledger uses an idempotent accumulated event ledger, capped genuine-action Renown, duplicate-safe claims, permanent honors, migration tests, and a responsive progression tab. Expanded to 40 ranks with a Glass Road Memorial archive track at half Renown after `story-20-glass-sealed`.
6. `MP-C5 Multiplayer sessions` - local + DB transport slice complete for trade/duel/raid create/list/patch; combat action streaming remains local.
7. `MP-C6 Levels 6-10` - playable core complete: nine Drowned Moonwell quests, nine Moonbridge contracts (including eastern-march preview after seal), Blackroot and Cindervein story encounters, authored tone choices, two side chains (silk + tithe), post-chapter NPC voice, and Dungeon Tier II gating. Bespoke assets remain parked.
8. `MP-C9 Continuity & Retention` (confirmed 2026-08-09) — complete for the confirmed checklist.
9. `MP-C7 Public Chronicle`: 40-rank expansion and Glass Road Memorial archive shipped. Featured seasonal rotation remains later.
10. `MP-C8 Levels 11-30`: complete for all six chapter bands through Lady in Glass 26–30 (named elites/capstones, returns, and dialog). Candle Compact + Blackwater League reputation tracks and the Deeds tab shipped; three later-band side stories (Ash / Writ / Synod) shipped. Harborview/Riverside boards consolidated to eight contracts each.

### Singleplayer Later

1. `SP-D0 Counters and migration`: split ownership, add exact run-report counters, migrate without relocking, and test old saves.
2. `SP-D1 Discovery model`: add idempotent reward records, deterministic grants, and next-offer guarantees.
3. `SP-D2 Run Archive UI`: ship Spellbook, Warband, Deeds, and Records tabs with visible requirements.
4. `SP-D3 Spell deeds`: replace the random permanent grant with the 16 deterministic spell unlocks.
5. `SP-D4 Unit blueprints`: gate the 4 sidegrade Tier I, 8 Tier II, and 8 Tier III templates.
6. `SP-D5 Blessings and mastery`: add small run-start blessings, titles, advanced commander identities, and challenge records.
7. `SP-D6 Database and boards`: mirror achievements, split leaderboards, and add server-backed records when deployment work resumes.

## First Implementation Batch - Complete 2026-07-19

The next code batch should be intentionally smaller than this roadmap:

1. [x] Define the expanded multiplayer event vocabulary and tests.
2. [x] Add chapter display metadata without changing existing quest ids or completion state.
3. [x] Build the Campaign and Progression modal shell with Orders, Campaign, and Level Path tabs.
4. [x] Move existing daily/weekly/return UI and story journal access into that shell.
5. [x] Add a next-unlock panel backed only by `MULTIPLAYER_UNLOCK_REGISTRY`.
6. [x] Verify reload, genuine-action progress, keyboard/mobile layout, and old tutorial saves before writing new chapter rewards.

## Second Implementation Batch - Complete 2026-07-19

1. [x] Replace the generic Black Pike objective with a named, persistent level-five story boss and scout-report interaction.
2. [x] Add a boss-specific combat rite, exact defeat receipt, balanced capstone rewards, and an authored resolution at Marshal Orren.
3. [x] Prevent the earlier muster visit from satisfying the post-capstone return objective.
4. [x] Add persistent level 3/4/5 unlock briefings with line resume, ordered completion, and archive replay.
5. [x] Expose chapter guides and capstones in the Campaign view.
6. [x] Test spawn rules, exact genuine-action quest completion, legacy tutorial state, briefing order, and chapter ordering.

## Third Implementation Batch - Complete 2026-07-19

1. [x] Add typed social request records with ids, participants, payload, expiry, status, retention, and duplicate-response protection.
2. [x] Route real party invitations through a page-level cinematic request overlay and preserve state for both local account copies.
3. [x] Add the first deterministic weekly regional threat with region-specific patrol composition, a named map boss, genuine battle receipts, exact claim rules, and PVE intel.
4. [x] Add finite returning-player catch-up: at most three +25% job-XP charges, capped at 50 XP per completed job.
5. [x] Implement an ownership-validated local `TradeSession` before exposing the typed trade-request presentation.
6. [x] Add moderate first-win and first-dungeon-clear bonuses with duplicate-claim protection.

## Fourth Implementation Batch - Complete 2026-07-19

1. [x] Add a versioned Black Pike Ledger state that accumulates genuine engagement events exactly once instead of depending on the short event-retention window.
2. [x] Define 20 free-track ranks at 50-Renown intervals with meaningful ranks 5, 10, 15, and 20.
3. [x] Cap repeatable job, social, battle, dungeon, PVP, co-op, and trade sources by day or week while leaving authored and claimed objectives idempotent.
4. [x] Persist rank claims, inventory-limited resource delivery, entitlement ownership, telemetry, and activity history.
5. [x] Add the responsive Chronicle tab with rank states, reward presentation, exact source rules, and acquired lore/cosmetic honors.
6. [x] Test thresholds, contribution caps, duplicate receipts, claims, entitlements, and reload normalization.

## Fifth Implementation Batch - Duel Slice Complete 2026-07-19

1. [x] Add battle mode, participant, team, and unit-owner metadata without breaking legacy NPC saves or side rendering.
2. [x] Add revisioned synchronized battle actions with active-owner checks, duplicate receipts, stale-write rejection, equipped-spell validation, and participant-triggered timeout passing.
3. [x] Add a versioned `PvpDuelSession` with immutable combat profiles, independent formation confirmations, shared combat snapshot, explicit result, expiry, cancellation, and forfeit states.
4. [x] Route accepted local challenges into the existing formation and battle surfaces with two human-owned sides and no NPC AI turns.
5. [x] Add controlled/read-only BattleModal support, visible commander owner names, no campaign loot or health penalties, and a claimable duel result.
6. [x] Make rating settlement and `pvp-completed` engagement receipts idempotent by duel id, including reload normalization tests.

## Sixth Implementation Batch - UI, Economy, And Duo Raid Foundation - Complete 2026-07-19

1. [x] Remove world-popup blur and switch scroll shells to a transparent-edge gothic asset.
2. [x] Keep Commander, Gear, and Army inside Menu; simplify the map rail and expand the quest tracker with active orders.
3. [x] Apply scroll framing to multiplayer command, progression, PVP, PVE, town, HUD, and quest surfaces while preserving dark compact list interiors.
4. [x] Add multiplayer-only roster sorting and a confirmed retreat action to run maps.
5. [x] Rebalance jobs to 1/10/30/60 minutes, 30 percent baseline gold/XP, gems only at 60 minutes, and later gear/drop thresholds.
6. [x] Add the duo raid battle foundation: 15x9 board, two owners, five minions each, morale order, 15-second turns, four full-health phases, two bosses per five-hour cycle, and boss spell caps.
7. [x] Add local duo readiness, collaborative formation, result settlement, reload recovery, and abandon handling.
8. [x] Complete the concise town-service content pass and viewport QA.

## Seventh Implementation Batch - Local Duo Raid Session - Complete 2026-07-19

1. [x] Add a versioned `CoopRaidSession` with immutable player/boss snapshots, expiry, readiness, result, and claim receipts.
2. [x] Launch or resume rotating incursions from PVE intel with level, party-size, and leader guards.
3. [x] Give each commander an independent five-unit formation and equipped-spell confirmation.
4. [x] Synchronize human and AI actions through battle revisions and duplicate action receipts.
5. [x] Settle deterministic gold, XP, gems, and Epic/Legendary gear once per player and feed genuine engagement events.
6. [x] Cover stale writes, ownership, AI turns, final-phase victory, abandon, expiry, and duplicate claims with deterministic tests.
7. [ ] Replace local storage/event transport with Supabase session rows, realtime updates, RLS, and server action validation.
   Partial: create/list/patch transport for trade, duel, and co-op raid is live; combat action streaming remains local.

The remaining `MP-C5` work is database transport and authority. Four-player route dungeons are a later scale step, not a requirement for the first reliable co-op release.

## Eighth Implementation Batch - Drowned Moonwell Core - Complete 2026-07-22

1. [x] Expand levels 6-10 into nine sequential objectives with Scribe Naima and Brother Kaito as recurring guides.
2. [x] Add exact inspect and defeat receipts for the Blackroot Vessel elite and Mother Cindervein capstone so rotating bosses with the same profile cannot satisfy story progress.
3. [x] Add both encounters to the real world-enemy roster with stable ids, level gates, story labels, and balanced loot multipliers.
4. [x] Add eight Moonbridge contracts with varied job, battle, dungeon, item, gem, and level requirements; remove random unit rewards from city contracts.
5. [x] Add persistent oathbound, pragmatic, and defiant responses with reload-safe journal replay and no core-progression branch lock.
6. [x] Correct long-work thresholds to 30 minutes and expose Dungeon Tier II/III entry requirements through the shared registry, map modal, and PVE intel.
7. [x] Add deterministic tests for encounter staging, exact receipts, chapter order, contract variety, response persistence, and dungeon tiers.
8. [x] Complete the two three-step side stories, bespoke Moonfen/goblin/bell-crypt enemies and quest items, first eligible reputation track, and post-chapter world-state response. (Side stories + quest items + post-chapter voice/contract shipped; Candle Compact reputation track shipped later with Blackwater League; bespoke art remains parked.)

## Ninth Implementation Batch - Menu, Retention UI, And Drop Integrity - Complete 2026-07-22

1. [x] Restyle the Menu and spell archive as dark gothic operational surfaces, keep fixed card geometry, and remove clipped spell names and metadata.
2. [x] Replace browser-only global chat history with an authenticated Supabase route, two-second refresh, and a hard 50-message retention cap; keep party chat on the existing local session path until party transport moves server-side.
3. [x] Split the map ledger into Story and Daily tabs and add direct daily reward claims.
4. [x] Give Ashford five native contracts and render location, enemy-level, and dungeon requirements explicitly on every city board.
5. [x] Unlock Tier II acquisition at level 4 and Tier III at level 7 while retaining units already owned by legacy accounts.
6. [x] Make random gear a two-stage chance: first roll whether gear drops, then roll rarity; gate decent, rare, epic, and legendary multiplayer gear at levels 3, 5, 10, and 15.
7. [x] Apply 50 percent healing effectiveness from the third successful heal on the same unit in one battle.
8. [x] Add the shared bard music controller with previous, play/pause, next, and volume controls.
9. [ ] Apply and validate hosted migrations `008` and `009`, then verify global chat with two authenticated browsers.

## Definition Of Done For Every Progression Slice

- The UI states the action, target, location, progress, and reward.
- Progress changes only from the associated real interaction.
- Duplicate events and repeated claims do not duplicate rewards.
- Save/reload and legacy-state normalization are tested.
- Locked features are guarded in both UI and authoritative action code.
- Multiplayer and singleplayer ownership never cross.
- The feature works at 1920x1080, 2560x1440, 3840x2160, and 390x844.
- Keyboard focus, Escape, outside dismissal where appropriate, and reduced motion are verified.
- Dense hubs retain dark compact interiors even when the multiplayer outer shell uses the gothic scroll; no artwork covers content.
- Telemetry exists before reward volume or grind requirements are increased.

## Success Measures

Instrument these before choosing target values:

- Onboarding start, first job, first travel, first inspection, first battle claim, and chapter-one completion rate.
- Time and sessions to levels 3, 5, 10, and 15.
- Main-quest drop-off by quest id and conversation line.
- Daily contract, weekly oath, regional threat, and Chronicle participation and claim rates.
- D1, D7, and D30 return segmented by highest unlocked feature.
- PVP challenge acceptance, duel completion, party formation, and co-op completion.
- Singleplayer runs per unlock, blueprint usage after discovery, spell pick rate, and abandoned-run phase.
- Percentage of players who can identify their next objective and next unlock from UI interaction data.

## Reference Principles

- Helldivers 2 Warbonds demonstrate a non-expiring track that players can work through in their own time: https://www.playstation.com/en-gb/editorial/a-beginner-s-guide-to-helldivers-2/
- Deep Rock Galactic's Performance Pass demonstrates a free cosmetic-focused progression track whose missed rewards return to the game: https://www.deeprockgalactic.com/season01-faq
- Hades demonstrates permanent unlocks that open weapons, aspects, talents, records, and new build choices alongside expanded story: https://www.supergiantgames.com/blog/hades-hit-up-the-nighty-night-update/

These are design references, not templates to copy. The implementation must fit this game's smaller content pipeline and separated multiplayer/singleplayer economies.
