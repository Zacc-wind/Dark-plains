# 4x World Map Expansion Plan

## Goal
Move from the current 60x60 painted world to a 120x120 world with about four times the playable area, more road travel, more cities, and clearer level bands. Keep the current Harborview and Riverside background styles reusable until each town gets unique art.

## Current 60x60 Polish State
- [x] Full-viewport map canvas with wheel zoom around cursor.
- [x] Cursor-driven fog reveal for enemy/dungeon levels and map discovery.
- [x] Smaller fog reveal radius, with zoom-scaled reveal around the cursor and player.
- [x] Player sprite uses a soft direct glow without the old circular under-plate.
- [x] Daily Run launcher is in the main action cluster near Menu.
- [x] Add more compact walk/job chips that avoid covering important map markers.
- [x] Add travel-start and travel-cancel visual feedback on the map.

## Map Shape
- Canvas target: `3840x3840` PNG, still painted as one non-looping world map.
- Tile target: `120x120`, keeping the current 32 px logical tile scale.
- Spawn target: near `42:42`, close enough to starter towns and early POIs that the first session is not empty.
- Hardest zone target: southeast `85:82` through `119:119`, with boss towns, high-level dungeon spawns, and elite patrols.

## Roads
- Main pilgrim road: southwest to northeast, crossing the starter center and Harborview-style coastal towns.
- River road: west-middle to east-middle, with bridge towns and job POIs spaced every 10-14 tiles.
- Old crown road: northwest to center, then fractured into the southeast boss regions.
- Ash road: center to far south and southeast, used for late-game story and elite dungeon travel.
- Side roads should leave pockets of wilderness so random events and patrols still feel useful.

## Level Bands
- `1-4`: northwest/west starter fields, first farms, forests, and starter town boards.
- `4-8`: western and central roads, more jobs, first dungeon clears.
- `8-12`: eastern lakes, quarry country, hostile town outskirts.
- `12-15`: southeast marchlands, boss patrols, elite city boards, and chapter-one finale fights.
- `15-20`: reserved outer corners for chapter two and later systems.

## Town Reuse
- Harborview style towns: Harborview, Blackwater Gate, Eclipse Hold.
- Riverside style towns: Riverside, Moonbridge, Ashford.
- Every reused town can run the common shop pool and rotating quest fallback until it gets town-specific quest writing.

## Implementation Steps
1. Generate/import the `3840x3840` world map and update `MAP_CONFIG` to `120x120`.
2. Re-space towns, POIs, quest NPCs, dungeons, and enemy regions against the larger roads.
3. Move starter spawn near `42:42` and keep first-session travel distances short.
4. Split enemy spawn bands into early, mid, late, boss, and chapter-two reserve regions.
5. Add camera bookmarks or a world overview modal before reintroducing any minimap.
6. Retune direct travel and job travel timers for the larger world so long trips feel meaningful but not punishing.
7. Add map polish passes: travel path preview [done], fog reveal tuning, marker density, and activity chips.

## Additional Assets Needed Later
- 120x120 full world map PNG, `3840x3840`.
- 4-6 extra town map sprites if reused Harborview/Riverside starts feeling repetitive.
- 4-8 dry road encounter markers for dungeons, elite patrols, shrine events, and story gates.
- Optional biome-specific fog/particle palettes for marsh, road, quarry, lake, and boss regions.

## New Art Prompt
Dark gothic fantasy pixel-art overworld map, top-down terrain only, no labels, no grid lines, no UI. A 120x120 tile world with haunted green-black moors, dead grass, muddy roads, ruined causeways, dark lakes, dry camps, quarry scars, broken shrines, and southeast boss country. Road layout: one main pilgrim road southwest to northeast, one river road west-middle to east-middle, one old crown road northwest to center then fractured southeast, one ash road center to far southeast. Leave readable open spaces for separate POI and city sprites. Non-repeating full map, not seamless tile, crisp readable 32-bit pixel-art look, no blur, no photorealism, no text, no watermark.

## Campfire Replacement
The public campfire sprite is now the dry-land traveler camp from `assetsv2/campfire.png`. If we regenerate it again, use:

Dark gothic fantasy pixel art for a browser RPG, crisp readable 32-bit pixel-art look, top-down / slight isometric view, dramatic moonlit lighting from upper left, isolated object sprite, transparent background, centered, readable at 64px, dry roadside traveler campfire on dirt, ring of stones, bedrolls, small pack, warm fire glow, ashes, no water, no coast, no boat, no text, no watermark, no UI frame.
