// Helper to load and cache image assets
export class AssetLoader {
  private static imageCache: Map<string, HTMLImageElement> = new Map();
  private static loadingPromises: Map<string, Promise<HTMLImageElement>> = new Map();

  static async loadImage(path: string): Promise<HTMLImageElement> {
    // Return cached image if available
    if (this.imageCache.has(path)) {
      return this.imageCache.get(path)!;
    }

    // Return existing loading promise if already loading
    if (this.loadingPromises.has(path)) {
      return this.loadingPromises.get(path)!;
    }

    // Create new loading promise
    const loadPromise = new Promise<HTMLImageElement>((resolve, reject) => {
      const img = new Image();
      img.onload = () => {
        this.imageCache.set(path, img);
        this.loadingPromises.delete(path);
        resolve(img);
      };
      img.onerror = () => {
        this.loadingPromises.delete(path);
        reject(new Error(`Failed to load image: ${path}`));
      };
      img.src = path;
    });

    this.loadingPromises.set(path, loadPromise);
    return loadPromise;
  }

  static getImage(path: string): HTMLImageElement | null {
    return this.imageCache.get(path) || null;
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
    road: '/assets/world-map.jpg',
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
  return ASSET_PATHS.player[`model${normalizedModel}` as keyof typeof ASSET_PATHS.player];
}

// Preload all assets
export async function preloadAllAssets(): Promise<void> {
  const allPaths = [
    ...Object.values(ASSET_PATHS.map),
    ...Object.values(ASSET_PATHS.pois),
    ...Object.values(ASSET_PATHS.towns),
    ...Object.values(ASSET_PATHS.icons),
    ...Object.values(ASSET_PATHS.player),
    ...Object.values(ASSET_PATHS.bosses),
  ];

  await Promise.all(allPaths.map(path => AssetLoader.loadImage(path)));
}
