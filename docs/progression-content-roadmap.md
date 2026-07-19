# Progression and Content Roadmap

Updated: 2026-07-19

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
- There are 32 main-story quest definitions across the two existing acts, grouped into six five-level campaign bands.
- 17 story quests have authored dialogue ids, including the complete eight-step First Banner opening.
- Levels 1-5 now form a playable opening chapter with a named scout target, Black Pike capstone, real return to Orren, and level 3/4/5 system briefings. Level 6 remains the next content gap before the level 7 Moonwell quest.
- There are 36 city contracts. Harborview and Riverside own 15 each, Blackwater Gate and Eclipse Hold own 3 each, and Moonbridge and Ashford own none.
- There are 8 boss profiles, 24 unit templates, and 20 commander spells.
- The world has useful fiction and assets, but the player-facing structure does not yet expose a clear chapter, next unlock, named target, or long-term collection goal.

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

Dense progression screens keep the compact dark operational style. Gothic scroll surfaces remain reserved for tutorials, story conversations, the formation spellbook, and dramatic confirmations.

### Multiplayer Campaign And Progression

Add one `Campaign` command to the map HUD. It opens a large responsive modal with five tabs:

1. `Orders`: active main objective, three daily contracts, weekly oath, regional threat, and returning briefing.
2. `Campaign`: six chapter rows with guide, conflict, quest progress, midpoint, boss, rewards, and replayable conversations.
3. `Level Path`: levels 1-30, claimed rewards, next three unlocks, and a direct link to the newly opened feature.
4. `Chronicle`: featured Chronicle, archived Chronicles, rank track, challenge sources, and claim states.
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

The current 36 city contracts use 27 faction labels. Keep those names as local orders, guilds, and religious houses, but group progression under five powers the player can remember:

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
- 48 city contracts, balanced to 8 per town across all 6 towns.
- 6 chapter bosses plus 3 rotating regional bosses.
- 6 regional threat variants and at least 3 veteran dungeon modifier sets.

The existing definitions count toward these totals. This is a rewrite-and-fill plan, not a demand for 132 entirely new quests.

### First Shippable Chapter: Levels 1-5 - Complete 2026-07-19

Preserve the six onboarding ids because tutorial state depends on them, then complete the chapter around those interactions:

1. [x] `First Banner`: start and complete a real road job.
2. [x] `The Candle Road`: travel to Harborview.
3. [x] `Marshal's Muster`: meet Marshal Orren.
4. [x] `Trial by Steel`: inspect a real enemy, confirm formation, win, and claim the report.
5. [x] `River Law`: travel to Riverside and hear why the Black Pike matters.
6. [x] `Black Pike Warning`: inspect the named threat and learn the risk rules.
7. [x] `The Broken Toll`: defeat the Black Pike lieutenant, not two unrelated battles.
8. [x] `Banner Recognized`: return to Orren, claim the chapter reward, and preview the level 6 Moonwell conflict.

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
| 4 | Trading and merchant-safety conversation |
| 5 | Parties, co-op entry preview/session when available, Tier II recruitment pool |
| 6 | Veteran roads, regional threat board, Moonbridge contract pool |
| 7 | Dungeon tier II and first named regional boss bounty |
| 8 | Second saved formation preset and first town reputation track |
| 9 | Blackwater Gate contracts and chapter-two pre-finale chain |
| 10 | Tier III recruitment pool and the first major boss challenge |
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
4. `MP-C3 Social and return completion`: finish trade/party request overlays, regional threat, first-win/dungeon bonuses, and rested catch-up.
5. `MP-C4 Chronicle pilot`: add the internal 20-rank Black Pike Ledger using only implemented, genuine actions.
6. `MP-C5 Multiplayer sessions`: refactor combat ownership, then ship real duel and first co-op dungeon sessions.
7. `MP-C6 Levels 6-10`: ship The Drowned Moonwell, Moonbridge contracts, Mother Cindervein, first reputation track, and dungeon tier II.
8. `MP-C7 Public Chronicle`: expand the validated pilot to 40 ranks, archive support, full reward presentation, and entitlement history.
9. `MP-C8 Levels 11-30`: produce one complete five-level chapter at a time. Do not implement all remaining quest text in one untested batch.

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

The next implementation batch is `MP-C3`: complete trade and party request overlays, then add the first regional threat and rested catch-up rules before starting the Chronicle pilot.

## Definition Of Done For Every Progression Slice

- The UI states the action, target, location, progress, and reward.
- Progress changes only from the associated real interaction.
- Duplicate events and repeated claims do not duplicate rewards.
- Save/reload and legacy-state normalization are tested.
- Locked features are guarded in both UI and authoritative action code.
- Multiplayer and singleplayer ownership never cross.
- The feature works at 1920x1080, 2560x1440, 3840x2160, and 390x844.
- Keyboard focus, Escape, outside dismissal where appropriate, and reduced motion are verified.
- No dense hub is converted to parchment and no scroll artwork covers content.
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
