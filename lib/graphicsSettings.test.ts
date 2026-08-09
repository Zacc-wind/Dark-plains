import { describe, expect, it } from 'vitest';
import {
  GRAPHICS_HUGE_VIEWPORT_AREA,
  GRAPHICS_LARGE_VIEWPORT_AREA,
  MAP_CANVAS_MAX_EDGE,
  getBattleTickMs,
  getMapAnimIntervalMs,
  getMapCanvasMaxEdge,
  getMapCanvasRenderSize,
  getMapFogFrameStride,
  getMapFogPixelRatioCap,
  getMapFogRenderScale,
  isGraphicsQuality,
  resolveDefaultGraphicsQuality,
  shouldAnimateMapFogGrain,
  shouldDrawRichMapMarkers,
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
    expect(shouldDrawRichMapMarkers('low')).toBe(false);
    expect(shouldDrawRichMapMarkers('high')).toBe(true);
  });

  it('caps map canvas resolution by quality and viewport area', () => {
    expect(getMapCanvasMaxEdge('high', 1920, 1080)).toBe(MAP_CANVAS_MAX_EDGE.high);
    expect(getMapCanvasMaxEdge('high', 2560, 1440)).toBe(MAP_CANVAS_MAX_EDGE.medium);
    expect(getMapCanvasMaxEdge('high', 3840, 2160)).toBe(MAP_CANVAS_MAX_EDGE.low);

    const fourK = getMapCanvasRenderSize(3840, 2160, 'high');
    expect(fourK.scale).toBeLessThan(1);
    expect(Math.max(fourK.width, fourK.height)).toBeLessThanOrEqual(MAP_CANVAS_MAX_EDGE.low);
    expect(fourK.width * fourK.height).toBeLessThan(GRAPHICS_HUGE_VIEWPORT_AREA);

    const desktop = getMapCanvasRenderSize(1600, 900, 'medium');
    expect(desktop.scale).toBe(1);
    expect(desktop.width).toBe(1600);
  });

  it('downscales fog fill rate on medium and large monitors', () => {
    expect(getMapFogPixelRatioCap('high')).toBe(1.25);
    expect(getMapFogRenderScale('low')).toBe(0);
    expect(getMapFogRenderScale('medium', 1920, 1080)).toBeCloseTo(0.55);
    expect(getMapFogRenderScale('high', 1920, 1080)).toBeCloseTo(0.75);
    expect(getMapFogRenderScale('high', 3840, 2160)).toBeLessThan(getMapFogRenderScale('high', 1920, 1080));
    expect(getMapFogFrameStride('medium')).toBe(2);
    expect(getMapFogFrameStride('high')).toBe(1);
    expect(shouldAnimateMapFogGrain('medium')).toBe(false);
    expect(GRAPHICS_LARGE_VIEWPORT_AREA).toBeLessThan(GRAPHICS_HUGE_VIEWPORT_AREA);
  });

  it('resolves a default quality', () => {
    expect(isGraphicsQuality(resolveDefaultGraphicsQuality())).toBe(true);
  });
});
