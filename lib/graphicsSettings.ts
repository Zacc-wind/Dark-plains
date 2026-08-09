import { readGameJson, writeGameJson } from './gameStore';

export type GraphicsQuality = 'low' | 'medium' | 'high';

export const GRAPHICS_QUALITY_SETTING_KEY = 'wizardy_graphics_quality';
export const GRAPHICS_QUALITY_EVENT_NAME = 'wizardy-graphics-quality-changed';

export const GRAPHICS_QUALITY_OPTIONS: Array<{ id: GraphicsQuality; label: string; detail: string }> = [
  { id: 'low', label: 'Low', detail: 'Best for integrated graphics — no fog, capped map resolution, ambient FX off' },
  { id: 'medium', label: 'Medium', detail: 'Downscaled fog and map resolution with reduced particle density' },
  { id: 'high', label: 'High', detail: 'Full map fog, ambient FX, and combat particles (still capped at 4K)' },
];

/** Soft fill-rate clamps for large monitors (matches FX overlay area thresholds). */
export const GRAPHICS_LARGE_VIEWPORT_AREA = 3_600_000;
export const GRAPHICS_HUGE_VIEWPORT_AREA = 7_000_000;

export const MAP_CANVAS_MAX_EDGE: Record<GraphicsQuality, number> = {
  low: 1280,
  medium: 1600,
  high: 1920,
};

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
  return 1.25;
}

export function getMapCanvasMaxEdge(
  quality: GraphicsQuality = readGraphicsQualitySetting(),
  cssWidth = 0,
  cssHeight = 0,
): number {
  let maxEdge = MAP_CANVAS_MAX_EDGE[quality];
  const area = Math.max(0, cssWidth) * Math.max(0, cssHeight);
  if (area >= GRAPHICS_HUGE_VIEWPORT_AREA) {
    maxEdge = Math.min(maxEdge, MAP_CANVAS_MAX_EDGE.low);
  } else if (area >= GRAPHICS_LARGE_VIEWPORT_AREA) {
    maxEdge = Math.min(maxEdge, MAP_CANVAS_MAX_EDGE.medium);
  }
  return maxEdge;
}

export function getMapCanvasRenderSize(
  cssWidth: number,
  cssHeight: number,
  quality: GraphicsQuality = readGraphicsQualitySetting(),
): { width: number; height: number; scale: number } {
  const safeWidth = Math.max(1, Math.ceil(cssWidth));
  const safeHeight = Math.max(1, Math.ceil(cssHeight));
  const maxEdge = getMapCanvasMaxEdge(quality, safeWidth, safeHeight);
  const scale = Math.min(1, maxEdge / Math.max(safeWidth, safeHeight));
  return {
    width: Math.max(1, Math.floor(safeWidth * scale)),
    height: Math.max(1, Math.floor(safeHeight * scale)),
    scale,
  };
}

export function getMapFogRenderScale(
  quality: GraphicsQuality = readGraphicsQualitySetting(),
  cssWidth = 0,
  cssHeight = 0,
): number {
  if (quality === 'low') return 0;
  let scale = quality === 'medium' ? 0.55 : 0.75;
  const area = Math.max(0, cssWidth) * Math.max(0, cssHeight);
  if (area >= GRAPHICS_HUGE_VIEWPORT_AREA) {
    scale *= 0.72;
  } else if (area >= GRAPHICS_LARGE_VIEWPORT_AREA) {
    scale *= 0.85;
  }
  return Math.max(0.35, Math.min(1, scale));
}

export function shouldAnimateMapFogGrain(quality: GraphicsQuality = readGraphicsQualitySetting()): boolean {
  return quality === 'high' && !prefersReducedMotion();
}

export function getMapFogFrameStride(quality: GraphicsQuality = readGraphicsQualitySetting()): number {
  return quality === 'medium' ? 2 : 1;
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

export function shouldDrawRichMapMarkers(quality: GraphicsQuality = readGraphicsQualitySetting()): boolean {
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
