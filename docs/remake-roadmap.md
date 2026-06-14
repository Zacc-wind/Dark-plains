# Dark Gothic Browser RPG Remake Roadmap

## Current Foundation
- [x] Use Sora asset folder as the import source.
- [x] Import and trim player models 1-6.
- [x] Import the dedicated combat background as `public/assets/battlefield-bg.png`.
- [x] Use one full world map instead of repeated terrain tiles.
- [x] Use CSS-driven dark fantasy UI instead of image borders.
- [x] Add minion art, equipment sheet slicing, reward icons, and town backgrounds.
- [x] Add NPC battle encounters on the world map.
- [x] Add first pass of commander/minion tactical combat.

## Status Audit - 2026-06-04
- Broad roadmap is current for combat, map polish, towns, quests, dungeons, daily runs, social prototype UI, and dark gothic UI polish.
- Deployment and database integration were skipped in this audit; API contracts and the local adapter bridge remain the stopping point.
- Open non-deployment items are command-panel action polish and the remaining combat-detail items tracked in `combat-professionalization-roadmap.md`.

## Current Polish Sprint
- [x] Shrink cursor fog reveal radius by about 50% so map discovery feels tighter.
- [x] Scale fog/player glow reveal with zoom so close zoom keeps characters readable.
- [x] Remove the old circular translucent plate under the player sprite.
- [x] Move the main-map Daily launcher next to the Menu button.
- [x] Add safe travel cancellation that leaves the player at the current route position.
- [x] Make map fog more subtle, keep it behind popup panels, and remove duplicate cursor trail circles.
- [x] Rename Minions to Army and remove Runs, Leaders, and History from the main command rail.
- [x] Reduce noisy small center burst animations for town/dungeon/interface events.
- [x] Reframe army/minion portraits so UI containers stop cutting off unit heads.
- [x] Hide development overlay controls that cover the bottom-left map UI.
- [x] Add walk-confirmation prompts before direct travel so map preview clicks do not accidentally move the player.
- [x] Fix first fog reveal so cursor/player light starts at the correct position instead of sliding in from the screen edge.
- [x] Add clearer main-map job/walk chips with one-click details and less overlap on small viewports.
- [x] Add a polished daily-run entry flow: compact launch button, short briefing, visible saved-progress state, then draft/formation.
- [x] Add animation feedback for travel start, travel cancel, quest accept, shop purchase, blacksmith upgrade, and spell equip.
- [x] Reduce nested borders in command panels and replace repeated boxed rows with cleaner grouped lists.
- [x] Add a short first-session onboarding sequence that points to Daily Run, first town board, and first nearby enemy.

## Phase 1: Combat Rules
- [x] Commander is the player king on the battlefield.
- [x] Commander gains mana and can cast strategic spells.
- [x] Add 20 first-pass spells with rarity, costs, and tactical effects.
- [x] Add player spell loadouts: 4 equipped spells for map combat, randomized temporary spells for daily runs.
- [x] Add Focus Mana action for commander turns.
- [x] Scale commander mana gain by commander turns taken: first commander turn gains 1, then 2, then 3, then capped.
- [x] Add 2-minute turn inactivity timeout.
- [x] Add simple NPC combat AI for movement, attacks, healing, and spells.
- [x] Make minions individual units, not stacks.
- [x] Limit fielded minions to 7.
- [x] Make fallen player minions enter injury first, then die permanently after repeated injuries.
- [x] Give unit classes different behavior:
  - Knights: slow, durable melee.
  - Templars: slow, defensive holy fighters.
  - Priests: healing support with ranged heal.
  - Wizards: ranged damage with low defense.
- [x] Add proper PVP challenge state with both players confirming inside one minute.
- [x] Add combat replay/log detail for each round.
- [x] Add better AI personalities per enemy type.
- [x] Add surrender/recruit offer when the player massively outclasses an enemy.
- [x] Commander death ends combat immediately for that side.
- [x] Fix same-template healing/effect targeting so identical units do not all receive the same animation or buff.

## Phase 2: Minion Roster
- [x] One minion per roster slot.
- [x] Any class/tier combination can be fielded.
- [x] First 7 minions are fielded for old saves by default.
- [x] Add drag/drop roster ordering.
- [x] Add field/reserve toggle per minion.
- [x] Make combat use selected fielded minions instead of first 7 only.
- [x] Add minion details modal.
- [x] Add minion rarity frames and class filters.
- [x] Add minion injury state before permanent death if we want softer early progression.

## Phase 3: Player Stats And Gear
- [x] Replace old stat names in the database:
  - `attack` -> `armyPower`
  - `defense` -> `defensivePower`
  - `speed` -> `morale`
  - add `spellPower`
  - keep `health` / `maxHealth`
- [x] Migrate old saves safely.
- [x] Make gear affect commander power and minion bonuses.
- [x] Add passives that affect travel, job gold, or drops.
- [x] Add rare gem inventory upgrade with gold/gem cost and failure chance.
- [x] Add town blacksmith gear sockets: rarity controls slot count, gems add random bonuses, gold upgrades bonuses to +10 with steep failure odds.
- [x] Enforce inventory capacity on item rewards and gem shops.
- [x] Add upgrade UI polish and clear failure/success history.

## Phase 4: World Map
- [x] Add zoom controls and mouse wheel zoom.
- [x] Clamp zoom to keep the painted world map filling the visible canvas.
- [x] Spread NPC enemies from early northwest to harder southeast.
- [x] Re-space POIs against the final world map art.
- [x] Add boss regions in the southeast.
- [x] Add region difficulty bands:
  - Northwest: level 1-4
  - West/center: level 4-8
  - East/center: level 8-12
  - Southeast: level 12-15 bosses
- [x] Add visible quest NPC markers.
- [x] Add temporary dungeon markers.
- [x] Add minimap or world overview mode.
- [x] Replace fixed enemy map positions with 30 rotating regional enemy patrols.
- [x] Add two player-near enemy patrols per cycle with easier scaling and better rewards.
- [x] Slow world enemy rotation to a once-per-day refresh cadence.
- [x] Plan a 4x larger world map expansion with more roads, more cities, and wider level bands.
- [x] Add extra towns/cities that can reuse the existing Harborview/Riverside background style until unique art exists.
- [x] Replace/fix campfire art and interactions with a dry-land traveler camp prompt, no water.
  - [x] Center the existing campfire marker and add dry-land safe-rest modal copy.
  - [x] Generate/import a new dry-land campfire sprite.

## Phase 5: Towns And Economy
- [x] Add first-pass town shop UI.
- [x] Let players preview town/POI boards while walking toward them.
- [x] Add basic offers: healing, rare gems, equipment cache, minion contracts.
- [x] Add first rotating 5-offer town shop stock.
- [x] Add rotating city quest board.
- [x] Add 30 reusable city quests.
- [x] Show 5 available quests per city.
- [x] Rotate city quests every few hours.
- [x] Limit players to one active city contract and show it as the tracked current quest in Overview.
- [x] Add shop stock rotation.
- [x] Add town-specific factions and rewards.
- [x] Split town shop and blacksmith into separate service panels.
- [x] Add town market selling for non-quest items, spare gear, and army units.

## Phase 6: Quests And Story
- [x] Rename daily quests to match dark fantasy.
- [x] Rename jobs to match dark fantasy.
- [x] Create main storyline from level 1 to level 15.
- [x] Make story chapters modular so Chapter 2 can be added later.
- [x] Add quest data files instead of hardcoding quest logic.
- [x] Add quest requirements:
  - complete jobs
  - win battles
  - visit POIs
  - gather rare gems
  - recruit minions
  - defeat bosses
- [x] Add rewards tuned by player level.
- [x] Retune early quest XP so starter contracts stay around 40 XP max.
- [x] Add extra one-time rewards from main quest NPCs.
- [x] Make completed single-use quest NPCs disappear from the map after their counsel reward is claimed.
- [x] Add lore text for the commander/wizard war.
- [x] Add claimable main story rewards.
- [x] Add campaign spell unlock rewards and sealed spell cache drops.
- [x] Add city-walk story steps that complete when the player reaches Harborview or Riverside.
- [x] Auto-claim completed story, city, and daily quest rewards when outside combat/dungeon/daily-run flows.
- [x] Force quest completion reports back to the main map and close open world/command panels before showing rewards.
- [x] Add true quest drop objectives tied to enemy/POI drops, with temporary quest-item icons.
- [x] Add a compact active-main-quest tracker on the map with next step, target type, and travel/action button.
- [x] Add quest completion animation before reward details, distinct from generic job completion.

## Phase 7: Religious And Cultural Motifs
- [x] Use fictionalized orders and shrines inspired by broad world-religion motifs.
- [x] Keep references respectful and symbolic, not parody or caricature.
- [x] Possible inspiration buckets:
  - Cathedral orders, relic shields, candle vows.
  - Desert star scholars, moon observatories, pilgrim lawkeepers.
  - Lotus monasteries, bell towers, meditation gardens.
  - Ancestor shrines, river offerings, mountain hermit sages.
  - Fire temples, ash rites, oath flames.
- [x] Apply these to quest names, town factions, POIs, and minion flavor.

## Phase 8: Travel Events
- [x] Add random travel event engine.
- [x] Speed up direct travel and queued job travel pacing.
- [x] Scale event count by travel time.
- [x] For 5 minutes of walking: low chance of any event.
- [x] For 4 hours of walking: around 6-9 log events.
- [x] Event outcome split:
  - 80% positive or neutral.
  - 20% negative.
- [x] Write 160 positive/neutral short events.
- [x] Write 40 negative short events.
- [x] Rewards can include gold, health, rare gems, gear, minions, lore hints.
- [x] Negative events can cost health or gold.
- [x] Add travel log rows to the activity history.

## Phase 9: Dungeons
- [x] Add temporary dungeon spawns on the map.
- [x] Dungeons stay for a few hours.
- [x] Use large XP icon as a first placeholder, with color filter by difficulty.
- [x] Add dungeon levels and boss fights.
- [x] Add dungeon-specific loot tables.
- [x] Add party/minion requirements for harder dungeons.
- [x] Convert dungeon entry into a first-pass chamber path with battle, shop, chance event, elite, and boss nodes.
- [x] Add dungeon run rewards and temporary run buffs between combats.
- [x] Add authored dungeon layouts, richer node art, and persistent dungeon clear reports.

## Phase 9B: Daily And Roguelike Runs
- [x] Add daily run entry from the command UI.
- [x] Add direct Daily Run launcher on the main map UI.
- [x] Let the player draft random minions until 7 slots are filled.
- [x] Add formation setup before run battles, allowing player units to be placed in the starting two columns.
- [x] Chain 9-12 tactical battles into one roguelike run.
- [x] Add branching daily road choices with safer battles, elite fights, shops, omens, and a final boss node.
- [x] Offer 4 reward choices after every victory.
- [x] Add 20 first-pass run buffs including stat boosts, resurrection, recruits, upgrades, and run gold.
- [x] Add once-per-day completion lockout, streak rewards, and local leaderboard/report history.
- [x] Add timestamp fallback reset logic so Daily Oaths and Daily Run lockouts cannot remain stale after a full day.
- [x] Add richer daily modifiers, named daily bosses, and weekly reward variants.
- [x] Persist in-progress daily runs so closing the modal or leaving combat does not reroll progress.
- [x] Keep daily saved-run resume state in the main Daily button and command Overview without a redundant map report card.
- [x] Add post-run summary pacing: short victory/defeat burst, then compact stats, then reward choices/history.
- [x] Add clearer draft/formation errors so players know when units are not placed or duplicated.
- [x] Convert the old daily-run framing into repeatable random roguelike runs with separate run progression and no main-map penalty on retreat/defeat.
- [x] Rebuild the random-run lobby and unit draft into full-screen cinematic flows.
- [x] Add random route rewards so hard-route fights and boss fights are followed by a shop or omen stop.
- [x] Balance long-term random-run progression around a configurable content cap: permanent unlock pacing, encounter scaling, run-shop economy, and boss spacing.
- [ ] Raise the random-run cap beyond 15 once there are enough bosses, enemies, run rewards, and late-run events to support it.

## Phase 10: PVP And Social Map
- [x] Show nearby real players on the map.
- [x] Add interaction radial/menu:
  - battle
  - trade
  - inspect
  - message later
- [x] PVP battle requires both players to confirm within one minute.
- [x] Add auto-pass after 2 minutes of inactivity.
- [x] Add anti-grief level shield for PVP down-challenges and warnings for outmatched fights.
- [x] Decide what can be lost in PVP and document the rule.
- [x] Add friends list, friend requests, and party invite UI.
- [x] Add up-to-4 player parties and show party members on the global map.
- [x] Add collapsible global chat and party chat tabs.
- [x] Add map-side social presence markers that do not clutter combat/quest markers.

## Phase 11: Browser Game Systems To Compare Later
- [x] Compare against The West:
  - job queue pacing
  - travel friction
  - duels
  - equipment progression
  - town/social systems
- [x] Compare against Ikariam:
  - city growth
  - resources
  - research
  - alliances
  - long-term planning loops
- [x] Compare against OGame:
  - timers
  - scouting
  - risk while offline
  - fleet/army preservation
  - reports/logs
- [x] Decide which non-combat systems fit this game without making it too bloated.

## Phase 11B: Online Database And Deployment
- [x] Add local multi-category leaderboard UI as the bridge toward global rankings.
- [x] Draft the live database and deployment plan.
- [x] Add a storage adapter boundary so gameplay systems stop calling `localStorage` directly.
- [x] Add first Next.js API route contracts for player state, leaderboards, reports, daily runs, and PVP challenges.
- [ ] Extend database schema plan for spell loadouts, gear socket bonuses, friends, parties, and chat.
- [ ] Wire API routes to managed auth and database-backed state.
- [ ] Move accounts from prototype local passwords to managed auth.
- [ ] Create Supabase Postgres tables, migrations, Row Level Security, and leaderboard views.
- [ ] Move editable content tables into the database after mechanics stabilize.

## Phase 12: Dark Gothic UI Polish
- [x] Add a close/minimize control for the right command UI.
- [x] Make the command rail compact instead of large label-heavy buttons.
- [x] Add a gothic/celtic font pass for headings, labels, and core UI.
- [x] Shift the UI palette toward black, bone, crimson, and candle-gold.
- [x] Render POIs as larger circular framed map markers.
- [x] Keep players, NPCs, and enemies as free-standing map sprites without circular frames.
- [x] Add soft white glow treatment to player, character, and minion sprites.
- [x] Color-code map sprite glows by role: players white, enemies red, quest NPCs yellow, and future neutral NPCs blue.
- [x] Gate enemy, player, town, POI, dungeon, and quest NPC interactions behind physical map location.
- [x] Keep interaction previews available during travel without enabling remote combat/claim exploits.
- [x] Add slower combat pacing with turn prompts and short action resolve delays.
- [x] Add clearer combat action highlights and center-screen turn guidance.
- [x] Soften combat prompt overlays and replace loud board action labels with compact visual badges.
- [x] Reduce oversized POI and town circular map frames while keeping sprite scale readable.
- [x] Replace command rail abbreviations with compact icons and enlarge the main command panel.
- [x] Rebuild the command UI as a full-screen multi-panel shell with larger tabs and denser dashboard-style sections.
- [x] Simplify minion roster by removing filters and known-unit template clutter.
- [x] Add clickable quest guidance showing the relevant NPC contact and location.
- [x] Add tracked current quest card to Overview.
- [x] Show direct road travel in the Jobs/Overview panels without consuming job queue slots.
- [x] Add compact main-map chips for direct travel and queued jobs.
- [x] Lock the map to the full viewport and reserve wheel scrolling for zooming around the cursor.
- [x] Give Overview, Character, Inventory, Minions, and Spells purpose-specific command layouts.
- [x] Improve unit portrait framing across run draft, formation, roster, and battle pieces.
- [x] Compact the combat shell so rosters, turn info, active preview, and battle log stop stealing board space.
- [x] Add shared Three.js ambient particles and event bursts for login, UI opens, town/dungeon entry, combat actions, spell effects, spawn rotations, and completion reports.
- [x] Continue dark fantasy cartoon polish on combat, town, and quest panels.
- [x] Add cursor-driven Three.js fog-of-war with level/marker reveal behavior.
- [x] Tighten the cursor fog and scale reveal with zoom.
- [x] Hide enemy sprites and level text outside cursor/player fog reveal.
- [x] Center first-load camera on the player after the real viewport is measured.
- [x] Target POI, town, dungeon, and queued-job travel to the visible marker center instead of the top-left footprint tile.
- [x] Limit quest NPC exclamation marks to useful/current/available quest contacts.
- [x] Move Daily Run into the main action cluster near Menu.
- [x] Hide unused command tabs while preserving their underlying logic.
- [x] Reorder Inventory so equipped gear is primary, available gear is higher, and satchel upgrade sits at the bottom.
- [x] Hide locked/claimed quest clutter from the main Quests view.
- [x] Hide visible scrollbars in command and town panels while preserving scroll behavior where content overflows.
- [x] Finish full-screen command panel polish so tabs read as actions, not separate data dumps.
- [x] Rework town panels into clear service columns: board, shop, blacksmith, local players.
- [x] Add subtle UI transition states for opening command, town, quest/world popup, and daily panels.

## Phase 13: Professional Combat Roadmap
- [x] Create a dedicated combat roadmap for Heroes-like presentation, random battle maps, better UX, terrain rules, animation, AI, and fun tactical mechanics.
- [x] Implement battle map templates and terrain data.
- [x] Rebuild board visuals around terrain styling and readable unit bases.
- [x] Add selected unit panel, hover previews, damage/heal predictions, and disabled-action reasons.
- [x] Highlight both commanders as the duel centerpiece above the battlefield.
- [x] Move turn state, timer, mana, and End Turn into the battle header.
- [x] Move king spell selection into a compact header menu with target mode and cancel.
- [x] Move commander Focus Mana, spell selection, and pass turn into large round commander controls.
- [x] Anchor commander spell selection to the active player commander card with a visual ready highlight.
- [x] Add initiative timeline icons with player/enemy side glow.
- [x] Add pre-combat formation placement for roguelike battles.
- [x] Add clearer move/support/damage highlights while hiding the default board grid.
- [x] Fix combat board scaling on large screens by sizing the battlefield from real board rows/columns and viewport height.
- [x] Add easier spell loadout editing with selectable spell slots and larger spell cards.
- [x] Add combat keyboard controls for pass, spell menu, cancel, and Focus Mana.
- [x] Add floating combat numbers and death fade/ash markers.
- [x] Make the combat log collapsible by default.
- [x] Remove active combat stones/blocker obstacles and keep boards focused on ground, mud, and high ground.
- [x] Add main-screen completion animation and reward popup for combat, quests, jobs, and runs.
- [x] Add first-pass movement, hit, heal, spell, and result animations.
- [x] Add death-specific board animation before defeated units disappear.
- [x] Add tactical mechanics: retaliation, passive guard, morale events, flanking, commander aura, and boss mechanics.
- [x] Upgrade AI to use terrain, heal intelligently, block chokepoints, and prioritize kill shots.
- [x] Add battle result report and combat-speed settings.
- [x] Nerf early-tier healing units and improve movement tile affordance/sprite fit.
- [x] Add differentiated combat sound routing and priest charged-heal choice.
- [x] Fix NPC enemy turns so movement ends the action and cannot also trigger an attack.
- [x] Polish commander spell selection and convert spell FX overlays to particle-only accents around icon animations.
- [x] Add combat retaliation forecasts, enemy hover threat previews, board wait control, colorblind-safe indicators, and slower enemy action handoff.
- [x] Let daily-run shops sell multiple offers per stop, with 3 run-wide shop rerolls and no duplicate reward categories where possible.
- [x] Add daily-run hard-route payoff: immediate boon plus a guaranteed positive omen, with 1 run-wide omen reroll.

## Content Targets
- [x] 15 main story quests.
- [x] 30 rotating city quests.
- [x] 160 positive/neutral travel events.
- [x] 40 negative travel events.
- [x] 12 minion templates minimum, already present.
- [x] 4-8 boss enemies.
- [x] 8-12 dungeon templates.
- [x] 20-30 shop offers across towns.
- [x] Add non-equippable inventory drops: consumables, quest items, trade goods, gem sacks, and loot chests.
- [x] Add loot chest opening rules and item rarity tables.
- [x] Add spell cache container drops.
- [x] Add crafting/trading sinks for quest relics and trade goods beyond first-pass selling.
