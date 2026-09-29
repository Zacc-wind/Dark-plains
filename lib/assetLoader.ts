import { ASSET_VERSION } from '@/lib/generated/assetVersion';

export function getVersionedAssetPath(path: string): string {
  if (!path.startsWith('/assets/')) return path;
  const separator = path.includes('?') ? '&' : '?';
  return `${path}${separator}v=${ASSET_VERSION}`;
}

// Helper to load and cache image assets
export class AssetLoader {
  private static imageCache: Map<string, HTMLImageElement> = new Map();
  private static loadingPromises: Map<string, Promise<HTMLImageElement>> = new Map();
  private static failedPaths: Set<string> = new Set();
  private static loadListeners: Set<(path: string) => void> = new Set();
  private static devCacheBust = process.env.NODE_ENV === 'development' ? `?v=${Date.now()}` : '';

  private static getCacheKey(path: string): string {
    const basePath = path.split('?')[0];
    if (!basePath.startsWith('/assets/')) {
      return path;
    }
    return getVersionedAssetPath(basePath);
  }

  private static resolveSrc(path: string): string {
    if (!this.devCacheBust) return path;
    return `${path}${path.includes('?') ? '&' : '?'}${this.devCacheBust.slice(1)}`;
  }

  static clearCache(path?: string): void {
    if (path) {
      const cacheKey = this.getCacheKey(path);
      this.imageCache.delete(cacheKey);
      this.loadingPromises.delete(cacheKey);
      this.failedPaths.delete(cacheKey);
      return;
    }
    this.imageCache.clear();
    this.loadingPromises.clear();
    this.failedPaths.clear();
  }

  /** Subscribe to successful image loads (e.g. to redraw a canvas once a lazily requested sprite arrives). */
  static onImageLoaded(listener: (path: string) => void): () => void {
    this.loadListeners.add(listener);
    return () => {
      this.loadListeners.delete(listener);
    };
  }

  /**
   * Returns the cached image, or starts loading it in the background and returns null.
   * Failed paths are not retried, so this is safe to call every frame.
   */
  static requestImage(path: string): HTMLImageElement | null {
    const cacheKey = this.getCacheKey(path);
    const cached = this.imageCache.get(cacheKey);
    if (cached) return cached;
    if (typeof window === 'undefined') return null;
    if (!this.loadingPromises.has(cacheKey) && !this.failedPaths.has(cacheKey)) {
      this.loadImage(path).catch(() => undefined);
    }
    return null;
  }

  static async loadImage(path: string): Promise<HTMLImageElement> {
    const cacheKey = this.getCacheKey(path);

    // Return cached image if available
    if (this.imageCache.has(cacheKey)) {
      return this.imageCache.get(cacheKey)!;
    }

    // Return existing loading promise if already loading
    if (this.loadingPromises.has(cacheKey)) {
      return this.loadingPromises.get(cacheKey)!;
    }

    // Create new loading promise
    const loadPromise = new Promise<HTMLImageElement>((resolve, reject) => {
      const img = new Image();
      img.onload = () => {
        this.imageCache.set(cacheKey, img);
        this.loadingPromises.delete(cacheKey);
        this.failedPaths.delete(cacheKey);
        resolve(img);
        this.loadListeners.forEach(listener => listener(cacheKey));
      };
      img.onerror = () => {
        this.loadingPromises.delete(cacheKey);
        this.failedPaths.add(cacheKey);
        reject(new Error(`Failed to load image: ${cacheKey}`));
      };
      img.src = this.resolveSrc(cacheKey);
    });

    this.loadingPromises.set(cacheKey, loadPromise);
    return loadPromise;
  }

  static getImage(path: string): HTMLImageElement | null {
    return this.imageCache.get(this.getCacheKey(path)) || null;
  }
}

// Asset paths
export const ASSET_PATHS = {
  map: {
    world: '/assets/world-map.jpg',
  },
  pois: {
    forest: '/assets/forest.png',
    mountain: '/assets/mountain.png',
    farm: '/assets/farm.png',
    hunting_lodge: '/assets/hunting-lodge.png',
    windmill: '/assets/windmill.png',
    crab_trap: '/assets/crab-trap.png',
    fishing_dock: '/assets/fishing-dock.png',
    granite_quarry: '/assets/granite-quarry.png',
    coffee_plantation: '/assets/coffee-plantation.png',
    campfire: '/assets/campfire.png',
    harborview: '/assets/town-harborview-map.png',
    riverside: '/assets/town-riverside-map.png',
  },
  towns: {
    harborviewBackground: '/assets/town-harborview-bg.png',
    riversideBackground: '/assets/town-riverside-bg.png',
  },
  runScenes: {
    battlefield: '/assets/battlefield-bg.png',
    harbor: '/assets/town-harborview-bg.png',
    riverside: '/assets/town-riverside-bg.png',
    road: '/assets/run-background.png',
  },
  icons: {
    attack: '/assets/icons/attack.png',
    defense: '/assets/icons/defense.png',
    speed: '/assets/icons/speed.png',
    gold: '/assets/icons/gold.png',
    health: '/assets/icons/health.png',
    xp: '/assets/icons/xp.png',
    lootChest: '/assets/icons/loot-chest.png',
    rareGem: '/assets/icons/rare-gem.png',
    magic: '/assets/icons/magic.png',
    healing: '/assets/icons/healing.png',
  },
  player: {
    model1: '/assets/playermodel1.png',
    model2: '/assets/playermodel2.png',
    model3: '/assets/playermodel3.png',
    model4: '/assets/playermodel4.png',
    model5: '/assets/playermodel5.png',
    model6: '/assets/playermodel6.png',
  },
  bosses: {
    boss1: '/assets/bosses/boss1.png',
    boss2: '/assets/bosses/boss2.png',
    boss3: '/assets/bosses/boss3.png',
    boss4: '/assets/bosses/boss4.png',
    boss5: '/assets/bosses/boss5.png',
    boss6: '/assets/bosses/boss6.png',
    boss7: '/assets/bosses/boss7.png',
    boss8: '/assets/bosses/boss8.png',
  },
};

export function getPlayerModelPath(modelNumber = 3): string {
  const normalizedModel = [1, 2, 3, 4, 5, 6].includes(modelNumber) ? modelNumber : 3;
  return getVersionedAssetPath(ASSET_PATHS.player[`model${normalizedModel}` as keyof typeof ASSET_PATHS.player]);
}

export function getMinionAssetPath(assetName: string): string {
  return getVersionedAssetPath(`/assets/minions/${assetName}`);
}

/** Everything the world map canvas draws: terrain, POI/town markers and character sprites. */
export function getMapCriticalAssetPaths(): string[] {
  return [
    ...Object.values(ASSET_PATHS.map),
    ...Object.values(ASSET_PATHS.pois),
    ...Object.values(ASSET_PATHS.player),
  ];
}

/** Scenes, icons and boss art that only modals / runs / battles need. */
export function getDeferredAssetPaths(): string[] {
  return Array.from(new Set([
    ...Object.values(ASSET_PATHS.towns),
    ...Object.values(ASSET_PATHS.runScenes),
    ...Object.values(ASSET_PATHS.icons),
    ...Object.values(ASSET_PATHS.bosses),
  ]));
}

/**
 * Loads only the assets the world map needs to draw. A single failed image never blocks the map;
 * missing sprites fall back to placeholder shapes and can be re-requested on demand.
 */
export async function preloadMapAssets(): Promise<void> {
  await Promise.allSettled(getMapCriticalAssetPaths().map(path => AssetLoader.loadImage(path)));
}

type IdleWindow = Window & {
  requestIdleCallback?: (callback: () => void, options?: { timeout: number }) => number;
  cancelIdleCallback?: (handle: number) => void;
};

/**
 * Warms the image cache for non-map assets a few at a time during idle periods so it never
 * competes with the first map paint. Returns a cancel function.
 */
export function preloadDeferredAssetsWhenIdle(options: { batchSize?: number; initialDelayMs?: number } = {}): () => void {
  if (typeof window === 'undefined') return () => undefined;
  const idleWindow = window as IdleWindow;
  const queue = getDeferredAssetPaths().filter(path => !AssetLoader.getImage(path));
  const batchSize = Math.max(1, options.batchSize ?? 3);
  let cancelled = false;
  let timeoutId = 0;
  let idleId = 0;

  const schedule = (delayMs: number) => {
    if (cancelled || queue.length === 0) return;
    timeoutId = window.setTimeout(() => {
      timeoutId = 0;
      if (idleWindow.requestIdleCallback) {
        idleId = idleWindow.requestIdleCallback(runBatch, { timeout: 4000 });
      } else {
        runBatch();
      }
    }, delayMs);
  };

  const runBatch = () => {
    idleId = 0;
    if (cancelled) return;
    const batch = queue.splice(0, batchSize);
    void Promise.allSettled(batch.map(path => AssetLoader.loadImage(path))).then(() => schedule(250));
  };

  schedule(options.initialDelayMs ?? 1500);

  return () => {
    cancelled = true;
    if (timeoutId) window.clearTimeout(timeoutId);
    if (idleId && idleWindow.cancelIdleCallback) idleWindow.cancelIdleCallback(idleId);
  };
}

/** Eagerly loads every known asset. Prefer preloadMapAssets + preloadDeferredAssetsWhenIdle. */
export async function preloadAllAssets(): Promise<void> {
  await Promise.allSettled([
    ...getMapCriticalAssetPaths(),
    ...getDeferredAssetPaths(),
  ].map(path => AssetLoader.loadImage(path)));
}
