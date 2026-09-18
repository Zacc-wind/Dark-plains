# Remake From Story

Practical direction for reshaping Dark Plains so the campaign matches `docs/STORY_BIBLE.md`.

## Guiding principle

- **`docs/STORY_BIBLE.md` is source of truth for narrative** (tone, cosmology, cause→effect, cast, motifs, canon rules).
- **`docs/STATUS.md` is source of truth for the ops queue** (what is in flight, parked, or blocked).
- Design roadmaps (`multiplayer-roadmap.md`, `progression-content-roadmap.md`, combat/sound/tutorial docs, `pvp-loss-policy.md`) remain valid for systems. When they disagree with the bible on *story meaning*, prefer the bible; when they disagree with STATUS on *what to build next*, prefer STATUS.

**Product direction (Filip):** stop status-checking as the main push. Write the story foundation, then remake the game toward it. Park P0/auth and side-fill issue #5 until Filip unparks them. This story remake is now the product direction.

Do **not** implement gameplay systems in the bible pass. No new bands past 30 until phases A–D below are honest.

## What to keep

- Core loops: world map travel, towns, jobs/contracts, formation combat, commander-must-stand rule.
- SP roguelike vs MP campaign split (separate ownership; shared mythic vocabulary).
- Existing towns and POIs already in the game: Harborview, Riverside, Moonbridge / Moonwell Pier, Ashford, Blackwater Gate, Eclipse Hold, East Road Camp, Crossroads Camp, Granite Heights Quarry, Shadowgrove, Witherfield Farm, etc.
- Chapter/quest **ids** and boss **ids** already shipped (First Banner through Lady in Glass, including side elites).
- Three response tones: oathbound / pragmatic / defiant as lenses, not branching novels.
- Chronicle tracks (Black Pike Ledger, Glass Road Memorial) as lore receipts, not only reward ladders.
- Soft PvP stakes (`docs/pvp-loss-policy.md`).
- Hosted session/combat infrastructure already built—story remake rides on top; it does not rip out netcode.

## What to rewrite first

1. **Dialogue density** in `lib/storyDialogue.ts` — scenes are currently order-giving; deepen motive, consequence, and callback to prior receipts without exploding choice trees.
2. **Chapter III spine (Broken Crown)** — add connective tissue from the bible (freed names as Iron Choir raw material; Marshal as waking-test; crown as lesson, not loot). Keep ids `story-11-eastward-march` … `story-15-broken-crown`.
3. **World-state after bosses** — expand post-seal NPC voice (see `getQuestNpcWorldVoice` patterns) so sealing Moonwell / breaking the crown / sealing glass / key / court changes town boards and lines coast-wide.
4. **Travel events as story texture** — travel encounters should echo current movement motifs (toll residue, drowned ink, hymn practice, glass scouts, cracked bells), not generic RNG flavor.
5. **Quest lore strings** in `STORY_CHAPTERS` — align summaries with the six-movement cause→effect language while preserving ids.

## Remake phases

### Phase A — Bible locked

- Review `STORY_BIBLE.md` with Filip.
- Note allowed deviations (none assumed).
- STATUS points at bible + this doc.
- Issue “Story bible remake” tracks the shift.

### Phase B — Chapter dialogue / spine rewrite to match bible

- Pass over Movements I–VI dialogue in order.
- Prioritize III (Broken Crown), then VI callbacks, then I–II densification, then IV–V polish.
- Keep tones non-branching.
- Update chapter summaries/lore blurb consistency.

### Phase C — Side stories as character arcs

- Silk / Tithe / Ash / Writ / Synod already exist—rewrite them as arteries of the spine (motif receipts), not optional chores.
- Tie returns more clearly to Avel / Naima / Kaito / Yara / Sable relationships.

### Phase D — World reactions

- Post-boss coastal voice, contract unlocks, chronicle entitlement copy, regional threat flavor.
- Ensure sealing events change the map’s *feeling*, not only checkboxes.

### Phase E — Only then new bands past 30

- Endgame board / seasons may use open mysteries from the bible.
- No new level bands until A–D leave Movements I–VI feeling like one novelistic campaign.

## Explicit parks

Until Filip says otherwise:

- Park **P0 / auth / Vercel env / hosted smoke / trust PATCH** work as the primary push (issues #1–#4 remain listed but are not the story remake’s critical path).
- Park **side-fill issue #5** (and similar content-volume fills) until bible-aligned rewrites of existing sides land.
- Park bespoke art, 120 map, seasonal PVP, guilds, 4-player veteran dungeons (unchanged from prior STATUS parks).

## Success criteria for the remake (narrative)

- A player can summarize Movements I→VI as one cause chain without consulting a checklist.
- Broken Crown feels necessary, not a bridge pack.
- After each capstone, the coast *talks differently*.
- SP still reads as omen/echo war; MP still reads as living coast—without crossing economies.

## Non-goals

- No gameplay combat redesign in this track unless a story beat is unblockable without it.
- No mass id renames.
- No resolving season mysteries listed as open in the bible.
- No returning to status-chasing as the product center until Filip asks for it.

## Dialogue rewrite checklist (Phase B)

For each mainline scene in Movements I–VI:

1. Open with a consequence from the previous movement (receipt object or named fallout).
2. Give the guide a want and a sin in the same speech—never pure quest GPS.
3. Keep the three tone replies as lenses on the *same* objective.
4. End with a concrete field order that matches the existing requirement type.
5. After boss returns, have the guide state what the coast will do differently tomorrow.

Do not add parallel questlines. Do not invent new mid-bosses unless Filip asks; deepen the ones already wired.

## Broken Crown beat sheet (keep ids)

Use this connective tissue when rewriting `story-11`…`story-15` dialogue:

1. **Eastward march (Yara):** Moonwell’s returned names are unprotected raw material; iron hymns smell freed ink.
2. **Blackwater Gate (Yara):** Gate still answers living commanders while the hymn is unfinished; walk the walls before steel learns you.
3. **Paragon vow (Serat):** Marshal is the midpoint conductor; Grave-Aurel will not fully wake for an untested banner.
4. **Eclipse field (Serat):** Silence the Marshal so the field cannot finish singing the player’s formation.
5. **Broken Crown (Serat):** Take the crown *lesson*—commanders who rule alone become funeral armor—before the Mirror Court wears the victory as glass.

Sides that touch this band later (Ash Pilgrim) should explicitly say the false ash omens are trying to recruit the same pilgrim vows the choir would rather sing.

## Travel-event motif map (Phase B/D)

| Current movement | Prefer travel textures |
| --- | --- |
| I First Banner | illegal toll residue, pike scouts, hospitaller lanterns |
| II Drowned Moonwell | drowned ink, wrong-answering bells, candle-fire recruiters |
| III Broken Crown | iron hymn practice, ash pilgrim omens, gate writ checkpoints |
| IV Glass Road | mirrored scout colors, forged plates, quarry glass dust |
| V Candle Key | cracked synod rings, blue-oath cold spots, fragment hunters |
| VI Lady in Glass | reflected warbands of old victories, red-thread omens, quiet shards |

When implementing, prefer tagging existing travel tables with movement awareness over inventing a second encounter system.
