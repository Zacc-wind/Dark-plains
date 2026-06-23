# Audio Asset Sources

This folder holds starter sound effects for UI, map, combat, inventory, and quest feedback.

## Sources

- `ui/*`, `world/*`, `inventory/coins.ogg`, `combat/melee_slice.ogg`, and `combat/weapon_draw.ogg` are from Kenney's CC0 sound packs.
  - UI Audio: https://www.kenney.nl/assets/ui-audio
  - RPG Audio / sound pack mirror used for direct file download: https://gamesounds.xyz/?dir=Kenney%27s+Sound+Pack
- `combat/unit_hurt.ogg`, `combat/unit_death.wav`, `combat/boss_roar.ogg`, `combat/heal.ogg`, `combat/mana_focus.ogg`, `combat/spell_cast.ogg`, `combat/spell_hit.ogg`, `combat/spell_fire.ogg`, `combat/buff.ogg`, `combat/control.ogg`, `combat/spell_flame.ogg`, `combat/spell_lightning.ogg`, `combat/spell_shadow.ogg`, `combat/spell_frost.ogg`, `combat/spell_holy.ogg`, `combat/victory.ogg`, `combat/defeat.ogg`, `inventory/gold_gain.ogg`, `inventory/gem_gain.ogg`, and `quest/quest_claim.ogg` are from OpenGameArt's "80 CC0 RPG SFX" by rubberduck, except `combat/unit_death.wav` which uses remaxim's soft male exhale (`death-candidates/02_male_soft_exhale.wav`).
  - https://opengameart.org/content/80-cc0-rpg-sfx

Both source sets are listed as CC0. Attribution is not required by the licenses, but keeping source notes here helps us track provenance.

## Naming

Use stable gameplay names instead of source pack names. For example, `combat/unit_hurt.ogg` is the sound event name the game should care about; the source filename is only provenance.
