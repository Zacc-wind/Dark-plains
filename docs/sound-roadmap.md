# Sound Roadmap

This is the current interaction sound checklist for the game. Starter CC0 files exist under `public/assets/audio`; the custom/generated items should be made in a darker gothic fantasy style so they match the art direction.

## Starter Files Added

- `ui/click_confirm.ogg` - primary button press, confirm, accept.
- `ui/click_soft.ogg` - secondary button press, close, cancel.
- `ui/hover_tick.ogg` - button/card hover, map node hover, inventory slot hover.
- `ui/toggle_switch.ogg` - settings, collapsible panels, tab toggles.
- `ui/book_open.ogg` - command center, spell book, quest journal, modal open.
- `ui/book_flip.ogg` - tab changes, spell selection, quest detail expand.
- `world/town_enter.ogg` - entering towns/cities.
- `world/town_leave.ogg` - closing town/city full screen.
- `world/walk_step_1.ogg`, `world/walk_step_2.ogg` - map travel cadence.
- `combat/weapon_draw.ogg` - attack preparation, combat start.
- `combat/melee_slice.ogg` - melee swing.
- `combat/melee_heavy.ogg` - heavy commander or high-damage melee impact.
- `combat/blade_hit.ogg` - weapon contact.
- `combat/armor_hit.ogg` - weapon impact against better-armored targets.
- `combat/unit_hurt.ogg` - damage taken.
- `combat/unit_death.wav` - normal unit death. Default is a restrained male exhale (`death-candidates/02_male_soft_exhale.wav`). See `combat/death-candidates/` for alternates.
- `combat/move_dust.ogg` - unit movement on the combat grid.
- `combat/wait.ogg` - wait/hold turn.
- `combat/guard.ogg` - guard or defensive response.
- `combat/blessing.ogg` - short holy spell ping (same clip as `spell_holy.ogg`). Priest mend and blessing charge play a whispered cast + this impact in ~90ms.
- `combat/heal.ogg` - legacy heal asset kept for reference; combat routes healing through `combat.blessing`.
- `combat/mana_focus.ogg` - commander focus mana.
- `combat/ranged.ogg` - ranged physical release cue.
- `combat/ranged_release.ogg` - ranged attack release.
- `combat/ranged_impact.ogg` - ranged attack impact.
- `combat/spell_cast.ogg` - generic spell cast.
- `combat/spell_hit.ogg` - generic spell impact.
- `combat/spell_fire.ogg` - fire or scarlet spell impact.
- `combat/buff.ogg` - command, ward, morale, and support spell impact.
- `combat/control.ogg` - curse, snare, frost, and slow spell impact.
- `combat/spell_flame.ogg` - Ember Dart and fire-coded spell impact.
- `combat/spell_lightning.ogg` - Chain Spark and arcane lightning impact.
- `combat/spell_shadow.ogg` - blood, curse, eclipse, and shadow impact.
- `combat/spell_frost.ogg` - frost, snare, and time-control impact.
- `combat/spell_holy.ogg` - healing, judgement, aegis, and saintly spell impact.
- `combat/boss_roar.ogg` - boss intro or boss phase pulse.
- `combat/victory.ogg` - battle victory animation and result screen.
- `combat/defeat.ogg` - battle defeat animation and result screen.
- `inventory/coins.ogg`, `inventory/gold_gain.ogg` - purchase, sell, reward gold.
- `inventory/gem_gain.ogg` - gem/relic gain.
- `quest/quest_claim.ogg` - quest reward claim.

## Runtime Wiring Added

- `lib/sound.ts` provides `playGameSound`, `preloadGameSounds`, and a local master-volume setting for Settings.
- `components/GameCommandCenter.tsx` delegates UI hover/click sounds for buttons, tabs, open/start actions, buy/sell actions, and claim actions.
- `components/GameCommandCenter.tsx` includes a Settings tab with master volume, test sound, and combat speed controls.
- `components/BattleModal.tsx` plays log-timed action sounds for strike, spell, healing, focus mana, move, hold, and unit death cues.
- `components/BattleModal.tsx` now preloads combat sounds and separates release/impact/accent cues so hurt grunts do not dominate weapon attacks.
- `components/BattleModal.tsx` plays victory and defeat stingers when battle result animations/screens resolve.
- Combat grid cells opt out of generic UI hover/click sounds so they can use tactical action sounds instead.

## Needed Custom Or Generated Sounds

- `ui/error_denied.ogg` - invalid action, no mana, locked route, inventory full.
- `ui/reward_reveal.ogg` - reward cards, daily run rewards, completed job popup.
- `ui/panel_whoosh.ogg` - POI/city transition, menu panel slide.
- `world/poi_open.ogg` - inspect POI.
- `world/enemy_select.ogg` - inspect enemy on map.
- `world/boss_spawn.ogg` - hourly boss appears on map.
- `world/reaper_fallen.ogg` - commander death/reaper screen.
- `combat/block_guard.ogg` - defend, ward, retaliation blocked or reduced.
- `combat/retaliation.ogg` - counterattack response.
- `combat/commander_death.ogg` - commander falls before reaper transition.
- `combat/boss_intro_stinger.ogg` - two-second boss alert before combat.
- `combat/boss_defeat_stinger.ogg` - boss defeat.
- `run/node_select.ogg` - choose daily road node.
- `run/shop_open.ogg` - daily run shop node.
- `run/omen_reveal.ogg` - omen/event node reveal.
- `run/map_scroll.ogg` - subtle scroll cue for long daily road map.
- `shop/buy.ogg` - shop purchase.
- `shop/sell.ogg` - city shop sell.
- `inventory/equip.ogg` - equip gear/spell/unit.
- `inventory/unequip.ogg` - unequip.
- `army/field_unit.ogg` - place unit in formation.
- `army/swap_units.ogg` - swap formation units.
- `army/recruit.ogg` - recruit gained.
- `quest/accept.ogg` - quest accepted.
- `quest/complete.ogg` - quest completed popup.
- `job/start.ogg` - job queued/started.
- `job/complete.ogg` - job completed.
- `level/up.ogg` - commander level up.
- `chat/open.ogg` - chat opens.
- `chat/send.ogg` - message sent.

## Generation Prompts

- Reaper defeat: "short dark fantasy pixel-game stinger, low choir breath, distant bell, smoky reverse cymbal, 2 seconds, no melody, no vocals, seamless tail, ogg-friendly".
- Boss intro: "gothic tactical RPG boss alert, heavy low drum, cathedral bell, magical flare, 2 seconds, dramatic but not orchestral, no vocals".
- Heal spell: "soft holy magic heal sound, candle glow, warm chime, gentle shimmer, 1 second, fantasy RPG UI-safe".
- Shadow debuff: "dark curse impact, low whisper-like texture without words, brittle magic crackle, 1 second".
- Quest complete: "satisfying parchment and warm chime reward sound, medieval fantasy, 1.5 seconds, positive but not cartoony".
- Daily run map node: "small tactical map node select sound, stone token click, subtle magic pulse, 0.4 seconds".
