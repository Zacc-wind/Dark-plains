'use client';

import Image from 'next/image';
import type { CSSProperties, ReactNode } from 'react';
import { createPortal } from 'react-dom';
import { useCallback, useEffect, useRef, useState } from 'react';
import BattleModal from './BattleModal';
import FormationPanel from './FormationPanel';
import SingleplayerTutorialOverlay from './SingleplayerTutorialOverlay';
import CinematicScrollShell from './CinematicScrollShell';
import {
  BATTLE_SPELLS,
  BoardCell,
  BattleState,
  BOSS_LAST_STAND_PRESENTATION_MS,
  EnemyAiPersonality,
  PlayerModelNumber,
  WorldEnemy,
  getPlayerModelAsset,
  markWorldEnemyDefeated,
} from '@/lib/battle';
import { emitCompletionNotice, subscribeCompletionOverlayIdle, type CompletionRewardLine } from '@/lib/completionEvents';
import { emitFxEvent } from '@/lib/fxEvents';
import {
  addRunEquipment,
  createEmptyRunEquipmentState,
  equipRunItem,
  formatEquipmentRarityLabel,
  formatRunEquipmentSummary,
  generateRunLootEquipment,
  getEquippedRunItem,
  getRunEquipmentIconPath,
  getRunEquipmentStatRows,
  getUnequippedRunEquipment,
  RUN_EQUIPMENT_LAYOUT,
  RUN_EQUIPMENT_SLOT_LABELS,
  RUN_EQUIPMENT_SLOTS,
  RUN_MAX_EQUIPMENT_BAG,
  unequipRunItem,
} from '@/lib/runEquipment';
import { ASSET_PATHS } from '@/lib/assetLoader';
import {
  ActivityEntry,
  CharacterStats,
  type DailyRunChallenge,
  Equipment,
  EquipmentRarity,
  EquipmentSlot,
  InventoryItem,
  MAX_FIELD_MINIONS,
  MINION_CLASS_LABELS,
  MINION_TEMPLATES,
  MINION_TIER_LABELS,
  type MinionClass,
  type MinionStats,
  MinionStack,
  MinionTemplate,
  RANDOM_RUN_BALANCE,
  User,
  addEquipmentWithLimit,
  addInventoryItemsWithLimit,
  generateEquipment,
  getCurrentUser,
  getDailyRunChallenge,
  getMinionTemplate,
  getOrderedMinions,
  getDailyRunState,
  getRandomRunEffectiveLevel,
  getRandomRunExpNeeded,
  getRandomRunProgressRatio,
  isMinionInjured,
  isStandaloneMinionTemplate,
  isStandaloneTier1MinionTemplate,
  isStandaloneTier2MinionTemplate,
  levelUp,
  makeInventoryItem,
  recordDailyRunCompletionState,
  recordCurrentMultiplayerEngagementEvent,
  rollInventoryBonusDrops,
  updateCurrentUser,
} from '@/lib/auth';
import {
  getFormationIssue,
  isFormationCellAllowed,
  makeDefaultFormation,
  mergeFormation,
} from '@/lib/formation';
import { getSpellIconPath } from '@/lib/spellAssets';
import {
  WorldDungeon,
  formatDungeonTimeRemaining,
  getRegionForTile,
} from '@/lib/worldEvents';
import { readGameJson, removeGameStorageItem, writeGameJson } from '@/lib/gameStore';
import { generateLootEquipment } from '@/lib/lootTables';
import {
  getMpDailyDungeonChallenge,
  hasCompletedMpDailyDungeonToday,
  recordMpDailyDungeonCompletion,
  type MpDailyDungeonChallenge,
} from '@/lib/mpDailyDungeon';
import { BOSS_PROFILES, getBossProfileById, getBossProfileByIndex } from '@/lib/bosses';
import {
  getRunMilestoneRewardExp,
  getRunMilestoneViews,
  getRunProgressionUnlocks,
} from '@/lib/runMilestones';
import {
  createSingleplayerRunTutorialStep,
  markSingleplayerRunRewardTipSeen,
  markSingleplayerRunTutorialStepSeen,
  SINGLEPLAYER_RUN_TUTORIAL_GUIDE_ASSET,
  SINGLEPLAYER_RUN_TUTORIAL_RESET_EVENT,
  SINGLEPLAYER_RUN_TUTORIAL_STEP_IDS,
  shouldShowSingleplayerRunTutorialStep,
  shouldShowSingleplayerRunRewardTip,
  skipSingleplayerRunTutorial,
  type SingleplayerRunTutorialStep,
  type SingleplayerRunTutorialStepId,
  type SingleplayerRunRewardTipId,
} from '@/lib/singleplayerTutorial';
import { completeMultiplayerTutorialCallout } from '@/lib/multiplayerTutorial';

type RunMode = 'daily' | 'dungeon' | 'encounter' | 'mpDaily';
export type RunPhase = 'draft' | 'map' | 'formation' | 'battle' | 'reward' | 'shop' | 'event' | 'complete';
type RunOutcome = 'victory' | 'defeat' | 'abandoned' | null;
type RewardDestination = 'daily-next' | 'dungeon-next' | 'complete' | null;
type DungeonNodeType = 'battle' | 'elite' | 'shop' | 'event' | 'boss';
type RunTutorialScope = 'singleplayer' | 'none';
type RunLengthId = 'quick' | 'short' | 'standard' | 'long';

interface SingleplayerRunSetup {
  commanderModel: PlayerModelNumber;
  runLength: RunLengthId;
}

interface RunLengthOption {
  id: RunLengthId;
  label: string;
  title: string;
  description: string;
  fixedBattles?: number;
  minRunLevel: number;
  enemyLevelOffset: number;
  rewardMultiplier: number;
}

interface RunCommanderProfile {
  model: PlayerModelNumber;
  label: string;
  title: string;
  description: string;
  passiveName: string;
  passiveSummary: string;
  statBonus: Partial<Pick<CharacterStats, 'armyPower' | 'defensivePower' | 'morale' | 'spellPower' | 'maxHealth' | 'health'>>;
  unitFocus: RunCommanderUnitFocus;
}

interface RunCommanderUnitFocus {
  label: string;
  summary: string;
  class?: MinionClass;
  roleKeywords?: string[];
  statBonus: Partial<Pick<MinionStats, 'attack' | 'defense' | 'magic' | 'healing' | 'health' | 'movement' | 'range'>>;
}

const DEFAULT_RUN_SETUP: SingleplayerRunSetup = {
  commanderModel: 3,
  runLength: 'standard',
};

const RANDOM_RUN_ABSOLUTE_BATTLE_MIN = 5;

const RUN_LENGTH_OPTIONS: RunLengthOption[] = [
  {
    id: 'quick',
    label: 'Quick',
    title: 'Quick Road',
    description: 'A five-fight road for fast testing, light pressure, and smaller rewards.',
    fixedBattles: 5,
    minRunLevel: 1,
    enemyLevelOffset: -2,
    rewardMultiplier: 0.65,
  },
  {
    id: 'short',
    label: 'Short',
    title: 'Short Road',
    description: 'A compact road with fewer fights, lower pressure, and lighter rewards.',
    fixedBattles: 9,
    minRunLevel: 1,
    enemyLevelOffset: -1,
    rewardMultiplier: 0.85,
  },
  {
    id: 'standard',
    label: 'Standard',
    title: 'Standard Road',
    description: 'The balanced run length. Uses your current run level for road size.',
    minRunLevel: 1,
    enemyLevelOffset: 0,
    rewardMultiplier: 1,
  },
  {
    id: 'long',
    label: 'Long',
    title: 'Long Road',
    description: 'A longer road with more bosses, stronger scaling, and better run XP.',
    fixedBattles: RANDOM_RUN_BALANCE.routeBattleMax,
    minRunLevel: 5,
    enemyLevelOffset: 1,
    rewardMultiplier: 1.25,
  },
];

const RUN_COMMANDER_PROFILES: RunCommanderProfile[] = [
  {
    model: 1,
    label: 'Templar',
    title: 'Iron Marshal',
    description: 'Best for shielded warbands and knight-heavy drafts.',
    passiveName: 'Shield Oath',
    passiveSummary: '+1 army ward, +10 commander health, and templars gain ward and health.',
    statBonus: { defensivePower: 1, maxHealth: 10, health: 10 },
    unitFocus: {
      label: 'Templar Line',
      summary: 'Templars gain +2 ward and +6 health.',
      class: 'templar',
      statBonus: { defense: 2, health: 6 },
    },
  },
  {
    model: 2,
    label: 'Arcanist',
    title: 'Moon Arcanist',
    description: 'Best for spell pressure and commander damage.',
    passiveName: 'Moon Channel',
    passiveSummary: '+2 spell power, and wizards gain stronger magic.',
    statBonus: { spellPower: 2 },
    unitFocus: {
      label: 'Wizard Circle',
      summary: 'Wizards gain +2 magic.',
      class: 'wizard',
      statBonus: { magic: 2 },
    },
  },
  {
    model: 3,
    label: 'Prior',
    title: 'Candle Prior',
    description: 'Best for defensive healer-centered runs.',
    passiveName: 'Candle Discipline',
    passiveSummary: '+1 ward, +1 morale, +6 commander health, and priests heal better.',
    statBonus: { defensivePower: 1, morale: 1, maxHealth: 6, health: 6 },
    unitFocus: {
      label: 'Priest Choir',
      summary: 'Priests gain +2 healing and +4 health.',
      class: 'priest',
      statBonus: { healing: 2, health: 4 },
    },
  },
  {
    model: 4,
    label: 'Vanguard',
    title: 'Blood Vanguard',
    description: 'Best for aggressive melee drafts.',
    passiveName: 'Red Advance',
    passiveSummary: '+2 army damage, and knight frontliners hit harder.',
    statBonus: { armyPower: 2 },
    unitFocus: {
      label: 'Knight Charge',
      summary: 'Knights gain +2 attack.',
      class: 'knight',
      statBonus: { attack: 2 },
    },
  },
  {
    model: 5,
    label: 'Duelist',
    title: 'Road Duelist',
    description: 'Best for fast turns and skirmisher-heavy drafts.',
    passiveName: 'Quick March',
    passiveSummary: '+1 morale, +1 army damage, and skirmishers move faster.',
    statBonus: { morale: 1, armyPower: 1 },
    unitFocus: {
      label: 'Skirmisher Steps',
      summary: 'Assassins and skirmishers gain +1 movement and +1 attack.',
      roleKeywords: ['assassin', 'skirmisher', 'wing-step'],
      statBonus: { movement: 1, attack: 1 },
    },
  },
  {
    model: 6,
    label: 'Warden',
    title: 'Grave Warden',
    description: 'Best for durable mixed warbands.',
    passiveName: 'Grave Hold',
    passiveSummary: '+1 damage, +1 ward, +8 commander health, and guards hold longer.',
    statBonus: { armyPower: 1, defensivePower: 1, maxHealth: 8, health: 8 },
    unitFocus: {
      label: 'Grave Guard',
      summary: 'Guard and tank units gain +1 ward and +5 health.',
      roleKeywords: ['guard', 'tank', 'fighter'],
      statBonus: { defense: 1, health: 5 },
    },
  },
];

function pickRunCommanderDraftChoices(count = 4): RunCommanderProfile[] {
  return shuffle(RUN_COMMANDER_PROFILES).slice(0, Math.min(count, RUN_COMMANDER_PROFILES.length));
}

interface RunUnit {
  stack: MinionStack;
  alive: boolean;
  origin: 'draft' | 'roster' | 'reward' | 'loaned';
}

type RunUnitStatBonus = Partial<Pick<MinionStats, 'attack' | 'defense' | 'magic' | 'healing' | 'health' | 'movement' | 'range'>>;

interface RunBattleUnitReport {
  id: string;
  name: string;
  assetPath: string;
  side: 'player' | 'enemy';
  alive: boolean;
  damageDealt: number;
  damageTaken: number;
  healingDone: number;
}

interface RunBattleReport {
  id: string;
  enemyName: string;
  enemyAssetPath: string;
  enemyLevel: number;
  enemyPersonality: EnemyAiPersonality;
  status: BattleEndResult['status'];
  round: number;
  durationMs: number;
  damageDealt: number;
  damageTaken: number;
  healingDone: number;
  unitReports: RunBattleUnitReport[];
}

interface RunShopOffer {
  choiceId: string;
  cost: number;
  equipmentOffer?: Equipment;
  purchased?: boolean;
}

interface RunCelebration {
  id: string;
  kind: 'gear' | 'unit';
  title: string;
  kicker: string;
  description: string;
  artworkPath: string;
  artworkStyle?: 'item' | 'plain';
  rewards: CompletionRewardLine[];
  tutorialTip?: SingleplayerRunRewardTipId;
}

interface DungeonNode {
  id: string;
  type: DungeonNodeType;
  label: string;
  description: string;
  iconPath: string;
  level: number;
  completed: boolean;
  row?: number;
  lane?: number;
  nextIds?: string[];
  battleNumber?: number;
  bossId?: string;
  rewardSource?: 'hard' | 'boss';
}

interface DungeonNodeSpec {
  type: DungeonNodeType;
  label: string;
  description?: string;
}

interface RunSession {
  id: string;
  mode: RunMode;
  title: string;
  phase: RunPhase;
  stats: CharacterStats;
  commanderModel: PlayerModelNumber;
  commanderPassiveName?: string;
  commanderPassiveSummary?: string;
  runLengthId?: RunLengthId;
  runLengthName?: string;
  runLengthRewardMultiplier?: number;
  minions: RunUnit[];
  draftChoices: MinionTemplate[];
  wins: number;
  targetBattles: number;
  runGold: number;
  activeEnemy: WorldEnemy | null;
  formation: Record<string, BoardCell>;
  spellIds: string[];
  knownSpellIds: string[];
  rewardChoices: RunRewardChoice[];
  rewardDestination: RewardDestination;
  nodes: DungeonNode[];
  currentNodeIndex: number;
  battleReports: RunBattleReport[];
  outcome: RunOutcome;
  dailyChallenge?: DailyRunChallenge;
  mpDailyChallenge?: MpDailyDungeonChallenge;
  dungeon?: WorldDungeon;
  encounterEnemy?: WorldEnemy;
  notice?: string;
  rewardClaimed?: boolean;
  shopOffers?: Record<string, RunShopOffer[]>;
  shopRerollsRemaining?: number;
  blessingRerollsRemaining?: number;
  omenRerollsRemaining?: number;
  pendingPositiveOmen?: boolean;
  pendingRunCelebrations?: RunCelebration[];
  celebrationResume?: RunSession;
  startedAt?: number;
  bossHistory?: string[];
  shopBuyHistory?: string[];
  omenHistory?: string[];
  permanentSpellUnlocks?: string[];
  runGearRarityCap?: EquipmentRarity;
  runEquipment: Equipment[];
  runEquippedSlots: Partial<Record<EquipmentSlot, string>>;
}

type StoredRunRewardEquipment = {
  choiceId: string;
  equipment: Equipment;
};

type StoredRunSession = Omit<RunSession, 'rewardChoices'> & {
  rewardChoiceIds: string[];
  rewardEquipmentOffers?: StoredRunRewardEquipment[];
  savedAt: number;
  ownerUsername: string;
  dateKey: string;
};

const DUNGEON_NODE_ICONS: Record<DungeonNodeType, string> = {
  battle: '/assets/icons/attack.png',
  elite: '/assets/icons/defense.png',
  shop: '/assets/icons/gold.png',
  event: '/assets/icons/magic.png',
  boss: '/assets/icons/loot-chest.png',
};

type RunNodeState = 'completed' | 'reachable' | 'skipped' | 'locked';

function getDungeonNodeIconPath(type: DungeonNodeType, bossId?: string): string {
  if (type === 'boss' && bossId) {
    return getBossProfileById(bossId)?.assetPath ?? DUNGEON_NODE_ICONS.boss;
  }

  return DUNGEON_NODE_ICONS[type];
}

function getRunMapNodeArtClass(node: Pick<DungeonNode, 'type'>, state: RunNodeState): string {
  const classes = ['run-route-node-art', 'object-contain'];
  if (node.type === 'boss') classes.push('run-route-node-art-boss');
  else if (node.type === 'shop') classes.push('run-route-node-art-shop');
  else if (node.type === 'event') classes.push('run-route-node-art-event');
  else if (node.type !== 'battle') classes.push('run-route-node-art-knockout');
  if (state === 'reachable') classes.push('run-route-node-art-live');
  return classes.join(' ');
}

function getRunMapNodeIconPath(
  node: DungeonNode,
  session: Pick<RunSession, 'dailyChallenge' | 'dungeon' | 'encounterEnemy'>,
): string {
  if (node.type !== 'boss') {
    return node.iconPath || DUNGEON_NODE_ICONS[node.type];
  }

  const bossId = node.bossId
    || session.dailyChallenge?.bossId
    || session.dungeon?.bossId
    || session.encounterEnemy?.bossId;

  return getBossProfileById(bossId)?.assetPath
    || session.dailyChallenge?.bossArtworkPath
    || session.dungeon?.bossArtworkPath
    || session.encounterEnemy?.artworkPath
    || node.iconPath
    || DUNGEON_NODE_ICONS.boss;
}

const DUNGEON_LAYOUTS: Record<string, DungeonNodeSpec[]> = {
  'ossuary-cellar': [
    { type: 'battle', label: 'Bone Gate', description: 'The cellar mouth is held by candle-fed skeleton guards.' },
    { type: 'event', label: 'Ash Font', description: 'A black font may bless the faithful or bite the careless.' },
    { type: 'shop', label: 'Mourner Trader', description: 'A veiled trader sells quick blessings for run gold.' },
    { type: 'battle', label: 'Candle Hall', description: 'Tight aisles force a close fight under bone chandeliers.' },
    { type: 'elite', label: 'Reliquary Watch', description: 'An elite keeper guards the door to the boss crypt.' },
    { type: 'boss', label: 'Ossuary Candlekeeper' },
  ],
  'moonwell-descent': [
    { type: 'battle', label: 'Well Steps', description: 'Mist defenders wait on slick stone stairs.' },
    { type: 'event', label: 'Silver Pool', description: 'Moon water reflects a possible blessing or wound.' },
    { type: 'battle', label: 'Mirror Landing', description: 'A second guard group blocks the old landing.' },
    { type: 'shop', label: 'Lantern Peddler', description: 'A lantern seller trades run gold for warded charms.' },
    { type: 'elite', label: 'Oath Diver', description: 'A hard guard rises from the waterline.' },
    { type: 'boss', label: 'Moonwell Binder' },
  ],
  'blackroot-shrine': [
    { type: 'battle', label: 'Root Threshold', description: 'Thorn-bound soldiers defend the shrine path.' },
    { type: 'event', label: 'Bell Roots', description: 'Root bells hum with a risky reward.' },
    { type: 'elite', label: 'Saint Mask Guard', description: 'A masked elite blocks the inner grove.' },
    { type: 'shop', label: 'Thorn Hermit', description: 'A hermit offers bitter blessings before the boss.' },
    { type: 'battle', label: 'Buried Chapel', description: 'Another patrol holds the buried nave.' },
    { type: 'boss', label: 'Root-Saint Heretic' },
  ],
  'drowned-reliquary': [
    { type: 'battle', label: 'Flooded Nave', description: 'Waterlogged guards advance through broken pews.' },
    { type: 'event', label: 'Coin Water', description: 'The dark pool may pay out or demand blood.' },
    { type: 'shop', label: 'Wet Relic Broker', description: 'A broker sells dry charms above the black water.' },
    { type: 'elite', label: 'Drowned Warden', description: 'An elite shieldman holds the reliquary chain.' },
    { type: 'battle', label: 'Icon Steps', description: 'A last guard line protects the relic vault.' },
    { type: 'boss', label: 'Drowned Relic Warden' },
  ],
  'blue-flame-vault': [
    { type: 'battle', label: 'Cold Fire Gate', description: 'Blue-lit apprentices test your front line.' },
    { type: 'event', label: 'Spell Ash Bowl', description: 'The bowl can empower spells or scorch a unit.' },
    { type: 'elite', label: 'Vault Sentinel', description: 'A stronger spell guard protects the inner lock.' },
    { type: 'shop', label: 'Inkless Scribe', description: 'The scribe sells temporary spell wards.' },
    { type: 'battle', label: 'Burning Library', description: 'A final skirmish breaks out between book stacks.' },
    { type: 'event', label: 'Arcane Crack', description: 'Raw magic offers one more risky boon.' },
    { type: 'boss', label: 'Blue Flame Magus' },
  ],
  'saintless-tower': [
    { type: 'battle', label: 'Lower Court', description: 'Tower bailiffs try to hold the first floor.' },
    { type: 'event', label: 'Judgment Bell', description: 'The bell grants a sentence, not always a kind one.' },
    { type: 'elite', label: 'Trial Captain', description: 'An elite captain guards the court stair.' },
    { type: 'shop', label: 'Sentence Broker', description: 'A broker sells illegal mercy for run gold.' },
    { type: 'battle', label: 'High Gallery', description: 'Ranged guards fire across a narrow gallery.' },
    { type: 'event', label: 'Empty Jury', description: 'The empty jury may revive, wound, or enrich you.' },
    { type: 'boss', label: 'Saintless Adjudicator' },
  ],
  'iron-choir-pit': [
    { type: 'battle', label: 'Chanting Yard', description: 'Armored chanters push forward in formation.' },
    { type: 'event', label: 'Cracked Bell', description: 'A cracked bell can raise morale or break resolve.' },
    { type: 'elite', label: 'Pit Marshal', description: 'An elite war-chanter blocks the lower pit.' },
    { type: 'shop', label: 'Anvil Friar', description: 'A friar sells iron blessings between fights.' },
    { type: 'battle', label: 'Chain Floor', description: 'A brutal patrol holds the chain floor.' },
    { type: 'event', label: 'Choir Echo', description: 'The echo chooses a reward or a wound.' },
    { type: 'boss', label: 'Iron Choir Marshal' },
  ],
  'warlord-sepulcher': [
    { type: 'battle', label: 'War Tomb Gate', description: 'Champion guards defend the sealed tomb road.' },
    { type: 'event', label: 'Banner Dust', description: 'Old banner dust may empower the army or poison it.' },
    { type: 'elite', label: 'Sepulcher Captain', description: 'A deadly elite protects the command hall.' },
    { type: 'shop', label: 'Grave Quartermaster', description: 'The quartermaster trades last supplies before the end.' },
    { type: 'battle', label: 'Command Crypt', description: 'The last guard line fights under cracked banners.' },
    { type: 'event', label: 'Broken Crown', description: 'A final omen gives one last risk before the warlord.' },
    { type: 'boss', label: 'Sepulcher Warlord' },
  ],
};

interface RunRewardChoice {
  id: string;
  name: string;
  description: string;
  apply: (session: RunSession) => RunSession;
  isAvailable?: (session: RunSession) => boolean;
  equipmentOffer?: Equipment;
  category?: string;
}

interface BattleEndResult {
  status: 'victory' | 'defeat' | 'recruited';
  battle: BattleState;
  retreated?: boolean;
}

interface DailyRunModalProps {
  isOpen: boolean;
  onClose: () => void;
  tutorialScope?: RunTutorialScope;
}

interface DungeonRunModalProps {
  dungeon: WorldDungeon;
  currentUser: ReturnType<typeof getCurrentUser>;
  now: number;
  onClose: () => void;
}

interface EncounterRunModalProps {
  enemy: WorldEnemy;
  currentUser: ReturnType<typeof getCurrentUser>;
  onClose: () => void;
}

const MINION_ICON_BASE = '/assets/minions';
const RUN_GOLD_ICON = '/assets/icons/gold.png';
const RUN_COMPLETION_STAT_ICONS = {
  wins: '/assets/icons/attack.png',
  standing: '/assets/icons/health.png',
  gold: '/assets/icons/gold.png',
  time: '/assets/icons/speed.png',
  damage: '/assets/icons/attack.png',
  taken: '/assets/icons/defense.png',
  healing: '/assets/icons/healing.png',
  xp: '/assets/icons/xp.png',
  magic: '/assets/icons/magic.png',
  score: '/assets/icons/rare-gem.png',
} as const;

const LOBBY_UPGRADE_ICONS: Record<string, string> = {
  Army: RUN_COMPLETION_STAT_ICONS.wins,
  Ward: RUN_COMPLETION_STAT_ICONS.taken,
  Morale: RUN_COMPLETION_STAT_ICONS.time,
  Spell: RUN_COMPLETION_STAT_ICONS.magic,
  Health: RUN_COMPLETION_STAT_ICONS.standing,
  'Unit Hit': RUN_COMPLETION_STAT_ICONS.damage,
  'Unit Ward': RUN_COMPLETION_STAT_ICONS.taken,
};

function RunLobbyBonusPill({ icon, label, value }: { icon: string; label: string; value: string }) {
  return (
    <span className="random-run-bonus-pill" title={label}>
      <Image src={icon} alt="" width={18} height={18} className="random-run-bonus-pill-icon" unoptimized />
      <span className="random-run-bonus-pill-value">{value}</span>
    </span>
  );
}

function getRunRosterSpriteLayout(rosterCount: number, variant: 'showcase' | 'compact' = 'showcase') {
  const spriteWidth = variant === 'compact'
    ? rosterCount <= 1
      ? 38
      : Math.max(22, 38 - (rosterCount - 1) * 2)
    : rosterCount <= 1
      ? 54
      : Math.max(24, 54 - (rosterCount - 1) * 4.2);
  const spriteStep = variant === 'compact'
    ? rosterCount <= 1
      ? 0
      : Math.max(5.8, 9.6 - rosterCount * 0.36)
    : rosterCount <= 1
      ? 0
      : Math.max(5.5, 13.5 - rosterCount * 0.85);

  return { spriteWidth, spriteStep };
}

const DAILY_RUN_SESSION_PREFIX = 'pirate_game_daily_run_session';
const RANDOM_RUN_ACTIVE_SESSION_KEY = 'random-active';
const RANDOM_RUN_LOBBY_BOSS_COUNT = 8;
const RANDOM_RUN_LOBBY_BOSS_KEY = 'pirate_game_random_run_lobby_boss';
const RUN_REWARD_CHOICE_COUNT = 3;
const RUN_BLESSING_SPELL_OFFER_CHANCE = 0.05;
const RUN_BLESSING_EQUIPMENT_OFFER_CHANCE = 0.12;
const RUN_SHOP_SPELL_OFFER_CHANCE = 0.16;
const RUN_SHOP_EQUIPMENT_OFFER_CHANCE = 0.22;
const RUN_SHOP_CHOICE_COUNT = 8;
const RUN_SHOP_REROLL_COUNT = 3;
const RUN_BLESSING_REROLL_COUNT = 3;
const RUN_OMEN_REROLL_COUNT = 1;
const OMEN_CHANNEL_MS = 3600;
const OMEN_REROLL_MS = 1400;
const RUN_DEFEAT_BURST_MS = 3200;
const RUN_FORMATION_INTRO_MS = 2800;
const RUN_MAX_ROSTER = 10;
const RANDOM_REWARD_ANIMATION_ICON = '/assets/icons/dice.png';
const MERCENARY_TEMPLATE_ID = 'mercenary';
const MERCENARY_SHOP_REWARD_ID = 'mercenary-contract';
const MERCENARY_SHOP_OFFER_CHANCE = 0.05;
const FALLEN_FINAL_DRAFT_CHANCE = 0.06;
const PLAYER_RUN_EXCLUDED_TEMPLATE_IDS = new Set(['thief', 'darkpriest']);

function makeMercenaryShopReward(): RunRewardChoice {
  const template = getMinionTemplate(MERCENARY_TEMPLATE_ID);
  return {
    id: MERCENARY_SHOP_REWARD_ID,
    name: 'Mercenary Contract',
    description: template
      ? `${template.name} joins this run. Slow, hard to kill, and deadly when enemies strike back.`
      : 'A hardened mercenary joins this run.',
    category: 'recruit',
    isAvailable: canAddRunMinion,
    apply: session => {
      const nextTemplate = getMinionTemplate(MERCENARY_TEMPLATE_ID);
      return nextTemplate
        ? addRunMinionFromTemplate(session, nextTemplate, `${nextTemplate.name} joins the run under contract.`)
        : session;
    },
  };
}

const RUN_BUFFS: RunRewardChoice[] = [
  makeStatBuff('army-drill', 'Army Drill', '+2 Army Power for this run.', { armyPower: 2 }),
  makeStatBuff('weapon-rites', 'Weapon Rites', '+4 Army Power for this run.', { armyPower: 4 }),
  makeStatBuff('iron-ward', 'Iron Ward', '+2 Defensive Power for this run.', { defensivePower: 2 }),
  makeStatBuff('relic-armor', 'Relic Armor', '+4 Defensive Power for this run.', { defensivePower: 4 }),
  makeStatBuff('candle-liturgy', 'Candle Liturgy', '+2 Spell Power for this run.', { spellPower: 2 }),
  makeStatBuff('moonwell-focus', 'Moonwell Focus', '+4 Spell Power for this run.', { spellPower: 4 }),
  makeStatBuff('banner-song', 'Banner Song', '+2 Morale for this run.', { morale: 2 }),
  makeStatBuff('war-chorus', 'War Chorus', '+4 Morale for this run.', { morale: 4 }),
  makeStatBuff('blooded-constitution', 'Blooded Constitution', '+20 commander health for this run.', { maxHealth: 20, health: 20 }),
  makeStatBuff('saint-bone-vigor', 'Saint-Bone Vigor', '+35 commander health for this run.', { maxHealth: 35, health: 35 }),
  makeStatBuff('balanced-training', 'Balanced Training', '+1 to every run stat.', { armyPower: 1, defensivePower: 1, morale: 1, spellPower: 1, maxHealth: 10, health: 10 }),
  makeStatBuff('oath-captain', 'Oath Captain', '+2 to Army, Ward, Morale, and Spell.', { armyPower: 2, defensivePower: 2, morale: 2, spellPower: 2 }),
  {
    id: 'resurrect-one',
    name: 'Mercy Candle',
    description: 'Resurrect one fallen minion for this run.',
    isAvailable: hasFallenMinions,
    apply: session => resurrectMinions(session, 1),
  },
  {
    id: 'resurrect-two',
    name: 'Twin Bell Mercy',
    description: 'Resurrect up to two fallen minions for this run.',
    isAvailable: hasFallenMinions,
    apply: session => resurrectMinions(session, 2),
  },
  {
    id: 'resurrect-all',
    name: 'Reliquary Reprieve',
    description: 'Resurrect every fallen minion for this run.',
    isAvailable: hasFallenMinions,
    apply: resurrectAllMinions,
  },
  {
    id: 'recruit-tier1',
    name: 'Lost Recruit',
    description: 'A tier I minion joins the run.',
    isAvailable: canAddRunMinion,
    apply: session => addRandomRunMinion(session, 'tier1'),
  },
  {
    id: 'recruit-tier2',
    name: 'Road Veteran',
    description: 'A tier II minion joins the run.',
    isAvailable: canAddRunMinion,
    apply: session => addRandomRunMinion(session, 'tier2'),
  },
  {
    id: 'recruit-tier3',
    name: 'Grim Champion',
    description: 'A tier III minion joins the run.',
    isAvailable: canAddRunMinion,
    apply: session => addRandomRunMinion(session, 'tier3'),
  },
  {
    id: 'upgrade-random',
    name: 'Field Promotion',
    description: 'Upgrade one living minion to the next tier.',
    isAvailable: hasUpgradeableMinion,
    apply: upgradeRandomMinion,
  },
  {
    id: 'run-gold',
    name: 'Black Coin Cache',
    description: '+60 run gold for run shops.',
    category: 'gold',
    apply: session => ({ ...session, runGold: session.runGold + 60, notice: 'Found 60 run gold.' }),
  },
  makeStatBuff('frontline-drill', 'Frontline Drill', '+2 Army Power and +1 Morale for this run.', { armyPower: 2, morale: 1 }, 'unit-offense'),
  makeStatBuff('shield-wall-vow', 'Shield-Wall Vow', '+2 Defensive Power and +1 Morale for this run.', { defensivePower: 2, morale: 1 }, 'unit-defense'),
  makeStatBuff('candle-tactician', 'Candle Tactician', '+1 Army, Ward, Morale, Spell, and +10 health.', { armyPower: 1, defensivePower: 1, morale: 1, spellPower: 1, maxHealth: 10, health: 10 }, 'hybrid'),
  {
    id: 'field-surgeon-prayer',
    name: 'Field Surgeon Prayer',
    description: 'Heal every living run unit by 18 before the next fight.',
    category: 'minion-heal',
    isAvailable: hasWoundedRunMinions,
    apply: session => healLivingRunMinions(session, 18, 'Field Surgeon Prayer restored the line.'),
  },
  {
    id: 'saint-triage',
    name: 'Saint Triage',
    description: 'Heavily heal every living run unit before the next fight.',
    category: 'minion-heal',
    isAvailable: hasWoundedRunMinions,
    apply: session => healLivingRunMinions(session, 999, 'Saint Triage restored the wounded.'),
  },
  {
    id: 'quartermaster-ledger',
    name: 'Quartermaster Ledger',
    description: '+35 run gold and +1 shop reroll for this run.',
    category: 'economy',
    apply: session => ({
      ...session,
      runGold: session.runGold + 35,
      shopRerollsRemaining: (session.shopRerollsRemaining ?? RUN_SHOP_REROLL_COUNT) + 1,
      notice: 'Quartermaster Ledger claimed: +35 run gold and one shop reroll.',
    }),
  },
  {
    id: 'omen-candle',
    name: 'Omen Candle',
    description: '+1 omen reroll for this run.',
    category: 'reroll',
    apply: session => ({
      ...session,
      omenRerollsRemaining: (session.omenRerollsRemaining ?? RUN_OMEN_REROLL_COUNT) + 1,
      notice: 'Omen Candle claimed: one extra omen reroll.',
    }),
  },
  {
    id: 'relic-gear-cache',
    name: 'Relic Gear Cache',
    description: 'Gain a commander gear piece scaled to this run.',
    category: 'equipment',
    apply: session => addRunEquipment(session, generateRunLootEquipment(
      session.wins,
      session.targetBattles,
      undefined,
      { maxRarity: getRunGearRarityCap(session) },
    )),
  },
];

function getInitialRunKnownSpellIds(spellIds: string[]): string[] {
  return Array.from(new Set(spellIds.filter(spellId => BATTLE_SPELLS.some(spell => spell.id === spellId))));
}

function getRunStartingKnownSpellIds(spellIds: string[], user: User | null | undefined): string[] {
  const known = new Set(getInitialRunKnownSpellIds(spellIds));
  (user?.knownSpellIds || []).forEach(spellId => {
    if (BATTLE_SPELLS.some(spell => spell.id === spellId)) known.add(spellId);
  });
  return Array.from(known);
}

function learnRunSpell(session: RunSession, spellId: string): RunSession {
  if (session.knownSpellIds.includes(spellId)) {
    const spell = BATTLE_SPELLS.find(item => item.id === spellId);
    return { ...session, notice: `${spell?.name || 'That spell'} is already in your run spellbook.` };
  }

  const spell = BATTLE_SPELLS.find(item => item.id === spellId);
  return {
    ...session,
    knownSpellIds: [...session.knownSpellIds, spellId],
    notice: `${spell?.name || 'Spell'} added to your run spellbook.`,
  };
}

function maybeUnlockPermanentRunSpell(session: RunSession): string | null {
  if (session.mode !== 'daily' || Math.random() >= 0.01) return null;

  const user = getCurrentUser();
  if (!user) return null;

  const known = new Set(user.knownSpellIds || []);
  const candidates = BATTLE_SPELLS.filter(spell => !known.has(spell.id));
  const spell = shuffle(candidates)[0];
  if (!spell) return null;

  updateCurrentUser({
    knownSpellIds: [...known, spell.id],
    activityLog: [{
      id: `activity-random-spell-${spell.id}-${Date.now()}`,
      type: 'quest' as const,
      title: `${spell.name} Permanently Learned`,
      source: 'Run',
      completedAt: Date.now(),
      rewards: {},
      description: 'A rare run spell unlock was added to your permanent spellbook.',
    }, ...(user.activityLog || [])].slice(0, 30),
  });

  return spell.name;
}

function makeSpellLearnReward(spell: (typeof BATTLE_SPELLS)[number]): RunRewardChoice {
  return {
    id: `learn-${spell.id}`,
    name: spell.name,
    description: `Learn ${spell.name} for this run (${spell.rarity}, mana ${spell.cost}).`,
    isAvailable: session => !session.knownSpellIds.includes(spell.id),
    apply: session => learnRunSpell(session, spell.id),
  };
}

function restoreRunEquipmentReward(choiceId: string, item: Equipment): RunRewardChoice {
  return {
    id: choiceId,
    name: item.name,
    description: `${formatRunEquipmentSummary(item)} (${item.rarity}).`,
    equipmentOffer: item,
    apply: session => addRunEquipment(session, item),
  };
}

function makeRunEquipmentReward(session: RunSession, forcedRarity?: EquipmentRarity): RunRewardChoice {
  const item = generateRunLootEquipment(session.wins, session.targetBattles, forcedRarity, {
    offer: true,
    maxRarity: getRunGearRarityCap(session),
  });
  return restoreRunEquipmentReward(`gear-offer-${item.id}`, item);
}

function getRunGearRarityCap(session: RunSession): EquipmentRarity {
  return session.mode === 'daily' ? session.runGearRarityCap || 'decent' : 'legendary';
}

function pickRunEquipmentReward(session: RunSession): RunRewardChoice | null {
  if (session.runEquipment.length >= RUN_MAX_EQUIPMENT_BAG) return null;
  return makeRunEquipmentReward(session);
}

const RUN_SPELL_REWARDS: RunRewardChoice[] = BATTLE_SPELLS.map(makeSpellLearnReward);
const RUN_REWARD_POOL: RunRewardChoice[] = [...RUN_BUFFS, ...RUN_SPELL_REWARDS];

export function DailyRunModal({ isOpen, onClose, tutorialScope = 'none' }: DailyRunModalProps) {
  if (!isOpen) return null;

  return <DailyRunModalContent onClose={onClose} tutorialScope={tutorialScope} />;
}

function DailyRunModalContent({ onClose, tutorialScope }: { onClose: () => void; tutorialScope: RunTutorialScope }) {
  const [session, setSession] = useState<RunSession | null>(() => {
    const user = getCurrentUser();
    if (!user) return null;
    return loadDailyRunSession(user);
  });
  const [showLobby, setShowLobby] = useState(true);
  const [dismissedTutorialStepIds, setDismissedTutorialStepIds] = useState<Set<SingleplayerRunTutorialStepId>>(() => new Set());
  const [, setTutorialRefreshKey] = useState(0);
  const user = getCurrentUser();
  const username = user?.username || null;
  const lobbyTutorialStepId = tutorialScope === 'singleplayer'
    ? (['lobby', 'run-setup'] as SingleplayerRunTutorialStepId[]).find(stepId => (
        !dismissedTutorialStepIds.has(stepId) && shouldShowSingleplayerRunTutorialStep(username, stepId)
      ))
    : null;
  const lobbyTutorialStep = lobbyTutorialStepId ? createSingleplayerRunTutorialStep(lobbyTutorialStepId) : null;

  const handleTutorialContinue = (stepId: SingleplayerRunTutorialStepId) => {
    markSingleplayerRunTutorialStepSeen(username, stepId);
    setDismissedTutorialStepIds(current => {
      const next = new Set(current);
      next.add(stepId);
      return next;
    });
    setTutorialRefreshKey(key => key + 1);
  };

  const handleTutorialSkip = () => {
    skipSingleplayerRunTutorial(username);
    setDismissedTutorialStepIds(new Set(SINGLEPLAYER_RUN_TUTORIAL_STEP_IDS));
    setTutorialRefreshKey(key => key + 1);
  };

  useEffect(() => {
    if (tutorialScope !== 'singleplayer') return undefined;
    const handleTutorialReset = () => {
      setDismissedTutorialStepIds(new Set());
      setTutorialRefreshKey(key => key + 1);
    };
    window.addEventListener(SINGLEPLAYER_RUN_TUTORIAL_RESET_EVENT, handleTutorialReset);
    return () => window.removeEventListener(SINGLEPLAYER_RUN_TUTORIAL_RESET_EVENT, handleTutorialReset);
  }, [tutorialScope]);

  useEffect(() => {
    const user = getCurrentUser();
    if (!user) return;

    if (!session || session.rewardClaimed || (session.phase === 'complete' && session.outcome !== 'victory')) {
      clearDailyRunSession(user.username);
      return;
    }

    if (session.mode === 'daily') {
      saveDailyRunSession(user.username, session);
    }
  }, [session]);

  const startNewRun = (setup: SingleplayerRunSetup) => {
    const user = getCurrentUser();
    if (!user) return;
    const runSetup = normalizeRunSetup(user, setup);
    clearDailyRunSession(user.username);
    setSession(createDailySession(user, createRandomRunChallenge(user, runSetup), runSetup));
    setShowLobby(false);
  };

  if (showLobby) {
    return (
      <>
        <RandomRunLobby
          activeSession={session}
          onResume={() => session && setShowLobby(false)}
          onStart={startNewRun}
          onClose={onClose}
          tutorialStepId={lobbyTutorialStep?.id || null}
        />
        {lobbyTutorialStep && (
          <SingleplayerTutorialOverlay
            step={lobbyTutorialStep}
            onContinue={() => handleTutorialContinue(lobbyTutorialStep.id)}
            onSkip={handleTutorialSkip}
          />
        )}
      </>
    );
  }

  if (!session) return null;

  return (
    <RunController
      session={session}
      setSession={setSession}
      onClose={onClose}
      tutorialScope={tutorialScope}
    />
  );
}

function RandomRunLobby({
  activeSession,
  onResume,
  onStart,
  onClose,
  tutorialStepId,
}: {
  activeSession: RunSession | null;
  onResume: () => void;
  onStart: (setup: SingleplayerRunSetup) => void;
  onClose: () => void;
  tutorialStepId?: SingleplayerRunTutorialStepId | null;
}) {
  const [detailsOpen, setDetailsOpen] = useState(false);
  const [selectedRunLength, setSelectedRunLength] = useState<RunLengthId>('standard');
  const [setupPicker, setSetupPicker] = useState<'length' | null>(null);
  const [commanderDraftChoices, setCommanderDraftChoices] = useState<RunCommanderProfile[] | null>(null);
  const [previewBoss] = useState(() => getRandomLobbyBossPreview());
  const user = getCurrentUser();
  const runState = getDailyRunState(user);
  const lastRun = runState.history[0];
  const expNeeded = getRandomRunExpNeeded(runState.runLevel);
  const runLevelCapped = runState.runLevel >= RANDOM_RUN_BALANCE.levelCap;
  const expPercent = runLevelCapped ? 100 : clamp((runState.runExp / Math.max(1, expNeeded)) * 100, 0, 100);
  const permanent = runState.permanentStats;
  const activeRunReady = Boolean(activeSession && !activeSession.rewardClaimed && activeSession.phase !== 'complete');
  const selectedLength = getRunLengthOption(selectedRunLength);
  const startCommanderDraftRun = (profile: RunCommanderProfile) => {
    setCommanderDraftChoices(null);
    onStart({ commanderModel: profile.model, runLength: selectedRunLength });
  };
  const upgradeRows = [
    { label: 'Army', value: `+${permanent.armyPower}` },
    { label: 'Ward', value: `+${permanent.defensivePower}` },
    { label: 'Morale', value: `+${permanent.morale}` },
    { label: 'Spell', value: `+${permanent.spellPower}` },
    { label: 'Health', value: `+${permanent.maxHealth}` },
    { label: 'Unit Hit', value: `+${permanent.unitPower}` },
    { label: 'Unit Ward', value: `+${permanent.unitWard}` },
  ];
  const lastRunCleared = Boolean(lastRun && lastRun.wins >= lastRun.targetBattles);

  return (
    <div className="run-modal-layer random-run-lobby-layer fixed inset-0 z-[68] flex items-center justify-center bg-black/76 p-1 text-zinc-100 backdrop-blur-sm">
      <section className="run-modal-panel random-run-lobby command-panel vine-frame relative grid h-[calc(100vh-0.5rem)] max-h-[calc(100vh-0.5rem)] w-full max-w-none overflow-hidden rounded border">
        <div className="random-run-lobby-hero relative overflow-hidden border-b p-5 sm:p-6">
          <Image
            src={previewBoss.assetPath}
            alt=""
            fill
            sizes="720px"
            className="random-run-lobby-boss object-contain object-right-bottom"
            priority
          />
          <div className="relative z-10 max-w-2xl">
            <div className="arcane-label">Random Roguelike Run</div>
            <h2 className="fantasy-heading mt-1 text-3xl sm:text-5xl">Start Run</h2>
            <p className="ui-muted mt-3 max-w-xl text-sm font-bold leading-relaxed">
              Draft a temporary army, choose roads, buy run-only upgrades, and fight several bosses. Defeat or retreat simply ends that attempt.
            </p>
            <div className="mt-5 flex flex-wrap gap-3">
              {activeRunReady ? (
                <button onClick={onResume} className="random-run-start ui-button-primary rounded px-6 py-3 text-sm font-black">
                  Resume {activeSession?.wins}/{activeSession?.targetBattles}
                </button>
              ) : null}
              <button
                onClick={() => setCommanderDraftChoices(pickRunCommanderDraftChoices())}
                className={`rounded px-6 py-3 text-sm font-black ${activeRunReady ? 'ui-button' : 'random-run-start ui-button-primary'}`}
              >
                New Run
              </button>
              <button onClick={onClose} className="ui-button rounded px-5 py-3 text-sm font-bold">
            Close
          </button>
            </div>

            <div className={`random-run-setup-summary-cards random-run-setup-summary-cards-single mt-5 ${tutorialStepId === 'run-setup' ? 'random-run-setup-summary-cards-tutorial' : ''}`}>
              <button
                type="button"
                className="random-run-setup-summary-card"
                onClick={() => setSetupPicker('length')}
              >
                <span className="random-run-setup-summary-icon">
                  {selectedLength.fixedBattles ? selectedLength.fixedBattles : 'Lv'}
                </span>
                <span className="random-run-setup-summary-copy">
                  <span className="arcane-label">Road Length</span>
                  <strong>{selectedLength.title}</strong>
                  <span>{selectedLength.fixedBattles ? `${selectedLength.fixedBattles} fights` : 'Scaled to run level'}</span>
                </span>
              </button>
            </div>
          </div>
        </div>

        {setupPicker && (
          <div className="random-run-setup-picker-backdrop" onClick={() => setSetupPicker(null)}>
            <div className="random-run-setup-picker command-panel vine-frame rounded border" onClick={(event) => event.stopPropagation()}>
              <div className="random-run-setup-picker-head">
                <div>
                  <span className="arcane-label">Run Setup</span>
                  <h3 className="fantasy-heading">Choose Road Length</h3>
                </div>
                <button type="button" className="ui-button rounded px-3 py-2 text-xs font-black" onClick={() => setSetupPicker(null)}>
                  Close
                </button>
              </div>

              <div className={`random-run-length-choice-grid ${tutorialStepId === 'run-setup' ? 'random-run-length-choice-row-tutorial' : ''}`}>
                {RUN_LENGTH_OPTIONS.map(option => {
                  const selected = option.id === selectedRunLength;
                  const locked = runState.runLevel < option.minRunLevel;
                  return (
                    <button
                      key={option.id}
                      type="button"
                      className={`random-run-length-choice-card ${selected ? 'random-run-length-choice-card-selected' : ''} ${locked ? 'random-run-length-choice-card-locked' : ''}`}
                      disabled={locked}
                      aria-disabled={locked}
                      onClick={() => {
                        if (locked) return;
                        setSelectedRunLength(option.id);
                        setSetupPicker(null);
                      }}
                    >
                      <span className="random-run-length-choice-card-label">{option.label}</span>
                      <strong>{option.title}</strong>
                      <span>{option.fixedBattles ? `${option.fixedBattles} fights` : 'Scaled road'}</span>
                      <em>{locked ? `Unlocks at run Lv ${option.minRunLevel}` : option.rewardMultiplier === 1 ? 'Normal rewards' : `${Math.round(option.rewardMultiplier * 100)}% run rewards`}</em>
                      <p>{option.description}</p>
                    </button>
                  );
                })}
              </div>
            </div>
          </div>
        )}

        {commanderDraftChoices && (
          <div className="random-run-commander-draft-backdrop" onClick={() => setCommanderDraftChoices(null)}>
            <section className="random-run-commander-draft run-draft-stage" onClick={(event) => event.stopPropagation()}>
              <section className="run-draft-hero random-run-commander-draft-hero relative overflow-hidden">
                <div className="relative z-10 max-w-xl">
                  <span className="arcane-label">Run Draft</span>
                  <h3 className="fantasy-heading mt-1">Choose Your Commander</h3>
                  <p className="ui-muted text-sm font-bold">
                    Pick one commander for this road. The offered captains change every run, and each one changes your starting stats and favored units.
                  </p>
                  <div className="run-draft-setup-summary mt-4">
                    <span>{selectedLength.title}</span>
                    <span>{selectedLength.fixedBattles ? `${selectedLength.fixedBattles} fights` : 'Scaled road'}</span>
                    <span>{Math.round(selectedLength.rewardMultiplier * 100)}% run rewards</span>
                  </div>
                </div>

                <div className="random-run-commander-draft-preview" aria-hidden>
                  {commanderDraftChoices.map((profile, index) => (
                    <span
                      key={profile.model}
                      className="random-run-commander-draft-preview-sprite"
                      style={{ '--commander-draft-index': index } as CSSProperties}
                    >
                      <Image src={getPlayerModelAsset(profile.model)} alt="" fill sizes="240px" className="object-contain object-bottom" unoptimized />
                    </span>
                  ))}
                </div>

                <div className="run-draft-counter random-run-commander-draft-counter relative z-10 text-center">
                  <span className="arcane-label block">Pick</span>
                  <strong className="fantasy-heading block text-2xl">1/4</strong>
                </div>
              </section>

              <section className="run-draft-choice-shell random-run-commander-draft-choice-shell rounded border p-4">
                <div className="run-draft-choice-header flex items-start justify-between gap-3">
                  <div>
                    <span className="arcane-label">Choose One</span>
                    <h4 className="fantasy-heading">Available Commanders</h4>
                  </div>
                  <button type="button" className="ui-button rounded px-3 py-2 text-xs font-black" onClick={() => setCommanderDraftChoices(null)}>
                    Back
                  </button>
                </div>

                <div className="run-draft-grid random-run-commander-draft-grid mt-4 grid gap-4">
                  {commanderDraftChoices.map(profile => (
                    <button
                      key={profile.model}
                      type="button"
                      className="run-draft-card random-run-commander-draft-card"
                      onClick={() => startCommanderDraftRun(profile)}
                    >
                      <span className="run-draft-card-art">
                        <span className="run-draft-recruit-frame random-run-commander-draft-frame">
                          <Image src={getPlayerModelAsset(profile.model)} alt="" fill sizes="280px" className="run-draft-recruit-sprite object-contain object-bottom" unoptimized />
                        </span>
                      </span>
                      <span className="run-draft-card-copy random-run-commander-draft-copy">
                        <span className="arcane-label">{profile.label}</span>
                        <strong className="fantasy-heading block">{profile.title}</strong>
                        <span className="random-run-commander-passive">{profile.passiveName}</span>
                        <span className="ui-muted block text-xs font-bold">{profile.passiveSummary}</span>
                        <span className="ui-pill mt-1 inline-flex justify-center rounded border px-2 py-1 text-[10px] font-black uppercase">
                          {profile.unitFocus.summary}
                        </span>
                      </span>
                    </button>
                  ))}
                </div>
              </section>
            </section>
          </div>
        )}

        <div className="random-run-lobby-body">
          {detailsOpen && lastRun && (
            <div className="random-run-log-popover">
              <div className="random-run-log-popover-head">
                <span className="arcane-label">Run Log</span>
                <button type="button" onClick={() => setDetailsOpen(false)} className="ui-button rounded px-2.5 py-1 text-[10px] font-black">
                  Close
                </button>
              </div>
              <div className="random-run-last-details space-y-2 text-xs font-bold">
                <RunHistoryLine label="Bosses" items={lastRun.bossesDefeated} fallback="No bosses defeated." />
                <RunHistoryLine label="Route" items={lastRun.routeSummary} fallback="No route history." />
                <RunHistoryLine label="Shop" items={lastRun.shopBuys} fallback="No shop purchases." />
                <RunHistoryLine label="Omens" items={lastRun.omens} fallback="No omens resolved." />
                <RunHistoryLine label="Unlocks" items={lastRun.unlockedSpellNames} fallback="No permanent spell unlock." />
              </div>
            </div>
          )}

          <section className="random-run-progression random-run-lobby-strip">
            <div className="random-run-strip-inner">
              <div className="random-run-strip-head">
                <span className="arcane-label">Run Progression</span>
                <strong className="fantasy-heading">Lv {runState.runLevel}</strong>
              </div>

              <div className="random-run-strip-xp">
                <div className="random-run-xp-track random-run-xp-track-compact" aria-hidden>
                  <div className="random-run-xp-fill" style={{ width: `${expPercent}%` }} />
                </div>
                <span className="random-run-strip-xp-label ui-value">
                  {runLevelCapped ? 'Max level' : `${runState.runExp} / ${expNeeded} Run XP`}
                </span>
              </div>

              <div className="random-run-strip-row">
                <div className="random-run-strip-meta">
                  <span className="run-header-chip" title="Total clears">
                    <Image src={RUN_COMPLETION_STAT_ICONS.score} alt="" width={18} height={18} className="run-header-chip-icon" unoptimized />
                    <span className="run-header-chip-value">{runState.completions} clears</span>
                  </span>
                  {runState.runUpgradePoints > 0 && (
                    <span className="run-header-chip" title="Upgrade points">
                      <Image src={RUN_COMPLETION_STAT_ICONS.xp} alt="" width={18} height={18} className="run-header-chip-icon" unoptimized />
                      <span className="run-header-chip-value">{runState.runUpgradePoints} pts</span>
                    </span>
                  )}
                </div>

                <div className="random-run-strip-bonuses">
                  {upgradeRows.map(row => (
                    <RunLobbyBonusPill
                      key={row.label}
                      icon={LOBBY_UPGRADE_ICONS[row.label] || RUN_COMPLETION_STAT_ICONS.wins}
                      label={row.label}
                      value={row.value}
                    />
                  ))}
                </div>
              </div>
            </div>
          </section>

          <section className="random-run-last-run random-run-lobby-strip">
            <div className="random-run-strip-inner">
              <div className="random-run-strip-head">
                <span className="arcane-label">Last Run</span>
                <strong className="fantasy-heading truncate">
                  {lastRun?.challengeName || 'No run yet'}
                </strong>
              </div>

              {lastRun ? (
                <>
                  <div className="random-run-strip-stats">
                    <span className={`random-run-outcome-pill ui-pill rounded border px-2.5 py-1 text-[11px] font-black uppercase${lastRunCleared ? ' random-run-outcome-pill-cleared' : ''}`}>
                      {lastRunCleared ? 'Cleared' : 'Ended'}
                    </span>
                    <span className="run-header-chip" title="Battles won">
                      <Image src={RUN_COMPLETION_STAT_ICONS.wins} alt="" width={18} height={18} className="run-header-chip-icon" unoptimized />
                      <span className="run-header-chip-value">{lastRun.wins}/{lastRun.targetBattles}</span>
                    </span>
                    <span className="run-header-chip" title="Duration">
                      <Image src={RUN_COMPLETION_STAT_ICONS.time} alt="" width={18} height={18} className="run-header-chip-icon" unoptimized />
                      <span className="run-header-chip-value">{formatRunDuration(lastRun.durationMs || 0)}</span>
                    </span>
                    <span className="run-header-chip" title="Run XP earned">
                      <Image src={RUN_COMPLETION_STAT_ICONS.xp} alt="" width={18} height={18} className="run-header-chip-icon" unoptimized />
                      <span className="run-header-chip-value">{lastRun.exp}</span>
                    </span>
                    <span className="run-header-chip run-header-chip-gold" title="Score">
                      <Image src={RUN_COMPLETION_STAT_ICONS.score} alt="" width={18} height={18} className="run-header-chip-icon" unoptimized />
                      <span className="run-header-chip-value">{lastRun.score || 0}</span>
                    </span>
                  </div>
                  <button
                    type="button"
                    onClick={() => setDetailsOpen(open => !open)}
                    className={`random-run-log-btn ui-button rounded px-4 py-2 text-xs font-black${detailsOpen ? ' random-run-log-btn-open' : ''}`}
                  >
                    View Log
                  </button>
                </>
              ) : (
                <p className="random-run-strip-empty ui-muted font-bold">
                  No history yet — start a run above.
                </p>
              )}
            </div>
          </section>
        </div>
        </section>
      </div>
    );
  }

export function getRandomLobbyBossPreview() {
  const previousIndex = typeof window === 'undefined'
    ? -1
    : Number(window.sessionStorage.getItem(RANDOM_RUN_LOBBY_BOSS_KEY) || -1);
  let nextIndex = Math.floor(Math.random() * RANDOM_RUN_LOBBY_BOSS_COUNT);

  if (nextIndex === previousIndex) {
    nextIndex = (nextIndex + 1 + Math.floor(Math.random() * (RANDOM_RUN_LOBBY_BOSS_COUNT - 1))) % RANDOM_RUN_LOBBY_BOSS_COUNT;
  }

  if (typeof window !== 'undefined') {
    window.sessionStorage.setItem(RANDOM_RUN_LOBBY_BOSS_KEY, String(nextIndex));
  }

  return getBossProfileByIndex(nextIndex);
}

function RunHistoryLine({ label, items, fallback }: { label: string; items?: string[]; fallback: string }) {
  return (
    <div className="random-run-last-detail-row rounded border p-3">
      <div className="arcane-label">{label}</div>
      <div className="ui-muted mt-1 leading-relaxed">{items && items.length > 0 ? items.slice(0, 6).join(' → ') : fallback}</div>
    </div>
  );
}

export function DungeonRunModal({ dungeon, currentUser, now, onClose }: DungeonRunModalProps) {
  void now;
  const [session, setSession] = useState<RunSession | null>(() => currentUser ? createDungeonSession(currentUser, dungeon) : null);

  if (!session) return null;

  return (
    <RunController
      session={session}
      setSession={setSession}
      onClose={onClose}
    />
  );
}

export function EncounterRunModal({ enemy, currentUser, onClose }: EncounterRunModalProps) {
  const [session, setSession] = useState<RunSession | null>(() => currentUser ? createEncounterSession(currentUser, enemy) : null);

  if (!session) return null;

  return (
    <RunController
      session={session}
      setSession={setSession}
      onClose={onClose}
    />
  );
}

interface MpDailyDungeonModalProps {
  isOpen: boolean;
  onClose: () => void;
}

export function MpDailyDungeonModal({ isOpen, onClose }: MpDailyDungeonModalProps) {
  const [session, setSession] = useState<RunSession | null>(null);
  const user = getCurrentUser();
  const username = user?.username;

  useEffect(() => {
    const timer = window.setTimeout(() => {
      const currentUser = getCurrentUser();
      if (!isOpen || !currentUser || hasCompletedMpDailyDungeonToday(currentUser)) {
        setSession(null);
        return;
      }
      setSession(createMpDailySession(currentUser, getMpDailyDungeonChallenge()));
    }, 0);

    return () => window.clearTimeout(timer);
  }, [isOpen, username]);

  if (!isOpen || !session) return null;

  return (
    <RunController
      session={session}
      setSession={setSession}
      onClose={onClose}
    />
  );
}

function RunController({
  session,
  setSession,
  onClose,
  tutorialScope,
}: {
  session: RunSession;
  setSession: (updater: RunSession | ((current: RunSession | null) => RunSession | null)) => void;
  onClose: () => void;
  tutorialScope?: RunTutorialScope;
}) {
  const aliveStacks = getRunFieldedStacks(session);
  const [dismissedTutorialStepIds, setDismissedTutorialStepIds] = useState<Set<SingleplayerRunTutorialStepId>>(() => new Set());
  const [, setTutorialRefreshKey] = useState(0);
  const previousPhaseRef = useRef<RunPhase | null>(null);
  const completionIntroTimeoutRef = useRef<number | null>(null);
  const emittedCelebrationsRef = useRef<Set<string>>(new Set());
  const triggerCompletionIntroRef = useRef<() => void>(() => {});
  const [completionView, setCompletionView] = useState<'defeat-burst' | 'report' | null>(null);
  const [formationIntro, setFormationIntro] = useState<{
    key: string;
    commanderName: string;
    enemyName: string;
    artworkPath: string;
  } | null>(null);
  const [retreatConfirmOpen, setRetreatConfirmOpen] = useState(false);
  const isFormationPhase = session.phase === 'formation';
  const isMapPhase = session.phase === 'map';
  const isDraftPhase = session.phase === 'draft';
  const isCompletePhase = session.phase === 'complete';
  const isRunIntermissionPhase = session.phase === 'reward' || session.phase === 'shop' || session.phase === 'event';
  const username = getCurrentUser()?.username || null;
  const nextTutorialStep = getSingleplayerRunTutorialStepForSession(session, tutorialScope || 'none', username);
  const tutorialStep = nextTutorialStep && !dismissedTutorialStepIds.has(nextTutorialStep.id)
    ? nextTutorialStep
    : null;
  const rewardPickTutorialActive = nextTutorialStep?.id === 'reward' && dismissedTutorialStepIds.has('reward');
  const shopPurchaseTutorialActive = nextTutorialStep?.id === 'shop' && dismissedTutorialStepIds.has('shop');

  const handleTutorialContinue = (stepId: SingleplayerRunTutorialStepId) => {
    markSingleplayerRunTutorialStepSeen(username, stepId);
    setDismissedTutorialStepIds(current => {
      const next = new Set(current);
      next.add(stepId);
      return next;
    });
    setTutorialRefreshKey(key => key + 1);
  };

  const handleTutorialIntroContinue = (stepId: SingleplayerRunTutorialStepId) => {
    if (stepId !== 'reward' && stepId !== 'shop') {
      handleTutorialContinue(stepId);
      return;
    }

    setDismissedTutorialStepIds(current => {
      const next = new Set(current);
      next.add(stepId);
      return next;
    });
  };

  const handleTutorialSkip = () => {
    skipSingleplayerRunTutorial(username);
    setDismissedTutorialStepIds(new Set(SINGLEPLAYER_RUN_TUTORIAL_STEP_IDS));
    setTutorialRefreshKey(key => key + 1);
  };

  useEffect(() => {
    if (tutorialScope !== 'singleplayer') return undefined;
    const handleTutorialReset = () => {
      setDismissedTutorialStepIds(new Set());
      setTutorialRefreshKey(key => key + 1);
    };
    window.addEventListener(SINGLEPLAYER_RUN_TUTORIAL_RESET_EVENT, handleTutorialReset);
    return () => window.removeEventListener(SINGLEPLAYER_RUN_TUTORIAL_RESET_EVENT, handleTutorialReset);
  }, [tutorialScope]);

  useEffect(() => {
    document.body.classList.add('daily-run-open');
    window.dispatchEvent(new Event('wizardy:force-main-screen'));
    return () => document.body.classList.remove('daily-run-open');
  }, []);

  useEffect(() => {
    if (previousPhaseRef.current === session.phase) return;
    previousPhaseRef.current = session.phase;

    if (session.phase === 'draft') {
      emitFxEvent({ type: 'daily', tone: 'blue', intensity: 0.58 });
    } else if (session.phase === 'map') {
      emitFxEvent({
        type: session.mode === 'dungeon' ? 'dungeon' : session.mode === 'encounter' ? 'attack' : 'daily',
        tone: session.mode === 'dungeon' ? 'violet' : session.mode === 'encounter' ? 'red' : 'blue',
        intensity: 0.5,
      });
    } else if (session.phase === 'formation') {
      emitFxEvent({ type: 'defense', tone: 'blue', intensity: 0.48 });
    } else if (session.phase === 'battle') {
      emitFxEvent({ type: 'attack', tone: 'red', intensity: 0.62 });
    } else if (session.phase === 'reward') {
      emitFxEvent({ type: 'victory', tone: 'gold', intensity: 0.78 });
    } else if (session.phase === 'shop') {
      emitFxEvent({ type: 'city', tone: 'gold', intensity: 0.58 });
    } else if (session.phase === 'event') {
      emitFxEvent({ type: 'status', tone: 'violet', intensity: 0.58 });
    } else if (session.phase === 'complete') {
      emitFxEvent({ type: session.outcome === 'defeat' ? 'defeat' : 'run', tone: session.outcome === 'defeat' ? 'red' : 'gold', intensity: 0.98 });
    }
  }, [session.mode, session.outcome, session.phase]);

  useEffect(() => () => {
    if (completionIntroTimeoutRef.current) window.clearTimeout(completionIntroTimeoutRef.current);
  }, []);

  useEffect(() => {
    if (!['map', 'shop', 'reward', 'event'].includes(session.phase) || !session.pendingRunCelebrations?.length) return;
    const celebrations = session.pendingRunCelebrations.filter(item => !emittedCelebrationsRef.current.has(item.id));
    if (celebrations.length === 0) return;

    celebrations.forEach(item => emittedCelebrationsRef.current.add(item.id));
    emitRunCelebrations(celebrations);

    setSession(current => current && current.id === session.id
      ? { ...current, pendingRunCelebrations: [] }
      : current);
  }, [session.id, session.pendingRunCelebrations, session.phase, setSession]);

  useEffect(() => {
    return subscribeCompletionOverlayIdle(() => {
      setSession(current => {
        if (!current?.celebrationResume) return current;
        return { ...current.celebrationResume, celebrationResume: undefined };
      });
    });
  }, [setSession]);

  useEffect(() => {
    if (session.phase !== 'complete' || session.outcome !== 'victory' || session.celebrationResume || session.rewardClaimed) return;
    if (completionView) return;
    triggerCompletionIntroRef.current();
  }, [completionView, session.celebrationResume, session.outcome, session.phase, session.rewardClaimed]);

  useEffect(() => {
    let introTimer: number | null = null;
    let clearTimer: number | null = null;

    if (session.phase !== 'formation' || !session.activeEnemy) {
      introTimer = window.setTimeout(() => setFormationIntro(null), 0);
      return () => {
        if (introTimer) window.clearTimeout(introTimer);
      };
    }

    const user = getCurrentUser();
    const key = `${session.id}:${session.currentNodeIndex}:${session.activeEnemy.id}`;
    introTimer = window.setTimeout(() => {
      setFormationIntro({
        key,
        commanderName: user?.username || 'Commander',
        enemyName: session.activeEnemy?.name || 'Enemy Commander',
        artworkPath: getPlayerModelAsset(session.commanderModel || user?.selectedModel || 3),
      });

      clearTimer = window.setTimeout(() => {
        setFormationIntro(current => current?.key === key ? null : current);
      }, RUN_FORMATION_INTRO_MS);
    }, 0);

    return () => {
      if (introTimer) window.clearTimeout(introTimer);
      if (clearTimer) window.clearTimeout(clearTimer);
    };
  }, [session.activeEnemy, session.commanderModel, session.currentNodeIndex, session.id, session.phase]);

  useEffect(() => {
    let immediateTimer: number | null = null;
    const scheduleView = (view: typeof completionView) => {
      immediateTimer = window.setTimeout(() => setCompletionView(view), 0);
    };

    if (session.phase !== 'complete') {
      scheduleView(null);
      return () => {
        if (immediateTimer) window.clearTimeout(immediateTimer);
      };
    }

    if (session.outcome === 'victory') {
      scheduleView('report');
      return () => {
        if (immediateTimer) window.clearTimeout(immediateTimer);
      };
    }

    scheduleView('defeat-burst');
    completionIntroTimeoutRef.current = window.setTimeout(() => {
      setCompletionView('report');
      completionIntroTimeoutRef.current = null;
    }, RUN_DEFEAT_BURST_MS);

    return () => {
      if (immediateTimer) window.clearTimeout(immediateTimer);
      if (completionIntroTimeoutRef.current) {
        window.clearTimeout(completionIntroTimeoutRef.current);
        completionIntroTimeoutRef.current = null;
      }
    };
  }, [session.id, session.outcome, session.phase]);

  const triggerCompletionIntro = () => {
    if (completionIntroTimeoutRef.current) {
      window.clearTimeout(completionIntroTimeoutRef.current);
      completionIntroTimeoutRef.current = null;
    }
    setCompletionView('report');
  };

  useEffect(() => {
    triggerCompletionIntroRef.current = triggerCompletionIntro;
  });

  useEffect(() => {
    if (!isCompletePhase) return;

    const handleKeyDown = (event: KeyboardEvent) => {
      if (event.key !== 'Escape') return;
      if (session.outcome === 'victory' && !session.rewardClaimed) return;
      onClose();
    };

    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [isCompletePhase, onClose, session.outcome, session.rewardClaimed]);

  const handleBattleEnd = (result: BattleEndResult) => {
    setSession(current => {
      if (!current || current.activeEnemy?.id !== result.battle.enemy.id) return current;

      const withBattleHealth = persistRunBattleHealth(current, result.battle);
      const withLosses = appendRunBattleReport(
        applyBattleLossesToRun(withBattleHealth, result.battle),
        createRunBattleReport(result.battle, result.status)
      );
      if (result.status !== 'victory') {
        return {
          ...withLosses,
          phase: 'complete',
          activeEnemy: null,
          outcome: result.retreated ? 'abandoned' : 'defeat',
          rewardChoices: [],
          rewardDestination: null,
          notice: result.retreated
            ? 'The warband withdrew. This attempt ends here.'
            : 'The run ended in defeat.',
        };
      }

      const nextWins = withLosses.wins + 1;
      const clearedNode = withLosses.nodes[withLosses.currentNodeIndex];
      const hardRouteCleared = clearedNode?.type === 'elite';
      const withHardRouteBonus = hardRouteCleared ? applyHardRouteVictoryBonus(withLosses) : withLosses;
      const isBossFight = clearedNode?.type === 'boss';
      const bonusGearDrop = !isWorldMapRun(withLosses) && !isBossFight && Math.random() < 0.33
        ? generateRunLootEquipment(nextWins, withHardRouteBonus.targetBattles, undefined, {
            maxRarity: getRunGearRarityCap(withHardRouteBonus),
          })
        : null;
      const withBonusGear = bonusGearDrop
        ? addRunEquipment(withHardRouteBonus, bonusGearDrop)
        : withHardRouteBonus;
      const rewardDestination = getRewardDestination(withBonusGear, nextWins);
      const goldEarned = getRunGoldEarned(withBonusGear, result.battle);
      const permanentUnlock = maybeUnlockPermanentRunSpell(withBonusGear);
      const noticeParts = [
        hardRouteCleared
          ? `${result.battle.enemy.name} defeated. +${goldEarned} run gold. Hard-route boon gained; a clean omen waits after the reward.`
          : `${result.battle.enemy.name} defeated. +${goldEarned} run gold. Choose a run reward.`,
        bonusGearDrop ? `${bonusGearDrop.name} dropped into your run satchel.` : '',
        permanentUnlock ? `${permanentUnlock} permanently unlocked.` : '',
      ].filter(Boolean);
      const updatedBossHistory = clearedNode?.type === 'boss'
        ? [...(withBonusGear.bossHistory || []), clearedNode.label]
        : withBonusGear.bossHistory || [];
      const updatedPermanentSpellUnlocks = permanentUnlock
        ? [...(withBonusGear.permanentSpellUnlocks || []), permanentUnlock]
        : withBonusGear.permanentSpellUnlocks || [];
      const runGoldAfterBattle = withHardRouteBonus.runGold + goldEarned;
      const completedBattleSession: RunSession = {
        ...withBonusGear,
        activeEnemy: null,
        wins: nextWins,
        runGold: runGoldAfterBattle,
        rewardDestination,
        bossHistory: updatedBossHistory,
        permanentSpellUnlocks: updatedPermanentSpellUnlocks,
        notice: noticeParts.join(' '),
      };

      if (
        completedBattleSession.mode === 'daily'
        && isBossFight
        && rewardDestination === 'dungeon-next'
      ) {
        const bossRecruitSource = {
          id: `boss-gate-tier3-${clearedNode?.id || completedBattleSession.wins}`,
          name: 'Boss Gate Recruit',
        };
        const withBossRecruit = queueRunRewardCelebrations(
          completedBattleSession,
          addGuaranteedRandomRunMinion(
            completedBattleSession,
            'tier3',
            'A tier III veteran joins before the last boss.'
          ),
          bossRecruitSource
        );

        return completeDungeonNode({
          ...withBossRecruit,
          rewardChoices: [],
          rewardDestination: null,
          notice: `${result.battle.enemy.name} defeated. +${goldEarned} run gold. A tier III veteran joins before the last boss.`,
        });
      }

      if (completedBattleSession.mode === 'daily' && rewardDestination === 'complete') {
        const completed = completedBattleSession.nodes.length > 0
          ? completeDungeonNode({
            ...completedBattleSession,
            rewardChoices: [],
            rewardDestination: null,
          })
          : completedBattleSession;

        return {
          ...completed,
          activeEnemy: null,
          phase: 'complete',
          outcome: 'victory',
          rewardChoices: [],
          rewardDestination: null,
          notice: `${result.battle.enemy.name} defeated. +${goldEarned} run gold. The random road is complete.`,
        };
      }

      return {
        ...completedBattleSession,
        phase: 'reward',
        rewardChoices: pickRunRewardChoices(withHardRouteBonus),
      };
    });
  };

  const handleRewardChoice = (choice: RunRewardChoice) => {
    if (rewardPickTutorialActive) handleTutorialContinue('reward');
    setSession(current => {
      if (!current) return current;
      const applied = queueRunRewardCelebrations(current, choice.apply(current), choice);

      let resumeTarget: RunSession;

      if (applied.rewardDestination === 'complete') {
        const completed = applied.nodes.length > 0
          ? completeDungeonNode({
            ...applied,
            rewardChoices: [],
            rewardDestination: null,
          })
          : applied;

        resumeTarget = {
          ...completed,
          phase: 'complete',
          outcome: 'victory',
          rewardChoices: [],
          rewardDestination: null,
          notice: 'The final reward is ready.',
        };
      } else if (applied.rewardDestination === 'dungeon-next') {
        if (applied.pendingPositiveOmen) {
          resumeTarget = {
            ...applied,
            phase: 'event',
            rewardChoices: [],
            rewardDestination: null,
            notice: 'The hard route opens a clean omen.',
          };
        } else {
          resumeTarget = completeDungeonNode({
            ...applied,
            rewardChoices: [],
            rewardDestination: null,
            notice: `${choice.name} claimed.`,
          });
        }
      } else {
        resumeTarget = {
          ...applied,
          phase: 'map',
          rewardChoices: [],
          rewardDestination: null,
          notice: `${choice.name} claimed.`,
        };
      }

      return holdSessionForCelebrations(
        {
          ...applied,
          rewardChoices: [],
          rewardDestination: null,
        },
        resumeTarget,
        'reward',
      );
    });
  };

  const handleClaimCompletion = () => {
    if (!session || session.rewardClaimed) return;
    const notice = grantCompletionReward(session);
    const completedAt = Date.now();
    const isDungeon = session.mode === 'dungeon';
    const isEncounter = session.mode === 'encounter';
    const isMpDaily = session.mode === 'mpDaily';
    const rewards: CompletionRewardLine[] = [
      { label: 'Wins', value: `${session.wins}/${session.targetBattles}`, tone: 'blue' },
      { label: 'Standing', value: `${getAliveRunRoster(session).length}/${session.minions.length}`, tone: 'green' },
      { label: 'Run Gold', value: String(session.runGold), tone: 'gold' },
    ];

    if (session.mode === 'encounter' && session.outcome === 'victory') {
      completeMultiplayerTutorialCallout(getCurrentUser()?.username, 'battle-result-claim');
      recordCurrentMultiplayerEngagementEvent({
        id: `battle-result-claimed:${session.id}`,
        kind: 'battle-result-claimed',
        occurredAt: completedAt,
        contextId: session.encounterEnemy?.spawnRegionId || 'world-encounter',
        targetId: session.encounterEnemy?.id || session.id,
      }, completedAt);
      if (session.encounterEnemy?.bossId) {
        recordCurrentMultiplayerEngagementEvent({
          id: `boss-defeated:${session.encounterEnemy.bossId}:${session.id}`,
          kind: 'boss-defeated',
          occurredAt: completedAt,
          contextId: session.encounterEnemy.spawnRegionId || 'world-boss',
          targetId: session.encounterEnemy.bossId,
        }, completedAt);
      }
    } else if ((session.mode === 'dungeon' || session.mode === 'mpDaily') && session.outcome === 'victory') {
      recordCurrentMultiplayerEngagementEvent({
        id: `dungeon-cleared:${session.id}`,
        kind: 'dungeon-cleared',
        occurredAt: completedAt,
        contextId: session.mode,
        targetId: session.dungeon?.id || session.id,
      }, completedAt);
    }
    setSession({ ...session, rewardClaimed: true, notice });

    if (session.outcome === 'victory') {
      emitFxEvent({ type: 'run', tone: 'gold', intensity: 1.25 });
      emitCompletionNotice({
        id: `run-completion-${session.id}-${completedAt}`,
        kind: isEncounter ? 'victory' : 'run',
        kicker: isMpDaily ? 'Daily Gauntlet' : isEncounter ? 'Enemy Road Cleared' : isDungeon ? 'Dungeon Cleared' : 'Run Complete',
        title: isMpDaily ? `${session.title} Cleared` : isEncounter ? `${session.title} Defeated` : isDungeon ? `${session.title} Cleared` : 'Run Complete',
        description: notice,
        artworkPath: session.encounterEnemy?.artworkPath,
        rewards,
        completedAt,
      });
      window.setTimeout(onClose, 900);
    }
  };

  const handleStartFormation = () => {
    const aliveUnits = getAliveRunRoster(session);
    const formation = mergeFormation(aliveUnits, session.formation, MAX_FIELD_MINIONS);
    const issue = getRunFormationIssue(session, formation);

    if (issue) {
      setSession({ ...session, formation, notice: issue });
      return;
    }

    if (session.mode === 'encounter') {
      completeMultiplayerTutorialCallout(getCurrentUser()?.username, 'formation-confirm');
    }
    setSession({ ...session, formation, phase: 'battle', notice: undefined });
  };

  if (session.phase === 'battle' && session.activeEnemy) {
    return (
      <BattleModal
        key={session.activeEnemy.id}
        enemy={session.activeEnemy}
        playerStacks={aliveStacks}
        playerStats={session.stats}
        playerModelNumber={session.commanderModel}
        playerFormation={session.formation}
        availableSpellIds={session.spellIds}
        persistentResults={false}
        contextLabel={getRunBattleContextLabel(session)}
        tutorialStep={tutorialStep}
        onTutorialContinue={handleTutorialContinue}
        onTutorialSkip={handleTutorialSkip}
        onBattleEnd={handleBattleEnd}
        onClose={() => setSession(current => current ? abandonRunCombat(current) : current)}
      />
    );
  }

  const formationStackHealth = session.phase === 'formation'
    ? Object.fromEntries(session.minions.map(unit => [
      unit.stack.id,
      {
        current: getRunUnitCurrentHealthForSession(session, unit),
        max: getRunUnitMaxHealthForSession(session, unit),
      },
    ]))
    : undefined;

  return (
    <div
      className={`run-modal-layer fixed inset-0 z-[68] flex items-center justify-center bg-black/76 text-zinc-100 backdrop-blur-sm ${isMapPhase || isFormationPhase || isDraftPhase || isCompletePhase || isRunIntermissionPhase ? 'p-1' : 'p-4'}`}
      onClick={(event) => {
        if (!isCompletePhase || event.target !== event.currentTarget) return;
        if (session.outcome === 'victory' && !session.rewardClaimed) return;
        onClose();
      }}
    >
      <section className={`run-modal-panel command-panel vine-frame flex w-full flex-col overflow-hidden rounded border ${isFormationPhase ? 'run-formation-modal h-[calc(100vh-0.5rem)] max-h-[calc(100vh-0.5rem)] max-w-none' : isMapPhase ? 'run-map-modal h-[calc(100vh-0.5rem)] max-h-[calc(100vh-0.5rem)] max-w-none' : isDraftPhase ? 'run-draft-modal h-[calc(100vh-0.5rem)] max-h-[calc(100vh-0.5rem)] max-w-none' : isCompletePhase ? 'run-completion-modal random-run-lobby h-[calc(100vh-0.5rem)] max-h-[calc(100vh-0.5rem)] max-w-none' : isRunIntermissionPhase ? 'run-reward-modal random-run-lobby h-[calc(100vh-0.5rem)] max-h-[calc(100vh-0.5rem)] max-w-none' : 'max-h-[94vh] max-w-6xl'}`}>
        {session.notice && session.phase !== 'complete' && session.mode !== 'daily' && (
          <div className={`ui-notice border-b font-bold ${isMapPhase || isFormationPhase ? 'run-map-notice px-3 py-1.5 text-[11px]' : 'px-5 py-3 text-sm'}`}>
            {session.notice}
          </div>
        )}
        {formationIntro && <RunFormationIntroSplash intro={formationIntro} />}
        {tutorialStep && (
          <SingleplayerTutorialOverlay
            key={tutorialStep.id}
            step={tutorialStep}
            playerModelNumber={session.commanderModel}
            onContinue={() => handleTutorialIntroContinue(tutorialStep.id)}
            onSkip={handleTutorialSkip}
          />
        )}

        <div className={`grid min-h-0 flex-1 ${isFormationPhase ? 'overflow-hidden p-2' : isCompletePhase ? 'run-completion-layout overflow-hidden' : isRunIntermissionPhase ? 'run-reward-layout overflow-hidden' : isMapPhase ? 'run-map-layout gap-3 overflow-hidden p-2 lg:grid-cols-[20rem_minmax(0,1fr)]' : isDraftPhase ? 'run-draft-layout overflow-hidden p-2' : 'gap-5 overflow-y-auto p-5 lg:grid-cols-[20rem_minmax(0,1fr)]'}`}>
          {!isFormationPhase && !isDraftPhase && !isCompletePhase && !isRunIntermissionPhase && (
            <RunRoster
              session={session}
              variant={isMapPhase ? 'map' : 'default'}
              onEquipGear={(equipmentId) => setSession(current => current ? equipRunItem(current, equipmentId) : current)}
              onUnequipGear={(slot) => setSession(current => current ? unequipRunItem(current, slot) : current)}
            />
          )}

          <main className={`relative min-h-0 ${isCompletePhase || isRunIntermissionPhase ? 'h-full' : ''}`}>
            {session.celebrationResume && (
              <div className="run-celebration-hold" aria-hidden />
            )}

            {session.phase === 'draft' && (
              <DailyDraftPanel
                session={session}
                onPick={(template) => setSession(current => current ? addDraftMinion(current, template) : current)}
              />
            )}

            {session.phase === 'map' && (
              <RunMapPanel
                session={session}
                routeTutorialActive={tutorialStep?.id === 'route-map'}
                onStartDaily={() => setSession(current => current ? startDailyBattle(current) : current)}
                onSelectDungeonNode={(node) => setSession(current => current ? startDungeonNode(current, node) : current)}
              />
            )}

            {session.phase === 'formation' && session.activeEnemy && (
              <FormationPanel
                enemyName={session.activeEnemy.name}
                enemySubtitle={session.activeEnemy.subtitle}
                commanderName={getCurrentUser()?.username || 'Commander'}
                commanderModel={session.commanderModel}
                stacks={getAliveRunRoster(session)}
                stackHealth={formationStackHealth}
                maxFielded={MAX_FIELD_MINIONS}
                formation={session.formation}
                spellIds={session.spellIds}
                knownSpellIds={session.knownSpellIds}
                organizedRoster={session.mode !== 'daily'}
                onChangeFormation={(formation) => setSession(current => current ? { ...current, formation } : current)}
                onChangeSpellIds={(spellIds) => setSession(current => current ? { ...current, spellIds: spellIds.slice(0, 4) } : current)}
                onStart={handleStartFormation}
                onBack={() => setSession(current => current ? { ...current, phase: 'map', activeEnemy: null, notice: undefined } : current)}
              />
            )}

            {session.phase === 'reward' && !session.celebrationResume && (
              <RewardPanel
                session={session}
                choices={session.rewardChoices}
                tutorialActive={rewardPickTutorialActive}
                onReroll={() => setSession(current => current ? rerollRewardChoices(current) : current)}
                onChoose={handleRewardChoice}
              />
            )}

            {session.phase === 'shop' && (
              <ShopPanel
                session={session}
                tutorialActive={shopPurchaseTutorialActive}
                onBuy={(offerIndex, choice, cost) => {
                  if (shopPurchaseTutorialActive) handleTutorialContinue('shop');
                  setSession(current => current ? buyShopReward(current, offerIndex, choice, cost) : current);
                }}
                onReroll={() => setSession(current => current ? rerollShopOffers(current) : current)}
                onSkip={() => setSession(current => current ? completeDungeonNode({ ...current, phase: 'map', notice: 'The shop fades behind you.' }) : current)}
              />
            )}

            {session.phase === 'event' && !session.celebrationResume && (
              <OmenPanel
                key={`${session.id}:${session.currentNodeIndex}`}
                session={session}
                onReroll={() => setSession(current => current ? rerollOmen(current) : current)}
                onComplete={(outcome) => setSession(current => current ? applyDungeonEventOutcome(current, outcome) : current)}
              />
            )}

            {session.phase === 'complete' && (
              completionView === 'defeat-burst' ? (
                <RunDefeatBurst session={session} />
              ) : completionView === 'report' ? (
                <CompletionPanel
                  session={session}
                  onClaim={handleClaimCompletion}
                  onClose={onClose}
                />
              ) : null
            )}
          </main>
        </div>
        {isMapPhase && (
          <button
            type="button"
            onClick={() => setRetreatConfirmOpen(true)}
            className="run-map-retreat-button ui-button-danger"
          >
            Retreat
          </button>
        )}
      </section>
      {retreatConfirmOpen && (
        <div className="run-retreat-confirm-layer" onMouseDown={() => setRetreatConfirmOpen(false)}>
          <CinematicScrollShell
            variant="compact"
            className="run-retreat-confirm-scroll w-[min(30rem,calc(100vw-1rem))]"
            contentClassName="p-4"
            onMouseDown={(event) => event.stopPropagation()}
          >
            <p className="arcane-label">End Attempt</p>
            <h3 className="fantasy-heading mt-1 text-xl">Retreat from this road?</h3>
            <p className="ui-muted mt-2 text-sm font-bold">The run ends now and unclaimed run rewards are lost.</p>
            <div className="mt-4 flex justify-end gap-2">
              <button type="button" onClick={() => setRetreatConfirmOpen(false)} className="ui-button rounded px-4 py-2 text-xs font-black">
                Stay
              </button>
              <button
                type="button"
                onClick={() => {
                  setRetreatConfirmOpen(false);
                  setSession(current => current ? abandonRunCombat(current) : current);
                }}
                className="ui-button-danger rounded px-4 py-2 text-xs font-black"
              >
                End Run
              </button>
            </div>
          </CinematicScrollShell>
        </div>
      )}
    </div>
  );
}

function DailyDraftPanel({ session, onPick }: { session: RunSession; onPick: (template: MinionTemplate) => void }) {
  const rosterCount = session.minions.length;
  const remaining = Math.max(0, MAX_FIELD_MINIONS - rosterCount);
  const { spriteWidth: rosterSpriteWidth, spriteStep: rosterSpriteStep } = getRunRosterSpriteLayout(rosterCount, 'compact');

  return (
    <div className="run-draft-stage min-h-0">
      <section className="run-draft-hero relative min-h-0 overflow-hidden p-4 sm:p-5">
        <div className="relative z-10 max-w-xl">
          <div className="arcane-label">Run Draft</div>
          <h3 className="fantasy-heading mt-1 text-2xl sm:text-3xl">Choose Your Warband</h3>
          <p className="ui-muted mt-1.5 max-w-lg text-xs font-bold leading-relaxed sm:text-sm">
            Pick seven temporary units for this road. Choices refresh after every pick.
          </p>
          <p className="run-draft-hero-status ui-faint mt-1.5 text-[11px] font-bold sm:text-xs">
            {remaining > 0 ? `${remaining} pick${remaining === 1 ? '' : 's'} remaining` : 'Warband ready — the road awaits.'}
          </p>
          <div className="run-draft-setup-summary mt-3">
            <span>{session.runLengthName || 'Standard Road'}</span>
            <span>{session.commanderPassiveName || 'Commander Passive'}: {session.commanderPassiveSummary || 'Run-only commander bonus active.'}</span>
          </div>
        </div>

        <div className="run-draft-counter relative z-10 rounded border px-3 py-2 text-right sm:px-4 sm:py-3">
          <div className="ui-faint text-[10px] font-black uppercase">Picked</div>
          <div className="ui-value text-xl font-black sm:text-2xl">{rosterCount}/{MAX_FIELD_MINIONS}</div>
        </div>

        <div
          className="run-draft-hero-roster run-draft-hero-roster-compact"
          data-count={rosterCount}
          aria-label={`Warband ${rosterCount} of ${MAX_FIELD_MINIONS}`}
        >
          {session.minions.map((unit, index) => {
            const template = getMinionTemplate(unit.stack.templateId);
            if (!template) return null;

            return (
              <div
                key={unit.stack.id}
                className="run-draft-hero-sprite-wrap"
                style={{
                  zIndex: index + 1,
                  right: `${index * rosterSpriteStep}%`,
                  width: `${rosterSpriteWidth}%`,
                }}
                title={template.name}
              >
                <Image
                  src={`${MINION_ICON_BASE}/${template.assetName}`}
                  alt={template.name}
                  fill
                  sizes="512px"
                  className="run-draft-hero-sprite object-contain object-bottom"
                  unoptimized
                />
              </div>
            );
          })}
        </div>
      </section>

      <section className="run-draft-choice-shell min-h-0 p-2.5 sm:p-3">
        <div className="run-draft-choice-header mb-2 flex flex-wrap items-end justify-between gap-2">
          <div>
            <div className="arcane-label">Choose One</div>
            <h4 className="fantasy-heading text-lg sm:text-xl">Available Recruits</h4>
          </div>
          <span className="ui-pill rounded border px-2.5 py-0.5 text-[10px] font-black sm:text-xs">New choices after each pick</span>
        </div>

        <div className="run-draft-grid grid min-h-0 gap-2 sm:grid-cols-2 xl:grid-cols-4">
        {session.draftChoices.map((template, index) => (
          <button
            key={`${template.templateId}-${index}`}
            onClick={() => onPick(template)}
              className={`run-draft-card run-draft-card-${template.tier} h-full text-left transition`}
              aria-label={`Pick ${template.name}. ${MINION_TIER_LABELS[template.tier]} ${MINION_CLASS_LABELS[template.class]}.`}
            >
              <span className="run-draft-card-art relative block min-h-0 flex-1">
                <span className="run-draft-recruit-frame">
                  <Image
                    src={`${MINION_ICON_BASE}/${template.assetName}`}
                    alt=""
                    fill
                    sizes="512px"
                    className="run-draft-recruit-sprite object-contain object-bottom"
                    unoptimized
                  />
                </span>
              </span>
              <span className="run-draft-card-copy block shrink-0">
                <span className="fantasy-heading block text-sm sm:text-base">{template.name}</span>
                <span className="run-draft-card-tierline ui-muted mt-0.5 block text-[10px] font-bold sm:text-xs">
                  {MINION_TIER_LABELS[template.tier]} {MINION_CLASS_LABELS[template.class]}
                </span>
              </span>
          </button>
        ))}
      </div>
      </section>
    </div>
  );
}

function getRunModeTitle(session: RunSession): string {
  if (session.mode === 'dungeon') return 'Dungeon Run';
  if (session.mode === 'encounter') return 'Enemy Road';
  if (session.mode === 'mpDaily') return 'Daily Gauntlet';
  return 'Run';
}

function getRunReportTitle(session: RunSession): string {
  if (session.mode === 'dungeon') return 'Dungeon Report';
  if (session.mode === 'encounter') return 'Enemy Road Report';
  return 'Run Report';
}

function getRunMapLabel(session: RunSession): string {
  if (session.mode === 'dungeon') return 'Dungeon Road';
  if (session.mode === 'encounter') return 'Enemy Road';
  return 'Run Road';
}

function getRunBattleContextLabel(session: RunSession): string {
  if (session.mode === 'dungeon') return `Dungeon Run ${session.wins + 1}/${session.targetBattles}`;
  if (session.mode === 'encounter') return `Enemy Road ${session.wins + 1}/${session.targetBattles}`;
  return `Run ${session.wins + 1}/${session.targetBattles}`;
}

function getSingleplayerRunTutorialStepForSession(
  session: RunSession,
  tutorialScope: RunTutorialScope,
  username: string | null,
): SingleplayerRunTutorialStep | null {
  if (tutorialScope !== 'singleplayer' || session.mode !== 'daily') return null;

  const stepId = getSingleplayerTutorialStepIdForPhase(session.phase);
  if (!stepId || !shouldShowSingleplayerRunTutorialStep(username, stepId)) return null;

  return createSingleplayerRunTutorialStep(stepId);
}

function getSingleplayerTutorialStepIdForPhase(phase: RunPhase): SingleplayerRunTutorialStepId | null {
  if (phase === 'draft') return 'draft';
  if (phase === 'map') return 'route-map';
  if (phase === 'formation') return 'formation';
  if (phase === 'battle') return 'combat';
  if (phase === 'reward') return 'reward';
  if (phase === 'shop') return 'shop';
  if (phase === 'event') return 'omen';
  return null;
}

function RunMapPanel({
  session,
  routeTutorialActive = false,
  onStartDaily,
  onSelectDungeonNode,
}: {
  session: RunSession;
  routeTutorialActive?: boolean;
  onStartDaily: () => void;
  onSelectDungeonNode: (node: DungeonNode) => void;
}) {
  if (session.mode === 'daily' && session.nodes.length === 0) {
    const nextBattle = session.wins + 1;
    const complete = session.wins >= session.targetBattles;

    return (
      <div className="space-y-5">
        <section className="ui-card flex flex-wrap items-center justify-between gap-3 rounded border p-4">
          <div>
            <div className="arcane-label">Run</div>
            <h3 className="fantasy-heading text-xl">{complete ? 'Chain Complete' : `Battle ${nextBattle} of ${session.targetBattles}`}</h3>
          </div>
          <button
            onClick={onStartDaily}
            disabled={complete}
            className="ui-button-primary rounded px-4 py-3 text-sm font-black disabled:opacity-40"
          >
            {complete ? 'Complete' : 'Start Next Battle'}
          </button>
        </section>

        <RunProgressPips total={session.targetBattles} completed={session.wins} />
      </div>
    );
  }

  const isDaily = session.mode === 'daily';
  const branchMap = hasBranchNodeLayout(session.nodes);
  const reachableIds = getReachableNodeIds(session);
  const routeModifier = isDaily ? getBossRouteModifier(session.dailyChallenge?.bossId) : null;
  const mapSummary = {
    label: getRunMapLabel(session),
    title: isDaily || session.mode === 'encounter' ? 'Choose the next road stop' : 'Choose the next chamber',
    detail: isDaily
      ? routeModifier
        ? `Battles count. Shops and omens are free stops. Final boss: fight ${session.targetBattles}. ${routeModifier.title}: ${routeModifier.summary}`
        : `Battles count. Shops and omens are free stops. Bosses wait along the road. Final boss: fight ${session.targetBattles}.`
      : session.mode === 'encounter'
        ? `${session.encounterEnemy?.name || 'The enemy commander'} waits as the boss. Lower-level roads are shorter; omens only appear on longer routes.`
        : 'A long dungeon road with battles, shops, and omens before the final boss.',
  };

  return (
    <div className={`run-map-panel ${branchMap ? 'run-map-panel-full' : 'space-y-5'}`}>
      {!branchMap && (
        <section className="ui-card rounded border p-4">
          <div className="arcane-label">{mapSummary.label}</div>
          <h3 className="fantasy-heading text-xl">{mapSummary.title}</h3>
          <p className="ui-muted mt-1 text-sm font-bold">{mapSummary.detail}</p>
        </section>
      )}

      {branchMap ? (
        <DailyRouteMap
          session={session}
          reachableIds={reachableIds}
          tutorialActive={routeTutorialActive}
          onSelectDungeonNode={onSelectDungeonNode}
        />
      ) : (
        <div className="run-node-map grid gap-3 sm:grid-cols-2 xl:grid-cols-3">
          {session.nodes.map((node, index) => {
            const isCurrent = index === session.currentNodeIndex;
            const locked = index > session.currentNodeIndex;
            const battleNumber = ['battle', 'elite', 'boss'].includes(node.type)
              ? session.nodes.slice(0, index + 1).filter(item => ['battle', 'elite', 'boss'].includes(item.type)).length
              : null;

            return (
              <button
                key={node.id}
                onClick={() => onSelectDungeonNode(node)}
                disabled={!isCurrent || node.completed}
                className={`ui-card rounded border p-4 text-left transition ${
                  isCurrent && !node.completed
                    ? 'border-[rgba(232,217,184,0.34)] hover:border-[rgba(232,217,184,0.55)]'
                    : 'opacity-55'
                }`}
              >
                <div className="flex items-start justify-between gap-3">
                  <div className="flex min-w-0 items-center gap-3">
                    <span className="ui-icon-frame relative h-10 w-10 shrink-0 overflow-hidden rounded border">
                      <Image
                        src={getRunMapNodeIconPath(node, session)}
                        alt=""
                        fill
                        className="run-ui-art object-contain"
                      />
                    </span>
                    <div className="min-w-0">
                      <div className="arcane-label">{battleNumber ? `Fight ${battleNumber}` : node.type}</div>
                      <h4 className="fantasy-heading truncate text-base">{node.label}</h4>
                    </div>
                  </div>
                  <span className="ui-pill rounded border px-2 py-1 text-[10px] font-black">
                    {node.completed ? 'Done' : locked ? 'Locked' : node.type === 'boss' ? 'Boss' : 'Next'}
                  </span>
                </div>
                <p className="ui-muted mt-2 text-xs font-bold">{node.description}</p>
              </button>
            );
          })}
        </div>
      )}
    </div>
  );
}

type RunRouteTutorialFocusId = 'fight' | 'hard' | 'shop' | 'omen' | 'boss' | 'locked' | 'hard-omen';

const RUN_ROUTE_TUTORIAL_STEPS: Array<{
  id: RunRouteTutorialFocusId;
  title: string;
  body: string;
  badge: string;
}> = [
  {
    id: 'fight',
    title: 'Fight nodes',
    body: 'These advance the road and pay run gold when enemies fall.',
    badge: 'Fight',
  },
  {
    id: 'hard',
    title: 'Hard routes',
    body: 'Red guard nodes hit harder and are meant for stronger warbands.',
    badge: 'Hard',
  },
  {
    id: 'shop',
    title: 'Shops',
    body: 'Coin stops spend run gold without consuming a battle.',
    badge: 'Shop',
  },
  {
    id: 'omen',
    title: 'Omens',
    body: 'Purple stops roll fate for healing, recruits, gold, or trouble.',
    badge: 'Omen',
  },
  {
    id: 'boss',
    title: 'Boss gates',
    body: 'Large boss nodes are major checks. The last one finishes the road.',
    badge: 'Boss',
  },
  {
    id: 'locked',
    title: 'Locked paths',
    body: 'Dim nodes open only after the previous road stop is cleared.',
    badge: 'Locked',
  },
  {
    id: 'hard-omen',
    title: 'Hard-route omen',
    body: 'Clearing a hard route opens a free omen as the extra reward.',
    badge: '+Omen',
  },
];

function getRouteTutorialNodeMatch(node: DungeonNode, state: RunNodeState, focusId: RunRouteTutorialFocusId): string | null {
  if (focusId === 'locked') return state === 'locked' ? 'Locked' : null;
  if (focusId === 'fight') return node.type === 'battle' ? 'Fight' : null;
  if (focusId === 'hard') return node.type === 'elite' ? 'Hard' : null;
  if (focusId === 'shop') return node.type === 'shop' ? 'Shop' : null;
  if (focusId === 'omen') return node.type === 'event' ? 'Omen' : null;
  if (focusId === 'boss') return node.type === 'boss' ? 'Boss' : null;
  if (focusId === 'hard-omen') return node.type === 'elite' ? '+Omen' : null;
  return null;
}

function DailyRouteMap({
  session,
  reachableIds,
  tutorialActive = false,
  onSelectDungeonNode,
}: {
  session: RunSession;
  reachableIds: Set<string>;
  tutorialActive?: boolean;
  onSelectDungeonNode: (node: DungeonNode) => void;
}) {
  const rows = getDailyNodeRows(session.nodes);
  const mapHeightRem = getRunMapHeightRem(rows);
  const connections = getDailyMapConnections(rows, mapHeightRem);
  const mapFrameRef = useRef<HTMLDivElement>(null);
  const reachableKey = Array.from(reachableIds).sort().join('|');
  const [tutorialFocusIndex, setTutorialFocusIndex] = useState(0);
  const tutorialFocus = tutorialActive
    ? RUN_ROUTE_TUTORIAL_STEPS[tutorialFocusIndex % RUN_ROUTE_TUTORIAL_STEPS.length]
    : null;

  useEffect(() => {
    if (!tutorialActive) return undefined;

    const timer = window.setInterval(() => {
      setTutorialFocusIndex(index => (index + 1) % RUN_ROUTE_TUTORIAL_STEPS.length);
    }, 2300);

    return () => window.clearInterval(timer);
  }, [tutorialActive]);

  useEffect(() => {
    const frame = mapFrameRef.current;
    if (!frame || session.phase !== 'map' || reachableIds.size === 0 || tutorialActive) return undefined;

    const timer = window.setTimeout(() => {
      const reachableNodes = session.nodes.filter(node => reachableIds.has(node.id));
      if (reachableNodes.length === 0) return;

      const rowIndexes = reachableNodes.map(node => {
        if (typeof node.row === 'number') {
          return rows.findIndex(entry => entry.row === node.row);
        }
        return rows.findIndex(entry => entry.nodes.some(item => item.id === node.id));
      }).filter(index => index >= 0);

      if (rowIndexes.length === 0) return;

      const centerRowIndex = (Math.min(...rowIndexes) + Math.max(...rowIndexes)) / 2;
      const centerRem = getRunMapRowTopRem(centerRowIndex);
      const rootFontSize = parseFloat(getComputedStyle(document.documentElement).fontSize) || 16;
      const centerPx = centerRem * rootFontSize;
      const targetScroll = Math.max(0, centerPx - frame.clientHeight / 2);
      frame.scrollTo({ top: targetScroll, behavior: 'smooth' });
    }, 90);

    return () => window.clearTimeout(timer);
  }, [session.phase, session.currentNodeIndex, session.wins, reachableKey, rows, tutorialActive, reachableIds]);

  return (
    <div className={`run-route-shell run-route-shell-full ${tutorialActive ? 'run-route-shell-tutorial' : ''}`}>
      <div ref={mapFrameRef} className="run-route-map-frame run-route-map-frame-full">
        <div
          className={`run-route-map ${tutorialActive ? 'run-route-map-tutorial-active' : ''}`}
          style={{ height: `${mapHeightRem}rem`, minHeight: `${mapHeightRem}rem` }}
        >
          <div className="run-route-map-bg-wrap" aria-hidden>
            <div className="run-route-map-bg-layer">
              <Image
                src={ASSET_PATHS.runScenes.road}
                alt=""
                fill
                unoptimized
                priority
                sizes="100vw"
                className="run-route-map-bg-image"
              />
            </div>
            <div className="run-route-map-bg-mist" />
            <div className="run-route-map-bg-veil" />
            <div className="run-route-map-ambient-particles" />
          </div>
          <svg className="run-route-lines" viewBox="0 0 100 100" preserveAspectRatio="none" aria-hidden="true">
            {connections.map(connection => {
              const state = getRunConnectionState(connection.from, connection.to, reachableIds);
              const path = getRunConnectionPath(connection);

              return (
                <g key={`${connection.from.id}-${connection.to.id}`}>
                  {state === 'active' && (
                    <path
                      d={path}
                      className="run-route-line run-route-line-active-glow"
                    />
                  )}
                  <path
                    d={path}
                    className={`run-route-line run-route-line-${state}`}
                  />
                </g>
              );
            })}
          </svg>

          {tutorialActive && tutorialFocus && (
            <div className="run-route-tutorial-rail" aria-hidden="true">
              <div>
                <div className="arcane-label">Road Tutorial</div>
                <div className="fantasy-heading run-route-tutorial-title">{tutorialFocus.title}</div>
                <p className="run-route-tutorial-copy">{tutorialFocus.body}</p>
              </div>
              <div className="run-route-tutorial-steps">
                {RUN_ROUTE_TUTORIAL_STEPS.map((step, index) => (
                  <span
                    key={step.id}
                    className={`run-route-tutorial-dot ${step.id === tutorialFocus.id ? 'run-route-tutorial-dot-active' : ''}`}
                  >
                    {index + 1}
                  </span>
                ))}
              </div>
            </div>
          )}

          {rows.map((row, rowIndex) => (
            row.nodes.map(node => {
                const state = getRunNodeState(session, node, reachableIds);
                const battleNumber = node.battleNumber || null;
                const x = getRunMapLaneX(row.nodes.length, node.lane ?? 0);
                const y = getRunMapRowTopRem(rowIndex);
                const reachable = state === 'reachable';
                const tooltipPosition = rowIndex < 2 ? 'below' : 'above';
                const iconPath = getRunMapNodeIconPath(node, session);
                const tutorialMatch = tutorialFocus ? getRouteTutorialNodeMatch(node, state, tutorialFocus.id) : null;

                return (
                  <button
                    key={node.id}
                    type="button"
                    onClick={() => {
                      if (reachable) onSelectDungeonNode(node);
                    }}
                    className={`run-route-node run-route-node-${node.type} run-route-node-${state} transition ${reachable ? 'run-route-node-clickable' : ''} ${tutorialActive ? 'run-route-node-tutorial' : ''} ${tutorialMatch ? 'run-route-node-tutorial-active' : ''}`}
                    style={{ left: `${x}%`, top: `${y}rem` }}
                    aria-label={`${getRunNodeStateLabel(node, state)} ${battleNumber ? `fight ${battleNumber}` : node.type}: ${node.label}`}
                  >
                    {tutorialMatch && (
                      <span className="run-route-node-tutorial-badge">
                        {tutorialMatch}
                      </span>
                    )}
                    <span className={`run-route-node-icon run-route-node-icon-${node.type} run-route-node-icon-${state}`}>
                      <span className={`run-route-node-aura run-route-node-aura-${node.type} run-route-node-aura-${state}`} aria-hidden />
                      <span className={`run-route-node-spotlight run-route-node-spotlight-${node.type} run-route-node-spotlight-${state}`} aria-hidden />
                      {reachable && (
                        <>
                          <span className={`run-route-node-ring run-route-node-ring-${node.type}`} aria-hidden />
                          <span className={`run-route-node-ring run-route-node-ring-outer run-route-node-ring-${node.type}`} aria-hidden />
                          <span className="run-route-node-particles" aria-hidden>
                            {Array.from({ length: 10 }, (_, index) => (
                              <span
                                key={index}
                                className={`run-route-node-particle run-route-node-particle-${index % 3 === 0 ? 'spark' : index % 3 === 1 ? 'orbit' : 'rise'}`}
                                data-i={index}
                              />
                            ))}
                          </span>
                        </>
                      )}
                      <Image
                        src={iconPath}
                        alt=""
                        fill
                        sizes="220px"
                        className={getRunMapNodeArtClass(node, state)}
                        style={{ imageRendering: 'auto' }}
                        unoptimized
                      />
                    </span>
                    <span className="run-route-node-title">
                      {node.type === 'boss' ? 'Boss' : battleNumber ? String(battleNumber) : node.type === 'shop' ? 'Shop' : 'Omen'}
                    </span>
                    <span className={`run-route-tooltip run-route-tooltip-${tooltipPosition} run-route-tooltip-${node.type} rounded border p-3`}>
                      <span className="flex items-start justify-between gap-3">
                        <span className="min-w-0">
                          <span className="arcane-label">{battleNumber ? `Fight ${battleNumber}` : node.type}</span>
                          <span className="fantasy-heading mt-1 block truncate text-lg">{node.label}</span>
                        </span>
                        <span className="ui-pill shrink-0 rounded border px-2 py-1 text-[10px] font-black uppercase">
                          {getRunNodeStateLabel(node, state)}
                        </span>
                      </span>
                      <span className="ui-muted mt-2 block text-xs font-bold leading-relaxed">{node.description}</span>
                      <span className="mt-3 flex flex-wrap gap-2">
                        {reachable && <span className="ui-pill rounded border px-2 py-1 text-[10px] font-black uppercase">{getRunNodeActionLabel(node)}</span>}
                        {node.type === 'elite' && <span className="ui-pill rounded border px-2 py-1 text-[10px] font-black uppercase text-red-100">Hard route</span>}
                        {node.type === 'elite' && (
                          <span className="run-route-tooltip-omen ui-pill rounded border px-2 py-1 text-[10px] font-black uppercase">
                            <span className="run-route-tooltip-omen-icon relative" aria-hidden="true">
                              <Image src={DUNGEON_NODE_ICONS.event} alt="" fill sizes="18px" className="object-contain" unoptimized />
                            </span>
                            Free omen after victory
                          </span>
                        )}
                      </span>
                    </span>
                  </button>
                );
              })
          ))}
        </div>
      </div>
    </div>
  );
}

function hasBranchNodeLayout(nodes: DungeonNode[]): boolean {
  return nodes.some(node => typeof node.row === 'number');
}

function getDailyNodeRows(nodes: DungeonNode[]): Array<{ row: number; nodes: DungeonNode[] }> {
  const grouped = nodes.reduce<Map<number, DungeonNode[]>>((rows, node, index) => {
    const row = typeof node.row === 'number' ? node.row : index;
    rows.set(row, [...(rows.get(row) || []), node]);
    return rows;
  }, new Map());

  return Array.from(grouped.entries())
    .sort(([a], [b]) => a - b)
    .map(([row, rowNodes]) => ({
      row,
      nodes: rowNodes.sort((a, b) => (a.lane ?? 0) - (b.lane ?? 0)),
    }));
}

function getLatestCompletedBranchNode(session: RunSession): DungeonNode | undefined {
  if (!hasBranchNodeLayout(session.nodes)) return undefined;

  return session.nodes
    .filter(node => node.completed && typeof node.row === 'number')
    .sort((a, b) => (b.row ?? 0) - (a.row ?? 0))[0];
}

function getReachableNodeIds(session: RunSession): Set<string> {
  if (!hasBranchNodeLayout(session.nodes)) {
    const current = session.nodes[session.currentNodeIndex];
    return new Set(current && !current.completed ? [current.id] : []);
  }

  const latestCompleted = getLatestCompletedBranchNode(session);
  if (!latestCompleted) {
    const firstRow = Math.min(...session.nodes.map(node => node.row ?? 0));
    return new Set(
      session.nodes
        .filter(node => (node.row ?? 0) === firstRow && !node.completed)
        .map(node => node.id)
    );
  }

  return new Set(
    (latestCompleted.nextIds || [])
      .filter(nextId => !session.nodes.find(node => node.id === nextId)?.completed)
  );
}

function getRunNodeState(session: RunSession, node: DungeonNode, reachableIds: Set<string>): RunNodeState {
  if (node.completed) return 'completed';
  if (reachableIds.has(node.id)) return 'reachable';

  const latestCompleted = getLatestCompletedBranchNode(session);
  if (latestCompleted && (node.row ?? 0) < (latestCompleted.row ?? 0)) return 'skipped';

  return 'locked';
}

function getRunNodeStateLabel(node: DungeonNode, state: RunNodeState): string {
  if (state === 'completed') return 'Done';
  if (state === 'skipped') return 'Passed';
  if (state === 'locked') return 'Locked';
  if (node.type === 'boss') return 'Boss';
  if (node.type === 'elite') return 'Hard';
  if (node.type === 'shop') return 'Shop';
  if (node.type === 'event') return 'Omen';
  return 'Next';
}

function getRunNodeActionLabel(node: DungeonNode): string {
  if (node.type === 'shop') return 'Open Shop';
  if (node.type === 'event') return 'Resolve Omen';
  if (node.type === 'boss') return 'Face Boss';
  if (node.type === 'elite') return 'Fight Elite';
  return 'Start Fight';
}

const RUN_MAP_ROW_START_REM = 6.5;
const RUN_MAP_ROW_GAP_REM = 12.25;
const RUN_MAP_NODE_TAIL_REM = 5.1;
const RUN_MAP_BOSS_TAIL_REM = 5.75;

function getRunMapTailPadRem(rows: Array<{ nodes: DungeonNode[] }>): number {
  const lastRow = rows[rows.length - 1];
  if (!lastRow) return RUN_MAP_NODE_TAIL_REM;
  return lastRow.nodes.some(node => node.type === 'boss') ? RUN_MAP_BOSS_TAIL_REM : RUN_MAP_NODE_TAIL_REM;
}

function getRunMapHeightRem(rows: Array<{ nodes: DungeonNode[] }>): number {
  if (rows.length <= 0) return 56;
  const lastRowTop = getRunMapRowTopRem(rows.length - 1);
  return lastRowTop + getRunMapTailPadRem(rows);
}

function getRunMapRowTopRem(rowIndex: number): number {
  return RUN_MAP_ROW_START_REM + rowIndex * RUN_MAP_ROW_GAP_REM;
}

function getRunMapRowYViewBox(rowIndex: number, mapHeightRem: number): number {
  return (getRunMapRowTopRem(rowIndex) / mapHeightRem) * 100;
}

function getRunMapLaneX(rowSize: number, lane: number): number {
  if (rowSize <= 1) return 50;
  if (rowSize === 2) return lane === 0 ? 28 : 72;
  return [20, 50, 80][clamp(lane, 0, 2)] || 50;
}

function RunFormationIntroSplash({
  intro,
}: {
  intro: {
    commanderName: string;
    enemyName: string;
    artworkPath: string;
  };
}) {
  return (
    <div className="run-formation-intro-splash" aria-hidden="true">
      <div className="run-formation-intro-card">
        <span className="run-formation-intro-aura" />
        <span className="run-formation-intro-art relative block">
          <Image
            src={intro.artworkPath}
            alt=""
            fill
            sizes="220px"
            className="player-model-art object-contain"
            priority
            unoptimized
          />
        </span>
        <span className="arcane-label">Deployment</span>
        <span className="fantasy-heading run-formation-intro-title">Prepare Your Team</span>
        <span className="run-formation-intro-copy">
          {intro.commanderName} vs {intro.enemyName}
        </span>
      </div>
    </div>
  );
}

function getDailyMapConnections(rows: Array<{ row: number; nodes: DungeonNode[] }>, mapHeightRem: number): Array<{
  from: DungeonNode;
  to: DungeonNode;
  x1: number;
  y1: number;
  x2: number;
  y2: number;
}> {
  const nodeById = new Map(rows.flatMap(row => row.nodes.map(node => [node.id, node] as const)));
  const rowIndexByNodeId = new Map<string, number>();
  rows.forEach((row, rowIndex) => row.nodes.forEach(node => rowIndexByNodeId.set(node.id, rowIndex)));

  return rows.flatMap((row, rowIndex) => (
    row.nodes.flatMap(node => (
      (node.nextIds || [])
        .map(nextId => nodeById.get(nextId))
        .filter((nextNode): nextNode is DungeonNode => Boolean(nextNode))
        .map(nextNode => {
          const nextRowIndex = rowIndexByNodeId.get(nextNode.id) ?? rowIndex + 1;
          const nextRow = rows[nextRowIndex] || rows[rowIndex + 1] || row;
          return {
            from: node,
            to: nextNode,
            x1: getRunMapLaneX(row.nodes.length, node.lane ?? 0),
            y1: getRunMapRowYViewBox(rowIndex, mapHeightRem),
            x2: getRunMapLaneX(nextRow.nodes.length, nextNode.lane ?? 0),
            y2: getRunMapRowYViewBox(nextRowIndex, mapHeightRem),
          };
        })
    ))
  ));
}

function getRunConnectionPath(connection: { x1: number; y1: number; x2: number; y2: number }): string {
  const midY = (connection.y1 + connection.y2) / 2;
  return `M ${connection.x1} ${connection.y1} C ${connection.x1} ${midY} ${connection.x2} ${midY} ${connection.x2} ${connection.y2}`;
}

function getRunConnectionState(from: DungeonNode, to: DungeonNode, reachableIds: Set<string>): 'completed' | 'active' | 'locked' {
  if (from.completed && to.completed) return 'completed';
  if (from.completed && reachableIds.has(to.id)) return 'active';
  return 'locked';
}

function RunInteractionTutorialCoach({ kind }: { kind: 'blessing' | 'shop' }) {
  const isBlessing = kind === 'blessing';

  return (
    <aside
      className={`run-interaction-tutorial run-interaction-tutorial-${kind} rounded border`}
      role="status"
      aria-live="polite"
    >
      <span className="run-interaction-tutorial-guide relative" aria-hidden="true">
        <Image
          src={SINGLEPLAYER_RUN_TUTORIAL_GUIDE_ASSET}
          alt=""
          fill
          sizes="76px"
          className="object-contain object-bottom"
          unoptimized
        />
      </span>
      <span className="run-interaction-tutorial-copy">
        <span className="arcane-label">{isBlessing ? 'First Blessing' : 'First Purchase'}</span>
        <strong className="fantasy-heading">
          {isBlessing ? 'Choose one highlighted path.' : 'Spend run gold on a highlighted offer.'}
        </strong>
        <span>
          {isBlessing
            ? 'Hover to read the full effect, then choose the blessing that fits the surviving warband.'
            : 'Affordable offers are marked. Buying one completes this lesson; the shop remains open afterward.'}
        </span>
      </span>
    </aside>
  );
}

function RewardPanel({
  session,
  choices,
  tutorialActive = false,
  onReroll,
  onChoose,
}: {
  session: RunSession;
  choices: RunRewardChoice[];
  tutorialActive?: boolean;
  onReroll: () => void;
  onChoose: (choice: RunRewardChoice) => void;
}) {
  const standingCount = getAliveRunRoster(session).length;
  const rerollsRemaining = session.blessingRerollsRemaining ?? RUN_BLESSING_REROLL_COUNT;
  const [isRerolling, setIsRerolling] = useState(false);
  const rerollStartTimer = useRef<number | null>(null);
  const rerollEndTimer = useRef<number | null>(null);

  useEffect(() => () => {
    if (rerollStartTimer.current) window.clearTimeout(rerollStartTimer.current);
    if (rerollEndTimer.current) window.clearTimeout(rerollEndTimer.current);
  }, []);

  const handleReroll = () => {
    if (rerollsRemaining <= 0 || isRerolling) return;
    setIsRerolling(true);
    if (rerollStartTimer.current) window.clearTimeout(rerollStartTimer.current);
    if (rerollEndTimer.current) window.clearTimeout(rerollEndTimer.current);
    rerollStartTimer.current = window.setTimeout(() => {
      onReroll();
    }, 320);
    rerollEndTimer.current = window.setTimeout(() => {
      setIsRerolling(false);
    }, 900);
  };

  return (
    <div className="run-draft-stage run-reward-stage min-h-0">
      <section className="run-draft-hero run-reward-hero-full relative min-h-0 overflow-hidden p-4 sm:p-5">
        <div className="relative z-10 max-w-xl">
        <div className="arcane-label">Run Reward</div>
          <h3 className="fantasy-heading mt-1 text-2xl sm:text-3xl">Choose a Blessing</h3>
          <p className="ui-muted mt-1.5 max-w-lg text-xs font-bold leading-relaxed sm:text-sm">
            Pick one upgrade for this road. The best blessing depends on the warband still standing.
          </p>
          <p className="run-draft-hero-status ui-faint mt-1.5 text-[11px] font-bold sm:text-xs">
            {session.title} - {standingCount}/{session.minions.length} standing - {session.runGold} run gold
          </p>
        </div>

        <RunWarbandHeroSprites
          minions={session.minions}
          fallenClassName="run-completion-sprite-fallen"
        />
      </section>

      <section className="run-draft-choice-shell run-reward-body min-h-0 p-2.5 sm:p-3">
        <div className="run-reward-roster-scene rounded border">
          <div className="run-roster-list-head">
            <h3 className="fantasy-heading text-sm font-black">Run Roster</h3>
            <span className="ui-faint text-xs font-bold">{standingCount}/{session.minions.length}</span>
          </div>

          {session.minions.length === 0 ? (
            <div className="ui-empty rounded border border-dashed px-3 py-4 text-center text-xs font-bold">
              No units drafted.
            </div>
          ) : (
            <div className="run-reward-roster-list run-roster-rows" role="list" aria-label="Run roster">
              {session.minions.map(unit => {
                const template = getMinionTemplate(unit.stack.templateId);
                if (!template) return null;
                return <RunRosterListItem key={unit.stack.id} unit={unit} template={template} />;
              })}
            </div>
          )}
        </div>

        <div className="run-blessing-offer-stage min-h-0">
          <div className="run-blessing-backdrop" aria-hidden="true" />
          {tutorialActive && <RunInteractionTutorialCoach kind="blessing" />}
          <div className="run-blessing-frame">
            <div className="run-draft-choice-header mb-2 flex flex-wrap items-end justify-between gap-2">
              <div>
                <div className="arcane-label">Choose One</div>
                <h4 className="fantasy-heading text-lg sm:text-xl">Blessings Offered</h4>
              </div>
              <div className="run-reward-control-row">
                <span className="run-blessing-count ui-pill rounded border px-2.5 py-0.5 text-[10px] font-black sm:text-xs">
                  {choices.length} paths
                </span>
                <button
                  type="button"
                  onClick={handleReroll}
                  disabled={rerollsRemaining <= 0 || isRerolling}
                  className="run-reroll-button rounded border px-3 py-2 text-xs font-black disabled:cursor-not-allowed disabled:opacity-40"
                >
                  <span className="run-reroll-icon" aria-hidden="true">↻</span>
                  {isRerolling ? 'Rerolling' : `Reroll ${rerollsRemaining}`}
                </button>
              </div>
            </div>

            {isRerolling && (
              <div className="run-blessing-reroll-flash" aria-hidden="true">
                <span className="run-blessing-reroll-dice relative">
                  <Image
                    src={RANDOM_REWARD_ANIMATION_ICON}
                    alt=""
                    fill
                    sizes="112px"
                    className="object-contain"
                    unoptimized
                  />
                </span>
                <span className="arcane-label">Blessings shifting</span>
              </div>
            )}

            <div className={`run-blessing-grid ${isRerolling ? 'run-blessing-grid-rerolling' : ''}`}>
        {choices.map(choice => (
                <RunRewardCard
                  key={choice.id}
                  choice={choice}
                  tutorialFocus={tutorialActive}
                  onChoose={() => onChoose(choice)}
                  variant="blessing"
                />
        ))}
      </div>
          </div>
        </div>
      </section>
    </div>
  );
}

function RunRewardCard({
  choice,
  onChoose,
  disabled = false,
  cost,
  variant = 'blessing',
  tutorialFocus = false,
}: {
  choice: RunRewardChoice;
  onChoose: () => void;
  disabled?: boolean;
  cost?: number;
  variant?: 'blessing' | 'shop';
  tutorialFocus?: boolean;
}) {
  const visual = getRunRewardVisual(choice);
  const [claiming, setClaiming] = useState(false);
  const scenePath = visual.tone === 'gold' || visual.tone === 'gear' || visual.tone === 'morale'
    ? '/assets/town-riverside-bg.png'
    : '/assets/town-harborview-bg.png';
  const cardStyle = {
    '--run-reward-card-scene': `url("${scenePath}")`,
  } as CSSProperties;

  const handleChoose = () => {
    if (disabled || claiming) return;
    setClaiming(true);
    window.setTimeout(onChoose, 420);
  };

  return (
    <button
      onClick={handleChoose}
      disabled={disabled || claiming}
      className={`run-blessing-card run-blessing-card-${visual.tone} run-reward-card run-reward-card-${visual.tone} run-reward-card-${variant} ${variant === 'shop' ? 'run-shop-offer-card' : 'run-blessing-choice-card'} ${tutorialFocus ? 'run-reward-card-tutorial-focus' : ''} ${claiming ? 'run-reward-card-claiming' : ''} rounded border text-left transition disabled:opacity-40`}
      style={cardStyle}
    >
      <span className="run-reward-card-burst" aria-hidden="true" />
      <span className={`run-blessing-tier ${cost ? 'run-shop-cost-badge' : ''} rounded border px-2 py-0.5 text-[10px] font-black uppercase`}>
        {cost ? (
          <>
            <Image src={RUN_GOLD_ICON} alt="" width={18} height={18} className="run-shop-cost-icon" unoptimized />
            <span>{cost}</span>
          </>
        ) : visual.tierLabel}
      </span>
      <span className="run-blessing-card-top">
        <span className={`run-blessing-art run-reward-icon run-reward-icon-${visual.tone} relative overflow-hidden rounded border`}>
          <Image
            src={visual.iconPath}
            alt=""
            fill
            sizes="80px"
            className="run-ui-art object-contain p-2"
          />
        </span>
            </span>
      <span className="run-blessing-kind ui-faint text-[10px] font-black uppercase">{visual.kindLabel}</span>
      <span className="run-blessing-name fantasy-heading">{choice.name}</span>
      <span className="run-blessing-desc ui-muted">{choice.description}</span>
      <span className="run-blessing-impact run-reward-impact rounded border px-2 py-1 text-[10px] font-black uppercase">
            {visual.impactLabel}
      </span>
    </button>
  );
}

function getRunRewardVisual(choice: RunRewardChoice): {
  iconPath: string;
  tierLabel: string;
  kindLabel: string;
  impactLabel: string;
  tone: 'attack' | 'defense' | 'magic' | 'morale' | 'health' | 'unit' | 'gold' | 'gear';
} {
  if (choice.equipmentOffer) {
    const item = choice.equipmentOffer;
    const tierLabel = item.rarity === 'legendary'
      ? 'Legendary'
      : item.rarity === 'epic'
        ? 'Epic'
        : item.rarity === 'rare'
          ? 'Rare'
          : 'Gear';
    return {
      iconPath: getRunEquipmentIconPath(item),
      tierLabel,
      kindLabel: RUN_EQUIPMENT_SLOT_LABELS[item.slot] || 'Gear',
      impactLabel: 'Commander gear',
      tone: 'gear',
    };
  }

  if (choice.id.startsWith('learn-')) {
    const spellId = choice.id.replace(/^learn-/, '');
    return {
      iconPath: getSpellIconPath({ id: spellId }),
      tierLabel: 'Spell',
      kindLabel: 'Spellbook',
      impactLabel: 'New spell',
      tone: 'magic',
    };
  }

  const normalized = `${choice.id} ${choice.name} ${choice.description}`.toLowerCase();
  const tierLabel = normalized.includes('all') || normalized.includes('tier iii') || normalized.includes('+35') || normalized.includes('+4')
    ? 'Tier III'
    : normalized.includes('tier ii') || normalized.includes('+20') || normalized.includes('+2') || normalized.includes('up to two')
      ? 'Tier II'
      : 'Tier I';

  if (normalized.includes('army') || normalized.includes('weapon') || normalized.includes('frontline')) {
    return { iconPath: '/assets/icons/attack.png', tierLabel, kindLabel: 'Offense', impactLabel: 'More damage', tone: 'attack' };
  }
  if (normalized.includes('ward') || normalized.includes('armor') || normalized.includes('defensive') || normalized.includes('shield')) {
    return { iconPath: '/assets/icons/defense.png', tierLabel, kindLabel: 'Defense', impactLabel: 'More survival', tone: 'defense' };
  }
  if (normalized.includes('spell') || normalized.includes('focus') || normalized.includes('liturgy')) {
    return { iconPath: '/assets/icons/magic.png', tierLabel, kindLabel: 'Magic', impactLabel: 'Better spells', tone: 'magic' };
  }
  if (normalized.includes('morale') || normalized.includes('banner') || normalized.includes('chorus')) {
    return { iconPath: '/assets/icons/speed.png', tierLabel, kindLabel: 'Tempo', impactLabel: 'Faster turns', tone: 'morale' };
  }
  if (normalized.includes('health') || normalized.includes('heal') || normalized.includes('surgeon') || normalized.includes('triage') || normalized.includes('resurrect') || normalized.includes('mercy') || normalized.includes('vigor')) {
    return { iconPath: '/assets/icons/health.png', tierLabel, kindLabel: 'Recovery', impactLabel: 'Stay alive', tone: 'health' };
  }
  if (normalized.includes('recruit') || normalized.includes('promotion') || normalized.includes('minion')) {
    return { iconPath: '/assets/icons/attack.png', tierLabel, kindLabel: 'Army', impactLabel: 'More units', tone: 'unit' };
  }
  if (normalized.includes('gear') || normalized.includes('cache') || normalized.includes('relic')) {
    return { iconPath: '/assets/icons/loot-chest.png', tierLabel, kindLabel: 'Gear', impactLabel: 'New item', tone: 'gear' };
  }
  return { iconPath: '/assets/icons/gold.png', tierLabel, kindLabel: 'Treasure', impactLabel: 'Shop power', tone: 'gold' };
}

function ShopPanel({
  session,
  tutorialActive = false,
  onBuy,
  onReroll,
  onSkip,
}: {
  session: RunSession;
  tutorialActive?: boolean;
  onBuy: (offerIndex: number, choice: RunRewardChoice, cost: number) => void;
  onReroll: () => void;
  onSkip: () => void;
}) {
  const node = session.nodes[session.currentNodeIndex];
  const offers = getShopOffersForSession(session);
  const rerollsRemaining = session.shopRerollsRemaining ?? RUN_SHOP_REROLL_COUNT;

  return (
    <div className="run-shop-screen run-draft-stage run-reward-stage min-h-0">
      {tutorialActive && <RunInteractionTutorialCoach kind="shop" />}
      <section className="run-shop-hero ui-card flex flex-wrap items-start justify-between gap-3 rounded border p-4">
        <div>
          <div className="arcane-label">{session.mode === 'dungeon' ? 'Dungeon Shop' : 'Road Shop'}</div>
          <h3 className="fantasy-heading text-xl">{node?.label || (session.mode === 'dungeon' ? 'Black-Coin Merchant' : 'Roadside Quartermaster')}</h3>
          <p className="ui-muted mt-1 text-sm font-bold">Spend run gold on as many temporary blessings as you can afford.</p>
        </div>
        <div className="run-shop-control-row">
          <span className="run-shop-gold-pill rounded border">
            <Image src={RUN_GOLD_ICON} alt="" width={28} height={28} className="run-shop-gold-icon" unoptimized />
            <span>
              <strong>{session.runGold}</strong>
              <small>run gold</small>
            </span>
          </span>
          <button
            type="button"
            onClick={onReroll}
            disabled={rerollsRemaining <= 0}
            className="run-reroll-button rounded border px-3 py-2 text-xs font-black disabled:cursor-not-allowed disabled:opacity-40"
          >
            <span className="run-reroll-icon" aria-hidden="true">↻</span>
            Reroll Shop {rerollsRemaining}
          </button>
          <button onClick={onSkip} className="run-shop-leave-button ui-button-primary rounded px-5 py-3 text-sm font-black">
            Leave Shop
          </button>
        </div>
      </section>

      {offers.length > 0 ? (
        <div className="run-reward-grid">
          {offers.map((offer, offerIndex) => {
            const choice = getRunRewardChoiceById(offer.choiceId, offer.equipmentOffer);
            if (!choice) return null;
            const isAvailable = !choice.isAvailable || choice.isAvailable(session);
            const canAfford = !offer.purchased && isAvailable && session.runGold >= offer.cost;

            if (offer.purchased) {
              return (
                <RunShopEmptySlot
                  key={`claimed-${offer.choiceId}-${offerIndex}`}
                  cost={offer.cost}
                />
              );
            }

          return (
            <RunRewardCard
                key={`${choice.id}-${offer.cost}-${offerIndex}`}
              choice={choice}
                onChoose={() => onBuy(offerIndex, choice, offer.cost)}
              disabled={!canAfford}
                cost={offer.cost}
                variant="shop"
                tutorialFocus={tutorialActive && canAfford}
            />
          );
        })}
      </div>
      ) : (
        <section className="ui-card rounded border p-5 text-center">
          <div className="arcane-label">Sold Out</div>
          <h3 className="fantasy-heading text-xl">The merchant has nothing left here.</h3>
          <p className="ui-muted mt-1 text-sm font-bold">Leave the shop, or spend a reroll if you saved one.</p>
        </section>
      )}
    </div>
  );
}

function RunShopEmptySlot({ cost }: { cost: number }) {
  return (
    <div className="run-shop-empty-slot rounded border" aria-label="Purchased shop slot">
      <span className="run-shop-empty-cost rounded border">
        <Image src={RUN_GOLD_ICON} alt="" width={18} height={18} className="run-shop-cost-icon" unoptimized />
        <span>{cost}</span>
      </span>
      <span className="run-shop-empty-mark" aria-hidden="true" />
      <span className="arcane-label">Claimed</span>
      <span className="run-shop-empty-title fantasy-heading">Taken</span>
      <span className="run-shop-empty-copy ui-muted">This road offer has already joined the run.</span>
    </div>
  );
}

type OmenTone = 'curse' | 'blessing' | 'gold' | 'recruit' | 'ward';

interface OmenOutcome {
  id: string;
  title: string;
  detail: string;
  flavor: string;
  tone: OmenTone;
  apply: (session: RunSession) => RunSession;
}

function getOmenOutcomePresentation(outcome: Pick<OmenOutcome, 'tone' | 'title'>): { iconPath: string; label: string; impact: string } {
  switch (outcome.tone) {
    case 'curse':
      return { iconPath: '/assets/icons/attack.png', label: 'Risk', impact: 'Road turns against you' };
    case 'gold':
      return { iconPath: RUN_GOLD_ICON, label: 'Treasure', impact: 'More shop power' };
    case 'recruit':
      return { iconPath: '/assets/icons/attack.png', label: 'Recruit', impact: 'Warband grows' };
    case 'ward':
      return { iconPath: '/assets/icons/defense.png', label: 'Ward', impact: 'More survival' };
    default:
      return { iconPath: '/assets/icons/magic.png', label: 'Blessing', impact: outcome.title };
  }
}

function OmenDiceCinematic({ phase }: { phase: 'channel' | 'reroll' }) {
  return (
    <div className={`run-omen-dice-cinematic run-omen-dice-cinematic-${phase}`} aria-hidden>
      <span className="run-omen-dice-veil" />
      <span className="run-omen-dice-glow" />
      {[1, 2, 3].map(index => (
        <span key={index} className={`run-omen-dice run-omen-dice-${index}`}>
          <Image
            src={RANDOM_REWARD_ANIMATION_ICON}
            alt=""
            fill
            sizes="512px"
            className="run-omen-dice-art object-contain"
            unoptimized
          />
        </span>
      ))}
      <span className="run-omen-dice-sparkles" />
    </div>
  );
}

function OmenPanel({
  session,
  onReroll,
  onComplete,
}: {
  session: RunSession;
  onReroll: () => void;
  onComplete: (outcome: OmenOutcome) => void;
}) {
  const node = session.nodes[session.currentNodeIndex];
  const revealKey = `${session.id}:${session.currentNodeIndex}`;
  const [outcome, setOutcome] = useState(() => rollDungeonEventOutcome(session));
  const rerollTimerRef = useRef<number | null>(null);
  const [revealState, setRevealState] = useState<{ key: string; stage: 'channeling' | 'rerolling' | 'revealed' }>({
    key: revealKey,
    stage: 'channeling',
  });
  const stage = revealState.key === revealKey ? revealState.stage : 'channeling';
  const rerollsRemaining = session.omenRerollsRemaining ?? RUN_OMEN_REROLL_COUNT;

  const handleReroll = () => {
    if (rerollsRemaining <= 0 || stage === 'rerolling') return;
    if (rerollTimerRef.current) window.clearTimeout(rerollTimerRef.current);
    setRevealState({ key: revealKey, stage: 'rerolling' });
    emitFxEvent({ type: 'spell', tone: 'violet', intensity: 0.62 });
    rerollTimerRef.current = window.setTimeout(() => {
      rerollTimerRef.current = null;
      onReroll();
      setOutcome(rollDungeonEventOutcome({
        ...session,
        omenRerollsRemaining: Math.max(0, rerollsRemaining - 1),
      }));
      setRevealState({ key: revealKey, stage: 'channeling' });
    }, OMEN_REROLL_MS);
  };

  useEffect(() => {
    if (stage !== 'channeling') return undefined;
    const prefersReducedMotion = window.matchMedia('(prefers-reduced-motion: reduce)').matches;
    const delay = prefersReducedMotion ? 0 : OMEN_CHANNEL_MS;
    const timer = window.setTimeout(() => {
      setRevealState({ key: revealKey, stage: 'revealed' });
      emitFxEvent({
        type: 'status',
        tone: outcome.tone === 'curse' ? 'red' : outcome.tone === 'gold' ? 'gold' : 'violet',
        intensity: 0.72,
      });
    }, delay);

    return () => window.clearTimeout(timer);
  }, [outcome.detail, outcome.id, outcome.title, outcome.tone, revealKey, stage]);

  useEffect(() => () => {
    if (rerollTimerRef.current) window.clearTimeout(rerollTimerRef.current);
  }, []);

  if (stage === 'channeling') {
    return (
      <div className="run-omen-stage run-omen-stage-channeling flex min-h-[28rem] items-center justify-center overflow-hidden p-4">
        <OmenDiceCinematic phase="channel" />
        <section className="run-omen-panel run-omen-channeling run-omen-channeling-overlay w-full max-w-2xl rounded border p-6 text-center sm:p-8">
          <div className="run-omen-sigil-wrap run-omen-sigil-wrap-dice mx-auto mb-5">
            <span className="run-omen-sigil-ring run-omen-sigil-ring-outer" aria-hidden="true" />
            <span className="run-omen-sigil-ring run-omen-sigil-ring-inner" aria-hidden="true" />
            <span className="run-omen-sigil-icon run-omen-sigil-icon-dice relative mx-auto block overflow-hidden rounded-full border">
              <Image
                src={RANDOM_REWARD_ANIMATION_ICON}
                alt=""
                fill
                sizes="160px"
                className="run-omen-dice-art object-contain p-3"
                unoptimized
              />
            </span>
          </div>
          <div className="arcane-label">Omen</div>
          <h3 className="fantasy-heading mt-1 text-3xl sm:text-4xl">{node?.label || 'Dark Pool'}</h3>
          <p className="run-omen-channel-copy ui-muted mx-auto mt-3 max-w-md text-sm font-bold leading-relaxed">
            {node?.description || 'The chamber hums as fate gathers around your warband.'}
          </p>
          <p className="run-omen-channel-status mt-6 text-xs font-black uppercase tracking-[0.24em] text-violet-100/80">
            Reading the omen
          </p>
        </section>
      </div>
    );
  }

  if (stage === 'rerolling') {
    return (
      <div className="run-omen-stage run-omen-stage-rerolling flex min-h-[28rem] items-center justify-center overflow-hidden p-4">
        <OmenDiceCinematic phase="reroll" />
        <section className="run-omen-panel run-omen-rerolling run-omen-channeling-overlay w-full max-w-2xl rounded border p-6 text-center sm:p-8">
          <div className="run-omen-reroll-orbit mx-auto mb-5">
            <span className="run-omen-reroll-ring run-omen-reroll-ring-outer" aria-hidden="true" />
            <span className="run-omen-reroll-ring run-omen-reroll-ring-inner" aria-hidden="true" />
            <span className="run-omen-sigil-icon run-omen-sigil-icon-dice relative mx-auto block overflow-hidden rounded-full border">
              <Image
                src={RANDOM_REWARD_ANIMATION_ICON}
                alt=""
                fill
                sizes="160px"
                className="run-omen-dice-art object-contain p-3"
                unoptimized
              />
            </span>
          </div>
          <div className="arcane-label">Omen Reroll</div>
          <h3 className="fantasy-heading mt-1 text-4xl">Fate Turns</h3>
          <p className="run-omen-channel-copy ui-muted mx-auto mt-3 max-w-md text-sm font-bold leading-relaxed">
            The sign breaks apart before another omen gathers.
          </p>
          <p className="run-omen-channel-status mt-6 text-xs font-black uppercase tracking-[0.24em] text-violet-100/80">
            Shaking the bones
          </p>
        </section>
      </div>
    );
  }

  const outcomePresentation = getOmenOutcomePresentation(outcome);

  return (
    <div className="run-omen-stage run-omen-stage-revealed flex min-h-[28rem] items-stretch justify-center p-4">
      <section className={`run-omen-panel run-omen-reveal run-omen-${outcome.tone} w-full rounded border p-0`}>
        <div className="run-omen-reveal-layout">
          <div className="run-omen-reveal-art">
            <span className="run-omen-result-orbit" aria-hidden="true" />
            <span className="run-omen-result-icon relative overflow-hidden rounded border">
              <Image
                src={outcomePresentation.iconPath}
                alt=""
                fill
                sizes="160px"
                className="run-ui-art object-contain p-5"
                unoptimized
              />
            </span>
            <span className="run-omen-impact-pill rounded border">{outcomePresentation.impact}</span>
          </div>

          <div className="run-omen-reveal-copy">
            <div className="arcane-label">Omen Resolved</div>
            <h3 className="fantasy-heading mt-2">{outcome.title}</h3>
            <p className="run-omen-flavor ui-muted mt-4 font-bold leading-relaxed">{outcome.flavor}</p>
            <p className="run-omen-result-detail mt-5 rounded border font-black leading-relaxed text-zinc-100">
              {outcome.detail}
            </p>
            <div className="run-omen-meta-row mt-5">
              <span className="run-omen-tone-pill rounded border">{outcomePresentation.label}</span>
              <span className="run-omen-tone-pill rounded border">Rerolls {rerollsRemaining}</span>
            </div>
          </div>

          <div className="run-omen-actions">
            <button
              type="button"
              onClick={handleReroll}
              disabled={rerollsRemaining <= 0}
              className="ui-button rounded px-5 py-4 text-sm font-black disabled:cursor-not-allowed disabled:opacity-40"
            >
              Reroll Omen {rerollsRemaining}
            </button>
            <button
              type="button"
              onClick={() => onComplete(outcome)}
              className="ui-button-primary rounded px-6 py-4 text-sm font-black"
            >
              Continue Road
            </button>
          </div>
        </div>
      </section>
    </div>
  );
}

function RunDefeatBurst({ session }: { session: RunSession }) {
  const abandoned = session.outcome === 'abandoned';

  return (
    <div className="run-completion-defeat-burst relative flex h-full min-h-0 items-center justify-center overflow-hidden">
      <div className="completion-burst completion-burst-defeat pointer-events-none text-center">
        <div className="completion-avatar-wrap completion-avatar-wrap-defeat relative mx-auto mb-5 h-44 w-44 sm:h-56 sm:w-56">
          <Image
            src="/assets/reaper.png"
            alt=""
            fill
            sizes="224px"
            className="completion-avatar-defeat-art object-contain"
            priority
            unoptimized
          />
      </div>
        <div className="arcane-label">{abandoned ? 'Run Withdrawn' : 'Run Fallen'}</div>
        <div className="fantasy-heading text-5xl sm:text-7xl">{abandoned ? 'Retreat' : 'Defeat'}</div>
      </div>
    </div>
  );
}

function RunWarbandHeroSprites({
  minions,
  className = 'run-draft-hero-roster',
  fallenClassName = '',
}: {
  minions: RunUnit[];
  className?: string;
  fallenClassName?: string;
}) {
  const rosterCount = minions.length;
  const { spriteWidth, spriteStep } = getRunRosterSpriteLayout(rosterCount);

  return (
    <div
      className={className}
      data-count={rosterCount}
      aria-label={`Warband ${rosterCount} units`}
    >
      {minions.map((unit, index) => {
        const template = getMinionTemplate(unit.stack.templateId);
        if (!template) return null;

        return (
          <div
            key={unit.stack.id}
            className={`run-draft-hero-sprite-wrap ${!unit.alive ? fallenClassName : ''}`}
            style={{
              zIndex: index + 1,
              right: `${index * spriteStep}%`,
              width: `${spriteWidth}%`,
            }}
            title={template.name}
          >
            <Image
              src={`${MINION_ICON_BASE}/${template.assetName}`}
              alt={template.name}
              fill
              sizes="512px"
              className="run-draft-hero-sprite object-contain object-bottom"
              unoptimized
            />
          </div>
        );
      })}
    </div>
  );
}

function getRunVictoryBossArtwork(session: RunSession): { name: string; assetPath: string } | null {
  if (session.outcome !== 'victory') return null;

  const finalBossNode = [...session.nodes].reverse().find(node => node.type === 'boss');
  const bossId = finalBossNode?.bossId || session.dailyChallenge?.bossId || session.dungeon?.bossId;
  if (!bossId) return null;

  const profile = getBossProfileById(bossId);
  if (!profile?.assetPath) return null;

  return { name: profile.name, assetPath: profile.assetPath };
}

function RunVictoryBossOverlay({
  boss,
  onFinished,
}: {
  boss: { name: string; assetPath: string };
  onFinished: () => void;
}) {
  useEffect(() => {
    const timer = window.setTimeout(onFinished, BOSS_LAST_STAND_PRESENTATION_MS);
    return () => window.clearTimeout(timer);
  }, [onFinished]);

  return (
    <div
      className="run-victory-boss-layer fixed inset-0 z-[68] flex items-center justify-center pointer-events-none"
      aria-hidden="true"
    >
      <div
        className="battle-boss-cinematic-overlay battle-boss-last-stand-overlay run-victory-boss-overlay"
        style={{ '--boss-last-stand-ms': `${BOSS_LAST_STAND_PRESENTATION_MS}ms` } as CSSProperties}
      >
        <span className="battle-boss-cinematic-ring battle-boss-cinematic-ring-1" />
        <span className="battle-boss-cinematic-ring battle-boss-cinematic-ring-2" />
        <span className="battle-boss-cinematic-burst battle-boss-last-stand-burst" />
        <span className="battle-boss-cinematic-sprite-wrap">
          <span className="battle-boss-cinematic-sprite-glow battle-boss-last-stand-sprite-glow" />
          <Image
            src={boss.assetPath}
            alt=""
            width={320}
            height={380}
            className="battle-boss-cinematic-sprite battle-boss-last-stand-sprite object-contain object-center"
            unoptimized
          />
        </span>
      </div>
    </div>
  );
}

function CompletionPanel({
  session,
  onClaim,
  onClose,
}: {
  session: RunSession;
  onClaim: () => void;
  onClose: () => void;
}) {
  const victory = session.outcome === 'victory';
  const abandoned = session.outcome === 'abandoned';
  const tone = victory ? 'victory' : abandoned ? 'abandoned' : 'defeat';
  const [statsOpen, setStatsOpen] = useState(false);
  const victoryBossArtwork = victory ? getRunVictoryBossArtwork(session) : null;
  const [showVictoryBoss, setShowVictoryBoss] = useState(Boolean(victoryBossArtwork));
  const headline = victory ? 'Run Cleared' : abandoned ? 'Run Retreated' : 'Run Failed';
  const subtitle = victory
    ? 'The road is yours. Claim your reward and return to the run hall.'
    : abandoned
      ? 'Your warband withdrew from the field. This run ends here.'
      : 'The warband was broken on the road. Your permanent run progress remains intact.';

  return (
    <>
      {showVictoryBoss && victoryBossArtwork ? (
        <RunVictoryBossOverlay
          boss={victoryBossArtwork}
          onFinished={() => setShowVictoryBoss(false)}
        />
      ) : null}
      <div className="run-draft-stage run-completion-stage min-h-0">
        <section className={`run-draft-hero run-completion-tone-${tone} relative min-h-0 overflow-hidden p-4 sm:p-5`}>
          <div className="relative z-10 max-w-xl">
            <div className="arcane-label">{getRunReportTitle(session)}</div>
            <h3 className="fantasy-heading mt-1 text-2xl sm:text-3xl">{headline}</h3>
            <p className="ui-muted mt-1.5 max-w-lg text-xs font-bold leading-relaxed sm:text-sm">
              {subtitle}
            </p>
            <p className="run-draft-hero-status ui-faint mt-1.5 text-[11px] font-bold sm:text-xs">
              {session.title}
            </p>
          </div>

          <RunWarbandHeroSprites
            minions={session.minions}
            fallenClassName="run-completion-sprite-fallen"
          />
        </section>

        <section className="run-draft-choice-shell run-completion-footer min-h-0 p-2.5 sm:p-3">
          <div className="run-draft-choice-header mb-2 flex flex-wrap items-end justify-between gap-2">
            <div>
              <div className="arcane-label">Final Warband</div>
              <h4 className="fantasy-heading text-lg sm:text-xl">Run Roster</h4>
          </div>
            <span className="ui-pill rounded border px-2.5 py-0.5 text-[10px] font-black sm:text-xs">
              {getAliveRunRoster(session).length}/{session.minions.length} standing
            </span>
        </div>

          <div className="run-completion-warband-grid" aria-label="Run warband roster">
            {session.minions.map(unit => {
              const template = getMinionTemplate(unit.stack.templateId);
              if (!template) return null;

              return (
                <div
                  key={unit.stack.id}
                  className={`run-completion-roster-card run-completion-roster-card-${template.tier} ${unit.alive ? '' : 'run-completion-roster-card-fallen'}`}
                >
                  <span className="run-completion-roster-art relative block min-h-0 flex-1">
                    <span className="run-draft-recruit-frame">
                      <Image
                        src={`${MINION_ICON_BASE}/${template.assetName}`}
                        alt=""
                        fill
                        sizes="256px"
                        className="run-draft-recruit-sprite object-contain object-bottom"
                        unoptimized
                      />
                    </span>
                  </span>
                  <span className="run-draft-card-copy block shrink-0">
                    <span className="fantasy-heading block truncate text-xs sm:text-sm">{template.name}</span>
                    <span className="run-draft-card-tierline ui-muted mt-0.5 block truncate text-[10px] font-bold sm:text-xs">
                      {unit.alive ? `${MINION_TIER_LABELS[template.tier]} ${MINION_CLASS_LABELS[template.class]}` : 'Fallen'}
                    </span>
                  </span>
                </div>
              );
            })}
        </div>

          <div className="run-completion-action-row mt-3">
            <button
              type="button"
              onClick={() => setStatsOpen(true)}
              className="run-completion-action ui-button rounded px-5 py-3 text-sm font-bold"
            >
              Stats
            </button>
          {victory && (
            <button
                type="button"
              onClick={onClaim}
              data-multiplayer-tutorial-anchor="battle-result-claim"
              disabled={session.rewardClaimed}
                className="run-completion-action random-run-start ui-button-primary rounded px-5 py-3 text-sm font-black disabled:opacity-40"
            >
              {session.rewardClaimed ? 'Reward Claimed' : 'Claim Reward'}
            </button>
          )}
            {!victory && (
              <button
                type="button"
                onClick={onClose}
                className="run-completion-action random-run-start ui-button-primary rounded px-5 py-3 text-sm font-black"
              >
                Continue
          </button>
            )}
        </div>
      </section>
          </div>

      {statsOpen && (
        <RunCompletionStatsModal session={session} onClose={() => setStatsOpen(false)} />
      )}
    </>
  );
}

function RunCompletionStatTile({
  icon,
  label,
  value,
  accent,
}: {
  icon: string;
  label: string;
  value: string;
  accent?: 'gold' | 'green' | 'red';
}) {
  return (
    <div className={`run-completion-stat-tile ${accent ? `run-completion-stat-tile-${accent}` : ''}`}>
      <span className="run-completion-stat-icon relative shrink-0 overflow-hidden rounded border">
        <Image src={icon} alt="" fill sizes="40px" className="object-contain p-1.5" unoptimized />
      </span>
      <div className="min-w-0">
        <div className="ui-faint text-[10px] font-black uppercase">{label}</div>
        <div className="ui-value text-lg font-black leading-none">{value}</div>
            </div>
    </div>
  );
}

function RunCompletionStatsModal({ session, onClose }: { session: RunSession; onClose: () => void }) {
  const aliveCount = getAliveRunRoster(session).length;
  const totalDamageDealt = session.battleReports.reduce((total, report) => total + report.damageDealt, 0);
  const totalDamageTaken = session.battleReports.reduce((total, report) => total + report.damageTaken, 0);
  const totalHealing = session.battleReports.reduce((total, report) => total + report.healingDone, 0);
  const totalDurationMs = session.battleReports.reduce((total, report) => total + report.durationMs, 0);
  const victoryReports = session.battleReports.filter(report => report.status === 'victory');

  return (
    <div
      className="run-completion-stats-layer fixed inset-0 z-[69] flex items-center justify-center bg-black/72 p-3 backdrop-blur-sm sm:p-4"
      onClick={onClose}
    >
      <section
        className="run-completion-stats-modal command-panel vine-frame flex max-h-[min(92vh,52rem)] w-full max-w-3xl flex-col overflow-hidden rounded border text-zinc-100"
        onClick={event => event.stopPropagation()}
      >
        <div className="run-completion-stats-header flex shrink-0 items-start justify-between gap-3 border-b border-[rgba(232,217,184,0.12)] px-4 py-3 sm:px-5 sm:py-4">
          <div className="min-w-0">
            <div className="arcane-label">Run Statistics</div>
            <h3 className="fantasy-heading truncate text-xl sm:text-2xl">{session.title}</h3>
            <p className="ui-faint mt-1 text-[11px] font-bold">{getRunReportTitle(session)}</p>
          </div>
          <button type="button" onClick={onClose} className="ui-button shrink-0 rounded px-3 py-1.5 text-xs font-bold">
            Close
          </button>
        </div>

        <div className="min-h-0 flex-1 overflow-y-auto px-4 py-4 sm:px-5">
          <div className="grid gap-2 sm:grid-cols-3">
            <RunCompletionStatTile
              icon={RUN_COMPLETION_STAT_ICONS.wins}
              label="Battles Won"
              value={`${session.wins}/${session.targetBattles}`}
            />
            <RunCompletionStatTile
              icon={RUN_COMPLETION_STAT_ICONS.standing}
              label="Units Standing"
              value={`${aliveCount}/${session.minions.length}`}
              accent="green"
            />
            <RunCompletionStatTile
              icon={RUN_COMPLETION_STAT_ICONS.gold}
              label="Run Gold"
              value={String(session.runGold)}
              accent="gold"
            />
          </div>

          <div className="mt-4">
            <div className="arcane-label mb-2">Road Progress</div>
            <RunProgressPips total={session.targetBattles} completed={session.wins} />
          </div>

          <div className="mt-4 grid grid-cols-2 gap-2 lg:grid-cols-4">
            <RunCompletionStatTile icon={RUN_COMPLETION_STAT_ICONS.time} label="Time Fought" value={formatRunDuration(totalDurationMs)} />
            <RunCompletionStatTile icon={RUN_COMPLETION_STAT_ICONS.damage} label="Damage Dealt" value={String(totalDamageDealt)} />
            <RunCompletionStatTile icon={RUN_COMPLETION_STAT_ICONS.taken} label="Damage Taken" value={String(totalDamageTaken)} accent="red" />
            <RunCompletionStatTile icon={RUN_COMPLETION_STAT_ICONS.healing} label="Healing Done" value={String(totalHealing)} accent="green" />
          </div>

          <div className="mt-4 grid grid-cols-2 gap-2">
            <RunCommanderStat label="Army" value={session.stats.armyPower} icon={COMMANDER_STAT_ICONS.Army} />
            <RunCommanderStat label="Ward" value={session.stats.defensivePower} icon={COMMANDER_STAT_ICONS.Ward} />
            <RunCommanderStat label="Morale" value={session.stats.morale} icon={COMMANDER_STAT_ICONS.Morale} />
            <RunCommanderStat label="Spell" value={session.stats.spellPower} icon={COMMANDER_STAT_ICONS.Spell} />
          </div>

          {victoryReports.length > 0 && (
    <div className="run-history-strip mt-5 rounded border p-3">
      <div className="mb-3 flex items-center justify-between gap-3">
        <div>
          <div className="arcane-label">Road History</div>
                  <h4 className="fantasy-heading text-lg">Commanders Defeated</h4>
        </div>
                <span className="ui-pill rounded border px-2 py-1 text-[10px] font-black">{victoryReports.length} wins</span>
      </div>
      <div className="run-history-commanders">
                {victoryReports.map((report, index) => {
                  const boss = report.enemyPersonality === 'boss' || index === victoryReports.length - 1;

          return (
            <div key={report.id} className={`run-history-commander rounded border p-2 ${boss ? 'run-history-commander-boss' : ''}`}>
              <span className="run-history-portrait relative mx-auto block overflow-hidden rounded">
                <Image
                  src={report.enemyAssetPath || '/assets/playermodel1.png'}
                  alt={report.enemyName}
                  fill
                  className="object-contain"
                  sizes="72px"
                  unoptimized
                />
              </span>
              <div className="mt-2 truncate text-center text-xs font-black text-zinc-100">{report.enemyName}</div>
              <div className="ui-faint text-center text-[10px] font-black uppercase">
                {boss ? 'Boss' : `Lv ${report.enemyLevel || 1}`}
              </div>
            </div>
          );
        })}
      </div>
            </div>
          )}

          {session.battleReports.length > 0 && (
            <div className="mt-5 space-y-2">
              <div className="flex items-center justify-between gap-3 border-b border-[rgba(232,217,184,0.12)] pb-2">
                <h4 className="fantasy-heading text-lg">Combat Log</h4>
                <span className="ui-faint text-xs font-bold">{session.battleReports.length} fights</span>
              </div>
              {session.battleReports.map(report => (
                <RunBattleReportCard key={report.id} report={report} />
              ))}
            </div>
          )}
        </div>
      </section>
    </div>
  );
}

function RunBattleReportCard({ report }: { report: RunBattleReport }) {
  return (
    <div className="run-battle-report rounded border p-3">
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div className="flex min-w-0 items-start gap-3">
          <span className="run-history-portrait relative shrink-0 overflow-hidden rounded">
            <Image
              src={report.enemyAssetPath || '/assets/playermodel1.png'}
              alt={report.enemyName}
              fill
              className="object-contain"
              sizes="72px"
              unoptimized
            />
          </span>
          <div className="min-w-0">
          <div className="arcane-label">{report.status === 'victory' ? 'Won' : 'Lost'} - Round {report.round}</div>
          <div className="fantasy-heading text-base">{report.enemyName}</div>
          </div>
        </div>
        <div className="flex flex-wrap gap-2">
          <span className="ui-pill rounded border px-2 py-1 text-[10px] font-black">{formatRunDuration(report.durationMs)}</span>
          <span className="ui-pill rounded border px-2 py-1 text-[10px] font-black">{report.damageDealt} dmg</span>
          <span className="ui-pill rounded border px-2 py-1 text-[10px] font-black">{report.healingDone} heal</span>
        </div>
      </div>

      <div className="mt-3 grid gap-2 sm:grid-cols-2">
        {report.unitReports.map(unit => (
          <div key={unit.id} className={`run-unit-report flex items-center gap-2 rounded px-2 py-1.5 ${unit.alive ? '' : 'opacity-45'}`}>
            <span className="ui-icon-frame relative block h-9 w-9 shrink-0 overflow-hidden rounded border">
              <Image
                src={unit.assetPath}
                alt={unit.name}
                fill
                className="run-minion-portrait-image run-ui-art object-contain"
                sizes="36px"
                unoptimized
              />
            </span>
            <div className="min-w-0 flex-1">
              <div className="truncate text-xs font-black text-zinc-100">{unit.name}</div>
              <div className="ui-faint truncate text-[10px] font-bold">
                {unit.damageDealt} dealt - {unit.damageTaken} taken - {unit.healingDone} healed
              </div>
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}

function formatRunTierShort(tier: MinionTemplate['tier']): string {
  if (tier === 'tier3') return 'T3';
  if (tier === 'tier2') return 'T2';
  return 'T1';
}

function formatRunClassShort(minionClass: MinionTemplate['class']): string {
  if (minionClass === 'wizard') return 'Wiz';
  if (minionClass === 'knight') return 'Kni';
  if (minionClass === 'templar') return 'Tmp';
  return 'Prs';
}

function getRunUnitDisplayHealth(unit: RunUnit, template: MinionTemplate): { current: number; max: number } {
  const max = template.stats.health;
  if (!unit.alive) return { current: 0, max };
  if (typeof unit.stack.runCurrentHealth === 'number') {
    return {
      current: Math.max(0, Math.min(max, Math.round(unit.stack.runCurrentHealth))),
      max,
    };
  }
  return { current: max, max };
}

function RunRosterListItem({ unit, template }: { unit: RunUnit; template: MinionTemplate }) {
  const health = getRunUnitDisplayHealth(unit, template);
  const hpRatio = health.max > 0 ? health.current / health.max : 0;
  const wounded = unit.alive && health.current < health.max;

  return (
    <RunRosterHoverTip
      side="right"
      popover={<RunRosterUnitTooltip template={template} alive={unit.alive} health={health} />}
    >
      <div
        className={`run-roster-row run-roster-row-${template.tier} ${unit.alive ? '' : 'run-roster-row-fallen'} ${wounded ? 'run-roster-row-wounded' : ''}`}
        role="listitem"
        tabIndex={0}
      >
        <div className="run-roster-row-top">
          <span className="run-roster-row-tags">
            {formatRunTierShort(template.tier)} · {formatRunClassShort(template.class)}
          </span>
          <span className="run-roster-row-name">{template.name}</span>
          <span className="run-roster-row-hp">
            {unit.alive ? `${health.current}/${health.max}` : 'Fallen'}
          </span>
        </div>
        {unit.alive && (
          <div className="run-roster-row-hpbar" aria-hidden="true">
            <span className="run-roster-row-hpfill" style={{ width: `${Math.round(hpRatio * 100)}%` }} />
          </div>
        )}
      </div>
    </RunRosterHoverTip>
  );
}

function RunRoster({
  session,
  variant = 'default',
  onEquipGear,
  onUnequipGear,
}: {
  session: RunSession;
  variant?: 'default' | 'map';
  onEquipGear?: (equipmentId: string) => void;
  onUnequipGear?: (slot: EquipmentSlot) => void;
}) {
  const aliveCount = getAliveRunRoster(session).length;
  const showGearPanel = session.mode === 'daily' && Boolean(onEquipGear && onUnequipGear);
  const organizedRoster = session.mode !== 'daily';
  const [rosterSort, setRosterSort] = useState<'tier' | 'class' | 'name'>('tier');
  const tierRank = { tier1: 1, tier2: 2, tier3: 3 } as const;
  const displayedMinions = organizedRoster
    ? [...session.minions].sort((left, right) => {
        if (left.alive !== right.alive) return left.alive ? -1 : 1;
        const leftTemplate = getMinionTemplate(left.stack.templateId);
        const rightTemplate = getMinionTemplate(right.stack.templateId);
        if (rosterSort === 'tier') {
          const tierDifference = (tierRank[rightTemplate?.tier || 'tier1'] || 0) - (tierRank[leftTemplate?.tier || 'tier1'] || 0);
          if (tierDifference !== 0) return tierDifference;
        }
        if (rosterSort === 'class') {
          const classDifference = (leftTemplate?.class || '').localeCompare(rightTemplate?.class || '');
          if (classDifference !== 0) return classDifference;
        }
        return (leftTemplate?.name || left.stack.templateId).localeCompare(rightTemplate?.name || right.stack.templateId);
      })
    : session.minions;

  return (
    <aside className={`run-roster-aside flex min-h-0 flex-col gap-3 ${variant === 'map' ? 'run-roster-aside-map' : ''}`}>
      <section className={`run-roster-list ui-card min-h-0 overflow-y-auto rounded border p-2 ${showGearPanel && variant === 'map' ? 'run-roster-list-with-gear' : 'flex-1'}`}>
        <div className="run-roster-list-head">
          <h3 className="fantasy-heading text-sm font-black">Run Roster</h3>
          <span className="ui-faint text-xs font-bold">{aliveCount}/{session.minions.length}</span>
        </div>
        {organizedRoster && (
          <div className="run-roster-sort" aria-label="Sort run roster">
            {(['tier', 'class', 'name'] as const).map(option => (
              <button
                key={option}
                type="button"
                onClick={() => setRosterSort(option)}
                className={rosterSort === option ? 'run-roster-sort-active' : ''}
              >
                {option}
              </button>
            ))}
          </div>
        )}

          {session.minions.length === 0 ? (
          <div className="ui-empty rounded border border-dashed px-3 py-4 text-center text-xs font-bold">
              No units drafted.
            </div>
          ) : (
          <div className="run-roster-rows" role="list">
            {displayedMinions.map(unit => {
              const template = getMinionTemplate(unit.stack.templateId);
              if (!template) return null;
              return <RunRosterListItem key={unit.stack.id} unit={unit} template={template} />;
            })}
          </div>
        )}
      </section>

      {showGearPanel && (
        <RunGearPanel
          session={session}
          variant={variant}
          commanderModel={session.commanderModel}
          onEquip={onEquipGear!}
          onUnequip={onUnequipGear!}
        />
      )}

      <RunGoldStrip session={session} variant={variant} />
    </aside>
  );
}

function runEquipmentRarityClass(rarity: EquipmentRarity): string {
  if (rarity === 'legendary') return 'ui-rarity-legendary';
  if (rarity === 'epic') return 'ui-rarity-epic';
  if (rarity === 'rare') return 'ui-rarity-rare';
  return 'ui-rarity-decent';
}

const RUN_GEAR_SLOT_ABBR: Record<EquipmentSlot, string> = {
  sword: 'S',
  shield: 'Sh',
  helmet: 'H',
  armor: 'C',
  'armor-pants': 'L',
  gloves: 'G',
  boots: 'B',
};

function RunGearPanel({
  session,
  variant,
  commanderModel,
  onEquip,
  onUnequip,
}: {
  session: RunSession;
  variant: 'default' | 'map';
  commanderModel: PlayerModelNumber;
  onEquip: (equipmentId: string) => void;
  onUnequip: (slot: EquipmentSlot) => void;
}) {
  const unequipped = getUnequippedRunEquipment(session);
  const equippedCount = Object.keys(session.runEquippedSlots).length;
  const commanderAsset = getPlayerModelAsset(commanderModel);

              return (
    <section className={`run-gear-panel ui-card min-h-0 rounded border p-2 ${variant === 'map' ? 'run-gear-panel-map' : ''}`}>
      <div className="run-gear-panel-head">
        <h3 className="fantasy-heading text-sm font-black">Commander Gear</h3>
        <span className="ui-faint text-[10px] font-bold">{equippedCount}/{RUN_EQUIPMENT_SLOTS.length}</span>
                  </div>

      <div className="run-gear-stage">
        <div className="run-gear-stage-backdrop" aria-hidden="true">
          <Image
            src={commanderAsset}
            alt=""
            fill
            sizes="220px"
            className="run-gear-commander-sprite object-contain"
            unoptimized
          />
          <span className="run-gear-stage-vignette" />
                </div>

        <div className="run-gear-doll">
          {RUN_EQUIPMENT_LAYOUT.map((row, rowIndex) => (
            <div key={rowIndex} className="run-gear-doll-row">
              {row.map(slot => {
                const item = getEquippedRunItem(session, slot);

                if (!item) {
                  return (
                    <button
                      key={slot}
                      type="button"
                      className="run-gear-square run-gear-square-empty rounded border"
                      disabled
                      aria-label={`${RUN_EQUIPMENT_SLOT_LABELS[slot]} slot empty`}
                    >
                      <span className="run-gear-square-placeholder">
                        <span className="run-gear-square-abbr">{RUN_GEAR_SLOT_ABBR[slot]}</span>
                      </span>
                    </button>
                  );
                }

                const slotButton = (
                  <button
                    type="button"
                    className={`run-gear-square rounded border ${runEquipmentRarityClass(item.rarity)}`}
                    onClick={() => onUnequip(slot)}
                    aria-label={`Unequip ${item.name}`}
                  >
                    <span className="run-gear-square-icon relative overflow-hidden">
                      <Image
                        src={getRunEquipmentIconPath(item)}
                        alt=""
                        fill
                        sizes="56px"
                        className="object-contain p-1"
                        style={{ imageRendering: 'pixelated' }}
                      />
                    </span>
                  </button>
                );

                return (
                  <RunRosterHoverTip
                    key={slot}
                    side="right"
                    popoverClassName="run-gear-hover-popover"
                    popover={(
                      <RunEquipmentTooltip
                        item={item}
                        actionHint="Click to unequip"
                      />
                    )}
                  >
                    {slotButton}
                  </RunRosterHoverTip>
                );
              })}
        </div>
          ))}
        </div>
      </div>

      <div className="run-gear-satchel-head">
        <span className="arcane-label">Run Satchel</span>
        <span className="ui-faint text-[10px] font-bold">{unequipped.length}/{RUN_MAX_EQUIPMENT_BAG}</span>
      </div>

      {unequipped.length === 0 ? (
        <div className="run-gear-satchel-empty ui-faint rounded border border-dashed px-2 text-center text-[10px] font-bold uppercase">
          Win battles for gear drops
        </div>
      ) : (
        <div className={`run-gear-satchel-grid ${unequipped.length > 8 ? 'run-gear-satchel-grid-scroll' : ''}`}>
          {unequipped.map(item => {
            const equippedInSlot = getEquippedRunItem(session, item.slot);
            const compareEquipped = equippedInSlot && equippedInSlot.id !== item.id ? equippedInSlot : undefined;

            return (
            <RunRosterHoverTip
              key={item.id}
              side="right"
              popoverClassName="run-gear-hover-popover"
              popover={(
                <RunEquipmentTooltip
                  item={item}
                  compareEquipped={compareEquipped}
                  actionHint="Click to equip"
                />
              )}
            >
              <button
                type="button"
                className={`run-gear-square run-gear-satchel-item rounded border ${runEquipmentRarityClass(item.rarity)}`}
                style={{ width: 'var(--run-gear-satchel-cell)', height: 'var(--run-gear-satchel-cell)' }}
                onClick={() => onEquip(item.id)}
                aria-label={`Equip ${item.name}`}
              >
                <span className="run-gear-square-icon relative overflow-hidden">
                  <Image
                    src={getRunEquipmentIconPath(item)}
                    alt=""
                    fill
                    sizes="48px"
                    className="object-contain p-1"
                    style={{ imageRendering: 'pixelated' }}
                  />
                </span>
              </button>
            </RunRosterHoverTip>
            );
          })}
        </div>
      )}
      </section>
  );
}

function RunEquipmentTooltip({
  item,
  compareEquipped,
  actionHint,
}: {
  item: Equipment;
  compareEquipped?: Equipment;
  actionHint?: string;
}) {
  const statRows = getRunEquipmentStatRows(item, compareEquipped);

  return (
    <div className="run-gear-tip">
      <div className={`run-gear-tip-title ${runEquipmentRarityClass(item.rarity)}`}>{item.name}</div>
      <div className="run-gear-tip-meta">
        {RUN_EQUIPMENT_SLOT_LABELS[item.slot]} · {formatEquipmentRarityLabel(item.rarity)}
      </div>

      {statRows.length > 0 ? (
        <div className="run-gear-tip-stats" role="list">
          {statRows.map(row => (
            <div key={row.key} className="run-gear-tip-stat" role="listitem">
              <span className="run-gear-tip-stat-label">{row.label}</span>
              <span className="run-gear-tip-stat-value">+{row.value}</span>
              {compareEquipped && row.delta !== 0 && (
                <span className={`run-gear-tip-stat-delta ${row.delta > 0 ? 'run-gear-tip-stat-delta-up' : 'run-gear-tip-stat-delta-down'}`}>
                  {row.delta > 0 ? `+${row.delta}` : row.delta}
                </span>
              )}
            </div>
          ))}
        </div>
      ) : (
        <div className="run-gear-tip-copy">Commander gear</div>
      )}

      {compareEquipped && (
        <div className="run-gear-tip-compare">
          <span className="run-gear-tip-compare-label">Compared to equipped</span>
          <span className={`run-gear-tip-compare-name ${runEquipmentRarityClass(compareEquipped.rarity)}`}>
            {compareEquipped.name}
          </span>
        </div>
      )}

      {item.passive && (
        <div className="run-gear-tip-copy run-gear-tip-passive">{item.passive}</div>
      )}

      {actionHint && (
        <div className="run-gear-tip-hint">{actionHint}</div>
      )}
    </div>
  );
}

function RunRosterHoverTip({
  children,
  popover,
  side = 'right',
  popoverClassName = '',
}: {
  children: ReactNode;
  popover: ReactNode;
  side?: 'right' | 'left';
  popoverClassName?: string;
}) {
  const anchorRef = useRef<HTMLDivElement>(null);
  const [open, setOpen] = useState(false);
  const [coords, setCoords] = useState({ top: 0, left: 0 });

  const updatePosition = useCallback(() => {
    const anchor = anchorRef.current;
    if (!anchor) return;
    const rect = anchor.getBoundingClientRect();
    const gap = 12;
    if (side === 'left') {
      setCoords({ top: rect.top + rect.height / 2, left: rect.left - gap });
      return;
    }
    setCoords({ top: rect.top + rect.height / 2, left: rect.right + gap });
  }, [side]);

  const show = () => {
    updatePosition();
    setOpen(true);
  };

  const hide = () => setOpen(false);

  useEffect(() => {
    if (!open) return;
    const handle = () => updatePosition();
    window.addEventListener('scroll', handle, true);
    window.addEventListener('resize', handle);
    return () => {
      window.removeEventListener('scroll', handle, true);
      window.removeEventListener('resize', handle);
    };
  }, [open, updatePosition]);

  return (
    <div
      ref={anchorRef}
      className="run-roster-hover-anchor"
      onMouseEnter={show}
      onMouseLeave={hide}
      onFocus={show}
      onBlur={hide}
    >
      {children}
      {open && typeof document !== 'undefined' && createPortal(
        <div
          className={`run-roster-hover-popover run-roster-hover-popover-${side}${popoverClassName ? ` ${popoverClassName}` : ''} rounded border`}
          role="tooltip"
          style={{ top: coords.top, left: coords.left }}
        >
          {popover}
        </div>,
        document.body,
      )}
    </div>
  );
}

function RunRosterUnitTooltip({
  template,
  alive,
  health,
}: {
  template: MinionTemplate;
  alive: boolean;
  health?: { current: number; max: number };
}) {
  const resolvedHealth = health || { current: template.stats.health, max: template.stats.health };

  return (
    <>
      <div className="run-roster-tip-title">{template.name}</div>
      <div className="run-roster-tip-meta">
        {alive
          ? `${MINION_CLASS_LABELS[template.class]} · ${MINION_TIER_LABELS[template.tier]} · ${resolvedHealth.current}/${resolvedHealth.max} HP`
          : 'Fallen'}
      </div>
      {alive && (
        <div className="run-roster-tip-stats">
          <span>ATK {template.stats.attack}</span>
          <span>DEF {template.stats.defense}</span>
          <span>HP {template.stats.health}</span>
          <span>MOV {template.stats.movement}</span>
          <span>MAG {template.stats.magic}</span>
          <span>RNG {template.stats.range}</span>
        </div>
      )}
      <p className="run-roster-tip-copy">{template.role}</p>
    </>
  );
}

function MinionPortrait({ template, size = 'small' }: { template: MinionTemplate; size?: 'tiny' | 'formation' | 'small' | 'large' | 'map' | 'roster' }) {
  const dimensions = size === 'large'
    ? 'h-28 w-28'
    : size === 'formation'
      ? 'h-full w-full'
      : size === 'map'
        ? 'h-[4.35rem] w-[4.35rem]'
        : size === 'roster'
          ? 'h-16 w-16'
      : size === 'tiny'
        ? 'h-12 w-12'
        : 'h-14 w-14';

  return (
    <span className={`run-minion-portrait ui-icon-frame relative mx-auto block shrink-0 overflow-hidden rounded border ${dimensions}`}>
      <Image
        src={`${MINION_ICON_BASE}/${template.assetName}`}
        alt={template.name}
        fill
        className="run-minion-portrait-image run-ui-art object-contain"
        sizes={size === 'large' ? '112px' : size === 'formation' ? '84px' : size === 'map' ? '70px' : size === 'roster' ? '64px' : size === 'tiny' ? '48px' : '56px'}
        unoptimized
      />
    </span>
  );
}

const COMMANDER_STAT_ICONS = {
  Army: '/assets/icons/attack.png',
  Ward: '/assets/icons/defense.png',
  Morale: '/assets/icons/speed.png',
  Spell: '/assets/icons/magic.png',
} as const;

function RunMapStatTile({
  icon,
  label,
  value,
  tone,
}: {
  icon: string;
  label: string;
  value: string;
  tone?: 'gold';
}) {
  return (
    <span className={`run-map-stat-tile${tone ? ` run-map-stat-tile-${tone}` : ''}`} title={label}>
      <Image src={icon} alt="" width={22} height={22} className="run-map-stat-tile-icon" unoptimized />
      <span className="run-map-stat-tile-copy">
        <span className="run-map-stat-tile-label">{label}</span>
        <span className="run-map-stat-tile-value">{value}</span>
      </span>
    </span>
  );
}

function RunGoldStrip({
  session,
  variant = 'default',
}: {
  session: RunSession;
  variant?: 'default' | 'map';
}) {
  return (
    <div className={`run-roster-gold-strip ui-card w-full shrink-0 rounded border ${variant === 'map' ? 'run-roster-gold-strip-map' : ''}`}>
      <RunMapStatTile icon={RUN_GOLD_ICON} label="Run Gold" value={String(session.runGold)} tone="gold" />
    </div>
  );
}

function RunCommanderStat({
  label,
  value,
  icon,
}: {
  label: keyof typeof COMMANDER_STAT_ICONS;
  value: number;
  icon: string;
}) {
  return (
    <div className="run-commander-stat ui-card flex items-center gap-3 rounded border p-3">
      <span className="run-commander-stat-icon ui-icon-frame relative h-10 w-10 shrink-0 overflow-hidden rounded border">
        <Image src={icon} alt="" fill sizes="40px" className="object-contain p-1.5" unoptimized />
      </span>
      <div className="min-w-0">
        <div className="ui-faint text-[10px] font-black uppercase">{label}</div>
        <div className="ui-value text-xl font-black leading-none">{value}</div>
      </div>
    </div>
  );
}

function RunProgressPips({ total, completed }: { total: number; completed: number }) {
  return (
    <div className="ui-card rounded border p-4">
      <div className="grid gap-2" style={{ gridTemplateColumns: `repeat(${total}, minmax(0, 1fr))` }}>
        {Array.from({ length: total }, (_, index) => (
          <span
            key={index}
            className={`h-3 rounded border ${index < completed ? 'border-emerald-200/60 bg-emerald-300/70' : 'border-[rgba(232,217,184,0.18)] bg-black/30'}`}
          />
        ))}
      </div>
    </div>
  );
}

function RunResultPill({ label, value }: { label: string; value: string }) {
  return (
    <div className="battle-result-stat rounded border px-3 py-2">
      <div className="text-[10px] font-black uppercase text-[var(--ui-faint)]">{label}</div>
      <div className="ui-value mt-0.5 text-sm font-black">{value}</div>
    </div>
  );
}

function getDailyRunSessionKey(username: string, dateKey: string): string {
  return `${DAILY_RUN_SESSION_PREFIX}_${username}_${dateKey}`;
}

function getRandomRunSessionKey(username: string): string {
  return getDailyRunSessionKey(username, RANDOM_RUN_ACTIVE_SESSION_KEY);
}

function serializeRunSession(username: string, session: RunSession): StoredRunSession {
  const persistedSession = session.celebrationResume
    ? { ...session.celebrationResume, celebrationResume: undefined, pendingRunCelebrations: [] }
    : session;
  const { rewardChoices, celebrationResume: _celebrationResume, ...storedSession } = persistedSession;
  return {
    ...storedSession,
    rewardChoiceIds: rewardChoices.map(choice => choice.id),
    rewardEquipmentOffers: rewardChoices
      .filter(choice => choice.equipmentOffer)
      .map(choice => ({ choiceId: choice.id, equipment: choice.equipmentOffer! })),
    savedAt: Date.now(),
    ownerUsername: username,
    dateKey: session.dailyChallenge?.date || RANDOM_RUN_ACTIVE_SESSION_KEY,
  };
}

function hydrateRunSession(
  storedSession: StoredRunSession | null,
  challenge?: DailyRunChallenge,
  user?: User,
): RunSession | null {
  if (!storedSession || storedSession.mode !== 'daily') return null;
  if (storedSession.phase === 'complete' || storedSession.rewardClaimed) return null;
  const resolvedChallenge = storedSession.dailyChallenge || challenge || createRandomRunChallenge();
  const progressionUnlocks = getRunProgressionUnlocks(getDailyRunState(user));
  const { rewardChoiceIds, rewardEquipmentOffers, savedAt, ownerUsername, dateKey, ...session } = storedSession;
  void savedAt;
  void ownerUsername;
  void dateKey;

  const restoreRewardChoice = (choiceId: string): RunRewardChoice | undefined => {
    const staticChoice = RUN_REWARD_POOL.find(choice => choice.id === choiceId);
    if (staticChoice) return staticChoice;
    const storedEquipment = rewardEquipmentOffers?.find(offer => offer.choiceId === choiceId);
    if (storedEquipment) return restoreRunEquipmentReward(storedEquipment.choiceId, storedEquipment.equipment);
    return undefined;
  };

  const equipmentState = {
    runEquipment: storedSession.runEquipment || [],
    runEquippedSlots: storedSession.runEquippedSlots || {},
  };

  const freshNodes = createDailyRunNodes(resolvedChallenge, storedSession.stats?.level || 1);
  const storedNodes = storedSession.nodes?.length ? normalizeDailyRunNodes(storedSession.nodes) : [];
  const refreshStoredRoad = storedSession.wins === 0 && (
    !storedNodes.length ||
    !hasBranchNodeLayout(storedNodes) ||
    storedSession.targetBattles < resolvedChallenge.targetBattles
  );
  const nodes = refreshStoredRoad ? freshNodes : storedNodes.length ? storedNodes : freshNodes;

  const spellIds = storedSession.spellIds?.length ? storedSession.spellIds.slice(0, 4) : pickRunSpellLoadout(resolvedChallenge.date);
  const knownSpellIds = storedSession.knownSpellIds?.length
    ? storedSession.knownSpellIds
    : getInitialRunKnownSpellIds(spellIds);
  const restoredSetup = normalizeRunSetup(null, {
    commanderModel: storedSession.commanderModel,
    runLength: storedSession.runLengthId,
  });
  const restoredCommanderProfile = getRunCommanderProfile(restoredSetup.commanderModel);
  const restoredRunLength = getRunLengthOption(restoredSetup.runLength);

  return {
    ...session,
    ...equipmentState,
    minions: applyRunCommanderUnitBonusesToUnits(session.minions, restoredCommanderProfile),
    commanderModel: restoredSetup.commanderModel,
    commanderPassiveName: storedSession.commanderPassiveName || restoredCommanderProfile.passiveName,
    commanderPassiveSummary: storedSession.commanderPassiveSummary || restoredCommanderProfile.passiveSummary,
    runLengthId: restoredSetup.runLength,
    runLengthName: storedSession.runLengthName || restoredRunLength.title,
    runLengthRewardMultiplier: storedSession.runLengthRewardMultiplier || restoredRunLength.rewardMultiplier,
    targetBattles: refreshStoredRoad
      ? normalizeRandomRunBattleCount(resolvedChallenge.targetBattles)
      : normalizeRandomRunBattleCount(session.targetBattles),
    dailyChallenge: resolvedChallenge,
    formation: storedSession.formation || makeDefaultFormation(storedSession.minions.filter(unit => unit.alive).map(unit => unit.stack)),
    spellIds,
    knownSpellIds,
    nodes,
    battleReports: storedSession.battleReports || [],
    rewardChoices: rewardChoiceIds
      .map(restoreRewardChoice)
      .filter((choice): choice is RunRewardChoice => Boolean(choice)),
    shopOffers: storedSession.shopOffers || {},
    shopRerollsRemaining: typeof storedSession.shopRerollsRemaining === 'number'
      ? storedSession.shopRerollsRemaining
      : RUN_SHOP_REROLL_COUNT + progressionUnlocks.shopRerollBonus,
    blessingRerollsRemaining: typeof storedSession.blessingRerollsRemaining === 'number'
      ? storedSession.blessingRerollsRemaining
      : RUN_BLESSING_REROLL_COUNT,
    omenRerollsRemaining: typeof storedSession.omenRerollsRemaining === 'number'
      ? storedSession.omenRerollsRemaining
      : RUN_OMEN_REROLL_COUNT + progressionUnlocks.omenRerollBonus,
    pendingPositiveOmen: Boolean(storedSession.pendingPositiveOmen),
    pendingRunCelebrations: storedSession.pendingRunCelebrations || [],
    startedAt: storedSession.startedAt || Date.now(),
    bossHistory: storedSession.bossHistory || [],
    shopBuyHistory: storedSession.shopBuyHistory || [],
    omenHistory: storedSession.omenHistory || [],
    permanentSpellUnlocks: storedSession.permanentSpellUnlocks || [],
    runGearRarityCap: storedSession.runGearRarityCap || progressionUnlocks.maxGearRarity,
  };
}

function loadDailyRunSession(user: User, challenge?: DailyRunChallenge): RunSession | null {
  return hydrateRunSession(
    readGameJson<StoredRunSession | null>(getRandomRunSessionKey(user.username), null),
    challenge,
    user,
  );
}

export interface SavedDailyRunSummary {
  title: string;
  phase: RunPhase;
  phaseLabel: string;
  wins: number;
  targetBattles: number;
  unitsStanding: number;
  totalUnits: number;
  runGold: number;
}

function getRunPhaseLabel(phase: RunPhase): string {
  switch (phase) {
    case 'draft': return 'Draft';
    case 'map': return 'Path';
    case 'formation': return 'Formation';
    case 'battle': return 'Battle';
    case 'reward': return 'Reward';
    case 'shop': return 'Shop';
    case 'event': return 'Event';
    case 'complete': return 'Report';
    default: return 'Run';
  }
}

export function getSavedDailyRunSummary(
  user: User | null | undefined
): SavedDailyRunSummary | null {
  if (!user) return null;

  const session = loadDailyRunSession(user);
  if (!session || session.rewardClaimed) return null;

  return {
    title: session.title,
    phase: session.phase,
    phaseLabel: getRunPhaseLabel(session.phase),
    wins: session.wins,
    targetBattles: session.targetBattles,
    unitsStanding: getAliveRunRoster(session).length,
    totalUnits: session.minions.length,
    runGold: session.runGold,
  };
}

function saveDailyRunSession(username: string, session: RunSession): void {
  writeGameJson(getRandomRunSessionKey(username), serializeRunSession(username, session));
}

function clearDailyRunSession(username: string): void {
  removeGameStorageItem(getRandomRunSessionKey(username));
}

function getRunLengthOption(runLength: RunLengthId | undefined): RunLengthOption {
  return RUN_LENGTH_OPTIONS.find(option => option.id === runLength)
    || RUN_LENGTH_OPTIONS.find(option => option.id === DEFAULT_RUN_SETUP.runLength)
    || RUN_LENGTH_OPTIONS[0];
}

function getRunCommanderProfile(model: number | undefined): RunCommanderProfile {
  return RUN_COMMANDER_PROFILES.find(profile => profile.model === model) || RUN_COMMANDER_PROFILES[2];
}

function normalizeRunSetup(user?: User | null, setup?: Partial<SingleplayerRunSetup>): SingleplayerRunSetup {
  const commanderModel = [1, 2, 3, 4, 5, 6].includes(setup?.commanderModel || 0)
    ? setup!.commanderModel as PlayerModelNumber
    : (user?.selectedModel || DEFAULT_RUN_SETUP.commanderModel) as PlayerModelNumber;
  const runState = getDailyRunState(user);
  const requestedLength = RUN_LENGTH_OPTIONS.find(option => option.id === setup?.runLength);
  const fallbackLength = getRunLengthOption(DEFAULT_RUN_SETUP.runLength);
  const runLength = requestedLength && runState.runLevel >= requestedLength.minRunLevel
    ? requestedLength.id
    : fallbackLength.id;

  return { commanderModel, runLength };
}

function getRandomRunTargetBattleCount(runLevel: number): number {
  const progress = getRandomRunProgressRatio(runLevel);
  const min = RANDOM_RUN_BALANCE.routeBattleMin;
  const max = RANDOM_RUN_BALANCE.routeBattleMax;
  const span = Math.max(0, max - min);
  const baseline = min + Math.floor(progress * span);
  const roll = span > 0 ? Math.floor(Math.random() * Math.min(2, span + 1)) : 0;

  return clamp(baseline + roll, min, max);
}

function normalizeRandomRunBattleCount(value: number): number {
  return clamp(
    Math.round(value),
    RANDOM_RUN_ABSOLUTE_BATTLE_MIN,
    RANDOM_RUN_BALANCE.routeBattleMax
  );
}

function getRunLengthBattleCount(runLevel: number, option: RunLengthOption, targetBattleBonus: number): number {
  const baseBattleCount = typeof option.fixedBattles === 'number'
    ? option.fixedBattles
    : getRandomRunTargetBattleCount(runLevel);
  return normalizeRandomRunBattleCount(baseBattleCount + targetBattleBonus);
}

function applyRunCommanderProfileStats(stats: CharacterStats, profile: RunCommanderProfile): CharacterStats {
  const maxHealth = stats.maxHealth + (profile.statBonus.maxHealth || 0);
  return {
    ...stats,
    armyPower: stats.armyPower + (profile.statBonus.armyPower || 0),
    defensivePower: stats.defensivePower + (profile.statBonus.defensivePower || 0),
    morale: stats.morale + (profile.statBonus.morale || 0),
    spellPower: stats.spellPower + (profile.statBonus.spellPower || 0),
    maxHealth,
    health: Math.min(maxHealth, stats.health + (profile.statBonus.maxHealth || 0) + (profile.statBonus.health || 0)),
  };
}

function doesCommanderUnitFocusApply(template: MinionTemplate, focus: RunCommanderUnitFocus): boolean {
  if (focus.class && template.class === focus.class) return true;
  if (focus.roleKeywords?.some(keyword => template.role.toLowerCase().includes(keyword))) return true;
  return false;
}

function applyRunCommanderUnitBonusToStack(stack: MinionStack, profile: RunCommanderProfile): MinionStack {
  const template = getMinionTemplate(stack.templateId);
  if (!template || !doesCommanderUnitFocusApply(template, profile.unitFocus)) {
    const { runStatBonus: _runStatBonus, runBonusLabel: _runBonusLabel, ...cleanStack } = stack;
    void _runStatBonus;
    void _runBonusLabel;
    return cleanStack;
  }

  return {
    ...stack,
    runStatBonus: profile.unitFocus.statBonus,
    runBonusLabel: profile.unitFocus.label,
  };
}

function applyRunCommanderUnitBonusesToUnits(units: RunUnit[], profile: RunCommanderProfile): RunUnit[] {
  return units.map(unit => ({
    ...unit,
    stack: applyRunCommanderUnitBonusToStack(unit.stack, profile),
  }));
}

function applyRunCommanderUnitBonusForSession(session: RunSession, stack: MinionStack): MinionStack {
  return applyRunCommanderUnitBonusToStack(stack, getRunCommanderProfile(session.commanderModel));
}

function getRandomRunScaledBattleLevel(playerLevel: number, battleNumber: number, battleCount: number, extra = 0): number {
  const effectiveLevel = getRandomRunEffectiveLevel(playerLevel);
  const progress = battleCount <= 1 ? 1 : (battleNumber - 1) / Math.max(1, battleCount - 1);
  const level = 1
    + Math.round((effectiveLevel - 1) * 0.55)
    + Math.round((RANDOM_RUN_BALANCE.enemyLevelCap - 1) * progress * 0.35)
    + extra;

  return clamp(level, 1, RANDOM_RUN_BALANCE.enemyLevelCap);
}

function createRandomRunChallenge(user?: User, setup?: Partial<SingleplayerRunSetup>): DailyRunChallenge {
  const now = Date.now();
  const randomOffset = Math.floor(Math.random() * 4200) * 86_400_000 + Math.floor(Math.random() * 86_400_000);
  const base = getDailyRunChallenge(now + randomOffset);
  const runState = getDailyRunState(user);
  const runIndex = runState.completions + 1;
  const runSetup = normalizeRunSetup(user, setup);
  const runLength = getRunLengthOption(runSetup.runLength);
  const targetBattleBonus = base.modifiers.reduce((total, modifier) => total + (modifier.targetBattleBonus || 0), 0);
  const targetBattles = getRunLengthBattleCount(runState.runLevel, runLength, targetBattleBonus);
  const finalBoss = getBossProfileByIndex(runIndex + Math.floor(Math.random() * 8));

  return {
    ...base,
    date: `random-${now}-${Math.random().toString(16).slice(2)}`,
    name: `${runLength.title}: ${base.name}`,
    subtitle: `${runLength.description} Random roguelike road.`,
    targetBattles,
    enemyLevelOffset: (base.enemyLevelOffset || 0) + runLength.enemyLevelOffset,
    rewardExpMultiplier: roundToTwo((base.rewardExpMultiplier || 1) * runLength.rewardMultiplier),
    rewardGoldMultiplier: roundToTwo((base.rewardGoldMultiplier || 1) * runLength.rewardMultiplier),
    bossId: finalBoss.id,
    bossName: finalBoss.name,
    bossSubtitle: finalBoss.subtitle,
    bossStory: finalBoss.story,
    bossIntro: finalBoss.intro,
    bossArtworkPath: finalBoss.assetPath,
    bossModelNumber: finalBoss.modelNumber,
    weeklyRewardName: 'Run Progression',
    weeklyRewardDescription: 'Permanent run XP and rare spell unlock chances.',
    weeklyRewardItemId: undefined,
  };
}

function roundToTwo(value: number): number {
  return Math.round(value * 100) / 100;
}

function getRandomRunBaseStats(user: User, setup?: Partial<SingleplayerRunSetup>): CharacterStats {
  const runState = getDailyRunState(user);
  const permanent = runState.permanentStats;
  const effectiveLevel = getRandomRunEffectiveLevel(runState.runLevel);
  const maxHealth = 96 + permanent.maxHealth + (effectiveLevel - 1) * 4;

  const baseStats: CharacterStats = {
    armyPower: 5 + permanent.armyPower + Math.floor(permanent.unitPower / 2),
    defensivePower: 5 + permanent.defensivePower + Math.floor(permanent.unitWard / 2),
    morale: 5 + permanent.morale,
    spellPower: 3 + permanent.spellPower,
    health: maxHealth,
    maxHealth,
    level: effectiveLevel,
    unallocatedPoints: 0,
  };

  return applyRunCommanderProfileStats(baseStats, getRunCommanderProfile(normalizeRunSetup(user, setup).commanderModel));
}

function createDailySession(user: User, dailyChallenge = createRandomRunChallenge(user), setup?: Partial<SingleplayerRunSetup>): RunSession {
  const runSetup = normalizeRunSetup(user, setup);
  const commanderProfile = getRunCommanderProfile(runSetup.commanderModel);
  const runLength = getRunLengthOption(runSetup.runLength);
  const runStats = getRandomRunBaseStats(user, runSetup);
  const nodes = createDailyRunNodes(dailyChallenge, runStats.level || 1);
  const spellIds = pickRunSpellLoadout(dailyChallenge.date);
  const progressionUnlocks = getRunProgressionUnlocks(getDailyRunState(user));

  return {
    id: `random-run-${Date.now()}-${Math.random().toString(16).slice(2)}`,
    mode: 'daily',
    title: dailyChallenge.name,
    phase: 'draft',
    stats: applyDailyChallengeStats(cloneRunStats(runStats), dailyChallenge),
    commanderModel: runSetup.commanderModel,
    commanderPassiveName: commanderProfile.passiveName,
    commanderPassiveSummary: commanderProfile.passiveSummary,
    runLengthId: runSetup.runLength,
    runLengthName: runLength.title,
    runLengthRewardMultiplier: runLength.rewardMultiplier,
    minions: [],
    draftChoices: getDraftChoices(0),
    wins: 0,
    targetBattles: normalizeRandomRunBattleCount(dailyChallenge.targetBattles),
    runGold: 0,
    activeEnemy: null,
    formation: {},
    spellIds,
    knownSpellIds: getRunStartingKnownSpellIds(spellIds, user),
    rewardChoices: [],
    rewardDestination: null,
    nodes,
    currentNodeIndex: 0,
    battleReports: [],
    outcome: null,
    dailyChallenge,
    shopOffers: {},
    shopRerollsRemaining: RUN_SHOP_REROLL_COUNT + progressionUnlocks.shopRerollBonus,
    blessingRerollsRemaining: RUN_BLESSING_REROLL_COUNT,
    omenRerollsRemaining: RUN_OMEN_REROLL_COUNT + progressionUnlocks.omenRerollBonus,
    pendingPositiveOmen: false,
    pendingRunCelebrations: [],
    startedAt: Date.now(),
    bossHistory: [],
    shopBuyHistory: [],
    omenHistory: [],
    permanentSpellUnlocks: [],
    runGearRarityCap: progressionUnlocks.maxGearRarity,
    ...createEmptyRunEquipmentState(),
  };
}

function createRosterRunUnits(user: User, prefix: string): RunUnit[] {
  const ordered = getOrderedMinions(user).filter(stack => !isMinionInjured(stack));
  const activeIds = new Set(
    ordered
      .filter(stack => stack.fielded)
      .slice(0, MAX_FIELD_MINIONS)
      .map(stack => stack.id),
  );
  const fielded = ordered.filter(stack => activeIds.has(stack.id));
  const reserve = ordered.filter(stack => !activeIds.has(stack.id));

  return [...fielded, ...reserve].map((stack, index) => ({
    stack: cloneRunStack(stack.templateId, `${prefix}-${index}`, activeIds.has(stack.id)),
    alive: true,
    origin: 'roster' as const,
  }));
}

function createLoanedStarterUnits(prefix: string): RunUnit[] {
  return ['knight-squire', 'priest-acolyte', 'wizard-apprentice'].map((templateId, index) => ({
    stack: cloneRunStack(templateId, `${prefix}-${index}`, true),
    alive: true,
    origin: 'loaned' as const,
  }));
}

function makeRosterPresetFormation(units: RunUnit[]): Record<string, BoardCell> {
  const activeStacks = units
    .filter(unit => unit.alive && unit.stack.fielded)
    .map(unit => unit.stack)
    .slice(0, MAX_FIELD_MINIONS);
  const fallbackStacks = units
    .filter(unit => unit.alive)
    .map(unit => unit.stack)
    .slice(0, MAX_FIELD_MINIONS);

  return makeDefaultFormation(activeStacks.length > 0 ? activeStacks : fallbackStacks);
}

function createDungeonSession(user: User, dungeon: WorldDungeon): RunSession {
  const rosterUnits = createRosterRunUnits(user, `loaned-dungeon-${dungeon.id}`);
  const startingStacks = rosterUnits.length > 0 ? rosterUnits : createLoanedStarterUnits(`loaned-dungeon-${dungeon.id}`);

  const nodes = createDungeonNodes(dungeon);
  const spellIds = (user.equippedSpellIds || ['arcane-bolt', 'sanctified-mend', 'ember-dart', 'warding-prayer']).slice(0, 4);

  return {
    id: `dungeon-run-${dungeon.id}-${Date.now()}`,
    mode: 'dungeon',
    title: dungeon.name,
    phase: 'map',
    stats: cloneRunStats(user.stats),
    commanderModel: (user.selectedModel || 3) as PlayerModelNumber,
    minions: startingStacks,
    draftChoices: [],
    wins: 0,
    targetBattles: nodes.filter(node => ['battle', 'elite', 'boss'].includes(node.type)).length,
    runGold: 40,
    activeEnemy: null,
    formation: makeRosterPresetFormation(startingStacks),
    spellIds,
    knownSpellIds: getRunStartingKnownSpellIds(spellIds, user),
    rewardChoices: [],
    rewardDestination: null,
    nodes,
    currentNodeIndex: 0,
    battleReports: [],
    outcome: null,
    dungeon,
    shopOffers: {},
    shopRerollsRemaining: RUN_SHOP_REROLL_COUNT,
    blessingRerollsRemaining: RUN_BLESSING_REROLL_COUNT,
    omenRerollsRemaining: RUN_OMEN_REROLL_COUNT,
    pendingPositiveOmen: false,
    pendingRunCelebrations: [],
    ...createEmptyRunEquipmentState(),
  };
}

function createEncounterSession(user: User, enemy: WorldEnemy): RunSession {
  const startingStacks = createRosterRunUnits(user, `loaned-encounter-${enemy.id}`);
  const nodes = createEncounterRunNodes(enemy);
  const spellIds = (user.equippedSpellIds || ['arcane-bolt', 'sanctified-mend', 'ember-dart', 'warding-prayer']).slice(0, 4);

  return {
    id: `encounter-run-${enemy.id}-${Date.now()}`,
    mode: 'encounter',
    title: enemy.name,
    phase: 'map',
    stats: cloneRunStats(user.stats),
    commanderModel: (user.selectedModel || 3) as PlayerModelNumber,
    minions: startingStacks,
    draftChoices: [],
    wins: 0,
    targetBattles: nodes.filter(node => ['battle', 'elite', 'boss'].includes(node.type)).length,
    runGold: enemy.level <= 3 ? 15 : 25,
    activeEnemy: null,
    formation: makeRosterPresetFormation(startingStacks),
    spellIds,
    knownSpellIds: getRunStartingKnownSpellIds(spellIds, user),
    rewardChoices: [],
    rewardDestination: null,
    nodes,
    currentNodeIndex: 0,
    battleReports: [],
    outcome: null,
    encounterEnemy: enemy,
    shopOffers: {},
    shopRerollsRemaining: RUN_SHOP_REROLL_COUNT,
    blessingRerollsRemaining: RUN_BLESSING_REROLL_COUNT,
    omenRerollsRemaining: RUN_OMEN_REROLL_COUNT,
    pendingPositiveOmen: false,
    pendingRunCelebrations: [],
    notice: `${enemy.name} waits at the end of this road.`,
    ...createEmptyRunEquipmentState(),
  };
}

function createMpDailySession(user: User, challenge: MpDailyDungeonChallenge): RunSession {
  const rosterUnits = createRosterRunUnits(user, 'loaned-mp-daily');
  const startingStacks = rosterUnits.length > 0 ? rosterUnits : createLoanedStarterUnits('loaned-mp-daily');

  const startLevel = Math.max(1, (user.stats.level || 1) + challenge.enemyLevelOffset - 2);
  const nodes = createScaledRunNodes({
    idPrefix: `mp-daily-${challenge.date}`,
    battleCount: challenge.battleCount,
    startLevel,
    bossLevel: Math.max(startLevel + 2, (user.stats.level || 1) + challenge.enemyLevelOffset),
    bossName: challenge.bossName,
    bossSubtitle: challenge.bossSubtitle,
    bossId: challenge.bossId,
    theme: 'road',
    labelOffset: challenge.battleCount,
    includeShops: false,
    includeEvents: challenge.battleCount >= 5,
  });
  const spellIds = (user.equippedSpellIds || ['arcane-bolt', 'sanctified-mend', 'ember-dart', 'warding-prayer']).slice(0, 4);

  return {
    id: `mp-daily-run-${challenge.date}-${Date.now()}`,
    mode: 'mpDaily',
    title: challenge.name,
    phase: 'map',
    stats: cloneRunStats(user.stats),
    commanderModel: (user.selectedModel || 3) as PlayerModelNumber,
    minions: startingStacks,
    draftChoices: [],
    wins: 0,
    targetBattles: nodes.filter(node => ['battle', 'elite', 'boss'].includes(node.type)).length,
    runGold: 35,
    activeEnemy: null,
    formation: makeRosterPresetFormation(startingStacks),
    spellIds,
    knownSpellIds: getRunStartingKnownSpellIds(spellIds, user),
    rewardChoices: [],
    rewardDestination: null,
    nodes,
    currentNodeIndex: 0,
    battleReports: [],
    outcome: null,
    mpDailyChallenge: challenge,
    shopOffers: {},
    shopRerollsRemaining: RUN_SHOP_REROLL_COUNT,
    blessingRerollsRemaining: RUN_BLESSING_REROLL_COUNT,
    omenRerollsRemaining: RUN_OMEN_REROLL_COUNT,
    pendingPositiveOmen: false,
    pendingRunCelebrations: [],
    startedAt: Date.now(),
    notice: `${challenge.subtitle}. One clear per day.`,
    ...createEmptyRunEquipmentState(),
  };
}

function cloneRunStats(stats: CharacterStats): CharacterStats {
  return {
    ...stats,
    health: stats.maxHealth,
  };
}

function applyDailyChallengeStats(stats: CharacterStats, challenge: DailyRunChallenge): CharacterStats {
  const bonus = challenge.modifiers.reduce((totals, modifier) => {
    const statBonus = modifier.statBonus || {};
    return {
      armyPower: totals.armyPower + (statBonus.armyPower || 0),
      defensivePower: totals.defensivePower + (statBonus.defensivePower || 0),
      morale: totals.morale + (statBonus.morale || 0),
      spellPower: totals.spellPower + (statBonus.spellPower || 0),
      maxHealth: totals.maxHealth + (statBonus.maxHealth || 0),
      health: totals.health + (statBonus.health || 0),
    };
  }, { armyPower: 0, defensivePower: 0, morale: 0, spellPower: 0, maxHealth: 0, health: 0 });
  const maxHealth = stats.maxHealth + bonus.maxHealth;

  return {
    ...stats,
    armyPower: stats.armyPower + bonus.armyPower,
    defensivePower: stats.defensivePower + bonus.defensivePower,
    morale: stats.morale + bonus.morale,
    spellPower: stats.spellPower + bonus.spellPower,
    maxHealth,
    health: Math.min(maxHealth, stats.health + bonus.maxHealth + bonus.health),
  };
}

function isPlayerRunEligibleTemplate(template: MinionTemplate): boolean {
  return !PLAYER_RUN_EXCLUDED_TEMPLATE_IDS.has(template.templateId);
}

function getPlayerRunTemplatePool(allowedTiers: MinionTemplate['tier'][]): MinionTemplate[] {
  const eligibleTemplates = MINION_TEMPLATES.filter(template => allowedTiers.includes(template.tier) && isPlayerRunEligibleTemplate(template));
  const standard = eligibleTemplates.filter(template => !isStandaloneMinionTemplate(template.templateId));
  const standalone = eligibleTemplates.filter(template => isStandaloneMinionTemplate(template.templateId));
  const weighted = [
    ...standard,
    ...standard,
    ...standard,
    ...standalone,
  ];

  return weighted.length > 0 ? weighted : eligibleTemplates;
}

function pickPlayerRunTemplate(tier: MinionTemplate['tier']): MinionTemplate {
  return shuffle(getPlayerRunTemplatePool([tier]))[0]
    || MINION_TEMPLATES.find(template => template.tier === tier && isPlayerRunEligibleTemplate(template))
    || MINION_TEMPLATES[0];
}

function getEnemyRunTemplatePool(tier: MinionTemplate['tier']): MinionTemplate[] {
  const tierTemplates = MINION_TEMPLATES.filter(template => template.tier === tier);
  const standalone = tierTemplates.filter(template => isStandaloneMinionTemplate(template.templateId));
  const standard = tierTemplates.filter(template => !isStandaloneMinionTemplate(template.templateId));
  const tierOneTank = tier === 'tier1'
    ? tierTemplates.filter(template => template.templateId === 'knight-squire')
    : [];
  const weighted = [
    ...standalone,
    ...standalone,
    ...standalone,
    ...tierOneTank,
    ...tierOneTank,
    ...standard,
  ];

  return weighted.length > 0 ? weighted : tierTemplates;
}

interface RunEnemyFormationProfile {
  id: string;
  minLevel: number;
  minProgress: number;
  minBossesDefeated?: number;
  eliteOnly?: boolean;
  templateIds: string[];
}

const RUN_ENEMY_FORMATION_PROFILES: RunEnemyFormationProfile[] = [
  {
    id: 'road-spearline',
    minLevel: 4,
    minProgress: 0.25,
    templateIds: ['knight-squire', 'crossbow', 'witchdoc', 'darkpriest', 'bell'],
  },
  {
    id: 'black-choir',
    minLevel: 7,
    minProgress: 0.35,
    templateIds: ['bell', 'crossbow', 'enchanter', 'firelord', 'witchdoc', 'knight-squire'],
  },
  {
    id: 'cutthroat-flank',
    minLevel: 8,
    minProgress: 0.4,
    templateIds: ['thief', 'crossbow', 'crow', 'witchdoc', 'archer', 'knight-squire'],
  },
  {
    id: 'execution-row',
    minLevel: 9,
    minProgress: 0.42,
    eliteOnly: true,
    templateIds: ['crow', 'thief', 'crossbow', 'archer', 'plaugedoc', 'bell', 'mercenary'],
  },
  {
    id: 'grave-phalanx',
    minLevel: 10,
    minProgress: 0.55,
    templateIds: ['mercenary', 'bell', 'crossbow', 'plaugedoc', 'enchanter', 'firelord', 'knight-squire'],
  },
  {
    id: 'cinder-doctrine',
    minLevel: 8,
    minProgress: 0.5,
    minBossesDefeated: 1,
    templateIds: ['firelord', 'bell', 'darkpriest', 'witchdoc', 'crossbow', 'mercenary', 'enchanter'],
  },
  {
    id: 'imperial-vanguard',
    minLevel: 11,
    minProgress: 0.65,
    minBossesDefeated: 2,
    templateIds: ['mercenary', 'fallen', 'crow', 'plaugedoc', 'bell', 'firelord', 'enchanter', 'knight-squire'],
  },
];

function getRunEnemyFormationProfile({
  sessionId,
  battleIndex,
  effectiveLevel,
  routeProgress,
  bossesDefeated,
  elite,
}: {
  sessionId: string;
  battleIndex: number;
  effectiveLevel: number;
  routeProgress: number;
  bossesDefeated: number;
  elite: boolean;
}): RunEnemyFormationProfile | null {
  const eligibleProfiles = RUN_ENEMY_FORMATION_PROFILES.filter(profile => (
    effectiveLevel >= profile.minLevel
    && routeProgress >= profile.minProgress
    && bossesDefeated >= (profile.minBossesDefeated || 0)
    && (!profile.eliteOnly || elite)
    && profile.templateIds.some(templateId => Boolean(getMinionTemplate(templateId)))
  ));

  if (eligibleProfiles.length === 0) return null;
  const profileIndex = getStableShopRoll(`${sessionId}:${battleIndex}:${effectiveLevel}:${bossesDefeated}:formation`, eligibleProfiles.length);
  return eligibleProfiles[profileIndex] || null;
}

function pickRunEnemyFormationTemplate(
  profile: RunEnemyFormationProfile | null,
  slot: number,
  effectiveLevel: number,
  battleIndex: number
): MinionTemplate | undefined {
  if (!profile) return undefined;
  const validIds = profile.templateIds.filter(templateId => Boolean(getMinionTemplate(templateId)));
  if (validIds.length === 0) return undefined;
  const offset = getStableShopRoll(`${profile.id}:${effectiveLevel}:${battleIndex}`, validIds.length);
  return getMinionTemplate(validIds[(slot + offset) % validIds.length]);
}

function getStandaloneFirstTemplatePool(templates: MinionTemplate[]): MinionTemplate[] {
  const standalone = templates.filter(template => isStandaloneMinionTemplate(template.templateId));
  const standard = templates.filter(template => !isStandaloneMinionTemplate(template.templateId));
  return standalone.length > 0 ? [...standalone, ...standalone, ...standard] : templates;
}

function getDraftChoices(picksMade: number): MinionTemplate[] {
  const allowedTiers: MinionTemplate['tier'][] = picksMade < 3
    ? ['tier1']
    : picksMade < 6
      ? ['tier1', 'tier2']
      : ['tier2', 'tier3'];
  const includeRareFallen = picksMade < MAX_FIELD_MINIONS - 1 || Math.random() < FALLEN_FINAL_DRAFT_CHANCE;
  const canUseTemplate = (template: MinionTemplate) => includeRareFallen || template.templateId !== 'fallen';
  const candidates = getPlayerRunTemplatePool(allowedTiers).filter(canUseTemplate);
  const choices: MinionTemplate[] = [];
  const seen = new Set<string>();
  const addChoice = (template: MinionTemplate) => {
    if (choices.length >= 4 || seen.has(template.templateId)) return;
    seen.add(template.templateId);
    choices.push(template);
  };

  shuffle(candidates).forEach(addChoice);
  shuffle(MINION_TEMPLATES.filter(template => allowedTiers.includes(template.tier) && isPlayerRunEligibleTemplate(template) && canUseTemplate(template))).forEach(addChoice);
  if (choices.length < 4) shuffle(MINION_TEMPLATES.filter(template => isPlayerRunEligibleTemplate(template) && canUseTemplate(template))).forEach(addChoice);

  return choices.slice(0, 4);
}

function addDraftMinion(session: RunSession, template: MinionTemplate): RunSession {
  const minions = [
    ...session.minions,
    {
      stack: applyRunCommanderUnitBonusForSession(
        session,
        cloneRunStack(template.templateId, `loaned-run-${session.id}-${session.minions.length}`)
      ),
      alive: true,
      origin: 'draft' as const,
    },
  ].slice(0, MAX_FIELD_MINIONS);
  const complete = minions.length >= MAX_FIELD_MINIONS;

  return {
    ...session,
    minions,
    formation: complete ? makeDefaultFormation(minions.map(unit => unit.stack)) : session.formation,
    phase: complete ? 'map' : 'draft',
    draftChoices: complete ? [] : getDraftChoices(minions.length),
    notice: complete ? 'Warband drafted. Start the first fight when ready.' : undefined,
  };
}

function pickRunSpellLoadout(seedLabel: string): string[] {
  const common = BATTLE_SPELLS.filter(spell => spell.rarity === 'common');
  const rare = BATTLE_SPELLS.filter(spell => spell.rarity === 'rare');
  const legendary = BATTLE_SPELLS.filter(spell => spell.rarity === 'legendary');
  const seed = seedLabel.split('').reduce((hash, char) => hash + char.charCodeAt(0), 0);
  const seededSpells = [
    common[seed % common.length],
    common[(seed + 3) % common.length],
    rare[(seed + 5) % rare.length],
    (seed % 5 === 0 ? legendary[seed % legendary.length] : rare[(seed + 9) % rare.length]),
  ].filter(Boolean).map(spell => spell.id);

  return [
    'ember-dart',
    ...seededSpells.filter(spellId => spellId !== 'ember-dart'),
  ].slice(0, 4);
}

function startDailyBattle(session: RunSession): RunSession {
  const nextBattle = session.wins + 1;
  const userLevel = session.stats.level || 1;
  const enemyLevelOffset = session.dailyChallenge?.enemyLevelOffset || 0;
  const enemy = makeRunEnemy({
    session,
    index: nextBattle,
    level: getRandomRunScaledBattleLevel(userLevel, nextBattle, session.targetBattles, enemyLevelOffset),
    boss: nextBattle >= session.targetBattles,
  });

  return {
    ...session,
    phase: 'formation',
    formation: Object.keys(session.formation).length > 0
      ? session.formation
      : makeDefaultFormation(getAliveRunRoster(session).slice(0, MAX_FIELD_MINIONS)),
    activeEnemy: enemy,
    notice: undefined,
  };
}

function startDungeonNode(session: RunSession, node: DungeonNode): RunSession {
  const nodeIndex = session.nodes.findIndex(item => item.id === node.id);
  const reachableIds = getReachableNodeIds(session);
  const branchMap = hasBranchNodeLayout(session.nodes);
  const currentNode = session.nodes[session.currentNodeIndex];
  const canResolveNode = branchMap
    ? reachableIds.has(node.id)
    : Boolean(currentNode && node.id === currentNode.id);

  if (nodeIndex < 0 || !canResolveNode || node.completed) return session;

  if (node.type === 'shop') {
    return ensureShopOffers({
      ...session,
      currentNodeIndex: nodeIndex,
      phase: 'shop',
      notice: 'A merchant waits behind a black curtain.',
    });
  }

  if (node.type === 'event') {
    return { ...session, currentNodeIndex: nodeIndex, phase: 'event', notice: undefined };
  }

  const battleNumber = node.battleNumber || getRunBattleNodeNumber(session, nodeIndex);
  const activeEnemy = session.mode === 'encounter' && node.type === 'boss' && session.encounterEnemy
    ? makeEncounterBossEnemy(session, node)
    : makeRunEnemy({
      session,
      index: battleNumber,
      level: node.level,
      boss: node.type === 'boss',
      elite: node.type === 'elite',
    });

  return {
    ...session,
    currentNodeIndex: nodeIndex,
    phase: 'formation',
    formation: Object.keys(session.formation).length > 0
      ? session.formation
      : makeDefaultFormation(getAliveRunRoster(session).slice(0, MAX_FIELD_MINIONS)),
    activeEnemy,
    notice: undefined,
  };
}

function makeEncounterBossEnemy(session: RunSession, node: DungeonNode): WorldEnemy {
  const enemy = session.encounterEnemy as WorldEnemy;
  const isWorldBoss = enemy.spawnKind === 'world-boss' || enemy.personality === 'boss';

  return {
    ...enemy,
    level: node.level,
    personality: isWorldBoss ? 'boss' : enemy.personality,
    lootMultiplier: Math.max(enemy.lootMultiplier || 1, isWorldBoss ? 2.15 : 1.35),
  };
}

function makeRunEnemy({
  session,
  index,
  level,
  boss,
  elite = false,
}: {
  session: RunSession;
  index: number;
  level: number;
  boss: boolean;
  elite?: boolean;
}): WorldEnemy {
  const modelNumbers: PlayerModelNumber[] = [1, 2, 4, 5, 6];
  const personalities: EnemyAiPersonality[] = ['balanced', 'aggressive', 'defensive', 'arcane'];
  const finalBoss = isFinalRunBossFight(session, index, boss);
  const bossLevelBonus = finalBoss ? 2 : boss ? 0 : 0;
  const effectiveLevel = session.mode === 'daily'
    ? clamp(level + bossLevelBonus, 1, RANDOM_RUN_BALANCE.enemyLevelCap)
    : level + bossLevelBonus;
  const routeProgress = session.targetBattles > 0
    ? clamp(index / session.targetBattles, 0, 1)
    : clamp(effectiveLevel / RANDOM_RUN_BALANCE.enemyLevelCap, 0, 1);
  const scalingCount = 2 + Math.floor(effectiveLevel / 3) + Math.floor(routeProgress * 3);
  const minionCap = finalBoss ? 10 : boss ? 7 : elite ? 9 : clamp(4 + Math.round(routeProgress * 6), 4, 10);
  const minionCount = clamp(
    scalingCount + (finalBoss ? 4 : boss ? 1 : elite ? 2 : 0),
    finalBoss ? 6 : boss ? 4 : elite ? 4 : 2,
    minionCap,
  );
  const activeNode = session.nodes[session.currentNodeIndex];
  const bossProfile = boss ? getBossProfileById(activeNode?.bossId || session.dailyChallenge?.bossId || session.dungeon?.bossId) : undefined;
  const runBoss = boss
    ? {
      id: bossProfile?.id || session.dailyChallenge?.bossId || session.dungeon?.bossId,
      name: bossProfile?.name || session.dailyChallenge?.bossName || session.dungeon?.bossName,
      subtitle: bossProfile?.subtitle || session.dailyChallenge?.bossSubtitle || session.dungeon?.bossSubtitle,
      story: bossProfile?.story || session.dailyChallenge?.bossStory || session.dungeon?.bossStory,
      intro: bossProfile?.intro || session.dailyChallenge?.bossIntro || session.dungeon?.bossIntro,
      artworkPath: bossProfile?.assetPath || session.dailyChallenge?.bossArtworkPath || session.dungeon?.bossArtworkPath,
      modelNumber: bossProfile?.modelNumber || session.dailyChallenge?.bossModelNumber || session.dungeon?.bossModelNumber,
      minionTemplates: bossProfile?.minionTemplates || session.dungeon?.bossMinionTemplates || [],
    }
    : undefined;
  const enemyFormationProfile = boss
    ? null
    : getRunEnemyFormationProfile({
      sessionId: session.id,
      battleIndex: index,
      effectiveLevel,
      routeProgress,
      bossesDefeated: session.bossHistory?.length || 0,
      elite,
    });
  const minions = enforcePostBossMinionTiers(
    Array.from({ length: minionCount }, (_, slot) => {
      const templateId = boss
        ? pickBossEscortTemplate(effectiveLevel, slot, runBoss?.minionTemplates, finalBoss).templateId
        : (pickRunEnemyFormationTemplate(enemyFormationProfile, slot, effectiveLevel, index)
          || pickEnemyTemplate(effectiveLevel, slot, elite, session.bossHistory?.length || 0)).templateId;
      return cloneRunStack(templateId, `enemy-${session.id}-${index}-${slot}`);
    }),
    {
      bossesDefeated: session.bossHistory?.length || 0,
      effectiveLevel,
      battleIndex: index,
      boss,
    },
  );

  return {
    id: `${session.mode}-run-enemy-${session.id}-${index}`,
    bossId: runBoss?.id,
    name: runBoss?.name || (boss ? 'Run Warden' : elite ? 'Oathbound Captain' : `Road Adversary ${index}`),
    subtitle: runBoss?.subtitle || (finalBoss ? 'Final commander' : boss ? 'Road boss' : elite ? 'Elite chamber guard' : 'Run encounter'),
    story: runBoss?.story,
    intro: runBoss?.intro,
    artworkPath: runBoss?.artworkPath,
    x: 0,
    y: 0,
    level: effectiveLevel,
    modelNumber: (runBoss?.modelNumber as PlayerModelNumber | undefined) || modelNumbers[index % modelNumbers.length],
    personality: finalBoss ? 'boss' : boss ? (bossProfile?.personality || 'balanced') : personalities[index % personalities.length],
    minions,
    lootMultiplier: finalBoss ? 2.2 : boss ? 1.45 : elite ? 1.35 : 1,
  };
}

function getRunBattleNodeNumber(session: RunSession, nodeIndex: number): number {
  const node = session.nodes[nodeIndex];
  if (node?.battleNumber) return node.battleNumber;

  return Math.max(
    1,
    session.nodes.slice(0, nodeIndex + 1).filter(node => ['battle', 'elite', 'boss'].includes(node.type)).length
  );
}

function pickEnemyTemplate(level: number, slot: number, elite: boolean, bossesDefeated = 0): MinionTemplate {
  const postBossTierBoost = bossesDefeated >= 2
    ? 'tier3'
    : bossesDefeated >= 1 && slot % 2 === 0
      ? 'tier2'
      : null;
  const targetTier = postBossTierBoost
    || (elite && level >= 10 && slot % 3 === 0
      ? 'tier3'
      : level >= 6 && slot % 2 === 0
        ? 'tier2'
        : 'tier1');
  const candidates = getEnemyRunTemplatePool(targetTier);
  return candidates[(level + slot) % candidates.length] || MINION_TEMPLATES[0];
}

function enforcePostBossMinionTiers(
  minions: MinionStack[],
  {
    bossesDefeated,
    effectiveLevel,
    battleIndex,
    boss,
  }: {
    bossesDefeated: number;
    effectiveLevel: number;
    battleIndex: number;
    boss: boolean;
  },
): MinionStack[] {
  if (boss || bossesDefeated <= 0 || minions.length === 0) return minions;

  const result = minions.map(stack => ({ ...stack }));
  const countTier = (tier: MinionTemplate['tier']) => (
    result.filter(stack => getMinionTemplate(stack.templateId)?.tier === tier).length
  );

  const forceSlotToTier = (slot: number, tier: MinionTemplate['tier']) => {
    const pool = getEnemyRunTemplatePool(tier);
    const template = pool[(effectiveLevel + battleIndex + slot) % pool.length] || pool[0];
    if (!template) return;
    result[slot] = cloneRunStack(template.templateId, result[slot].id);
  };

  let slot = 0;
  while (countTier('tier1') < 1 && bossesDefeated >= 1 && slot < result.length) {
    if (getMinionTemplate(result[slot].templateId)?.tier !== 'tier1') {
      forceSlotToTier(slot, 'tier1');
    }
    slot += 1;
  }

  slot = 0;
  while (countTier('tier3') < 2 && bossesDefeated >= 2 && slot < result.length) {
    if (getMinionTemplate(result[slot].templateId)?.tier !== 'tier3') {
      forceSlotToTier(slot, 'tier3');
    }
    slot += 1;
  }

  return result;
}

function downgradeBossEscortTemplateIds(templateIds: string[]): string[] {
  const preservedTier3Id = templateIds.find(templateId => getMinionTemplate(templateId)?.tier === 'tier3');

  return templateIds.map(templateId => {
    const template = getMinionTemplate(templateId);
    if (isStandaloneMinionTemplate(templateId)) return templateId;
    if (!template) return templateId;
    if (template.tier === 'tier3') {
      if (templateId === preservedTier3Id) return templateId;
      const tier2 = MINION_TEMPLATES.find(candidate => candidate.class === template.class && candidate.tier === 'tier2');
      return tier2?.templateId || templateId;
    }
    if (template.tier === 'tier2') {
      const tier1 = MINION_TEMPLATES.find(candidate => candidate.class === template.class && candidate.tier === 'tier1');
      return tier1?.templateId || templateId;
    }
    return templateId;
  });
}

function isFinalRunBossFight(session: RunSession, battleNumber: number, boss: boolean): boolean {
  if (!boss) return false;
  if (battleNumber >= session.targetBattles) return true;

  const activeNode = session.nodes[session.currentNodeIndex];
  return activeNode?.type === 'boss' && activeNode.battleNumber === session.targetBattles;
}

function pickBossEscortTemplate(level: number, slot: number, bossTemplateIds: string[] = [], finalBoss = true): MinionTemplate {
  const escortTemplateIds = finalBoss ? bossTemplateIds : downgradeBossEscortTemplateIds(bossTemplateIds);
  const sourceTemplate = escortTemplateIds.length > 0
    ? getMinionTemplate(escortTemplateIds[slot % escortTemplateIds.length])
    : undefined;
  if (sourceTemplate && (isStandaloneMinionTemplate(sourceTemplate.templateId) || sourceTemplate.templateId === 'knight-squire')) {
    return sourceTemplate;
  }
  const targetTier = finalBoss
    ? (slot % 4 === 1 ? 'tier2' : 'tier3')
    : slot === 0
      ? 'tier3'
      : (slot % 3 === 1 ? 'tier2' : 'tier1');
  const sameClassCandidates = sourceTemplate
    ? MINION_TEMPLATES.filter(template => template.tier === targetTier && template.class === sourceTemplate.class)
    : [];
  const tierCandidates = getEnemyRunTemplatePool(targetTier);
  const candidates = sameClassCandidates.length > 0 ? getStandaloneFirstTemplatePool(sameClassCandidates) : tierCandidates;

  return candidates[(level + slot) % candidates.length]
    || sourceTemplate
    || pickEnemyTemplate(finalBoss ? level + 4 : level, slot, finalBoss);
}

function getRandomRunBossBattleNumbers(battleCount: number): number[] {
  const safeCount = Math.max(2, Math.round(battleCount));
  if (safeCount <= 3) return [safeCount];
  if (safeCount <= 5) return [safeCount - 1, safeCount];

  const contentBossCap = Math.max(
    RANDOM_RUN_BALANCE.currentContentBosses,
    Math.ceil(safeCount / (RANDOM_RUN_BALANCE.bossSpacing + 2))
  );
  const bossCount = clamp(
    Math.round(safeCount / RANDOM_RUN_BALANCE.bossSpacing),
    RANDOM_RUN_BALANCE.minBosses,
    contentBossCap
  );
  const bossNumbers: number[] = [];

  for (let index = 1; index <= bossCount; index += 1) {
    const rawNumber = index === bossCount
      ? safeCount
      : Math.round((safeCount * index) / bossCount);
    const previous = bossNumbers[bossNumbers.length - 1] || 1;
    const number = index === bossCount
      ? safeCount
      : clamp(rawNumber, previous + 3, safeCount - (bossCount - index) * 3);
    bossNumbers.push(number);
  }

  return Array.from(new Set(bossNumbers))
    .filter(number => number >= 2 && number <= safeCount)
    .sort((a, b) => a - b);
}

interface BossRouteModifier {
  title: string;
  summary: string;
  battleSuffix: string;
  eliteSuffix: string;
  stopSuffix: string;
  battleLevelDelta: number;
  eliteLevelDelta: number;
  shopChanceDelta: number;
  hardRewardPreference?: 'shop' | 'omen';
}

const BOSS_ROUTE_MODIFIERS: Record<string, BossRouteModifier> = {
  'mother-cindervein': {
    title: 'Candle Tithe',
    summary: 'Omens appear more often, but ordinary fights carry candle curses.',
    battleSuffix: 'Cindervein candles make even safe fights harder to leave clean.',
    eliteSuffix: 'Her candle guard presses hard and leaves a stronger omen behind.',
    stopSuffix: 'Candle signs are more common on this road.',
    battleLevelDelta: 0,
    eliteLevelDelta: 1,
    shopChanceDelta: -0.25,
    hardRewardPreference: 'omen',
  },
  'ser-kael-duskplate': {
    title: 'Blue Oath Road',
    summary: 'Hard routes are tougher, but their reward stops favor quartermasters.',
    battleSuffix: 'Blue oath shields slow the road and reward stronger positioning.',
    eliteSuffix: 'Duskplate elites are reinforced and pay better if broken.',
    stopSuffix: 'Blue-oath spoils draw more road merchants than shrines.',
    battleLevelDelta: 0,
    eliteLevelDelta: 2,
    shopChanceDelta: 0.25,
    hardRewardPreference: 'shop',
  },
  'prior-moon-voss': {
    title: 'Moon Reading',
    summary: 'The road bends toward omens and spell pressure.',
    battleSuffix: 'Moonlit reflections make enemy casters more confident.',
    eliteSuffix: 'Moon priests guard the hard route with sharper rites.',
    stopSuffix: 'Moon omens answer more often than merchants.',
    battleLevelDelta: 0,
    eliteLevelDelta: 1,
    shopChanceDelta: -0.3,
    hardRewardPreference: 'omen',
  },
  'key-saint-ardan': {
    title: 'Sealed Gate Toll',
    summary: 'More shops appear, but road fights scale slightly faster.',
    battleSuffix: 'Every gate toll adds pressure before Ardan.',
    eliteSuffix: 'Key-guards hold the hard route with heavier armor.',
    stopSuffix: 'Locked caches and merchants gather near Ardan roads.',
    battleLevelDelta: 1,
    eliteLevelDelta: 1,
    shopChanceDelta: 0.35,
    hardRewardPreference: 'shop',
  },
  'blackroot-vessel': {
    title: 'Root Hunger',
    summary: 'All fights are slightly stronger and omens lean dangerous.',
    battleSuffix: 'Black roots thicken the road and strengthen enemy lines.',
    eliteSuffix: 'Root-bound elites arrive heavier than expected.',
    stopSuffix: 'Root omens are unstable but can shape a build.',
    battleLevelDelta: 1,
    eliteLevelDelta: 1,
    shopChanceDelta: -0.15,
  },
  'lady-mirror-veyra': {
    title: 'Mirror Road',
    summary: 'Alternate lanes and hard fights are more deceptive.',
    battleSuffix: 'Mirror signs make the enemy tempo less predictable.',
    eliteSuffix: 'Veyra reflections make hard-route enemies sharper.',
    stopSuffix: 'Mirror omens often change the run plan.',
    battleLevelDelta: 0,
    eliteLevelDelta: 1,
    shopChanceDelta: -0.1,
  },
  'scarlet-matron-yvane': {
    title: 'Scarlet Thread',
    summary: 'Hard routes hit much harder, but their aftermath is more valuable.',
    battleSuffix: 'Scarlet thread tightens around every fight.',
    eliteSuffix: 'Scarlet elites are dangerous and should be chosen deliberately.',
    stopSuffix: 'Blood-star roads leave stronger spoils after danger.',
    battleLevelDelta: 1,
    eliteLevelDelta: 2,
    shopChanceDelta: 0,
  },
  'emperor-grave-aurel': {
    title: 'Imperial Wake',
    summary: 'The whole road scales upward; expect stronger late formations.',
    battleSuffix: 'The emperor wakes the road earlier than normal.',
    eliteSuffix: 'Imperial hard routes march like miniature boss fights.',
    stopSuffix: 'Imperial spoils are guarded by old vows.',
    battleLevelDelta: 1,
    eliteLevelDelta: 2,
    shopChanceDelta: 0.1,
  },
};

function getBossRouteModifier(bossId?: string): BossRouteModifier | null {
  return bossId ? BOSS_ROUTE_MODIFIERS[bossId] || null : null;
}

function appendRouteModifierDescription(description: string, suffix?: string): string {
  return suffix ? `${description} ${suffix}` : description;
}

function createDailyRunNodes(challenge: DailyRunChallenge, playerLevel: number): DungeonNode[] {
  const battleCount = normalizeRandomRunBattleCount(challenge.targetBattles);
  const roadLabels = ['Road Watch', 'Bell Patrol', 'Ash Crossing', 'Moonlit Ambush', 'Candle Guard', 'Iron Vow', 'Root Camp', 'Saint Gate', 'Black Causeway', 'Pilgrim Cut'];
  const alternateLabels = ['Mire Flank', 'Ruined Toll', 'Old Causeway', 'Cinder Turn', 'Moon Ditch', 'Broken Mile'];
  const eliteLabels = ['Oath Captain', 'Relic Duelist', 'Black Banner Guard', 'Moonwell Marshal'];
  const shopLabels = ['Roadside Peddler', 'Black-Coin Cart', 'Pilgrim Quartermaster'];
  const eventLabels = ['Broken Shrine', 'Candle Pool', 'Ash Cache', 'Moon Omen'];
  const nodes: DungeonNode[] = [];
  const bossBattleNumbers = getRandomRunBossBattleNumbers(battleCount);
  const intermediateBossNumbers = bossBattleNumbers.filter(number => number < battleCount);
  const intermediateBossPool = shuffle(BOSS_PROFILES.filter(profile => profile.id !== challenge.bossId));
  const routeModifier = getBossRouteModifier(challenge.bossId);
  let row = 0;
  let bonusStopIndex = 0;

  const addRow = (specs: Array<{
    type: DungeonNodeType;
    label: string;
    description: string;
    level: number;
    battleNumber?: number;
    bossId?: string;
    rewardSource?: 'hard' | 'boss';
  }>) => {
    const rowNodes = specs.map((spec, lane) => ({
      id: `daily-${challenge.date}-r${row}-l${lane}-${spec.type}-${spec.battleNumber || 'stop'}`,
      type: spec.type,
      label: spec.label,
      description: spec.description,
      iconPath: getDungeonNodeIconPath(spec.type, spec.bossId),
      level: spec.level,
      completed: false,
      row,
      lane,
      nextIds: [],
      battleNumber: spec.battleNumber,
      bossId: spec.bossId,
      rewardSource: spec.rewardSource,
    }));
    const previousRow = Math.max(-1, row - 1);
    const previousRowNodes = nodes.filter(node => node.row === previousRow);

    previousRowNodes
      .forEach(node => {
        node.nextIds = getAdjacentBranchNodeIds(node, previousRowNodes.length, rowNodes);
      });

    nodes.push(...rowNodes);
    row += 1;
  };

  const addRewardStopRow = (baseLevel: number, reason: 'boss' | 'hard') => {
    const shopChance = clamp(0.5 + (routeModifier?.shopChanceDelta || 0), 0.15, 0.85);
    const preferredHardStop = reason === 'hard' ? routeModifier?.hardRewardPreference : undefined;
    const useShop = preferredHardStop
      ? preferredHardStop === 'shop'
      : Math.random() < shopChance;
    const stopIndex = bonusStopIndex;
    bonusStopIndex += 1;
    addRow([{
      type: useShop ? 'shop' : 'event',
      label: useShop
        ? shopLabels[stopIndex % shopLabels.length]
        : eventLabels[stopIndex % eventLabels.length],
      description: useShop
        ? appendRouteModifierDescription(`${reason === 'boss' ? 'Boss' : 'Hard-route'} spoils. Spend run gold before the road twists again.`, routeModifier?.stopSuffix)
        : appendRouteModifierDescription(`${reason === 'boss' ? 'Boss' : 'Hard-route'} omen. A risky blessing waits after the dangerous fight.`, routeModifier?.stopSuffix),
      level: baseLevel,
      rewardSource: reason,
    }]);
  };

  for (let battleNumber = 1; battleNumber < battleCount; battleNumber += 1) {
    const battleIndex = battleNumber - 1;
    const baseLevel = getRandomRunScaledBattleLevel(
      playerLevel,
      battleNumber,
      battleCount,
      (challenge.enemyLevelOffset || 0) + (routeModifier?.battleLevelDelta || 0)
    );
    const roadLabel = roadLabels[battleIndex % roadLabels.length];
    const alternateLabel = alternateLabels[battleIndex % alternateLabels.length];
    const eliteLabel = eliteLabels[battleIndex % eliteLabels.length];
    const bossIndex = intermediateBossNumbers.indexOf(battleNumber);

    if (bossIndex >= 0) {
      const boss = intermediateBossPool[bossIndex % Math.max(1, intermediateBossPool.length)]
        || getBossProfileByIndex(battleIndex + bossIndex);
      const grantsVeteran = battleNumber === battleCount - 1;
      addRow([{
        type: 'boss',
        label: boss.name,
        description: grantsVeteran
          ? `${boss.subtitle}. ${boss.intro} Defeat this gate to call a tier III veteran before the last boss.`
          : `${boss.subtitle}. ${boss.intro}`,
        level: getRandomRunScaledBattleLevel(playerLevel, battleNumber, battleCount, bossIndex + (challenge.enemyLevelOffset || 0)),
        battleNumber,
        bossId: boss.id,
      }]);
      if (battleNumber < battleCount - 1) addRewardStopRow(baseLevel, 'boss');
      continue;
    }

    if (battleNumber === 1) {
      addRow([{
        type: 'battle',
        label: roadLabel,
        description: appendRouteModifierDescription('Opening fight. Clear it to reveal the first road split.', routeModifier?.battleSuffix),
        level: baseLevel,
        battleNumber,
      }]);
    } else if (battleNumber % 3 === 0) {
      addRow([
        {
          type: 'battle',
          label: roadLabel,
          description: appendRouteModifierDescription('Safer fight. Lower pressure, lower payout.', routeModifier?.battleSuffix),
          level: baseLevel,
          battleNumber,
        },
        {
          type: 'elite',
          label: eliteLabel,
          description: appendRouteModifierDescription('Elite fight. Harder enemy, better run-gold pressure.', routeModifier?.eliteSuffix),
          level: getRandomRunScaledBattleLevel(playerLevel, battleNumber, battleCount, 1 + (challenge.enemyLevelOffset || 0) + (routeModifier?.eliteLevelDelta || 0)),
          battleNumber,
        },
        {
          type: 'battle',
          label: alternateLabel,
          description: appendRouteModifierDescription('Alternate route. Similar danger with different enemy tempo.', routeModifier?.battleSuffix),
          level: getRandomRunScaledBattleLevel(playerLevel, battleNumber, battleCount, (challenge.enemyLevelOffset || 0) + (routeModifier?.battleLevelDelta || 0)),
          battleNumber,
        },
      ]);
    } else if (battleNumber % 4 === 0) {
      addRow([
        {
          type: 'battle',
          label: roadLabel,
          description: appendRouteModifierDescription('Standard fight toward the boss road.', routeModifier?.battleSuffix),
          level: baseLevel,
          battleNumber,
        },
        {
          type: 'elite',
          label: eliteLabel,
          description: appendRouteModifierDescription('Hard route. More danger now, more gold for shops.', routeModifier?.eliteSuffix),
          level: getRandomRunScaledBattleLevel(playerLevel, battleNumber, battleCount, 1 + (challenge.enemyLevelOffset || 0) + (routeModifier?.eliteLevelDelta || 0)),
          battleNumber,
        },
      ]);
    } else {
      addRow([{
        type: 'battle',
        label: roadLabel,
        description: appendRouteModifierDescription('A tactical road fight. Defeated enemies pay run gold.', routeModifier?.battleSuffix),
        level: baseLevel,
        battleNumber,
      }]);
    }

    const hardRouteRow = battleNumber % 3 === 0 || battleNumber % 4 === 0;
    const routineStopRow = battleNumber < battleCount - 1 && battleNumber % 2 === 0;

    if (routineStopRow) {
      const shopIndex = Math.floor(battleNumber / 2) - 1;
      const eventIndex = Math.floor(battleNumber / 2) - 1;

      addRow([
        {
          type: 'shop',
          label: shopLabels[shopIndex % shopLabels.length],
          description: appendRouteModifierDescription('Spend only run gold on temporary upgrades. This stop does not count as a fight.', routeModifier?.stopSuffix),
          level: baseLevel,
        },
        {
          type: 'event',
          label: eventLabels[eventIndex % eventLabels.length],
          description: appendRouteModifierDescription('Risk a blessing, recruit, revive, wound, or coin payout. This stop does not count as a fight.', routeModifier?.stopSuffix),
          level: baseLevel,
        },
      ]);
    } else if (hardRouteRow && battleNumber < battleCount) {
      addRewardStopRow(baseLevel, 'hard');
    }
  }

  addRow([{
    type: 'boss',
    label: challenge.bossName,
    description: routeModifier
      ? `${challenge.bossSubtitle}. ${routeModifier.title}: ${routeModifier.summary} A stronger lone commander ends the road.`
      : `${challenge.bossSubtitle}. A stronger lone commander ends the road.`,
    level: getRandomRunScaledBattleLevel(playerLevel, battleCount, battleCount, 2 + (challenge.enemyLevelOffset || 0)),
    battleNumber: battleCount,
    bossId: challenge.bossId,
  }]);

  return normalizeDailyRunNodes(nodes);
}

export function getEncounterRunBattleCount(enemyLevel: number): number {
  if (enemyLevel <= 1) return 2;
  if (enemyLevel <= 3) return 3;
  return clamp(3 + Math.ceil((enemyLevel - 3) / 2), 3, 10);
}

interface ScaledRunNodeOptions {
  idPrefix: string;
  battleCount: number;
  startLevel: number;
  bossLevel: number;
  bossName: string;
  bossSubtitle: string;
  bossId?: string;
  theme: 'road' | 'dungeon';
  labelOffset?: number;
  includeShops?: boolean;
  includeEvents?: boolean;
}

function createScaledRunNodes({
  idPrefix,
  battleCount,
  startLevel,
  bossLevel,
  bossName,
  bossSubtitle,
  bossId,
  theme,
  labelOffset = 0,
  includeShops = true,
  includeEvents = true,
}: ScaledRunNodeOptions): DungeonNode[] {
  const roadLabels = theme === 'dungeon'
    ? ['Outer Guard', 'Candle Hall', 'Broken Nave', 'Ossuary Steps', 'Black Reliquary', 'Ash Gallery', 'Moon Vault', 'Iron Choir']
    : ['Road Watch', 'Bell Patrol', 'Ash Crossing', 'Moonlit Ambush', 'Candle Guard', 'Iron Vow', 'Root Camp', 'Saint Gate', 'Black Causeway', 'Pilgrim Cut'];
  const alternateLabels = theme === 'dungeon'
    ? ['Crypt Flank', 'Ruined Vestry', 'Old Stair', 'Cinder Door', 'Moon Cell', 'Broken Span']
    : ['Mire Flank', 'Ruined Toll', 'Old Causeway', 'Cinder Turn', 'Moon Ditch', 'Broken Mile'];
  const eliteLabels = theme === 'dungeon'
    ? ['Vow Captain', 'Reliquary Watch', 'Iron Door Warden', 'Saint Mask Guard', 'Crypt Marshal']
    : ['Oath Captain', 'Relic Duelist', 'Black Banner Guard', 'Moonwell Marshal'];
  const shopLabels = theme === 'dungeon'
    ? ['Black-Coin Merchant', 'Bone Market', 'Hidden Peddler', 'Candle Quartermaster']
    : ['Roadside Peddler', 'Black-Coin Cart', 'Pilgrim Quartermaster'];
  const eventLabels = theme === 'dungeon'
    ? ['Ash Font', 'Bell Roots', 'Coin Water', 'Empty Jury']
    : ['Broken Shrine', 'Candle Pool', 'Ash Cache', 'Moon Omen'];
  const nodes: DungeonNode[] = [];
  let row = 0;
  let bonusStopIndex = 0;

  const getBattleLevel = (battleNumber: number, extra = 0) => {
    const progress = battleCount <= 1 ? 1 : (battleNumber - 1) / Math.max(1, battleCount - 1);
    return clamp(Math.round(startLevel + (bossLevel - startLevel) * progress) + extra, 1, 24);
  };

  const pickLabel = (labels: string[], index: number) => labels[(index + labelOffset) % labels.length];

  const addRow = (specs: Array<{
    type: DungeonNodeType;
    label: string;
    description: string;
    level: number;
    battleNumber?: number;
    bossId?: string;
    rewardSource?: 'hard' | 'boss';
  }>) => {
    const rowNodes = specs.map((spec, lane) => ({
      id: `${idPrefix}-r${row}-l${lane}-${spec.type}-${spec.battleNumber || 'stop'}`,
      type: spec.type,
      label: spec.label,
      description: spec.description,
      iconPath: getDungeonNodeIconPath(spec.type, spec.bossId),
      level: spec.level,
      completed: false,
      row,
      lane,
      nextIds: [],
      battleNumber: spec.battleNumber,
      bossId: spec.bossId,
      rewardSource: spec.rewardSource,
    }));
    const previousRowNodes = nodes.filter(node => node.row === row - 1);

    previousRowNodes.forEach(node => {
      node.nextIds = getAdjacentBranchNodeIds(node, previousRowNodes.length, rowNodes);
    });

    nodes.push(...rowNodes);
    row += 1;
  };

  const addRewardStopRow = (baseLevel: number, reason: 'hard') => {
    const useShop = includeShops && Math.random() < 0.5;
    const stopIndex = bonusStopIndex;
    bonusStopIndex += 1;
    addRow([{
      type: useShop ? 'shop' : 'event',
      label: useShop
        ? pickLabel(shopLabels, stopIndex)
        : pickLabel(eventLabels, stopIndex),
      description: useShop
        ? 'Hard-route spoils. Spend run gold before the road twists again.'
        : 'Hard-route omen. A risky blessing waits after the dangerous fight.',
      level: baseLevel,
      rewardSource: reason,
    }]);
  };

  for (let battleNumber = 1; battleNumber < battleCount; battleNumber += 1) {
    const battleIndex = battleNumber - 1;
    const baseLevel = getBattleLevel(battleNumber);
    const roadLabel = pickLabel(roadLabels, battleIndex);
    const alternateLabel = pickLabel(alternateLabels, battleIndex);
    const eliteLabel = pickLabel(eliteLabels, battleIndex);

    if (battleNumber === 1 || battleCount <= 3) {
      addRow([{
        type: 'battle',
        label: roadLabel,
        description: battleNumber === 1
          ? 'Opening fight. Clear it to reveal the road ahead.'
          : 'A short road fight before the commander.',
        level: baseLevel,
        battleNumber,
      }]);
    } else if (battleNumber % 3 === 0) {
      addRow([
        {
          type: 'battle',
          label: roadLabel,
          description: 'Safer fight. Lower pressure, lower payout.',
          level: baseLevel,
          battleNumber,
        },
        {
          type: 'elite',
          label: eliteLabel,
          description: 'Hard route. More danger now, better temporary payoff.',
          level: getBattleLevel(battleNumber, 2),
          battleNumber,
        },
        {
          type: 'battle',
          label: alternateLabel,
          description: 'Alternate route. Similar danger with different enemy tempo.',
          level: getBattleLevel(battleNumber, 1),
          battleNumber,
        },
      ]);
    } else if (battleNumber % 4 === 0) {
      addRow([
        {
          type: 'battle',
          label: roadLabel,
          description: 'Standard fight toward the boss road.',
          level: baseLevel,
          battleNumber,
        },
        {
          type: 'elite',
          label: eliteLabel,
          description: 'Hard route. More danger now, more run gold for shops.',
          level: getBattleLevel(battleNumber, 2),
          battleNumber,
        },
      ]);
    } else {
      addRow([{
        type: 'battle',
        label: roadLabel,
        description: 'A tactical road fight. Defeated enemies pay run gold.',
        level: baseLevel,
        battleNumber,
      }]);
    }

    const hardRouteRow = battleNumber % 3 === 0 || battleNumber % 4 === 0;
    const routineStopRow = includeEvents && battleCount >= 4 && battleNumber < battleCount - 1 && battleNumber % 2 === 0;

    if (routineStopRow) {
      const shopIndex = Math.floor(battleNumber / 2) - 1;
      const eventIndex = Math.floor(battleNumber / 2) - 1;
      const stopSpecs: Array<{
        type: DungeonNodeType;
        label: string;
        description: string;
        level: number;
      }> = [];

      if (includeShops) {
        stopSpecs.push({
          type: 'shop',
          label: pickLabel(shopLabels, shopIndex),
          description: 'Spend only run gold on temporary upgrades. This stop does not count as a fight.',
          level: baseLevel,
        });
      }

      stopSpecs.push({
        type: 'event',
        label: pickLabel(eventLabels, eventIndex),
        description: includeShops
          ? 'Risk a blessing, recruit, revive, wound, or coin payout. This stop does not count as a fight.'
          : 'A roadside omen may bless or wound the warband before the enemy commander.',
        level: baseLevel,
      });

      addRow(stopSpecs);
    } else if (hardRouteRow && includeEvents && battleNumber < battleCount - 1) {
      addRewardStopRow(baseLevel, 'hard');
    }
  }

  addRow([{
    type: 'boss',
    label: bossName,
    description: `${bossSubtitle}. Win here to claim the road reward.`,
    level: bossLevel,
    battleNumber: battleCount,
    bossId,
  }]);

  return normalizeDailyRunNodes(nodes);
}

function createEncounterRunNodes(enemy: WorldEnemy): DungeonNode[] {
  const battleCount = getEncounterRunBattleCount(enemy.level);
  const startLevel = clamp(enemy.level - Math.ceil(battleCount / 2), 1, enemy.level);

  return createScaledRunNodes({
    idPrefix: `encounter-${enemy.id}`,
    battleCount,
    startLevel,
    bossLevel: clamp(enemy.level, 1, 24),
    bossName: enemy.name,
    bossSubtitle: enemy.subtitle,
    bossId: enemy.bossId,
    theme: 'road',
    labelOffset: enemy.level,
    includeShops: false,
    includeEvents: battleCount > 3,
  });
}

function getFightRowTargets(nodes: DungeonNode[]): DungeonNode[] {
  const fights = nodes.filter(node => node.type === 'battle' || node.type === 'elite' || node.type === 'boss');
  return fights.length > 0 ? fights : nodes;
}

function isExclusiveRewardRow(
  row: { nodes: DungeonNode[] },
  prevRow?: { nodes: DungeonNode[] },
): boolean {
  if (row.nodes.length !== 1) return false;

  const node = row.nodes[0];
  if (node.type !== 'shop' && node.type !== 'event') return false;
  if (node.rewardSource === 'hard' || node.rewardSource === 'boss') return true;
  if (!prevRow) return false;
  if (prevRow.nodes.some(prevNode => prevNode.type === 'elite')) return true;
  if (prevRow.nodes.length === 1 && prevRow.nodes[0].type === 'boss') return true;

  return false;
}

function normalizeDailyRunNodes(nodes: DungeonNode[]): DungeonNode[] {
  if (!hasBranchNodeLayout(nodes)) return nodes;

  const rows = getDailyNodeRows(nodes);
  const nextIdsByNodeId = new Map<string, string[]>();

  rows.forEach((row, rowIndex) => {
    const prevRow = rowIndex > 0 ? rows[rowIndex - 1] : undefined;
    const nextRow = rows[rowIndex + 1];

    row.nodes.forEach(source => {
    if (!nextRow) {
        nextIdsByNodeId.set(source.id, []);
      return;
    }

      let targetIds: string[];

      if (isExclusiveRewardRow(row, prevRow)) {
        targetIds = getAdjacentBranchNodeIds(source, row.nodes.length, getFightRowTargets(nextRow.nodes));
      } else if (isExclusiveRewardRow(nextRow, row)) {
        const rewardNode = nextRow.nodes[0];
        if (source.type === 'elite' || source.type === 'boss') {
          targetIds = [rewardNode.id];
        } else if (source.type === 'battle') {
          const skipRow = rows[rowIndex + 2];
          targetIds = skipRow
            ? getAdjacentBranchNodeIds(source, row.nodes.length, getFightRowTargets(skipRow.nodes))
            : [];
        } else {
          targetIds = getAdjacentBranchNodeIds(source, row.nodes.length, nextRow.nodes);
        }
      } else {
        const balancedConnections = getBalancedBranchConnections(row.nodes, nextRow.nodes);
        targetIds = balancedConnections.get(source.id) || [];
      }

      nextIdsByNodeId.set(source.id, targetIds);
    });
  });

  return nodes.map(node => ({
    ...node,
    nextIds: nextIdsByNodeId.get(node.id) || node.nextIds || [],
  }));
}

function getAdjacentBranchNodeIds(sourceNode: DungeonNode, sourceRowSize: number, nextRowNodes: DungeonNode[]): string[] {
  const sourceNodes = Array.from({ length: Math.max(1, sourceRowSize) }, (_item, index) => ({
    ...sourceNode,
    id: index === (sourceNode.lane ?? 0) ? sourceNode.id : `${sourceNode.id}-virtual-${index}`,
    lane: index,
  }));
  return getBalancedBranchConnections(sourceNodes, nextRowNodes).get(sourceNode.id) || [];
}

function getBalancedBranchConnections(sourceNodes: DungeonNode[], nextRowNodes: DungeonNode[]): Map<string, string[]> {
  const sortedSources = [...sourceNodes].sort((a, b) => (a.lane ?? 0) - (b.lane ?? 0));
  const sortedTargets = [...nextRowNodes].sort((a, b) => (a.lane ?? 0) - (b.lane ?? 0));
  const connections = new Map(sortedSources.map(node => [node.id, [] as string[]]));
  if (sortedSources.length === 0 || sortedTargets.length === 0) return connections;

  const laneCenter = (node: DungeonNode, rowSize: number) => rowSize <= 1 ? 0.5 : (node.lane ?? 0) / Math.max(1, rowSize - 1);
  const nearestSource = (target: DungeonNode) => sortedSources
    .map(source => ({
      source,
      distance: Math.abs(laneCenter(source, sortedSources.length) - laneCenter(target, sortedTargets.length)),
    }))
    .sort((a, b) => a.distance - b.distance || (a.source.lane ?? 0) - (b.source.lane ?? 0))[0]?.source;
  const nearestTargets = (source: DungeonNode, count: number) => sortedTargets
    .map(target => ({
      target,
      distance: Math.abs(laneCenter(source, sortedSources.length) - laneCenter(target, sortedTargets.length)),
    }))
    .sort((a, b) => a.distance - b.distance || (a.target.lane ?? 0) - (b.target.lane ?? 0))
    .slice(0, count)
    .map(item => item.target);
  const addConnection = (sourceId: string, targetId: string) => {
    const current = connections.get(sourceId) || [];
    if (!current.includes(targetId)) connections.set(sourceId, [...current, targetId]);
  };

  sortedSources.forEach(source => {
    const connectionCount = sortedTargets.length > sortedSources.length ? 2 : 1;
    nearestTargets(source, connectionCount).forEach(target => addConnection(source.id, target.id));
  });

  sortedTargets.forEach(target => {
    const hasIncoming = Array.from(connections.values()).some(nextIds => nextIds.includes(target.id));
    if (hasIncoming) return;

    const source = nearestSource(target);
    if (source) addConnection(source.id, target.id);
  });

  return connections;
}

function createDungeonNodes(dungeon: WorldDungeon): DungeonNode[] {
  const authoredFlavor = DUNGEON_LAYOUTS[dungeon.templateId] || [];

  return createScaledRunNodes({
    idPrefix: `dungeon-${dungeon.id}`,
    battleCount: 15,
    startLevel: clamp(dungeon.level - 2, 1, 24),
    bossLevel: clamp(dungeon.level + 5, 1, 24),
    bossName: dungeon.bossName,
    bossSubtitle: dungeon.bossSubtitle,
    bossId: dungeon.bossId,
    theme: 'dungeon',
    labelOffset: dungeon.level + authoredFlavor.length,
  });
}

function isFinalRunNode(session: RunSession, node?: DungeonNode): boolean {
  if (!node || node.type !== 'boss') return false;
  return !node.nextIds?.length || (node.battleNumber || 0) >= session.targetBattles;
}

function getRewardDestination(session: RunSession, nextWins: number): RewardDestination {
  if (session.nodes.length > 0) {
    const node = session.nodes[session.currentNodeIndex];
    return isFinalRunNode(session, node) || nextWins >= session.targetBattles ? 'complete' : 'dungeon-next';
  }

  if (session.mode === 'daily') {
    return nextWins >= session.targetBattles ? 'complete' : 'daily-next';
  }

  return session.currentNodeIndex >= session.nodes.length - 1 ? 'complete' : 'dungeon-next';
}

function completeDungeonNode(session: RunSession): RunSession {
  const currentNode = session.nodes[session.currentNodeIndex];
  const nodes = session.nodes.map((node, index) => (
    index === session.currentNodeIndex ? { ...node, completed: true } : node
  ));
  const branchMap = hasBranchNodeLayout(nodes);
  const nextIndex = branchMap && currentNode?.nextIds?.length
    ? nodes.findIndex(node => currentNode.nextIds?.includes(node.id) && !node.completed)
    : session.currentNodeIndex + 1;

  if (isFinalRunNode(session, currentNode) || nextIndex < 0 || nextIndex >= nodes.length) {
    return {
      ...session,
      nodes,
      currentNodeIndex: nextIndex,
      phase: 'complete',
      outcome: 'victory',
      notice: session.mode === 'daily'
        ? 'The random road is complete.'
        : session.mode === 'mpDaily'
          ? 'The daily gauntlet is complete.'
        : session.mode === 'encounter'
          ? 'The enemy road is complete.'
          : 'The dungeon path is complete.',
    };
  }

  return {
    ...session,
    nodes,
    currentNodeIndex: nextIndex,
    phase: 'map',
  };
}

function abandonRunCombat(session: RunSession): RunSession {
  return {
    ...session,
    phase: 'complete',
    activeEnemy: null,
    outcome: 'abandoned',
    rewardChoices: [],
    rewardDestination: null,
    notice: 'The warband withdrew. This attempt ends here.',
  };
}

function getRunGoldEarned(session: RunSession, battle: BattleState): number {
  const defeatedEnemies = battle.units.filter(unit => unit.side === 'enemy' && unit.currentHealth <= 0);
  const commanderDefeated = defeatedEnemies.some(unit => unit.kind === 'commander');
  const node = session.nodes[session.currentNodeIndex];
  const routeProgress = session.targetBattles > 0 ? clamp(session.wins / session.targetBattles, 0, 1) : 0;
  const enemyLevel = session.mode === 'daily'
    ? getRandomRunEffectiveLevel(battle.enemy.level)
    : battle.enemy.level;
  const nodeBonus = node?.type === 'boss'
    ? 60 + Math.round(routeProgress * 45)
    : node?.type === 'elite'
      ? 22 + Math.round(routeProgress * 18)
      : 0;
  const perUnit = 7 + Math.floor(enemyLevel / 5) + Math.round(routeProgress * 3);
  const commanderBonus = commanderDefeated ? 18 + Math.round(routeProgress * 12) : 0;
  const base = defeatedEnemies.length * perUnit + commanderBonus + nodeBonus;
  const runMultiplier = session.dailyChallenge?.rewardGoldMultiplier || 1;

  return Math.max(12, Math.round(base * (battle.enemy.lootMultiplier || 1) * runMultiplier));
}

function applyBattleLossesToRun(session: RunSession, battle: BattleState): RunSession {
  const fallenIds = new Set(
    battle.units
      .filter(unit => unit.side === 'player' && unit.kind === 'minion' && unit.currentHealth <= 0 && unit.rosterId)
      .map(unit => unit.rosterId as string)
  );

  if (fallenIds.size === 0) return session;

  return {
    ...session,
    minions: session.minions.map(unit => fallenIds.has(unit.stack.id) ? { ...unit, alive: false } : unit),
  };
}

function persistRunBattleHealth(session: RunSession, battle: BattleState): RunSession {
  const healthByRosterId = new Map<string, number>();

  battle.units.forEach(unit => {
    if (unit.side !== 'player' || unit.kind !== 'minion' || !unit.rosterId) return;
    healthByRosterId.set(unit.rosterId, Math.max(0, Math.round(unit.currentHealth)));
  });

  if (healthByRosterId.size === 0) return session;

  return {
    ...session,
    minions: session.minions.map(unit => {
      const carriedHealth = healthByRosterId.get(unit.stack.id);
      if (carriedHealth === undefined) return unit;

      return {
        ...unit,
        stack: {
          ...unit.stack,
          runCurrentHealth: carriedHealth,
        },
      };
    }),
  };
}

function appendRunBattleReport(session: RunSession, report: RunBattleReport): RunSession {
  return {
    ...session,
    battleReports: [...(session.battleReports || []), report].slice(-12),
  };
}

function createRunBattleReport(battle: BattleState, status: BattleEndResult['status']): RunBattleReport {
  const unitReports = battle.units
    .filter(unit => unit.side === 'player')
    .map(unit => {
      const damageDealt = battle.log
        .filter(entry => entry.actorId === unit.id && (entry.action === 'attack' || entry.action === 'spell'))
        .reduce((total, entry) => total + getBattleLogAmount(entry.message), 0);
      const damageTaken = battle.log
        .filter(entry => entry.targetIds?.includes(unit.id) && entry.side === 'enemy' && (entry.action === 'attack' || entry.action === 'spell'))
        .reduce((total, entry) => total + getBattleLogAmount(entry.message), 0);
      const healingDone = battle.log
        .filter(entry => entry.actorId === unit.id && (entry.action === 'heal' || entry.action === 'morale'))
        .reduce((total, entry) => total + getBattleLogAmount(entry.message), 0);

      return {
        id: unit.id,
        name: unit.name,
        assetPath: unit.assetPath,
        side: unit.side,
        alive: unit.currentHealth > 0,
        damageDealt,
        damageTaken,
        healingDone,
      };
    });

  return {
    id: `${battle.id}-${status}-${Date.now()}`,
    enemyName: battle.enemy.name,
    enemyAssetPath: battle.enemy.artworkPath || getPlayerModelAsset(battle.enemy.modelNumber),
    enemyLevel: battle.enemy.level,
    enemyPersonality: battle.enemy.personality,
    status,
    round: battle.round,
    durationMs: Math.max(0, Date.now() - battle.createdAt),
    damageDealt: unitReports.reduce((total, unit) => total + unit.damageDealt, 0),
    damageTaken: unitReports.reduce((total, unit) => total + unit.damageTaken, 0),
    healingDone: unitReports.reduce((total, unit) => total + unit.healingDone, 0),
    unitReports,
  };
}

function getBattleLogAmount(message: string): number {
  const match = message.match(/\b(\d+)\b/);
  return match ? Number(match[1]) : 0;
}

function formatRunDuration(durationMs: number): string {
  if (durationMs <= 0) return '0s';
  const seconds = Math.round(durationMs / 1000);
  const minutes = Math.floor(seconds / 60);
  const remainingSeconds = seconds % 60;
  return minutes > 0 ? `${minutes}m ${remainingSeconds}s` : `${remainingSeconds}s`;
}

function getRunRewardChoiceById(choiceId: string, equipmentOffer?: Equipment): RunRewardChoice | undefined {
  if (choiceId === MERCENARY_SHOP_REWARD_ID) return makeMercenaryShopReward();
  const staticChoice = RUN_REWARD_POOL.find(choice => choice.id === choiceId);
  if (staticChoice) return staticChoice;
  if (choiceId.startsWith('gear-offer-') && equipmentOffer) {
    return restoreRunEquipmentReward(choiceId, equipmentOffer);
  }
  return undefined;
}

function isWorldMapRun(session: RunSession): boolean {
  return session.mode === 'dungeon' || session.mode === 'encounter';
}

const WORLD_MAP_BLESSING_BLOCKED_CATEGORIES = new Set([
  'learn-spell',
  'equipment',
  'recruit',
  'upgrade',
  'revive',
  'gold',
  'economy',
]);

const RUN_BLESSING_POWER_TIER_BY_ID: Record<string, 1 | 2 | 3> = {
  'balanced-training': 1,
  'candle-tactician': 1,
  'field-surgeon-prayer': 1,
  'omen-candle': 1,
  'army-drill': 2,
  'iron-ward': 2,
  'candle-liturgy': 2,
  'banner-song': 2,
  'blooded-constitution': 2,
  'frontline-drill': 2,
  'shield-wall-vow': 2,
  'oath-captain': 2,
  'weapon-rites': 3,
  'relic-armor': 3,
  'moonwell-focus': 3,
  'war-chorus': 3,
  'saint-bone-vigor': 3,
  'saint-triage': 3,
};

const WORLD_MAP_BLESSING_TIER_WEIGHT: Record<1 | 2 | 3, number> = {
  1: 1,
  2: 0.2,
  3: 0.05,
};

const WORLD_MAP_BLESSING_MAX_TIER2_PER_SCREEN = 1;
const WORLD_MAP_BLESSING_MAX_TIER3_PER_SCREEN = 1;

function getRunBlessingPowerTier(choice: RunRewardChoice): 1 | 2 | 3 {
  const mapped = RUN_BLESSING_POWER_TIER_BY_ID[choice.id];
  if (mapped) return mapped;

  const normalized = `${choice.id} ${choice.name} ${choice.description}`.toLowerCase();
  if (normalized.includes('+4') || normalized.includes('+35') || normalized.includes('heavily heal')) return 3;
  if (normalized.includes('+2') || normalized.includes('+20') || normalized.includes('recover 18')) return 2;
  return 1;
}

function getWorldMapBlessingPickWeight(choice: RunRewardChoice): number {
  return WORLD_MAP_BLESSING_TIER_WEIGHT[getRunBlessingPowerTier(choice)];
}

function pickWeightedRunRewardChoice<T extends { weight: number }>(items: T[]): T | null {
  const total = items.reduce((sum, item) => sum + item.weight, 0);
  if (total <= 0 || items.length === 0) return null;

  let roll = Math.random() * total;
  for (const item of items) {
    roll -= item.weight;
    if (roll <= 0) return item;
  }

  return items[items.length - 1] || null;
}

function pickWorldMapRunRewardChoices(
  session: RunSession,
  count: number,
  excluded: (choice: RunRewardChoice) => boolean,
): RunRewardChoice[] {
  const buffPool = RUN_BUFFS.filter(choice => (!choice.isAvailable || choice.isAvailable(session)) && !excluded(choice));
  const buffFallback = RUN_BUFFS.filter(choice => !choice.isAvailable && !excluded(choice));
  const workingBuffPool = buffPool.length >= count ? buffPool : buffFallback;

  const selected: RunRewardChoice[] = [];
  const usedCategories = new Set<string>();
  let tier2Count = 0;
  let tier3Count = 0;

  const canOfferTier = (tier: 1 | 2 | 3) => (
    tier === 3
      ? tier3Count < WORLD_MAP_BLESSING_MAX_TIER3_PER_SCREEN
      : tier === 2
        ? tier2Count < WORLD_MAP_BLESSING_MAX_TIER2_PER_SCREEN
        : true
  );

  const tryAdd = (choice: RunRewardChoice): boolean => {
    if (selected.length >= count) return false;
    if (excluded(choice)) return false;
    if (selected.some(item => item.id === choice.id)) return false;

    const tier = getRunBlessingPowerTier(choice);
    if (!canOfferTier(tier)) return false;

    const category = getRunRewardCategory(choice);
    if (usedCategories.has(category)) return false;

    selected.push(choice);
    usedCategories.add(category);
    if (tier === 2) tier2Count += 1;
    if (tier === 3) tier3Count += 1;
    return true;
  };

  while (selected.length < count) {
    const candidates = workingBuffPool.filter(choice => {
      if (excluded(choice)) return false;
      if (selected.some(item => item.id === choice.id)) return false;
      if (usedCategories.has(getRunRewardCategory(choice))) return false;
      return canOfferTier(getRunBlessingPowerTier(choice));
    });

    if (candidates.length === 0) break;

    const picked = pickWeightedRunRewardChoice(
      candidates.map(choice => ({ choice, weight: getWorldMapBlessingPickWeight(choice) })),
    );
    if (!picked || !tryAdd(picked.choice)) break;
  }

  shuffle(workingBuffPool.filter(choice => getRunBlessingPowerTier(choice) === 1)).forEach(choice => {
    if (selected.length >= count) return;
    tryAdd(choice);
  });

  shuffle(workingBuffPool).forEach(choice => {
    if (selected.length >= count) return;
    tryAdd(choice);
  });

  return shuffle(selected).slice(0, count);
}

function isWorldMapBlessingBlocked(choice: RunRewardChoice): boolean {
  return WORLD_MAP_BLESSING_BLOCKED_CATEGORIES.has(getRunRewardCategory(choice));
}

function isWorldMapShopRewardBlocked(choice: RunRewardChoice): boolean {
  return isWorldMapBlessingBlocked(choice) || isRunShopRewardBlocked(choice);
}

function getRunRewardCategory(choice: RunRewardChoice): string {
  if (choice.category) return choice.category;
  const id = choice.id;
  if (id.startsWith('learn-')) return 'learn-spell';
  if (id.startsWith('gear-offer-') || choice.equipmentOffer) return 'equipment';
  if (id.includes('army') || id.includes('weapon')) return 'army';
  if (id.includes('ward') || id.includes('armor') || id.includes('defensive')) return 'defense';
  if (id.includes('spell') || id.includes('focus') || id.includes('liturgy')) return 'spell';
  if (id.includes('banner') || id.includes('chorus') || id.includes('morale')) return 'morale';
  if (id.includes('constitution') || id.includes('vigor') || id.includes('health')) return 'health';
  if (id.includes('balanced') || id.includes('oath-captain')) return 'balanced';
  if (id.includes('resurrect') || id.includes('mercy') || id.includes('reprieve')) return 'revive';
  if (id.includes('recruit')) return 'recruit';
  if (id.includes('upgrade') || id.includes('promotion')) return 'upgrade';
  if (id.includes('gold') || id.includes('coin')) return 'gold';
  if (id.includes('reroll') || id.includes('omen')) return 'reroll';
  return id;
}

function pickRunRewardChoices(
  session: RunSession,
  count = RUN_REWARD_CHOICE_COUNT,
  options?: { spellChance?: number; equipmentChance?: number; excludeChoice?: (choice: RunRewardChoice) => boolean },
): RunRewardChoice[] {
  const worldMapRun = isWorldMapRun(session);
  const spellChance = worldMapRun ? 0 : (options?.spellChance ?? RUN_BLESSING_SPELL_OFFER_CHANCE);
  const equipmentChance = worldMapRun ? 0 : (options?.equipmentChance ?? RUN_BLESSING_EQUIPMENT_OFFER_CHANCE);
  const excluded = (choice: RunRewardChoice) => {
    if (options?.excludeChoice?.(choice)) return true;
    if (worldMapRun && isWorldMapBlessingBlocked(choice)) return true;
    return false;
  };

  if (worldMapRun) {
    return pickWorldMapRunRewardChoices(session, count, excluded);
  }

  const buffPool = RUN_BUFFS.filter(choice => (!choice.isAvailable || choice.isAvailable(session)) && !excluded(choice));
  const spellPool = RUN_SPELL_REWARDS.filter(choice => (!choice.isAvailable || choice.isAvailable(session)) && !excluded(choice));
  const buffFallback = RUN_BUFFS.filter(choice => !choice.isAvailable && !excluded(choice));
  const workingBuffPool = buffPool.length >= count ? buffPool : buffFallback;

  const selected: RunRewardChoice[] = [];
  const usedCategories = new Set<string>();

  const tryAdd = (choice: RunRewardChoice): boolean => {
    if (selected.length >= count) return false;
    if (excluded(choice)) return false;
    if (selected.some(item => item.id === choice.id)) return false;
    const category = getRunRewardCategory(choice);
    if (usedCategories.has(category)) return false;
    selected.push(choice);
    usedCategories.add(category);
    return true;
  };

  if (Math.random() < equipmentChance) {
    const equipmentReward = pickRunEquipmentReward(session);
    if (equipmentReward) tryAdd(equipmentReward);
  }

  if (spellPool.length > 0 && Math.random() < spellChance) {
    tryAdd(shuffle(spellPool)[0]);
  }

  shuffle(workingBuffPool).forEach(choice => {
    if (selected.length >= count) return;
    tryAdd(choice);
  });

  shuffle(workingBuffPool).forEach(choice => {
    if (selected.length >= count) return;
    tryAdd(choice);
  });

  return shuffle(selected).slice(0, count);
}

function makeShopOffers(session: RunSession, count = RUN_SHOP_CHOICE_COUNT): RunShopOffer[] {
  const worldMapRun = isWorldMapRun(session);
  const offers: RunShopOffer[] = pickRunRewardChoices(session, count, {
    spellChance: worldMapRun ? 0 : RUN_SHOP_SPELL_OFFER_CHANCE,
    equipmentChance: worldMapRun ? 0 : RUN_SHOP_EQUIPMENT_OFFER_CHANCE,
    excludeChoice: worldMapRun ? isWorldMapShopRewardBlocked : isRunShopRewardBlocked,
  }).map((choice, index) => ({
    choiceId: choice.id,
    cost: getRunShopOfferCost(session, index, choice),
    equipmentOffer: choice.equipmentOffer,
  }));

  return injectMercenaryShopOffer(session, offers, count).slice(0, count);
}

function makeMercenaryShopOffer(session: RunSession): RunShopOffer | null {
  if (isWorldMapRun(session) || !canAddRunMinion(session) || !getMinionTemplate(MERCENARY_TEMPLATE_ID)) {
    return null;
  }
  const chanceRoll = getStableShopRoll(`${session.id}:${getShopNodeOfferKey(session)}:${session.wins}:mercenary-offer`, 10000) / 10000;
  if (chanceRoll >= MERCENARY_SHOP_OFFER_CHANCE) {
    return null;
  }

  return {
    choiceId: MERCENARY_SHOP_REWARD_ID,
    cost: getMercenaryShopCost(session),
  };
}

function injectMercenaryShopOffer(session: RunSession, offers: RunShopOffer[], count = RUN_SHOP_CHOICE_COUNT): RunShopOffer[] {
  const mercenaryOffer = makeMercenaryShopOffer(session);
  if (!mercenaryOffer || offers.some(offer => offer.choiceId === MERCENARY_SHOP_REWARD_ID)) return offers;

  const nextOffers = [...offers];
  const replaceableIndex = nextOffers.findIndex(offer => !offer.purchased && !offer.equipmentOffer);
  const replaceIndex = nextOffers.length >= count
    ? replaceableIndex >= 0 ? replaceableIndex : nextOffers.length - 1
    : nextOffers.length;
  nextOffers[replaceIndex] = mercenaryOffer;
  return nextOffers;
}

function getStableShopRoll(label: string, modulo: number): number {
  let hash = 0;
  for (let index = 0; index < label.length; index += 1) {
    hash = (hash * 31 + label.charCodeAt(index)) >>> 0;
  }
  return modulo > 0 ? hash % modulo : 0;
}

function getMercenaryShopCost(session: RunSession): number {
  const routeProgress = session.targetBattles > 0 ? clamp(session.wins / session.targetBattles, 0, 1) : 0;
  const level = getRandomRunEffectiveLevel(session.stats.level || 1);
  const rolledPremium = getStableShopRoll(`${session.id}:${getShopNodeOfferKey(session)}:${session.wins}:mercenary`, 90);
  return Math.max(150, Math.round((150 + level * 6 + routeProgress * 65 + rolledPremium) / 5) * 5);
}

function isRunShopRewardBlocked(choice: RunRewardChoice): boolean {
  const blockedCategories = new Set(['gold', 'reroll', 'economy', 'revive', 'upgrade', 'minion-heal']);
  return blockedCategories.has(getRunRewardCategory(choice));
}

function getRunShopOfferCost(session: RunSession, index: number, choice: RunRewardChoice): number {
  const node = session.nodes[session.currentNodeIndex];
  const routeProgress = session.targetBattles > 0 ? clamp(session.wins / session.targetBattles, 0, 1) : 0;
  const level = session.mode === 'daily'
    ? getRandomRunEffectiveLevel(session.stats.level || 1)
    : clamp(node?.level || session.stats.level || 1, 1, 24);
  const category = getRunRewardCategory(choice);
  const categoryMultiplier = category === 'revive'
    ? 1.25
    : category === 'upgrade' || category === 'learn-spell'
      ? 1.18
      : category === 'equipment'
        ? 1.14
      : category === 'recruit'
        ? 1.1
        : category === 'gold'
          ? 0.72
          : 1;
  const base = session.mode === 'daily'
    ? 32 + index * 22 + Math.round(routeProgress * 30) + Math.floor((level - 1) * 2.5)
    : 35 + index * 20 + Math.floor(level * 1.5);
  const worldMapTierMultiplier = isWorldMapRun(session)
    ? getRunBlessingPowerTier(choice) === 3
      ? 1.5
      : getRunBlessingPowerTier(choice) === 2
        ? 1.25
        : 1
    : 1;

  return Math.max(20, Math.round((base * categoryMultiplier * worldMapTierMultiplier) / 5) * 5);
}

function getShopNodeOfferKey(session: RunSession): string {
  return session.nodes[session.currentNodeIndex]?.id || `node-${session.currentNodeIndex}`;
}

function getShopOffersForSession(session: RunSession): RunShopOffer[] {
  const key = getShopNodeOfferKey(session);
  const offers = (session.shopOffers?.[key] || []).filter(offer => {
    const choice = getRunRewardChoiceById(offer.choiceId, offer.equipmentOffer);
    return Boolean(choice && !isRunShopRewardBlocked(choice));
  });
  return injectMercenaryShopOffer(session, offers);
}

function ensureShopOffers(session: RunSession): RunSession {
  const key = getShopNodeOfferKey(session);
  if (Object.prototype.hasOwnProperty.call(session.shopOffers || {}, key)) return session;

  return {
    ...session,
    shopOffers: {
      ...(session.shopOffers || {}),
      [key]: makeShopOffers(session),
    },
  };
}

function rerollShopOffers(session: RunSession): RunSession {
  const remaining = session.shopRerollsRemaining ?? RUN_SHOP_REROLL_COUNT;
  if (remaining <= 0) return { ...session, notice: 'No shop rerolls remain for this run.' };
  const key = getShopNodeOfferKey(session);

  return {
    ...session,
    shopOffers: {
      ...(session.shopOffers || {}),
      [key]: makeShopOffers(session),
    },
    shopRerollsRemaining: remaining - 1,
    notice: `Shop restocked. ${remaining - 1} reroll${remaining - 1 === 1 ? '' : 's'} remain.`,
  };
}

function rerollRewardChoices(session: RunSession): RunSession {
  const remaining = session.blessingRerollsRemaining ?? RUN_BLESSING_REROLL_COUNT;
  if (remaining <= 0) return { ...session, notice: 'No blessing rerolls remain for this run.' };

  return {
    ...session,
    rewardChoices: pickRunRewardChoices(session),
    blessingRerollsRemaining: remaining - 1,
    notice: `Blessings redrawn. ${remaining - 1} reroll${remaining - 1 === 1 ? '' : 's'} remain.`,
  };
}

function buyShopReward(session: RunSession, offerIndex: number, choice: RunRewardChoice, cost: number): RunSession {
  if (session.runGold < cost) return { ...session, notice: 'Not enough run gold.' };
  const key = getShopNodeOfferKey(session);
  const offers = getShopOffersForSession(session);
  const offer = offers[offerIndex];
  if (!offer || offer.purchased) return { ...session, notice: 'That shop offer is already claimed.' };
  if (offer.choiceId !== choice.id || offer.cost !== cost) return { ...session, notice: 'The shop offer changed. Pick again.' };
  const paidSession = { ...session, runGold: session.runGold - cost };
  const applied = queueRunRewardCelebrations(paidSession, choice.apply(paidSession), choice);

  return {
    ...applied,
    phase: 'shop',
    rewardChoices: [],
    rewardDestination: null,
    shopOffers: {
      ...(applied.shopOffers || session.shopOffers || {}),
      [key]: offers.map((item, index) => index === offerIndex ? { ...item, purchased: true } : item),
    },
    shopBuyHistory: [...(applied.shopBuyHistory || session.shopBuyHistory || []), `${choice.name} (${cost}g)`],
    notice: `${choice.name} purchased for ${cost} run gold.`,
  };
}

function rerollOmen(session: RunSession): RunSession {
  const remaining = session.omenRerollsRemaining ?? RUN_OMEN_REROLL_COUNT;
  if (remaining <= 0) return { ...session, notice: 'No omen rerolls remain for this run.' };

  return {
    ...session,
    omenRerollsRemaining: remaining - 1,
    notice: `The omen twists. ${remaining - 1} reroll${remaining - 1 === 1 ? '' : 's'} remain.`,
  };
}

function applyHardRouteVictoryBonus(session: RunSession): RunSession {
  const worldMapRun = isWorldMapRun(session);
  const routeProgress = session.targetBattles > 0 ? clamp(session.wins / session.targetBattles, 0, 1) : 0;
  const goldBonus = worldMapRun
    ? 10 + Math.round(routeProgress * 10)
    : 25 + Math.round(routeProgress * 25);
  const bonuses: Array<{
    stats: Partial<Pick<CharacterStats, 'armyPower' | 'defensivePower' | 'morale' | 'spellPower' | 'maxHealth' | 'health'>>;
    detail: string;
  }> = worldMapRun
    ? [
        { stats: { armyPower: 1 }, detail: '+1 Army Power' },
        { stats: { defensivePower: 1 }, detail: '+1 Defensive Power' },
        { stats: { morale: 1 }, detail: '+1 Morale' },
      ]
    : [
        { stats: { armyPower: 1, morale: 1 }, detail: '+1 Army and +1 Morale' },
        { stats: { defensivePower: 1, maxHealth: 8, health: 8 }, detail: '+1 Ward and +8 commander health' },
        { stats: { spellPower: 1, morale: 1 }, detail: '+1 Spell and +1 Morale' },
      ];
  const bonus = shuffle(bonuses)[0] || bonuses[0];
  const stats = {
    ...session.stats,
    armyPower: session.stats.armyPower + (bonus.stats.armyPower || 0),
    defensivePower: session.stats.defensivePower + (bonus.stats.defensivePower || 0),
    morale: session.stats.morale + (bonus.stats.morale || 0),
    spellPower: session.stats.spellPower + (bonus.stats.spellPower || 0),
    maxHealth: session.stats.maxHealth + (bonus.stats.maxHealth || 0),
    health: Math.min(
      session.stats.maxHealth + (bonus.stats.maxHealth || 0),
      session.stats.health + (bonus.stats.health || 0)
    ),
  };

  return {
    ...session,
    stats,
    runGold: session.runGold + goldBonus,
    blessingRerollsRemaining: worldMapRun
      ? (session.blessingRerollsRemaining ?? RUN_BLESSING_REROLL_COUNT)
      : (session.blessingRerollsRemaining ?? RUN_BLESSING_REROLL_COUNT) + 1,
    pendingPositiveOmen: true,
    notice: worldMapRun
      ? `Hard route bonus claimed: ${bonus.detail} and +${goldBonus} run gold. A modest omen waits after the reward.`
      : `Hard route bonus claimed: ${bonus.detail}, +${goldBonus} run gold, and +1 blessing reroll.`,
  };
}

function getScaledRunOmenGold(session: RunSession, base: number): number {
  const routeProgress = session.targetBattles > 0 ? clamp(session.wins / session.targetBattles, 0, 1) : 0;
  const level = session.mode === 'daily'
    ? getRandomRunEffectiveLevel(session.stats.level || 1)
    : clamp(session.stats.level || 1, 1, 24);

  return Math.max(10, Math.round((base + routeProgress * 24 + (level - 1) * 1.8) / 5) * 5);
}

function getAliveRunUnitIndexes(session: RunSession): number[] {
  return session.minions
    .map((unit, index) => unit.alive ? index : -1)
    .filter(index => index >= 0);
}

function applyBloodCovenantOmen(session: RunSession): RunSession {
  const aliveIndexes = getAliveRunUnitIndexes(session);
  const chosenIndex = shuffle(aliveIndexes)[0];
  const wounded = typeof chosenIndex === 'number' ? woundSpecificMinion(session, chosenIndex) : session;

  return {
    ...wounded,
    stats: {
      ...wounded.stats,
      armyPower: wounded.stats.armyPower + 2,
      spellPower: wounded.stats.spellPower + 1,
    },
    notice: 'Blood Covenant claimed: one fighter falls, but the run gains +2 Army Power and +1 Spell Power.',
  };
}

function buildClassDoctrineOmen(session: RunSession): OmenOutcome {
  const classes = Array.from(new Set(
    session.minions
      .filter(unit => unit.alive)
      .map(unit => getMinionTemplate(unit.stack.templateId)?.class)
      .filter((classId): classId is MinionClass => Boolean(classId))
  ));
  const classId = shuffle(classes)[0] || 'knight';
  const label = `${MINION_CLASS_LABELS[classId]} Doctrine`;
  const bonus: RunUnitStatBonus = classId === 'priest'
    ? { healing: 2, health: 4 }
    : classId === 'wizard'
      ? { magic: 2, health: 3 }
      : classId === 'templar'
        ? { defense: 2, health: 5 }
        : { attack: 2, health: 4 };

  return {
    id: `omen-class-doctrine-${classId}`,
    title: label,
    flavor: 'The sign chooses one order in the warband and brands its vow deeper.',
    detail: `${MINION_CLASS_LABELS[classId]} units gain a run-only combat bonus.`,
    tone: classId === 'templar' ? 'ward' : 'blessing',
    apply: current => grantRunUnitClassBonus(
      current,
      classId,
      bonus,
      label,
      `${label} strengthened the ${MINION_CLASS_LABELS[classId].toLowerCase()} line.`
    ),
  };
}

function buildRangedDoctrineOmen(session: RunSession): OmenOutcome {
  const hasRanged = session.minions.some(unit => {
    const template = getMinionTemplate(unit.stack.templateId);
    return unit.alive && Boolean(template && template.stats.range > 1);
  });

  if (!hasRanged) {
    return {
      id: 'omen-ranged-fallback',
      title: 'Unspent Arrow Rite',
      flavor: 'The omen finds no ranged line to bless, so it leaves coin for the next road.',
      detail: `You gain ${getScaledRunOmenGold(session, 45)} run gold.`,
      tone: 'gold',
      apply: current => ({ ...current, runGold: current.runGold + getScaledRunOmenGold(current, 45) }),
    };
  }

  return {
    id: 'omen-ranged-doctrine',
    title: 'Moon Arrow Doctrine',
    flavor: 'A pale arc traces itself from every bow, staff, and thrown curse.',
    detail: 'Ranged units gain +1 range and +1 attack or magic for this run.',
    tone: 'blessing',
    apply: current => grantRangedRunUnitBonus(
      current,
      { range: 1, attack: 1, magic: 1 },
      'Moon Arrow',
      'Moon Arrow Doctrine sharpened the ranged line.'
    ),
  };
}

function rollSpecialDungeonEventOutcome(session: RunSession, roll: number, deepRoad: boolean): OmenOutcome | null {
  if (roll >= 0.2 && roll < 0.28 && getAliveRunUnitIndexes(session).length >= 2) {
    return {
      id: 'omen-blood-covenant',
      title: 'Blood Covenant',
      flavor: 'The road offers strength for a body. The bargain is ugly, but clear.',
      detail: 'One living minion falls. Gain +2 Army Power and +1 Spell Power for this run.',
      tone: 'curse',
      apply: applyBloodCovenantOmen,
    };
  }

  if (roll >= 0.48 && roll < 0.56) return buildClassDoctrineOmen(session);

  if (roll >= 0.68 && roll < 0.74) {
    const gold = getScaledRunOmenGold(session, deepRoad ? 55 : 40);
    return {
      id: 'omen-quartermaster-route',
      title: 'Quartermaster Route',
      flavor: 'A hidden cart road opens for one night, marked by black coin and candle smoke.',
      detail: `Gain ${gold} run gold and +1 shop reroll.`,
      tone: 'gold',
      apply: current => ({
        ...current,
        runGold: current.runGold + gold,
        shopRerollsRemaining: (current.shopRerollsRemaining ?? RUN_SHOP_REROLL_COUNT) + 1,
        notice: 'Quartermaster Route added run gold and a shop reroll.',
      }),
    };
  }

  if (roll >= 0.84 && roll < 0.9) return buildRangedDoctrineOmen(session);

  return null;
}

function rollPositiveWorldMapEventOutcome(session: RunSession): OmenOutcome {
  const outcomes: OmenOutcome[] = [
    {
      id: 'hard-route-ward',
      title: 'Clear Ward',
      flavor: 'The hard road answers with a clean bell tone and settles over your armor.',
      detail: '+1 Defensive Power for the rest of this run.',
      tone: 'ward',
      apply: current => makeStatBuff('hard-route-ward', 'Clear Ward', '+1 Defensive Power from the hard road.', { defensivePower: 1 }).apply(current),
    },
    {
      id: 'hard-route-training',
      title: 'Road Tempering',
      flavor: 'The warband breathes together and the hard route feels earned.',
      detail: '+1 Army Power and +1 Morale for this run.',
      tone: 'blessing',
      apply: current => makeStatBuff('hard-route-training', 'Road Tempering', '+1 Army Power and +1 Morale.', { armyPower: 1, morale: 1 }).apply(current),
    },
    {
      id: 'hard-route-morale',
      title: 'Banner Echo',
      flavor: 'A second wind rolls through the ranks without asking for coin or recruits.',
      detail: '+2 Morale for this run.',
      tone: 'blessing',
      apply: current => makeStatBuff('hard-route-morale', 'Banner Echo', '+2 Morale from the hard road.', { morale: 2 }).apply(current),
    },
  ];

  outcomes.push(buildClassDoctrineOmen(session));

  if (session.minions.some(unit => {
    const template = getMinionTemplate(unit.stack.templateId);
    return unit.alive && Boolean(template && template.stats.range > 1);
  })) {
    outcomes.push(buildRangedDoctrineOmen(session));
  }

  if (hasWoundedRunMinions(session)) {
    outcomes.push({
      id: 'hard-route-salve',
      title: 'Mercy After Iron',
      flavor: 'Warm wax seals the worst cuts before the next chamber.',
      detail: 'Living minions recover 12 health.',
      tone: 'blessing',
      apply: current => healLivingRunMinions(current, 12, 'Mercy After Iron restored the wounded.'),
    });
  }

  return shuffle(outcomes)[0] || outcomes[0];
}

function rollPositiveDungeonEventOutcome(session: RunSession): OmenOutcome {
  if (isWorldMapRun(session)) return rollPositiveWorldMapEventOutcome(session);

  const goldReward = getScaledRunOmenGold(session, 70);
  const outcomes: OmenOutcome[] = [
    {
      id: 'hard-route-ward',
      title: 'Clear Ward',
      flavor: 'The hard road answers with a clean bell tone and settles over your armor.',
      detail: '+2 Defensive Power for the rest of this run.',
      tone: 'ward',
      apply: current => makeStatBuff('hard-route-ward', 'Clear Ward', '+2 Defensive Power from the hard road.', { defensivePower: 2 }).apply(current),
    },
    {
      id: 'hard-route-gold',
      title: 'Unburned Tithe',
      flavor: 'A sealed purse rolls out from under the road stones.',
      detail: `You gain ${goldReward} run gold.`,
      tone: 'gold',
      apply: current => ({ ...current, runGold: current.runGold + goldReward }),
    },
    {
      id: 'hard-route-training',
      title: 'Road Tempering',
      flavor: 'The warband breathes together and the hard route feels earned.',
      detail: '+1 Army, +1 Morale, and +1 Spell Power for this run.',
      tone: 'blessing',
      apply: current => makeStatBuff('hard-route-training', 'Road Tempering', '+1 Army, Morale, and Spell Power.', { armyPower: 1, morale: 1, spellPower: 1 }).apply(current),
    },
  ];

  outcomes.push(buildClassDoctrineOmen(session));

  if (session.minions.some(unit => {
    const template = getMinionTemplate(unit.stack.templateId);
    return unit.alive && Boolean(template && template.stats.range > 1);
  })) {
    outcomes.push(buildRangedDoctrineOmen(session));
  }

  outcomes.push({
    id: 'hard-route-quartermaster',
    title: 'Quartermaster Route',
    flavor: 'A hidden cart road opens behind the hard route, marked by black coin and candle smoke.',
    detail: `Gain ${goldReward} run gold and +1 shop reroll.`,
    tone: 'gold',
    apply: current => ({
      ...current,
      runGold: current.runGold + goldReward,
      shopRerollsRemaining: (current.shopRerollsRemaining ?? RUN_SHOP_REROLL_COUNT) + 1,
      notice: 'Quartermaster Route added run gold and a shop reroll.',
    }),
  });

  if (hasFallenMinions(session)) {
    outcomes.push({
      id: 'hard-route-revive',
      title: 'Mercy After Iron',
      flavor: 'The omen refuses to take more from a warband that already paid blood.',
      detail: 'One fallen minion returns to the run.',
      tone: 'blessing',
      apply: current => resurrectMinions(current, 1),
    });
  } else if (canAddRunMinion(session)) {
    const template = pickPlayerRunTemplate('tier2');
    outcomes.push({
      id: 'hard-route-recruit',
      title: 'Oathbound Straggler',
      flavor: 'A battered fighter leaves the enemy road and joins your banner.',
      detail: `${template.name} joins the run.`,
      tone: 'recruit',
      apply: current => addRunMinionFromTemplate(current, template, `${template.name} joins the run.`),
    });
  }

  return shuffle(outcomes)[0] || outcomes[0];
}

function rollWorldMapEventOutcome(session: RunSession): OmenOutcome {
  const roll = Math.random();

  if (roll < 0.22) {
    const alive = session.minions
      .map((unit, index) => ({ unit, index }))
      .filter(item => item.unit.alive);
    const chosen = shuffle(alive)[0];

    if (!chosen) {
      return {
        id: 'curse-morale',
        title: 'Hollow Sigil',
        flavor: 'The omen finds no living target and saps the warband spirit instead.',
        detail: '-2 Morale for the rest of this run.',
        tone: 'curse',
        apply: current => makeStatBuff('curse-morale', 'Hollow Sigil', '-2 Morale from a dark omen.', { morale: -2 }).apply(current),
      };
    }

    const name = getMinionTemplate(chosen.unit.stack.templateId)?.name || 'A minion';
    return {
      id: 'curse',
      title: 'Black Sigil',
      flavor: 'A curse bites the chamber and the warband recoils.',
      detail: `${name} is struck down by the omen.`,
      tone: 'curse',
      apply: current => woundSpecificMinion(current, chosen.index),
    };
  }

  if (roll < 0.4) {
    if (hasWoundedRunMinions(session)) {
      return {
        id: 'candle-salve',
        title: 'Candle Salve',
        flavor: 'A small flame walks along the battle cuts and leaves warm wax in its path.',
        detail: 'Living minions recover 12 health.',
        tone: 'blessing',
        apply: current => healLivingRunMinions(current, 12, 'Candle Salve restored the wounded.'),
      };
    }

    return {
      id: 'ward',
      title: 'Event Ward',
      flavor: 'Moonlit water clings to your armor like a blessing.',
      detail: '+1 Defensive Power for the rest of this run.',
      tone: 'ward',
      apply: current => makeStatBuff('event-ward', 'Event Ward', '+1 Defensive Power from the pool.', { defensivePower: 1 }).apply(current),
    };
  }

  if (roll < 0.52) {
    return {
      id: 'ward',
      title: 'Event Ward',
      flavor: 'Moonlit water clings to your armor like a blessing.',
      detail: '+1 Defensive Power for the rest of this run.',
      tone: 'ward',
      apply: current => makeStatBuff('event-ward', 'Event Ward', '+1 Defensive Power from the pool.', { defensivePower: 1 }).apply(current),
    };
  }

  if (roll < 0.64) {
    return {
      id: 'ash-march',
      title: 'Ash March',
      flavor: 'The road dust lifts into marching lines, then settles beneath every boot.',
      detail: '+1 Army Power and +1 Morale for the rest of this run.',
      tone: 'blessing',
      apply: current => makeStatBuff('omen-ash-march', 'Ash March', '+1 Army Power and +1 Morale from an omen.', { armyPower: 1, morale: 1 }).apply(current),
    };
  }

  if (roll < 0.76) {
    return {
      id: 'omen-liturgy',
      title: 'Rune Liturgy',
      flavor: 'A spell sigil brands itself into the warband memory without teaching a new rite.',
      detail: '+1 Spell Power for the rest of this run.',
      tone: 'blessing',
      apply: current => makeStatBuff('omen-liturgy', 'Rune Liturgy', '+1 Spell Power from an omen.', { spellPower: 1 }).apply(current),
    };
  }

  if (roll < 0.88) {
    if (hasWoundedRunMinions(session)) {
      return {
        id: 'saint-triage-omen',
        title: 'Pool Revival',
        flavor: 'Cold water surges and knits the worst wounds still standing.',
        detail: 'Living minions recover 18 health.',
        tone: 'blessing',
        apply: current => healLivingRunMinions(current, 18, 'Pool Revival restored the wounded.'),
      };
    }

    return {
      id: 'omen-reroll-gift',
      title: 'Moonlit Reconsideration',
      flavor: 'The sign refuses to settle and leaves you one more chance to question fate.',
      detail: '+1 omen reroll for this run.',
      tone: 'ward',
      apply: current => ({
        ...current,
        omenRerollsRemaining: (current.omenRerollsRemaining ?? RUN_OMEN_REROLL_COUNT) + 1,
        notice: 'The omen grants one extra omen reroll.',
      }),
    };
  }

  return {
    id: 'omen-war-chorus',
    title: 'War Chorus',
    flavor: 'Distant voices answer your banner and the line steadies.',
    detail: '+1 Army Power and +1 Morale for the rest of this run.',
    tone: 'blessing',
    apply: current => makeStatBuff('omen-war-chorus', 'War Chorus', '+1 Army Power and +1 Morale from an omen.', { armyPower: 1, morale: 1 }).apply(current),
  };
}

function rollDungeonEventOutcome(session: RunSession): OmenOutcome {
  if (session.pendingPositiveOmen) return rollPositiveDungeonEventOutcome(session);
  if (isWorldMapRun(session)) return rollWorldMapEventOutcome(session);

  const roll = Math.random();
  const quietGold = getScaledRunOmenGold(session, 35);
  const highGold = getScaledRunOmenGold(session, 60);
  const curseGold = getScaledRunOmenGold(session, 25);
  const deepRoad = session.targetBattles > 0 && session.wins >= Math.floor(session.targetBattles * 0.45);
  const specialOutcome = rollSpecialDungeonEventOutcome(session, roll, deepRoad);
  if (specialOutcome) return specialOutcome;

  if (roll < 0.2) {
    const alive = session.minions
      .map((unit, index) => ({ unit, index }))
      .filter(item => item.unit.alive);
    const chosen = shuffle(alive)[0];

    if (!chosen) {
      return {
        id: 'curse-gold',
        title: 'Hollow Tithe',
        flavor: 'The omen finds no living target and takes coin instead.',
        detail: `${curseGold} run gold is pulled from your purse.`,
        tone: 'curse',
        apply: current => ({ ...current, runGold: Math.max(0, current.runGold - curseGold) }),
      };
    }

    const name = getMinionTemplate(chosen.unit.stack.templateId)?.name || 'A minion';
    return {
      id: 'curse',
      title: 'Black Sigil',
      flavor: 'A curse bites the chamber and the warband recoils.',
      detail: `${name} is struck down by the omen.`,
      tone: 'curse',
      apply: current => woundSpecificMinion(current, chosen.index),
    };
  }

  if (roll < 0.34) {
    if (!canAddRunMinion(session)) {
      return {
        id: 'full-roster-gold',
        title: 'Crowded Road',
        flavor: 'A lone recruit sees a full banner and leaves a purse in salute.',
        detail: `You gain ${quietGold} run gold.`,
        tone: 'gold',
        apply: current => ({ ...current, runGold: current.runGold + quietGold }),
      };
    }

    const template = pickPlayerRunTemplate('tier1');
    return {
      id: 'recruit',
      title: 'Lost Pilgrim',
      flavor: 'A wanderer steps out of the smoke and kneels at your banner.',
      detail: `${template.name} joins the run.`,
      tone: 'recruit',
      apply: current => addRunMinionFromTemplate(current, template, `${template.name} joins the run.`),
    };
  }

  if (roll < 0.48) {
    if (hasWoundedRunMinions(session)) {
      return {
        id: 'candle-salve',
        title: 'Candle Salve',
        flavor: 'A small flame walks along the battle cuts and leaves warm wax in its path.',
        detail: 'Living minions recover 18 health.',
        tone: 'blessing',
        apply: current => healLivingRunMinions(current, 18, 'Candle Salve restored the wounded.'),
      };
    }

    return {
      id: 'pale-scrip',
      title: 'Pale Scrip',
      flavor: 'The omen leaves a folded road writ where the candle should have burned.',
      detail: `You gain ${quietGold} run gold.`,
      tone: 'gold',
      apply: current => ({ ...current, runGold: current.runGold + quietGold }),
    };
  }

  if (roll < 0.6) {
    return {
      id: 'ward',
      title: 'Event Ward',
      flavor: 'Moonlit water clings to your armor like a blessing.',
      detail: '+2 Defensive Power for the rest of this run.',
      tone: 'ward',
      apply: current => makeStatBuff('event-ward', 'Event Ward', '+2 Defensive Power from the pool.', { defensivePower: 2 }).apply(current),
    };
  }

  if (roll < 0.68) {
    return {
      id: 'ash-march',
      title: 'Ash March',
      flavor: 'The road dust lifts into marching lines, then settles beneath every boot.',
      detail: '+1 Army Power and +2 Morale for the rest of this run.',
      tone: 'blessing',
      apply: current => makeStatBuff('omen-ash-march', 'Ash March', '+1 Army Power and +2 Morale from an omen.', { armyPower: 1, morale: 2 }).apply(current),
    };
  }

  if (roll < 0.76) {
    const learnable = BATTLE_SPELLS.filter(spell => !session.knownSpellIds.includes(spell.id));
    if (learnable.length > 0) {
      const spell = shuffle(learnable)[0];
      return {
        id: `omen-learn-${spell.id}`,
        title: 'Rune Imprint',
        flavor: 'A spell sigil brands itself into the warband memory.',
        detail: `${spell.name} joins your run spellbook.`,
        tone: 'blessing',
        apply: current => learnRunSpell(current, spell.id),
      };
    }
  }

  if (roll < 0.84) {
    if (!hasFallenMinions(session)) {
      return {
        id: 'gold-fallback',
        title: 'Quiet Echo',
        flavor: 'No fallen soul answers the bell, so the omen leaves coin instead.',
        detail: `You gain ${quietGold} run gold.`,
        tone: 'gold',
        apply: current => ({ ...current, runGold: current.runGold + quietGold }),
      };
    }

    return {
      id: 'revive',
      title: 'Pool Revival',
      flavor: 'Cold water surges and drags a fallen fighter back to their feet.',
      detail: 'One fallen minion returns to the run.',
      tone: 'blessing',
      apply: current => resurrectMinions(current, 1),
    };
  }

  if (roll < 0.92) {
    if (hasUpgradeableMinion(session)) {
      return {
        id: 'oath-promotion',
        title: 'Oath Promotion',
        flavor: 'A cracked seal marks one surviving fighter for a stronger vow.',
        detail: 'One living minion upgrades to the next tier.',
        tone: 'blessing',
        apply: current => upgradeRandomMinion(current),
      };
    }

    if (deepRoad && canAddRunMinion(session)) {
      const template = pickPlayerRunTemplate('tier2');
      return {
        id: 'veteran-at-crossroads',
        title: 'Veteran at the Crossroads',
        flavor: 'A road-worn veteran studies your banner, then falls into step.',
        detail: `${template.name} joins the run.`,
        tone: 'recruit',
        apply: current => addRunMinionFromTemplate(current, template, `${template.name} joins the run.`),
      };
    }

    return {
      id: 'omen-reroll-gift',
      title: 'Moonlit Reconsideration',
      flavor: 'The sign refuses to settle and leaves you one more chance to question fate.',
      detail: '+1 omen reroll for this run.',
      tone: 'ward',
      apply: current => ({
        ...current,
        omenRerollsRemaining: (current.omenRerollsRemaining ?? RUN_OMEN_REROLL_COUNT) + 1,
        notice: 'The omen grants one extra omen reroll.',
      }),
    };
  }

  if (roll < 0.945 && canAddRunMinion(session)) {
    const template = pickStandaloneTier1RunTemplate();
    if (template) {
      return {
        id: `omen-standalone-tier1-${template.templateId}`,
        title: 'Strange Road Ally',
        flavor: 'A rare fighter answers the omen instead of the usual reward.',
        detail: `${template.name} joins the run.`,
        tone: 'recruit',
        apply: current => addRunMinionFromTemplate(current, template, `${template.name} joins the run.`),
      };
    }
  }

  if (roll < 0.975 && canAddRunMinion(session)) {
    const template = pickStandaloneTier2RunTemplate();
    if (template) {
      return {
        id: `omen-standalone-${template.templateId}`,
        title: 'Strange Road Ally',
        flavor: 'A rare fighter answers the omen instead of the usual reward.',
        detail: `${template.name} joins the run.`,
        tone: 'recruit',
        apply: current => addRunMinionFromTemplate(current, template, `${template.name} joins the run.`),
      };
    }
  }

  if (roll < 0.992 && deepRoad && canAddRunMinion(session)) {
    const template = pickStandaloneTier3RunTemplate();
    if (template) {
      return {
        id: `omen-standalone-tier3-${template.templateId}`,
        title: 'Grim Road Ally',
        flavor: 'A dangerous fighter answers from deeper on the road.',
        detail: `${template.name} joins the run.`,
        tone: 'recruit',
        apply: current => addRunMinionFromTemplate(current, template, `${template.name} joins the run.`),
      };
    }
  }

  return {
    id: 'gold',
    title: 'Black Coin Spill',
    flavor: 'The pool coughs up treasure before sinking back into silence.',
    detail: `You gain ${highGold} run gold.`,
    tone: 'gold',
    apply: current => ({ ...current, runGold: current.runGold + highGold }),
  };
}

function buildCelebrationResumeTarget(target: RunSession): RunSession {
  return {
    ...target,
    pendingRunCelebrations: [],
    celebrationResume: undefined,
  };
}

function hasPendingRunCelebrations(session: RunSession): boolean {
  return (session.pendingRunCelebrations?.length ?? 0) > 0;
}

function holdSessionForCelebrations(
  holdBase: RunSession,
  resumeTarget: RunSession,
  holdPhase: RunSession['phase'],
): RunSession {
  if (!hasPendingRunCelebrations(holdBase)) {
    return buildCelebrationResumeTarget(resumeTarget);
  }

  return {
    ...holdBase,
    phase: holdPhase,
    celebrationResume: buildCelebrationResumeTarget(resumeTarget),
  };
}

function applyDungeonEventOutcome(session: RunSession, outcome: OmenOutcome): RunSession {
  const applied = queueRunRewardCelebrations(session, outcome.apply(session), {
    id: outcome.id,
    name: outcome.title,
  });

  const resumeTarget = completeDungeonNode({
    ...applied,
    pendingPositiveOmen: false,
    omenHistory: [...(session.omenHistory || []), `${outcome.title}: ${outcome.detail}`],
    notice: outcome.detail,
  });

  return holdSessionForCelebrations(
    {
      ...applied,
      pendingPositiveOmen: false,
      omenHistory: resumeTarget.omenHistory,
      notice: outcome.detail,
    },
    resumeTarget,
    'event',
  );
}

function grantMpDailyCompletionReward(session: RunSession, user: User, completedAt: number): string {
  const challenge = session.mpDailyChallenge || getMpDailyDungeonChallenge(completedAt);
  const durationMs = Math.max(0, completedAt - (session.startedAt || completedAt));
  const gold = challenge.rewardGold + Math.floor(session.runGold * 0.25);
  const exp = challenge.rewardExp + session.wins * 8;
  const lootRoll = generateLootEquipment({ source: 'mp-daily', forcedRarity: Math.random() < 0.22 ? 'legendary' : 'epic' });
  const bonusLoot = Math.random() < 0.35
    ? generateLootEquipment({ source: 'mp-daily', forcedRarity: 'rare' })
    : null;
  const equipment = [lootRoll, bonusLoot].filter(Boolean) as Equipment[];
  const rewardItems: InventoryItem[] = [
    makeInventoryItem('rare-gem', challenge.rewardRareGems),
    ...rollInventoryBonusDrops(user.stats.level || 1, 'dungeonRun'),
  ];
  const slots = user.inventorySlots || 20;
  const itemResult = addInventoryItemsWithLimit(user.inventory || [], rewardItems, slots);
  const gearResult = addEquipmentWithLimit(
    user.equipment || [],
    user.equippedSlots || {},
    equipment,
    slots,
  );
  const acceptedGems = itemResult.acceptedItems
    .filter(item => item.id === 'rare-gem')
    .reduce((total, item) => total + item.quantity, 0);

  const activity: ActivityEntry = {
    id: `activity-mp-daily-${session.id}-${completedAt}`,
    type: 'battle',
    title: `${challenge.name} Cleared`,
    source: 'Daily Gauntlet',
    completedAt,
    dungeonLevel: user.stats.level || 1,
    rewards: {
      gold,
      exp,
      rareGems: acceptedGems || undefined,
      items: itemResult.acceptedItems.length > 0 ? itemResult.acceptedItems : undefined,
      equipment: gearResult.acceptedEquipment.length > 0 ? gearResult.acceptedEquipment : undefined,
    },
    description: `${session.wins} battles won against ${challenge.bossName}.`,
  };

  updateCurrentUser({
    gold: user.gold + gold,
    exp: user.exp + exp,
    inventory: itemResult.inventory,
    equipment: gearResult.equipment,
    mpDailyDungeon: recordMpDailyDungeonCompletion(user, {
      wins: session.wins,
      durationMs,
      bossName: challenge.bossName,
      completedAt,
    }),
    activityLog: [activity, ...(user.activityLog || [])].slice(0, 30),
  });
  levelUp();

  return gearResult.rejectedEquipment.length > 0
    ? `Daily gauntlet cleared for ${gold} gold and ${exp} XP. Gear storage was full for some loot.`
    : `Daily gauntlet cleared: ${gold} gold, ${exp} XP, ${acceptedGems} gems, and set-eligible loot.`;
}

function grantCompletionReward(session: RunSession): string {
  const user = getCurrentUser();
  if (!user || session.outcome !== 'victory') return 'No reward was claimed.';

  const completedAt = Date.now();
  if (session.mode === 'encounter') {
    return grantEncounterCompletionReward(session, user, completedAt);
  }

  if (session.mode === 'mpDaily') {
    return grantMpDailyCompletionReward(session, user, completedAt);
  }

  if (session.mode === 'daily') {
    return grantRandomRunCompletionReward(session, user, completedAt);
  }

  const runGoldConversion = Math.floor(session.runGold * 0.35);
  const baseGold = 110 + session.wins * 45 + runGoldConversion;
  const baseExp = 45 + session.wins * 12;
  const gold = Math.round(baseGold);
  const exp = Math.round(baseExp);
  const rareGems = Math.max(1, Math.floor(session.wins / 2));
  const rarity: EquipmentRarity = session.wins >= 5 ? 'epic' : 'rare';
  const equipment = [generateLootEquipment({
    source: session.dungeon ? 'dungeon-boss' : 'dungeon',
    dungeonId: session.dungeon?.id,
    forcedRarity: rarity,
  })].filter(Boolean) as Equipment[];
  const slots = user.inventorySlots || 20;
  const rewardItems: InventoryItem[] = [
    makeInventoryItem('rare-gem', rareGems),
    ...rollInventoryBonusDrops(user.stats.level || 1, 'dungeonRun'),
  ];
  const itemResult = addInventoryItemsWithLimit(user.inventory || [], rewardItems, slots);
  const gearResult = addEquipmentWithLimit(
    user.equipment || [],
    user.equippedSlots || {},
    equipment,
    slots,
  );
  const acceptedGems = itemResult.acceptedItems
    .filter(item => item.id === 'rare-gem')
    .reduce((total, item) => total + item.quantity, 0);
  const clearedNodes = session.nodes
    .filter(node => node.completed)
    .map(node => node.label);
  const rewardSummary = [
    `${gold} gold`,
    `${exp} XP`,
    acceptedGems > 0 ? `${acceptedGems} gem${acceptedGems === 1 ? '' : 's'}` : '',
    ...itemResult.acceptedItems
      .filter(item => item.id !== 'rare-gem')
      .map(item => item.quantity > 1 ? `${item.quantity} ${item.name}` : item.name),
    ...gearResult.acceptedEquipment.map(item => item.name),
  ].filter(Boolean);

  const activity: ActivityEntry = {
    id: `activity-run-${session.id}-${completedAt}`,
    type: 'battle',
    title: `${session.title} Cleared`,
    source: 'Dungeon Run',
    completedAt,
    dungeonLevel: Math.max(1, session.dungeon?.level || session.stats.level || 1),
    rewards: {
      gold,
      exp,
      rareGems: acceptedGems || undefined,
      items: itemResult.acceptedItems.length > 0 ? itemResult.acceptedItems : undefined,
      equipment: gearResult.acceptedEquipment.length > 0 ? gearResult.acceptedEquipment : undefined,
    },
    description: `${session.wins} battles won with ${getAliveRunRoster(session).length} units standing. Route: ${clearedNodes.join(' -> ')}. Rewards: ${rewardSummary.join(', ')}.`,
  };

  updateCurrentUser({
    gold: user.gold + gold,
    exp: user.exp + exp,
    inventory: itemResult.inventory,
    equipment: gearResult.equipment,
    activityLog: [activity, ...(user.activityLog || [])].slice(0, 30),
  });
  levelUp();

  return gearResult.rejectedEquipment.length > 0
    ? `Claimed ${gold} gold and ${exp} XP. Gear storage was full for some loot.`
    : `Claimed ${gold} gold, ${exp} XP, ${acceptedGems} gem, bonus items, and ${rarity} gear.`;
}

function grantRandomRunCompletionReward(session: RunSession, user: User, completedAt: number): string {
  const aliveCount = getAliveRunRoster(session).length;
  const durationMs = session.battleReports.reduce((total, report) => total + report.durationMs, 0);
  const bossesDefeated = session.bossHistory || [];
  const routeSummary = session.nodes
    .filter(node => node.completed || (node.type === 'boss' && bossesDefeated.includes(node.label)))
    .map(node => node.type === 'boss' ? `Boss: ${node.label}` : node.label);
  const clearRatio = session.targetBattles > 0 ? clamp(session.wins / session.targetBattles, 0, 1) : 0;
  const expectedBosses = getRandomRunBossBattleNumbers(session.targetBattles).length;
  const fullClear = session.wins >= session.targetBattles;
  const score = Math.round(
    session.wins * 120
    + aliveCount * 35
    + session.runGold * 0.6
    + bossesDefeated.length * 260
    + (fullClear ? 500 : 0)
  );
  const runExpMultiplier = session.dailyChallenge?.rewardExpMultiplier || 1;
  const runExp = Math.max(35, Math.round((
    30
    + session.wins * 12
    + bossesDefeated.length * 45
    + aliveCount * 5
    + (fullClear ? 120 + expectedBosses * 15 : Math.round(clearRatio * 40))
    + getRandomRunEffectiveLevel(session.stats.level || 1) * 5
  ) * runExpMultiplier));
  const previousRunState = getDailyRunState(user);
  const runTemplates = session.minions
    .map(unit => getMinionTemplate(unit.stack.templateId))
    .filter((template): template is MinionTemplate => Boolean(template));
  const unitTemplateIds = Array.from(new Set(session.minions.map(unit => unit.stack.templateId).filter(Boolean)));
  const unitClassIds = Array.from(new Set(runTemplates.map(template => template.class)));
  const tierThreeUnitNames = Array.from(new Set(
    runTemplates
      .filter(template => template.tier === 'tier3')
      .map(template => template.name)
  ));
  const dailyRun = recordDailyRunCompletionState(user, {
      completedAt,
      wins: session.wins,
      targetBattles: session.targetBattles,
    unitsStanding: aliveCount,
    gold: session.runGold,
    exp: runExp,
    rareGems: undefined,
    itemNames: [],
    equipmentNames: [],
    challengeName: session.title,
    weeklyRewardName: 'Run',
    score,
    durationMs,
    bossesDefeated,
    routeSummary,
    shopBuys: session.shopBuyHistory || [],
    omens: session.omenHistory || [],
    unlockedSpellNames: session.permanentSpellUnlocks || [],
    unitTemplateIds,
    unitClassIds,
    tierThreeUnitNames,
  });
  const levelUps = Math.max(0, dailyRun.runLevel - previousRunState.runLevel);
  const activity: ActivityEntry = {
    id: `activity-random-run-${session.id}-${completedAt}`,
    type: 'quest',
    title: `${session.title} Cleared`,
    source: 'Run',
    completedAt,
    rewards: { exp: runExp },
    description: `${session.wins}/${session.targetBattles} fights cleared, ${bossesDefeated.length} bosses defeated, score ${score}. Random-run progression only.`,
  };

  updateCurrentUser({
    dailyRun,
    activityLog: [activity, ...(user.activityLog || [])].slice(0, 30),
  });

  const previouslyUnlockedMilestoneIds = new Set(
    getRunMilestoneViews(previousRunState)
      .filter(milestone => milestone.unlocked)
      .map(milestone => milestone.id)
  );
  const newlyUnlockedMilestones = getRunMilestoneViews(dailyRun)
    .filter(milestone => milestone.unlocked && !previouslyUnlockedMilestoneIds.has(milestone.id));

  if (typeof window !== 'undefined' && newlyUnlockedMilestones.length > 0) {
    const previewMilestones = newlyUnlockedMilestones.slice(0, 3);
    const claimableExp = newlyUnlockedMilestones.reduce(
      (total, milestone) => total + getRunMilestoneRewardExp(milestone.id),
      0
    );

    window.setTimeout(() => {
      emitCompletionNotice({
        id: `run-milestones-${session.id}-${completedAt}`,
        kind: 'run',
        kicker: 'Achievement Unlocked',
        title: newlyUnlockedMilestones.length === 1
          ? previewMilestones[0].title
          : `${newlyUnlockedMilestones.length} Milestones Unlocked`,
        description: newlyUnlockedMilestones.length === 1
          ? previewMilestones[0].description
          : previewMilestones.map(milestone => milestone.title).join(', '),
        artworkPath: previewMilestones[0].iconPath,
        artworkStyle: 'item',
        rewards: [
          { label: 'Claim XP', value: `+${claimableExp}`, tone: 'blue' },
          { label: 'Milestones', value: String(newlyUnlockedMilestones.length), tone: 'violet' },
        ],
        completedAt,
        skipBurst: true,
      });
    }, 250);
  }

  return levelUps > 0
    ? `Random run cleared: ${score} score, +${runExp} run XP, ${levelUps} new run upgrade${levelUps === 1 ? '' : 's'}.`
    : `Random run cleared: ${score} score and +${runExp} run XP.`;
}

function grantEncounterCompletionReward(session: RunSession, user: User, completedAt: number): string {
  const enemy = session.encounterEnemy;
  if (!enemy) return 'No enemy reward was found.';

  const lootMultiplier = enemy.lootMultiplier || 1;
  const runGoldConversion = Math.floor(session.runGold * 0.5);
  const gold = Math.round(((enemy.spawnKind === 'nearby' ? 48 : 36) + enemy.level * 7 + session.wins * 18 + runGoldConversion) * lootMultiplier);
  const exp = Math.round(((enemy.spawnKind === 'nearby' ? 12 : 8) + enemy.level * 2.2 + session.wins * 4) * lootMultiplier);
  const rareGems = enemy.spawnKind === 'world-boss'
    ? Math.max(2, Math.floor(enemy.level / 5))
    : enemy.level >= 3
      ? 1
      : 0;
  const rarity: EquipmentRarity | undefined = enemy.spawnKind === 'world-boss'
    ? enemy.level >= 14 ? 'legendary' : 'epic'
    : enemy.level >= 10
      ? 'rare'
      : enemy.level >= 4
        ? 'decent'
        : undefined;
  const equipment = rarity ? [generateEquipment(0, rarity)].filter(Boolean) as Equipment[] : [];
  const rewardItems: InventoryItem[] = [
    ...(rareGems > 0 ? [makeInventoryItem('rare-gem', rareGems)] : []),
    ...rollInventoryBonusDrops(enemy.level, enemy.spawnKind === 'nearby' ? 'nearbyBattle' : 'battle'),
  ];
  const slots = user.inventorySlots || 20;
  const itemResult = addInventoryItemsWithLimit(user.inventory || [], rewardItems, slots);
  const gearResult = addEquipmentWithLimit(
    user.equipment || [],
    user.equippedSlots || {},
    equipment,
    slots,
  );
  const acceptedGems = itemResult.acceptedItems
    .filter(item => item.id === 'rare-gem')
    .reduce((total, item) => total + item.quantity, 0);
  const rewardSummary = [
    `${gold} gold`,
    `${exp} XP`,
    acceptedGems > 0 ? `${acceptedGems} gem${acceptedGems === 1 ? '' : 's'}` : '',
    ...itemResult.acceptedItems
      .filter(item => item.id !== 'rare-gem')
      .map(item => item.quantity > 1 ? `${item.quantity} ${item.name}` : item.name),
    ...gearResult.acceptedEquipment.map(item => item.name),
  ].filter(Boolean);
  const clearedNodes = session.nodes
    .filter(node => node.completed)
    .map(node => node.label);
  const activity: ActivityEntry = {
    id: `activity-encounter-run-${enemy.id}-${completedAt}`,
    type: 'battle',
    title: gearResult.rejectedEquipment.length > 0 ? `Defeated ${enemy.name} (gear storage full)` : `Defeated ${enemy.name}`,
    source: enemy.spawnKind === 'world-boss' ? 'World Boss Road' : 'Enemy Road',
    completedAt,
    rewards: {
      gold,
      exp,
      rareGems: acceptedGems || undefined,
      items: itemResult.acceptedItems.length > 0 ? itemResult.acceptedItems : undefined,
      equipment: gearResult.acceptedEquipment.length > 0 ? gearResult.acceptedEquipment : undefined,
    },
    description: `${session.wins} fights won before defeating ${enemy.name}${enemy.bossId ? ` (${enemy.bossId})` : ''}. Route: ${clearedNodes.join(' -> ')}. Rewards: ${rewardSummary.join(', ')}.`,
  };

  markWorldEnemyDefeated(enemy, completedAt);
  updateCurrentUser({
    gold: user.gold + gold,
    exp: user.exp + exp,
    inventory: itemResult.inventory,
    equipment: gearResult.equipment,
    activityLog: [activity, ...(user.activityLog || [])].slice(0, 30),
  });
  levelUp();

  return gearResult.rejectedEquipment.length > 0
    ? `Claimed ${gold} gold and ${exp} XP from ${enemy.name}. Gear storage was full for some loot.`
    : `Claimed ${gold} gold, ${exp} XP${acceptedGems > 0 ? `, ${acceptedGems} gem${acceptedGems === 1 ? '' : 's'}` : ''}${rarity ? `, and ${rarity} gear` : ''} from ${enemy.name}.`;
}

function makeStatBuff(
  id: string,
  name: string,
  description: string,
  bonus: Partial<Pick<CharacterStats, 'armyPower' | 'defensivePower' | 'morale' | 'spellPower' | 'maxHealth' | 'health'>>,
  category?: string,
): RunRewardChoice {
  return {
    id,
    name,
    description,
    category,
    apply: session => ({
      ...session,
      stats: {
        ...session.stats,
        armyPower: session.stats.armyPower + (bonus.armyPower || 0),
        defensivePower: session.stats.defensivePower + (bonus.defensivePower || 0),
        morale: session.stats.morale + (bonus.morale || 0),
        spellPower: session.stats.spellPower + (bonus.spellPower || 0),
        maxHealth: session.stats.maxHealth + (bonus.maxHealth || 0),
        health: Math.min(
          session.stats.maxHealth + (bonus.maxHealth || 0),
          session.stats.health + (bonus.health || 0)
        ),
      },
      notice: `${name} claimed.`,
    }),
  };
}

function mergeRunUnitStatBonus(current: RunUnitStatBonus | undefined, bonus: RunUnitStatBonus): RunUnitStatBonus {
  return {
    ...(current || {}),
    attack: (current?.attack || 0) + (bonus.attack || 0),
    defense: (current?.defense || 0) + (bonus.defense || 0),
    magic: (current?.magic || 0) + (bonus.magic || 0),
    healing: (current?.healing || 0) + (bonus.healing || 0),
    health: (current?.health || 0) + (bonus.health || 0),
    movement: (current?.movement || 0) + (bonus.movement || 0),
    range: (current?.range || 0) + (bonus.range || 0),
  };
}

function grantRunUnitStatBonus(
  session: RunSession,
  predicate: (unit: RunUnit, template: MinionTemplate) => boolean,
  bonus: RunUnitStatBonus,
  label: string,
  notice: string,
): RunSession {
  let affected = 0;

  const minions = session.minions.map(unit => {
    const template = getMinionTemplate(unit.stack.templateId);
    if (!unit.alive || !template || !predicate(unit, template)) return unit;

    affected += 1;
    const healthBonus = Math.max(0, bonus.health || 0);
    const currentHealth = getRunUnitCurrentHealthForSession(session, unit);

    return {
      ...unit,
      stack: {
        ...unit.stack,
        runStatBonus: mergeRunUnitStatBonus(unit.stack.runStatBonus, bonus),
        runBonusLabel: unit.stack.runBonusLabel
          ? `${unit.stack.runBonusLabel} + ${label}`
          : label,
        runCurrentHealth: healthBonus > 0 ? currentHealth + healthBonus : unit.stack.runCurrentHealth,
      },
    };
  });

  return {
    ...session,
    minions,
    notice: affected > 0 ? notice : 'The omen found no matching unit and faded.',
  };
}

function grantRunUnitClassBonus(
  session: RunSession,
  classId: MinionClass,
  bonus: RunUnitStatBonus,
  label: string,
  notice: string,
): RunSession {
  return grantRunUnitStatBonus(session, (_unit, template) => template.class === classId, bonus, label, notice);
}

function grantRangedRunUnitBonus(session: RunSession, bonus: RunUnitStatBonus, label: string, notice: string): RunSession {
  return grantRunUnitStatBonus(session, (_unit, template) => template.stats.range > 1, bonus, label, notice);
}

function hasFallenMinions(session: RunSession): boolean {
  return session.minions.some(unit => !unit.alive);
}

function emitRunCelebrations(celebrations: RunCelebration[]): void {
  const username = getCurrentUser()?.username || null;
  celebrations.forEach((celebration) => {
    const showTutorialTip = celebration.tutorialTip
      ? shouldShowSingleplayerRunRewardTip(username, celebration.tutorialTip)
      : false;
    const tutorialCopy = celebration.tutorialTip === 'gear'
      ? 'Run gear is temporary. Equip it from the formation satchel; it disappears when this road ends.'
      : celebration.tutorialTip === 'unit-upgrade'
        ? 'Promotions replace that fighter with its next tier for this run, including its stronger combat stats.'
        : '';

    emitCompletionNotice({
      id: celebration.id,
      kind: celebration.kind === 'unit' ? 'recruit' : celebration.kind === 'gear' ? 'gear' : 'run',
      kicker: celebration.kicker,
      title: celebration.title,
      description: showTutorialTip ? `${celebration.description} ${tutorialCopy}` : celebration.description,
      artworkPath: celebration.artworkPath,
      artworkStyle: celebration.artworkStyle,
      rewards: celebration.rewards,
      completedAt: Date.now(),
      skipBurst: true,
    });
    if (showTutorialTip && celebration.tutorialTip) {
      markSingleplayerRunRewardTipSeen(username, celebration.tutorialTip);
    }
  });
}

function queueRunRewardCelebrations(before: RunSession, after: RunSession, source: Pick<RunRewardChoice, 'id' | 'name'>): RunSession {
  const pending = [...(after.pendingRunCelebrations || before.pendingRunCelebrations || [])];
  const beforeEquipmentIds = new Set((before.runEquipment || []).map(item => item.id));
  const beforeUnitIds = new Set(before.minions.map(unit => unit.stack.id));
  const beforeUnitsById = new Map(before.minions.map(unit => [unit.stack.id, unit]));
  const newEquipment = (after.runEquipment || []).filter(item => !beforeEquipmentIds.has(item.id));
  const newUnits = after.minions.filter(unit => !beforeUnitIds.has(unit.stack.id));
  const createdAt = Date.now();
  const gearCelebrations: RunCelebration[] = newEquipment.map((item, index) => {
    const statRewards = getRunEquipmentStatRows(item)
      .slice(0, 3)
      .map(row => ({
        label: row.label,
        value: `+${row.value}`,
        tone: 'green' as const,
      }));

    return {
      id: `run-gear-${source.id}-${item.id}-${createdAt}-${index}`,
      kind: 'gear',
      kicker: 'Run Satchel',
      title: item.name,
      description: `${formatEquipmentRarityLabel(item.rarity)} ${RUN_EQUIPMENT_SLOT_LABELS[item.slot]} claimed from ${source.name}. ${formatRunEquipmentSummary(item)}`,
      artworkPath: getRunEquipmentIconPath(item),
      artworkStyle: 'item',
      rewards: statRewards.length > 0
        ? statRewards
        : [{ label: 'Gear', value: formatRunEquipmentSummary(item), tone: 'green' as const }],
      tutorialTip: before.mode === 'daily' ? 'gear' : undefined,
    };
  });
  const unitCelebrations: RunCelebration[] = newUnits
    .map((unit, index): RunCelebration | null => {
      const template = getMinionTemplate(unit.stack.templateId);
      if (!template) return null;

      return {
        id: `run-unit-${source.id}-${unit.stack.id}-${createdAt}-${index}`,
        kind: 'unit',
        kicker: 'Joined the Team',
        title: template.name,
        description: `${MINION_TIER_LABELS[template.tier]} ${MINION_CLASS_LABELS[template.class]} joined the run warband.`,
        artworkPath: `${MINION_ICON_BASE}/${template.assetName}`,
        artworkStyle: 'plain',
        rewards: [
          { label: 'Attack', value: String(template.stats.attack), tone: 'green' as const },
          { label: 'Ward', value: String(template.stats.defense), tone: 'blue' as const },
          { label: 'Health', value: String(template.stats.health), tone: 'green' as const },
        ],
      };
    })
    .filter((item): item is RunCelebration => Boolean(item));
  const upgradeCelebrations: RunCelebration[] = after.minions
    .map((unit, index): RunCelebration | null => {
      const previousUnit = beforeUnitsById.get(unit.stack.id);
      if (!previousUnit || previousUnit.stack.templateId === unit.stack.templateId) return null;
      const previousTemplate = getMinionTemplate(previousUnit.stack.templateId);
      const template = getMinionTemplate(unit.stack.templateId);
      if (!previousTemplate || !template) return null;

      return {
        id: `run-upgrade-${source.id}-${unit.stack.id}-${createdAt}-${index}`,
        kind: 'unit',
        kicker: 'Unit Promoted',
        title: template.name,
        description: `${previousTemplate.name} advanced from ${MINION_TIER_LABELS[previousTemplate.tier]} to ${MINION_TIER_LABELS[template.tier]}.`,
        artworkPath: `${MINION_ICON_BASE}/${template.assetName}`,
        artworkStyle: 'plain',
        rewards: [
          { label: 'Attack', value: String(template.stats.attack), tone: 'green' as const },
          { label: 'Ward', value: String(template.stats.defense), tone: 'blue' as const },
          { label: 'Health', value: String(template.stats.health), tone: 'green' as const },
        ],
        tutorialTip: before.mode === 'daily' ? 'unit-upgrade' : undefined,
      };
    })
    .filter((item): item is RunCelebration => Boolean(item));
  const celebrations = [...gearCelebrations, ...unitCelebrations, ...upgradeCelebrations];

  if (celebrations.length === 0) return after;

  return {
    ...after,
    pendingRunCelebrations: [...pending, ...celebrations],
  };
}

function getRunUnitMaxHealthForSession(session: RunSession, unit: RunUnit): number {
  const template = getMinionTemplate(unit.stack.templateId);
  if (!template) return 1;

  return Math.max(
    1,
    template.stats.health
      + (unit.stack.runStatBonus?.health || 0)
      + Math.floor(session.stats.defensivePower * 0.9)
      + Math.floor(session.stats.morale / 2)
  );
}

function getRunUnitCurrentHealthForSession(session: RunSession, unit: RunUnit): number {
  const maxHealth = getRunUnitMaxHealthForSession(session, unit);
  if (typeof unit.stack.runCurrentHealth === 'number') {
    return clamp(Math.round(unit.stack.runCurrentHealth), 0, maxHealth);
  }
  return maxHealth;
}

function hasWoundedRunMinions(session: RunSession): boolean {
  return session.minions.some(unit => (
    unit.alive
    && getRunUnitCurrentHealthForSession(session, unit) < getRunUnitMaxHealthForSession(session, unit)
  ));
}

function healLivingRunMinions(session: RunSession, amount: number, notice: string): RunSession {
  return {
    ...session,
    minions: session.minions.map(unit => {
      if (!unit.alive) return unit;
      const maxHealth = getRunUnitMaxHealthForSession(session, unit);
      const currentHealth = getRunUnitCurrentHealthForSession(session, unit);
      return {
        ...unit,
        stack: {
          ...unit.stack,
          runCurrentHealth: Math.min(maxHealth, currentHealth + amount),
        },
      };
    }),
    notice,
  };
}

function canAddRunMinion(session: RunSession): boolean {
  return session.minions.length < RUN_MAX_ROSTER || hasFallenMinions(session);
}

function hasUpgradeableMinion(session: RunSession): boolean {
  return session.minions.some(unit => unit.alive && Boolean(getNextTierTemplate(unit.stack.templateId)));
}

function resurrectMinions(session: RunSession, count: number): RunSession {
  let remaining = count;

  return {
    ...session,
    minions: session.minions.map(unit => {
      if (unit.alive || remaining <= 0) return unit;
      remaining -= 1;
      return { ...unit, alive: true, stack: { ...unit.stack, runCurrentHealth: undefined } };
    }),
    notice: count > 1 ? 'Fallen minions return to the run.' : 'One fallen minion returns to the run.',
  };
}

function resurrectAllMinions(session: RunSession): RunSession {
  return {
    ...session,
    minions: session.minions.map(unit => ({ ...unit, alive: true, stack: { ...unit.stack, runCurrentHealth: undefined } })),
    notice: 'All fallen minions return to the run.',
  };
}

function addRandomRunMinion(session: RunSession, tier: MinionTemplate['tier'], notice?: string): RunSession {
  const template = pickPlayerRunTemplate(tier);
  const replacementIndex = session.minions.findIndex(unit => !unit.alive);
  const newUnit: RunUnit = {
    stack: applyRunCommanderUnitBonusForSession(
      session,
      cloneRunStack(template.templateId, `loaned-reward-${session.id}-${Date.now()}`)
    ),
    alive: true,
    origin: 'reward',
  };

  if (replacementIndex >= 0) {
    return {
      ...session,
      minions: session.minions.map((unit, index) => index === replacementIndex ? newUnit : unit),
      notice: notice || `${template.name} replaces a fallen slot for this run.`,
    };
  }

  if (session.minions.length >= RUN_MAX_ROSTER) return session;

  return {
    ...session,
    minions: [...session.minions, newUnit],
    notice: notice || `${template.name} joins the run.`,
  };
}

function addGuaranteedRandomRunMinion(session: RunSession, tier: MinionTemplate['tier'], notice?: string): RunSession {
  const normalResult = addRandomRunMinion(session, tier, notice);
  if (normalResult.minions !== session.minions) return normalResult;

  const template = pickPlayerRunTemplate(tier);
  const replacementIndex = session.minions.findIndex(unit => getMinionTemplate(unit.stack.templateId)?.tier !== tier);
  const safeReplacementIndex = replacementIndex >= 0 ? replacementIndex : Math.max(0, session.minions.length - 1);
  const newUnit: RunUnit = {
    stack: applyRunCommanderUnitBonusForSession(
      session,
      cloneRunStack(template.templateId, `loaned-guaranteed-${session.id}-${Date.now()}`)
    ),
    alive: true,
    origin: 'reward',
  };

  return {
    ...session,
    minions: session.minions.map((unit, index) => index === safeReplacementIndex ? newUnit : unit),
    notice: notice || `${template.name} joins the run.`,
  };
}

function pickStandaloneTier2RunTemplate(): MinionTemplate | undefined {
  return shuffle(MINION_TEMPLATES.filter(item => (
    item.tier === 'tier2' &&
    isStandaloneTier2MinionTemplate(item.templateId) &&
    isPlayerRunEligibleTemplate(item)
  )))[0];
}

function pickStandaloneTier1RunTemplate(): MinionTemplate | undefined {
  return shuffle(MINION_TEMPLATES.filter(item => (
    item.tier === 'tier1' &&
    isStandaloneTier1MinionTemplate(item.templateId) &&
    isPlayerRunEligibleTemplate(item)
  )))[0];
}

function pickStandaloneTier3RunTemplate(): MinionTemplate | undefined {
  return shuffle(MINION_TEMPLATES.filter(item => (
    item.tier === 'tier3' &&
    isStandaloneMinionTemplate(item.templateId) &&
    isPlayerRunEligibleTemplate(item)
  )))[0];
}

function upgradeRandomMinion(session: RunSession): RunSession {
  const candidates = session.minions
    .map((unit, index) => ({ unit, index, nextTemplate: unit.alive ? getNextTierTemplate(unit.stack.templateId) : undefined }))
    .filter(item => item.nextTemplate);
  const chosen = shuffle(candidates)[0];

  if (!chosen?.nextTemplate) return session;

  return {
    ...session,
    minions: session.minions.map((unit, index) => (
      index === chosen.index
        ? {
          ...unit,
          stack: applyRunCommanderUnitBonusForSession(session, {
            ...unit.stack,
            templateId: chosen.nextTemplate?.templateId || unit.stack.templateId,
            runCurrentHealth: undefined,
          }),
        }
        : unit
    )),
    notice: `${chosen.nextTemplate.name} joins the front line.`,
  };
}

function getNextTierTemplate(templateId: string): MinionTemplate | undefined {
  if (isStandaloneMinionTemplate(templateId)) return undefined;

  const template = getMinionTemplate(templateId);
  if (!template || template.tier === 'tier3') return undefined;

  const nextTier = template.tier === 'tier1' ? 'tier2' : 'tier3';
  return MINION_TEMPLATES.find(item => item.class === template.class && item.tier === nextTier);
}

function woundSpecificMinion(session: RunSession, index: number): RunSession {
  const target = session.minions[index];
  if (!target?.alive) return session;

  return {
    ...session,
    minions: session.minions.map((unit, unitIndex) => (
      unitIndex === index
        ? { ...unit, alive: false, stack: { ...unit.stack, runCurrentHealth: 0 } }
        : unit
    )),
  };
}

function addRunMinionFromTemplate(session: RunSession, template: MinionTemplate, notice: string): RunSession {
  const replacementIndex = session.minions.findIndex(unit => !unit.alive);
  const newUnit: RunUnit = {
    stack: applyRunCommanderUnitBonusForSession(
      session,
      cloneRunStack(template.templateId, `loaned-reward-${session.id}-${Date.now()}`)
    ),
    alive: true,
    origin: 'reward',
  };

  if (replacementIndex >= 0) {
    return {
      ...session,
      minions: session.minions.map((unit, index) => index === replacementIndex ? newUnit : unit),
      notice,
    };
  }

  if (session.minions.length >= RUN_MAX_ROSTER) return { ...session, notice };

  return {
    ...session,
    minions: [...session.minions, newUnit],
    notice,
  };
}

function getRunRosterLimit(session: RunSession): number {
  return session.mode === 'daily'
    ? RUN_MAX_ROSTER
    : Math.max(RUN_MAX_ROSTER, session.minions.length);
}

function getAliveRunRoster(session: RunSession): MinionStack[] {
  return session.minions.filter(unit => unit.alive).map(unit => unit.stack).slice(0, getRunRosterLimit(session));
}

function getRunPlacedStacks(session: RunSession, formation: Record<string, BoardCell> = session.formation): MinionStack[] {
  return getAliveRunRoster(session).filter(stack => isFormationCellAllowed(formation[stack.id]));
}

function getRunFieldedStacks(session: RunSession, formation: Record<string, BoardCell> = session.formation): MinionStack[] {
  return getRunPlacedStacks(session, formation).slice(0, MAX_FIELD_MINIONS);
}

function getRunFormationIssue(session: RunSession, formation: Record<string, BoardCell> = session.formation): string | null {
  const placedStacks = getRunPlacedStacks(session, formation);

  if (placedStacks.length > MAX_FIELD_MINIONS) {
    return `Field only ${MAX_FIELD_MINIONS} units. Keep extras on the bench.`;
  }

  return getFormationIssue(formation, placedStacks);
}

function cloneRunStack(templateId: string, prefix: string, fielded = true): MinionStack {
  return {
    id: `${prefix}-${templateId}-${Math.random().toString(16).slice(2)}`,
    templateId,
    quantity: 1,
    acquiredAt: Date.now(),
    fielded,
  };
}

function shuffle<T>(items: T[]): T[] {
  return [...items].sort(() => Math.random() - 0.5);
}

function clamp(value: number, min: number, max: number): number {
  return Math.max(min, Math.min(max, value));
}
