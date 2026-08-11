import { describe, expect, it } from 'vitest';
import {
  getRandomRunBattlePressure,
  getRandomRunScaledBattleLevel,
  RANDOM_RUN_BALANCE,
} from './auth';

describe('random run battle pressure', () => {
  it('soft-starts early fights and ramps toward the end', () => {
    expect(getRandomRunBattlePressure(1, 12)).toBeLessThan(getRandomRunBattlePressure(6, 12));
    expect(getRandomRunBattlePressure(6, 12)).toBeLessThan(getRandomRunBattlePressure(12, 12));
  });

  it('keeps opening battles below mid-route levels', () => {
    const opening = getRandomRunScaledBattleLevel(10, 1, 12);
    const mid = getRandomRunScaledBattleLevel(10, 6, 12);
    const finale = getRandomRunScaledBattleLevel(10, 12, 12);
    expect(opening).toBeLessThanOrEqual(mid);
    expect(mid).toBeLessThanOrEqual(finale);
    expect(opening).toBeGreaterThanOrEqual(1);
    expect(finale).toBeLessThanOrEqual(RANDOM_RUN_BALANCE.enemyLevelCap);
  });
});
