# Content And Asset Generation Plan

Updated: 2026-07-19

## Purpose

This is the production list for expanding multiplayer enemies, quest items, weapon families, gear sets, and the level 6-10 chapter. It also records the next singleplayer unlock work so generated art is tied to an implemented reward instead of becoming an unused asset folder.

## Asset Standard

Generate gameplay sprites as transparent PNG files at 1024x1024. Keep the full subject centered, feet on a consistent baseline, and the silhouette inside roughly 75 percent of the canvas. Use a three-quarter front tactical view facing slightly toward screen-left. Match the game's dark gothic medieval, painterly pixel-art look with crisp readable edges and restrained highlights.

Append this negative direction to every prompt:

> Transparent background. One complete subject only. No frame, floor, scenery, particles outside the silhouette, cast shadow, text, letters, logo, UI, cropped limbs, duplicate weapons, or extra characters.

Before import:

1. Confirm real alpha in all four corners.
2. Remove colored matte pixels and Photoshop export halos.
3. Crop to a consistent transparent canvas without changing the feet baseline.
4. Save source PNG under `assetsv2/source/` and optimized runtime PNG under the target `public/assets/` folder.
5. Test at 48px roster size and 120-180px battlefield size before marking complete.

## First Ten Enemy Sprites

| File | Gameplay role | Generation prompt |
| --- | --- | --- |
| `moonfen-broodling.png` | Tier I fast spider; low health, poison bite | Small moonfen brood spider with six thin black legs, wet blue-gray abdomen, pale moon markings, needle fangs, and a low aggressive stance. Readable compact silhouette for a fast poison melee unit. |
| `cathedral-widow.png` | Tier II control spider; web slow and ranged venom | Large cathedral widow spider with an arched reliquary-shaped abdomen, cracked ivory markings, dark crimson joints, dangling silver web strands kept close to the body, and raised front legs. Sacred architecture corrupted into an arachnid silhouette. |
| `tollroad-goblin-cutter.png` | Tier I flanker; dagger and bleed | Lean road goblin cutthroat in scavenged toll-guard leather, long ears, gray-green skin, one chipped dagger, a small Black Pike cloth strip, and a crouched flanking pose. Practical raider, not comic. |
| `black-pike-goblin-hexer.png` | Tier II caster; curse and mana pressure | Wiry goblin hexer in patched black robes, bone charms, a short crooked staff wrapped in red toll cord, one dim violet ward flame held close to the staff, and an alert malicious posture. |
| `mire-troll-brute.png` | Tier II tank; regeneration and shove | Heavy mire troll with moss-dark skin, stone growths on shoulders, iron toll chains around one forearm, a battered wooden maul, broad hunched silhouette, and visible old spear wounds. Brutal and grounded rather than oversized. |
| `bell-crypt-gargoyle.png` | Tier II defender; guard aura and counterattack | Squat stone gargoyle carved from a ruined bell tower, chipped wings folded tightly, iron bell fragments embedded in its chest, clawed feet, and faint gold light in deep eye sockets. |
| `drowned-road-pilgrim.png` | Tier I attrition unit; wet armor and slow aura | Waterlogged undead pilgrim in torn road robes and rusted mail, carrying a broken shrine pole, river weeds wrapped around boots and shoulders, hollow face under a soaked hood, and a forward dragging stance. |
| `bone-lantern-wisp.png` | Tier I ranged spirit; fragile magic support | Small hovering spirit contained in a cage-like bone lantern, cold teal inner flame, three trailing cloth strips kept within the silhouette, and a simple readable floating shape for a support caster. |
| `carrion-oath-hound.png` | Tier I charger; high movement and mark | Starved black war hound wearing a broken oath collar and short chain, ash-gray ribs, pale eyes, scarred muzzle, and a low sprint-ready pose. No gore. |
| `ashroot-bramblekin.png` | Tier II support; root snare and ally armor | Human-sized deadwood construct made from black roots, thorned branch shoulders, a dim amber saint-candle in its rib cage, heavy rooted feet, and one arm shaped like a hooked shield. |

Runtime destination: `public/assets/minions/`. Add one template at a time with stats, battlefield behavior, reward source, and a focused test. Do not add all ten as stat clones.

## Weapon Families

Keep the current internal `sword` equipment slot for save compatibility during the first pass, relabel it `Weapon` in UI, and add an optional `weaponKind` discriminator. Old equipment without `weaponKind` normalizes to `sword`. Do not rename the saved slot until a migration test exists.

| Kind | Build identity | Primary bonuses | Visual brief |
| --- | --- | --- | --- |
| Longsword | Reliable command | Army Power, Defense | Weathered knight sword with readable crossguard |
| Dagger | Fast spell setup | Morale, small Army Power | Narrow ritual dagger, dark steel, red cord |
| Mace | Anti-armor | Army Power, boss/guard pressure | Flanged iron mace with chapel engraving |
| Staff | Full caster | Spell Power, max mana or mana tempo | Crooked saintwood staff with contained relic light |
| Wand | Fast control caster | Spell Power, Morale | Short blackwood wand with metal focus cage |
| Axe | High-risk offense | High Army Power, reduced Defense budget | Single-blade war axe, chipped ceremonial edge |
| Spear | Formation command | Army Power, Morale, ranged formation modifier later | Long road spear with compact banner tie |

Generate four rarity versions only after the base silhouette is approved. Rarity should change material, engraving, and a restrained glow, not the object shape or canvas position. Filenames use `weapon-{kind}-{rarity}.png` under `public/assets/equipment/`.

## First Five Named Gear Sets

Each set uses the existing seven slots. Implement two-piece and four-piece bonuses first; reserve a six-piece bonus until balance data exists. Set drops are tied to named content, never unrestricted short jobs.

| Set | Source | Identity | 2-piece | 4-piece |
| --- | --- | --- | --- | --- |
| Pikebreaker Harness | Black Pike chapter and weekly threat | Front-line command | Defensive Power | First commander hit each battle is reduced |
| Moonwell Vestments | Levels 6-10 chapter and Moonbridge contracts | Healing and mana control | Spell Power | First support spell costs one less mana |
| Ashen Courier Rig | Veteran road jobs and Ashen Orders deeds | Speed and travel utility | Morale | Once per battle, first wait grants bonus movement next turn |
| Blackwater Relic Mail | Dungeons and Blackwater reputation | Loot choice and flexible sockets | Max Health | Boss chest offers one additional item choice |
| Mirror Court Regalia | Levels 16-20 and Mirror Court bosses | Control magic | Spell Power plus Morale | First control spell also removes one enemy buff |

Art filenames use `{set-id}-{slot}.png`, for example `moonwell-vestments-helmet.png`. Generate the weapon, shield, helmet, chest, pants, gloves, and boots as one coherent contact sheet first, then export separate transparent assets only after palette and motif approval.

## Quest Item Batch

Generate these as centered transparent 512x512 icons. Use one object, strong silhouette, and no text.

| File | Content use |
| --- | --- |
| `black-pike-seal.png` | Proof from the chapter-one lieutenant |
| `orrens-muster-token.png` | Chapter-one recognition and later dialogue gate |
| `moonwell-shard.png` | Core chapter-two investigation item |
| `cinder-saint-candle.png` | Mother Cindervein cult evidence |
| `drowned-tithe-ledger.png` | Riverside and River Concord side story |
| `goblin-toll-cipher.png` | Reveals the hexer supply route |
| `cathedral-silk-bundle.png` | Spider contract and Moonbridge crafting order |
| `mire-troll-heartwood.png` | Regeneration research and rare forge contract |
| `broken-bell-clapper.png` | Bell-crypt elite proof |
| `oath-chain-link.png` | Ashen Orders reputation token |
| `glass-key-splinter.png` | Mirror Court long-term foreshadowing |
| `blackwater-relic-tag.png` | Dungeon provenance and trade-safe quest marker |

Quest items remain non-tradable and do not consume normal gear capacity. Each item must have a named source and receiver before its art is imported.

## Level 6-10 Content Batch: The Drowned Moonwell

The no-new-art gameplay core shipped on 2026-07-22 with nine ordered quests, eight Moonbridge contracts, the existing Blackroot Vessel and Mother Cindervein profiles, exact encounter receipts, and a post-boss return. The following asset-backed expansion remains before the band meets the full chapter production contract:

1. `Road to Moonbridge`: report the Black Pike collapse to Sister Avel and travel to Moonbridge.
2. `Silk Under Stone`: inspect the first Moonfen Broodling risk, clear the bridge nest, and recover Cathedral Silk.
3. `The Stolen Tithe`: follow Tollroad Goblin Cutters and recover the Drowned Tithe Ledger.
4. `Cipher in Red Cord`: defeat the Black Pike Goblin Hexer elite and decode the cult supply route.
5. `Water That Remembers`: choose Avel, Naima, or Yara as the conversation countervoice; all paths identify the Moonwell Shard.
6. `Bells Below`: clear the Bell-Crypt Gargoyle encounter and return the Broken Bell Clapper to Brother Kaito.
7. `Cinder Procession`: complete the pre-boss contract chain, assemble three pieces of evidence, and unlock the raid road.
8. `Mother of Black Candles`: defeat Mother Cindervein and claim the chapter chest.
9. `The Well Answers`: return to Moonbridge, resolve the chapter, unlock level-10 Tier III recruitment eligibility, and preview the Broken Crown.

Supporting content contract:

- Eight Moonbridge city contracts using battle, travel, job, item-turn-in, and dungeon requirements.
- Two three-step side stories: the cathedral spider infestation and the drowned tithe dispute.
- Three new regular enemy templates, one named goblin elite, one bell-crypt elite, and Mother Cindervein.
- One weekly Tier I recruit at Moonbridge; the Tier II offer rotates weekly and is never a daily purchase.
- Campaign quest rewards target 55-80 percent of one level. Jobs/contracts/PVE provide the remainder.

## Singleplayer Discovery Conversion

Do not use multiplayer ownership to seed singleplayer unlocks. The next singleplayer implementation batch remains:

1. Split permanent singleplayer spell and unit ownership from `User.knownSpellIds` and multiplayer minions.
2. Normalize legacy saves without relocking currently discovered content.
3. Replace the one-percent random permanent spell unlock with deterministic deed rewards.
4. Keep four Tier I units and four spells as the core pool; unlock sidegrade Tier I, Tier II, and Tier III blueprints through visible deeds.
5. Guarantee a newly unlocked spell or unit in one of the next two valid run offers.
6. Make Tier III specialists rare and start balance tests with at most one fielded Tier III per run.
7. Show exact requirement, progress, ownership, and first-use status in the Run Archive.

The exact deed-to-unit and deed-to-spell mappings remain in `docs/progression-content-roadmap.md`; that file is the ownership source of truth.

## Implementation Order

1. Finish duo raid readiness, formation, settlement, and server session rules using existing boss/minion art.
2. Add the backward-compatible weapon-family model and one four-rarity weapon family as a migration test.
3. Produce the ten enemy sprites in two batches of five; integrate only the level 6-10 enemies first.
4. Generate and wire the twelve quest-item icons alongside their actual quest definitions.
5. Implement Moonwell Vestments and Pikebreaker Harness before producing the remaining three sets.
6. [In progress] Replace the Drowned Moonwell core's reused enemy art with the planned enemy/item set, add both side stories and the visible world response, then rebalance the complete band against the job curve.
7. Begin the singleplayer discovery migration only after multiplayer and singleplayer ownership tests prove separation.
