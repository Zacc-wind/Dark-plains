import { describe, expect, it } from 'vitest';
import {
  getBattleTickMs,
  getMapAnimIntervalMs,
  isGraphicsQuality,
  resolveDefaultGraphicsQuality,
  shouldEnableAmbientFx,
  shouldEnableBattleBackdropBlur,
  shouldEnableCombatThreeFx,
  shouldEnableMapFog,
} from './graphicsSettings';

describe('graphicsSettings', () => {
  it('accepts only low medium high', () => {
    expect(isGraphicsQuality('low')).toBe(true);
    expect(isGraphicsQuality('medium')).toBe(true);
    expect(isGraphicsQuality('high')).toBe(true);
    expect(isGraphicsQuality('ultra')).toBe(false);
  });

  it('scales map and battle cadence by quality', () => {
    expect(getMapAnimIntervalMs('low')).toBeGreaterThan(getMapAnimIntervalMs('high'));
    expect(getBattleTickMs('low', true)).toBeGreaterThan(getBattleTickMs('high', true));
    expect(getBattleTickMs('high', false)).toBe(1000);
  });

  it('gates expensive layers on low', () => {
    expect(shouldEnableMapFog('low')).toBe(false);
    expect(shouldEnableAmbientFx('low')).toBe(false);
    expect(shouldEnableCombatThreeFx('low')).toBe(false);
    expect(shouldEnableBattleBackdropBlur('low')).toBe(false);
    expect(shouldEnableBattleBackdropBlur('high')).toBe(true);
  });

  it('resolves a default quality', () => {
    expect(isGraphicsQuality(resolveDefaultGraphicsQuality())).toBe(true);
  });
});
