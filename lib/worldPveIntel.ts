import { getCurrentUser, type User } from './auth';
import { COOP_BOSS_PHASES, getActiveCoopBosses, getNpcEnemiesForUser } from './battle';
import { getMultiplayerRegionalThreat } from './multiplayerEngagement';
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
  kind: 'dungeon' | 'world-boss' | 'regional-threat' | 'coop-boss';
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
  requiredPlayers?: number;
  phaseCount?: number;
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

function getCoopBossRewardLines(level: number): PveRewardLine[] {
  const reward = estimateWorldBossFieldReward(level, 4.8);
  return [
    {
      id: 'raid-gold',
      label: 'Party Gold',
      iconPath: '/assets/icons/gold.png',
      minLabel: String(Math.round(reward.gold * 0.9)),
      maxLabel: String(reward.gold),
      detail: 'Validated completion payout for each commander',
    },
    {
      id: 'raid-xp',
      label: 'Commander XP',
      iconPath: '/assets/icons/xp.png',
      minLabel: String(Math.round(reward.exp * 0.9)),
      maxLabel: String(reward.exp),
      detail: 'Four-phase raid completion reward',
    },
    {
      id: 'raid-gems',
      label: 'Rare Gems',
      iconPath: '/assets/icons/rare-gem.png',
      minLabel: String(Math.max(2, reward.gemsMin + 1)),
      maxLabel: String(Math.max(4, reward.gemsMax + 2)),
      detail: 'Reserved for successful duo clears',
    },
    {
      id: 'raid-chest',
      label: 'Raid Chest',
      iconPath: '/assets/icons/loot-chest.png',
      minLabel: 'Epic',
      maxLabel: 'Legendary',
      detail: 'High set-piece chance with duplicate protection planned',
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

  const worldEnemies = getNpcEnemiesForUser(user, now);
  const activeBosses = worldEnemies.filter(enemy => (
    enemy.spawnKind === 'world-boss' || enemy.spawnKind === 'regional-threat'
  ));
  const threat = user
    ? getMultiplayerRegionalThreat(user.multiplayerEngagement, user.username, user.stats.level, now)
    : null;
  const bossEntries = activeBosses.map<PveIntelEntry>(boss => {
    const bossRegion = getRegionForTile(boss.x, boss.y);
    const isRegionalThreat = boss.spawnKind === 'regional-threat';
    const rewards = getWorldBossRewardLines(boss.level);
    if (isRegionalThreat && threat) {
      rewards.unshift({
        id: 'threat-board',
        label: 'Threat Board',
        iconPath: '/assets/icons/rare-gem.png',
        minLabel: `${threat.rewardGold} gold`,
        maxLabel: `${threat.rewardExp} XP + ${threat.rewardRareGems} gem`,
        detail: 'Claimed after the regional patrol and named boss objectives are both complete',
      });
    }
    return {
      id: boss.id,
      kind: isRegionalThreat ? 'regional-threat' : 'world-boss',
      name: isRegionalThreat && threat ? threat.title : 'Hourly World Boss',
      subtitle: boss.subtitle,
      description: boss.story || boss.intro || 'A roaming boss patrols the map until defeated.',
      level: boss.level,
      regionName: bossRegion.name,
      regionLevels: bossRegion.levelRange,
      directionHint: getDirectionHint(playerX, playerY, boss.x, boss.y),
      expiresLabel: formatDungeonTimeRemaining(boss.expiresAt || now, now),
      bossName: boss.name,
      bossSubtitle: boss.subtitle,
      bossArtworkPath: boss.artworkPath,
      rewards,
      minUnitsRequired: 0,
    };
  });

  const coopEntries = getActiveCoopBosses(user, now).map<PveIntelEntry>(boss => {
    const bossRegion = getRegionForTile(boss.x, boss.y);
    return {
      id: boss.id,
      kind: 'coop-boss',
      name: 'Co-op Incursion',
      subtitle: boss.subtitle,
      description: boss.story || 'A raid commander holds an expanded battlefield until the five-hour incursion closes.',
      level: boss.level,
      regionName: bossRegion.name,
      regionLevels: bossRegion.levelRange,
      directionHint: getDirectionHint(playerX, playerY, boss.x, boss.y),
      expiresLabel: formatDungeonTimeRemaining(boss.expiresAt || now, now),
      bossName: boss.name,
      bossSubtitle: boss.subtitle,
      bossArtworkPath: boss.artworkPath,
      rewards: getCoopBossRewardLines(boss.level),
      minUnitsRequired: 5,
      requiredPlayers: 2,
      phaseCount: COOP_BOSS_PHASES,
    };
  });

  return [...coopEntries, ...bossEntries, ...dungeonEntries];
}

export function getActivePveSpawnCount(user: User | null = getCurrentUser(), now = Date.now()): number {
  return getWorldPveIntel(user, now).length;
}
