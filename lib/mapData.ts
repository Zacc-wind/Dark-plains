// Tile types for the game map
export enum TileType {
  GRASS = 'grass',
  WATER = 'water',
  ROAD = 'road',
  FOREST = 'forest',
  MOUNTAIN = 'mountain',
  SAND = 'sand',
}

// POI (Point of Interest) types
export enum POIType {
  FOREST = 'forest',
  MOUNTAIN = 'mountain',
  FARM = 'farm',
  HUNTING_LODGE = 'hunting_lodge',
  WINDMILL = 'windmill',
  CRAB_TRAP = 'crab_trap',
  FISHING_DOCK = 'fishing_dock',
  GRANITE_QUARRY = 'granite_quarry',
  COFFEE_PLANTATION = 'coffee_plantation',
  CAMPFIRE = 'campfire',
  TOWN = 'town',
}

// Tile interface
export interface Tile {
  x: number;
  y: number;
  type: TileType;
}

// POI interface
export interface POI {
  id: string;
  x: number;
  y: number;
  type: POIType;
  name: string;
  description?: string;
  jobs: string[];
}

export function getPoiFootprint(poi: Pick<POI, 'type'>): { width: number; height: number } {
  if (poi.type === POIType.TOWN) return { width: 8, height: 8 };
  if (poi.type === POIType.CAMPFIRE) return { width: 2, height: 2 };
  return { width: 4, height: 4 };
}

export function findPoiAtTile<T extends Pick<POI, 'id' | 'x' | 'y' | 'type'>>(
  pois: readonly T[],
  tileX: number,
  tileY: number
): T | undefined {
  return pois
    .map(poi => {
      const { width, height } = getPoiFootprint(poi);
      const inside = tileX >= poi.x && tileX < poi.x + width && tileY >= poi.y && tileY < poi.y + height;
      const centerX = poi.x + width / 2;
      const centerY = poi.y + height / 2;

      return {
        poi,
        inside,
        distance: Math.hypot(tileX + 0.5 - centerX, tileY + 0.5 - centerY),
        area: width * height,
      };
    })
    .filter(candidate => candidate.inside)
    .sort((left, right) => (
      left.distance - right.distance
      || left.area - right.area
      || left.poi.id.localeCompare(right.poi.id)
    ))[0]?.poi;
}

// Map configuration
export const MAP_CONFIG = {
  width: 84,
  height: 48,
  tileSize: 32,
};

// Generate a static map with roads
export function generateStaticMap(): Tile[][] {
  const map: Tile[][] = [];
  
  // Initialize with grass
  for (let y = 0; y < MAP_CONFIG.height; y++) {
    map[y] = [];
    for (let x = 0; x < MAP_CONFIG.width; x++) {
      map[y][x] = { x, y, type: TileType.GRASS };
    }
  }
  
  // Add rough collision water around the painted coast and moon pools.
  addCircularArea(map, 2, 10, 9, TileType.WATER);
  addCircularArea(map, 36, 22, 3, TileType.WATER);
  addCircularArea(map, 34, 27, 3, TileType.WATER);
  addCircularArea(map, 41, 34, 3, TileType.WATER);
  addCircularArea(map, 47, 18, 3, TileType.WATER);
  addCircularArea(map, 52, 31, 3, TileType.WATER);
  addCircularArea(map, 8, 42, 5, TileType.WATER);
  addCircularArea(map, 81, 43, 5, TileType.WATER);
  
  // Organic collision roads following the painted road network.
  addCurvedRoad(map, 5, 4, 43, 25, 1);
  addCurvedRoad(map, 2, 26, 43, 25, 1);
  addCurvedRoad(map, 43, 25, 83, 25, 1);
  addCurvedRoad(map, 43, 25, 64, 10, 1);
  addCurvedRoad(map, 43, 25, 77, 43, 1);
  addCurvedRoad(map, 43, 25, 43, 47, 1);
  addCurvedRoad(map, 43, 25, 9, 46, 1);
  
  return map;
}

// Helper function to add curved roads between two points
function addCurvedRoad(
  map: Tile[][],
  startX: number,
  startY: number,
  endX: number,
  endY: number,
  width: number
) {
  const steps = Math.max(Math.abs(endX - startX), Math.abs(endY - startY));
  
  for (let i = 0; i <= steps; i++) {
    const t = i / steps;
    // Add slight curve using quadratic bezier
    const midX = (startX + endX) / 2 + (Math.random() - 0.5) * 5;
    const midY = (startY + endY) / 2 + (Math.random() - 0.5) * 5;
    
    const x = Math.round(
      (1 - t) * (1 - t) * startX + 
      2 * (1 - t) * t * midX + 
      t * t * endX
    );
    const y = Math.round(
      (1 - t) * (1 - t) * startY + 
      2 * (1 - t) * t * midY + 
      t * t * endY
    );
    
    // Add road with width
    for (let dy = -width; dy <= width; dy++) {
      for (let dx = -width; dx <= width; dx++) {
        const roadY = y + dy;
        const roadX = x + dx;
        
        if (roadY >= 0 && roadY < MAP_CONFIG.height && 
            roadX >= 0 && roadX < MAP_CONFIG.width &&
            map[roadY][roadX].type !== TileType.WATER) {
          map[roadY][roadX].type = TileType.ROAD;
        }
      }
    }
  }
}

// Helper function to add circular areas
function addCircularArea(
  map: Tile[][],
  centerX: number,
  centerY: number,
  radius: number,
  type: TileType,
  onlyOverwrite: boolean = false
) {
  for (let y = Math.max(0, centerY - radius); y < Math.min(MAP_CONFIG.height, centerY + radius); y++) {
    for (let x = Math.max(0, centerX - radius); x < Math.min(MAP_CONFIG.width, centerX + radius); x++) {
      const distance = Math.sqrt((x - centerX) ** 2 + (y - centerY) ** 2);
      if (distance <= radius) {
        // If onlyOverwrite is true, only replace specific tiles (for sand around water)
        if (onlyOverwrite) {
          if (map[y][x].type === TileType.GRASS) {
            map[y][x].type = type;
          }
        } else {
          // Don't overwrite roads
          if (map[y][x].type !== TileType.ROAD) {
            map[y][x].type = type;
          }
        }
      }
    }
  }
}

// Generate POIs (Points of Interest)
export function generatePOIs(): POI[] {
  const pois: POI[] = [];
  let idCounter = 1;
  
  // Forest POIs - reduced to 4 for better distribution (4x4 tiles)
  const forestLocations = [
    { x: 18, y: 15, name: "Darkwood Forest" },
    { x: 32, y: 9, name: "Lanternless Grove" },
    { x: 53, y: 11, name: "Mourning Thicket" },
    { x: 72, y: 30, name: "Shadowgrove" },
  ];
  
  forestLocations.forEach(loc => {
    pois.push({
      id: `poi-${idCounter++}`,
      x: loc.x,
      y: loc.y,
      type: POIType.FOREST,
      name: loc.name,
      jobs: ["Gather Gravewood", "Track Moon Beasts", "Harvest Witchmoss", "Scout the Old Paths"]
    });
  });
  
  // Mountain POIs - reduced to 3 (4x4 tiles)
  const mountainLocations = [
    { x: 5, y: 19, name: "Ironcrag Gate" },
    { x: 76, y: 5, name: "Stormcrest Peak" },
    { x: 80, y: 30, name: "Thunder Ridge" },
  ];
  
  mountainLocations.forEach(loc => {
    pois.push({
      id: `poi-${idCounter++}`,
      x: loc.x,
      y: loc.y,
      type: POIType.MOUNTAIN,
      name: loc.name,
      jobs: ["Mine Black Iron", "Carve Rune Stone", "Search for Star Gems", "Climb the Storm Shrine"]
    });
  });
  
  // Farm POIs - keep at 3 (4x4 tiles); Witherfield pulled off the crowded crossroads belt
  const farmLocations = [
    { x: 22, y: 32, name: "Witherfield Farm" },
    { x: 42, y: 36, name: "Gallowsmere Fields" },
    { x: 61, y: 29, name: "Harvest Moon Grange" },
  ];
  
  farmLocations.forEach(loc => {
    pois.push({
      id: `poi-${idCounter++}`,
      x: loc.x,
      y: loc.y,
      type: POIType.FARM,
      name: loc.name,
      jobs: ["Reap Dead Wheat", "Bind Field Wards", "Cull Blighted Crops", "Guard the Night Barn"]
    });
  });
  
  // Hunting Lodge POIs - only 1 unique (4x4 tiles)
  const huntingLocations = [
    { x: 72, y: 16, name: "Antler Black Lodge" },
  ];
  
  huntingLocations.forEach(loc => {
    pois.push({
      id: `poi-${idCounter++}`,
      x: loc.x,
      y: loc.y,
      type: POIType.HUNTING_LODGE,
      name: loc.name,
      jobs: ["Track Dire Game", "Set Silver Traps", "Prepare Shadow Pelts", "Hunt the Horned Stag"]
    });
  });
  
  // Windmill POIs - only 2 (4x4 tiles); Old Windmill shifted off mid-road cluster
  const windmillLocations = [
    { x: 48, y: 12, name: "Old Windmill" },
    { x: 14, y: 29, name: "Hilltop Windmill" },
  ];
  
  windmillLocations.forEach(loc => {
    pois.push({
      id: `poi-${idCounter++}`,
      x: loc.x,
      y: loc.y,
      type: POIType.WINDMILL,
      name: loc.name,
      jobs: ["Repair Witch Sails", "Oil Grave Gears", "Grind Night Grain", "Watch the Turning Blades"]
    });
  });
  
  // Campfire POIs - rest and recover HP (2x2 tiles); camps sit off the mid-road y24-25 belt
  const campfireLocations = [
    {
      x: 33,
      y: 18,
      name: "Crossroads Camp",
      description: "A dry roadside fire ring where guards trade rumors, bread, and a little warmth before the next march.",
    },
    {
      x: 58,
      y: 31,
      name: "Pilgrim Fire",
      description: "A hidden clearing under dead branches, marked by ash stones and old pilgrim cloth.",
    },
    {
      x: 74,
      y: 18,
      name: "East Road Camp",
      description: "A lantern-lit camp beside hard road dirt, watched by tired scouts and relic carriers.",
    },
    {
      x: 16,
      y: 30,
      name: "Ash Road Rest",
      description: "A low stone ring off the western ash road, kept by reserve scouts who watch for night riders.",
    },
    {
      x: 46,
      y: 34,
      name: "South Fork Camp",
      description: "A quiet south-fork camp under wind-bent pines, far enough from the mid-road to sleep through patrols.",
    },
  ];
  
  campfireLocations.forEach(loc => {
    pois.push({
      id: `poi-${idCounter++}`,
      x: loc.x,
      y: loc.y,
      type: POIType.CAMPFIRE,
      name: loc.name,
      description: loc.description,
      jobs: ["Rest by Fire", "Share Pilgrim Bread", "Meditate on Ash", "Hear Old War Tales"]
    });
  });
  
  // Crab Trap POIs - only 1 (CAN be in/near water, 4x4 tiles)
  const crabTrapLocations = [
    { x: 2, y: 11, name: "Crab Cove" },
  ];
  
  crabTrapLocations.forEach(loc => {
    pois.push({
      id: `poi-${idCounter++}`,
      x: loc.x,
      y: loc.y,
      type: POIType.CRAB_TRAP,
      name: loc.name,
      jobs: ["Catch Bone Crabs", "Set Tide Traps", "Collect Black Shells", "Check Lantern Pots"]
    });
  });
  
  // Fishing Dock POIs - keep at 3 (CAN be in/near water, 4x4 tiles); Moonwell nudged off farm/windmill pile
  const fishingDockLocations = [
    { x: 5, y: 3, name: "Fisher's Wharf" },
    { x: 33, y: 16, name: "Moonwell Pier" },
    { x: 40, y: 28, name: "Quiet Waters Pier" },
  ];
  
  fishingDockLocations.forEach(loc => {
    pois.push({
      id: `poi-${idCounter++}`,
      x: loc.x,
      y: loc.y,
      type: POIType.FISHING_DOCK,
      name: loc.name,
      jobs: ["Cast Moon Nets", "Catch Pale Fish", "Repair Drowned Nets", "Bait Iron Hooks"]
    });
  });
  
  // Granite Quarry POIs - only 1 unique (4x4 tiles)
  const graniteQuarryLocations = [
    { x: 80, y: 10, name: "Granite Heights Quarry" },
  ];
  
  graniteQuarryLocations.forEach(loc => {
    pois.push({
      id: `poi-${idCounter++}`,
      x: loc.x,
      y: loc.y,
      type: POIType.GRANITE_QUARRY,
      name: loc.name,
      jobs: ["Mine Abbey Granite", "Cut Reliquary Stone", "Crack the Old Quarry", "Haul Grave Blocks"]
    });
  });
  
  // Coffee Plantation POIs - only 2 (4x4 tiles)
  const coffeePlantationLocations = [
    { x: 25, y: 11, name: "Vigil Coffee Estate" },
    { x: 64, y: 36, name: "Black Dawn Plantation" },
  ];
  
  coffeePlantationLocations.forEach(loc => {
    pois.push({
      id: `poi-${idCounter++}`,
      x: loc.x,
      y: loc.y,
      type: POIType.COFFEE_PLANTATION,
      name: loc.name,
      jobs: ["Pick Bitter Beans", "Grind Vigil Coffee", "Roast Night Beans", "Sort Manor Tithes"]
    });
  });
  
  // Towns - 8x8 tiles
  const townLocations = [
    { x: 9, y: 2, name: "Harborview", description: "A fortified harbor town where mist ships, dock guilds, and candle courts sell road contracts." },
    { x: 4, y: 34, name: "Riverside", description: "A river-wall market town with bridge tolls, relic traders, and safer beds for low-level commanders." },
    { x: 50, y: 17, name: "Blackwater Gate", description: "An eastern checkpoint town reusing the Harborview harbor-law style until it receives unique gate art." },
    { x: 36, y: 28, name: "Moonbridge", description: "A central bridge town reusing Riverside's market-square background for quests, shops, and patrol rumors." },
    { x: 20, y: 24, name: "Ashford", description: "A western ash-road town for mid-game contracts, pilgrim healing, and cheap reserve recruits." },
    { x: 69, y: 35, name: "Eclipse Hold", description: "A hard southeast fortress town for boss-country shops, elite rumors, and late-game dungeon reports." },
  ];
  
  townLocations.forEach(loc => {
    pois.push({
      id: `poi-${idCounter++}`,
      x: loc.x,
      y: loc.y,
      type: POIType.TOWN,
      name: loc.name,
      description: loc.description,
      jobs: ["Visit the Guild Hall", "Trade Relics", "Rest at the Lantern Inn", "Gather War Rumors"]
    });
  });
  
  return pois;
}

// The static map instance - same for all players
let staticMapInstance: Tile[][] | null = null;
let staticPOIInstance: POI[] | null = null;

export function getStaticMap(): Tile[][] {
  if (!staticMapInstance) {
    staticMapInstance = generateStaticMap();
  }
  return staticMapInstance;
}

export function getStaticPOIs(): POI[] {
  if (!staticPOIInstance) {
    staticPOIInstance = generatePOIs();
  }
  return staticPOIInstance;
}
