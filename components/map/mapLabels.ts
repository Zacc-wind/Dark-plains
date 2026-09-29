export const MAP_LABEL_BONE = '#efe6d2';
export const MAP_LABEL_FONT_FALLBACK = '"Cinzel", Georgia, serif';
const MAP_LABEL_FONT_VARS = ['--font-display-map', '--font-label'];
const MAP_LABEL_PLATE_FILL = 'rgba(10, 8, 11, 0.72)';
const MAP_LABEL_PLATE_BORDER = 'rgba(239, 230, 210, 0.2)';

let resolvedFamily: string | null = null;
const fontStrings = new Map<number, string>();
const textWidths = new Map<string, Map<string, number>>();

function readFontVar(name: string): string {
  if (typeof document === 'undefined') return '';
  const fromRoot = getComputedStyle(document.documentElement).getPropertyValue(name).trim();
  if (fromRoot) return fromRoot;
  return document.body ? getComputedStyle(document.body).getPropertyValue(name).trim() : '';
}

export function getMapLabelFontFamily(): string {
  if (resolvedFamily) return resolvedFamily;
  if (typeof document === 'undefined') return MAP_LABEL_FONT_FALLBACK;
  let family = '';
  for (const name of MAP_LABEL_FONT_VARS) {
    family = readFontVar(name);
    if (family) break;
  }
  resolvedFamily = family ? `${family}, ${MAP_LABEL_FONT_FALLBACK}` : MAP_LABEL_FONT_FALLBACK;
  return resolvedFamily;
}

/** Bold canvas font string for the map label family; cached per size to avoid per-frame string building. */
export function getMapLabelFont(fontSize: number): string {
  const key = Math.round(fontSize * 10);
  let font = fontStrings.get(key);
  if (!font) {
    font = `700 ${key / 10}px ${getMapLabelFontFamily()}`;
    fontStrings.set(key, font);
  }
  return font;
}

/** Call after web fonts finish loading or the theme changes: widths measured with a fallback font are stale. */
export function resetMapLabelCache(): void {
  resolvedFamily = null;
  fontStrings.clear();
  textWidths.clear();
}

export function measureMapLabel(ctx: CanvasRenderingContext2D, font: string, text: string): number {
  let widths = textWidths.get(font);
  if (!widths) {
    widths = new Map();
    textWidths.set(font, widths);
  }
  let width = widths.get(text);
  if (width === undefined) {
    ctx.font = font;
    width = ctx.measureText(text).width;
    widths.set(text, width);
  }
  return width;
}

function traceRoundedRect(ctx: CanvasRenderingContext2D, x: number, y: number, width: number, height: number, radius: number): void {
  if (typeof ctx.roundRect === 'function') {
    ctx.roundRect(x, y, width, height, radius);
    return;
  }
  const r = Math.min(radius, width / 2, height / 2);
  ctx.moveTo(x + r, y);
  ctx.arcTo(x + width, y, x + width, y + height, r);
  ctx.arcTo(x + width, y + height, x, y + height, r);
  ctx.arcTo(x, y + height, x, y, r);
  ctx.arcTo(x, y, x + width, y, r);
  ctx.closePath();
}

/**
 * Draws a label centered on `centerX` with its backing plate starting at `top` (CSS pixels).
 * Callers are expected to have the canvas transform already scaled for devicePixelRatio.
 */
export function drawMapPlateLabel(
  ctx: CanvasRenderingContext2D,
  text: string,
  centerX: number,
  top: number,
  color: string = MAP_LABEL_BONE,
  fontSize = 13,
  alpha = 1,
): void {
  if (!text) return;
  ctx.save();
  const font = getMapLabelFont(fontSize);
  const textWidth = measureMapLabel(ctx, font, text);
  const padX = fontSize * 0.55;
  const padY = fontSize * 0.3;
  const plateWidth = textWidth + padX * 2;
  const plateHeight = fontSize + padY * 2;
  const left = centerX - plateWidth / 2;

  ctx.globalAlpha = Math.max(0, Math.min(1, alpha));
  ctx.beginPath();
  traceRoundedRect(ctx, left, top, plateWidth, plateHeight, Math.min(6, plateHeight / 2));
  ctx.fillStyle = MAP_LABEL_PLATE_FILL;
  ctx.fill();
  ctx.lineWidth = 1;
  ctx.strokeStyle = MAP_LABEL_PLATE_BORDER;
  ctx.stroke();
  ctx.font = font;
  ctx.textAlign = 'center';
  ctx.textBaseline = 'middle';
  ctx.fillStyle = color;
  ctx.fillText(text, centerX, top + plateHeight / 2 + fontSize * 0.06);
  ctx.restore();
}
