import { MAP_CONFIG, POIType, getStaticPOIs } from './mapData';
import type { EnemyAiPersonality, PlayerModelNumber } from './battle';
import { BOSS_PROFILES, getBossProfileById } from './bosses';

export interface RegionBand {
  id: string;
  name: string;
  levelRange: string;
  description: string;
  minX: number;
  minY: number;
  maxX: number;
  maxY: number;
}

export interface WorldDungeon {
  id: string;
  templateId: string;
  name: string;
  bossId: string;
  bossName: string;
  bossSubtitle: string;
  bossStory: string;
  bossIntro: string;
  bossArtworkPath: string;
  bossModelNumber: PlayerModelNumber;
  bossPersonality: EnemyAiPersonality;
  bossMinionTemplates: string[];
  x: number;
  y: number;
  level: number;
  expiresAt: number;
  description: string;
}

const DUNGEON_CYCLE_MS = 3 * 60 * 60 * 1000;

export const REGION_BANDS: RegionBand[] = [
  {
    id: 'western-vigil',
    name: 'Western Vigil',
    levelRange: '1-5',
    description: 'Safer roads, ruined farms, and first recruits.',
    minX: 0,
    minY: 0,
    maxX: 31,
    maxY: 30,
  },
  {
    id: 'moonfen-crossroads',
    name: 'Moonfen Crossroads',
    levelRange: '4-10',
    description: 'Longer roads, better contracts, and stronger patrols.',
    minX: 24,
    minY: 8,
    maxX: 57,
    maxY: 42,
  },
  {
    id: 'eastern-blackwater',
    name: 'Eastern Blackwater',
    levelRange: '8-15',
    description: 'Deep water, occult ruins, and dangerous field bosses.',
    minX: 50,
    minY: 0,
    maxX: 83,
    maxY: 34,
  },
  {
    id: 'eclipse-marches',
    name: 'Eclipse Marches',
    levelRange: '12-20',
    description: 'Boss country. Elite minions and high-risk rewards belong here.',
    minX: 56,
    minY: 28,
    maxX: 83,
    maxY: 47,
  },
];

export interface DungeonTemplate {
  id: string;
  name: string;
  bossId?: string;
  bossName: string;
  bossSubtitle: string;
  x: number;
  y: number;
  levelBonus: number;
  bossModelNumber: PlayerModelNumber;
  bossPersonality: EnemyAiPersonality;
  bossMinionTemplates: string[];
  description: string;
}

export const DUNGEON_TEMPLATES: DungeonTemplate[] = [
  {
    id: 'ossuary-cellar',
    name: 'Ossuary Cellar',
    bossId: 'mother-cindervein',
    bossName: 'Ossuary Candlekeeper',
    bossSubtitle: 'Bone-lit crypt boss',
    x: 18,
    y: 17,
    levelBonus: 0,
    bossModelNumber: 5,
    bossPersonality: 'defensive',
    bossMinionTemplates: ['templar-initiate', 'priest-acolyte', 'knight-squire'],
    description: 'A cellar under collapsed chapel stones where candle vows keep the dead obedient.',
  },
  {
    id: 'moonwell-descent',
    name: 'Moonwell Descent',
    bossId: 'prior-moon-voss',
    bossName: 'Moonwell Binder',
    bossSubtitle: 'Mistbound ritualist',
    x: 33,
    y: 20,
    levelBonus: 2,
    bossModelNumber: 5,
    bossPersonality: 'arcane',
    bossMinionTemplates: ['wizard-apprentice', 'priest-acolyte', 'templar-initiate'],
    description: 'An old well stair where silver water repeats every oath spoken above it.',
  },
  {
    id: 'blackroot-shrine',
    name: 'Blackroot Shrine',
    bossId: 'blackroot-vessel',
    bossName: 'Root-Saint Heretic',
    bossSubtitle: 'Thorn relic keeper',
    x: 37,
    y: 28,
    levelBonus: 3,
    bossModelNumber: 5,
    bossPersonality: 'defensive',
    bossMinionTemplates: ['templar-initiate', 'knight-man-at-arms', 'priest-cleric'],
    description: 'A forest shrine swallowed by roots, votive bells, and half-buried saint masks.',
  },
  {
    id: 'drowned-reliquary',
    name: 'Drowned Reliquary',
    bossId: 'key-saint-ardan',
    bossName: 'Drowned Relic Warden',
    bossSubtitle: 'Blackwater guardian',
    x: 50,
    y: 20,
    levelBonus: 5,
    bossModelNumber: 5,
    bossPersonality: 'balanced',
    bossMinionTemplates: ['knight-man-at-arms', 'templar-crusader', 'priest-cleric'],
    description: 'A flooded reliquary where old coins, icons, and bones glitter below dark water.',
  },
  {
    id: 'blue-flame-vault',
    name: 'Blue Flame Vault',
    bossId: 'lady-mirror-veyra',
    bossName: 'Blue Flame Magus',
    bossSubtitle: 'Vault spellwarden',
    x: 58,
    y: 17,
    levelBonus: 6,
    bossModelNumber: 5,
    bossPersonality: 'arcane',
    bossMinionTemplates: ['wizard-magus', 'templar-crusader', 'priest-cleric'],
    description: 'A sealed vault of cold fire where stolen spellbooks burn without ash.',
  },
  {
    id: 'saintless-tower',
    name: 'Saintless Tower',
    bossId: 'scarlet-matron-yvane',
    bossName: 'Saintless Adjudicator',
    bossSubtitle: 'Tower court tyrant',
    x: 75,
    y: 36,
    levelBonus: 8,
    bossModelNumber: 6,
    bossPersonality: 'boss',
    bossMinionTemplates: ['templar-crusader', 'knight-champion', 'priest-cleric', 'wizard-magus'],
    description: 'A leaning tower that holds trials for commanders who never arrive innocent.',
  },
  {
    id: 'iron-choir-pit',
    name: 'Iron Choir Pit',
    bossId: 'ser-kael-duskplate',
    bossName: 'Iron Choir Marshal',
    bossSubtitle: 'Pit war-chanter',
    x: 62,
    y: 40,
    levelBonus: 10,
    bossModelNumber: 6,
    bossPersonality: 'aggressive',
    bossMinionTemplates: ['knight-champion', 'templar-paragon', 'wizard-magus', 'priest-cleric'],
    description: 'A sunken drill ground where armored voices chant under cracked bell metal.',
  },
  {
    id: 'warlord-sepulcher',
    name: 'Warlord Sepulcher',
    bossId: 'emperor-grave-aurel',
    bossName: 'Sepulcher Warlord',
    bossSubtitle: 'Eclipse dungeon lord',
    x: 78,
    y: 42,
    levelBonus: 12,
    bossModelNumber: 6,
    bossPersonality: 'boss',
    bossMinionTemplates: ['knight-champion', 'templar-paragon', 'wizard-archmage', 'priest-high-priest'],
    description: 'A sealed war tomb in boss country, still issuing commands through cracked stone.',
  },
];

function seededRoll(seed: number): number {
  const value = Math.sin(seed) * 10000;
  return value - Math.floor(value);
}

function hashText(value: string): number {
  return value.split('').reduce((hash, char) => ((hash << 5) - hash + char.charCodeAt(0)) | 0, 0);
}

const DUNGEON_FOOTPRINT = 3;

function clampDungeonCoord(value: number, max: number): number {
  return Math.max(2, Math.min(max, value));
}

function getPoiCollisionFootprint(type: POIType): { width: number; height: number } {
  if (type === POIType.TOWN) return { width: 8, height: 8 };
  if (type === POIType.CAMPFIRE) return { width: 2, height: 2 };
  return { width: 4, height: 4 };
}

function footprintsOverlap(
  ax: number,
  ay: number,
  aw: number,
  ah: number,
  bx: number,
  by: number,
  bw: number,
  bh: number
): boolean {
  return ax < bx + bw && ax + aw > bx && ay < by + bh && ay + ah > by;
}

function dungeonOverlapsPoi(x: number, y: number, pois = getStaticPOIs()): boolean {
  return pois.some(poi => {
    const footprint = getPoiCollisionFootprint(poi.type);
    return footprintsOverlap(x, y, DUNGEON_FOOTPRINT, DUNGEON_FOOTPRINT, poi.x, poi.y, footprint.width, footprint.height);
  });
}

function resolveDungeonPosition(
  preferredX: number,
  preferredY: number,
  seed: number,
  pois = getStaticPOIs()
): { x: number; y: number } {
  const candidates: Array<{ x: number; y: number; distance: number }> = [];

  for (let radius = 0; radius <= 12; radius += 1) {
    for (let dx = -radius; dx <= radius; dx += 1) {
      for (let dy = -radius; dy <= radius; dy += 1) {
        if (radius > 0 && Math.abs(dx) !== radius && Math.abs(dy) !== radius) continue;

        const x = clampDungeonCoord(preferredX + dx, MAP_CONFIG.width - 4);
        const y = clampDungeonCoord(preferredY + dy, MAP_CONFIG.height - 4);
        if (dungeonOverlapsPoi(x, y, pois)) continue;

        candidates.push({ x, y, distance: Math.hypot(dx, dy) });
      }
    }

    if (candidates.length > 0) break;
  }

  if (candidates.length === 0) {
    return {
      x: clampDungeonCoord(preferredX, MAP_CONFIG.width - 4),
      y: clampDungeonCoord(preferredY, MAP_CONFIG.height - 4),
    };
  }

  candidates.sort((a, b) => a.distance - b.distance || a.x - b.x || a.y - b.y);
  const tieGroup = candidates.filter(candidate => candidate.distance === candidates[0].distance);
  return tieGroup[Math.floor(seededRoll(seed + 99) * tieGroup.length)] || candidates[0];
}

export function getRegionForTile(x: number, y: number): RegionBand {
  return REGION_BANDS.find(region => (
    x >= region.minX &&
    x <= region.maxX &&
    y >= region.minY &&
    y <= region.maxY
  )) || REGION_BANDS[0];
}

export function getActiveDungeons(now = Date.now(), playerLevel = 1): WorldDungeon[] {
  const cycle = Math.floor(now / DUNGEON_CYCLE_MS);
  const expiresAt = (cycle + 1) * DUNGEON_CYCLE_MS;
  const count = 2 + (cycle % 2);
  const startIndex = Math.floor(seededRoll(hashText(`dungeon-cycle-${cycle}`)) * DUNGEON_TEMPLATES.length);

  return Array.from({ length: count }, (_, index) => {
    const seed = hashText(`dungeon-${cycle}-${index}`);
    const template = DUNGEON_TEMPLATES[(startIndex + index * 3) % DUNGEON_TEMPLATES.length];
    const bossProfile = getBossProfileById(template.bossId) || BOSS_PROFILES[(startIndex + index) % BOSS_PROFILES.length];
    const offsetX = Math.floor(seededRoll(seed + 7) * 7) - 3;
    const offsetY = Math.floor(seededRoll(seed + 11) * 7) - 3;
    const preferredX = clampDungeonCoord(template.x + offsetX, MAP_CONFIG.width - 4);
    const preferredY = clampDungeonCoord(template.y + offsetY, MAP_CONFIG.height - 4);
    const { x, y } = resolveDungeonPosition(preferredX, preferredY, seed);
    const region = getRegionForTile(x, y);
    const regionFloor = Number(region.levelRange.split('-')[0]) || 1;

    return {
      id: `dungeon-${cycle}-${index}`,
      templateId: template.id,
      name: template.name,
      bossId: bossProfile.id,
      bossName: bossProfile.name,
      bossSubtitle: bossProfile.subtitle,
      bossStory: bossProfile.story,
      bossIntro: bossProfile.intro,
      bossArtworkPath: bossProfile.assetPath,
      bossModelNumber: bossProfile.modelNumber || template.bossModelNumber,
      bossPersonality: bossProfile.personality || template.bossPersonality,
      bossMinionTemplates: bossProfile.minionTemplates.length > 0 ? bossProfile.minionTemplates : template.bossMinionTemplates,
      x,
      y,
      level: Math.max(regionFloor, Math.min(25, playerLevel + regionFloor + template.levelBonus + index)),
      expiresAt,
      description: template.description,
    };
  });
}

export function formatDungeonTimeRemaining(expiresAt: number, now = Date.now()): string {
  const totalSeconds = Math.max(0, Math.ceil((expiresAt - now) / 1000));
  const hours = Math.floor(totalSeconds / 3600);
  const minutes = Math.floor((totalSeconds % 3600) / 60);

  if (hours > 0) return `${hours}h ${minutes}m`;
  return `${minutes}m`;
}
