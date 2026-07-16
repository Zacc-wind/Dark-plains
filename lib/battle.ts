import {
  CharacterStats,
  MAX_FIELD_MINIONS,
  MINION_TEMPLATES,
  MinionStack,
  MinionTier,
  User,
  getFieldedMinions,
  getCurrentUser,
  getUsers,
  getMinionTemplate,
  isPlayerRecruitableMinionTemplate,
  isStandaloneMinionTemplate,
} from './auth';
import { getMinionAssetPath, getPlayerModelPath } from './assetLoader';
import { readGameJson, removeGameStorageItem, writeGameJson } from './gameStore';
import { MAP_CONFIG, POIType, TileType, getStaticMap, getStaticPOIs } from './mapData';
import { BOSS_PROFILES, type BossProfile } from './bosses';
import { COMMANDER_FORMATION_KEY } from './formation';

export type BattleSide = 'player' | 'enemy';
export type BattleStatus = 'active' | 'victory' | 'defeat' | 'recruited';
export type BattleUnitKind = 'commander' | 'minion';
export type BattleSpellTarget = 'enemy' | 'ally' | 'none';
export type PlayerModelNumber = 1 | 2 | 3 | 4 | 5 | 6;
export type EnemyAiPersonality = 'balanced' | 'aggressive' | 'defensive' | 'arcane' | 'boss';
export type BattleLogAction = 'round' | 'move' | 'attack' | 'heal' | 'spell' | 'wait' | 'mana' | 'morale' | 'system';
export type BattleLogStyle =
  | 'move'
  | 'melee'
  | 'ranged'
  | 'heal'
  | 'buff'
  | 'debuff'
  | 'guard'
  | 'mana-focus'
  | 'morale'
  | 'spell-damage'
  | 'spell-drain'
  | 'spell-support'
  | 'spell-control'
  | 'bleed'
  | 'poison'
  | 'boss-phase'
  | 'boss-special';
export type BattleChallengeStatus = 'pending' | 'ready' | 'declined' | 'expired' | 'cancelled';

export interface BoardCell {
  x: number;
  y: number;
}

export type BattleTerrainType = 'ground' | 'stone' | 'mud' | 'water' | 'bridge' | 'highGround' | 'cover' | 'holyGround';
export type BattleMapTag = 'open' | 'mountain' | 'water' | 'ruin' | 'forest' | 'boss';

export interface BattleTerrainCell extends BoardCell {
  type: BattleTerrainType;
}

export interface BattleUnitStatusEffects {
  bleedStacks?: number;
  bleedTurns?: number;
  poisonTurns?: number;
  poisonDamage?: number;
}

export interface BattleMapTemplate {
  id: string;
  name: string;
  description: string;
  boardWidth: number;
  boardHeight: number;
  tags: BattleMapTag[];
  terrain: BattleTerrainCell[];
  obstacles: BoardCell[];
  playerSpawns: BoardCell[];
  enemySpawns: BoardCell[];
}

export interface WorldEnemy {
  id: string;
  bossId?: string;
  name: string;
  subtitle: string;
  story?: string;
  intro?: string;
  artworkPath?: string;
  x: number;
  y: number;
  homeX?: number;
  homeY?: number;
  level: number;
  modelNumber: PlayerModelNumber;
  personality: EnemyAiPersonality;
  minions: MinionStack[];
  spawnedAt?: number;
  expiresAt?: number;
  spawnRegionId?: string;
  spawnKind?: 'regional' | 'nearby' | 'world-boss';
  lootMultiplier?: number;
}

export interface BattleRatingPreview {
  playerRating: number;
  enemyRating: number;
  ratio: number;
  label: 'Easy' | 'Fair' | 'Hard' | 'Deadly';
  tone: 'green' | 'gold' | 'red' | 'violet';
  summary: string;
  playerUnits: number;
  enemyUnits: number;
}

export interface BattleUnit {
  id: string;
  side: BattleSide;
  kind: BattleUnitKind;
  name: string;
  assetPath: string;
  rosterId?: string;
  templateId?: string;
  quantity: number;
  currentHealth: number;
  maxHealth: number;
  healthPerUnit: number;
  attack: number;
  defense: number;
  magic: number;
  healing: number;
  speed: number;
  movement: number;
  range: number;
  x: number;
  y: number;
  retaliatedRound?: number;
  chargedHeal?: boolean;
  supportAbilityUsed?: boolean;
  statusEffects?: BattleUnitStatusEffects;
  slowDebuff?: {
    movementPenalty: number;
    speedPenalty: number;
  };
}

export type MinionSupportAbilityId = 'bell-march' | 'void-ward';

export interface BattleSupportAura {
  abilityId: MinionSupportAbilityId;
  targetIds: string[];
}

export interface BattleSpell {
  id: string;
  name: string;
  cost: number;
  target: BattleSpellTarget;
  rarity: 'common' | 'rare' | 'legendary';
  description: string;
}

export interface BattleLogEntry {
  id: string;
  round: number;
  side?: BattleSide;
  actor?: string;
  actorId?: string;
  targetIds?: string[];
  action: BattleLogAction;
  style?: BattleLogStyle;
  spellId?: string;
  fromX?: number;
  fromY?: number;
  toX?: number;
  toY?: number;
  resurrectedUnitIds?: string[];
  summonedUnitIds?: string[];
  message: string;
  createdAt: number;
}

export interface BattleRecruitOffer {
  offeredMinions: MinionStack[];
  reason: string;
  declined?: boolean;
  accepted?: boolean;
}

export interface BattleState {
  id: string;
  enemy: WorldEnemy;
  mapTemplateId: string;
  mapName: string;
  boardWidth: number;
  boardHeight: number;
  terrain: BattleTerrainCell[];
  obstacles: BoardCell[];
  units: BattleUnit[];
  activeUnitId: string;
  turnQueue?: string[];
  round: number;
  status: BattleStatus;
  mana: Record<BattleSide, number>;
  turnStartedAt: number;
  turnTimeLimitMs: number;
  log: BattleLogEntry[];
  recruitOffer?: BattleRecruitOffer;
  bossPhase?: 1 | 2;
  bossSpecialRounds?: Record<string, number>;
  bossSpecialUses?: Record<string, number>;
  bonusMoveUnitId?: string;
  bonusMoveAwayFrom?: BoardCell;
  supportAuras?: Record<string, BattleSupportAura>;
  createdAt: number;
}

export interface BattleChallenge {
  id: string;
  challengerUsername: string;
  targetUsername: string;
  createdAt: number;
  expiresAt: number;
  status: BattleChallengeStatus;
  confirmedBy: string[];
  readyAt?: number;
  declinedAt?: number;
  cancelledAt?: number;
}

interface BattleModifiers {
  armyPower: number;
  defensivePower: number;
  spellPower: number;
  morale: number;
}

export interface CreateNpcBattleOptions {
  playerStacks?: MinionStack[];
  playerStats?: CharacterStats;
  playerName?: string;
  playerModelNumber?: number;
  suppressRecruitOffer?: boolean;
  playerFormation?: Record<string, BoardCell>;
}

const CHALLENGES_KEY = 'pirate_game_battle_challenges';
const DEFEATED_WORLD_ENEMIES_KEY = 'pirate_game_defeated_world_enemies';
const WORLD_ENEMY_SNAPSHOT_KEY = 'pirate_game_world_enemy_snapshot';
export const BATTLE_CONFIRM_WINDOW_MS = 60 * 1000;
export const TURN_TIME_LIMIT_MS = 2 * 60 * 1000;
export const MAX_PVP_DOWNCHALLENGE_LEVEL_GAP = 5;
export const WORLD_ENEMY_CAP = 30;
const BLEED_BASE_DAMAGE = 2;
const BLEED_STACK_EXTRA_DAMAGE = 1;
const BLEED_TURNS = 1;
const POISON_TURNS = 2;
const POISON_BASE_DAMAGE = 3;
export const WORLD_ENEMY_CYCLE_MS = 24 * 60 * 60 * 1000;
const WORLD_BOSS_CYCLE_MS = 60 * 60 * 1000;
const WORLD_ENEMY_MOVE_STEP_MS = 8 * 60 * 1000;

interface WorldEnemySnapshot {
  cycle: number;
  username: string;
  enemies: WorldEnemy[];
}

export function canChallengePlayer(
  challenger: Pick<User, 'stats' | 'username'> | null,
  target: Pick<User, 'stats' | 'username'> | null
): { allowed: boolean; reason?: string; warning?: string } {
  if (!challenger || !target || challenger.username === target.username) {
    return { allowed: false, reason: 'No valid opponent selected.' };
  }

  const challengerLevel = challenger.stats?.level || 1;
  const targetLevel = target.stats?.level || 1;
  const downChallengeGap = challengerLevel - targetLevel;
  const upChallengeGap = targetLevel - challengerLevel;

  if (downChallengeGap > MAX_PVP_DOWNCHALLENGE_LEVEL_GAP) {
    return {
      allowed: false,
      reason: `Level shield: you can only challenge lower players within ${MAX_PVP_DOWNCHALLENGE_LEVEL_GAP} levels.`,
    };
  }

  if (upChallengeGap > MAX_PVP_DOWNCHALLENGE_LEVEL_GAP) {
    return {
      allowed: true,
      warning: `Outmatched: this commander is ${upChallengeGap} levels above you.`,
    };
  }

  return { allowed: true };
}
const MAX_MANA = 12;

const BOARD_WIDTH = 10;
const BOARD_HEIGHT = 7;
const ENEMY_FIELD_MINIONS = 10;
const BOARD_ROWS = [0, 1, 2, 3, 4, 5, 6];
const PLAYER_SPAWNS: BoardCell[] = [
  { x: 0, y: 3 },
  ...BOARD_ROWS.flatMap(y => [{ x: 0, y }, { x: 1, y }]).filter(cell => !(cell.x === 0 && cell.y === 3)),
];
const ENEMY_SPAWNS: BoardCell[] = [
  { x: BOARD_WIDTH - 1, y: 3 },
  ...BOARD_ROWS.flatMap(y => [{ x: BOARD_WIDTH - 1, y }, { x: BOARD_WIDTH - 2, y }]).filter(cell => !(cell.x === BOARD_WIDTH - 1 && cell.y === 3)),
];

const terrain = (type: BattleTerrainType, cells: BoardCell[]): BattleTerrainCell[] => (
  cells.map(cell => ({ ...cell, type }))
);

const BATTLE_MAP_TEMPLATES: BattleMapTemplate[] = [
  {
    id: 'moonlit-road',
    name: 'Moonlit Road',
    description: 'An open road with a few muddy cuts and raised firing spots.',
    boardWidth: BOARD_WIDTH,
    boardHeight: BOARD_HEIGHT,
    tags: ['open'],
    terrain: [
      ...terrain('mud', [{ x: 3, y: 3 }, { x: 6, y: 3 }, { x: 4, y: 5 }, { x: 5, y: 1 }]),
      ...terrain('highGround', [{ x: 3, y: 1 }, { x: 6, y: 5 }]),
      ...terrain('holyGround', [{ x: 4, y: 3 }, { x: 5, y: 3 }]),
    ],
    obstacles: [],
    playerSpawns: PLAYER_SPAWNS,
    enemySpawns: ENEMY_SPAWNS,
  },
  {
    id: 'blackstone-pass',
    name: 'Blackstone Pass',
    description: 'A clean pass with raised shoulders and muddy pressure points.',
    boardWidth: BOARD_WIDTH,
    boardHeight: BOARD_HEIGHT,
    tags: ['mountain'],
    terrain: [
      ...terrain('highGround', [{ x: 3, y: 1 }, { x: 6, y: 1 }, { x: 3, y: 5 }, { x: 6, y: 5 }]),
      ...terrain('mud', [{ x: 2, y: 3 }, { x: 7, y: 3 }, { x: 4, y: 2 }, { x: 5, y: 4 }]),
    ],
    obstacles: [],
    playerSpawns: PLAYER_SPAWNS,
    enemySpawns: ENEMY_SPAWNS,
  },
  {
    id: 'bog-causeway',
    name: 'Bog Causeway',
    description: 'A muddy center line with raised lanes on the flanks.',
    boardWidth: BOARD_WIDTH,
    boardHeight: BOARD_HEIGHT,
    tags: ['open'],
    terrain: [
      ...terrain('mud', [
        { x: 4, y: 0 }, { x: 5, y: 0 }, { x: 4, y: 1 }, { x: 5, y: 1 },
        { x: 4, y: 2 }, { x: 5, y: 2 }, { x: 4, y: 4 }, { x: 5, y: 4 },
        { x: 4, y: 5 }, { x: 5, y: 5 }, { x: 4, y: 6 }, { x: 5, y: 6 },
      ]),
      ...terrain('highGround', [{ x: 3, y: 2 }, { x: 6, y: 4 }]),
    ],
    obstacles: [],
    playerSpawns: PLAYER_SPAWNS,
    enemySpawns: ENEMY_SPAWNS,
  },
  {
    id: 'ruined-abbey-road',
    name: 'Ruined Abbey Road',
    description: 'A ruined road reduced to clear lanes, mud, and raised chapel ground.',
    boardWidth: BOARD_WIDTH,
    boardHeight: BOARD_HEIGHT,
    tags: ['ruin'],
    terrain: [
      ...terrain('mud', [{ x: 3, y: 2 }, { x: 4, y: 2 }, { x: 5, y: 4 }, { x: 6, y: 4 }]),
      ...terrain('highGround', [{ x: 3, y: 1 }, { x: 6, y: 1 }, { x: 3, y: 5 }, { x: 6, y: 5 }]),
      ...terrain('holyGround', [{ x: 4, y: 3 }, { x: 5, y: 3 }]),
    ],
    obstacles: [],
    playerSpawns: PLAYER_SPAWNS,
    enemySpawns: ENEMY_SPAWNS,
  },
  {
    id: 'deadwood-edge',
    name: 'Deadwood Edge',
    description: 'A cramped forest edge with tree blockers and muddy flanks.',
    boardWidth: BOARD_WIDTH,
    boardHeight: BOARD_HEIGHT,
    tags: ['forest'],
    terrain: [
      ...terrain('highGround', [{ x: 2, y: 1 }, { x: 2, y: 5 }, { x: 7, y: 1 }, { x: 7, y: 5 }]),
      ...terrain('mud', [{ x: 4, y: 2 }, { x: 5, y: 2 }, { x: 4, y: 4 }, { x: 5, y: 4 }]),
      ...terrain('highGround', [{ x: 5, y: 0 }, { x: 4, y: 6 }]),
    ],
    obstacles: [],
    playerSpawns: PLAYER_SPAWNS,
    enemySpawns: ENEMY_SPAWNS,
  },
  {
    id: 'eclipse-arena',
    name: 'Eclipse Arena',
    description: 'A boss-style arena with raised corners and a cursed center lane.',
    boardWidth: BOARD_WIDTH,
    boardHeight: BOARD_HEIGHT,
    tags: ['boss', 'ruin'],
    terrain: [
      ...terrain('highGround', [
        { x: 3, y: 1 }, { x: 6, y: 1 },
        { x: 3, y: 5 }, { x: 6, y: 5 },
        { x: 2, y: 0 }, { x: 7, y: 0 }, { x: 2, y: 6 }, { x: 7, y: 6 },
      ]),
      ...terrain('mud', [{ x: 4, y: 3 }, { x: 5, y: 3 }, { x: 3, y: 3 }, { x: 6, y: 3 }]),
      ...terrain('holyGround', [{ x: 4, y: 2 }, { x: 5, y: 4 }]),
    ],
    obstacles: [],
    playerSpawns: PLAYER_SPAWNS,
    enemySpawns: ENEMY_SPAWNS,
  },
];

export const BATTLE_SPELLS: BattleSpell[] = [
  {
    id: 'arcane-bolt',
    name: 'Arcane Bolt',
    cost: 2,
    target: 'enemy',
    rarity: 'common',
    description: 'Direct spell damage to one enemy.',
  },
  {
    id: 'sanctified-mend',
    name: 'Sanctified Mend',
    cost: 2,
    target: 'ally',
    rarity: 'common',
    description: 'Restore health to one allied unit.',
  },
  {
    id: 'thorn-ward',
    name: 'Thorn Ward',
    cost: 3,
    target: 'ally',
    rarity: 'common',
    description: 'Heal slightly and raise defense.',
  },
  {
    id: 'withering-curse',
    name: 'Withering Curse',
    cost: 3,
    target: 'enemy',
    rarity: 'common',
    description: 'Damage and weaken an enemy attack.',
  },
  {
    id: 'rallying-hymn',
    name: 'Rallying Hymn',
    cost: 4,
    target: 'none',
    rarity: 'common',
    description: 'Heal all allies and lift morale.',
  },
  {
    id: 'chain-spark',
    name: 'Chain Spark',
    cost: 4,
    target: 'none',
    rarity: 'common',
    description: 'Small damage to every enemy unit.',
  },
  {
    id: 'gravity-snare',
    name: 'Gravity Snare',
    cost: 4,
    target: 'enemy',
    rarity: 'common',
    description: 'Damage and slow one enemy.',
  },
  {
    id: 'ember-dart',
    name: 'Ember Dart',
    cost: 1,
    target: 'enemy',
    rarity: 'common',
    description: 'Cheap fire damage for finishing wounded enemies.',
  },
  {
    id: 'warding-prayer',
    name: 'Warding Prayer',
    cost: 2,
    target: 'ally',
    rarity: 'common',
    description: 'Small heal and defense boost on one ally.',
  },
  {
    id: 'ashen-step',
    name: 'Ashen Step',
    cost: 3,
    target: 'ally',
    rarity: 'common',
    description: 'Boost one ally movement and speed.',
  },
  {
    id: 'judgement',
    name: 'Judgement',
    cost: 5,
    target: 'enemy',
    rarity: 'rare',
    description: 'Heavy holy damage to one enemy.',
  },
  {
    id: 'royal-command',
    name: 'Royal Command',
    cost: 5,
    target: 'none',
    rarity: 'rare',
    description: 'Increase allied attack for this fight.',
  },
  {
    id: 'moonlit-veil',
    name: 'Moonlit Veil',
    cost: 6,
    target: 'none',
    rarity: 'rare',
    description: 'Raise defense across the whole army.',
  },
  {
    id: 'blood-star',
    name: 'Blood Star',
    cost: 5,
    target: 'enemy',
    rarity: 'rare',
    description: 'Damage an enemy and restore the commander.',
  },
  {
    id: 'iron-benediction',
    name: 'Iron Benediction',
    cost: 5,
    target: 'none',
    rarity: 'rare',
    description: 'Raise allied attack and defense.',
  },
  {
    id: 'soul-tether',
    name: 'Soul Tether',
    cost: 4,
    target: 'ally',
    rarity: 'rare',
    description: 'Strong heal and morale lift on one ally.',
  },
  {
    id: 'frost-lance',
    name: 'Frost Lance',
    cost: 4,
    target: 'enemy',
    rarity: 'rare',
    description: 'Ranged spell damage that heavily slows one enemy.',
  },
  {
    id: 'eclipse-nova',
    name: 'Eclipse Nova',
    cost: 8,
    target: 'none',
    rarity: 'legendary',
    description: 'Large damage to every enemy unit.',
  },
  {
    id: 'saint-king-aegis',
    name: 'Saint-King Aegis',
    cost: 8,
    target: 'none',
    rarity: 'legendary',
    description: 'Mass heal and defense surge across the army.',
  },
  {
    id: 'time-crown-edict',
    name: 'Time-Crown Edict',
    cost: 9,
    target: 'none',
    rarity: 'legendary',
    description: 'Speed up allies and slow every enemy.',
  },
];

interface EnemyArchetype {
  id: string;
  name: string;
  subtitle: string;
  modelNumber: PlayerModelNumber;
  personality: EnemyAiPersonality;
  templates: string[];
}

interface EnemySpawnRegion {
  id: string;
  minX: number;
  minY: number;
  maxX: number;
  maxY: number;
  levels: number[];
}

const ENEMY_ARCHETYPES: EnemyArchetype[] = [
  {
    id: 'ashen-duelist',
    name: 'Ashen Duelist',
    subtitle: 'Rogue commander',
    modelNumber: 1,
    personality: 'aggressive',
    templates: ['thief', 'crossbow', 'witchdoc', 'darkpriest', 'knight-squire'],
  },
  {
    id: 'black-pike-raider',
    name: 'Black Pike Raider',
    subtitle: 'Roadside warband',
    modelNumber: 2,
    personality: 'defensive',
    templates: ['bell', 'crossbow', 'darkpriest', 'mercenary', 'knight-squire'],
  },
  {
    id: 'gravebound-magus',
    name: 'Gravebound Magus',
    subtitle: 'Arcane patrol',
    modelNumber: 5,
    personality: 'arcane',
    templates: ['enchanter', 'witchdoc', 'plaugedoc', 'firelord'],
  },
  {
    id: 'eclipsed-warlord',
    name: 'Eclipsed Warlord',
    subtitle: 'Southeastern boss',
    modelNumber: 6,
    personality: 'boss',
    templates: ['mercenary', 'fallen', 'crow', 'plaugedoc', 'priest-high-priest'],
  },
  {
    id: 'candle-vow-zealot',
    name: 'Candle-Vow Zealot',
    subtitle: 'Relic oathbreaker',
    modelNumber: 4,
    personality: 'defensive',
    templates: ['bell', 'darkpriest', 'crossbow', 'templar-initiate', 'knight-squire'],
  },
  {
    id: 'moonfen-witch',
    name: 'Moonfen Witch',
    subtitle: 'Bog spellkeeper',
    modelNumber: 5,
    personality: 'arcane',
    templates: ['witchdoc', 'enchanter', 'plaugedoc', 'darkpriest'],
  },
  {
    id: 'iron-choir-marshal',
    name: 'Iron Choir Marshal',
    subtitle: 'Bell-armored captain',
    modelNumber: 6,
    personality: 'balanced',
    templates: ['bell', 'archer', 'firelord', 'mercenary'],
  },
  {
    id: 'blackwater-reaver',
    name: 'Blackwater Reaver',
    subtitle: 'Drowned road hunter',
    modelNumber: 2,
    personality: 'aggressive',
    templates: ['thief', 'crow', 'witchdoc', 'archer'],
  },
  {
    id: 'veil-captain',
    name: 'Veil Captain',
    subtitle: 'Masked field officer',
    modelNumber: 3,
    personality: 'balanced',
    templates: ['crossbow', 'enchanter', 'fallen', 'darkpriest'],
  },
  {
    id: 'saintless-adjudicator',
    name: 'Saintless Adjudicator',
    subtitle: 'High-road tyrant',
    modelNumber: 6,
    personality: 'boss',
    templates: ['fallen', 'mercenary', 'crow', 'plaugedoc', 'templar-paragon'],
  },
];

const ENEMY_SPAWN_REGIONS: EnemySpawnRegion[] = [
  {
    id: 'western-vigil',
    minX: 2,
    minY: 3,
    maxX: 30,
    maxY: 28,
    levels: [1, 1, 2, 2, 3, 3, 4, 5],
  },
  {
    id: 'moonfen-crossroads',
    minX: 24,
    minY: 8,
    maxX: 55,
    maxY: 38,
    levels: [4, 5, 6, 6, 7, 8, 9, 10],
  },
  {
    id: 'eastern-blackwater',
    minX: 50,
    minY: 2,
    maxX: 82,
    maxY: 32,
    levels: [8, 9, 10, 11, 12, 13, 14, 15],
  },
  {
    id: 'eclipse-marches',
    minX: 56,
    minY: 28,
    maxX: 82,
    maxY: 46,
    levels: [12, 13, 14, 15, 15, 15],
  },
];

function clamp(value: number, min: number, max: number): number {
  return Math.max(min, Math.min(max, value));
}

function hashText(value: string): number {
  return value.split('').reduce((hash, char) => ((hash << 5) - hash + char.charCodeAt(0)) | 0, 0);
}

function seededRoll(seed: number): number {
  const x = Math.sin(seed) * 10000;
  return x - Math.floor(x);
}

function getWorldEnemyCycle(now = Date.now()): { cycle: number; spawnedAt: number; expiresAt: number } {
  const cycle = Math.floor(now / WORLD_ENEMY_CYCLE_MS);
  return {
    cycle,
    spawnedAt: cycle * WORLD_ENEMY_CYCLE_MS,
    expiresAt: (cycle + 1) * WORLD_ENEMY_CYCLE_MS,
  };
}

function getWorldBossCycle(now = Date.now()): { cycle: number; spawnedAt: number; expiresAt: number } {
  const cycle = Math.floor(now / WORLD_BOSS_CYCLE_MS);
  return {
    cycle,
    spawnedAt: cycle * WORLD_BOSS_CYCLE_MS,
    expiresAt: (cycle + 1) * WORLD_BOSS_CYCLE_MS,
  };
}

function getEnemyPoiFootprint(type: POIType): { width: number; height: number } {
  if (type === POIType.TOWN) return { width: 8, height: 8 };
  if (type === POIType.CAMPFIRE) return { width: 2, height: 2 };
  return { width: 4, height: 4 };
}

function isBlockedWorldEnemyTile(x: number, y: number, occupied: Set<string>): boolean {
  if (x < 0 || x >= MAP_CONFIG.width || y < 0 || y >= MAP_CONFIG.height) return true;
  if (occupied.has(`${x}:${y}`)) return true;

  const tile = getStaticMap()[y]?.[x];
  if (!tile || tile.type === TileType.WATER) return true;

  return getStaticPOIs().some(poi => {
    const footprint = getEnemyPoiFootprint(poi.type);
    const margin = 1;
    return (
      x >= poi.x - margin &&
      x < poi.x + footprint.width + margin &&
      y >= poi.y - margin &&
      y < poi.y + footprint.height + margin
    );
  });
}

function isTooCloseToOccupied(x: number, y: number, occupied: Set<string>, minDistance: number): boolean {
  for (const key of occupied) {
    const [occupiedX, occupiedY] = key.split(':').map(Number);
    if (Math.abs(x - occupiedX) + Math.abs(y - occupiedY) < minDistance) return true;
  }

  return false;
}

function findWorldEnemyHome(region: EnemySpawnRegion, seed: number, occupied: Set<string>, minDistance = 4): BoardCell {
  for (let attempt = 0; attempt < 90; attempt += 1) {
    const width = region.maxX - region.minX + 1;
    const height = region.maxY - region.minY + 1;
    const x = region.minX + Math.floor(seededRoll(seed + attempt * 17) * width);
    const y = region.minY + Math.floor(seededRoll(seed + attempt * 29) * height);

    if (!isBlockedWorldEnemyTile(x, y, occupied) && !isTooCloseToOccupied(x, y, occupied, minDistance)) {
      occupied.add(`${x}:${y}`);
      return { x, y };
    }
  }

  const fallback = {
    x: clamp(Math.floor((region.minX + region.maxX) / 2), 0, MAP_CONFIG.width - 1),
    y: clamp(Math.floor((region.minY + region.maxY) / 2), 0, MAP_CONFIG.height - 1),
  };
  occupied.add(`${fallback.x}:${fallback.y}`);
  return fallback;
}

function getWorldEnemyPatrolPosition(
  home: BoardCell,
  region: EnemySpawnRegion,
  seed: number,
  now: number,
  occupied: Set<string>,
  minDistance = 2
): BoardCell {
  const step = Math.floor(now / WORLD_ENEMY_MOVE_STEP_MS);
  const directions = [
    { x: 0, y: 0 },
    { x: 1, y: 0 },
    { x: -1, y: 0 },
    { x: 0, y: 1 },
    { x: 0, y: -1 },
    { x: 1, y: 1 },
    { x: -1, y: -1 },
  ];
  const startIndex = Math.floor(seededRoll(seed + step * 13) * directions.length);

  for (let attempt = 0; attempt < directions.length; attempt += 1) {
    const direction = directions[(startIndex + attempt) % directions.length];
    const x = clamp(home.x + direction.x, region.minX, region.maxX);
    const y = clamp(home.y + direction.y, region.minY, region.maxY);
    const key = `${x}:${y}`;

    if (!isBlockedWorldEnemyTile(x, y, occupied) && !isTooCloseToOccupied(x, y, occupied, minDistance)) {
      occupied.add(key);
      return { x, y };
    }
  }

  occupied.add(`${home.x}:${home.y}`);
  return home;
}

function readDefeatedWorldEnemyIds(cycle: number): Set<string> {
  if (typeof window === 'undefined') return new Set();

  const raw = readGameJson<{ cycle?: number; ids?: string[] }>(DEFEATED_WORLD_ENEMIES_KEY, {});
  if (raw.cycle !== cycle) {
    removeGameStorageItem(DEFEATED_WORLD_ENEMIES_KEY);
    return new Set();
  }

  return new Set(raw.ids || []);
}

function getWorldEnemySnapshotUsername(user: User | null): string {
  return user?.username || 'guest';
}

function readWorldEnemySnapshot(cycle: number, username: string, defeatedEnemyIds: Set<string>): WorldEnemy[] | null {
  if (typeof window === 'undefined') return null;

  const raw = readGameJson<Partial<WorldEnemySnapshot>>(WORLD_ENEMY_SNAPSHOT_KEY, {});
  if (raw.cycle !== cycle || raw.username !== username || !Array.isArray(raw.enemies)) {
    if (raw.cycle !== undefined) removeGameStorageItem(WORLD_ENEMY_SNAPSHOT_KEY);
    return null;
  }

  return raw.enemies.filter(enemy => !defeatedEnemyIds.has(enemy.id)).slice(0, WORLD_ENEMY_CAP);
}

function writeWorldEnemySnapshot(cycle: number, username: string, enemies: WorldEnemy[]): void {
  if (typeof window === 'undefined') return;

  writeGameJson(WORLD_ENEMY_SNAPSHOT_KEY, {
    cycle,
    username,
    enemies: enemies.slice(0, WORLD_ENEMY_CAP),
  });
}

export function markWorldEnemyDefeated(enemy: Pick<WorldEnemy, 'id'>, now = Date.now()): void {
  if (typeof window === 'undefined') return;
  if (enemy.id.startsWith('dungeon-')) return;

  const { cycle } = getWorldEnemyCycle(now);
  const defeated = readDefeatedWorldEnemyIds(cycle);
  defeated.add(enemy.id);
  writeGameJson(DEFEATED_WORLD_ENEMIES_KEY, {
    cycle,
    ids: Array.from(defeated).slice(-120),
  });
}

export function formatWorldEnemyTimeRemaining(expiresAt: number | undefined, now = Date.now()): string {
  const totalSeconds = Math.max(0, Math.ceil(((expiresAt || getWorldEnemyCycle(now).expiresAt) - now) / 1000));
  const hours = Math.floor(totalSeconds / 3600);
  const minutes = Math.floor((totalSeconds % 3600) / 60);

  if (hours > 0) return `${hours}h ${minutes}m`;
  return `${minutes}m`;
}

function getRegionLevelFloor(region: EnemySpawnRegion): number {
  return Math.min(...region.levels);
}

function makeWorldEnemyFromArchetype({
  id,
  archetype,
  level,
  home,
  patrol,
  seed,
  spawnedAt,
  expiresAt,
  regionId,
  spawnKind,
  lootMultiplier,
  maxMinions = MAX_FIELD_MINIONS,
}: {
  id: string;
  archetype: EnemyArchetype;
  level: number;
  home: BoardCell;
  patrol: BoardCell;
  seed: number;
  spawnedAt: number;
  expiresAt: number;
  regionId: string;
  spawnKind: WorldEnemy['spawnKind'];
  lootMultiplier?: number;
  maxMinions?: number;
}): WorldEnemy {
  const minionCount = clamp(2 + Math.floor(level / 4), 1, maxMinions);
  const minions = Array.from({ length: minionCount }, (_, index) => {
    const templateSeed = seed + index * 41;
    const templateId = archetype.templates[
      (index + Math.floor(seededRoll(templateSeed) * archetype.templates.length)) % archetype.templates.length
    ];
    return makeMinionStack(templateId, `${id}-${index}`, true);
  });

  return {
    id,
    name: archetype.name,
    subtitle: archetype.subtitle,
    x: patrol.x,
    y: patrol.y,
    homeX: home.x,
    homeY: home.y,
    level,
    modelNumber: archetype.modelNumber,
    personality: level >= 15 ? 'boss' : archetype.personality,
    minions,
    spawnedAt,
    expiresAt,
    spawnRegionId: regionId,
    spawnKind,
    lootMultiplier,
  };
}

function makeWorldBossEnemy({
  profile,
  level,
  home,
  patrol,
  seed,
  spawnedAt,
  expiresAt,
  cycle,
}: {
  profile: BossProfile;
  level: number;
  home: BoardCell;
  patrol: BoardCell;
  seed: number;
  spawnedAt: number;
  expiresAt: number;
  cycle: number;
}): WorldEnemy {
  const minionCount = clamp(2 + Math.floor(level / 6), 2, 4);
  const minions = Array.from({ length: minionCount }, (_, index) => {
    const templateId = profile.minionTemplates[
      (index + Math.floor(seededRoll(seed + index * 73) * profile.minionTemplates.length)) % profile.minionTemplates.length
    ];
    return makeMinionStack(templateId, `world-boss-${profile.id}-${cycle}-${index}`, true);
  });

  return {
    id: `world-boss-${cycle}-${profile.id}`,
    bossId: profile.id,
    name: profile.name,
    subtitle: profile.subtitle,
    story: profile.story,
    intro: profile.intro,
    artworkPath: profile.assetPath,
    x: patrol.x,
    y: patrol.y,
    homeX: home.x,
    homeY: home.y,
    level,
    modelNumber: profile.modelNumber,
    personality: 'boss',
    minions,
    spawnedAt,
    expiresAt,
    spawnRegionId: 'hourly-boss',
    spawnKind: 'world-boss',
    lootMultiplier: 3.2,
  };
}

function getHourlyWorldBoss(user: User | null, now: number, occupied: Set<string>, defeatedEnemyIds: Set<string>): WorldEnemy | null {
  const { cycle, spawnedAt, expiresAt } = getWorldBossCycle(now);
  const profile = BOSS_PROFILES[cycle % BOSS_PROFILES.length];
  const id = `world-boss-${cycle}-${profile.id}`;
  if (defeatedEnemyIds.has(id)) return null;

  const region = ENEMY_SPAWN_REGIONS[3] || ENEMY_SPAWN_REGIONS[ENEMY_SPAWN_REGIONS.length - 1];
  const seed = Math.abs(hashText(`hourly-world-boss-${cycle}-${profile.id}`));
  const home = findWorldEnemyHome(region, seed, occupied, 6);
  const patrol = getWorldEnemyPatrolPosition(home, region, seed + 317, spawnedAt, occupied, 4);
  const playerLevel = user?.stats.level || 1;
  const level = clamp(Math.max(10, playerLevel + 4, getRegionLevelFloor(region) + 4), 10, 24);

  return makeWorldBossEnemy({ profile, level, home, patrol, seed, spawnedAt, expiresAt, cycle });
}

export function getActiveWorldBoss(user: User | null, now = Date.now()): WorldEnemy | null {
  const { cycle } = getWorldBossCycle(now);
  const defeatedEnemyIds = readDefeatedWorldEnemyIds(cycle);
  return getHourlyWorldBoss(user, now, new Set<string>(), defeatedEnemyIds);
}

function getNearbyEnemyRegion(user: User): EnemySpawnRegion {
  return {
    id: 'player-nearby',
    minX: clamp(user.x - 7, 1, MAP_CONFIG.width - 2),
    minY: clamp(user.y - 7, 1, MAP_CONFIG.height - 2),
    maxX: clamp(user.x + 7, 1, MAP_CONFIG.width - 2),
    maxY: clamp(user.y + 7, 1, MAP_CONFIG.height - 2),
    levels: [clamp(user.stats.level - 1, 1, 15), clamp(user.stats.level, 1, 15)],
  };
}

export const BATTLE_TERRAIN_LABELS: Record<BattleTerrainType, string> = {
  ground: 'Ground',
  stone: 'Stone',
  mud: 'Mud',
  water: 'Water',
  bridge: 'Bridge',
  highGround: 'High Ground',
  cover: 'Cover',
  holyGround: 'Holy Ground',
};

export const BATTLE_TERRAIN_DESCRIPTIONS: Record<BattleTerrainType, string> = {
  ground: 'Open footing.',
  stone: 'Stable ruined road.',
  mud: 'Slow ground. Movement feels heavier here.',
  water: 'Shallow water. Slow for most units.',
  bridge: 'Passable crossing over water.',
  highGround: 'Raised ground. Ranged attackers gain bonus damage.',
  cover: 'Defensive cover. Incoming attacks are softened.',
  holyGround: 'Consecrated footing. Healers restore more health here.',
};

function selectBattleMapTemplate(user: User, enemy: WorldEnemy): BattleMapTemplate {
  if (enemy.personality === 'boss') {
    return BATTLE_MAP_TEMPLATES.find(template => template.tags.includes('boss')) || BATTLE_MAP_TEMPLATES[0];
  }

  const eligibleTemplates = BATTLE_MAP_TEMPLATES.filter(template => !template.tags.includes('boss'));
  const seed = Math.abs(hashText(`${user.username}-${enemy.id}-${enemy.level}-${enemy.x}-${enemy.y}`));
  return eligibleTemplates[seed % eligibleTemplates.length] || BATTLE_MAP_TEMPLATES[0];
}

function getSpawnCell(spawns: BoardCell[], index: number, fallback: BoardCell): BoardCell {
  return spawns[index] || fallback;
}

function getCellKey(cell: BoardCell): string {
  return `${cell.x}:${cell.y}`;
}

function isCellOccupied(cell: BoardCell, occupiedCells: Set<string>): boolean {
  return occupiedCells.has(getCellKey(cell));
}

function claimSpawnCell(
  candidates: BoardCell[],
  fallback: BoardCell,
  occupiedCells: Set<string>,
  map: BattleMapTemplate
): BoardCell {
  const available = candidates.find(cell => !isCellOccupied(cell, occupiedCells) && !isObstacleOnMap(map, cell));
  const claimed = available || findOpenBattleCell(map, occupiedCells) || fallback;
  occupiedCells.add(getCellKey(claimed));
  return claimed;
}

function findOpenBattleCell(map: BattleMapTemplate, occupiedCells: Set<string>): BoardCell | undefined {
  for (let y = 0; y < map.boardHeight; y += 1) {
    for (let x = 0; x < map.boardWidth; x += 1) {
      const cell = { x, y };
      if (!isCellOccupied(cell, occupiedCells) && !isObstacleOnMap(map, cell)) return cell;
    }
  }

  return undefined;
}

function isObstacleOnMap(map: BattleMapTemplate, cell: BoardCell): boolean {
  return map.obstacles.some(obstacle => obstacle.x === cell.x && obstacle.y === cell.y);
}

function isValidPlayerFormationCell(map: BattleMapTemplate, cell: BoardCell | undefined): cell is BoardCell {
  if (!cell) return false;
  return (
    cell.x >= 0 &&
    cell.x <= 1 &&
    cell.y >= 0 &&
    cell.y < map.boardHeight &&
    !isObstacleOnMap(map, cell)
  );
}

function getEnemyFormationSpawn(map: BattleMapTemplate, enemy: WorldEnemy, index: number): BoardCell {
  const commanderCell = getSpawnCell(map.enemySpawns, 0, { x: map.boardWidth - 1, y: 3 });
  const candidateSpawns = map.enemySpawns.filter(cell => !(cell.x === commanderCell.x && cell.y === commanderCell.y));
  const offset = candidateSpawns.length > 0 ? Math.abs(hashText(`${enemy.id}-spawn-${index}`)) % candidateSpawns.length : 0;
  return getSpawnCell(candidateSpawns, (index + offset) % Math.max(1, candidateSpawns.length), { x: map.boardWidth - 2, y: index });
}

function makeMinionStack(templateId: string, idPrefix: string, deterministic = false): MinionStack {
  return {
    id: deterministic ? `${idPrefix}-${templateId}` : `${idPrefix}-${templateId}-${Math.random().toString(16).slice(2)}`,
    templateId,
    quantity: 1,
    acquiredAt: Date.now(),
  };
}

function getBattleModifiers(stats: CharacterStats): BattleModifiers {
  const armyPower = stats.armyPower ?? stats.attack ?? 5;
  const defensivePower = stats.defensivePower ?? stats.defense ?? 5;
  const morale = stats.morale ?? stats.speed ?? 5;
  const spellPower = stats.spellPower ?? Math.floor(armyPower / 2) + Math.floor(stats.level / 2);

  return {
    armyPower: Math.max(1, armyPower),
    defensivePower: Math.max(1, defensivePower),
    spellPower: Math.max(1, spellPower),
    morale: Math.max(1, morale),
  };
}

function isBossBattleEnemy(enemy: Pick<WorldEnemy, 'personality' | 'bossId' | 'spawnKind'>): boolean {
  return enemy.personality === 'boss' || Boolean(enemy.bossId) || enemy.spawnKind === 'world-boss';
}

function isSingleplayerRandomRunEnemy(enemy: Pick<WorldEnemy, 'id'>): boolean {
  return enemy.id.startsWith('daily-run-enemy-');
}

function getSideMana(state: BattleState, side: BattleSide): number {
  return state.mana[side] || 0;
}

function setSideMana(state: BattleState, side: BattleSide, value: number): BattleState {
  return {
    ...state,
    mana: {
      ...state.mana,
      [side]: clamp(value, 0, MAX_MANA),
    },
  };
}

function grantCommanderMana(state: BattleState, unit: BattleUnit | undefined): BattleState {
  if (!unit || unit.kind !== 'commander') return state;
  const commanderTurnsTaken = state.log.filter(entry => (
    entry.actorId === unit.id &&
    ['wait', 'mana', 'spell', 'attack', 'move', 'heal'].includes(entry.action)
  )).length;
  const gain = clamp(commanderTurnsTaken + 1, 1, 4);
  return setSideMana(state, unit.side, getSideMana(state, unit.side) + gain);
}

function createBattleLogEntry(
  state: Pick<BattleState, 'round'>,
  message: string,
  options: Partial<Pick<BattleLogEntry, 'side' | 'actor' | 'actorId' | 'targetIds' | 'action' | 'style' | 'spellId' | 'fromX' | 'fromY' | 'toX' | 'toY' | 'resurrectedUnitIds' | 'summonedUnitIds'>> = {}
): BattleLogEntry {
  return {
    id: `log-${Date.now()}-${Math.random().toString(16).slice(2)}`,
    round: state.round,
    action: options.action || 'system',
    side: options.side,
    actor: options.actor,
    actorId: options.actorId,
    targetIds: options.targetIds,
    style: options.style,
    spellId: options.spellId,
    fromX: options.fromX,
    fromY: options.fromY,
    toX: options.toX,
    toY: options.toY,
    resurrectedUnitIds: options.resurrectedUnitIds,
    summonedUnitIds: options.summonedUnitIds,
    message,
    createdAt: Date.now(),
  };
}

function withBattleLog(
  state: BattleState,
  message: string,
  options: Partial<Pick<BattleLogEntry, 'side' | 'actor' | 'actorId' | 'targetIds' | 'action' | 'style' | 'spellId' | 'fromX' | 'fromY' | 'toX' | 'toY' | 'resurrectedUnitIds' | 'summonedUnitIds'>> = {}
): BattleState {
  return {
    ...state,
    log: [createBattleLogEntry(state, message, options), ...state.log].slice(0, 24),
  };
}

export function getPlayerModelAsset(modelNumber: number): string {
  return getPlayerModelPath(modelNumber);
}

export function getNpcEnemiesForUser(user: User | null, now = Date.now()): WorldEnemy[] {
  const { cycle, spawnedAt, expiresAt } = getWorldEnemyCycle(now);
  const defeatedEnemyIds = readDefeatedWorldEnemyIds(cycle);
  const snapshotUsername = getWorldEnemySnapshotUsername(user);
  const savedEnemies = readWorldEnemySnapshot(cycle, snapshotUsername, defeatedEnemyIds);
  if (savedEnemies) {
    const occupied = new Set(savedEnemies.map(enemy => `${enemy.x}:${enemy.y}`));
    const activeBoss = getHourlyWorldBoss(user, now, occupied, defeatedEnemyIds);
    return activeBoss ? [activeBoss, ...savedEnemies] : savedEnemies;
  }

  const homeOccupied = new Set<string>();
  const patrolOccupied = new Set<string>();
  const enemies: WorldEnemy[] = [];

  if (user) {
    const nearbyRegion = getNearbyEnemyRegion(user);
    nearbyRegion.levels.forEach((level, index) => {
      const seed = Math.abs(hashText(`nearby-enemy-${cycle}-${user.username}-${index}`));
      const archetype = ENEMY_ARCHETYPES[(index + Math.floor(seededRoll(seed) * ENEMY_ARCHETYPES.length)) % ENEMY_ARCHETYPES.length];
      const id = `enemy-${cycle}-nearby-${user.username}-${index}-${archetype.id}`;
      if (defeatedEnemyIds.has(id)) return;

      const home = findWorldEnemyHome(nearbyRegion, seed, homeOccupied, 3);
      const patrol = getWorldEnemyPatrolPosition(home, nearbyRegion, seed + 211, spawnedAt, patrolOccupied, 2);

      enemies.push(makeWorldEnemyFromArchetype({
        id,
        archetype,
        level,
        home,
        patrol,
        seed,
        spawnedAt,
        expiresAt,
        regionId: nearbyRegion.id,
        spawnKind: 'nearby',
        lootMultiplier: 1.35,
        maxMinions: 5,
      }));
    });
  }

  ENEMY_SPAWN_REGIONS.forEach((region, regionIndex) => {
    region.levels.forEach((level, slotIndex) => {
      const globalSlot = enemies.length;
      if (globalSlot >= WORLD_ENEMY_CAP) return;

      const seed = Math.abs(hashText(`world-enemy-${cycle}-${region.id}-${slotIndex}`));
      const archetypeIndex = Math.floor(seededRoll(seed + regionIndex * 31) * ENEMY_ARCHETYPES.length);
      const archetype = ENEMY_ARCHETYPES[(archetypeIndex + slotIndex) % ENEMY_ARCHETYPES.length];
      const id = `enemy-${cycle}-${region.id}-${slotIndex}-${archetype.id}`;
      if (defeatedEnemyIds.has(id)) return;

      const home = findWorldEnemyHome(region, seed, homeOccupied, regionIndex >= 2 ? 4 : 5);
      const patrol = getWorldEnemyPatrolPosition(home, region, seed + 101, spawnedAt, patrolOccupied, 2);

      enemies.push(makeWorldEnemyFromArchetype({
        id,
        archetype,
        level,
        home,
        patrol,
        seed,
        spawnedAt,
        expiresAt,
        regionId: region.id,
        spawnKind: 'regional',
        lootMultiplier: level <= getRegionLevelFloor(region) + 1 ? 1.1 : undefined,
      }));
    });
  });

  const generatedEnemies = enemies.slice(0, WORLD_ENEMY_CAP);
  writeWorldEnemySnapshot(cycle, snapshotUsername, generatedEnemies);
  const activeBoss = getHourlyWorldBoss(user, now, patrolOccupied, defeatedEnemyIds);
  return activeBoss ? [activeBoss, ...generatedEnemies] : generatedEnemies;
}

function makeCommanderUnit(side: BattleSide, name: string, modelNumber: number, stats: CharacterStats, x: number, y: number, assetPath?: string): BattleUnit {
  const modifiers = getBattleModifiers(stats);
  const maxHealth = stats.maxHealth + stats.level * 7 + modifiers.defensivePower;

  return {
    id: `${side}-commander`,
    side,
    kind: 'commander',
    name,
    assetPath: assetPath || getPlayerModelAsset(modelNumber),
    quantity: 1,
    currentHealth: maxHealth,
    maxHealth,
    healthPerUnit: maxHealth,
    attack: 6 + Math.floor(modifiers.armyPower * 0.75),
    defense: 2 + Math.floor(modifiers.defensivePower / 3),
    magic: modifiers.spellPower,
    healing: 0,
    speed: 5 + Math.floor(modifiers.morale / 2),
    movement: clamp(2 + Math.floor(modifiers.morale / 8), 2, 4),
    range: 1,
    x,
    y,
  };
}

function makeMinionUnit(stack: MinionStack, side: BattleSide, x: number, y: number, modifiers: BattleModifiers): BattleUnit | null {
  const template = getMinionTemplate(stack.templateId);
  if (!template) return null;

  const runBonus = stack.runStatBonus || {};
  const baseAttack = template.stats.attack + (runBonus.attack || 0);
  const baseDefense = template.stats.defense + (runBonus.defense || 0);
  const baseMagic = template.stats.magic + (runBonus.magic || 0);
  const baseHealing = template.stats.healing + (runBonus.healing || 0);
  const baseHealth = template.stats.health + (runBonus.health || 0);
  const baseMovement = template.stats.movement + (runBonus.movement || 0);
  const baseRange = template.stats.range + (runBonus.range || 0);
  const maxHealth = baseHealth + Math.floor(modifiers.defensivePower * 0.9) + Math.floor(modifiers.morale / 2);
  const currentHealth = typeof stack.runCurrentHealth === 'number'
    ? clamp(Math.round(stack.runCurrentHealth), 0, maxHealth)
    : maxHealth;
  const movement = clamp(baseMovement + Math.floor(modifiers.morale / 12), 1, 6);
  const range = clamp(baseRange, 1, 6);
  const healing = template.class === 'priest'
    ? baseHealing + Math.floor(modifiers.spellPower / 6)
    : 0;

  return {
    id: `${side}-${stack.id}`,
    side,
    kind: 'minion',
    rosterId: stack.id,
    templateId: template.templateId,
    name: template.name,
    assetPath: getMinionAssetPath(template.assetName),
    quantity: 1,
    currentHealth,
    maxHealth,
    healthPerUnit: maxHealth,
    attack: baseAttack + Math.floor(modifiers.armyPower / 3),
    defense: baseDefense + Math.floor(modifiers.defensivePower / 5),
    magic: baseMagic + Math.floor(modifiers.spellPower / 5),
    healing,
    speed: movement * 3 + baseAttack + Math.floor(baseMagic / 2),
    movement,
    range,
    x,
    y,
  };
}

function makeEnemyCommanderStats(level: number, enemy?: Pick<WorldEnemy, 'personality' | 'bossId' | 'spawnKind'>): CharacterStats {
  const boss = enemy ? isBossBattleEnemy(enemy) : false;
  const maxHealth = boss ? 105 + level * 11 : 70 + level * 7;

  return {
    armyPower: 4 + Math.floor(level * 0.85) + (boss ? 4 + Math.floor(level * 0.12) : 0),
    defensivePower: 3 + Math.floor(level * 0.58) + (boss ? 5 + Math.floor(level * 0.1) : 0),
    morale: 4 + Math.floor(level * 0.35) + (boss ? 2 : 0),
    spellPower: 2 + Math.floor(level * 0.48) + (boss ? 3 + Math.floor(level * 0.08) : 0),
    health: maxHealth,
    maxHealth,
    level,
    unallocatedPoints: 0,
  };
}

function getPlayerBattleStacks(user: User): MinionStack[] {
  if (user.minions.length > 0) return getFieldedMinions(user);

  return [
    makeMinionStack('knight-squire', 'loaned'),
    makeMinionStack('priest-acolyte', 'loaned'),
  ];
}

function getMinionPower(stack: MinionStack): number {
  const template = getMinionTemplate(stack.templateId);
  if (!template) return 0;

  return (
    template.stats.attack * 2 +
    template.stats.defense * 2 +
    template.stats.magic * 2 +
    template.stats.healing * 2 +
    template.stats.health +
    template.stats.movement * 3 +
    template.stats.range * 3
  );
}

function getUserBattleRating(user: User): number {
  const modifiers = getBattleModifiers(user.stats);
  const commanderScore =
    user.stats.maxHealth +
    user.stats.level * 16 +
    modifiers.armyPower * 7 +
    modifiers.defensivePower * 7 +
    modifiers.spellPower * 9 +
    modifiers.morale * 5;
  const minionScore = getPlayerBattleStacks(user).reduce((total, stack) => total + getMinionPower(stack), 0);

  return commanderScore + minionScore;
}

function getEnemyBattleRating(enemy: WorldEnemy, enemyStats: CharacterStats): number {
  const modifiers = getBattleModifiers(enemyStats);
  const commanderScore =
    enemyStats.maxHealth +
    enemyStats.level * 16 +
    modifiers.armyPower * 7 +
    modifiers.defensivePower * 7 +
    modifiers.spellPower * 9 +
    modifiers.morale * 5;
  const minionScore = enemy.minions.reduce((total, stack) => total + getMinionPower(stack), 0);

  return commanderScore + minionScore;
}

export function getBattleRatingPreview(user: User, enemy: WorldEnemy): BattleRatingPreview {
  const enemyStats = makeEnemyCommanderStats(enemy.level, enemy);
  const playerRating = getUserBattleRating(user);
  const enemyRating = getEnemyBattleRating(enemy, enemyStats);
  const ratio = enemyRating <= 0 ? 99 : playerRating / enemyRating;
  const playerUnits = getPlayerBattleStacks(user).length + 1;
  const enemyUnits = enemy.minions.length + 1;

  if (ratio >= 1.45) {
    return {
      playerRating,
      enemyRating,
      ratio,
      label: 'Easy',
      tone: 'green',
      summary: 'Your commander clearly outclasses this patrol.',
      playerUnits,
      enemyUnits,
    };
  }

  if (ratio >= 0.9) {
    return {
      playerRating,
      enemyRating,
      ratio,
      label: 'Fair',
      tone: 'gold',
      summary: 'This should be winnable with clean targeting and spell use.',
      playerUnits,
      enemyUnits,
    };
  }

  if (ratio >= 0.65) {
    return {
      playerRating,
      enemyRating,
      ratio,
      label: 'Hard',
      tone: 'red',
      summary: 'Expect losses unless your opening formation is strong.',
      playerUnits,
      enemyUnits,
    };
  }

  return {
    playerRating,
    enemyRating,
    ratio,
    label: 'Deadly',
    tone: 'violet',
    summary: 'This enemy is likely stronger than your current warband.',
    playerUnits,
    enemyUnits,
  };
}

function cloneRecruitMinion(stack: MinionStack, enemy: WorldEnemy, index: number): MinionStack {
  return {
    ...stack,
    id: `recruited-${enemy.id}-${stack.templateId}-${Date.now()}-${index}-${Math.random().toString(16).slice(2)}`,
    quantity: 1,
    acquiredAt: Date.now(),
  };
}

function createRecruitOffer(user: User, enemy: WorldEnemy, enemyStats: CharacterStats): BattleRecruitOffer | undefined {
  if (enemy.personality === 'boss') return undefined;
  if (enemy.level > user.stats.level + 1) return undefined;

  const playerRating = getUserBattleRating(user);
  const enemyRating = getEnemyBattleRating(enemy, enemyStats);
  const outclassed = playerRating >= enemyRating * 1.85 || user.stats.level >= enemy.level + 6;
  if (!outclassed || enemy.minions.length === 0) return undefined;

  const offerSeed = Math.abs(hashText(`${user.username}:${enemy.id}:${enemy.spawnedAt || 0}:surrender`));
  if (seededRoll(offerSeed) >= 0.06) return undefined;

  const eligibleMinions = enemy.minions.filter(stack => isPlayerRecruitableMinionTemplate(stack.templateId));
  if (eligibleMinions.length === 0) return undefined;
  const offeredMinion = eligibleMinions[Math.floor(seededRoll(offerSeed + 31) * eligibleMinions.length)];

  return {
    offeredMinions: [cloneRecruitMinion(offeredMinion, enemy, 0)],
    reason: `${enemy.name} sees your army is overwhelming. One survivor offers service instead of bloodshed.`,
  };
}

export function createNpcBattleState(user: User, enemy: WorldEnemy, options: CreateNpcBattleOptions = {}): BattleState {
  const battleMap = selectBattleMapTemplate(user, enemy);
  const playerStats = options.playerStats || user.stats;
  const playerModifiers = getBattleModifiers(playerStats);
  const enemyStats = makeEnemyCommanderStats(enemy.level, enemy);
  const enemyModifiers = getBattleModifiers(enemyStats);
  const recruitOffer = options.suppressRecruitOffer ? undefined : createRecruitOffer(user, enemy, enemyStats);
  const bossBattle = isBossBattleEnemy(enemy);
  const commanderFormationCell = options.playerFormation?.[COMMANDER_FORMATION_KEY];
  const playerCommanderSpawn = isValidPlayerFormationCell(battleMap, commanderFormationCell)
    ? commanderFormationCell
    : getSpawnCell(battleMap.playerSpawns, 0, { x: 0, y: 3 });
  const enemyCommanderSpawn = getSpawnCell(battleMap.enemySpawns, 0, { x: battleMap.boardWidth - 1, y: 3 });
  const playerStacks = options.playerStacks || getPlayerBattleStacks(user);
  const occupiedCells = new Set<string>([
    getCellKey(playerCommanderSpawn),
    getCellKey(enemyCommanderSpawn),
  ]);

  const playerUnits = [
    makeCommanderUnit(
      'player',
      options.playerName || user.username,
      options.playerModelNumber || user.selectedModel || 3,
      playerStats,
      playerCommanderSpawn.x,
      playerCommanderSpawn.y
    ),
    ...playerStacks
      .map((stack, index) => {
        const formationCell = options.playerFormation?.[stack.id];
        const fallbackSpawn = getSpawnCell(battleMap.playerSpawns, index + 1, { x: 1, y: index });
        const preferredCandidates = isValidPlayerFormationCell(battleMap, formationCell)
          ? [formationCell, ...battleMap.playerSpawns.slice(1)]
          : battleMap.playerSpawns.slice(1);
        const spawn = claimSpawnCell(preferredCandidates, fallbackSpawn, occupiedCells, battleMap);
        return makeMinionUnit(stack, 'player', spawn.x, spawn.y, playerModifiers);
      })
      .filter((unit): unit is BattleUnit => Boolean(unit)),
  ];

  const enemyUnits = [
    makeCommanderUnit('enemy', enemy.name, enemy.modelNumber, enemyStats, enemyCommanderSpawn.x, enemyCommanderSpawn.y, enemy.artworkPath),
    ...enemy.minions
      .slice(0, ENEMY_FIELD_MINIONS)
      .map((stack, index) => {
        const preferredSpawn = getEnemyFormationSpawn(battleMap, enemy, index);
        const spawn = claimSpawnCell(
          [preferredSpawn, ...battleMap.enemySpawns.slice(1)],
          { x: battleMap.boardWidth - 2, y: Math.min(battleMap.boardHeight - 1, index) },
          occupiedCells,
          battleMap
        );
        return makeMinionUnit(stack, 'enemy', spawn.x, spawn.y, enemyModifiers);
      })
      .filter((unit): unit is BattleUnit => Boolean(unit)),
  ];

  const units = [...playerUnits, ...enemyUnits];
  const openingTurnOrder = getTurnOrder(units);
  const firstUnit = openingTurnOrder[0];
  const openingLog = [
    createBattleLogEntry(
      { round: 1 },
      `${enemy.name} blocks the road at ${battleMap.name}.`,
      { side: 'enemy', actor: enemy.name, action: 'system' }
    ),
  ];

  if (recruitOffer) {
    openingLog.unshift(createBattleLogEntry(
      { round: 1 },
      `${enemy.name} lowers their banner and asks to join you.`,
      { side: 'enemy', actor: enemy.name, action: 'morale' }
    ));
  }

  const initialState: BattleState = {
    id: `battle-${enemy.id}-${Date.now()}`,
    enemy,
    mapTemplateId: battleMap.id,
    mapName: battleMap.name,
    boardWidth: battleMap.boardWidth,
    boardHeight: battleMap.boardHeight,
    terrain: battleMap.terrain,
    obstacles: battleMap.obstacles,
    units,
    activeUnitId: firstUnit.id,
    turnQueue: openingTurnOrder.slice(1).map(unit => unit.id),
    round: 1,
    status: 'active',
    mana: { player: 0, enemy: 0 },
    turnStartedAt: Date.now(),
    turnTimeLimitMs: TURN_TIME_LIMIT_MS,
    log: openingLog,
    recruitOffer,
    bossPhase: bossBattle ? 1 : undefined,
    bossSpecialRounds: bossBattle ? {} : undefined,
    bossSpecialUses: bossBattle ? {} : undefined,
    createdAt: Date.now(),
  };

  return grantCommanderMana(initialState, firstUnit);
}

export function getDisplayedQuantity(unit: BattleUnit): number {
  return unit.kind === 'minion' && unit.currentHealth > 0 ? 1 : 1;
}

export function getEffectiveMovement(unit: BattleUnit): number {
  const penalty = unit.slowDebuff?.movementPenalty || 0;
  return Math.max(1, unit.movement - penalty);
}

export function getEffectiveSpeed(unit: BattleUnit): number {
  const penalty = unit.slowDebuff?.speedPenalty || 0;
  return Math.max(1, unit.speed - penalty);
}

function applySlowDebuff(unit: BattleUnit, movementPenalty: number, speedPenalty: number): BattleUnit {
  return {
    ...unit,
    slowDebuff: {
      movementPenalty: Math.max(0, movementPenalty),
      speedPenalty: Math.max(0, speedPenalty),
    },
  };
}

function clearSlowDebuff(unit: BattleUnit): BattleUnit {
  if (!unit.slowDebuff) return unit;
  const { slowDebuff: _removed, ...rest } = unit;
  return rest;
}

export function getMoveRange(unit: BattleUnit): number {
  return getEffectiveMovement(unit);
}

export function getBattleMana(state: BattleState, side: BattleSide): number {
  return getSideMana(state, side);
}

export function getBattleSpellPower(state: BattleState, side: BattleSide): number {
  const commander = state.units.find(unit => unit.side === side && unit.kind === 'commander');
  return commander?.magic || 1;
}

export function getTurnTimeRemaining(state: BattleState, now = Date.now()): number {
  return Math.max(0, state.turnTimeLimitMs - (now - state.turnStartedAt));
}

export function getTurnOrder(units: BattleUnit[]): BattleUnit[] {
  return units
    .filter(unit => unit.currentHealth > 0)
    .sort((a, b) => getEffectiveSpeed(b) - getEffectiveSpeed(a) || a.id.localeCompare(b.id));
}

function getDerivedTurnQueue(state: BattleState): string[] {
  const order = getTurnOrder(state.units);
  const activeIndex = order.findIndex(unit => unit.id === state.activeUnitId);

  if (activeIndex === -1) {
    return order.map(unit => unit.id);
  }

  return order.slice(activeIndex + 1).map(unit => unit.id);
}

function getSanitizedTurnQueue(state: BattleState): string[] {
  const liveIds = new Set(state.units.filter(unit => unit.currentHealth > 0).map(unit => unit.id));
  const seenIds = new Set<string>(state.activeUnitId ? [state.activeUnitId] : []);
  const sourceQueue = Array.isArray(state.turnQueue) ? state.turnQueue : getDerivedTurnQueue(state);
  const queue: string[] = [];

  sourceQueue.forEach(unitId => {
    if (!liveIds.has(unitId) || seenIds.has(unitId)) return;
    seenIds.add(unitId);
    queue.push(unitId);
  });

  return queue;
}

export function getActiveUnit(state: BattleState): BattleUnit | undefined {
  return state.units.find(unit => unit.id === state.activeUnitId && unit.currentHealth > 0);
}

export function getUnitAt(state: BattleState, x: number, y: number): BattleUnit | undefined {
  return state.units.find(unit => unit.currentHealth > 0 && unit.x === x && unit.y === y);
}

export function getDistance(a: BoardCell, b: BoardCell): number {
  return Math.abs(a.x - b.x) + Math.abs(a.y - b.y);
}

export function isObstacle(state: BattleState, x: number, y: number): boolean {
  return state.obstacles.some(cell => cell.x === x && cell.y === y);
}

export function getTerrainAt(state: BattleState, x: number, y: number): BattleTerrainType {
  return state.terrain.find(cell => cell.x === x && cell.y === y)?.type || 'ground';
}

export function getTerrainMoveCost(type: BattleTerrainType): number {
  switch (type) {
    case 'mud':
    case 'water':
    case 'highGround':
      return 2;
    default:
      return 1;
  }
}

export function isInsideBoard(state: BattleState, x: number, y: number): boolean {
  return x >= 0 && x < state.boardWidth && y >= 0 && y < state.boardHeight;
}

const ORTHOGONAL_MOVE_DIRS: Array<{ dx: number; dy: number }> = [
  { dx: 0, dy: 1 },
  { dx: 0, dy: -1 },
  { dx: 1, dy: 0 },
  { dx: -1, dy: 0 },
];

function getStepMoveCost(state: BattleState, x: number, y: number): number {
  return getTerrainMoveCost(getTerrainAt(state, x, y));
}

function getReachableMoveCosts(state: BattleState, unit: BattleUnit): Map<string, number> {
  const costs = new Map<string, number>();
  const maxRange = getMoveRange(unit);
  const queue: Array<{ x: number; y: number; cost: number }> = [{ x: unit.x, y: unit.y, cost: 0 }];
  const startsInMud = getTerrainAt(state, unit.x, unit.y) === 'mud';
  costs.set(`${unit.x}:${unit.y}`, 0);

  for (let index = 0; index < queue.length; index += 1) {
    const current = queue[index];
    for (const { dx, dy } of ORTHOGONAL_MOVE_DIRS) {
      const nx = current.x + dx;
      const ny = current.y + dy;
      if (!isInsideBoard(state, nx, ny) || isObstacle(state, nx, ny)) continue;
      if (getUnitAt(state, nx, ny)) continue;

      const currentTerrain = getTerrainAt(state, current.x, current.y);
      const nextTerrain = getTerrainAt(state, nx, ny);
      const mudLocked = startsInMud || currentTerrain === 'mud' || nextTerrain === 'mud';
      if (mudLocked && getDistance(unit, { x: nx, y: ny }) > 1) continue;

      const nextCost = current.cost + getStepMoveCost(state, nx, ny);
      if (nextCost > maxRange) continue;

      const key = `${nx}:${ny}`;
      const existing = costs.get(key);
      if (existing !== undefined && existing <= nextCost) continue;

      costs.set(key, nextCost);
      queue.push({ x: nx, y: ny, cost: nextCost });
    }
  }

  return costs;
}

export function getReachableMoveCells(state: BattleState, unit: BattleUnit): BoardCell[] {
  const costs = getReachableMoveCosts(state, unit);
  const cells: BoardCell[] = [];

  costs.forEach((cost, key) => {
    if (cost <= 0) return;
    const [x, y] = key.split(':').map(Number);
    cells.push({ x, y });
  });

  return cells;
}

export function canMoveTo(state: BattleState, unit: BattleUnit, x: number, y: number): boolean {
  if (!isInsideBoard(state, x, y) || isObstacle(state, x, y) || getUnitAt(state, x, y)) {
    return false;
  }

  const cost = getReachableMoveCosts(state, unit).get(`${x}:${y}`);
  return cost !== undefined && cost > 0 && cost <= getMoveRange(unit);
}

function getSkirmishStepRange(unit: BattleUnit | undefined): number {
  if (unit?.templateId === 'fallen') return 2;
  if (unit?.templateId === 'crow' || unit?.templateId === 'thief') return 1;
  return 0;
}

function isSkirmishStepUnit(unit: BattleUnit | undefined): boolean {
  return getSkirmishStepRange(unit) > 0;
}

export function canSkirmishAttackAfterMove(state: BattleState, unitId: string): boolean {
  const unit = state.units.find(item => item.id === unitId && item.currentHealth > 0);
  if (!unit || !isSkirmishStepUnit(unit) || state.activeUnitId !== unit.id || state.status !== 'active') {
    return false;
  }

  return state.units.some(target => target.currentHealth > 0 && canAttack(unit, target));
}

function isBleedStrikeUnit(unit: BattleUnit | undefined): boolean {
  return unit?.templateId === 'crow' || unit?.templateId === 'thief';
}

function isPoisonShotUnit(unit: BattleUnit | undefined): boolean {
  return unit?.templateId === 'plaugedoc' || unit?.templateId === 'witchdoc';
}

function canRawBonusMoveTo(state: BattleState, unit: BattleUnit, x: number, y: number): boolean {
  const stepRange = getSkirmishStepRange(unit);
  const distance = getDistance(unit, { x, y });
  return distance > 0 && distance <= stepRange && canMoveTo(state, unit, x, y);
}

export function isBonusMovePending(state: BattleState, unit: BattleUnit | undefined): boolean {
  return Boolean(
    unit &&
    state.status === 'active' &&
    state.bonusMoveUnitId === unit.id &&
    state.activeUnitId === unit.id &&
    unit.currentHealth > 0 &&
    isSkirmishStepUnit(unit)
  );
}

export function getBonusMoveCells(state: BattleState, unit: BattleUnit): BoardCell[] {
  if (!isBonusMovePending(state, unit)) return [];

  const candidates: BoardCell[] = [];
  const stepRange = getSkirmishStepRange(unit);
  for (let y = unit.y - stepRange; y <= unit.y + stepRange; y += 1) {
    for (let x = unit.x - stepRange; x <= unit.x + stepRange; x += 1) {
      const distance = getDistance(unit, { x, y });
      if (distance <= 0 || distance > stepRange) continue;
      if (canRawBonusMoveTo(state, unit, x, y)) candidates.push({ x, y });
    }
  }

  const awayFrom = state.bonusMoveAwayFrom;
  if (!awayFrom) return candidates;

  const currentDistance = getDistance(unit, awayFrom);
  const awayCandidates = candidates.filter(cell => getDistance(cell, awayFrom) > currentDistance);
  return awayCandidates.length > 0 ? awayCandidates : candidates;
}

export function canBonusMoveTo(state: BattleState, unit: BattleUnit, x: number, y: number): boolean {
  return getBonusMoveCells(state, unit).some(cell => cell.x === x && cell.y === y);
}

export function moveBonusBattleUnit(state: BattleState, unitId: string, x: number, y: number): BattleState {
  const unit = state.units.find(item => item.id === unitId && item.currentHealth > 0);
  if (!unit || !canBonusMoveTo(state, unit, x, y)) return state;
  const message = unit.templateId === 'fallen'
    ? `${unit.name} beats its wings and withdraws after the strike.`
    : `${unit.name} slips away after the strike.`;

  const movedState = {
    ...state,
    bonusMoveUnitId: undefined,
    bonusMoveAwayFrom: undefined,
    units: state.units.map(item => item.id === unitId ? { ...item, x, y } : item),
  };

  return advanceBattleTurn(withBattleLog(movedState, message, {
    side: unit.side,
    actor: unit.name,
    actorId: unit.id,
    targetIds: [unit.id],
    action: 'move',
    style: 'move',
    fromX: unit.x,
    fromY: unit.y,
    toX: x,
    toY: y,
  }));
}

export function skipBonusBattleMove(state: BattleState, unitId: string): BattleState {
  const unit = state.units.find(item => item.id === unitId && item.currentHealth > 0);
  if (!unit || !isBonusMovePending(state, unit)) return state;

  return advanceBattleTurn(withBattleLog({
    ...state,
    bonusMoveUnitId: undefined,
    bonusMoveAwayFrom: undefined,
  }, `${unit.name} holds after the strike.`, {
    side: unit.side,
    actor: unit.name,
    actorId: unit.id,
    targetIds: [unit.id],
    action: 'wait',
    style: 'guard',
  }));
}

export function isInRangedReach(origin: BoardCell, target: BoardCell, range: number): boolean {
  // Terrain, mud, and intervening units do not block ranged attacks or heals.
  return getDistance(origin, target) <= range;
}

export function getHealRange(healer: BattleUnit): number {
  return healer.range;
}

export function isPriestHealer(unit: BattleUnit): boolean {
  if (unit.kind !== 'minion' || unit.healing <= 0 || unit.currentHealth <= 0) return false;

  const template = unit.templateId ? getMinionTemplate(unit.templateId) : undefined;
  return !template || template.class === 'priest';
}

export function canAttack(attacker: BattleUnit, target: BattleUnit): boolean {
  return attacker.side !== target.side && isInRangedReach(attacker, target, attacker.range);
}

export function canHeal(healer: BattleUnit, target: BattleUnit): boolean {
  const cleansable = hasCleansableStatusEffect(target);

  return (
    isPriestHealer(healer) &&
    healer.side === target.side &&
    target.currentHealth > 0 &&
    (target.currentHealth < target.maxHealth || cleansable) &&
    isInRangedReach(healer, target, getHealRange(healer))
  );
}

function canChargePriestHeal(unit: BattleUnit): boolean {
  return isPriestHealer(unit);
}

export interface MinionSupportAbility {
  id: MinionSupportAbilityId;
  name: string;
  shortLabel: string;
  description: string;
}

export function getMinionSupportAbility(unit: BattleUnit | undefined): MinionSupportAbility | null {
  if (!unit || unit.kind !== 'minion' || unit.currentHealth <= 0 || unit.supportAbilityUsed) return null;

  switch (unit.templateId) {
    case 'bell':
      return {
        id: 'bell-march',
        name: 'Bell March',
        shortLabel: 'B',
        description: 'Pass turn to give all living allies +1 movement until this Bell Warden acts again.',
      };
    case 'enchanter':
      return {
        id: 'void-ward',
        name: 'Void Ward',
        shortLabel: 'V',
        description: 'Pass turn to give all living allies +3 defense until this Enchanter acts again.',
      };
    default:
      return null;
  }
}

function applySupportAuraDelta(unit: BattleUnit, abilityId: MinionSupportAbilityId, direction: 1 | -1): BattleUnit {
  if (abilityId === 'bell-march') {
    return {
      ...unit,
      movement: Math.max(1, unit.movement + direction),
      speed: Math.max(1, unit.speed + direction),
    };
  }

  if (abilityId === 'void-ward') {
    return {
      ...unit,
      defense: Math.max(0, unit.defense + direction * 3),
    };
  }

  return unit;
}

function clearSupportAura(state: BattleState, casterId: string): BattleState {
  const aura = state.supportAuras?.[casterId];

  if (!aura) {
    if (!state.units.some(unit => unit.id === casterId && unit.supportAbilityUsed)) return state;
    return {
      ...state,
      units: state.units.map(unit => (
        unit.id === casterId ? { ...unit, supportAbilityUsed: false } : unit
      )),
    };
  }

  const nextAuras = { ...(state.supportAuras || {}) };
  delete nextAuras[casterId];
  const targetIds = new Set(aura.targetIds);

  return {
    ...state,
    supportAuras: Object.keys(nextAuras).length > 0 ? nextAuras : undefined,
    units: state.units.map(unit => {
      let nextUnit = targetIds.has(unit.id)
        ? applySupportAuraDelta(unit, aura.abilityId, -1)
        : unit;

      if (unit.id === casterId) {
        nextUnit = { ...nextUnit, supportAbilityUsed: false };
      }

      return nextUnit;
    }),
  };
}

function getAdjacentAllies(state: BattleState, unit: BattleUnit): BattleUnit[] {
  return state.units.filter(candidate => (
    candidate.side === unit.side &&
    candidate.id !== unit.id &&
    candidate.currentHealth > 0 &&
    getDistance(candidate, unit) === 1
  ));
}

function getGuardingAlly(state: BattleState, target: BattleUnit): BattleUnit | undefined {
  return getAdjacentAllies(state, target)
    .filter(unit => unit.kind === 'minion' && unit.defense >= target.defense)
    .sort((a, b) => b.defense - a.defense)[0];
}

function getFlankingBonus(state: BattleState, attacker: BattleUnit, target: BattleUnit): number {
  const adjacentAttackers = state.units.filter(unit => (
    unit.side === attacker.side &&
    unit.currentHealth > 0 &&
    getDistance(unit, target) === 1
  )).length;

  return adjacentAttackers >= 2 ? 3 : 0;
}

function getCommanderAuraBonus(state: BattleState, unit: BattleUnit): number {
  if (unit.kind === 'commander') return 0;

  const commander = state.units.find(candidate => (
    candidate.side === unit.side &&
    candidate.kind === 'commander' &&
    candidate.currentHealth > 0
  ));

  if (!commander || getDistance(commander, unit) > 2) return 0;
  return unit.side === 'enemy' && state.enemy.personality === 'boss' ? 3 : 2;
}

function getTerrainDamageModifier(state: BattleState, attacker: BattleUnit, target: BattleUnit): number {
  const attackerTerrain = getTerrainAt(state, attacker.x, attacker.y);
  const targetTerrain = getTerrainAt(state, target.x, target.y);
  let modifier = 0;

  if (attackerTerrain === 'highGround') modifier += 2;
  if (targetTerrain === 'cover') modifier -= 2;
  if (targetTerrain === 'water' || targetTerrain === 'mud') modifier += 1;
  return modifier;
}

function getPoisonDirectDamagePenalty(attacker: BattleUnit): number {
  if (attacker.templateId === 'witchdoc') return 5;
  if (attacker.templateId === 'plaugedoc') return 4;
  return 0;
}

export function getAttackDamage(attacker: BattleUnit, target: BattleUnit, state?: BattleState): number {
  const magicBonus = attacker.range > 1 ? Math.floor(attacker.magic / 2) : 0;
  const auraBonus = state ? getCommanderAuraBonus(state, attacker) : 0;
  const flankingBonus = state ? getFlankingBonus(state, attacker, target) : 0;
  const terrainModifier = state ? getTerrainDamageModifier(state, attacker, target) : 0;
  const guardPenalty = state && getGuardingAlly(state, target) ? 1 : 0;
  const commanderDuelBonus = attacker.kind === 'commander' && target.kind === 'commander' ? 3 : 0;
  const baseDamage = attacker.kind === 'commander' ? 6 : 5;
  const poisonDirectPenalty = getPoisonDirectDamagePenalty(attacker);
  const rawDamage = attacker.attack + magicBonus + auraBonus + flankingBonus + terrainModifier + commanderDuelBonus + baseDamage - poisonDirectPenalty;
  const minimumDamage = poisonDirectPenalty > 0 ? 1 : attacker.kind === 'commander' ? 3 : 2;
  return Math.max(minimumDamage, rawDamage - Math.ceil(target.defense / 3) - guardPenalty);
}

export function canRetaliateAfterAttack(state: BattleState, attacker: BattleUnit, defender: BattleUnit): boolean {
  return (
    attacker.currentHealth > 0 &&
    defender.currentHealth > 0 &&
    defender.retaliatedRound !== state.round &&
    defender.range <= 1 &&
    getDistance(defender, attacker) <= 1
  );
}

export function getRetaliationDamage(state: BattleState, attacker: BattleUnit, defender: BattleUnit): number {
  const multiplier = defender.templateId === 'mercenary' ? 0.85 : 0.45;
  const bonus = defender.templateId === 'mercenary' ? 3 : 0;
  return Math.max(1, Math.floor(getAttackDamage(defender, attacker, state) * multiplier) + bonus);
}

function normalizeStatusEffects(effects?: BattleUnitStatusEffects): BattleUnitStatusEffects | undefined {
  if (!effects) return undefined;

  const next: BattleUnitStatusEffects = {};
  if ((effects.bleedStacks ?? 0) > 0 && (effects.bleedTurns ?? 0) > 0) {
    next.bleedStacks = Math.max(1, Math.floor(effects.bleedStacks || 1));
    next.bleedTurns = Math.max(1, Math.floor(effects.bleedTurns || 1));
  }
  if ((effects.poisonTurns ?? 0) > 0 && (effects.poisonDamage ?? 0) > 0) {
    next.poisonTurns = Math.max(1, Math.floor(effects.poisonTurns || 1));
    next.poisonDamage = Math.max(1, Math.floor(effects.poisonDamage || POISON_BASE_DAMAGE));
  }

  return Object.keys(next).length > 0 ? next : undefined;
}

function hasCleansableStatusEffect(unit: BattleUnit): boolean {
  return Boolean(
    (unit.statusEffects?.bleedStacks || 0) > 0 ||
    (unit.statusEffects?.poisonTurns || 0) > 0
  );
}

function getBleedDamage(unit: BattleUnit): number {
  const stacks = Math.max(0, Math.floor(unit.statusEffects?.bleedStacks || 0));
  if (stacks <= 0) return 0;
  return stacks * BLEED_BASE_DAMAGE + Math.max(0, stacks - 1) * BLEED_STACK_EXTRA_DAMAGE;
}

function getPoisonAttackDamage(attacker: BattleUnit): number {
  return Math.max(POISON_BASE_DAMAGE, Math.floor(attacker.magic / 3) + 2);
}

function applyBleedToUnit(state: BattleState, targetId: string): BattleState {
  return {
    ...state,
    units: state.units.map(unit => {
      if (unit.id !== targetId || unit.currentHealth <= 0) return unit;
      const effects = unit.statusEffects || {};
      return {
        ...unit,
        statusEffects: normalizeStatusEffects({
          ...effects,
          bleedStacks: Math.max(0, effects.bleedStacks || 0) + 1,
          bleedTurns: BLEED_TURNS,
        }),
      };
    }),
  };
}

function applyPoisonToUnit(state: BattleState, targetId: string, damage: number): BattleState {
  return {
    ...state,
    units: state.units.map(unit => {
      if (unit.id !== targetId || unit.currentHealth <= 0) return unit;
      const effects = unit.statusEffects || {};
      return {
        ...unit,
        statusEffects: normalizeStatusEffects({
          ...effects,
          poisonTurns: POISON_TURNS,
          poisonDamage: Math.max(effects.poisonDamage || 0, damage),
        }),
      };
    }),
  };
}

function updateUnitStatusEffects(state: BattleState, unitId: string, update: (effects: BattleUnitStatusEffects) => BattleUnitStatusEffects | undefined): BattleState {
  return {
    ...state,
    units: state.units.map(unit => (
      unit.id === unitId
        ? { ...unit, statusEffects: normalizeStatusEffects(update(unit.statusEffects || {})) }
        : unit
    )),
  };
}

function applyStartOfTurnStatusEffects(state: BattleState, unitId: string): BattleState {
  let nextState = state;
  let unit = nextState.units.find(item => item.id === unitId && item.currentHealth > 0);
  if (!unit) return nextState;

  const bleedDamage = getBleedDamage(unit);
  if (bleedDamage > 0) {
    const { state: damagedState, lastStand } = applyDamageToUnit(nextState, unit.id, bleedDamage);
    nextState = updateUnitStatusEffects(damagedState, unit.id, effects => ({
      ...effects,
      bleedStacks: undefined,
      bleedTurns: Math.max(0, (effects.bleedTurns || 0) - 1),
    }));
    nextState = withBattleLog(
      nextState,
      `${unit.name} bleeds for ${bleedDamage}${lastStand ? ', but the boss endures' : ''}.`,
      { side: unit.side, actor: unit.name, actorId: unit.id, targetIds: [unit.id], action: 'spell', style: 'bleed', spellId: 'bleed' }
    );
  }

  nextState = updateBattleStatus(nextState);
  unit = nextState.units.find(item => item.id === unitId && item.currentHealth > 0);
  if (!unit || nextState.status !== 'active') return nextState;

  const poisonDamage = Math.max(0, Math.floor(unit.statusEffects?.poisonDamage || 0));
  if (poisonDamage > 0 && (unit.statusEffects?.poisonTurns || 0) > 0) {
    const { state: damagedState, lastStand } = applyDamageToUnit(nextState, unit.id, poisonDamage);
    nextState = updateUnitStatusEffects(damagedState, unit.id, effects => ({
      ...effects,
      poisonTurns: Math.max(0, (effects.poisonTurns || 0) - 1),
    }));
    nextState = withBattleLog(
      nextState,
      `${unit.name} suffers ${poisonDamage} poison${lastStand ? ', but the boss endures' : ''}.`,
      { side: unit.side, actor: unit.name, actorId: unit.id, targetIds: [unit.id], action: 'spell', style: 'poison', spellId: 'poison' }
    );
  }

  return updateBattleStatus(nextState);
}

export function getHealAmount(healer: BattleUnit, target: BattleUnit, state?: BattleState): number {
  const healerTerrain = state ? getTerrainAt(state, healer.x, healer.y) : 'ground';
  const targetTerrain = state ? getTerrainAt(state, target.x, target.y) : 'ground';
  const holyGroundBonus = (healerTerrain === 'holyGround' ? 3 : 0) + (targetTerrain === 'holyGround' ? 2 : 0);
  const template = healer.templateId ? getMinionTemplate(healer.templateId) : undefined;
  const earlyHealerScale = template?.tier === 'tier1'
    ? 0.68
    : template?.tier === 'tier2'
      ? 0.82
      : 1;
  const commanderHealScale = healer.kind === 'commander' ? 0.55 : 1;
  const chargedHealScale = healer.chargedHeal ? 1.55 : 1;
  const rawHealing = healer.healing + Math.floor(healer.magic / 2) + holyGroundBonus + 2;
  const healing = Math.max(1, Math.floor(rawHealing * earlyHealerScale * commanderHealScale * chargedHealScale));
  return Math.max(0, Math.min(target.maxHealth, target.currentHealth + healing) - target.currentHealth);
}

function updateBattleStatus(state: BattleState): BattleState {
  const playerCommanderAlive = state.units.some(unit => unit.side === 'player' && unit.kind === 'commander' && unit.currentHealth > 0);
  const enemyCommanderAlive = state.units.some(unit => unit.side === 'enemy' && unit.kind === 'commander' && unit.currentHealth > 0);
  const playerAlive = state.units.some(unit => unit.side === 'player' && unit.currentHealth > 0);
  const enemyAlive = state.units.some(unit => unit.side === 'enemy' && unit.currentHealth > 0);

  if (!playerCommanderAlive || !playerAlive) return { ...state, status: 'defeat' };
  if (!enemyCommanderAlive || !enemyAlive) return { ...state, status: 'victory' };
  return state;
}

function applyRoundMoraleEvents(state: BattleState): BattleState {
  return (['player', 'enemy'] as BattleSide[]).reduce((nextState, side) => {
    const commander = nextState.units.find(unit => unit.side === side && unit.kind === 'commander' && unit.currentHealth > 0);
    if (!commander) return nextState;

    const chance = clamp(0.04 + commander.speed * 0.006, 0.04, side === 'enemy' && nextState.enemy.personality === 'boss' ? 0.16 : 0.12);
    if (Math.random() > chance) return nextState;

    const inspiredState = mutateUnits(nextState, side, unit => ({
      ...unit,
      speed: unit.speed + 1,
    }));

    return withBattleLog(
      inspiredState,
      `${commander.name}'s aura lifts ${side === 'player' ? 'your' : 'enemy'} morale.`,
      { side, actor: commander.name, actorId: commander.id, targetIds: inspiredState.units.filter(unit => unit.side === side && unit.currentHealth > 0).map(unit => unit.id), action: 'morale', style: 'morale' }
    );
  }, state);
}

function activateNextBattleUnit(state: BattleState, unit: BattleUnit, turnQueue: string[]): BattleState {
  const activatedState = {
    ...state,
    activeUnitId: unit.id,
    turnQueue,
    turnStartedAt: Date.now(),
    bonusMoveUnitId: undefined,
    bonusMoveAwayFrom: undefined,
  };
  const auraExpiredState = clearSupportAura(activatedState, unit.id);
  const statusTickState = applyStartOfTurnStatusEffects(auraExpiredState, unit.id);
  const updatedState = updateBattleStatus(statusTickState);
  if (updatedState.status !== 'active') return updatedState;

  const activeUnit = updatedState.units.find(item => item.id === unit.id && item.currentHealth > 0);
  if (!activeUnit) return advanceBattleTurn(updatedState);
  return grantCommanderMana(updatedState, activeUnit);
}

export function advanceBattleTurn(state: BattleState): BattleState {
  const updatedState = updateBattleStatus(state);
  if (updatedState.status !== 'active') return updatedState;

  const finishingUnitId = updatedState.activeUnitId;
  const stateWithClearedSlow = finishingUnitId
    ? {
      ...updatedState,
      units: updatedState.units.map(unit => (
        unit.id === finishingUnitId ? clearSlowDebuff(unit) : unit
      )),
    }
    : updatedState;

  const queue = getSanitizedTurnQueue(stateWithClearedSlow);
  const queuedNextUnit = queue.length > 0
    ? stateWithClearedSlow.units.find(unit => unit.id === queue[0] && unit.currentHealth > 0)
    : undefined;

  if (queuedNextUnit) {
    return activateNextBattleUnit(stateWithClearedSlow, queuedNextUnit, queue.slice(1));
  }

  const nextRound = stateWithClearedSlow.round + 1;
  const roundState = applyRoundMoraleEvents({
    ...stateWithClearedSlow,
    round: nextRound,
    turnQueue: [],
    turnStartedAt: Date.now(),
  });
  const nextRoundOrder = getTurnOrder(roundState.units);
  const nextActiveUnit = nextRoundOrder[0];

  if (!nextActiveUnit) return updateBattleStatus(roundState);

  return activateNextBattleUnit(
    withBattleLog(roundState, `Round ${nextRound} begins.`, { action: 'round' }),
    nextActiveUnit,
    nextRoundOrder.slice(1).map(unit => unit.id)
  );
}

export function waitBattleUnit(state: BattleState, unitId: string, message?: string, action: BattleLogAction = 'wait'): BattleState {
  const unit = state.units.find(item => item.id === unitId);
  if (!unit) return state;

  const chargesPriestHeal = action === 'wait' && canChargePriestHeal(unit);
  const nextState = chargesPriestHeal
    ? {
      ...state,
      units: state.units.map(item => item.id === unit.id ? { ...item, chargedHeal: true } : item),
    }
    : state;
  const style: BattleLogStyle = action === 'mana' ? 'mana-focus' : chargesPriestHeal ? 'buff' : 'guard';
  const logMessage = chargesPriestHeal
    ? unit.chargedHeal
      ? `${unit.name} keeps a healing blessing ready.`
      : `${unit.name} chants a blessing. The next heal will be stronger.`
    : message || `${unit.name} waits.`;

  return advanceBattleTurn(withBattleLog(
    nextState,
    logMessage,
    { side: unit.side, actor: unit.name, actorId: unit.id, targetIds: [unit.id], action, style }
  ));
}

export function applyMinionSupportAbility(state: BattleState, unitId: string): BattleState {
  const unit = state.units.find(item => item.id === unitId && item.currentHealth > 0);
  const ability = getMinionSupportAbility(unit);
  if (!unit || !ability) return waitBattleUnit(state, unitId);

  const targetIds = state.units
    .filter(item => item.side === unit.side && item.currentHealth > 0)
    .map(item => item.id);

  const supportedState = {
    ...state,
    supportAuras: {
      ...(state.supportAuras || {}),
      [unit.id]: { abilityId: ability.id, targetIds },
    },
    units: state.units.map(item => {
      if (item.id === unit.id) {
        const nextUnit = { ...item, supportAbilityUsed: true };
        return applySupportAuraDelta(nextUnit, ability.id, 1);
      }

      if (item.side !== unit.side || item.currentHealth <= 0) return item;
      return applySupportAuraDelta(item, ability.id, 1);
    }),
  };

  const message = ability.id === 'bell-march'
    ? `${unit.name} tolls the march bell. Allied movement rises.`
    : `${unit.name} casts a void ward. Allied defense rises.`;

  return advanceBattleTurn(withBattleLog(
    supportedState,
    message,
    { side: unit.side, actor: unit.name, actorId: unit.id, targetIds, action: 'wait', style: 'buff' }
  ));
}

export function focusCommanderMana(state: BattleState, commanderId: string): BattleState {
  const commander = state.units.find(unit => unit.id === commanderId && unit.kind === 'commander' && unit.currentHealth > 0);
  if (!commander) return state;

  const focusedState = setSideMana(state, commander.side, getSideMana(state, commander.side) + 1);
  return waitBattleUnit(focusedState, commanderId, `${commander.name} gathers mana.`, 'mana');
}

export function moveBattleUnit(state: BattleState, unitId: string, x: number, y: number): BattleState {
  const unit = state.units.find(item => item.id === unitId);
  if (!unit || !canMoveTo(state, unit, x, y)) return state;

  const movedState = {
    ...state,
    units: state.units.map(item => item.id === unitId ? { ...item, x, y } : item),
  };

  return withBattleLog(movedState, `${unit.name} moves to ${x}:${y}.`, {
    side: unit.side,
    actor: unit.name,
    actorId: unit.id,
    targetIds: [unit.id],
    action: 'move',
    style: 'move',
    fromX: unit.x,
    fromY: unit.y,
    toX: x,
    toY: y,
  });
}

export function attackBattleUnit(state: BattleState, attackerId: string, targetId: string): BattleState {
  const attacker = state.units.find(unit => unit.id === attackerId && unit.currentHealth > 0);
  const target = state.units.find(unit => unit.id === targetId && unit.currentHealth > 0);

  if (!attacker || !target || !canAttack(attacker, target)) return state;

  const damage = getAttackDamage(attacker, target, state);
  const { state: attackedState, lastStand } = applyDamageToUnit(state, targetId, damage);
  const targetAfterHit = attackedState.units.find(unit => unit.id === targetId);
  const defeated = !lastStand && (!targetAfterHit || targetAfterHit.currentHealth <= 0);
  const guard = getGuardingAlly(state, target);
  const flanking = getFlankingBonus(state, attacker, target) > 0;
  const appliesBleed = isBleedStrikeUnit(attacker) && !defeated && !lastStand && Boolean(targetAfterHit && targetAfterHit.currentHealth > 0);
  const appliesPoison = isPoisonShotUnit(attacker) && !defeated && !lastStand && Boolean(targetAfterHit && targetAfterHit.currentHealth > 0);
  const skirmishRetreatAttack = isSkirmishStepUnit(attacker) && attacker.range <= 1 && getDistance(attacker, target) <= 1;
  const statusState = appliesPoison
    ? applyPoisonToUnit(attackedState, target.id, getPoisonAttackDamage(attacker))
    : appliesBleed
      ? applyBleedToUnit(attackedState, target.id)
      : attackedState;
  const statusText = appliesPoison
    ? ' and leaves poison in the wound'
    : appliesBleed
      ? ' and opens a bleeding wound'
      : '';

  let resolvedState = withBattleLog(
    statusState,
    `${attacker.name} hits ${target.name} for ${damage}${flanking ? ' with a flank' : ''}${guard ? ` through ${guard.name}'s guard` : ''}${statusText}${defeated ? ' and defeats it' : ''}${lastStand ? ', but the boss endures.' : ''}.`,
    { side: attacker.side, actor: attacker.name, actorId: attacker.id, targetIds: [target.id], action: 'attack', style: attacker.range > 1 ? 'ranged' : 'melee' }
  );

  const defenderAfterHit = resolvedState.units.find(unit => unit.id === targetId && unit.currentHealth > 0);
  const attackerAfterHit = resolvedState.units.find(unit => unit.id === attackerId && unit.currentHealth > 0);
  const canRetaliate = Boolean(
    !skirmishRetreatAttack &&
    defenderAfterHit &&
    attackerAfterHit &&
    canRetaliateAfterAttack(resolvedState, attackerAfterHit, defenderAfterHit)
  );

  if (canRetaliate && defenderAfterHit && attackerAfterHit) {
    const retaliationDamage = getRetaliationDamage(resolvedState, attackerAfterHit, defenderAfterHit);
    const { state: retaliatedState } = applyDamageToUnit(resolvedState, attackerAfterHit.id, retaliationDamage);
    const attackerAfterRetaliation = retaliatedState.units.find(unit => unit.id === attackerAfterHit.id);
    const retaliationDropped = !attackerAfterRetaliation || attackerAfterRetaliation.currentHealth <= 0;
    resolvedState = {
      ...retaliatedState,
      units: retaliatedState.units.map(unit => (
        unit.id === defenderAfterHit.id
          ? { ...unit, retaliatedRound: resolvedState.round }
          : unit
      )),
    };
    resolvedState = withBattleLog(
      resolvedState,
      `${defenderAfterHit.name} retaliates for ${retaliationDamage}${retaliationDropped ? ' and drops the attacker' : ''}.`,
      { side: defenderAfterHit.side, actor: defenderAfterHit.name, actorId: defenderAfterHit.id, targetIds: [attackerAfterHit.id], action: 'attack', style: defenderAfterHit.range > 1 ? 'ranged' : 'melee' }
    );
  }

  const updatedState = updateBattleStatus(resolvedState);
  const attackerAfterResolution = updatedState.units.find(unit => unit.id === attackerId && unit.currentHealth > 0);
  if (
    updatedState.status === 'active' &&
    isSkirmishStepUnit(attackerAfterResolution) &&
    attackerAfterResolution?.side === attacker.side
  ) {
    return {
      ...updatedState,
      activeUnitId: attackerAfterResolution.id,
      turnStartedAt: Date.now(),
      bonusMoveUnitId: attackerAfterResolution.id,
      bonusMoveAwayFrom: { x: target.x, y: target.y },
    };
  }

  return updatedState;
}

export function healBattleUnit(state: BattleState, healerId: string, targetId: string): BattleState {
  const healer = state.units.find(unit => unit.id === healerId && unit.currentHealth > 0);
  const target = state.units.find(unit => unit.id === targetId && unit.currentHealth > 0);

  if (!healer || !target || !canHeal(healer, target)) return state;

  const healing = getHealAmount(healer, target, state);
  const nextHealth = Math.min(target.maxHealth, target.currentHealth + healing);
  const cleansed = hasCleansableStatusEffect(target);
  const healedState = {
    ...state,
    units: state.units.map(unit => {
      let nextUnit = unit;
      if (unit.id === targetId) nextUnit = { ...nextUnit, currentHealth: nextHealth, statusEffects: undefined };
      if (unit.id === healerId) nextUnit = { ...nextUnit, chargedHeal: false };
      return nextUnit;
    }),
  };
  const chargedText = healer.chargedHeal ? ' with a stored blessing' : '';
  const cleanseText = cleansed ? ' and cleanses poison and bleeding' : '';

  return withBattleLog(
    healedState,
    `${healer.name} heals ${target.name}${chargedText} for ${nextHealth - target.currentHealth}${cleanseText}.`,
    { side: healer.side, actor: healer.name, actorId: healer.id, targetIds: [target.id], action: 'heal', style: 'heal' }
  );
}

function isBossCommanderLethalTrigger(unit: BattleUnit, state: BattleState): boolean {
  return (
    unit.kind === 'commander' &&
    unit.side === 'enemy' &&
    isBossBattleEnemy(state.enemy) &&
    state.bossPhase !== 2
  );
}

function upgradeMinionTemplateId(templateId: string): string {
  const template = getMinionTemplate(templateId);
  if (isStandaloneMinionTemplate(templateId)) return templateId;
  if (!template || template.tier === 'tier3') return templateId;

  const nextTier: MinionTier = template.tier === 'tier1' ? 'tier2' : 'tier3';
  return MINION_TEMPLATES.find(item => item.class === template.class && item.tier === nextTier)?.templateId || templateId;
}

function isVacantBattleCell(state: BattleState, x: number, y: number): boolean {
  if (!isInsideBoard(state, x, y) || isObstacle(state, x, y)) return false;
  return !state.units.some(unit => unit.currentHealth > 0 && unit.x === x && unit.y === y);
}

function getEnemyHalfStart(state: BattleState): number {
  return Math.max(0, Math.floor(state.boardWidth / 2) - 1);
}

function getEnemyResurrectionCells(state: BattleState, commander: BattleUnit): BoardCell[] {
  const enemyHalfStart = getEnemyHalfStart(state);
  const candidates: BoardCell[] = [];

  for (let y = 0; y < state.boardHeight; y += 1) {
    for (let x = enemyHalfStart; x < state.boardWidth; x += 1) {
      if (isVacantBattleCell(state, x, y)) candidates.push({ x, y });
    }
  }

  return candidates.sort((a, b) => getDistance(commander, a) - getDistance(commander, b));
}

function findResurrectionCell(
  state: BattleState,
  dead: BattleUnit,
  commander: BattleUnit,
  usedCells: Set<string>,
): BoardCell | undefined {
  const enemyHalfStart = getEnemyHalfStart(state);
  const deadKey = getCellKey(dead);

  if (
    isVacantBattleCell(state, dead.x, dead.y) &&
    !usedCells.has(deadKey) &&
    dead.x >= enemyHalfStart
  ) {
    return { x: dead.x, y: dead.y };
  }

  return getEnemyResurrectionCells(state, commander).find(cell => !usedCells.has(getCellKey(cell)));
}

function resurrectBossMinions(
  state: BattleState,
  commander: BattleUnit,
  count = 2,
): { state: BattleState; resurrectedIds: string[] } {
  const deadMinions = state.units.filter(
    unit => unit.side === 'enemy' && unit.kind === 'minion' && unit.currentHealth <= 0,
  );
  if (deadMinions.length === 0) return { state, resurrectedIds: [] };

  const picks = [...deadMinions].sort(() => Math.random() - 0.5).slice(0, count);
  const modifiers = getBattleModifiers(makeEnemyCommanderStats(state.enemy.level, state.enemy));
  const liveEnemyMinions = state.units.filter(unit => unit.side === 'enemy' && unit.kind === 'minion' && unit.currentHealth > 0).length;
  const summonLimit = ENEMY_FIELD_MINIONS + 2;

  let nextState = state;
  const resurrectedIds: string[] = [];
  const usedCells = new Set<string>();

  for (const dead of picks) {
    if (liveEnemyMinions + resurrectedIds.length >= summonLimit) break;

    const cell = findResurrectionCell(nextState, dead, commander, usedCells);
    if (!cell) continue;
    usedCells.add(getCellKey(cell));

    const upgradedTemplateId = upgradeMinionTemplateId(dead.templateId || getBossSummonTemplateId(state, 'knight-squire'));
    const stack = makeMinionStack(upgradedTemplateId, `boss-risen-${state.id}-${resurrectedIds.length}`);
    const risen = makeMinionUnit(stack, 'enemy', cell.x, cell.y, modifiers);
    if (!risen) continue;

    nextState = {
      ...nextState,
      units: nextState.units.map(unit => (
        unit.id === dead.id
          ? { ...risen, id: dead.id, x: cell.x, y: cell.y, currentHealth: risen.maxHealth }
          : unit
      )),
    };
    resurrectedIds.push(dead.id);
  }

  return { state: nextState, resurrectedIds };
}

function applyBossLastStand(state: BattleState, commander: BattleUnit): BattleState {
  const phase2Health = Math.max(1, Math.floor(commander.maxHealth * 0.5));
  const bossDefenseBonus = 6;
  const isFinalBoss = state.enemy.personality === 'boss';
  const resurrectCount = isFinalBoss ? 4 : 2;
  const { state: risenState, resurrectedIds } = resurrectBossMinions(state, commander, resurrectCount);
  const resetPhaseTwoSpecials = isSingleplayerRandomRunEnemy(state.enemy);
  const nextBossSpecialUses = resetPhaseTwoSpecials
    ? { ...(state.bossSpecialUses || {}), [commander.id]: 0 }
    : state.bossSpecialUses;
  const nextBossSpecialRounds = resetPhaseTwoSpecials
    ? Object.fromEntries(Object.entries(state.bossSpecialRounds || {}).filter(([unitId]) => unitId !== commander.id))
    : state.bossSpecialRounds;
  const targetIds = [
    commander.id,
    ...resurrectedIds,
    ...risenState.units.filter(unit => unit.side === 'enemy' && unit.currentHealth > 0).map(unit => unit.id),
  ];

  const nextState = setSideMana({
    ...risenState,
    bossPhase: 2,
    bossSpecialUses: nextBossSpecialUses,
    bossSpecialRounds: nextBossSpecialRounds,
    units: risenState.units.map(unit => {
      if (unit.id === commander.id) {
        return {
          ...unit,
          currentHealth: phase2Health,
          defense: unit.defense + bossDefenseBonus,
          attack: unit.attack + 2,
          magic: unit.magic + 2,
        };
      }
      if (unit.side === 'enemy' && unit.currentHealth > 0 && unit.kind === 'minion') {
        return { ...unit, defense: unit.defense + 2 };
      }
      return unit;
    }),
  }, 'enemy', getSideMana(risenState, 'enemy') + 2);

  const risenText = resurrectedIds.length > 0
    ? ` ${resurrectedIds.length} fallen servant${resurrectedIds.length === 1 ? '' : 's'} rise one tier stronger.`
    : '';

  return withBattleLog(
    nextState,
    `${commander.name} refuses death. A second oath ignites—healed to half strength, armored for the final stand.${risenText}`,
    {
      side: 'enemy',
      actor: commander.name,
      actorId: commander.id,
      targetIds,
      resurrectedUnitIds: resurrectedIds,
      action: 'spell',
      style: 'boss-phase',
      spellId: 'saint-king-aegis',
    },
  );
}

function applyDamageToUnit(state: BattleState, targetId: string, damage: number): { state: BattleState; lastStand: boolean } {
  const target = state.units.find(unit => unit.id === targetId && unit.currentHealth > 0);
  if (!target) return { state, lastStand: false };

  const effectiveDamage = Math.max(1, damage);
  const nextHealth = target.currentHealth - effectiveDamage;

  if (nextHealth <= 0 && isBossCommanderLethalTrigger(target, state)) {
    return { state: applyBossLastStand(state, target), lastStand: true };
  }

  const damagedState = {
    ...state,
    units: state.units.map(unit => {
      if (unit.id !== targetId) return unit;
      const currentHealth = Math.max(0, nextHealth);
      return {
        ...unit,
        currentHealth,
        statusEffects: currentHealth > 0 ? unit.statusEffects : undefined,
      };
    }),
  };

  return {
    state: nextHealth <= 0 ? clearSupportAura(damagedState, targetId) : damagedState,
    lastStand: false,
  };
}

function damageUnit(state: BattleState, targetId: string, damage: number): BattleState {
  return applyDamageToUnit(state, targetId, damage).state;
}

function healUnit(state: BattleState, targetId: string, amount: number): BattleState {
  return {
    ...state,
    units: state.units.map(unit => {
      if (unit.id !== targetId || unit.currentHealth <= 0) return unit;
      return {
        ...unit,
        currentHealth: Math.min(unit.maxHealth, unit.currentHealth + Math.max(1, amount)),
        statusEffects: undefined,
      };
    }),
  };
}

function mutateUnits(state: BattleState, side: BattleSide, update: (unit: BattleUnit) => BattleUnit): BattleState {
  return {
    ...state,
    units: state.units.map(unit => unit.side === side && unit.currentHealth > 0 ? update(unit) : unit),
  };
}

export function getBattleSpellLogStyle(spellId: string): BattleLogStyle {
  if (['sanctified-mend', 'rallying-hymn', 'soul-tether', 'saint-king-aegis'].includes(spellId)) {
    return 'spell-support';
  }

  if (['thorn-ward', 'warding-prayer', 'ashen-step', 'royal-command', 'moonlit-veil', 'iron-benediction'].includes(spellId)) {
    return 'buff';
  }

  if (['withering-curse', 'gravity-snare', 'frost-lance', 'time-crown-edict'].includes(spellId)) {
    return 'spell-control';
  }

  if (spellId === 'blood-star') return 'spell-drain';

  return 'spell-damage';
}

export const BATTLE_SPELL_PRESENTATION_MS = 2300;
export const BATTLE_ENEMY_SPELL_PRESENTATION_MS = 1500;
export const BATTLE_ENEMY_PRESENTATION_MS = 1050;
export const BATTLE_DEFAULT_PRESENTATION_MS = 1500;
/** Brief hit reaction on the victim sprite before the ash dissolve. */
export const BATTLE_DEATH_HIT_MS = 480;
/** Grayscale slump and dissolve into ash after the hit reaction. */
export const BATTLE_DEATH_DISSOLVE_MS = 1600;
/** Full-screen boss last-stand presentation over the combat grid. */
export const BOSS_LAST_STAND_PRESENTATION_MS = 5400;
/** Delay before resurrected minions pulse in on the battlefield. */
export const BOSS_LAST_STAND_RESPAWN_REVEAL_MS = 2400;
/** Boss raid ability cinematic before Phase II. */
export const BOSS_SPECIAL_PRESENTATION_MS = 4000;
/** Delay before boss-summoned minions pulse in on the battlefield. */
export const BOSS_SPECIAL_SUMMON_REVEAL_MS = 1800;
/** Maximum boss raid abilities per fight before Phase II. */
export const BOSS_SPECIAL_MAX_USES_BEFORE_PHASE_2 = 2;

export function getBattleDeathPresentationMs(): number {
  return BATTLE_DEATH_HIT_MS + BATTLE_DEATH_DISSOLVE_MS;
}

export function hasDefeatedLogTarget(battle: BattleState, entry: BattleLogEntry): boolean {
  return Boolean(entry.targetIds?.some(targetId => {
    const unit = battle.units.find(candidate => candidate.id === targetId);
    return unit && unit.currentHealth <= 0;
  }));
}

export function isPresentationBattleLogAction(action: BattleLogAction): boolean {
  return action !== 'round' && action !== 'system';
}

export function isStatusEffectTickLogEntry(entry: Pick<BattleLogEntry, 'action' | 'style' | 'spellId'>): boolean {
  return (
    entry.action === 'spell' &&
    (entry.style === 'bleed' || entry.style === 'poison') &&
    (entry.spellId === 'bleed' || entry.spellId === 'poison')
  );
}

export function getBattleLogPresentationMs(entry: BattleLogEntry, battle?: BattleState): number {
  if (entry.style === 'boss-phase') return BOSS_LAST_STAND_PRESENTATION_MS;
  if (entry.style === 'boss-special') return BOSS_SPECIAL_PRESENTATION_MS;

  let base: number;
  if (entry.action === 'spell') {
    base = entry.side === 'enemy' ? BATTLE_ENEMY_SPELL_PRESENTATION_MS : BATTLE_SPELL_PRESENTATION_MS;
  }
  else if (entry.side === 'enemy') base = BATTLE_ENEMY_PRESENTATION_MS;
  else base = BATTLE_DEFAULT_PRESENTATION_MS;

  if (
    battle
    && (entry.action === 'attack' || entry.action === 'spell')
    && hasDefeatedLogTarget(battle, entry)
  ) {
    base = Math.max(base, getBattleDeathPresentationMs() + 120);
  }

  return base;
}

export function getRecentPresentationLogEntry(battle: BattleState, now = Date.now()): BattleLogEntry | undefined {
  const candidates = battle.log.filter(entry => (
    isPresentationBattleLogAction(entry.action)
    && !isStatusEffectTickLogEntry(entry)
    && now - entry.createdAt < getBattleLogPresentationMs(entry, battle)
  ));

  const recentMove = candidates.find(entry => entry.action === 'move');
  if (recentMove) return recentMove;
  const recentSpell = candidates.find(entry => entry.action === 'spell');
  if (recentSpell) return recentSpell;
  return candidates[0];
}

export function pickFreshPresentationLogEntry(entries: BattleLogEntry[]): BattleLogEntry | undefined {
  const presentationEntries = entries.filter(entry => !isStatusEffectTickLogEntry(entry));
  if (presentationEntries.length === 0) return undefined;
  return presentationEntries.find(entry => entry.style === 'boss-phase')
    ?? presentationEntries.find(entry => entry.style === 'boss-special')
    ?? presentationEntries.find(entry => entry.action === 'spell')
    ?? presentationEntries.find(entry => isPresentationBattleLogAction(entry.action));
}

export function castBattleSpell(state: BattleState, spellId: string, targetId?: string): BattleState {
  const spell = BATTLE_SPELLS.find(item => item.id === spellId);
  const caster = getActiveUnit(state);

  if (!spell || !caster || caster.kind !== 'commander' || state.status !== 'active') return state;
  if (getSideMana(state, caster.side) < spell.cost) return state;

  const target = targetId ? state.units.find(unit => unit.id === targetId && unit.currentHealth > 0) : undefined;
  if (spell.target === 'enemy' && (!target || target.side === caster.side)) return state;
  if (spell.target === 'ally' && (!target || target.side !== caster.side)) return state;

  const enemySide: BattleSide = caster.side === 'player' ? 'enemy' : 'player';
  const spellPower = caster.magic;
  let nextState = setSideMana(state, caster.side, getSideMana(state, caster.side) - spell.cost);
  let logMessage = `${caster.name} casts ${spell.name}.`;
  let spellTargetIds = target ? [target.id] : [];
  const damageDone = (unit: BattleUnit, amount: number) => Math.min(unit.currentHealth, Math.max(1, amount));
  const healingDone = (unit: BattleUnit, amount: number) => Math.max(0, Math.min(unit.maxHealth, unit.currentHealth + Math.max(1, amount)) - unit.currentHealth);

  switch (spell.id) {
    case 'ember-dart':
      if (target) {
        const damage = 7 + spellPower * 2;
        nextState = damageUnit(nextState, target.id, damage);
        logMessage = `${caster.name} casts ${spell.name} on ${target.name} for ${damageDone(target, damage)}.`;
      }
      break;
    case 'arcane-bolt':
      if (target) {
        const damage = 12 + spellPower * 2;
        nextState = damageUnit(nextState, target.id, damage);
        logMessage = `${caster.name} casts ${spell.name} on ${target.name} for ${damageDone(target, damage)}.`;
      }
      break;
    case 'sanctified-mend':
      if (target) {
        const healing = 18 + spellPower * 2;
        nextState = healUnit(nextState, target.id, healing);
        logMessage = `${caster.name} casts ${spell.name} on ${target.name}, restoring ${healingDone(target, healing)}.`;
      }
      break;
    case 'thorn-ward':
      if (target) {
        const healing = 8 + spellPower;
        nextState = healUnit(nextState, target.id, healing);
        nextState = {
          ...nextState,
          units: nextState.units.map(unit => unit.id === target.id ? { ...unit, defense: unit.defense + 4 } : unit),
        };
        logMessage = `${caster.name} casts ${spell.name} on ${target.name}, restoring ${healingDone(target, healing)} and raising ward.`;
      }
      break;
    case 'warding-prayer':
      if (target) {
        const healing = 7 + spellPower;
        nextState = healUnit(nextState, target.id, healing);
        nextState = {
          ...nextState,
          units: nextState.units.map(unit => unit.id === target.id ? { ...unit, defense: unit.defense + 2 } : unit),
        };
        logMessage = `${caster.name} casts ${spell.name} on ${target.name}, restoring ${healingDone(target, healing)} and bracing defense.`;
      }
      break;
    case 'ashen-step':
      if (target) {
        nextState = {
          ...nextState,
          units: nextState.units.map(unit => unit.id === target.id ? {
            ...unit,
            movement: unit.movement + 1,
            speed: unit.speed + 2,
          } : unit),
        };
        logMessage = `${caster.name} casts ${spell.name} on ${target.name}, quickening movement.`;
      }
      break;
    case 'withering-curse':
      if (target) {
        const damage = 8 + spellPower;
        nextState = damageUnit(nextState, target.id, damage);
        nextState = {
          ...nextState,
          units: nextState.units.map(unit => unit.id === target.id ? { ...unit, attack: Math.max(1, unit.attack - 2) } : unit),
        };
        logMessage = `${caster.name} casts ${spell.name} on ${target.name} for ${damageDone(target, damage)} and weakens its attack.`;
      }
      break;
    case 'rallying-hymn':
      {
        const healing = 6 + spellPower;
        spellTargetIds = nextState.units.filter(unit => unit.side === caster.side && unit.currentHealth > 0).map(unit => unit.id);
        nextState = mutateUnits(nextState, caster.side, unit => ({
          ...unit,
          currentHealth: Math.min(unit.maxHealth, unit.currentHealth + healing),
          statusEffects: undefined,
          speed: unit.speed + 1,
        }));
        logMessage = `${caster.name} sings ${spell.name}, restoring up to ${healing} to all allies.`;
      }
      break;
    case 'chain-spark':
      {
        const damage = 6 + spellPower;
        const enemyTargets = nextState.units.filter(unit => unit.side === enemySide && unit.currentHealth > 0);
        spellTargetIds = enemyTargets.map(unit => unit.id);
        nextState = enemyTargets.reduce(
          (incoming, unit) => damageUnit(incoming, unit.id, damage),
          nextState,
        );
        logMessage = `${caster.name} casts ${spell.name}, striking every enemy for up to ${damage}.`;
      }
      break;
    case 'gravity-snare':
      if (target) {
        const damage = 7 + spellPower;
        nextState = damageUnit(nextState, target.id, damage);
        nextState = {
          ...nextState,
          units: nextState.units.map(unit => unit.id === target.id
            ? applySlowDebuff(unit, 1, 3)
            : unit),
        };
        logMessage = `${caster.name} casts ${spell.name} on ${target.name} for ${damageDone(target, damage)} and slows it.`;
      }
      break;
    case 'judgement':
      if (target) {
        const damage = 18 + spellPower * 2;
        nextState = damageUnit(nextState, target.id, damage);
        logMessage = `${caster.name} casts ${spell.name} on ${target.name} for ${damageDone(target, damage)}.`;
      }
      break;
    case 'blood-star':
      if (target) {
        const damage = 10 + Math.floor(spellPower * 1.35);
        const healing = 7 + Math.floor(spellPower * 0.65);
        nextState = damageUnit(nextState, target.id, damage);
        nextState = healUnit(nextState, caster.id, healing);
        spellTargetIds = [target.id, caster.id];
        logMessage = `${caster.name} casts ${spell.name} on ${target.name}, draining ${damageDone(target, damage)} and restoring ${healingDone(caster, healing)}.`;
      }
      break;
    case 'soul-tether':
      if (target) {
        const healing = 20 + spellPower * 2;
        nextState = healUnit(nextState, target.id, healing);
        nextState = {
          ...nextState,
          units: nextState.units.map(unit => unit.id === target.id ? { ...unit, speed: unit.speed + 2 } : unit),
        };
        logMessage = `${caster.name} casts ${spell.name} on ${target.name}, restoring ${healingDone(target, healing)} and lifting morale.`;
      }
      break;
    case 'frost-lance':
      if (target) {
        const damage = 10 + spellPower * 2;
        nextState = damageUnit(nextState, target.id, damage);
        nextState = {
          ...nextState,
          units: nextState.units.map(unit => unit.id === target.id
            ? applySlowDebuff(unit, 2, 4)
            : unit),
        };
        logMessage = `${caster.name} casts ${spell.name} on ${target.name} for ${damageDone(target, damage)} and freezes its advance.`;
      }
      break;
    case 'royal-command':
      spellTargetIds = nextState.units.filter(unit => unit.side === caster.side && unit.currentHealth > 0).map(unit => unit.id);
      nextState = mutateUnits(nextState, caster.side, unit => ({ ...unit, attack: unit.attack + 2 }));
      logMessage = `${caster.name} casts ${spell.name}, raising allied attack.`;
      break;
    case 'moonlit-veil':
      spellTargetIds = nextState.units.filter(unit => unit.side === caster.side && unit.currentHealth > 0).map(unit => unit.id);
      nextState = mutateUnits(nextState, caster.side, unit => ({ ...unit, defense: unit.defense + 3 }));
      logMessage = `${caster.name} casts ${spell.name}, raising allied defense.`;
      break;
    case 'iron-benediction':
      spellTargetIds = nextState.units.filter(unit => unit.side === caster.side && unit.currentHealth > 0).map(unit => unit.id);
      nextState = mutateUnits(nextState, caster.side, unit => ({ ...unit, attack: unit.attack + 1, defense: unit.defense + 2 }));
      logMessage = `${caster.name} casts ${spell.name}, strengthening allied attack and defense.`;
      break;
    case 'eclipse-nova':
      {
        const damage = 14 + spellPower * 2;
        const enemyTargets = nextState.units.filter(unit => unit.side === enemySide && unit.currentHealth > 0);
        spellTargetIds = enemyTargets.map(unit => unit.id);
        nextState = enemyTargets.reduce(
          (incoming, unit) => damageUnit(incoming, unit.id, damage),
          nextState,
        );
        logMessage = `${caster.name} casts ${spell.name}, bursting across every enemy for up to ${damage}.`;
      }
      break;
    case 'saint-king-aegis':
      {
        const healing = 16 + spellPower * 2;
        spellTargetIds = nextState.units.filter(unit => unit.side === caster.side && unit.currentHealth > 0).map(unit => unit.id);
        nextState = mutateUnits(nextState, caster.side, unit => ({
          ...unit,
          currentHealth: Math.min(unit.maxHealth, unit.currentHealth + healing),
          statusEffects: undefined,
          defense: unit.defense + 4,
        }));
        logMessage = `${caster.name} casts ${spell.name}, restoring up to ${healing} and shielding all allies.`;
      }
      break;
    case 'time-crown-edict':
      spellTargetIds = nextState.units.filter(unit => unit.currentHealth > 0).map(unit => unit.id);
      nextState = {
        ...nextState,
        units: nextState.units.map(unit => {
          if (unit.currentHealth <= 0) return unit;
          if (unit.side === caster.side) return { ...unit, speed: unit.speed + 3 };
          return applySlowDebuff(unit, 1, 3);
        }),
      };
      logMessage = `${caster.name} casts ${spell.name}, hastening allies and slowing enemies.`;
      break;
  }

  if (target && spell.target !== 'none' && logMessage === `${caster.name} casts ${spell.name}.`) {
    logMessage = `${caster.name} casts ${spell.name} on ${target.name}.`;
  }

  return advanceBattleTurn(updateBattleStatus(withBattleLog(
    nextState,
    logMessage,
    { side: caster.side, actor: caster.name, actorId: caster.id, targetIds: spellTargetIds, action: 'spell', style: getBattleSpellLogStyle(spell.id), spellId: spell.id }
  )));
}

function getRandomItem<T>(items: T[]): T | undefined {
  if (items.length === 0) return undefined;
  return items[Math.floor(Math.random() * items.length)];
}

function getAttackTargets(state: BattleState, attacker: BattleUnit): BattleUnit[] {
  return state.units.filter(unit => unit.side !== attacker.side && unit.currentHealth > 0 && canAttack(attacker, unit));
}

function getHealTargets(state: BattleState, healer: BattleUnit): BattleUnit[] {
  return state.units.filter(unit => unit.side === healer.side && unit.currentHealth > 0 && canHeal(healer, unit));
}

function getMoveCells(state: BattleState, unit: BattleUnit): BoardCell[] {
  return getReachableMoveCells(state, unit);
}

function getBossSpecialUses(state: BattleState, commanderId: string): number {
  return state.bossSpecialUses?.[commanderId] ?? 0;
}

function markBossSpecialUsed(state: BattleState, commander: BattleUnit): BattleState {
  return {
    ...state,
    bossSpecialUses: {
      ...(state.bossSpecialUses || {}),
      [commander.id]: getBossSpecialUses(state, commander.id) + 1,
    },
    bossSpecialRounds: {
      ...(state.bossSpecialRounds || {}),
      [commander.id]: state.round,
    },
  };
}

function findBossSummonCell(state: BattleState, commander: BattleUnit): BoardCell | undefined {
  const preferredHalf = Math.floor(state.boardWidth / 2);
  const candidates: BoardCell[] = [];

  for (let radius = 1; radius <= 4; radius += 1) {
    for (let y = commander.y - radius; y <= commander.y + radius; y += 1) {
      for (let x = commander.x - radius; x <= commander.x + radius; x += 1) {
        if (getDistance(commander, { x, y }) !== radius) continue;
        if (!isInsideBoard(state, x, y) || isObstacle(state, x, y) || getUnitAt(state, x, y)) continue;
        candidates.push({ x, y });
      }
    }

    const preferred = candidates.find(cell => cell.x >= preferredHalf);
    if (preferred) return preferred;
    if (candidates.length > 0) return candidates[0];
  }

  return undefined;
}

function getBossSummonTemplateId(state: BattleState, fallback: string, offset = 0): string {
  const templates = state.enemy.minions.map(minion => minion.templateId).filter(Boolean);
  if (templates.length === 0) return fallback;
  return templates[(state.round + offset) % templates.length] || fallback;
}

function summonBossMinions(state: BattleState, commander: BattleUnit, templateIds: string[]): { state: BattleState; summonedIds: string[] } {
  const liveEnemyMinions = state.units.filter(unit => unit.side === 'enemy' && unit.kind === 'minion' && unit.currentHealth > 0).length;
  const summonLimit = ENEMY_FIELD_MINIONS + (state.bossPhase === 2 ? 2 : 0);
  let nextState = state;
  const summonedIds: string[] = [];

  for (let index = 0; index < templateIds.length && liveEnemyMinions + summonedIds.length < summonLimit; index += 1) {
    const cell = findBossSummonCell(nextState, commander);
    if (!cell) break;

    const stack = makeMinionStack(
      templateIds[index],
      `boss-summon-${state.id}-${state.round}-${index}`,
    );
    const summoned = makeMinionUnit(
      stack,
      'enemy',
      cell.x,
      cell.y,
      getBattleModifiers(makeEnemyCommanderStats(Math.max(1, state.enemy.level - 1), state.enemy)),
    );

    if (!summoned) continue;
    summonedIds.push(summoned.id);
    nextState = {
      ...nextState,
      units: [...nextState.units, summoned],
    };
  }

  return { state: nextState, summonedIds };
}

function finishBossSpecial(
  state: BattleState,
  commander: BattleUnit,
  message: string,
  targetIds: string[],
  spellId: string,
  summonedUnitIds: string[] = [],
): BattleState {
  return advanceBattleTurn(updateBattleStatus(withBattleLog(
    markBossSpecialUsed(state, commander),
    message,
    {
      side: 'enemy',
      actor: commander.name,
      actorId: commander.id,
      targetIds,
      summonedUnitIds: summonedUnitIds.length > 0 ? summonedUnitIds : undefined,
      action: 'spell',
      style: 'boss-special',
      spellId,
    }
  )));
}

function runBossSpecialAbility(state: BattleState, commander: BattleUnit): BattleState | null {
  if (!isBossBattleEnemy(state.enemy)) return null;
  const phaseTwoSingleplayerReset = state.bossPhase === 2 && isSingleplayerRandomRunEnemy(state.enemy);
  if (state.bossPhase === 2 && !phaseTwoSingleplayerReset) return null;
  if (getBossSpecialUses(state, commander.id) >= BOSS_SPECIAL_MAX_USES_BEFORE_PHASE_2) return null;
  if (state.bossSpecialRounds?.[commander.id] === state.round) return null;
  if (Math.random() > (phaseTwoSingleplayerReset ? 0.78 : 0.58)) return null;

  const players = state.units.filter(unit => unit.side === 'player' && unit.currentHealth > 0);
  const enemies = state.units.filter(unit => unit.side === 'enemy' && unit.currentHealth > 0);
  if (players.length === 0 || enemies.length === 0) return null;

  const playerCommander = players.find(unit => unit.kind === 'commander');
  const spellPower = Math.max(2, commander.magic);
  const damageAllPlayers = (incoming: BattleState, amount: number): BattleState => ({
    ...incoming,
    units: incoming.units.map(unit => (
      unit.side === 'player' && unit.currentHealth > 0
        ? { ...unit, currentHealth: Math.max(0, unit.currentHealth - amount) }
        : unit
    )),
  });
  const healEnemySide = (incoming: BattleState, amount: number): BattleState => ({
    ...incoming,
    units: incoming.units.map(unit => (
      unit.side === 'enemy' && unit.currentHealth > 0
        ? { ...unit, currentHealth: Math.min(unit.maxHealth, unit.currentHealth + amount), statusEffects: undefined }
        : unit
    )),
  });
  const bossId = state.enemy.bossId || state.enemy.id;

  switch (bossId) {
    case 'mother-cindervein': {
      const damage = 4 + Math.floor(spellPower * 0.42) + Math.max(0, (state.bossPhase || 1) - 1);
      const healing = 6 + Math.floor(spellPower * 0.35);
      const nextState = healEnemySide(damageAllPlayers(state, damage), healing);
      return finishBossSpecial(
        nextState,
        commander,
        `${commander.name} lights the black candles, burning your army and mending her faithful.`,
        [...players.map(unit => unit.id), ...enemies.map(unit => unit.id)],
        'blood-star',
      );
    }
    case 'ser-kael-duskplate': {
      const { state: summonedState, summonedIds } = summonBossMinions(state, commander, [
        getBossSummonTemplateId(state, 'templar-crusader'),
      ]);
      const nextState = mutateUnits(summonedState, 'enemy', unit => ({ ...unit, defense: unit.defense + 3 }));
      return finishBossSpecial(
        nextState,
        commander,
        `${commander.name} raises the blue oath. His line hardens and another templar answers.`,
        [...enemies.map(unit => unit.id), ...summonedIds],
        'iron-benediction',
        summonedIds,
      );
    }
    case 'prior-moon-voss': {
      const damage = 6 + Math.floor(spellPower * 0.55);
      const damagedState = damageAllPlayers(state, damage);
      const nextState = {
        ...damagedState,
        units: damagedState.units.map(unit => (
          unit.side === 'player' && unit.currentHealth > 0
            ? applySlowDebuff(unit, 1, 2)
            : unit
        )),
      };
      return finishBossSpecial(
        nextState,
        commander,
        `${commander.name} reads the moonwell. Frost slows every living reflection.`,
        players.map(unit => unit.id),
        'frost-lance',
      );
    }
    case 'key-saint-ardan': {
      const target = playerCommander || players.sort((a, b) => b.attack - a.attack)[0];
      let nextState = target ? damageUnit(state, target.id, 12 + spellPower) : state;
      nextState = mutateUnits(nextState, 'enemy', unit => ({ ...unit, defense: unit.defense + 2, attack: unit.attack + 1 }));
      return finishBossSpecial(
        nextState,
        commander,
        `${commander.name} turns the last key, striking your command and sealing his own line.`,
        target ? [target.id, ...enemies.map(unit => unit.id)] : enemies.map(unit => unit.id),
        'judgement',
      );
    }
    case 'blackroot-vessel': {
      const { state: summonedState, summonedIds } = summonBossMinions(state, commander, [
        getBossSummonTemplateId(state, 'templar-crusader'),
        getBossSummonTemplateId(state, 'priest-cleric', 1),
      ]);
      const nextState = {
        ...summonedState,
        units: summonedState.units.map(unit => (
          unit.side === 'player' && unit.currentHealth > 0
            ? applySlowDebuff(unit, 1, 2)
            : unit
        )),
      };
      return finishBossSpecial(
        nextState,
        commander,
        `${commander.name} splits the road with black roots. New servants climb from the ground.`,
        [...players.map(unit => unit.id), ...summonedIds],
        'gravity-snare',
        summonedIds,
      );
    }
    case 'lady-mirror-veyra': {
      const { state: summonedState, summonedIds } = summonBossMinions(state, commander, [
        getBossSummonTemplateId(state, 'wizard-magus'),
        getBossSummonTemplateId(state, 'wizard-apprentice', 1),
      ]);
      const nextState = mutateUnits(summonedState, 'enemy', unit => ({ ...unit, magic: unit.magic + 2, speed: unit.speed + 1 }));
      return finishBossSpecial(
        nextState,
        commander,
        `${commander.name} breaks the mirror line. Illusions step into the fight.`,
        [...enemies.map(unit => unit.id), ...summonedIds],
        'time-crown-edict',
        summonedIds,
      );
    }
    case 'scarlet-matron-yvane': {
      const damage = 5 + Math.floor(spellPower * 0.48);
      const drainedState = damageAllPlayers(state, damage);
      const nextState = healUnit(drainedState, commander.id, Math.floor(damage * 0.55) + 5);
      return finishBossSpecial(
        nextState,
        commander,
        `${commander.name} knots a blood-star curse, wounding every enemy and drinking the echo.`,
        [...players.map(unit => unit.id), commander.id],
        'blood-star',
      );
    }
    case 'emperor-grave-aurel': {
      const damage = 7 + Math.floor(spellPower * 0.52) + Math.max(0, (state.bossPhase || 1) - 1);
      const { state: summonedState, summonedIds } = summonBossMinions(damageAllPlayers(state, damage), commander, [
        getBossSummonTemplateId(state, 'templar-paragon'),
      ]);
      return finishBossSpecial(
        summonedState,
        commander,
        `${commander.name} issues a dead emperor's command. The field buckles and another oath rises.`,
        [...players.map(unit => unit.id), ...summonedIds],
        'eclipse-nova',
        summonedIds,
      );
    }
    default: {
      const damage = 5 + Math.floor(spellPower * 0.42);
      const nextState = mutateUnits(damageAllPlayers(state, damage), 'enemy', unit => ({ ...unit, attack: unit.attack + 1 }));
      return finishBossSpecial(
        nextState,
        commander,
        `${commander.name} unleashes a boss rite, shocking your army and rallying the enemy line.`,
        [...players.map(unit => unit.id), ...enemies.map(unit => unit.id)],
        'chain-spark',
      );
    }
  }
}

function runEnemyCommanderSpell(state: BattleState, commander: BattleUnit, personality: EnemyAiPersonality): BattleState | null {
  const mana = getSideMana(state, commander.side);
  const playerTargets = state.units.filter(unit => unit.side === 'player' && unit.currentHealth > 0);
  const woundedAllies = state.units.filter(unit => unit.side === 'enemy' && unit.currentHealth > 0 && unit.currentHealth < unit.maxHealth);
  const mostWoundedAlly = woundedAllies.sort((a, b) => (a.currentHealth / a.maxHealth) - (b.currentHealth / b.maxHealth))[0];
  const weakestPlayer = playerTargets.sort((a, b) => a.currentHealth - b.currentHealth)[0];
  const playerCommander = playerTargets.find(unit => unit.kind === 'commander');

  if (personality === 'boss') {
    if (mana >= 6 && Math.random() < 0.22) return castBattleSpell(state, 'moonlit-veil');
    if (mana >= 5 && playerCommander && Math.random() < 0.38) return castBattleSpell(state, 'judgement', playerCommander.id);
    if (mana >= 5 && Math.random() < 0.22) return castBattleSpell(state, 'royal-command');
    if (mana >= 4 && Math.random() < 0.38) return castBattleSpell(state, 'chain-spark');
  }

  if (personality === 'arcane') {
    if (mana >= 4 && playerCommander && Math.random() < 0.45) return castBattleSpell(state, 'gravity-snare', playerCommander.id);
    if (mana >= 4 && Math.random() < 0.5) return castBattleSpell(state, 'chain-spark');
    if (mana >= 3 && weakestPlayer && Math.random() < 0.55) return castBattleSpell(state, 'withering-curse', weakestPlayer.id);
  }

  if (personality === 'defensive') {
    if (mana >= 6 && Math.random() < 0.25) return castBattleSpell(state, 'moonlit-veil');
    if (mana >= 2 && mostWoundedAlly && Math.random() < 0.7) return castBattleSpell(state, 'sanctified-mend', mostWoundedAlly.id);
    if (mana >= 3 && mostWoundedAlly && Math.random() < 0.45) return castBattleSpell(state, 'thorn-ward', mostWoundedAlly.id);
  }

  if (personality === 'aggressive') {
    if (mana >= 5 && playerCommander && Math.random() < 0.4) return castBattleSpell(state, 'judgement', playerCommander.id);
    if (mana >= 2 && weakestPlayer && Math.random() < 0.75) return castBattleSpell(state, 'arcane-bolt', weakestPlayer.id);
  }

  if (mana >= 4 && Math.random() < 0.3) {
    return castBattleSpell(state, 'chain-spark');
  }

  if (mana >= 2 && mostWoundedAlly && Math.random() < 0.45) {
    return castBattleSpell(state, 'sanctified-mend', mostWoundedAlly.id);
  }

  if (mana >= 2 && Math.random() < 0.55) {
    const target = getRandomItem(playerTargets);
    if (target) return castBattleSpell(state, 'arcane-bolt', target.id);
  }

  return null;
}

function getEnemyHealChance(personality: EnemyAiPersonality): number {
  switch (personality) {
    case 'defensive': return 0.82;
    case 'boss': return 0.68;
    case 'arcane': return 0.55;
    case 'aggressive': return 0.28;
    default: return 0.6;
  }
}

function getEnemyMoveCandidateCount(personality: EnemyAiPersonality): number {
  switch (personality) {
    case 'aggressive':
    case 'boss':
      return 1;
    case 'defensive':
      return 5;
    default:
      return 3;
  }
}

function sortTargetsForPersonality(personality: EnemyAiPersonality, activeUnit: BattleUnit, targets: BattleUnit[], state?: BattleState): BattleUnit[] {
  const killShotSort = (a: BattleUnit, b: BattleUnit) => {
    const aKill = state ? getAttackDamage(activeUnit, a, state) >= a.currentHealth : false;
    const bKill = state ? getAttackDamage(activeUnit, b, state) >= b.currentHealth : false;
    return Number(bKill) - Number(aKill);
  };

  if (personality === 'aggressive' || personality === 'boss') {
    return [...targets].sort((a, b) => {
      const killPriority = killShotSort(a, b);
      if (killPriority !== 0) return killPriority;
      const commanderPriority = Number(b.kind === 'commander') - Number(a.kind === 'commander');
      if (commanderPriority !== 0) return commanderPriority;
      return a.currentHealth - b.currentHealth;
    });
  }

  if (personality === 'arcane') {
    return [...targets].sort((a, b) => killShotSort(a, b) || a.defense - b.defense || a.currentHealth - b.currentHealth);
  }

  if (personality === 'defensive') {
    return [...targets].sort((a, b) => killShotSort(a, b) || getDistance(activeUnit, a) - getDistance(activeUnit, b));
  }

  return [...targets].sort((a, b) => killShotSort(a, b) || a.currentHealth - b.currentHealth);
}

function scoreEnemyMoveCell(
  state: BattleState,
  unit: BattleUnit,
  cell: BoardCell,
  target: BattleUnit,
  personality: EnemyAiPersonality
): number {
  const terrain = getTerrainAt(state, cell.x, cell.y);
  const distanceScore = getDistance(cell, target) * 8;
  const terrainCost = getTerrainMoveCost(terrain) * 2;
  const adjacentEnemies = state.units.filter(candidate => (
    candidate.side !== unit.side &&
    candidate.currentHealth > 0 &&
    getDistance(cell, candidate) === 1
  )).length;
  const adjacentAllies = state.units.filter(candidate => (
    candidate.side === unit.side &&
    candidate.id !== unit.id &&
    candidate.currentHealth > 0 &&
    getDistance(cell, candidate) === 1
  )).length;

  let score = distanceScore + terrainCost;
  if (terrain === 'water' || terrain === 'mud') score += 5;
  if (terrain === 'highGround' && unit.range > 1) score -= 5;
  if (terrain === 'holyGround' && unit.healing > 0) score -= 5;
  if (terrain === 'cover' && (personality === 'defensive' || personality === 'boss')) score -= 4;
  if (adjacentEnemies > 0 && (personality === 'aggressive' || personality === 'boss')) score -= 3;
  if (adjacentAllies > 0 && (personality === 'defensive' || personality === 'boss')) score -= 2;
  if (terrain === 'bridge' && (personality === 'defensive' || unit.defense >= 10)) score -= 2;
  return score;
}

export function runEnemyBattleTurn(state: BattleState): BattleState {
  const currentState = state;
  const activeUnit = getActiveUnit(currentState);
  if (!activeUnit || activeUnit.side !== 'enemy' || currentState.status !== 'active') return currentState;
  const personality = currentState.enemy.personality || 'balanced';

  if (isBonusMovePending(currentState, activeUnit)) {
    const playerTargets = currentState.units.filter(unit => unit.side === 'player' && unit.currentHealth > 0);
    const nearestTarget = playerTargets.sort((a, b) => getDistance(activeUnit, a) - getDistance(activeUnit, b))[0];
    const awayFrom = currentState.bonusMoveAwayFrom;
    const bonusCells = getBonusMoveCells(currentState, activeUnit).sort((a, b) => {
      const awaySort = awayFrom ? getDistance(b, awayFrom) - getDistance(a, awayFrom) : 0;
      if (awaySort !== 0) return awaySort;
      if (nearestTarget) {
        return scoreEnemyMoveCell(currentState, activeUnit, a, nearestTarget, personality)
          - scoreEnemyMoveCell(currentState, activeUnit, b, nearestTarget, personality);
      }
      return 0;
    });
    const bestBonusCell = bonusCells[0];
    return bestBonusCell
      ? moveBonusBattleUnit(currentState, activeUnit.id, bestBonusCell.x, bestBonusCell.y)
      : skipBonusBattleMove(currentState, activeUnit.id);
  }

  if (activeUnit.kind === 'commander') {
    const bossSpecialState = runBossSpecialAbility(currentState, activeUnit);
    if (bossSpecialState) return bossSpecialState;

    const spellState = runEnemyCommanderSpell(currentState, activeUnit, personality);
    if (spellState) return spellState;
  }

  const supportAbility = getMinionSupportAbility(activeUnit);
  const livingAllies = supportAbility
    ? currentState.units.filter(unit => unit.side === activeUnit.side && unit.currentHealth > 0)
    : [];
  const supportChance = personality === 'defensive' || personality === 'boss' ? 0.68 : 0.48;
  if (supportAbility && livingAllies.length > 1 && Math.random() < supportChance) {
    return applyMinionSupportAbility(currentState, activeUnit.id);
  }

  const healTargets = getHealTargets(currentState, activeUnit);
  if (healTargets.length > 0 && Math.random() < getEnemyHealChance(personality)) {
    const target = healTargets.sort((a, b) => (a.currentHealth / a.maxHealth) - (b.currentHealth / b.maxHealth))[0];
    return advanceBattleTurn(healBattleUnit(currentState, activeUnit.id, target.id));
  }

  const attackTargets = getAttackTargets(currentState, activeUnit);
  if (attackTargets.length > 0) {
    const rankedTargets = sortTargetsForPersonality(personality, activeUnit, attackTargets, currentState);
    const target = personality === 'balanced' ? getRandomItem(rankedTargets) || rankedTargets[0] : rankedTargets[0];
    const attackedState = attackBattleUnit(currentState, activeUnit.id, target.id);
    const attackerAfterAttack = attackedState.units.find(unit => unit.id === activeUnit.id && unit.currentHealth > 0);
    if (attackerAfterAttack && isBonusMovePending(attackedState, attackerAfterAttack)) {
      return attackedState;
    }
    return advanceBattleTurn(attackedState);
  }

  const playerTargets = currentState.units.filter(unit => unit.side === 'player' && unit.currentHealth > 0);
  const rankedTargets = sortTargetsForPersonality(personality, activeUnit, playerTargets, currentState);
  const nearestTarget = rankedTargets.sort((a, b) => getDistance(activeUnit, a) - getDistance(activeUnit, b))[0];
  const moveCells = getMoveCells(currentState, activeUnit);

  if (nearestTarget && moveCells.length > 0) {
    const goodCells = moveCells
      .sort((a, b) => scoreEnemyMoveCell(currentState, activeUnit, a, nearestTarget, personality) - scoreEnemyMoveCell(currentState, activeUnit, b, nearestTarget, personality))
      .slice(0, getEnemyMoveCandidateCount(personality));
    const bestCell = personality === 'balanced' ? getRandomItem(goodCells) || goodCells[0] : goodCells[0];
    const movedState = moveBattleUnit(currentState, activeUnit.id, bestCell.x, bestCell.y);
    // Enemy movement consumes the action; otherwise NPCs get a hidden move-then-strike turn.
    return advanceBattleTurn(movedState);
  }

  return waitBattleUnit(currentState, activeUnit.id);
}

type StoredBattleChallenge = Omit<BattleChallenge, 'status' | 'confirmedBy'> & {
  status: BattleChallengeStatus | 'accepted';
  confirmedBy?: string[];
};

function getChallengeParticipants(challenge: Pick<BattleChallenge, 'challengerUsername' | 'targetUsername'>): string[] {
  return [challenge.challengerUsername, challenge.targetUsername];
}

function isChallengeBetween(challenge: BattleChallenge, firstUsername: string, secondUsername: string): boolean {
  const participants = getChallengeParticipants(challenge);
  return participants.includes(firstUsername) && participants.includes(secondUsername);
}

function normalizeChallenge(rawChallenge: StoredBattleChallenge, now = Date.now()): BattleChallenge {
  const participants = getChallengeParticipants(rawChallenge);
  const confirmedBy = Array.from(new Set(rawChallenge.confirmedBy || (
    rawChallenge.status === 'accepted'
      ? participants
      : [rawChallenge.challengerUsername]
  ))).filter(username => participants.includes(username));

  let status: BattleChallengeStatus = rawChallenge.status === 'accepted'
    ? 'ready'
    : rawChallenge.status;

  if (status === 'pending' && rawChallenge.expiresAt <= now) {
    status = 'expired';
  }

  if (status === 'pending' && confirmedBy.length === participants.length) {
    status = 'ready';
  }

  return {
    ...rawChallenge,
    status,
    confirmedBy,
    readyAt: status === 'ready' ? rawChallenge.readyAt || now : rawChallenge.readyAt,
  };
}

function readChallenges(): BattleChallenge[] {
  if (typeof window === 'undefined') return [];

  return readGameJson<StoredBattleChallenge[]>(CHALLENGES_KEY, [])
    .map(challenge => normalizeChallenge(challenge));
}

function writeChallenges(challenges: BattleChallenge[]): void {
  if (typeof window === 'undefined') return;
  writeGameJson(CHALLENGES_KEY, challenges);
}

export function getBattleChallenges(): BattleChallenge[] {
  const challenges = readChallenges();
  writeChallenges(challenges);
  return challenges;
}

export function createBattleChallenge(targetUsername: string): BattleChallenge | null {
  const currentUser = getCurrentUser();
  if (!currentUser || currentUser.username === targetUsername) return null;
  const targetUser = getUsers().find(user => user.username === targetUsername) || null;
  if (!canChallengePlayer(currentUser, targetUser).allowed) return null;

  const now = Date.now();
  const challenges = getBattleChallenges();
  const existingChallenge = challenges.find(challenge => (
    isChallengeBetween(challenge, currentUser.username, targetUsername) &&
    (challenge.status === 'pending' || challenge.status === 'ready')
  ));

  if (existingChallenge) return existingChallenge;

  const challenge: BattleChallenge = {
    id: `challenge-${currentUser.username}-${targetUsername}-${now}`,
    challengerUsername: currentUser.username,
    targetUsername,
    createdAt: now,
    expiresAt: now + BATTLE_CONFIRM_WINDOW_MS,
    status: 'pending',
    confirmedBy: [currentUser.username],
  };

  writeChallenges([challenge, ...challenges].slice(0, 20));
  return challenge;
}

export function confirmBattleChallenge(challengeId: string): BattleChallenge | null {
  const currentUser = getCurrentUser();
  if (!currentUser) return null;

  const challenges = getBattleChallenges();
  const challenge = challenges.find(item => item.id === challengeId && item.status === 'pending');
  if (!challenge) return null;
  if (!getChallengeParticipants(challenge).includes(currentUser.username)) return null;
  if (challenge.expiresAt <= Date.now()) return null;

  const confirmedBy = Array.from(new Set([...challenge.confirmedBy, currentUser.username]));
  const ready = confirmedBy.length === getChallengeParticipants(challenge).length;
  const confirmed: BattleChallenge = {
    ...challenge,
    confirmedBy,
    status: ready ? 'ready' : 'pending',
    readyAt: ready ? Date.now() : challenge.readyAt,
  };

  writeChallenges(challenges.map(item => item.id === challengeId ? confirmed : item));
  return confirmed;
}

export function acceptBattleChallenge(challengeId: string): BattleChallenge | null {
  return confirmBattleChallenge(challengeId);
}

export function declineBattleChallenge(challengeId: string): BattleChallenge | null {
  const currentUser = getCurrentUser();
  if (!currentUser) return null;

  const challenges = getBattleChallenges();
  const challenge = challenges.find(item => item.id === challengeId && item.status === 'pending');
  if (!challenge || !getChallengeParticipants(challenge).includes(currentUser.username)) return null;

  const declined: BattleChallenge = {
    ...challenge,
    status: 'declined',
    declinedAt: Date.now(),
  };

  writeChallenges(challenges.map(item => item.id === challengeId ? declined : item));
  return declined;
}

export function cancelBattleChallenge(challengeId: string): BattleChallenge | null {
  const currentUser = getCurrentUser();
  if (!currentUser) return null;

  const challenges = getBattleChallenges();
  const challenge = challenges.find(item => item.id === challengeId && item.status === 'pending');
  if (!challenge || challenge.challengerUsername !== currentUser.username) return null;

  const cancelled: BattleChallenge = {
    ...challenge,
    status: 'cancelled',
    cancelledAt: Date.now(),
  };

  writeChallenges(challenges.map(item => item.id === challengeId ? cancelled : item));
  return cancelled;
}

export function getBattleChallengeTimeRemaining(challenge: BattleChallenge, now = Date.now()): number {
  return Math.max(0, challenge.expiresAt - now);
}
