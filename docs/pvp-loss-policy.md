# PVP Loss Policy

PVP should create tension without letting one player erase another player's progress.

## Current Decision
- No permanent minion death from PVP.
- No equipped item loss from PVP.
- No inventory theft from PVP.
- The loser can lose a small amount of gold, capped by level.
- The winner can gain gold, XP, and a battle report.
- Both players keep a history entry with the opponent, result, and rewards.

## Suggested Formula
- Gold at risk: `min(currentGold * 0.04, level * 35)`, rounded down.
- Winner XP: `10 + opponentLevel * 4`, reduced if fighting far below their level.
- If the defender is more than 5 levels lower, the existing level shield blocks the challenge.
- If the attacker fights upward, rewards can stay full because the risk is voluntary.

## Why This Rule
This keeps PVP useful for rivalry, reports, and social pressure while protecting the long-term army-building loop. Permanent death should stay reserved for NPC battles, dungeons, and story fights where the player intentionally opts into that risk.
