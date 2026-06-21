import { readGameJson, writeGameJson } from '@/lib/gameStore';

export type GameMode = 'singleplayer' | 'multiplayer';

const GAME_MODE_KEY = 'wizardy_game_mode';

export function readGameMode(): GameMode | null {
  const mode = readGameJson<GameMode | null>(GAME_MODE_KEY, null);
  if (mode === 'singleplayer' || mode === 'multiplayer') return mode;
  return null;
}

export function writeGameMode(mode: GameMode): void {
  writeGameJson(GAME_MODE_KEY, mode);
}

export function clearGameMode(): void {
  writeGameJson(GAME_MODE_KEY, null);
}

/**
 * Progress is tracked separately per mode:
 * - multiplayer: main `User` profile (map position, army, quests, gold, XP)
 * - singleplayer: `User.dailyRun` meta + active session in `pirate_game_daily_run_session_*`
 */
