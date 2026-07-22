import { describe, expect, it } from 'vitest';
import { FULL_STRENGTH_HEALS_PER_BATTLE, getDiminishedHealAmount } from './battle';

describe('repeated healing', () => {
  it('keeps the first two heals at full strength and halves the third onward', () => {
    expect(FULL_STRENGTH_HEALS_PER_BATTLE).toBe(2);
    expect(getDiminishedHealAmount(21, 0)).toBe(21);
    expect(getDiminishedHealAmount(21, 1)).toBe(21);
    expect(getDiminishedHealAmount(21, 2)).toBe(10);
    expect(getDiminishedHealAmount(21, 6)).toBe(10);
  });

  it('never reduces a valid heal below one health', () => {
    expect(getDiminishedHealAmount(1, 2)).toBe(1);
  });
});
