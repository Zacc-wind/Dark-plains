import { readGameJson, writeGameJson } from './gameStore';

export type CombatSpeed = 'normal' | 'fast' | 'instant';

export const COMBAT_SPEED_SETTING_KEY = 'wizardy_combat_speed';

export const COMBAT_SPEED_OPTIONS: Array<{ id: CombatSpeed; label: string }> = [
  { id: 'normal', label: 'Normal' },
  { id: 'fast', label: 'Fast' },
  { id: 'instant', label: 'Instant' },
];

export function isCombatSpeed(value: unknown): value is CombatSpeed {
  return value === 'normal' || value === 'fast' || value === 'instant';
}

export function readCombatSpeedSetting(): CombatSpeed {
  const value = readGameJson<unknown>(COMBAT_SPEED_SETTING_KEY, 'normal');
  return isCombatSpeed(value) ? value : 'normal';
}

export function writeCombatSpeedSetting(speed: CombatSpeed): void {
  writeGameJson(COMBAT_SPEED_SETTING_KEY, speed);
}
