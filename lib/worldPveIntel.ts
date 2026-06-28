import { getCurrentUser, type User } from './auth';
import { getActiveWorldBoss } from './battle';
import {
  formatDungeonTimeRemaining,
  getActiveDungeons,
  getRegionForTile,
  type WorldDungeon,
} from './worldEvents';

export interface PveRewardLine {
  id: string;
  label: string;
  iconPath: string;
  minLabel: string;
  maxLabel: string;
  detail?: string;
}

export interface PveIntelEntry {
  id: string;
  kind: 'dungeon' | 'world-boss';
  name: string;
  subtitle: string;
  description: string;
  level: number;
  regionName: string;
  regionLevels: string;
  directionHint: string;
  expiresLabel: string;
  bossName: string;
  bossSubtitle: string;
  bossArtworkPath?: string;
  rewards: PveRewardLine[];
  minUnitsRequired: number;
}

function getDirectionHint(fromX: number, fromY: number, toX: number, toY: number): string {
  const dx = toX - fromX;
  const dy = toY - fromY;
  const horizontal = dx > 8 ? 'Far East' : dx > 2 ? 'East' : dx < -8 ? 'Far West' : dx < -2 ? 'West' : '';
  const vertical = dy > 8 ? 'Far South' : dy > 2 ? 'South' : dy < -8 ? 'Far North' : dy < -2 ? 'North' : '';
  const parts = [vertical, horizontal].filter(Boolean);
  if (parts.length === 0) return 'Near your position';
  return parts.join(' · ');
}

function getDungeonMinUnits(level: number): number {
  if (level >= 12) return 5;
  if (level >= 8) return 3;
  if (level >= 5) return 1;
  return 0;
}

function estimateDungeonCompletionGold(): { min: number; max: number } {
  const minWins = 5;
  const maxWins = 15;
  const minRunGold = 40;
  const maxRunGold = 40 + maxWins * 16;
  return {
    min: Math.round(110 + minWins * 45 + minRunGold * 0.35),
    max: Math.round(110 + maxWins * 45 + maxRunGold * 0.35),
  };
}

function estimateWorldBossFieldReward(level: number, lootMultiplier = 3.2): { gold: number; exp: number; gemsMin: number; gemsMax: number } {
  const baseGold = 20 + level * 4;
  const baseExp = 5 + level * 1.5;
  return {
    gold: Math.round(baseGold * lootMultiplier),
    exp: Math.round(baseExp * lootMultiplier),
    gemsMin: level >= 8 ? 1 : 0,
    gemsMax: level >= 14 ? 3 : 2,
  };
}

function getDungeonRewardLines(level: number): PveRewardLine[] {
  const gold = estimateDungeonCompletionGold();
  const minExp = 45 + 5 * 12;
  const maxExp = 45 + 15 * 12;
  const bossRarityMin = level >= 9 ? 'Epic' : 'Rare';
  const bossRarityMax = level >= 14 ? 'Legendary' : 'Epic';

  return [
    {
      id: 'gold',
      label: 'Gold',
      iconPath: '/assets/icons/gold.png',
      minLabel: String(gold.min),
      maxLabel: String(gold.max),
      detail: 'Full run clear bonus plus chamber earnings',
    },
    {
      id: 'xp',
      label: 'Commander XP',
      iconPath: '/assets/icons/xp.png',
      minLabel: String(minExp),
      maxLabel: String(maxExp),
      detail: 'Scales with battles won inside the dungeon',
    },
    {
      id: 'gems',
      label: 'Rare Gems',
      iconPath: '/assets/icons/rare-gem.png',
      minLabel: '2',
      maxLabel: '7',
      detail: 'Awarded on successful dungeon clear',
    },
    {
      id: 'route-gear',
      label: 'Route Gear',
      iconPath: '/assets/equipment/sword-rare.png',
      minLabel: 'Rare',
      maxLabel: 'Epic',
      detail: 'Chamber battles, shops, and event rewards',
    },
    {
      id: 'boss-gear',
      label: 'Boss Chest',
      iconPath: '/assets/icons/loot-chest.png',
      minLabel: bossRarityMin,
      maxLabel: bossRarityMax,
      detail: 'Set-eligible gear possible on final boss',
    },
  ];
}

function getWorldBossRewardLines(level: number): PveRewardLine[] {
  const reward = estimateWorldBossFieldReward(level);

  return [
    {
      id: 'gold',
      label: 'Gold',
      iconPath: '/assets/icons/gold.png',
      minLabel: String(Math.round(reward.gold * 0.85)),
      maxLabel: String(reward.gold),
      detail: '3.2× world boss loot multiplier',
    },
    {
      id: 'xp',
      label: 'Commander XP',
      iconPath: '/assets/icons/xp.png',
      minLabel: String(Math.round(reward.exp * 0.85)),
      maxLabel: String(reward.exp),
      detail: 'Single field victory payout',
    },
    {
      id: 'gems',
      label: 'Rare Gems',
      iconPath: '/assets/icons/rare-gem.png',
      minLabel: String(reward.gemsMin),
      maxLabel: String(reward.gemsMax),
      detail: 'Bonus supply drops on defeat',
    },
    {
      id: 'gear',
      label: 'Field Gear',
      iconPath: '/assets/equipment/sword-epic.png',
      minLabel: 'Decent',
      maxLabel: 'Legendary',
      detail: 'Elevated boss-tier equipment rolls',
    },
    {
      id: 'sets',
      label: 'Set Pieces',
      iconPath: '/assets/equipment/armor-legendary.png',
      minLabel: 'Rare',
      maxLabel: 'Legendary',
      detail: 'Named sets can appear on boss kills',
    },
  ];
}

function mapDungeonToIntel(
  dungeon: WorldDungeon,
  playerX: number,
  playerY: number,
  now: number,
): PveIntelEntry {
  const region = getRegionForTile(dungeon.x, dungeon.y);

  return {
    id: dungeon.id,
    kind: 'dungeon',
    name: dungeon.name,
    subtitle: dungeon.bossSubtitle,
    description: dungeon.description,
    level: dungeon.level,
    regionName: region.name,
    regionLevels: region.levelRange,
    directionHint: getDirectionHint(playerX, playerY, dungeon.x, dungeon.y),
    expiresLabel: formatDungeonTimeRemaining(dungeon.expiresAt, now),
    bossName: dungeon.bossName,
    bossSubtitle: dungeon.bossSubtitle,
    bossArtworkPath: dungeon.bossArtworkPath,
    rewards: getDungeonRewardLines(dungeon.level),
    minUnitsRequired: getDungeonMinUnits(dungeon.level),
  };
}

export function getWorldPveIntel(user: User | null = getCurrentUser(), now = Date.now()): PveIntelEntry[] {
  const playerLevel = user?.stats.level || 1;
  const playerX = user?.x ?? 40;
  const playerY = user?.y ?? 40;

  const dungeonEntries = getActiveDungeons(now, playerLevel).map(dungeon =>
    mapDungeonToIntel(dungeon, playerX, playerY, now),
  );

  const worldBoss = getActiveWorldBoss(user, now);
  if (!worldBoss) {
    return dungeonEntries;
  }

  const bossRegion = getRegionForTile(worldBoss.x, worldBoss.y);
  const bossEntry: PveIntelEntry = {
    id: worldBoss.id,
    kind: 'world-boss',
    name: 'Hourly World Boss',
    subtitle: worldBoss.subtitle,
    description: worldBoss.story || worldBoss.intro || 'A roaming boss patrols the map until defeated.',
    level: worldBoss.level,
    regionName: bossRegion.name,
    regionLevels: bossRegion.levelRange,
    directionHint: getDirectionHint(playerX, playerY, worldBoss.x, worldBoss.y),
    expiresLabel: formatDungeonTimeRemaining(worldBoss.expiresAt || now, now),
    bossName: worldBoss.name,
    bossSubtitle: worldBoss.subtitle,
    bossArtworkPath: worldBoss.artworkPath,
    rewards: getWorldBossRewardLines(worldBoss.level),
    minUnitsRequired: 0,
  };

  return [bossEntry, ...dungeonEntries];
}

export function getActivePveSpawnCount(user: User | null = getCurrentUser(), now = Date.now()): number {
  return getWorldPveIntel(user, now).length;
}
