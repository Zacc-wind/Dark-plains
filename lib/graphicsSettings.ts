import { readGameJson, writeGameJson } from './gameStore';

export type GraphicsQuality = 'low' | 'medium' | 'high';

export const GRAPHICS_QUALITY_SETTING_KEY = 'wizardy_graphics_quality';
export const GRAPHICS_QUALITY_EVENT_NAME = 'wizardy-graphics-quality-changed';

export const GRAPHICS_QUALITY_OPTIONS: Array<{ id: GraphicsQuality; label: string; detail: string }> = [
  { id: 'low', label: 'Low', detail: 'Best for integrated graphics — fog and ambient FX off' },
  { id: 'medium', label: 'Medium', detail: 'Reduced fog and particle density' },
  { id: 'high', label: 'High', detail: 'Full map fog, ambient FX, and combat particles' },
];

export function isGraphicsQuality(value: unknown): value is GraphicsQuality {
  return value === 'low' || value === 'medium' || value === 'high';
}

function prefersReducedMotion(): boolean {
  if (typeof window === 'undefined') return false;
  try {
    return window.matchMedia('(prefers-reduced-motion: reduce)').matches;
  } catch {
    return false;
  }
}

function suggestLowFromHardware(): boolean {
  if (typeof navigator === 'undefined') return false;
  const cores = Number(navigator.hardwareConcurrency || 0);
  if (cores > 0 && cores <= 4) return true;
  const memory = Number((navigator as Navigator & { deviceMemory?: number }).deviceMemory || 0);
  if (memory > 0 && memory <= 4) return true;
  return false;
}

export function resolveDefaultGraphicsQuality(): GraphicsQuality {
  if (prefersReducedMotion() || suggestLowFromHardware()) return 'low';
  return 'medium';
}

export function readGraphicsQualitySetting(): GraphicsQuality {
  const stored = readGameJson<unknown>(GRAPHICS_QUALITY_SETTING_KEY, null);
  if (isGraphicsQuality(stored)) return stored;
  return resolveDefaultGraphicsQuality();
}

export function writeGraphicsQualitySetting(quality: GraphicsQuality): void {
  writeGameJson(GRAPHICS_QUALITY_SETTING_KEY, quality);
  if (typeof document !== 'undefined') {
    applyGraphicsQualityToDocument(quality);
  }
  if (typeof window !== 'undefined') {
    window.dispatchEvent(new CustomEvent(GRAPHICS_QUALITY_EVENT_NAME, { detail: { quality } }));
  }
}

export function applyGraphicsQualityToDocument(quality: GraphicsQuality = readGraphicsQualitySetting()): void {
  if (typeof document === 'undefined') return;
  document.body.classList.remove('graphics-low', 'graphics-medium', 'graphics-high');
  document.body.classList.add(`graphics-${quality}`);
  document.body.dataset.graphicsQuality = quality;
}

export function isHeavyUiOverlayOpen(): boolean {
  if (typeof document === 'undefined') return false;
  return document.body.classList.contains('battle-open')
    || document.body.classList.contains('daily-run-open');
}

export function shouldEnableMapFog(quality: GraphicsQuality = readGraphicsQualitySetting()): boolean {
  return quality !== 'low' && !prefersReducedMotion();
}

export function shouldEnableAmbientFx(quality: GraphicsQuality = readGraphicsQualitySetting()): boolean {
  return quality === 'high' && !prefersReducedMotion();
}

export function shouldEnableFxBursts(quality: GraphicsQuality = readGraphicsQualitySetting()): boolean {
  return quality !== 'low' && !prefersReducedMotion();
}

export function shouldEnableCombatThreeFx(quality: GraphicsQuality = readGraphicsQualitySetting()): boolean {
  return quality !== 'low' && !prefersReducedMotion();
}

export function shouldEnableBattleBackdropBlur(quality: GraphicsQuality = readGraphicsQualitySetting()): boolean {
  return quality === 'high';
}

export function getMapAnimIntervalMs(quality: GraphicsQuality = readGraphicsQualitySetting()): number {
  if (quality === 'low') return 100;
  if (quality === 'medium') return 66;
  return 33;
}

export function getBattleTickMs(quality: GraphicsQuality = readGraphicsQualitySetting(), battleActive: boolean): number {
  if (!battleActive) return 1000;
  if (quality === 'low') return 200;
  if (quality === 'medium') return 100;
  return 50;
}

export function getMapFogPixelRatioCap(quality: GraphicsQuality = readGraphicsQualitySetting()): number {
  if (quality === 'low') return 1;
  if (quality === 'medium') return 1;
  return 1.5;
}

export function getMapImageSmoothingQuality(quality: GraphicsQuality = readGraphicsQualitySetting()): ImageSmoothingQuality {
  return quality === 'high' ? 'high' : 'medium';
}

export function shouldDrawMapShadows(quality: GraphicsQuality = readGraphicsQualitySetting()): boolean {
  return quality !== 'low';
}

export function shouldDrawCampfireParticles(quality: GraphicsQuality = readGraphicsQualitySetting()): boolean {
  return quality === 'high';
}

export function getFxQualityScale(quality: GraphicsQuality = readGraphicsQualitySetting()): {
  ambientCountScale: number;
  burstScale: number;
  renderScale: number;
  pixelRatioCap: number;
} {
  if (quality === 'low') {
    return { ambientCountScale: 0, burstScale: 0, renderScale: 0.5, pixelRatioCap: 1 };
  }
  if (quality === 'medium') {
    return { ambientCountScale: 0, burstScale: 0.55, renderScale: 0.7, pixelRatioCap: 1 };
  }
  return { ambientCountScale: 1, burstScale: 1, renderScale: 1, pixelRatioCap: 1.35 };
}
