# Combat Professionalization Roadmap

Goal: make battles feel like a polished dark fantasy tactics game: readable like Heroes of Might and Magic III, atmospheric like a gothic RPG, and fast enough that players enjoy repeated fights.

## Status Audit - 2026-06-04
- Recent combat polish is mostly reflected already: board-first layout, terrain-styled maps, pre-combat formation, clearer highlights, movement/hit/heal/spell/result animation palettes, board-anchored Three.js combat effects, death fade/ash, floating numbers, restrained Three.js FX bursts, combat speed settings, result reports, tactical mechanics, and AI priorities are checked.
- Deployment and database integration are intentionally out of scope for this audit.
- Remaining combat details are mostly second-pass polish: define/tune duration targets, add AI debug tooling, and add optional ambient/low-health ambience.

## Current Combat Baseline
- 10x7 square tactical board.
- One commander plus up to 7 fielded minions.
- Individual minions, no unit stacks.
- Commander mana and a 20-spell tactical library, with 4 equipped map-combat spells.
- Turn order by speed.
- Clean terrain-only boards: ground, mud, and high ground. Stone, water, bridge, cover, and blocker obstacles are retired from active templates for readability.
- Basic NPC AI personalities.
- Minion injury before permanent death in NPC combat.
- PVP confirmation and timeout scaffolding.

## Current Polish Sprint
- [x] Board-first combat layout with large battlefield and side commander panels.
- [x] Hide the permanent grid and only reveal actionable tiles.
- [x] Add active-unit glow, movement/attack/heal target colors, and timeline side glows.
- [x] Remove active stone/blocker obstacles from templates.
- [x] Add optional movement undo before a unit attacks, heals, casts, or ends turn.
- [x] Add stronger commander-turn affordance: subtle commander pulse, spell button pulse, and target-mode cursor.
- [x] Add clearer pre-combat formation guidance and prevent duplicate enemy placement in every generated formation.
- [x] Add victory/defeat animation variants for daily, dungeon, story boss, and recruit/surrender outcomes.
- [x] Tune default combat speed one step slower and reserve instant mode for repeat farming.
- [x] Add battle-start camera/board settle animation before the first unit acts.
- [x] Add priest charge choice: waiting stores a blessing that makes the next heal stronger.
- [x] Fix NPC movement so moving consumes the enemy action instead of chaining into a hidden attack.
- [x] Enlarge and clarify the commander spell book with readable icons, mana costs, and disabled spell states.
- [x] Replace old spell ring overlays with particle-only Three.js spell accents around the icon-based cast/impact animation.
- [x] Add retaliation damage preview, including adjacent ranged attackers being countered by melee defenders.
- [x] Add colorblind-safe combat indicators with patterned move, damage, support, threat, and health cues.
- [x] Slow enemy action handoff so NPC movement and commander spells remain readable across all combat speeds.

## Design Pillars
- Readable first: every unit, target, turn, and danger zone must be obvious at a glance.
- Tactical but not slow: each turn should offer 2-4 good decisions, not 20 tiny chores.
- Dark fantasy spectacle: hits, heals, spells, morale breaks, and recruit offers should feel juicy.
- Low confusion: players should understand why they can or cannot move, attack, heal, cast, or wait.
- Replayable maps: fights should not feel like the same board with different sprites.

## Phase 1: Board Presentation
- [x] Replace the current visible CSS grid feel with a terrain-styled battlefield board.
- [x] Add subtle tile outlines that appear mostly on hover/action preview.
- [x] Reduce active terrain set to ground, mud, and high ground so the painted battlefield stays clean.
- [x] Keep square grid for now to avoid rewriting all pathing and targeting.
- [x] Add a future note for hex mode only after square combat feels good.
- [x] Make units stand on readable bases/shadows so sprites do not float.
- [x] Add health bars directly above units.
- [x] Add side-color accents: player white/gold, enemy red, neutral/recruited blue.
- [x] Add active unit/action highlighting so controlled units, movement tiles, support targets, and damage targets are obvious.

## Phase 2: Random Battle Maps
- [x] Add `BattleMapTemplate` data with board size, terrain, spawn zones, and tags.
- [x] Pick templates by enemy seed and boss type.
- [x] Add open-field template for simple early fights.
- [x] Add mountain template with raised shoulders and muddy pressure points.
- [x] Replace lake/river template with a bog causeway using mud and high-ground lanes.
- [x] Add ruined-road template using chapel high ground and mud without blockers.
- [x] Add forest-edge template without tree blockers.
- [x] Add boss-arena template with symmetrical lanes and dramatic center objective.
- [x] Add deterministic seeded generation so the same battle can be replayed/debugged.

## Phase 3: Terrain Rules
- [x] `mud`: passable, costs +1 movement.
- [x] `highGround`: ranged units gain bonus damage.
- [x] Retire blocker, stone, water, bridge, and cover terrain from active maps.
- [x] `holyGround`: priests heal more when standing on or healing into consecrated tiles.
- [ ] Add undead/dark holy-ground damage over time after enemy factions are modeled.
- [x] Show terrain tooltip on hover with one short rules line.

## Phase 4: Action UX
- [x] Add selected unit panel with portrait, stats, role, range, movement, and current status.
- [x] Move active-unit and target details into hover previews so the board keeps more space.
- [x] Add hover preview for movement destination and final position.
- [x] Add attack preview: expected damage and likely defeat.
- [x] Add counterattack preview showing retaliatory damage and projected attacker health.
- [x] Add heal preview: expected healing.
- [x] Add spell preview before confirming target.
- [x] Add a one-click cancel/escape flow for selected spells.
- [x] Add optional undo for movement before attacking/casting in the same turn.
- [x] Replace letter action badges with icons: boot, sword, cross/hand, star.
- [x] Add keyboard shortcuts after the UI is stable.
- [x] Add commander spell target reticle that stays visible until cast/cancel.
- [ ] Add explicit spell range preview if commander spells stop being global.

## Phase 5: Turn Feel And Animation
- [x] Add a small initiative timeline across the top.
- [x] Add first-pass unit movement animation.
- [x] Add hit bump/shake on damaged units.
- [x] Add healing pulse and spell burst effects.
- [x] Add floating numbers for damage/heal/mana, small and not noisy.
- [x] Add short death fade/ash animation.
- [x] Add clear but restrained victory/defeat/recruit result screen.
- [x] Add main-screen victory/completion animation before the reward/stat popup.
- [x] Add shared Three.js particle layer for combat actions, spells, run transitions, and completion moments.
- [x] Add board-anchored Three.js combat element effects for movement dust, melee slashes, ranged/spell impacts, healing, defending/buffs, morale, and debuffs.
- [x] Add battle speed setting: normal, fast, instant.
- [x] Add board camera shake/effect intensity limits so spell/action effects never obscure unit readability.
- [x] Finish distinct animation palettes for melee, ranged, heal, buff, debuff, morale, and commander spells.

## Phase 6: Fun Tactical Mechanics
- [x] Add melee retaliation for some unit classes, once per round, including counters against adjacent ranged attackers.
- [x] Add morale events: high morale can grant a small bonus action or mana; low morale can reduce movement.
- [x] Add flanking bonus when attacking from opposite sides.
- [x] Add commander aura: nearby minions gain small stat bonuses based on player stats.
- [x] Add priest choice: heal now, strike, or wait to charge a stronger blessed heal.
- [ ] Add wizard choice: ranged attack, splash spell, or terrain interaction.
- [x] Add knight/templar passive guard to protect adjacent allies.
- [x] Add first boss mechanics through boss personality, aura pressure, and stronger AI priorities.

## Phase 7: AI Upgrade
- [x] Make AI evaluate kill shots first.
- [x] Make healers save low-health allies.
- [x] Make ranged units use terrain/range more intelligently.
- [x] Make tanks block chokepoints.
- [x] Make bosses use stronger tactical priorities.
- [x] Add difficulty knobs per enemy: cautious, aggressive, caster, boss.
- [ ] Add AI debug overlay for development only.

## Phase 8: Balance And Progression
- [ ] Define combat duration target: normal NPC fight should take 3-7 player turns.
- [ ] Tune early enemies so players can win with starter units.
- [ ] Tune daily-run enemy chains so battle 1 is reliable, battle 3 is a check, and battle 5/6 is the payoff.
- [x] Add non-lethal early protection if minion death feels too punishing.
- [x] Balance mana gain and Focus Mana so spell turns feel strategic but not rare.
- [x] Add enemy surrender/recruit offer UI polish.
- [x] Add battle rating preview before starting combat.
- [x] Add post-fight report with XP, gold, drops, and deaths.
- [x] Add main-screen completion reports for combat, quests, jobs, and runs.
- [x] Add quest progress deltas to the post-fight report.

## Phase 9: Professional UI Layer
- [x] Rebuild battle layout around board-first composition, not three equal columns.
- [x] Hide bulky side rosters after combat starts and use timeline/hover info instead.
- [x] Keep the board large and centered.
- [x] Make spellbook a commander-only compact panel opened from commander controls.
- [x] Add tooltips for every spell, terrain type, status, and unit stat.
- [x] Add clear disabled reasons: not enough mana, out of range, blocked, wrong target.
- [x] Add responsive mobile/tablet battle layout.

## Phase 10: Audio And Polish Later
- [x] Add optional sound toggles.
- [x] Add UI click, move, strike, heal, spell, victory, defeat sounds.
- [ ] Add ambient battle loop by region.
- [x] Add subtle screen vignette when commander is low health.
- [ ] Add subtle ambient battlefield particles that stay behind units and do not reduce click clarity.

## Suggested Implementation Order
1. Battle map templates and simplified terrain data.
2. Board visual rebuild with smaller, clearer unit presentation.
3. Hover previews and selected unit panel.
4. Movement/attack/heal animations.
5. Terrain rules.
6. Initiative timeline.
7. Retaliation, guard, morale, and flanking.
8. AI upgrade.
9. Battle result report.
10. Sound and advanced polish.

## Asset Requests
- `public/assets/combat/terrain-ground.png`: optional 128x128 dark gothic dirt/grass battle tile if the single battlefield background needs more detail later.
- `public/assets/combat/terrain-mud.png`: optional 128x128 dark muddy slow tile.
- `public/assets/combat/terrain-high-ground.png`: optional 128x128 raised rocky ground tile.
- `public/assets/combat/effect-strike.png`: 256x256 transparent red slash burst.
- `public/assets/combat/effect-heal.png`: 256x256 transparent holy healing pulse.
- `public/assets/combat/effect-arcane.png`: 256x256 transparent blue-violet spell burst.
- `public/assets/spells/*.png`: 96x96 transparent spell icons for the 20-spell library.
- `public/assets/combat/turn-player.png` and `turn-enemy.png`: small initiative-ring accents if we replace CSS circles with art.

## Sora Prompt Prefix
Dark gothic fantasy pixel art for a browser tactics RPG, crisp readable 32-bit pixel-art look, top-down / slight isometric view, dramatic moonlit lighting from upper left, rich but restrained palette, sharp silhouettes, hand-painted pixel texture, no blur, no photorealism, no 3D render, no text, no watermark, no UI frame.

For transparent objects/effects add:
isolated transparent background, centered, readable at small size.
