// Simple authentication system using localStorage
import {
  CITY_QUESTS,
  QUEST_NPCS,
  STORY_CHAPTERS,
  getCityQuestTemplate,
  getAllStoryQuestsSorted,
  getQuestNpcById,
  getRotatingCityQuests,
  type CityQuestTemplate,
  type QuestRequirementSpec,
  type QuestRewardSpec,
  type StoryQuestTemplate,
} from './questData';
import {
  getStoryDialogSequence,
  type StoryResponseTone,
} from './storyDialogue';
import {
  TRAVEL_EVENT_CONTENT_COUNTS,
  rollTravelEvents,
  type TravelEventTemplate,
} from './travelEvents';
import { readGameJson, removeGameStorageItem, writeGameJson } from './gameStore';
import { isSupabaseAuthEnabled, logoutSupabase, persistCurrentUserToSupabase } from './supabase/auth';
import { getCachedWorldPlayers, worldMapPlayerToUser } from './worldPlayers';
import { isSupabaseConfigured } from './supabase/config';
import { getStaticPOIs, MAP_CONFIG, POIType } from './mapData';
import { BOSS_PROFILES, type BossProfile } from './bosses';
import { sumGearSetBonusStats } from './gearSets';
import { generateLootEquipment } from './lootTables';
import {
  capEquipmentRarityForLevel,
  getEquipmentRarityMinLevel,
  getHighestJobEquipmentRarity,
  getJobEquipmentDropChance,
  rollJobEquipmentRarity,
} from './gearProgression';
import { canAcquireMinionTier, getMinionTierMinLevel } from './minionProgression';
import { normalizeMpDailyDungeonState, type MpDailyDungeonState } from './mpDailyDungeon';
import {
  applyPvpRatingLoss,
  applyPvpRatingWin,
  calculatePvpRatingDelta,
  createDefaultPvpRatingState,
  normalizePvpRatingState,
  type PvpRatingState,
} from './pvpRating';
import { requireMultiplayerUnlock } from './multiplayerUnlocks';
import {
  capCampaignRewardExp,
  scaleMultiplayerRewards,
  type MultiplayerRewardSource,
} from './multiplayerRewards';
import { syncRunMilestoneUnlockRecords } from './runMilestones';
import {
  normalizeRunDiscoveryState,
  syncRunDiscoveryState,
  type RunDiscoveryState,
} from './runDiscovery';
import {
  TOWN_RECRUITMENT_TOWNS,
  getTownRecruitmentSlots,
  normalizeTownRecruitmentClaims,
  type TownRecruitmentClaim,
  type TownRecruitmentTown,
} from './townRecruitment';
import {
  createSocialRequest,
  getIncomingSocialRequests as getIncomingSocialRequestRecords,
  normalizeSocialRequests,
  respondToSocialRequest,
  type SocialRequestRecord,
  type SocialRequestStatus,
} from './socialRequests';
import {
  TRADE_REQUEST_TTL_MS,
  activateTradeSession as activateTradeSessionState,
  confirmTradeSession as confirmTradeSessionState,
  createTradeSession,
  getCurrentTradeSession as getCurrentTradeSessionState,
  getTradeOffer,
  getTradeSessionSide,
  normalizeTradeSessions,
  setTradeSessionLock as setTradeSessionLockState,
  setTradeSessionStatus,
  updateTradeSessionOffer as updateTradeSessionOfferState,
  type TradeOffer,
  type TradeSession,
} from './tradeSessions';
import {
  createOnlineTradeSession,
  shouldUseOnlineTradeClient,
  updateOnlineTradeSession,
  type TradeParticipantStatePayload,
} from './tradeSessionClient';
import {
  claimMultiplayerDailyContract as claimMultiplayerDailyContractState,
  claimMultiplayerFirstCompletionBonus as claimMultiplayerFirstCompletionBonusState,
  claimMultiplayerRegionalThreat as claimMultiplayerRegionalThreatState,
  claimMultiplayerWeeklyOath as claimMultiplayerWeeklyOathState,
  consumeMultiplayerRestedJobBonus,
  dismissMultiplayerReturningBriefing as dismissMultiplayerReturningBriefingState,
  getMultiplayerDailyContracts,
  getMultiplayerEngagementClaimableCount,
  getMultiplayerFirstCompletionBonuses,
  getMultiplayerReturnTrack,
  getMultiplayerRegionalThreat,
  getMultiplayerWeeklyOath,
  normalizeMultiplayerEngagementState,
  recordMultiplayerEngagementEvent,
  rerollMultiplayerDailyContract as rerollMultiplayerDailyContractState,
  touchMultiplayerEngagement as touchMultiplayerEngagementState,
  type MultiplayerContractView,
  type MultiplayerEngagementEventInput,
  type MultiplayerEngagementEventInputKind,
  type MultiplayerEngagementState,
  type MultiplayerFirstCompletionBonusId,
  type MultiplayerFirstCompletionBonusView,
  type MultiplayerReturnTrackView,
  type MultiplayerWeeklyOathView,
} from './multiplayerEngagement';
import type { RegionalThreatView } from './multiplayerRegionalThreat';
import {
  claimMultiplayerChronicleRank as claimMultiplayerChronicleRankState,
  getMultiplayerChronicleView as getMultiplayerChronicleViewState,
  syncMultiplayerChronicleEvents,
  type MultiplayerChronicleState,
  type MultiplayerChronicleView,
} from './multiplayerChronicle';

export { CITY_QUESTS, QUEST_NPCS, STORY_CHAPTERS, getAllStoryQuestsSorted, getCityQuestTemplate, getRotatingCityQuests };
export { TRAVEL_EVENT_CONTENT_COUNTS };

export type EquipmentSlot = 'sword' | 'shield' | 'armor' | 'armor-pants' | 'boots' | 'gloves' | 'helmet';
export type EquipmentRarity = 'decent' | 'rare' | 'epic' | 'legendary';
export type EquipmentSocketStat = 'armyPower' | 'defensivePower' | 'morale' | 'spellPower' | 'maxHealth';
export type MinionClass = 'wizard' | 'knight' | 'templar' | 'priest';
export type MinionTier = 'tier1' | 'tier2' | 'tier3';
export type ActivityEntryType = 'job' | 'quest' | 'battle' | 'shop' | 'upgrade' | 'travel' | 'item';
export type AllocatableStat = 'armyPower' | 'defensivePower' | 'morale' | 'spellPower' | 'health';
export const MAX_FIELD_MINIONS = 7;
export const BASE_INVENTORY_SLOTS = 20;
export const MAX_PLAYER_LEVEL = 30;
export const MAX_PARTY_SIZE = 4;
export const MINION_INJURY_DURATION_MS = 2 * 60 * 60 * 1000;
export const MINION_SAFE_INJURIES = 2;
export const DEFAULT_EQUIPPED_SPELL_IDS = ['arcane-bolt', 'sanctified-mend', 'ember-dart', 'warding-prayer'];
export const ALL_BATTLE_SPELL_IDS = [
  'arcane-bolt',
  'sanctified-mend',
  'thorn-ward',
  'withering-curse',
  'rallying-hymn',
  'chain-spark',
  'gravity-snare',
  'ember-dart',
  'warding-prayer',
  'ashen-step',
  'judgement',
  'royal-command',
  'moonlit-veil',
  'blood-star',
  'iron-benediction',
  'soul-tether',
  'frost-lance',
  'eclipse-nova',
  'saint-king-aegis',
  'time-crown-edict',
];
export const DEFAULT_KNOWN_SPELL_IDS = [...DEFAULT_EQUIPPED_SPELL_IDS];
const COMMON_SPELL_REWARD_IDS = [
  'thorn-ward',
  'withering-curse',
  'rallying-hymn',
  'chain-spark',
  'gravity-snare',
  'ashen-step',
];
const RARE_SPELL_REWARD_IDS = [
  'judgement',
  'royal-command',
  'moonlit-veil',
  'blood-star',
  'iron-benediction',
  'soul-tether',
  'frost-lance',
];
const LEGENDARY_SPELL_REWARD_IDS = [
  'eclipse-nova',
  'saint-king-aegis',
  'time-crown-edict',
];

export interface EquipmentSocketBonus {
  id: string;
  stat: EquipmentSocketStat;
  baseValue: number;
  upgradeLevel: number;
}

export interface Equipment {
  id: string;
  name: string;
  slot: EquipmentSlot;
  rarity: EquipmentRarity;
  stats: {
    armyPower?: number;
    defensivePower?: number;
    morale?: number;
    spellPower?: number;
    maxHealth?: number;
    attack?: number;
    defense?: number;
    speed?: number;
  };
  socketBonuses?: EquipmentSocketBonus[];
  passive?: string; // Legendary equipment passive effect description
  gearSetId?: string;
  lootSource?: string;
}

export interface MinionStats {
  attack: number;
  defense: number;
  magic: number;
  healing: number;
  health: number;
  movement: number;
  range: number;
}

export interface MinionTemplate {
  templateId: string;
  class: MinionClass;
  tier: MinionTier;
  name: string;
  role: string;
  assetName: string;
  stats: MinionStats;
}

export interface MinionStack {
  id: string;
  templateId: string;
  quantity: number;
  acquiredAt: number;
  fielded?: boolean;
  rosterOrder?: number;
  injuredUntil?: number;
  injuryCount?: number;
  lastInjuredAt?: number;
  runCurrentHealth?: number;
  runStatBonus?: Partial<Pick<MinionStats, 'attack' | 'defense' | 'magic' | 'healing' | 'health' | 'movement' | 'range'>>;
  runBonusLabel?: string;
}

export interface MinionCasualtyReport {
  injuredNames: string[];
  deadNames: string[];
}

export interface RewardSummary {
  gold?: number;
  goldLoss?: number;
  exp?: number;
  items?: InventoryItem[];
  equipment?: Equipment[];
  minions?: MinionStack[];
  rareGems?: number;
  healthRestore?: number;
  healthLoss?: number;
  spellIds?: string[];
}

export interface ActivityEntry {
  id: string;
  type: ActivityEntryType;
  title: string;
  source: string;
  completedAt: number;
  rewards: RewardSummary;
  description?: string;
  battleLevel?: number;
  jobDurationMs?: number;
  dungeonLevel?: number;
  questNpcId?: string;
}

export interface DailyQuest {
  id: string;
  name: string;
  description: string;
  requirement: {
    type: 'complete_jobs' | 'complete_timed_jobs' | 'collect_daily_gift';
    count: number;
    minDuration?: number; // in milliseconds
  };
  progress: number;
  claimed: boolean;
  claimedAt?: number;
  rewards: {
    guaranteedItem: EquipmentRarity;
    bonusItem?: {
      rarity: EquipmentRarity;
      chance: number;
    };
    legendaryChance: number; // 0.01 for 1%
    randomSupply?: boolean;
    guaranteedMinionTier?: MinionTier;
    minionChance?: {
      tier: MinionTier;
      chance: number;
      quantity?: number;
    };
  };
}

export interface DailyQuestState {
  lastResetDate: string; // YYYY-MM-DD format
  lastResetAt: number;
  quests: DailyQuest[];
}

export interface CityQuestProgress {
  questId: string;
  progress: number;
  acceptedAt: number;
  claimed: boolean;
  completedAt?: number;
}

export interface DailyRunHistoryEntry {
  id: string;
  date: string;
  completedAt: number;
  wins: number;
  targetBattles: number;
  unitsStanding: number;
  gold: number;
  exp: number;
  rareGems?: number;
  itemNames?: string[];
  equipmentNames?: string[];
  challengeName?: string;
  weeklyRewardName?: string;
  score?: number;
  durationMs?: number;
  bossesDefeated?: string[];
  flawlessBossNames?: string[];
  fastBossNames?: string[];
  routeSummary?: string[];
  shopBuys?: string[];
  shopGoldSpent?: number;
  omens?: string[];
  unlockedSpellNames?: string[];
  temporarySpellIds?: string[];
  unitTemplateIds?: string[];
  unitClassIds?: MinionClass[];
  tierThreeUnitNames?: string[];
  healingDone?: number;
  unitsLost?: number;
  lowestCommanderHealthRatio?: number;
  commanderUntouchedBattles?: number;
  challengeModifierIds?: string[];
  discoveryOfferIdsSeen?: string[];
  runLevelAfter?: number;
  streakAfter: number;
}

export interface RandomRunPermanentStats {
  armyPower: number;
  defensivePower: number;
  morale: number;
  spellPower: number;
  maxHealth: number;
  unitPower: number;
  unitWard: number;
}

export type RunMilestoneTier = 'bronze' | 'silver' | 'gold' | 'legendary';

export interface RunMilestoneUnlockRecord {
  id: string;
  unlockedAt: number;
  tier: RunMilestoneTier;
  title: string;
  category: string;
  iconPath: string;
}

export interface DailyRunState {
  lastCompletedDate?: string;
  streak: number;
  bestWins: number;
  completions: number;
  history: DailyRunHistoryEntry[];
  runLevel: number;
  runExp: number;
  runUpgradePoints: number;
  permanentStats: RandomRunPermanentStats;
  claimedMilestoneIds?: string[];
  milestoneUnlocks?: RunMilestoneUnlockRecord[];
  discovery?: RunDiscoveryState;
}

export interface DailyRunStatus {
  today: string;
  completedToday: boolean;
  streak: number;
  bestWins: number;
  completions: number;
  history: DailyRunHistoryEntry[];
}

export interface DailyRunLeaderboardEntry {
  username: string;
  streak: number;
  bestWins: number;
  completions: number;
  lastCompletedDate?: string;
}

export type LeaderboardCategory = 'power' | 'daily' | 'gold' | 'battles' | 'pvp';
export type LeaderboardScope = 'world' | 'run' | 'all';

export interface LeaderboardEntry {
  rank: number;
  username: string;
  category: LeaderboardCategory;
  score: number;
  label: string;
  detail: string;
  level: number;
  selectedModel: number;
}

export interface LeaderboardBoard {
  id: LeaderboardCategory;
  title: string;
  subtitle: string;
  entries: LeaderboardEntry[];
}

export interface DailyRunModifier {
  id: string;
  name: string;
  description: string;
  statBonus?: Partial<Pick<CharacterStats, 'armyPower' | 'defensivePower' | 'morale' | 'spellPower' | 'maxHealth' | 'health'>>;
  enemyLevelOffset?: number;
  rewardGoldMultiplier?: number;
  rewardExpMultiplier?: number;
  targetBattleBonus?: number;
}

export interface DailyRunChallenge {
  date: string;
  weekKey: string;
  name: string;
  subtitle: string;
  bossId: string;
  bossName: string;
  bossSubtitle: string;
  bossStory: string;
  bossIntro: string;
  bossArtworkPath: string;
  bossModelNumber: 1 | 2 | 3 | 4 | 5 | 6;
  modifiers: DailyRunModifier[];
  weeklyRewardName: string;
  weeklyRewardDescription: string;
  weeklyRewardItemId?: string;
  rewardGoldMultiplier: number;
  rewardExpMultiplier: number;
  enemyLevelOffset: number;
  targetBattles: number;
}

export type FriendRequestStatus = 'pending' | 'accepted' | 'declined';
export type SocialChatChannel = 'global' | 'party';

export interface FriendRecord {
  username: string;
  requestedBy: string;
  requestedAt: number;
  status: FriendRequestStatus;
  acceptedAt?: number;
}

export interface PartyState {
  leaderUsername: string;
  memberUsernames: string[];
  invitedUsernames: string[];
  updatedAt: number;
}

export interface SocialState {
  friends: FriendRecord[];
  party?: PartyState;
  requests?: SocialRequestRecord[];
  tradeSessions?: TradeSession[];
}

export interface SocialChatMessage {
  id: string;
  channel: SocialChatChannel;
  author: string;
  text: string;
  createdAt: number;
  partyKey?: string;
}

export interface User {
  username: string;
  password: string;
  gold: number;
  exp: number;
  x: number;
  y: number;
  inventory: InventoryItem[];
  equipment: Equipment[];
  equippedSlots: Partial<Record<EquipmentSlot, string>>; // Maps slot to equipment ID
  minions: MinionStack[];
  activityLog: ActivityEntry[];
  stats: CharacterStats;
  traveling: TravelState | null;
  jobQueue: JobState[];
  selectedModel: number; // 1-6 for playermodel selection
  inventorySlots?: number;
  inventoryUpgradeLevel?: number;
  dailyQuests?: DailyQuestState;
  cityQuests?: CityQuestProgress[];
  storyQuests?: StoryQuestProgress[];
  dailyRun?: DailyRunState;
  mpDailyDungeon?: MpDailyDungeonState;
  gearSetBonusSnapshot?: {
    armyPower: number;
    defensivePower: number;
    morale: number;
    spellPower: number;
    maxHealth: number;
  };
  knownSpellIds?: string[];
  equippedSpellIds?: string[];
  spellUnlockVersion?: number;
  social?: SocialState;
  pvpRating?: PvpRatingState;
  multiplayerEngagement?: MultiplayerEngagementState;
  multiplayerChronicle?: MultiplayerChronicleState;
  townRecruitmentClaims?: TownRecruitmentClaim[];
}

export type { PvpRatingState };

export interface JobState {
  id: string;
  poiId: string;
  poiName: string;
  jobName: string;
  startTime: number;
  duration: number;
  workDuration: number; // Duration of actual work (excluding travel)
  rewards: JobRewards;
  targetX: number; // POI location
  targetY: number;
  startX: number; // Starting position
  startY: number;
  travelComplete: boolean; // Track if travel phase is done
  travelCompleteTime: number | null; // When travel was completed
  lastMoveTime: number; // Last time position was updated
  eventSeed?: string;
  travelEventsResolved?: boolean;
}

export interface JobRewards {
  gold: number;
  exp: number;
  items?: InventoryItem[];
  equipment?: Equipment[];
  minions?: MinionStack[];
  rareGems?: number;
  healthRestore?: number;
}

export interface JobRewardPreview extends JobRewards {
  levelRequirement?: number;
  equipmentRarity?: EquipmentRarity;
  equipmentDropChance?: number;
  minionTier?: MinionTier;
  rewardNote?: string;
}

export interface CharacterStats {
  armyPower: number;
  defensivePower: number;
  morale: number;
  spellPower: number;
  health: number;
  maxHealth: number;
  level: number;
  unallocatedPoints: number;
  attack?: number;
  defense?: number;
  speed?: number;
}

export interface TravelState {
  targetX: number;
  targetY: number;
  startTime: number;
  duration: number; // in milliseconds
  startX?: number;
  startY?: number;
  eventSeed?: string;
}

export interface InventoryItem {
  id: string;
  name: string;
  quantity: number;
  icon: string;
  kind?: InventoryItemKind;
  rarity?: InventoryItemRarity;
  description?: string;
  value?: number;
  imagePath?: string;
}

export type InventoryItemKind = 'material' | 'consumable' | 'container' | 'trade' | 'quest';
export type InventoryItemRarity = 'common' | 'uncommon' | 'rare' | 'epic' | 'legendary';
export type InventoryDropContext = 'job' | 'battle' | 'nearbyBattle' | 'dungeon' | 'dailyRun' | 'dungeonRun' | 'travel';

export interface InventoryItemDefinition {
  id: string;
  name: string;
  kind: InventoryItemKind;
  rarity: InventoryItemRarity;
  description: string;
  icon: string;
  imagePath: string;
  useLabel?: string;
  sellValue?: number;
  healthRestore?: number;
  chestRarity?: EquipmentRarity;
  spellRewardCount?: number;
}

export interface StoryQuestProgress {
  questId: string;
  claimed: boolean;
  completedAt?: number;
  introSeen?: boolean;
  responseChoiceId?: string;
  responseTone?: StoryResponseTone;
  responseSelectedAt?: number;
}

export interface InventoryActionResult {
  success: boolean;
  message?: string;
  error?: string;
  rewards?: RewardSummary;
}

export interface TradeExchangeOffer {
  id: string;
  name: string;
  description: string;
  cost: {
    gold?: number;
    items?: Array<{ itemId: string; quantity: number }>;
  };
  rewardItems: Array<{ itemId: string; quantity: number }>;
}

export interface AutoClaimedQuestReward {
  id: string;
  type: 'story' | 'city' | 'daily';
  kicker: string;
  title: string;
  description: string;
  rewards: RewardSummary;
}

export const INVENTORY_ITEM_DEFINITIONS: Record<string, InventoryItemDefinition> = {
  'rare-gem': {
    id: 'rare-gem',
    name: 'Rare Gem',
    kind: 'material',
    rarity: 'rare',
    description: 'A violet upgrade gem used for gear storage expansion and later crafting.',
    icon: 'gem',
    imagePath: '/assets/icons/rare-gem.png',
  },
  'red-mercy-draught': {
    id: 'red-mercy-draught',
    name: 'Red Mercy Draught',
    kind: 'consumable',
    rarity: 'common',
    description: 'Restores 35 commander health.',
    icon: 'health',
    imagePath: '/assets/icons/health.png',
    useLabel: 'Drink',
    healthRestore: 35,
  },
  'field-surgeon-kit': {
    id: 'field-surgeon-kit',
    name: 'Field Surgeon Kit',
    kind: 'consumable',
    rarity: 'uncommon',
    description: 'Restores 75 commander health after hard travel or battle.',
    icon: 'health',
    imagePath: '/assets/icons/health.png',
    useLabel: 'Use',
    healthRestore: 75,
  },
  'small-gem-sack': {
    id: 'small-gem-sack',
    name: 'Small Gem Sack',
    kind: 'container',
    rarity: 'uncommon',
    description: 'Open for 1-2 rare gems.',
    icon: 'gem',
    imagePath: '/assets/icons/rare-gem.png',
    useLabel: 'Open',
  },
  'relic-gem-sack': {
    id: 'relic-gem-sack',
    name: 'Relic Gem Sack',
    kind: 'container',
    rarity: 'rare',
    description: 'Open for 2-4 rare gems.',
    icon: 'gem',
    imagePath: '/assets/icons/rare-gem.png',
    useLabel: 'Open',
  },
  'decent-loot-chest': {
    id: 'decent-loot-chest',
    name: 'Weathered Loot Chest',
    kind: 'container',
    rarity: 'common',
    description: 'Open for gold, a consumable, and a chance at decent gear.',
    icon: 'chest',
    imagePath: '/assets/icons/loot-chest.png',
    useLabel: 'Open',
    chestRarity: 'decent',
  },
  'rare-loot-chest': {
    id: 'rare-loot-chest',
    name: 'Blue-Sealed Loot Chest',
    kind: 'container',
    rarity: 'rare',
    description: 'Open for gold, gems, and a rare equipment roll.',
    icon: 'chest',
    imagePath: '/assets/icons/loot-chest.png',
    useLabel: 'Open',
    chestRarity: 'rare',
  },
  'epic-loot-chest': {
    id: 'epic-loot-chest',
    name: 'Violet Relic Chest',
    kind: 'container',
    rarity: 'epic',
    description: 'Open for gems and an epic equipment roll.',
    icon: 'chest',
    imagePath: '/assets/icons/loot-chest.png',
    useLabel: 'Open',
    chestRarity: 'epic',
  },
  'sealed-spell-cache': {
    id: 'sealed-spell-cache',
    name: 'Sealed Spell Cache',
    kind: 'container',
    rarity: 'rare',
    description: 'Open to unlock one unknown commander spell. If all spells are known, it becomes rare gems instead.',
    icon: 'magic',
    imagePath: '/assets/icons/magic.png',
    useLabel: 'Study',
    spellRewardCount: 1,
  },
  'black-amber': {
    id: 'black-amber',
    name: 'Black Amber',
    kind: 'trade',
    rarity: 'uncommon',
    description: 'A dark trade good used by town brokers for reliquary exchanges.',
    icon: 'gold',
    imagePath: '/assets/icons/gold.png',
    sellValue: 45,
  },
  'pilgrim-icon': {
    id: 'pilgrim-icon',
    name: 'Pilgrim Icon',
    kind: 'trade',
    rarity: 'rare',
    description: 'A small shrine token with real collector value.',
    icon: 'gold',
    imagePath: '/assets/icons/gold.png',
    sellValue: 95,
  },
  'candle-key-fragment': {
    id: 'candle-key-fragment',
    name: 'Candle-Key Fragment',
    kind: 'quest',
    rarity: 'rare',
    description: 'A quest relic shard. Keep it for later chapter and dungeon hooks.',
    icon: 'magic',
    imagePath: '/assets/icons/magic.png',
  },
};

export const TRADE_EXCHANGE_OFFERS: TradeExchangeOffer[] = [
  {
    id: 'amber-armory-cache',
    name: 'Amber Armory Cache',
    description: 'Trade common relic goods for a sealed equipment chest.',
    cost: {
      gold: 80,
      items: [
        { itemId: 'black-amber', quantity: 2 },
      ],
    },
    rewardItems: [
      { itemId: 'rare-loot-chest', quantity: 1 },
    ],
  },
  {
    id: 'pilgrim-spell-cache',
    name: 'Pilgrim Spell Cache',
    description: 'Spend shrine trade goods on one chance to unlock a commander spell.',
    cost: {
      gold: 120,
      items: [
        { itemId: 'pilgrim-icon', quantity: 1 },
        { itemId: 'black-amber', quantity: 1 },
      ],
    },
    rewardItems: [
      { itemId: 'sealed-spell-cache', quantity: 1 },
    ],
  },
  {
    id: 'candle-reliquary',
    name: 'Candle Reliquary',
    description: 'Convert a quest relic and gems into a stronger late-run cache.',
    cost: {
      gold: 180,
      items: [
        { itemId: 'candle-key-fragment', quantity: 1 },
        { itemId: 'rare-gem', quantity: 2 },
      ],
    },
    rewardItems: [
      { itemId: 'epic-loot-chest', quantity: 1 },
    ],
  },
];

export interface ShopOffer {
  id: string;
  town: 'Harborview' | 'Riverside' | 'all';
  name: string;
  description: string;
  price: number;
  imagePath: string;
  kind: 'heal' | 'gem' | 'equipment' | 'minion';
  value?: number;
  rarity?: EquipmentRarity;
  minLevel?: number;
  minionTemplateId?: string;
}

export interface TownRecruitmentOffer {
  offerId: string;
  weekKey: string;
  townName: TownRecruitmentTown;
  templateId: string;
  name: string;
  description: string;
  imagePath: string;
  tier: Extract<MinionTier, 'tier1' | 'tier2'>;
  price: number;
  minLevel: number;
  unlocked: boolean;
  claimed: boolean;
  resetsAt: number;
}

export const MINION_CLASS_LABELS: Record<MinionClass, string> = {
  wizard: 'Wizard',
  knight: 'Knight',
  templar: 'Templar',
  priest: 'Priest',
};

export const MINION_TIER_LABELS: Record<MinionTier, string> = {
  tier1: 'Tier I',
  tier2: 'Tier II',
  tier3: 'Tier III',
};

export const SHOP_OFFERS: ShopOffer[] = [
  {
    id: 'harbor-draught',
    town: 'all',
    name: 'Red Mercy Draught',
    description: 'Restores 35 health to your commander.',
    price: 45,
    imagePath: '/assets/icons/health.png',
    kind: 'heal',
    value: 35,
  },
  {
    id: 'harbor-gem',
    town: 'all',
    name: 'Rare Violet Gem',
    description: 'Used for inventory upgrades and later crafting.',
    price: 140,
    imagePath: '/assets/icons/rare-gem.png',
    kind: 'gem',
    value: 1,
  },
  {
    id: 'field-surgeon-kit',
    town: 'all',
    name: 'Field Surgeon Kit',
    description: 'Restores 75 health for commanders returning from battle.',
    price: 95,
    imagePath: '/assets/icons/health.png',
    kind: 'heal',
    value: 75,
  },
  {
    id: 'sealed-gem-casket',
    town: 'all',
    name: 'Sealed Gem Casket',
    description: 'Three rare gems for satchel upgrades and future crafting.',
    price: 360,
    imagePath: '/assets/icons/rare-gem.png',
    kind: 'gem',
    value: 3,
  },
  {
    id: 'harbor-armory-cache',
    town: 'Harborview',
    name: 'Harbor Armory Cache',
    description: 'A decent piece of gothic field equipment.',
    price: 95,
    imagePath: '/assets/icons/loot-chest.png',
    kind: 'equipment',
    rarity: 'decent',
  },
  {
    id: 'harbor-blue-steel-cache',
    town: 'Harborview',
    name: 'Blue Steel Cache',
    description: 'A rare piece from the harbor guard reliquary.',
    price: 280,
    imagePath: '/assets/icons/loot-chest.png',
    kind: 'equipment',
    rarity: 'rare',
  },
  {
    id: 'riverside-relic-cache',
    town: 'Riverside',
    name: 'Riverside Relic Cache',
    description: 'A rare item from the river shrine vaults.',
    price: 260,
    imagePath: '/assets/icons/loot-chest.png',
    kind: 'equipment',
    rarity: 'rare',
  },
  {
    id: 'riverside-violet-cache',
    town: 'Riverside',
    name: 'Violet Relic Cache',
    description: 'An epic item from the river shrine, expensive and uncertain.',
    price: 720,
    imagePath: '/assets/icons/loot-chest.png',
    kind: 'equipment',
    rarity: 'epic',
  },
  {
    id: 'harbor-squire-contract',
    town: 'Harborview',
    name: 'Squire Contract',
    description: 'Adds one Squire to your minion roster.',
    price: 180,
    imagePath: '/assets/minions/knight-squire.png',
    kind: 'minion',
    minionTemplateId: 'knight-squire',
  },
  {
    id: 'harbor-initiate-contract',
    town: 'Harborview',
    name: 'Templar Initiate Vow',
    description: 'Adds one defensive Templar Initiate to your roster.',
    price: 210,
    imagePath: '/assets/minions/templar-initiate.png',
    kind: 'minion',
    minionTemplateId: 'templar-initiate',
  },
  {
    id: 'harbor-man-at-arms-contract',
    town: 'Harborview',
    name: 'Man-at-Arms Contract',
    description: 'Adds one sturdy Man-at-Arms to your reserve.',
    price: 620,
    imagePath: '/assets/minions/knight-man-at-arms.png',
    kind: 'minion',
    minionTemplateId: 'knight-man-at-arms',
  },
  {
    id: 'riverside-acolyte-contract',
    town: 'Riverside',
    name: 'Acolyte Vow',
    description: 'Adds one Acolyte healer to your minion roster.',
    price: 190,
    imagePath: '/assets/minions/priest-acolyte.png',
    kind: 'minion',
    minionTemplateId: 'priest-acolyte',
  },
  {
    id: 'riverside-apprentice-contract',
    town: 'Riverside',
    name: 'Apprentice Wizard Pact',
    description: 'Adds one ranged Apprentice Wizard to your roster.',
    price: 230,
    imagePath: '/assets/minions/wizard-apprentice.png',
    kind: 'minion',
    minionTemplateId: 'wizard-apprentice',
  },
  {
    id: 'riverside-cleric-contract',
    town: 'Riverside',
    name: 'Cleric Oath',
    description: 'Adds one mid-tier Cleric healer to your army.',
    price: 640,
    imagePath: '/assets/minions/priest-cleric.png',
    kind: 'minion',
    minionTemplateId: 'priest-cleric',
  },
  {
    id: 'riverside-magus-contract',
    town: 'Riverside',
    name: 'Battle Magus Writ',
    description: 'Adds one mid-tier Battle Magus for ranged spell pressure.',
    price: 690,
    imagePath: '/assets/minions/wizard-magus.png',
    kind: 'minion',
    minionTemplateId: 'wizard-magus',
  },
  {
    id: 'candle-blood-tonic',
    town: 'all',
    name: 'Candle-Blood Tonic',
    description: 'Restores 120 health before a dangerous road or dungeon.',
    price: 165,
    imagePath: '/assets/icons/health.png',
    kind: 'heal',
    value: 120,
  },
  {
    id: 'pilgrim-gem-purse',
    town: 'all',
    name: 'Pilgrim Gem Purse',
    description: 'Five rare gems sealed for satchel upgrades.',
    price: 560,
    imagePath: '/assets/icons/rare-gem.png',
    kind: 'gem',
    value: 5,
  },
  {
    id: 'harbor-crusader-contract',
    town: 'Harborview',
    name: 'Crusader Charter',
    description: 'Adds one Crusader Templar with strong defensive pressure.',
    price: 700,
    imagePath: '/assets/minions/templar-crusader.png',
    kind: 'minion',
    minionTemplateId: 'templar-crusader',
  },
  {
    id: 'harbor-champion-contract',
    town: 'Harborview',
    name: 'Champion Writ',
    description: 'Adds one elite Champion Knight to your field roster.',
    price: 1650,
    imagePath: '/assets/minions/knight-champion.png',
    kind: 'minion',
    minionTemplateId: 'knight-champion',
  },
  {
    id: 'harbor-paragon-contract',
    town: 'Harborview',
    name: 'Paragon Seal',
    description: 'Adds one Paragon Templar carrying a relic shield.',
    price: 1780,
    imagePath: '/assets/minions/templar-paragon.png',
    kind: 'minion',
    minionTemplateId: 'templar-paragon',
  },
  {
    id: 'harbor-gold-red-reliquary',
    town: 'Harborview',
    name: 'Gold-Red Reliquary',
    description: 'A legendary equipment roll from the sealed harbor vault.',
    price: 2250,
    imagePath: '/assets/icons/loot-chest.png',
    kind: 'equipment',
    rarity: 'legendary',
  },
  {
    id: 'riverside-archmage-contract',
    town: 'Riverside',
    name: 'Archmage Pact',
    description: 'Adds one Archmage for late-game ranged spell dominance.',
    price: 1850,
    imagePath: '/assets/minions/wizard-archmage.png',
    kind: 'minion',
    minionTemplateId: 'wizard-archmage',
  },
  {
    id: 'riverside-high-priest-contract',
    town: 'Riverside',
    name: 'High Priest Covenant',
    description: 'Adds one High Priest with powerful healing support.',
    price: 1720,
    imagePath: '/assets/minions/priest-high-priest.png',
    kind: 'minion',
    minionTemplateId: 'priest-high-priest',
  },
  {
    id: 'riverside-moonwell-cache',
    town: 'Riverside',
    name: 'Moonwell Epic Cache',
    description: 'An epic equipment roll from the star-law reliquary.',
    price: 820,
    imagePath: '/assets/icons/loot-chest.png',
    kind: 'equipment',
    rarity: 'epic',
  },
];

export function getTownShopOffers(townName: string, now = Date.now(), limit = 5): ShopOffer[] {
  const availableOffers = SHOP_OFFERS.filter(offer => (
    offer.kind !== 'minion' && (offer.town === 'all' || offer.town === townName)
  )).map(offer => ({
    ...offer,
    minLevel: offer.kind === 'equipment' && offer.rarity
      ? getEquipmentRarityMinLevel(offer.rarity)
      : offer.minLevel,
  }));
  const fixedOffers = availableOffers
    .filter(offer => offer.id === 'harbor-draught' || offer.id === 'harbor-gem')
    .slice(0, 2);
  const rotatingOffers = availableOffers.filter(offer => !fixedOffers.some(fixed => fixed.id === offer.id));

  if (rotatingOffers.length === 0) return fixedOffers.slice(0, limit);

  const cycle = Math.floor(now / (2 * 60 * 60 * 1000));
  const startIndex = cycle % rotatingOffers.length;
  const rotatedOffers = rotatingOffers.map((_, index) => rotatingOffers[(startIndex + index) % rotatingOffers.length]);

  return [...fixedOffers, ...rotatedOffers].slice(0, limit);
}

function isTownRecruitmentTown(townName: string): townName is TownRecruitmentTown {
  return (TOWN_RECRUITMENT_TOWNS as readonly string[]).includes(townName);
}

export function getTownRecruitmentOffers(
  townName: string,
  user: User | null = getCurrentUser(),
  now = Date.now(),
): TownRecruitmentOffer[] {
  if (!isTownRecruitmentTown(townName)) return [];
  return getTownRecruitmentSlots(
    townName,
    user?.stats.level || 1,
    user?.townRecruitmentClaims,
    now,
  ).flatMap(slot => {
    const template = getMinionTemplate(slot.templateId);
    if (!template) return [];
    return [{
      ...slot,
      name: template.name,
      description: slot.tier === 'tier2'
        ? `Weekly specialist contract for one ${template.name}.`
        : `Weekly reserve contract for one ${template.name}.`,
      imagePath: `/assets/minions/${template.assetName}`,
    }];
  });
}

function getBattleWinCount(user: User): number {
  return (user.activityLog || []).filter(activity => activity.type === 'battle').length;
}

function getCompletedJobCount(user: User): number {
  return (user.activityLog || []).filter(activity => activity.type === 'job').length;
}

function getPoiFootprintSize(type: POIType): { width: number; height: number } {
  if (type === POIType.TOWN) return { width: 8, height: 8 };
  if (type === POIType.CAMPFIRE) return { width: 2, height: 2 };
  return { width: 4, height: 4 };
}

function isPreviousStoryQuestClaimed(user: User, quest: StoryQuestTemplate): boolean {
  const ordered = getAllStoryQuestsSorted();
  const index = ordered.findIndex(item => item.id === quest.id);
  if (index <= 0) return true;
  const previous = ordered[index - 1];
  return Boolean(user.storyQuests?.some(item => item.questId === previous.id && item.claimed));
}

function hasVisitedQuestNpc(user: User, questNpcId?: string, afterQuestId?: string): boolean {
  if (!questNpcId) return false;
  const npc = getQuestNpcById(questNpcId);
  if (!npc) return false;
  const afterTimestamp = afterQuestId
    ? user.storyQuests?.find(progress => progress.questId === afterQuestId && progress.claimed)?.completedAt
    : undefined;
  if (afterQuestId && !afterTimestamp) return false;

  if (!afterQuestId && Math.abs(user.x - npc.x) + Math.abs(user.y - npc.y) <= 1) return true;

  return (user.activityLog || []).some(activity => (
    activity.type === 'quest'
    && activity.questNpcId === questNpcId
    && (!afterTimestamp || activity.completedAt > afterTimestamp)
  ));
}

function getJobsAtPoiCount(user: User, requirement: QuestRequirementSpec): number {
  return (user.activityLog || []).filter(activity => {
    if (activity.type !== 'job') return false;
    if (requirement.poiName && activity.source !== requirement.poiName) return false;
    if (requirement.minDuration && (activity.jobDurationMs || 0) < requirement.minDuration) return false;
    return true;
  }).length;
}

function getDefeatEnemiesInLevelRangeCount(
  user: User,
  minLevel = 1,
  maxLevel = MAX_PLAYER_LEVEL,
): number {
  return (user.activityLog || []).filter(activity => (
    activity.type === 'battle'
    && typeof activity.battleLevel === 'number'
    && activity.battleLevel >= minLevel
    && activity.battleLevel <= maxLevel
  )).length;
}

function getDungeonClearCount(user: User, minDungeonLevel = 1): number {
  return (user.activityLog || []).filter(activity => (
    activity.type === 'battle'
    && activity.source === 'Dungeon Run'
    && typeof activity.dungeonLevel === 'number'
    && activity.dungeonLevel >= minDungeonLevel
  )).length;
}

function getQuestTargetPoi(requirement: QuestRequirementSpec) {
  if (!requirement.poiId && !requirement.poiName) return null;
  return getStaticPOIs().find(poi => (
    (requirement.poiId && poi.id === requirement.poiId) ||
    (requirement.poiName && poi.name.toLowerCase() === requirement.poiName.toLowerCase())
  )) || null;
}

function isTileInsidePoiFootprint(x: number, y: number, poi: ReturnType<typeof getStaticPOIs>[number]): boolean {
  const footprint = getPoiFootprintSize(poi.type);
  return x >= poi.x && x < poi.x + footprint.width && y >= poi.y && y < poi.y + footprint.height;
}

function getPoiAtTile(x: number, y: number) {
  return getStaticPOIs().find(poi => isTileInsidePoiFootprint(x, y, poi)) || null;
}

function hasVisitedQuestPoi(user: User, requirement: QuestRequirementSpec): boolean {
  const targetPoi = getQuestTargetPoi(requirement);
  if (!targetPoi) return false;

  if (isTileInsidePoiFootprint(user.x, user.y, targetPoi)) return true;

  const targetName = targetPoi.name.toLowerCase();
  return (user.activityLog || []).some(activity => (
    activity.type === 'travel' &&
    (`${activity.title} ${activity.source} ${activity.description || ''}`.toLowerCase().includes(targetName))
  ));
}

function getBossDefeatCount(user: User, bossId?: string, enemyId?: string): number {
  return (user.activityLog || []).filter(activity => {
    if (activity.type !== 'battle') return false;
    const activityId = activity.id?.toLowerCase() || '';
    const target = `${activity.id || ''} ${activity.title || ''} ${activity.source || ''} ${activity.description || ''}`.toLowerCase();
    if (enemyId) {
      const normalizedEnemyId = enemyId.toLowerCase();
      const isExactEncounter = activityId.includes(normalizedEnemyId)
        || target.includes(`enemy:${normalizedEnemyId}`);
      if (!isExactEncounter) return false;
    }
    if (!bossId) return true;
    return target.includes(bossId.replace(/-/g, ' ')) || target.includes(bossId);
  }).length;
}

function getEnemyInspectionCount(user: User, enemyId?: string): number {
  return (user.multiplayerEngagement?.events || []).filter(event => (
    event.kind === 'enemy-inspected' && (!enemyId || event.targetId === enemyId)
  )).length;
}

function getStoryQuestTemplate(questId: string): StoryQuestTemplate | undefined {
  return STORY_CHAPTERS.flatMap(chapter => chapter.quests).find(quest => quest.id === questId);
}

function getQuestRequirementProgressValue(
  user: User,
  requirement: QuestRequirementSpec,
  acceptedProgress = 0
): number {
  switch (requirement.type) {
    case 'complete_jobs':
      return Math.max(acceptedProgress, getCompletedJobCount(user));
    case 'complete_timed_jobs':
      return Math.max(acceptedProgress, getCompletedJobCount(user));
    case 'player_level':
      return user.stats.level;
    case 'own_rare_gems':
      return getRareGemCount(user);
    case 'collect_item':
      return getInventoryItemCount(user, requirement.itemId);
    case 'recruit_minions':
      return getOrderedMinions(user).length;
    case 'win_battles':
      return getBattleWinCount(user);
    case 'defeat_enemies_level':
      return getDefeatEnemiesInLevelRangeCount(
        user,
        requirement.minEnemyLevel || 1,
        requirement.maxEnemyLevel || MAX_PLAYER_LEVEL,
      );
    case 'clear_dungeons':
      return getDungeonClearCount(user, requirement.minDungeonLevel || 1);
    case 'complete_jobs_at_poi':
      return getJobsAtPoiCount(user, requirement);
    case 'visit_quest_npc':
      return hasVisitedQuestNpc(user, requirement.questNpcId, requirement.afterQuestId) ? 1 : acceptedProgress;
    case 'visit_poi':
      return hasVisitedQuestPoi(user, requirement) ? 1 : acceptedProgress;
    case 'inspect_enemy':
      return getEnemyInspectionCount(user, requirement.enemyId);
    case 'defeat_boss':
      return getBossDefeatCount(user, requirement.bossId, requirement.enemyId);
    default:
      return acceptedProgress;
  }
}

function getCityQuestProgressValue(user: User, quest: CityQuestTemplate, progress: CityQuestProgress | undefined): number {
  switch (quest.requirement.type) {
    case 'complete_jobs':
    case 'complete_timed_jobs':
    case 'complete_jobs_at_poi':
      return progress?.progress || 0;
    case 'player_level':
      return user.stats.level;
    case 'own_rare_gems':
      return getRareGemCount(user);
    case 'collect_item':
      return getInventoryItemCount(user, quest.requirement.itemId);
    case 'recruit_minions':
      return getOrderedMinions(user).length;
    case 'win_battles':
      return getBattleWinCount(user);
    case 'defeat_enemies_level':
      return getDefeatEnemiesInLevelRangeCount(
        user,
        quest.requirement.minEnemyLevel || 1,
        quest.requirement.maxEnemyLevel || MAX_PLAYER_LEVEL,
      );
    case 'clear_dungeons':
      return getDungeonClearCount(user, quest.requirement.minDungeonLevel || 1);
    case 'visit_quest_npc':
      return hasVisitedQuestNpc(user, quest.requirement.questNpcId, quest.requirement.afterQuestId) ? 1 : progress?.progress || 0;
    case 'visit_poi':
      return hasVisitedQuestPoi(user, quest.requirement) ? 1 : progress?.progress || 0;
    default:
      return progress?.progress || 0;
  }
}

function normalizeSpellIds(spellIds: string[] | undefined): string[] {
  return Array.from(new Set((spellIds || []).filter(spellId => ALL_BATTLE_SPELL_IDS.includes(spellId))));
}

function getSpellRewardPool(level: number): string[] {
  if (level >= 13) return [...LEGENDARY_SPELL_REWARD_IDS, ...RARE_SPELL_REWARD_IDS, ...COMMON_SPELL_REWARD_IDS];
  if (level >= 7) return [...RARE_SPELL_REWARD_IDS, ...COMMON_SPELL_REWARD_IDS];
  return COMMON_SPELL_REWARD_IDS;
}

function pickUnknownSpellRewards(user: User, count: number): string[] {
  const known = new Set(normalizeSpellIds(user.knownSpellIds || DEFAULT_KNOWN_SPELL_IDS));
  const pool = getSpellRewardPool(user.stats.level || 1);
  const unknown = pool.filter(spellId => !known.has(spellId));
  const fallback = ALL_BATTLE_SPELL_IDS.filter(spellId => !known.has(spellId));
  const candidates = unknown.length > 0 ? unknown : fallback;
  const rewards: string[] = [];

  while (rewards.length < count && candidates.length > 0) {
    const index = randomInt(0, candidates.length - 1);
    rewards.push(candidates[index]);
    candidates.splice(index, 1);
  }

  return rewards;
}

function applySpellUnlocks(user: User, spellIds: string[] | undefined): {
  knownSpellIds: string[];
  unlockedSpellIds: string[];
} {
  const normalized = normalizeSpellIds(spellIds);
  const known = new Set(normalizeSpellIds(user.knownSpellIds || DEFAULT_KNOWN_SPELL_IDS));
  const unlockedSpellIds = normalized.filter(spellId => !known.has(spellId));
  normalized.forEach(spellId => known.add(spellId));
  DEFAULT_KNOWN_SPELL_IDS.forEach(spellId => known.add(spellId));

  return {
    knownSpellIds: Array.from(known),
    unlockedSpellIds,
  };
}

export function getStoryQuestStatus(
  user: User | null | undefined,
  questId: string
): { claimed: boolean; complete: boolean; unlocked: boolean; progress: number; required: number } {
  const quest = getStoryQuestTemplate(questId);
  const state = user?.storyQuests?.find(item => item.questId === questId);
  const required = quest?.requirement.count || 1;
  const unlocked = Boolean(
    user
    && quest
    && user.stats.level >= quest.requiredLevel
    && isPreviousStoryQuestClaimed(user, quest),
  );
  const rawProgress = user && quest ? getQuestRequirementProgressValue(user, quest.requirement, 0) : 0;
  const progress = Math.min(rawProgress, required);

  return {
    claimed: Boolean(state?.claimed),
    complete: Boolean(unlocked && progress >= required),
    unlocked,
    progress,
    required,
  };
}

export function markStoryQuestIntroSeen(questId: string): void {
  const currentUser = getCurrentUser();
  if (!currentUser) return;

  const storyQuests = currentUser.storyQuests || [];
  if (storyQuests.some(item => item.questId === questId && item.introSeen)) return;
  const existing = storyQuests.find(item => item.questId === questId);

  updateCurrentUser({
    storyQuests: [
      ...storyQuests.filter(item => item.questId !== questId),
      {
        ...existing,
        questId,
        claimed: existing?.claimed || false,
        introSeen: true,
      },
    ],
  });
}

export function getStoryQuestResponseChoiceId(
  user: Pick<User, 'storyQuests'> | null | undefined,
  questId: string,
): string | undefined {
  return user?.storyQuests?.find(item => item.questId === questId)?.responseChoiceId;
}

export function recordStoryQuestResponse(
  questId: string,
  choiceId: string,
): { success: boolean; error?: string } {
  const currentUser = getCurrentUser();
  if (!currentUser) return { success: false, error: 'Not logged in.' };

  const quest = getStoryQuestTemplate(questId);
  const sequence = getStoryDialogSequence(quest?.dialogId);
  const choice = sequence?.lines.flatMap(line => line.choices || []).find(item => item.id === choiceId);
  if (!quest || !sequence || !choice) {
    return { success: false, error: 'Story response not found.' };
  }

  const storyQuests = currentUser.storyQuests || [];
  const existing = storyQuests.find(item => item.questId === questId);
  if (existing?.responseChoiceId) {
    return existing.responseChoiceId === choice.id
      ? { success: true }
      : { success: false, error: 'This story response is already set.' };
  }

  updateCurrentUser({
    storyQuests: [
      ...storyQuests.filter(item => item.questId !== questId),
      {
        ...existing,
        questId,
        claimed: existing?.claimed || false,
        responseChoiceId: choice.id,
        responseTone: choice.tone,
        responseSelectedAt: Date.now(),
      },
    ],
  });
  return { success: true };
}

export const MULTIPLAYER_ONBOARDING_STORY_QUEST_IDS = [
  'story-01-first-banner',
  'story-02-candle-road',
  'story-03-lost-apprentice',
  'story-04-river-law',
  'story-05-violet-satchel',
  'story-06-black-pike',
] as const;

export function skipMultiplayerOnboarding(): {
  success: boolean;
  skippedCount: number;
  message?: string;
  error?: string;
} {
  const currentUser = getCurrentUser();
  if (!currentUser) return { success: false, skippedCount: 0, error: 'Not logged in.' };

  const progressByQuestId = new Map(
    (currentUser.storyQuests || []).map(progress => [progress.questId, progress]),
  );
  let skippedCount = 0;

  MULTIPLAYER_ONBOARDING_STORY_QUEST_IDS.forEach(questId => {
    const existing = progressByQuestId.get(questId);
    if (!existing?.introSeen) skippedCount += 1;
    progressByQuestId.set(questId, {
      ...existing,
      questId,
      claimed: existing?.claimed || false,
      introSeen: true,
    });
  });

  if (skippedCount === 0) {
    return { success: true, skippedCount: 0, message: 'Opening conversations were already complete.' };
  }

  updateCurrentUser({ storyQuests: Array.from(progressByQuestId.values()) });
  return {
    success: true,
    skippedCount,
    message: 'Opening conversations skipped. Story objectives and rewards remain unchanged.',
  };
}

export function getPendingStoryDialogQuest(user: User | null | undefined): StoryQuestTemplate | undefined {
  if (!user) return undefined;

  return getAllStoryQuestsSorted().find(story => {
    if (!story.dialogId) return false;
    const status = getStoryQuestStatus(user, story.id);
    if (!status.unlocked || status.claimed) return false;
    if (story.requirement.type === 'visit_quest_npc' && story.requirement.afterQuestId) return false;
    const state = user.storyQuests?.find(item => item.questId === story.id);
    return !state?.introSeen;
  });
}

export function recordQuestNpcVisit(npcId: string): void {
  const currentUser = getCurrentUser();
  if (!currentUser) return;

  const npc = getQuestNpcById(npcId);
  if (!npc) return;

  const latestVisit = (currentUser.activityLog || []).find(entry => entry.type === 'quest' && entry.questNpcId === npcId);
  if (latestVisit && Date.now() - latestVisit.completedAt < 3000) return;

  updateCurrentUser({
    activityLog: pushActivityEntry(currentUser.activityLog, {
      id: `activity-quest-npc-visit-${npcId}-${Date.now()}`,
      type: 'quest',
      title: `Spoke with ${npc.name}`,
      source: npc.faction,
      completedAt: Date.now(),
      rewards: {},
      questNpcId: npcId,
    }),
  });
}

function updateCityQuestProgressForJob(
  cityQuests: CityQuestProgress[] | undefined,
  jobDuration: number,
  jobPoiName: string,
): CityQuestProgress[] {
  return (cityQuests || []).map(progress => {
    if (progress.claimed) return progress;

    const quest = getCityQuestTemplate(progress.questId);
    if (!quest) return progress;

    if (quest.requirement.type === 'complete_jobs') {
      return { ...progress, progress: progress.progress + 1 };
    }

    if (quest.requirement.type === 'complete_jobs_at_poi') {
      if (quest.requirement.poiName && quest.requirement.poiName !== jobPoiName) return progress;
      if (quest.requirement.minDuration && jobDuration < quest.requirement.minDuration) return progress;
      return { ...progress, progress: progress.progress + 1 };
    }

    if (
      quest.requirement.type === 'complete_timed_jobs' &&
      quest.requirement.minDuration &&
      jobDuration >= quest.requirement.minDuration
    ) {
      return { ...progress, progress: progress.progress + 1 };
    }

    return progress;
  });
}

function getBaseBalancedQuestExp(exp = 0): number {
  if (exp <= 40) return exp;
  if (exp <= 120) return 40;
  return Math.round(40 + (exp - 120) * 0.35);
}

export type MultiplayerQuestRewardSource = Extract<MultiplayerRewardSource, 'contract' | 'campaign'>;

export function getBalancedQuestExp(
  exp = 0,
  playerLevel = 1,
  source: MultiplayerQuestRewardSource = 'contract',
): number {
  const scaled = scaleMultiplayerRewards(
    { gold: 0, exp: getBaseBalancedQuestExp(exp) },
    playerLevel,
    source,
  ).exp;
  return source === 'campaign'
    ? capCampaignRewardExp(scaled, getExpNeeded(playerLevel))
    : scaled;
}

export function getBalancedQuestGold(
  gold = 0,
  playerLevel = 1,
  source: MultiplayerQuestRewardSource = 'contract',
): number {
  return scaleMultiplayerRewards({ gold, exp: 0 }, playerLevel, source).gold;
}

export function getCityQuestStatus(
  user: User | null | undefined,
  questId: string
): { accepted: boolean; claimed: boolean; complete: boolean; progress: number; required: number } {
  const quest = getCityQuestTemplate(questId);
  const state = user?.cityQuests?.find(item => item.questId === questId);
  const required = quest?.requirement.count || 1;
  const progress = user && quest ? getCityQuestProgressValue(user, quest, state) : state?.progress || 0;

  return {
    accepted: Boolean(state),
    claimed: Boolean(state?.claimed),
    complete: Boolean(state && progress >= required),
    progress: Math.min(progress, required),
    required,
  };
}

export function acceptCityQuest(questId: string, townName: string): { success: boolean; error?: string } {
  const currentUser = getCurrentUser();
  if (!currentUser) return { success: false, error: 'Not logged in.' };
  const unlock = requireMultiplayerUnlock('city-contracts', currentUser);
  if (!unlock.allowed) return { success: false, error: unlock.error };

  const quest = getRotatingCityQuests(townName).find(item => item.id === questId);
  if (!quest) return { success: false, error: 'That contract is not on this city board right now.' };

  const cityQuests = currentUser.cityQuests || [];
  const existing = cityQuests.find(item => item.questId === questId);
  if (existing?.claimed) return { success: false, error: 'That contract was already completed.' };
  if (existing) return { success: true };

  const activeCount = cityQuests.filter(item => !item.claimed).length;
  if (activeCount >= 1) return { success: false, error: 'Finish or claim your current city contract first.' };

  updateCurrentUser({
    cityQuests: [
      ...cityQuests,
      {
        questId,
        progress: 0,
        acceptedAt: Date.now(),
        claimed: false,
      },
    ],
  });

  return { success: true };
}

function buildQuestRewardSummary(
  rewards: QuestRewardSpec,
  playerLevel = 1,
  source: MultiplayerQuestRewardSource = 'contract',
): {
  gold: number;
  exp: number;
  healthRestore: number;
  items: InventoryItem[];
  equipment: Equipment[];
  minions: MinionStack[];
  spellIds: string[];
} {
  const rewardRarity = rewards.equipmentRarity
    ? capEquipmentRarityForLevel(rewards.equipmentRarity, playerLevel)
    : null;
  const equipment = rewardRarity ? [generateEquipment(0, rewardRarity)].filter(Boolean) as Equipment[] : [];
  const minions = rewards.minionTier
    ? [generateMinionDrop(0, rewards.minionTier, 1, playerLevel)].filter(Boolean) as MinionStack[]
    : [];
  const spellIds = normalizeSpellIds(rewards.spellIds);
  const items = rewards.rareGems
    ? [{
        id: 'rare-gem',
        name: 'Rare Gem',
        quantity: rewards.rareGems,
        icon: 'gem',
      }]
    : [];

  return {
    gold: getBalancedQuestGold(rewards.gold || 0, playerLevel, source),
    exp: getBalancedQuestExp(rewards.exp || 0, playerLevel, source),
    healthRestore: rewards.healthRestore || 0,
    items,
    equipment,
    minions,
    spellIds,
  };
}

export function claimCityQuestReward(questId: string): {
  success: boolean;
  rewards?: RewardSummary;
  error?: string;
} {
  const currentUser = getCurrentUser();
  if (!currentUser) return { success: false, error: 'Not logged in.' };

  const quest = getCityQuestTemplate(questId);
  if (!quest) return { success: false, error: 'Contract not found.' };

  const cityQuests = currentUser.cityQuests || [];
  const progressState = cityQuests.find(item => item.questId === questId);
  if (!progressState) return { success: false, error: 'Accept this contract first.' };
  if (progressState.claimed) return { success: false, error: 'Contract already claimed.' };

  const progress = getCityQuestProgressValue(currentUser, quest, progressState);
  if (progress < quest.requirement.count) return { success: false, error: 'Contract is not complete yet.' };

  const reward = buildQuestRewardSummary(quest.rewards, currentUser.stats.level, 'contract');
  const spellUnlock = applySpellUnlocks(currentUser, reward.spellIds);
  if (reward.equipment.length > 0 && !canAcceptGearReward(currentUser, reward.equipment.length)) {
    return { success: false, error: 'Gear storage is full. Sell or equip gear before claiming this reward.' };
  }

  const itemResult = addInventoryItemsWithLimit(
    currentUser.inventory || [],
    reward.items,
    getInventorySlotCapacity(currentUser)
  );
  const gearResult = addEquipmentWithLimit(
    currentUser.equipment || [],
    currentUser.equippedSlots || {},
    reward.equipment,
    getInventorySlotCapacity(currentUser),
  );

  const completedAt = Date.now();
  const updatedStats = { ...currentUser.stats };
  if (reward.healthRestore > 0) {
    updatedStats.health = Math.min(updatedStats.maxHealth, updatedStats.health + reward.healthRestore);
  }

  const updatedCityQuests = cityQuests.map(item => (
    item.questId === questId
      ? { ...item, progress: quest.requirement.count, claimed: true, completedAt }
      : item
  ));

  const rewardSummary: RewardSummary = {
    gold: reward.gold || undefined,
    exp: reward.exp || undefined,
    healthRestore: reward.healthRestore || undefined,
    items: itemResult.acceptedItems.length > 0 ? itemResult.acceptedItems : undefined,
    rareGems: quest.rewards.rareGems,
    equipment: gearResult.acceptedEquipment.length > 0 ? gearResult.acceptedEquipment : undefined,
    minions: reward.minions.length > 0 ? reward.minions : undefined,
    spellIds: spellUnlock.unlockedSpellIds.length > 0 ? spellUnlock.unlockedSpellIds : undefined,
  };

  updateCurrentUser({
    gold: currentUser.gold + reward.gold,
    exp: currentUser.exp + reward.exp,
    stats: updatedStats,
    inventory: itemResult.inventory,
    equipment: gearResult.equipment,
    minions: mergeMinionStacks(currentUser.minions || [], reward.minions),
    knownSpellIds: spellUnlock.knownSpellIds,
    cityQuests: updatedCityQuests,
    ...recordUserMultiplayerEvent(
      currentUser,
      {
        id: `city-contract-completed:${quest.id}`,
        kind: 'city-contract-completed',
        occurredAt: completedAt,
        contextId: quest.town,
        targetId: quest.id,
      },
      completedAt,
    ),
    activityLog: pushActivityEntry(currentUser.activityLog, {
      id: `activity-city-quest-${quest.id}-${completedAt}`,
      type: 'quest',
      title: quest.name,
      source: `${quest.town} - ${quest.faction}`,
      completedAt,
      rewards: rewardSummary,
    }),
  });

  return { success: true, rewards: rewardSummary };
}

export function hasClaimedQuestNpcReward(user: Pick<User, 'activityLog'> | null, npcId: string): boolean {
  return Boolean((user?.activityLog || []).some(entry => entry.id.startsWith(`activity-quest-npc-${npcId}-`)));
}

export function getQuestNpcStatus(
  user: User | null | undefined,
  npcId: string
): { progress: number; required: number; complete: boolean; claimed: boolean; requirement?: QuestRequirementSpec } {
  const npc = QUEST_NPCS.find(item => item.id === npcId);
  const required = npc?.requirement.count || 1;
  const claimed = hasClaimedQuestNpcReward(user || null, npcId);
  const progress = user && npc ? Math.min(required, getQuestRequirementProgressValue(user, npc.requirement, 0)) : 0;

  return {
    progress,
    required,
    complete: progress >= required,
    claimed,
    requirement: npc?.requirement,
  };
}

export function claimQuestNpcReward(npcId: string): {
  success: boolean;
  rewards?: RewardSummary;
  error?: string;
} {
  const currentUser = getCurrentUser();
  if (!currentUser) return { success: false, error: 'Not logged in.' };

  const npc = QUEST_NPCS.find(item => item.id === npcId);
  if (!npc) return { success: false, error: 'Quest contact not found.' };
  if (hasClaimedQuestNpcReward(currentUser, npcId)) return { success: false, error: 'This counsel was already claimed.' };
  const status = getQuestNpcStatus(currentUser, npcId);
  if (!status.complete) {
    return { success: false, error: `Complete the counsel task first (${status.progress}/${status.required}).` };
  }

  const reward = buildQuestRewardSummary(npc.rewards, currentUser.stats.level, 'contract');
  const spellUnlock = applySpellUnlocks(currentUser, reward.spellIds);
  if (reward.equipment.length > 0 && !canAcceptGearReward(currentUser, reward.equipment.length)) {
    return { success: false, error: 'Gear storage is full. Sell or equip gear before claiming this counsel.' };
  }

  const itemResult = addInventoryItemsWithLimit(
    currentUser.inventory || [],
    reward.items,
    getInventorySlotCapacity(currentUser)
  );
  const gearResult = addEquipmentWithLimit(
    currentUser.equipment || [],
    currentUser.equippedSlots || {},
    reward.equipment,
    getInventorySlotCapacity(currentUser),
  );

  const completedAt = Date.now();
  const updatedStats = { ...currentUser.stats };
  if (reward.healthRestore > 0) {
    updatedStats.health = Math.min(updatedStats.maxHealth, updatedStats.health + reward.healthRestore);
  }

  const rewardSummary: RewardSummary = {
    gold: reward.gold || undefined,
    exp: reward.exp || undefined,
    healthRestore: reward.healthRestore || undefined,
    items: itemResult.acceptedItems.length > 0 ? itemResult.acceptedItems : undefined,
    rareGems: npc.rewards.rareGems,
    equipment: gearResult.acceptedEquipment.length > 0 ? gearResult.acceptedEquipment : undefined,
    minions: reward.minions.length > 0 ? reward.minions : undefined,
    spellIds: spellUnlock.unlockedSpellIds.length > 0 ? spellUnlock.unlockedSpellIds : undefined,
  };

  updateCurrentUser({
    gold: currentUser.gold + reward.gold,
    exp: currentUser.exp + reward.exp,
    stats: updatedStats,
    inventory: itemResult.inventory,
    equipment: gearResult.equipment,
    minions: mergeMinionStacks(currentUser.minions || [], reward.minions),
    knownSpellIds: spellUnlock.knownSpellIds,
    activityLog: pushActivityEntry(currentUser.activityLog, {
      id: `activity-quest-npc-${npc.id}-${completedAt}`,
      type: 'quest',
      title: `${npc.name}'s Counsel`,
      source: npc.faction,
      completedAt,
      rewards: rewardSummary,
      description: npc.questHook,
    }),
  });

  return { success: true, rewards: rewardSummary };
}

export function claimStoryQuestReward(questId: string): {
  success: boolean;
  rewards?: RewardSummary;
  error?: string;
} {
  const currentUser = getCurrentUser();
  if (!currentUser) return { success: false, error: 'Not logged in.' };

  const quest = getStoryQuestTemplate(questId);
  if (!quest) return { success: false, error: 'Story quest not found.' };

  const storyQuests = currentUser.storyQuests || [];
  if (storyQuests.some(item => item.questId === questId && item.claimed)) {
    return { success: false, error: 'Story reward already claimed.' };
  }

  const status = getStoryQuestStatus(currentUser, questId);
  if (!status.unlocked) {
    const previous = getAllStoryQuestsSorted().find((item, index, list) => (
      list[index + 1]?.id === questId
    ));
    if (previous && !storyQuests.some(item => item.questId === previous.id && item.claimed)) {
      return { success: false, error: `Complete "${previous.name}" first.` };
    }
    return { success: false, error: `Reach level ${quest.requiredLevel} first.` };
  }
  if (!status.complete) return { success: false, error: 'Story objective is not complete yet.' };

  const reward = buildQuestRewardSummary(quest.rewards, currentUser.stats.level, 'campaign');
  const spellUnlock = applySpellUnlocks(currentUser, reward.spellIds);
  if (reward.equipment.length > 0 && !canAcceptGearReward(currentUser, reward.equipment.length)) {
    return { success: false, error: 'Gear storage is full. Sell or equip gear before claiming this reward.' };
  }

  const itemResult = addInventoryItemsWithLimit(
    currentUser.inventory || [],
    reward.items,
    getInventorySlotCapacity(currentUser)
  );
  const gearResult = addEquipmentWithLimit(
    currentUser.equipment || [],
    currentUser.equippedSlots || {},
    reward.equipment,
    getInventorySlotCapacity(currentUser),
  );

  const completedAt = Date.now();
  const existingStoryProgress = storyQuests.find(item => item.questId === questId);
  const updatedStats = { ...currentUser.stats };
  if (reward.healthRestore > 0) {
    updatedStats.health = Math.min(updatedStats.maxHealth, updatedStats.health + reward.healthRestore);
  }

  const rewardSummary: RewardSummary = {
    gold: reward.gold || undefined,
    exp: reward.exp || undefined,
    healthRestore: reward.healthRestore || undefined,
    items: itemResult.acceptedItems.length > 0 ? itemResult.acceptedItems : undefined,
    rareGems: quest.rewards.rareGems,
    equipment: gearResult.acceptedEquipment.length > 0 ? gearResult.acceptedEquipment : undefined,
    minions: reward.minions.length > 0 ? reward.minions : undefined,
    spellIds: spellUnlock.unlockedSpellIds.length > 0 ? spellUnlock.unlockedSpellIds : undefined,
  };

  updateCurrentUser({
    gold: currentUser.gold + reward.gold,
    exp: currentUser.exp + reward.exp,
    stats: updatedStats,
    inventory: itemResult.inventory,
    equipment: gearResult.equipment,
    minions: mergeMinionStacks(currentUser.minions || [], reward.minions),
    knownSpellIds: spellUnlock.knownSpellIds,
    storyQuests: [
      ...storyQuests.filter(item => item.questId !== questId),
      { ...existingStoryProgress, questId, claimed: true, completedAt, introSeen: true },
    ],
    ...recordUserMultiplayerEvent(
      currentUser,
      {
        id: `story-quest-completed:${quest.id}`,
        kind: 'story-quest-completed',
        occurredAt: completedAt,
        contextId: quest.chapter,
        targetId: quest.id,
      },
      completedAt,
    ),
    activityLog: pushActivityEntry(currentUser.activityLog, {
      id: `activity-story-quest-${quest.id}-${completedAt}`,
      type: 'quest',
      title: quest.name,
      source: quest.chapter,
      completedAt,
      rewards: rewardSummary,
      description: quest.lore,
    }),
  });

  return { success: true, rewards: rewardSummary };
}

export const MINION_TEMPLATES: MinionTemplate[] = [
  {
    templateId: 'wizard-apprentice',
    class: 'wizard',
    tier: 'tier1',
    name: 'Apprentice Wizard',
    role: 'Low-tier spellcaster',
    assetName: 'wizard-apprentice.png',
    stats: { attack: 3, defense: 1, magic: 6, healing: 0, health: 16, movement: 3, range: 4 },
  },
  {
    templateId: 'witchdoc',
    class: 'wizard',
    tier: 'tier1',
    name: 'Witch Doctor',
    role: 'Standalone poison caster',
    assetName: 'witchdoc.png',
    stats: { attack: 1, defense: 2, magic: 5, healing: 0, health: 20, movement: 3, range: 4 },
  },
  {
    templateId: 'wizard-magus',
    class: 'wizard',
    tier: 'tier2',
    name: 'Battle Magus',
    role: 'Mid-tier spellcaster',
    assetName: 'wizard-magus.png',
    stats: { attack: 5, defense: 2, magic: 10, healing: 0, health: 24, movement: 3, range: 4 },
  },
  {
    templateId: 'enchanter',
    class: 'wizard',
    tier: 'tier2',
    name: 'Void Enchanter',
    role: 'Standalone ward support',
    assetName: 'enchanter.png',
    stats: { attack: 3, defense: 4, magic: 9, healing: 0, health: 28, movement: 3, range: 3 },
  },
  {
    templateId: 'wizard-archmage',
    class: 'wizard',
    tier: 'tier3',
    name: 'Archmage',
    role: 'High-tier spellcaster',
    assetName: 'wizard-archmage.png',
    stats: { attack: 7, defense: 4, magic: 16, healing: 0, health: 34, movement: 3, range: 5 },
  },
  {
    templateId: 'plaugedoc',
    class: 'wizard',
    tier: 'tier3',
    name: 'Plague Doctor',
    role: 'Standalone poison marksman',
    assetName: 'plaugedoc.png',
    stats: { attack: 5, defense: 6, magic: 11, healing: 0, health: 44, movement: 3, range: 4 },
  },
  {
    templateId: 'knight-squire',
    class: 'knight',
    tier: 'tier1',
    name: 'Squire',
    role: 'Low-tier melee guard',
    assetName: 'knight-squire.png',
    stats: { attack: 5, defense: 5, magic: 0, healing: 0, health: 30, movement: 2, range: 1 },
  },
  {
    templateId: 'crossbow',
    class: 'knight',
    tier: 'tier1',
    name: 'Crossbowman',
    role: 'Standalone ranged guard',
    assetName: 'crossbow.png',
    stats: { attack: 4, defense: 3, magic: 0, healing: 0, health: 26, movement: 2, range: 4 },
  },
  {
    templateId: 'thief',
    class: 'knight',
    tier: 'tier1',
    name: 'Road Thief',
    role: 'Standalone skirmisher',
    assetName: 'thief.png',
    stats: { attack: 6, defense: 2, magic: 0, healing: 0, health: 22, movement: 4, range: 1 },
  },
  {
    templateId: 'knight-man-at-arms',
    class: 'knight',
    tier: 'tier2',
    name: 'Man-at-Arms',
    role: 'Mid-tier melee guard',
    assetName: 'knight-man-at-arms.png',
    stats: { attack: 8, defense: 8, magic: 0, healing: 0, health: 46, movement: 2, range: 1 },
  },
  {
    templateId: 'firelord',
    class: 'knight',
    tier: 'tier2',
    name: 'Firelord',
    role: 'Standalone melee assassin',
    assetName: 'firelord.png',
    stats: { attack: 11, defense: 4, magic: 4, healing: 0, health: 34, movement: 3, range: 1 },
  },
  {
    templateId: 'archer',
    class: 'knight',
    tier: 'tier2',
    name: 'Road Archer',
    role: 'Standalone ranged striker',
    assetName: 'archer.png',
    stats: { attack: 8, defense: 4, magic: 0, healing: 0, health: 32, movement: 3, range: 4 },
  },
  {
    templateId: 'knight-champion',
    class: 'knight',
    tier: 'tier3',
    name: 'Champion Knight',
    role: 'High-tier melee guard',
    assetName: 'knight-champion.png',
    stats: { attack: 12, defense: 12, magic: 0, healing: 0, health: 70, movement: 2, range: 1 },
  },
  {
    templateId: 'fallen',
    class: 'knight',
    tier: 'tier3',
    name: 'Fallen Wing Knight',
    role: 'Standalone wing-step tank',
    assetName: 'fallen.png',
    stats: { attack: 10, defense: 13, magic: 2, healing: 0, health: 76, movement: 4, range: 1 },
  },
  {
    templateId: 'mercenary',
    class: 'knight',
    tier: 'tier3',
    name: 'Grave Mercenary',
    role: 'Standalone retaliation tank',
    assetName: 'mercenary.png',
    stats: { attack: 9, defense: 16, magic: 0, healing: 0, health: 92, movement: 2, range: 1 },
  },
  {
    templateId: 'crow',
    class: 'knight',
    tier: 'tier3',
    name: 'Crowblade Assassin',
    role: 'Standalone bleed skirmisher',
    assetName: 'crow.png',
    stats: { attack: 11, defense: 6, magic: 2, healing: 0, health: 48, movement: 4, range: 1 },
  },
  {
    templateId: 'templar-initiate',
    class: 'templar',
    tier: 'tier1',
    name: 'Templar Initiate',
    role: 'Low-tier holy fighter',
    assetName: 'templar-initiate.png',
    stats: { attack: 4, defense: 7, magic: 2, healing: 0, health: 34, movement: 2, range: 1 },
  },
  {
    templateId: 'templar-crusader',
    class: 'templar',
    tier: 'tier2',
    name: 'Crusader',
    role: 'Mid-tier holy fighter',
    assetName: 'templar-crusader.png',
    stats: { attack: 7, defense: 10, magic: 3, healing: 0, health: 52, movement: 2, range: 1 },
  },
  {
    templateId: 'bell',
    class: 'templar',
    tier: 'tier2',
    name: 'Bell Warden',
    role: 'Standalone tank support',
    assetName: 'bell.png',
    stats: { attack: 5, defense: 13, magic: 3, healing: 0, health: 62, movement: 2, range: 1 },
  },
  {
    templateId: 'templar-paragon',
    class: 'templar',
    tier: 'tier3',
    name: 'Templar Paragon',
    role: 'High-tier holy fighter',
    assetName: 'templar-paragon.png',
    stats: { attack: 10, defense: 15, magic: 5, healing: 0, health: 76, movement: 2, range: 1 },
  },
  {
    templateId: 'priest-acolyte',
    class: 'priest',
    tier: 'tier1',
    name: 'Acolyte',
    role: 'Low-tier healer',
    assetName: 'priest-acolyte.png',
    stats: { attack: 2, defense: 3, magic: 3, healing: 7, health: 20, movement: 3, range: 3 },
  },
  {
    templateId: 'darkpriest',
    class: 'priest',
    tier: 'tier1',
    name: 'Dark Priest',
    role: 'Standalone shadow healer',
    assetName: 'darkpriest.png',
    stats: { attack: 3, defense: 2, magic: 4, healing: 6, health: 22, movement: 3, range: 3 },
  },
  {
    templateId: 'priest-cleric',
    class: 'priest',
    tier: 'tier2',
    name: 'Cleric',
    role: 'Mid-tier healer',
    assetName: 'priest-cleric.png',
    stats: { attack: 3, defense: 5, magic: 5, healing: 11, health: 30, movement: 3, range: 3 },
  },
  {
    templateId: 'priest-high-priest',
    class: 'priest',
    tier: 'tier3',
    name: 'High Priest',
    role: 'High-tier healer',
    assetName: 'priest-high-priest.png',
    stats: { attack: 5, defense: 7, magic: 8, healing: 17, health: 44, movement: 3, range: 4 },
  },
];

export const STANDALONE_TIER1_MINION_TEMPLATE_IDS = ['witchdoc', 'crossbow', 'thief', 'darkpriest'] as const;
export const STANDALONE_TIER2_MINION_TEMPLATE_IDS = ['enchanter', 'firelord', 'archer', 'bell'] as const;
export const STANDALONE_TIER3_MINION_TEMPLATE_IDS = ['plaugedoc', 'fallen', 'mercenary', 'crow'] as const;
export const PLAYER_RECRUIT_EXCLUDED_TEMPLATE_IDS = ['thief', 'darkpriest'] as const;
export const STANDALONE_MINION_TEMPLATE_IDS = [
  ...STANDALONE_TIER1_MINION_TEMPLATE_IDS,
  ...STANDALONE_TIER2_MINION_TEMPLATE_IDS,
  ...STANDALONE_TIER3_MINION_TEMPLATE_IDS,
] as const;

export function isStandaloneTier1MinionTemplate(templateId: string): boolean {
  return (STANDALONE_TIER1_MINION_TEMPLATE_IDS as readonly string[]).includes(templateId);
}

export function isStandaloneTier2MinionTemplate(templateId: string): boolean {
  return (STANDALONE_TIER2_MINION_TEMPLATE_IDS as readonly string[]).includes(templateId);
}

export function isStandaloneTier3MinionTemplate(templateId: string): boolean {
  return (STANDALONE_TIER3_MINION_TEMPLATE_IDS as readonly string[]).includes(templateId);
}

export function isStandaloneMinionTemplate(templateId: string): boolean {
  return (STANDALONE_MINION_TEMPLATE_IDS as readonly string[]).includes(templateId);
}

export function isPlayerRecruitableMinionTemplate(templateId: string): boolean {
  return !(PLAYER_RECRUIT_EXCLUDED_TEMPLATE_IDS as readonly string[]).includes(templateId);
}

const USERS_KEY = 'pirate_game_users';
const CURRENT_USER_KEY = 'pirate_game_current_user';
const SOCIAL_CHAT_KEY = 'wizardy_social_chat';
const MAX_ACTIVITY_LOG_ENTRIES = 30;
const MAX_SOCIAL_CHAT_MESSAGES = 120;
const STARTING_X = 36;
const STARTING_Y = 25;

function toFiniteNumber(value: unknown, fallback: number): number {
  return typeof value === 'number' && Number.isFinite(value) ? value : fallback;
}

function clampWorldCoordinate(value: unknown, max: number, fallback: number): number {
  return Math.max(0, Math.min(max, Math.floor(toFiniteNumber(value, fallback))));
}

function normalizeCharacterStats(stats?: Partial<CharacterStats> | null): CharacterStats {
  const maxHealth = Math.max(1, toFiniteNumber(stats?.maxHealth, 100));
  const health = Math.max(1, Math.min(maxHealth, toFiniteNumber(stats?.health, maxHealth)));

  return {
    armyPower: Math.max(1, toFiniteNumber(stats?.armyPower ?? stats?.attack, 5)),
    defensivePower: Math.max(1, toFiniteNumber(stats?.defensivePower ?? stats?.defense, 5)),
    morale: Math.max(1, toFiniteNumber(stats?.morale ?? stats?.speed, 5)),
    spellPower: Math.max(1, toFiniteNumber(stats?.spellPower, 3)),
    health,
    maxHealth,
    level: Math.max(1, Math.floor(toFiniteNumber(stats?.level, 1))),
    unallocatedPoints: Math.max(0, Math.floor(toFiniteNumber(stats?.unallocatedPoints, 0))),
  };
}

function normalizeEquipmentStats(stats: Equipment['stats'] = {}): Equipment['stats'] {
  const normalized: Equipment['stats'] = {};
  const armyPower = toFiniteNumber(stats.armyPower ?? stats.attack, 0);
  const defensivePower = toFiniteNumber(stats.defensivePower ?? stats.defense, 0);
  const morale = toFiniteNumber(stats.morale ?? stats.speed, 0);
  const spellPower = toFiniteNumber(stats.spellPower, 0);
  const maxHealth = toFiniteNumber(stats.maxHealth, 0);

  if (armyPower !== 0) normalized.armyPower = armyPower;
  if (defensivePower !== 0) normalized.defensivePower = defensivePower;
  if (morale !== 0) normalized.morale = morale;
  if (spellPower !== 0) normalized.spellPower = spellPower;
  if (maxHealth !== 0) normalized.maxHealth = maxHealth;

  return normalized;
}

const EQUIPMENT_SOCKET_STATS: EquipmentSocketStat[] = ['armyPower', 'defensivePower', 'morale', 'spellPower', 'maxHealth'];

function normalizeEquipmentSocketBonuses(socketBonuses: EquipmentSocketBonus[] | undefined): EquipmentSocketBonus[] {
  return (socketBonuses || [])
    .filter(bonus => EQUIPMENT_SOCKET_STATS.includes(bonus.stat))
    .map((bonus, index) => ({
      id: bonus.id || `socket-${index}-${bonus.stat}`,
      stat: bonus.stat,
      baseValue: Math.max(1, Math.floor(toFiniteNumber(bonus.baseValue, bonus.stat === 'maxHealth' ? 5 : 1))),
      upgradeLevel: Math.max(0, Math.min(10, Math.floor(toFiniteNumber(bonus.upgradeLevel, 0)))),
    }));
}

export function getEquipmentSocketLimit(item: Pick<Equipment, 'rarity'> | null | undefined): number {
  if (!item) return 0;

  switch (item.rarity) {
    case 'legendary':
      return 4;
    case 'epic':
      return 3;
    case 'rare':
      return 2;
    default:
      return 1;
  }
}

function getSocketUpgradeStep(stat: EquipmentSocketStat): number {
  return stat === 'maxHealth' ? 5 : 1;
}

export function getEquipmentSocketBonusValue(bonus: Pick<EquipmentSocketBonus, 'stat' | 'baseValue' | 'upgradeLevel'>): number {
  return toFiniteNumber(bonus.baseValue, 0) + (bonus.upgradeLevel || 0) * getSocketUpgradeStep(bonus.stat);
}

function getEquipmentSocketStatValue(item: Equipment, stat: EquipmentSocketStat): number {
  return normalizeEquipmentSocketBonuses(item.socketBonuses)
    .filter(bonus => bonus.stat === stat)
    .reduce((total, bonus) => total + getEquipmentSocketBonusValue(bonus), 0);
}

function getEquipmentStatValue(item: Equipment, stat: Exclude<keyof CharacterStats, 'health' | 'level' | 'unallocatedPoints'>): number {
  const stats = item.stats || {};

  if (stat === 'armyPower') return toFiniteNumber(stats.armyPower ?? stats.attack, 0) + getEquipmentSocketStatValue(item, 'armyPower');
  if (stat === 'defensivePower') return toFiniteNumber(stats.defensivePower ?? stats.defense, 0) + getEquipmentSocketStatValue(item, 'defensivePower');
  if (stat === 'morale') return toFiniteNumber(stats.morale ?? stats.speed, 0) + getEquipmentSocketStatValue(item, 'morale');
  if (stat === 'spellPower') return toFiniteNumber(stats.spellPower, 0) + getEquipmentSocketStatValue(item, 'spellPower');
  if (stat === 'maxHealth') return toFiniteNumber(stats.maxHealth, 0) + getEquipmentSocketStatValue(item, 'maxHealth');

  return 0;
}

type GearSetBonusSnapshot = ReturnType<typeof sumGearSetBonusStats>;

function reconcileGearSetBonuses(
  user: Pick<User, 'equipment' | 'equippedSlots' | 'gearSetBonusSnapshot'>,
  stats: CharacterStats,
): { stats: CharacterStats; snapshot: GearSetBonusSnapshot } {
  const nextSnapshot = sumGearSetBonusStats(user);
  const previousSnapshot = user.gearSetBonusSnapshot || {
    armyPower: 0,
    defensivePower: 0,
    morale: 0,
    spellPower: 0,
    maxHealth: 0,
  };
  const updatedStats = { ...stats };

  updatedStats.armyPower = (updatedStats.armyPower || 0) - previousSnapshot.armyPower + nextSnapshot.armyPower;
  updatedStats.defensivePower = (updatedStats.defensivePower || 0) - previousSnapshot.defensivePower + nextSnapshot.defensivePower;
  updatedStats.morale = (updatedStats.morale || 0) - previousSnapshot.morale + nextSnapshot.morale;
  updatedStats.spellPower = (updatedStats.spellPower || 0) - previousSnapshot.spellPower + nextSnapshot.spellPower;

  if (nextSnapshot.maxHealth !== previousSnapshot.maxHealth) {
    updatedStats.maxHealth = (updatedStats.maxHealth || 0) - previousSnapshot.maxHealth + nextSnapshot.maxHealth;
    updatedStats.health = Math.min(
      updatedStats.maxHealth,
      (updatedStats.health || 0) - previousSnapshot.maxHealth + nextSnapshot.maxHealth,
    );
  }

  return { stats: updatedStats, snapshot: nextSnapshot };
}

function toSessionUser(user: User): User {
  return { ...user, password: '' };
}

function mergeUserForStorage(storedUser: User, sessionUser: User): User {
  return {
    ...storedUser,
    ...sessionUser,
    password: sessionUser.password || storedUser.password,
  };
}

export function getUsers(): User[] {
  return readGameJson<User[]>(USERS_KEY, []);
}

function saveUsers(users: User[]): void {
  writeGameJson(USERS_KEY, users);
}

function normalizeUsername(value: string): string {
  return value.trim().toLowerCase();
}

function uniqueUsernames(usernames: string[]): string[] {
  const seen = new Set<string>();
  const result: string[] = [];

  usernames.forEach(username => {
    const normalized = normalizeUsername(username);
    if (!normalized || seen.has(normalized)) return;
    seen.add(normalized);
    result.push(username.trim());
  });

  return result;
}

function findUserIndex(users: User[], username: string): number {
  const normalized = normalizeUsername(username);
  return users.findIndex(user => normalizeUsername(user.username) === normalized);
}

function normalizePartyState(party: PartyState | undefined, fallbackUsername?: string): PartyState | undefined {
  if (!party) return undefined;
  const memberUsernames = uniqueUsernames(party.memberUsernames || []);
  const invitedUsernames = uniqueUsernames(party.invitedUsernames || [])
    .filter(username => !memberUsernames.some(member => normalizeUsername(member) === normalizeUsername(username)));
  const leaderUsername = party.leaderUsername || memberUsernames[0] || fallbackUsername || '';

  if (memberUsernames.length === 0 && !fallbackUsername) return undefined;

  return {
    leaderUsername,
    memberUsernames: memberUsernames.length > 0 ? memberUsernames.slice(0, MAX_PARTY_SIZE) : [fallbackUsername || leaderUsername],
    invitedUsernames,
    updatedAt: party.updatedAt || Date.now(),
  };
}

function normalizeSocialStateForUser(user: Pick<User, 'username' | 'social'> | null | undefined): SocialState {
  const ownUsername = user?.username || '';
  const friendMap = new Map<string, FriendRecord>();

  (user?.social?.friends || []).forEach(record => {
    const username = record.username?.trim();
    const normalized = normalizeUsername(username || '');
    if (!username || normalized === normalizeUsername(ownUsername)) return;

    friendMap.set(normalized, {
      username,
      requestedBy: record.requestedBy || username,
      requestedAt: record.requestedAt || Date.now(),
      status: record.status || 'pending',
      acceptedAt: record.acceptedAt,
    });
  });

  const party = normalizePartyState(user?.social?.party, ownUsername);
  const requests = normalizeSocialRequests(user?.social?.requests);
  const tradeSessions = normalizeTradeSessions(user?.social?.tradeSessions);
  return {
    friends: Array.from(friendMap.values()),
    ...(party ? { party } : {}),
    ...(requests.length > 0 ? { requests } : {}),
    ...(tradeSessions.length > 0 ? { tradeSessions } : {}),
  };
}

function setUserSocial(user: User, social: SocialState): User {
  return {
    ...user,
    social: normalizeSocialStateForUser({ ...user, social }),
  };
}

function persistUsersWithCurrent(users: User[], currentUsername: string): void {
  saveUsers(users);
  const current = users.find(user => normalizeUsername(user.username) === normalizeUsername(currentUsername));
  if (current) {
    writeGameJson(CURRENT_USER_KEY, toSessionUser(current));
  }
}

function removeFriendRecord(user: User, username: string): User {
  const normalized = normalizeUsername(username);
  const social = normalizeSocialStateForUser(user);
  return setUserSocial(user, {
    ...social,
    friends: social.friends.filter(record => normalizeUsername(record.username) !== normalized),
  });
}

function upsertFriendRecord(
  user: User,
  otherUsername: string,
  requestedBy: string,
  status: FriendRequestStatus,
  timestamp = Date.now()
): User {
  const normalized = normalizeUsername(otherUsername);
  const social = normalizeSocialStateForUser(user);
  const existing = social.friends.find(record => normalizeUsername(record.username) === normalized);
  const nextRecord: FriendRecord = {
    username: otherUsername.trim(),
    requestedBy,
    requestedAt: existing?.requestedAt || timestamp,
    status,
    acceptedAt: status === 'accepted' ? existing?.acceptedAt || timestamp : existing?.acceptedAt,
  };

  return setUserSocial(user, {
    ...social,
    friends: [
      nextRecord,
      ...social.friends.filter(record => normalizeUsername(record.username) !== normalized),
    ],
  });
}

function getPartyParticipantSet(party: PartyState): Set<string> {
  return new Set([party.leaderUsername, ...party.memberUsernames, ...party.invitedUsernames].map(normalizeUsername));
}

function setPartyForUsers(users: User[], party: PartyState | null, affectedUsernames: string[]): User[] {
  const affected = new Set(affectedUsernames.map(normalizeUsername));
  if (party) {
    getPartyParticipantSet(party).forEach(username => affected.add(username));
  }

  return users.map(user => {
    if (!affected.has(normalizeUsername(user.username))) return user;

    const social = normalizeSocialStateForUser(user);
    const nextSocial: SocialState = {
      ...social,
      ...(party && getPartyParticipantSet(party).has(normalizeUsername(user.username)) ? { party } : {}),
    };

    if (!party || !getPartyParticipantSet(party).has(normalizeUsername(user.username))) {
      delete nextSocial.party;
    }

    return setUserSocial(user, nextSocial);
  });
}

function upsertSocialRequestForUsers(users: User[], request: SocialRequestRecord): User[] {
  const participants = new Set([
    normalizeUsername(request.senderUsername),
    normalizeUsername(request.receiverUsername),
  ]);
  return users.map(user => {
    if (!participants.has(normalizeUsername(user.username))) return user;
    const social = getSocialState(user);
    return setUserSocial(user, {
      ...social,
      requests: normalizeSocialRequests([
        request,
        ...(social.requests || []).filter(existing => existing.id !== request.id),
      ]),
    });
  });
}

function upsertTradeSessionForUsers(users: User[], session: TradeSession): User[] {
  const participants = new Set([
    normalizeUsername(session.initiatorUsername),
    normalizeUsername(session.receiverUsername),
  ]);
  return users.map(user => {
    if (!participants.has(normalizeUsername(user.username))) return user;
    const social = getSocialState(user);
    return setUserSocial(user, {
      ...social,
      tradeSessions: normalizeTradeSessions([
        session,
        ...(social.tradeSessions || []).filter(existing => existing.id !== session.id),
      ]),
    });
  });
}

function respondToSocialRequestForUsers(
  users: User[],
  request: SocialRequestRecord,
  status: 'accepted' | 'declined',
  now = Date.now(),
): User[] {
  return users.map(user => {
    const social = getSocialState(user);
    if (!(social.requests || []).some(existing => existing.id === request.id)) return user;
    const result = respondToSocialRequest(social.requests, request.id, request.receiverUsername, status, now);
    return result.success ? setUserSocial(user, { ...social, requests: result.records }) : user;
  });
}

function setSocialRequestStatusForUsers(
  users: User[],
  requestId: string,
  status: SocialRequestStatus,
  now = Date.now(),
): User[] {
  return users.map(user => {
    const social = getSocialState(user);
    if (!(social.requests || []).some(request => request.id === requestId)) return user;
    const requests = (social.requests || []).map(request => (
      request.id === requestId ? { ...request, status, respondedAt: now } : request
    ));
    return setUserSocial(user, { ...social, requests });
  });
}

function reconcileExpiredSocialRequests(users: User[], now = Date.now()): User[] {
  let nextUsers = users.map(user => {
    const social = getSocialState(user);
    const requests = normalizeSocialRequests(social.requests, now);
    const tradeSessions = normalizeTradeSessions(social.tradeSessions, now);
    return setUserSocial(user, { ...social, requests, tradeSessions });
  });
  const expiredPartyRequests = new Map<string, SocialRequestRecord>();

  nextUsers.forEach(user => {
    getSocialState(user).requests?.forEach(request => {
      if (request.kind === 'party' && request.status === 'expired') {
        expiredPartyRequests.set(request.id, request);
      }
    });
  });

  expiredPartyRequests.forEach(request => {
    const receiver = nextUsers.find(user => normalizeUsername(user.username) === normalizeUsername(request.receiverUsername));
    const party = normalizePartyState(getSocialState(receiver).party, receiver?.username);
    if (!party?.invitedUsernames.some(username => normalizeUsername(username) === normalizeUsername(request.receiverUsername))) return;
    const requestLeader = request.payload?.partyLeaderUsername || request.senderUsername;
    if (normalizeUsername(party.leaderUsername) !== normalizeUsername(requestLeader)) return;
    const hasPendingReplacement = getSocialState(receiver).requests?.some(candidate => (
      candidate.id !== request.id
      && candidate.kind === 'party'
      && candidate.status === 'pending'
      && normalizeUsername(candidate.receiverUsername) === normalizeUsername(request.receiverUsername)
      && normalizeUsername(candidate.payload?.partyLeaderUsername || candidate.senderUsername) === normalizeUsername(party.leaderUsername)
    ));
    if (hasPendingReplacement) return;
    const nextParty: PartyState = {
      ...party,
      invitedUsernames: party.invitedUsernames.filter(username => normalizeUsername(username) !== normalizeUsername(request.receiverUsername)),
      updatedAt: now,
    };
    nextUsers = setPartyForUsers(nextUsers, nextParty, [...party.memberUsernames, ...party.invitedUsernames]);
  });

  return nextUsers;
}

function getPartyKey(party: PartyState | undefined): string | undefined {
  if (!party) return undefined;
  return uniqueUsernames(party.memberUsernames).map(normalizeUsername).sort().join('|');
}

export function getSocialState(user: Pick<User, 'username' | 'social'> | null | undefined = getCurrentUser()): SocialState {
  return normalizeSocialStateForUser(user);
}

export function getIncomingSocialRequests(
  user: Pick<User, 'username' | 'social'> | null | undefined = getCurrentUser(),
  now = Date.now(),
): SocialRequestRecord[] {
  if (!user) return [];
  return getIncomingSocialRequestRecords(getSocialState(user).requests, user.username, now);
}

export function getCurrentPlayerTradeSession(
  user: Pick<User, 'username' | 'social'> | null | undefined = getCurrentUser(),
  now = Date.now(),
): TradeSession | undefined {
  if (!user) return undefined;
  return getCurrentTradeSessionState(getSocialState(user).tradeSessions, user.username, now);
}

export function getFriendRecord(user: Pick<User, 'username' | 'social'> | null | undefined, username: string): FriendRecord | undefined {
  const normalized = normalizeUsername(username);
  return getSocialState(user).friends.find(record => normalizeUsername(record.username) === normalized);
}

export function areFriends(user: Pick<User, 'username' | 'social'> | null | undefined, username: string): boolean {
  return getFriendRecord(user, username)?.status === 'accepted';
}

export function isPartyMember(user: Pick<User, 'username' | 'social'> | null | undefined, username: string): boolean {
  return getSocialState(user).party?.memberUsernames.some(member => normalizeUsername(member) === normalizeUsername(username)) || false;
}

export function sendFriendRequest(targetUsername: string): { success: boolean; message?: string; error?: string } {
  const current = getCurrentUser();
  if (!current) return { success: false, error: 'Login required.' };

  const targetName = targetUsername.trim();
  if (!targetName) return { success: false, error: 'Enter a player name.' };
  if (normalizeUsername(targetName) === normalizeUsername(current.username)) {
    return { success: false, error: 'You cannot add yourself.' };
  }

  const users = getUsers();
  const currentIndex = findUserIndex(users, current.username);
  const targetIndex = findUserIndex(users, targetName);
  if (currentIndex === -1 || targetIndex === -1) return { success: false, error: 'Player not found.' };

  const target = users[targetIndex];
  const currentRecord = getFriendRecord(users[currentIndex], target.username);
  if (currentRecord?.status === 'accepted') return { success: false, error: 'Already friends.' };

  const timestamp = Date.now();
  const nextStatus: FriendRequestStatus =
    currentRecord?.status === 'pending' && normalizeUsername(currentRecord.requestedBy) === normalizeUsername(target.username)
      ? 'accepted'
      : 'pending';

  users[currentIndex] = upsertFriendRecord(users[currentIndex], target.username, current.username, nextStatus, timestamp);
  users[targetIndex] = upsertFriendRecord(users[targetIndex], current.username, current.username, nextStatus, timestamp);
  persistUsersWithCurrent(users, current.username);

  return {
    success: true,
    message: nextStatus === 'accepted' ? `${target.username} is now a friend.` : `Friend request sent to ${target.username}.`,
  };
}

export function acceptFriendRequest(requesterUsername: string): { success: boolean; message?: string; error?: string } {
  const current = getCurrentUser();
  if (!current) return { success: false, error: 'Login required.' };

  const users = getUsers();
  const currentIndex = findUserIndex(users, current.username);
  const requesterIndex = findUserIndex(users, requesterUsername);
  if (currentIndex === -1 || requesterIndex === -1) return { success: false, error: 'Player not found.' };

  const requester = users[requesterIndex];
  const record = getFriendRecord(users[currentIndex], requester.username);
  if (record?.status === 'accepted') return { success: false, error: 'Already friends.' };
  if (!record || record.status !== 'pending') return { success: false, error: 'No pending request.' };

  const timestamp = Date.now();
  users[currentIndex] = upsertFriendRecord(users[currentIndex], requester.username, requester.username, 'accepted', timestamp);
  users[requesterIndex] = upsertFriendRecord(users[requesterIndex], current.username, requester.username, 'accepted', timestamp);
  persistUsersWithCurrent(users, current.username);

  return { success: true, message: `${requester.username} is now a friend.` };
}

export function declineFriendRequest(requesterUsername: string): { success: boolean; message?: string; error?: string } {
  const current = getCurrentUser();
  if (!current) return { success: false, error: 'Login required.' };

  const users = getUsers();
  const currentIndex = findUserIndex(users, current.username);
  const requesterIndex = findUserIndex(users, requesterUsername);
  if (currentIndex === -1 || requesterIndex === -1) return { success: false, error: 'Player not found.' };

  users[currentIndex] = removeFriendRecord(users[currentIndex], requesterUsername);
  users[requesterIndex] = removeFriendRecord(users[requesterIndex], current.username);
  persistUsersWithCurrent(users, current.username);

  return { success: true, message: 'Friend request declined.' };
}

export function removeFriend(username: string): { success: boolean; message?: string; error?: string } {
  const current = getCurrentUser();
  if (!current) return { success: false, error: 'Login required.' };

  const users = getUsers();
  const currentIndex = findUserIndex(users, current.username);
  const otherIndex = findUserIndex(users, username);
  if (currentIndex === -1 || otherIndex === -1) return { success: false, error: 'Player not found.' };

  users[currentIndex] = removeFriendRecord(users[currentIndex], username);
  users[otherIndex] = removeFriendRecord(users[otherIndex], current.username);
  persistUsersWithCurrent(users, current.username);

  return { success: true, message: `${users[otherIndex].username} removed from friends.` };
}

export function invitePlayerToParty(targetUsername: string): { success: boolean; message?: string; error?: string } {
  const current = getCurrentUser();
  if (!current) return { success: false, error: 'Login required.' };
  const unlock = requireMultiplayerUnlock('party', current);
  if (!unlock.allowed) return { success: false, error: unlock.error };

  const users = reconcileExpiredSocialRequests(getUsers());
  const currentIndex = findUserIndex(users, current.username);
  const targetIndex = findUserIndex(users, targetUsername);
  if (currentIndex === -1 || targetIndex === -1) return { success: false, error: 'Player not found.' };

  const target = users[targetIndex];
  const targetUnlock = requireMultiplayerUnlock('party', target);
  if (!targetUnlock.allowed) {
    return { success: false, error: `${target.username} must reach level 5 before joining a party.` };
  }
  if (normalizeUsername(target.username) === normalizeUsername(current.username)) {
    return { success: false, error: 'You are already in your party.' };
  }

  const currentSocial = getSocialState(users[currentIndex]);
  const targetSocial = getSocialState(target);
  const currentParty = normalizePartyState(currentSocial.party, current.username);
  if (currentParty && !currentParty.memberUsernames.some(member => normalizeUsername(member) === normalizeUsername(current.username))) {
    return { success: false, error: 'Accept or leave your pending party invite before creating another party.' };
  }
  if (currentParty && normalizeUsername(currentParty.leaderUsername) !== normalizeUsername(current.username)) {
    return { success: false, error: 'Only the party leader can invite players.' };
  }

  const existingParty = currentParty || {
    leaderUsername: current.username,
    memberUsernames: [current.username],
    invitedUsernames: [],
    updatedAt: Date.now(),
  };

  if (targetSocial.party && getPartyParticipantSet(normalizePartyState(targetSocial.party, target.username) || targetSocial.party).has(normalizeUsername(target.username))) {
    return { success: false, error: `${target.username} already has a party or pending invite.` };
  }

  if (existingParty.memberUsernames.length >= MAX_PARTY_SIZE) {
    return { success: false, error: `Party is full (${MAX_PARTY_SIZE} players).` };
  }

  if (existingParty.invitedUsernames.some(username => normalizeUsername(username) === normalizeUsername(target.username))) {
    return { success: false, error: 'Invite already sent.' };
  }

  const nextParty: PartyState = {
    ...existingParty,
    memberUsernames: uniqueUsernames([...existingParty.memberUsernames, current.username]).slice(0, MAX_PARTY_SIZE),
    invitedUsernames: uniqueUsernames([...existingParty.invitedUsernames, target.username]),
    updatedAt: Date.now(),
  };

  const affected = [
    ...existingParty.memberUsernames,
    ...existingParty.invitedUsernames,
    target.username,
    current.username,
  ];
  const request = createSocialRequest({
    kind: 'party',
    senderUsername: current.username,
    receiverUsername: target.username,
    payload: {
      partyLeaderUsername: nextParty.leaderUsername,
      partyMemberCount: nextParty.memberUsernames.length,
    },
  });
  let nextUsers = setPartyForUsers(users, nextParty, affected);
  nextUsers = upsertSocialRequestForUsers(nextUsers, request);
  persistUsersWithCurrent(nextUsers, current.username);

  return { success: true, message: `Party invite sent to ${target.username}.` };
}

export function acceptPartyInvite(requestId?: string): { success: boolean; message?: string; error?: string } {
  const current = getCurrentUser();
  if (!current) return { success: false, error: 'Login required.' };
  const unlock = requireMultiplayerUnlock('party', current);
  if (!unlock.allowed) return { success: false, error: unlock.error };

  const users = reconcileExpiredSocialRequests(getUsers());
  const currentIndex = findUserIndex(users, current.username);
  if (currentIndex === -1) return { success: false, error: 'Player not found.' };

  const incomingRequests = getIncomingSocialRequests(users[currentIndex]);
  const request = requestId
    ? incomingRequests.find(candidate => candidate.id === requestId && candidate.kind === 'party')
    : incomingRequests.find(candidate => candidate.kind === 'party');
  if (requestId && !request) return { success: false, error: 'Party invitation expired or was withdrawn.' };

  const party = normalizePartyState(getSocialState(users[currentIndex]).party, current.username);
  if (!party || !party.invitedUsernames.some(username => normalizeUsername(username) === normalizeUsername(current.username))) {
    return { success: false, error: 'No party invite pending.' };
  }
  if (party.memberUsernames.length >= MAX_PARTY_SIZE) {
    return { success: false, error: `Party is full (${MAX_PARTY_SIZE} players).` };
  }

  const nextParty: PartyState = {
    ...party,
    memberUsernames: uniqueUsernames([...party.memberUsernames, current.username]).slice(0, MAX_PARTY_SIZE),
    invitedUsernames: party.invitedUsernames.filter(username => normalizeUsername(username) !== normalizeUsername(current.username)),
    updatedAt: Date.now(),
  };

  let nextUsers = setPartyForUsers(users, nextParty, [...party.memberUsernames, ...party.invitedUsernames]);
  if (request) nextUsers = respondToSocialRequestForUsers(nextUsers, request, 'accepted');
  persistUsersWithCurrent(nextUsers, current.username);

  return { success: true, message: 'Joined party.' };
}

export function declinePartyInvite(requestId?: string): { success: boolean; message?: string; error?: string } {
  const current = getCurrentUser();
  if (!current) return { success: false, error: 'Login required.' };
  const users = reconcileExpiredSocialRequests(getUsers());
  const currentIndex = findUserIndex(users, current.username);
  if (currentIndex === -1) return { success: false, error: 'Player not found.' };

  const incomingRequests = getIncomingSocialRequests(users[currentIndex]);
  const request = requestId
    ? incomingRequests.find(candidate => candidate.id === requestId && candidate.kind === 'party')
    : incomingRequests.find(candidate => candidate.kind === 'party');
  const party = normalizePartyState(getSocialState(users[currentIndex]).party, current.username);
  if (!party || !party.invitedUsernames.some(username => normalizeUsername(username) === normalizeUsername(current.username))) {
    return { success: false, error: 'No party invite pending.' };
  }
  if (requestId && !request) return { success: false, error: 'Party invitation expired or was withdrawn.' };

  const nextParty: PartyState = {
    ...party,
    invitedUsernames: party.invitedUsernames.filter(username => normalizeUsername(username) !== normalizeUsername(current.username)),
    updatedAt: Date.now(),
  };
  let nextUsers = setPartyForUsers(users, nextParty, [...party.memberUsernames, ...party.invitedUsernames]);
  if (request) nextUsers = respondToSocialRequestForUsers(nextUsers, request, 'declined');
  persistUsersWithCurrent(nextUsers, current.username);
  return { success: true, message: 'Party invitation declined.' };
}

export function expireCurrentSocialRequests(now = Date.now()): void {
  const current = getCurrentUser();
  if (!current) return;
  const users = getUsers();
  const nextUsers = reconcileExpiredSocialRequests(users, now);
  if (JSON.stringify(nextUsers) !== JSON.stringify(users)) {
    persistUsersWithCurrent(nextUsers, current.username);
  }
}

export function leaveParty(): { success: boolean; message?: string; error?: string } {
  const current = getCurrentUser();
  if (!current) return { success: false, error: 'Login required.' };

  const users = getUsers();
  const currentIndex = findUserIndex(users, current.username);
  if (currentIndex === -1) return { success: false, error: 'Player not found.' };

  const party = normalizePartyState(getSocialState(users[currentIndex]).party, current.username);
  if (!party) return { success: false, error: 'Not in a party.' };
  const pendingInviteRequest = getIncomingSocialRequests(users[currentIndex])
    .find(request => request.kind === 'party');
  const wasInvited = party.invitedUsernames.some(username => normalizeUsername(username) === normalizeUsername(current.username));

  const affected = [...party.memberUsernames, ...party.invitedUsernames];
  const remainingMembers = party.memberUsernames.filter(username => normalizeUsername(username) !== normalizeUsername(current.username));
  const remainingInvites = party.invitedUsernames.filter(username => normalizeUsername(username) !== normalizeUsername(current.username));

  if (remainingMembers.length === 0) {
    let nextUsers = setPartyForUsers(users, null, affected);
    if (pendingInviteRequest) {
      nextUsers = setSocialRequestStatusForUsers(nextUsers, pendingInviteRequest.id, 'declined');
    }
    persistUsersWithCurrent(nextUsers, current.username);
    return { success: true, message: wasInvited ? 'Party invitation declined.' : 'Party disbanded.' };
  }

  const nextParty: PartyState = {
    leaderUsername: normalizeUsername(party.leaderUsername) === normalizeUsername(current.username)
      ? remainingMembers[0]
      : party.leaderUsername,
    memberUsernames: remainingMembers,
    invitedUsernames: remainingInvites,
    updatedAt: Date.now(),
  };
  let nextUsers = setPartyForUsers(users, nextParty, affected);
  if (pendingInviteRequest) {
    nextUsers = setSocialRequestStatusForUsers(nextUsers, pendingInviteRequest.id, 'declined');
  }
  persistUsersWithCurrent(nextUsers, current.username);

  return { success: true, message: wasInvited ? 'Party invitation declined.' : 'Left party.' };
}

export function promotePartyMember(targetUsername: string): { success: boolean; message?: string; error?: string } {
  const current = getCurrentUser();
  if (!current) return { success: false, error: 'Login required.' };

  const users = getUsers();
  const currentIndex = findUserIndex(users, current.username);
  if (currentIndex === -1) return { success: false, error: 'Player not found.' };

  const party = normalizePartyState(getSocialState(users[currentIndex]).party, current.username);
  if (!party) return { success: false, error: 'Not in a party.' };
  if (normalizeUsername(party.leaderUsername) !== normalizeUsername(current.username)) {
    return { success: false, error: 'Only the party leader can promote.' };
  }

  const target = party.memberUsernames.find(username => normalizeUsername(username) === normalizeUsername(targetUsername));
  if (!target) return { success: false, error: 'Party member not found.' };
  if (normalizeUsername(target) === normalizeUsername(current.username)) {
    return { success: false, error: 'You are already the party leader.' };
  }

  const nextParty: PartyState = {
    ...party,
    leaderUsername: target,
    updatedAt: Date.now(),
  };
  const nextUsers = setPartyForUsers(users, nextParty, [...party.memberUsernames, ...party.invitedUsernames]);
  persistUsersWithCurrent(nextUsers, current.username);

  return { success: true, message: `${target} now leads the party.` };
}

export function removePlayerFromParty(targetUsername: string): { success: boolean; message?: string; error?: string } {
  const current = getCurrentUser();
  if (!current) return { success: false, error: 'Login required.' };

  const users = getUsers();
  const currentIndex = findUserIndex(users, current.username);
  if (currentIndex === -1) return { success: false, error: 'Player not found.' };

  const party = normalizePartyState(getSocialState(users[currentIndex]).party, current.username);
  if (!party) return { success: false, error: 'Not in a party.' };
  if (normalizeUsername(party.leaderUsername) !== normalizeUsername(current.username)) {
    return { success: false, error: 'Only the party leader can remove players.' };
  }
  if (normalizeUsername(targetUsername) === normalizeUsername(current.username)) {
    return { success: false, error: 'Use Leave Party instead.' };
  }

  const removedMember = party.memberUsernames.find(username => normalizeUsername(username) === normalizeUsername(targetUsername));
  const removedInvite = party.invitedUsernames.find(username => normalizeUsername(username) === normalizeUsername(targetUsername));
  if (!removedMember && !removedInvite) return { success: false, error: 'Player is not in this party.' };

  const nextParty: PartyState = {
    ...party,
    memberUsernames: party.memberUsernames.filter(username => normalizeUsername(username) !== normalizeUsername(targetUsername)),
    invitedUsernames: party.invitedUsernames.filter(username => normalizeUsername(username) !== normalizeUsername(targetUsername)),
    updatedAt: Date.now(),
  };
  const affected = [...party.memberUsernames, ...party.invitedUsernames, targetUsername];
  let nextUsers = setPartyForUsers(users, nextParty, affected);
  if (removedInvite) {
    const request = getSocialState(users[currentIndex]).requests?.find(candidate => (
      candidate.kind === 'party'
      && candidate.status === 'pending'
      && normalizeUsername(candidate.receiverUsername) === normalizeUsername(removedInvite)
    ));
    if (request) nextUsers = setSocialRequestStatusForUsers(nextUsers, request.id, 'cancelled');
  }
  persistUsersWithCurrent(nextUsers, current.username);

  return {
    success: true,
    message: removedMember ? `${removedMember} removed from party.` : `Invite to ${removedInvite} cancelled.`,
  };
}

export interface PlayerTradeActionResult {
  success: boolean;
  message?: string;
  error?: string;
  session?: TradeSession;
  completed?: boolean;
}

function shouldRouteTradeOnline(): boolean {
  return shouldUseOnlineTradeClient();
}

function applyMirroredTradeSession(
  session: TradeSession,
  options?: {
    socialRequest?: SocialRequestRecord;
    participants?: TradeParticipantStatePayload[];
    respondRequestId?: string;
    respondStatus?: 'accepted' | 'declined';
    cancelRequestSessionId?: string;
    now?: number;
  },
): void {
  const current = getCurrentUser();
  if (!current) return;
  const now = options?.now ?? Date.now();
  let users = getUsers();
  users = upsertTradeSessionForUsers(users, session);

  if (options?.socialRequest) {
    users = upsertSocialRequestForUsers(users, options.socialRequest);
  }

  if (options?.respondRequestId && options.respondStatus) {
    const currentIndex = findUserIndex(users, current.username);
    const request = currentIndex >= 0
      ? (getSocialState(users[currentIndex]).requests || []).find(candidate => candidate.id === options.respondRequestId)
      : undefined;
    if (request) {
      users = respondToSocialRequestForUsers(users, request, options.respondStatus, now);
    }
  }

  if (options?.cancelRequestSessionId) {
    const currentIndex = findUserIndex(users, current.username);
    const request = currentIndex >= 0
      ? (getSocialState(users[currentIndex]).requests || []).find(candidate => (
        candidate.kind === 'trade'
        && candidate.payload?.tradeSessionId === options.cancelRequestSessionId
        && candidate.status === 'pending'
      ))
      : undefined;
    if (request) {
      users = setSocialRequestStatusForUsers(users, request.id, 'cancelled', now);
    }
  }

  if (options?.participants?.length) {
    users = users.map(user => {
      const patch = options.participants!.find(
        participant => normalizeUsername(participant.username) === normalizeUsername(user.username),
      );
      if (!patch) return user;
      return {
        ...user,
        gold: patch.gold,
        inventory: patch.inventory,
        equipment: patch.equipment,
      };
    });
  }

  persistUsersWithCurrent(users, current.username);
}

function onlineTradeError(
  error: unknown,
  fallback: string,
): PlayerTradeActionResult {
  const conflict = error as Error & { session?: TradeSession; conflict?: boolean };
  if (conflict?.conflict && conflict.session) {
    applyMirroredTradeSession(conflict.session);
    return { success: false, error: conflict.message || fallback, session: conflict.session };
  }
  return {
    success: false,
    error: error instanceof Error ? error.message : fallback,
  };
}

function isTradeOfferEmpty(offer: TradeOffer): boolean {
  return offer.gold <= 0 && offer.items.length === 0 && offer.equipmentIds.length === 0;
}

function validatePlayerTradeOffer(user: User, offer: TradeOffer): string | undefined {
  if (offer.gold > user.gold) return `${user.username} no longer has enough gold for this offer.`;

  for (const offeredItem of offer.items) {
    const inventoryItem = (user.inventory || []).find(item => item.id === offeredItem.itemId);
    if (!inventoryItem || inventoryItem.quantity < offeredItem.quantity) {
      return `${user.username} no longer owns the offered item quantity.`;
    }
    const definition = getInventoryItemDefinition(offeredItem.itemId);
    if (definition?.kind === 'quest' || inventoryItem.kind === 'quest') {
      return 'Quest items cannot be traded.';
    }
  }

  const equippedIds = new Set(Object.values(user.equippedSlots || {}).filter(Boolean));
  for (const equipmentId of offer.equipmentIds) {
    if (!(user.equipment || []).some(item => item.id === equipmentId)) {
      return `${user.username} no longer owns the offered gear.`;
    }
    if (equippedIds.has(equipmentId)) return 'Equipped gear cannot be traded.';
  }

  return undefined;
}

function getTradeInventoryItems(user: User, offer: TradeOffer): InventoryItem[] {
  return offer.items.map(offeredItem => {
    const inventoryItem = (user.inventory || []).find(item => item.id === offeredItem.itemId);
    return normalizeInventoryItem({
      ...(inventoryItem || makeInventoryItem(offeredItem.itemId)),
      quantity: offeredItem.quantity,
    });
  });
}

function describeTradeOffer(user: User, offer: TradeOffer): string {
  const parts: string[] = [];
  if (offer.gold > 0) parts.push(`${offer.gold} gold`);
  offer.items.forEach(item => {
    const name = (user.inventory || []).find(candidate => candidate.id === item.itemId)?.name
      || getInventoryItemDefinition(item.itemId)?.name
      || item.itemId;
    parts.push(`${item.quantity} ${name}`);
  });
  offer.equipmentIds.forEach(id => {
    parts.push((user.equipment || []).find(item => item.id === id)?.name || 'gear');
  });
  return parts.join(', ') || 'nothing';
}

function getTradeSessionFromUser(user: User, sessionId: string, now = Date.now()): TradeSession | undefined {
  return normalizeTradeSessions(getSocialState(user).tradeSessions, now)
    .find(session => session.id === sessionId && getTradeSessionSide(session, user.username));
}

export async function requestPlayerTrade(targetUsername: string, now = Date.now()): Promise<PlayerTradeActionResult> {
  const current = getCurrentUser();
  if (!current) return { success: false, error: 'Login required.' };
  const unlock = requireMultiplayerUnlock('trading', current);
  if (!unlock.allowed) return { success: false, error: unlock.error };

  const users = reconcileExpiredSocialRequests(getUsers(), now);
  const currentIndex = findUserIndex(users, current.username);
  const targetIndex = findUserIndex(users, targetUsername);
  if (currentIndex === -1 || targetIndex === -1) return { success: false, error: 'Player not found.' };
  const target = users[targetIndex];
  if (normalizeUsername(current.username) === normalizeUsername(target.username)) {
    return { success: false, error: 'You cannot trade with yourself.' };
  }
  const targetUnlock = requireMultiplayerUnlock('trading', target);
  if (!targetUnlock.allowed) return { success: false, error: `${target.username} must reach level 4 before trading.` };

  const currentSession = getCurrentTradeSessionState(getSocialState(users[currentIndex]).tradeSessions, current.username, now);
  const targetSession = getCurrentTradeSessionState(getSocialState(target).tradeSessions, target.username, now);
  if (currentSession) return { success: false, error: 'Finish or cancel your current trade first.' };
  if (targetSession) return { success: false, error: `${target.username} is already handling another trade.` };

  if (shouldRouteTradeOnline()) {
    try {
      const session = await createOnlineTradeSession(target.username);
      const request = createSocialRequest({
        kind: 'trade',
        senderUsername: current.username,
        receiverUsername: target.username,
        payload: { tradeSessionId: session.id },
        now,
        ttlMs: TRADE_REQUEST_TTL_MS,
      });
      applyMirroredTradeSession(session, { socialRequest: request, now });
      return { success: true, message: `Trade request sent to ${target.username}.`, session };
    } catch (error) {
      return onlineTradeError(error, 'Failed to create trade session.');
    }
  }

  const session = createTradeSession(current.username, target.username, now);
  const request = createSocialRequest({
    kind: 'trade',
    senderUsername: current.username,
    receiverUsername: target.username,
    payload: { tradeSessionId: session.id },
    now,
    ttlMs: TRADE_REQUEST_TTL_MS,
  });
  let nextUsers = upsertTradeSessionForUsers(users, session);
  nextUsers = upsertSocialRequestForUsers(nextUsers, request);
  persistUsersWithCurrent(nextUsers, current.username);
  return { success: true, message: `Trade request sent to ${target.username}.`, session };
}

export async function acceptPlayerTradeRequest(requestId: string, now = Date.now()): Promise<PlayerTradeActionResult> {
  const current = getCurrentUser();
  if (!current) return { success: false, error: 'Login required.' };
  const unlock = requireMultiplayerUnlock('trading', current);
  if (!unlock.allowed) return { success: false, error: unlock.error };

  const users = reconcileExpiredSocialRequests(getUsers(), now);
  const currentIndex = findUserIndex(users, current.username);
  if (currentIndex === -1) return { success: false, error: 'Player not found.' };
  const request = getIncomingSocialRequests(users[currentIndex], now)
    .find(candidate => candidate.id === requestId && candidate.kind === 'trade');
  if (!request?.payload?.tradeSessionId) return { success: false, error: 'Trade request expired or was withdrawn.' };

  const session = getTradeSessionFromUser(users[currentIndex], request.payload.tradeSessionId, now);
  if (!session) return { success: false, error: 'Trade session not found.' };

  if (shouldRouteTradeOnline()) {
    try {
      const payload = await updateOnlineTradeSession(session.id, {
        action: 'accept',
        expectedVersion: session.version,
      });
      applyMirroredTradeSession(payload.session, {
        respondRequestId: requestId,
        respondStatus: 'accepted',
        now,
      });
      return { success: true, message: `Trade opened with ${request.senderUsername}.`, session: payload.session };
    } catch (error) {
      return onlineTradeError(error, 'Failed to accept trade request.');
    }
  }

  const activation = activateTradeSessionState(session, current.username, now);
  if (!activation.success) return { success: false, error: activation.error, session: activation.session };

  let nextUsers = respondToSocialRequestForUsers(users, request, 'accepted', now);
  nextUsers = upsertTradeSessionForUsers(nextUsers, activation.session);
  persistUsersWithCurrent(nextUsers, current.username);
  return { success: true, message: `Trade opened with ${request.senderUsername}.`, session: activation.session };
}

export async function declinePlayerTradeRequest(requestId: string, now = Date.now()): Promise<PlayerTradeActionResult> {
  const current = getCurrentUser();
  if (!current) return { success: false, error: 'Login required.' };
  const users = reconcileExpiredSocialRequests(getUsers(), now);
  const currentIndex = findUserIndex(users, current.username);
  if (currentIndex === -1) return { success: false, error: 'Player not found.' };
  const request = getIncomingSocialRequests(users[currentIndex], now)
    .find(candidate => candidate.id === requestId && candidate.kind === 'trade');
  if (!request?.payload?.tradeSessionId) return { success: false, error: 'Trade request expired or was withdrawn.' };
  const session = getTradeSessionFromUser(users[currentIndex], request.payload.tradeSessionId, now);
  if (!session) return { success: false, error: 'Trade session not found.' };

  if (shouldRouteTradeOnline()) {
    try {
      const payload = await updateOnlineTradeSession(session.id, {
        action: 'decline',
        expectedVersion: session.version,
      });
      applyMirroredTradeSession(payload.session, {
        respondRequestId: requestId,
        respondStatus: 'declined',
        now,
      });
      return { success: true, message: 'Trade request declined.', session: payload.session };
    } catch (error) {
      return onlineTradeError(error, 'Failed to decline trade request.');
    }
  }

  const cancelled = setTradeSessionStatus(session, 'cancelled', now, current.username);
  let nextUsers = respondToSocialRequestForUsers(users, request, 'declined', now);
  nextUsers = upsertTradeSessionForUsers(nextUsers, cancelled);
  persistUsersWithCurrent(nextUsers, current.username);
  return { success: true, message: 'Trade request declined.', session: cancelled };
}

export async function cancelPlayerTradeSession(sessionId: string, now = Date.now()): Promise<PlayerTradeActionResult> {
  const current = getCurrentUser();
  if (!current) return { success: false, error: 'Login required.' };
  const users = reconcileExpiredSocialRequests(getUsers(), now);
  const currentIndex = findUserIndex(users, current.username);
  if (currentIndex === -1) return { success: false, error: 'Player not found.' };
  const session = getTradeSessionFromUser(users[currentIndex], sessionId, now);
  if (!session || !['pending', 'active'].includes(session.status)) {
    return { success: false, error: 'Trade session is no longer active.' };
  }

  if (shouldRouteTradeOnline()) {
    try {
      const payload = await updateOnlineTradeSession(session.id, {
        action: 'cancel',
        expectedVersion: session.version,
      });
      applyMirroredTradeSession(payload.session, {
        cancelRequestSessionId: session.id,
        now,
      });
      return { success: true, message: 'Trade cancelled.', session: payload.session };
    } catch (error) {
      return onlineTradeError(error, 'Failed to cancel trade.');
    }
  }

  const cancelled = setTradeSessionStatus(session, 'cancelled', now, current.username);
  let nextUsers = upsertTradeSessionForUsers(users, cancelled);
  const request = getSocialState(users[currentIndex]).requests?.find(candidate => (
    candidate.kind === 'trade' && candidate.payload?.tradeSessionId === session.id && candidate.status === 'pending'
  ));
  if (request) nextUsers = setSocialRequestStatusForUsers(nextUsers, request.id, 'cancelled', now);
  persistUsersWithCurrent(nextUsers, current.username);
  return { success: true, message: 'Trade cancelled.', session: cancelled };
}

export async function updateCurrentPlayerTradeOffer(
  sessionId: string,
  offer: Partial<TradeOffer>,
  expectedVersion?: number,
  now = Date.now(),
): Promise<PlayerTradeActionResult> {
  const current = getCurrentUser();
  if (!current) return { success: false, error: 'Login required.' };
  const users = reconcileExpiredSocialRequests(getUsers(), now);
  const currentIndex = findUserIndex(users, current.username);
  if (currentIndex === -1) return { success: false, error: 'Player not found.' };
  const session = getTradeSessionFromUser(users[currentIndex], sessionId, now);
  if (!session) return { success: false, error: 'Trade session not found.' };
  if (expectedVersion !== undefined && session.version !== expectedVersion) {
    return { success: false, error: 'Trade changed. Review the latest offers before editing.', session };
  }

  if (shouldRouteTradeOnline()) {
    try {
      const payload = await updateOnlineTradeSession(session.id, {
        action: 'update_offer',
        expectedVersion: expectedVersion ?? session.version,
        offer,
      });
      applyMirroredTradeSession(payload.session, { now });
      return { success: true, message: 'Trade offer updated.', session: payload.session };
    } catch (error) {
      return onlineTradeError(error, 'Failed to update trade offer.');
    }
  }

  const update = updateTradeSessionOfferState(session, current.username, offer, now);
  if (!update.success) return { success: false, error: update.error, session: update.session };
  const ownOffer = getTradeOffer(update.session, current.username);
  const validationError = ownOffer ? validatePlayerTradeOffer(users[currentIndex], ownOffer) : 'Trade participant not found.';
  if (validationError) return { success: false, error: validationError, session };

  const nextUsers = upsertTradeSessionForUsers(users, update.session);
  persistUsersWithCurrent(nextUsers, current.username);
  return { success: true, message: 'Trade offer updated.', session: update.session };
}

export async function setCurrentPlayerTradeLock(
  sessionId: string,
  locked: boolean,
  expectedVersion?: number,
  now = Date.now(),
): Promise<PlayerTradeActionResult> {
  const current = getCurrentUser();
  if (!current) return { success: false, error: 'Login required.' };
  const users = reconcileExpiredSocialRequests(getUsers(), now);
  const currentIndex = findUserIndex(users, current.username);
  if (currentIndex === -1) return { success: false, error: 'Player not found.' };
  const session = getTradeSessionFromUser(users[currentIndex], sessionId, now);
  if (!session) return { success: false, error: 'Trade session not found.' };
  if (expectedVersion !== undefined && session.version !== expectedVersion) {
    return { success: false, error: 'Trade changed. Review the latest offers before locking.', session };
  }
  if (locked) {
    const ownOffer = getTradeOffer(session, current.username);
    const validationError = ownOffer ? validatePlayerTradeOffer(users[currentIndex], ownOffer) : 'Trade participant not found.';
    if (validationError) return { success: false, error: validationError, session };
  }

  if (shouldRouteTradeOnline()) {
    try {
      const payload = await updateOnlineTradeSession(session.id, {
        action: 'set_lock',
        expectedVersion: expectedVersion ?? session.version,
        locked,
      });
      applyMirroredTradeSession(payload.session, { now });
      return { success: true, message: locked ? 'Offer locked.' : 'Offer unlocked.', session: payload.session };
    } catch (error) {
      return onlineTradeError(error, 'Failed to update trade lock.');
    }
  }

  const update = setTradeSessionLockState(session, current.username, locked, now);
  if (!update.success) return { success: false, error: update.error, session: update.session };
  const nextUsers = upsertTradeSessionForUsers(users, update.session);
  persistUsersWithCurrent(nextUsers, current.username);
  return { success: true, message: locked ? 'Offer locked.' : 'Offer unlocked.', session: update.session };
}

export async function confirmCurrentPlayerTrade(
  sessionId: string,
  expectedVersion?: number,
  now = Date.now(),
): Promise<PlayerTradeActionResult> {
  const current = getCurrentUser();
  if (!current) return { success: false, error: 'Login required.' };
  const users = reconcileExpiredSocialRequests(getUsers(), now);
  const currentIndex = findUserIndex(users, current.username);
  if (currentIndex === -1) return { success: false, error: 'Player not found.' };
  const session = getTradeSessionFromUser(users[currentIndex], sessionId, now);
  if (!session) return { success: false, error: 'Trade session not found.' };
  if (expectedVersion !== undefined && session.version !== expectedVersion) {
    return { success: false, error: 'Trade changed. Review the latest offers before confirming.', session };
  }

  if (shouldRouteTradeOnline()) {
    try {
      const payload = await updateOnlineTradeSession(session.id, {
        action: 'confirm',
        expectedVersion: expectedVersion ?? session.version,
      });
      applyMirroredTradeSession(payload.session, {
        participants: payload.participants,
        now,
      });
      if (payload.completed || payload.duplicate) {
        return {
          success: true,
          completed: true,
          message: payload.duplicate
            ? 'Trade already completed.'
            : 'Trade completed and recorded for both commanders.',
          session: payload.session,
        };
      }
      return {
        success: true,
        message: 'Trade confirmed. Waiting for the other commander.',
        session: payload.session,
      };
    } catch (error) {
      return onlineTradeError(error, 'Failed to confirm trade.');
    }
  }

  const confirmation = confirmTradeSessionState(session, current.username, now);
  if (!confirmation.success) return { success: false, error: confirmation.error, session: confirmation.session };
  if (!confirmation.readyToComplete) {
    const nextUsers = upsertTradeSessionForUsers(users, confirmation.session);
    persistUsersWithCurrent(nextUsers, current.username);
    return { success: true, message: 'Trade confirmed. Waiting for the other commander.', session: confirmation.session };
  }

  const initiatorIndex = findUserIndex(users, confirmation.session.initiatorUsername);
  const receiverIndex = findUserIndex(users, confirmation.session.receiverUsername);
  if (initiatorIndex === -1 || receiverIndex === -1) return { success: false, error: 'Trade participant not found.' };
  const initiator = users[initiatorIndex];
  const receiver = users[receiverIndex];
  const initiatorError = validatePlayerTradeOffer(initiator, confirmation.session.initiatorOffer);
  const receiverError = validatePlayerTradeOffer(receiver, confirmation.session.receiverOffer);
  if (initiatorError || receiverError) return { success: false, error: initiatorError || receiverError, session };
  if (isTradeOfferEmpty(confirmation.session.initiatorOffer) && isTradeOfferEmpty(confirmation.session.receiverOffer)) {
    return { success: false, error: 'At least one item, gear piece, or gold offer is required.', session };
  }

  const initiatorIncomingGear = (receiver.equipment || []).filter(item => confirmation.session.receiverOffer.equipmentIds.includes(item.id));
  const receiverIncomingGear = (initiator.equipment || []).filter(item => confirmation.session.initiatorOffer.equipmentIds.includes(item.id));
  const initiatorGearAfter = getGearUsedSlots(initiator) - confirmation.session.initiatorOffer.equipmentIds.length + initiatorIncomingGear.length;
  const receiverGearAfter = getGearUsedSlots(receiver) - confirmation.session.receiverOffer.equipmentIds.length + receiverIncomingGear.length;
  if (initiatorGearAfter > getInventorySlotCapacity(initiator)) return { success: false, error: `${initiator.username} has no gear storage for this trade.`, session };
  if (receiverGearAfter > getInventorySlotCapacity(receiver)) return { success: false, error: `${receiver.username} has no gear storage for this trade.`, session };
  const initiatorOwnedGearIds = new Set((initiator.equipment || []).map(item => item.id));
  const receiverOwnedGearIds = new Set((receiver.equipment || []).map(item => item.id));
  if (initiatorIncomingGear.some(item => initiatorOwnedGearIds.has(item.id)) || receiverIncomingGear.some(item => receiverOwnedGearIds.has(item.id))) {
    return { success: false, error: 'Duplicate gear ownership detected. Trade cancelled for safety.', session };
  }

  const initiatorIncomingItems = getTradeInventoryItems(receiver, confirmation.session.receiverOffer);
  const receiverIncomingItems = getTradeInventoryItems(initiator, confirmation.session.initiatorOffer);
  const completedSession = setTradeSessionStatus(confirmation.session, 'completed', now);
  const initiatorSent = describeTradeOffer(initiator, confirmation.session.initiatorOffer);
  const receiverSent = describeTradeOffer(receiver, confirmation.session.receiverOffer);

  let nextUsers = users.map(user => {
    const isInitiator = normalizeUsername(user.username) === normalizeUsername(initiator.username);
    const isReceiver = normalizeUsername(user.username) === normalizeUsername(receiver.username);
    if (!isInitiator && !isReceiver) return user;

    const ownOffer = isInitiator ? confirmation.session.initiatorOffer : confirmation.session.receiverOffer;
    const otherOffer = isInitiator ? confirmation.session.receiverOffer : confirmation.session.initiatorOffer;
    const incomingItems = isInitiator ? initiatorIncomingItems : receiverIncomingItems;
    const incomingGear = isInitiator ? initiatorIncomingGear : receiverIncomingGear;
    const otherUsername = isInitiator ? receiver.username : initiator.username;
    let inventory = user.inventory || [];
    ownOffer.items.forEach(item => {
      inventory = removeInventoryItem(inventory, item.itemId, item.quantity);
    });
    inventory = addInventoryItems(inventory, incomingItems);
    const outgoingGear = new Set(ownOffer.equipmentIds);
    const equipment = [...(user.equipment || []).filter(item => !outgoingGear.has(item.id)), ...incomingGear];
    const rewards: RewardSummary = {
      gold: otherOffer.gold || undefined,
      goldLoss: ownOffer.gold || undefined,
      items: incomingItems.length > 0 ? incomingItems : undefined,
      equipment: incomingGear.length > 0 ? incomingGear : undefined,
    };
    return {
      ...user,
      gold: user.gold - ownOffer.gold + otherOffer.gold,
      inventory,
      equipment,
      activityLog: pushActivityEntry(user.activityLog, {
        id: `activity-player-trade-${completedSession.id}-${normalizeUsername(user.username)}`,
        type: 'item',
        title: `Trade with ${otherUsername}`,
        source: 'Player Exchange',
        completedAt: now,
        rewards,
        description: `Sent ${isInitiator ? initiatorSent : receiverSent}; received ${isInitiator ? receiverSent : initiatorSent}.`,
      }),
      ...recordUserMultiplayerEvent(
        user,
        {
          id: `trade-completed:${completedSession.id}`,
          kind: 'trade-completed',
          occurredAt: now,
          contextId: 'player-exchange',
          targetId: otherUsername,
        },
        now,
      ),
    };
  });
  nextUsers = upsertTradeSessionForUsers(nextUsers, completedSession);
  persistUsersWithCurrent(nextUsers, current.username);
  return { success: true, completed: true, message: 'Trade completed and recorded for both commanders.', session: completedSession };
}

export function getPartyMembers(user: Pick<User, 'username' | 'social'> | null | undefined = getCurrentUser()): User[] {
  const party = getSocialState(user).party;
  if (!party) return [];

  const members = new Set(party.memberUsernames.map(normalizeUsername));
  return getUsers().filter(candidate => members.has(normalizeUsername(candidate.username)));
}

export function getSocialChatMessages(
  channel: SocialChatChannel = 'global',
  user: Pick<User, 'username' | 'social'> | null | undefined = getCurrentUser()
): SocialChatMessage[] {
  const messages = readGameJson<SocialChatMessage[]>(SOCIAL_CHAT_KEY, []);
  if (channel === 'global') {
    return messages.filter(message => message.channel === 'global').slice(-MAX_SOCIAL_CHAT_MESSAGES);
  }

  const partyKey = getPartyKey(getSocialState(user).party);
  if (!partyKey) return [];
  return messages
    .filter(message => message.channel === 'party' && message.partyKey === partyKey)
    .slice(-MAX_SOCIAL_CHAT_MESSAGES);
}

export function sendSocialChatMessage(
  channel: SocialChatChannel,
  text: string
): { success: boolean; message?: string; error?: string; chat?: SocialChatMessage } {
  const current = getCurrentUser();
  if (!current) return { success: false, error: 'Login required.' };

  const trimmedText = text.trim().slice(0, 180);
  if (!trimmedText) return { success: false, error: 'Enter a message.' };

  const partyKey = channel === 'party' ? getPartyKey(getSocialState(current).party) : undefined;
  if (channel === 'party' && !partyKey) return { success: false, error: 'Join a party first.' };

  const chat: SocialChatMessage = {
    id: `chat-${Date.now()}-${Math.random().toString(16).slice(2)}`,
    channel,
    author: current.username,
    text: trimmedText,
    createdAt: Date.now(),
    ...(partyKey ? { partyKey } : {}),
  };

  const nextMessages = [...readGameJson<SocialChatMessage[]>(SOCIAL_CHAT_KEY, []), chat].slice(-MAX_SOCIAL_CHAT_MESSAGES);
  writeGameJson(SOCIAL_CHAT_KEY, nextMessages);

  return { success: true, chat };
}

export function getMinionTemplate(templateId: string): MinionTemplate | undefined {
  return MINION_TEMPLATES.find(template => template.templateId === templateId);
}

function createMinionStack(template: MinionTemplate, quantity = 1): MinionStack {
  return {
    id: `minion-${template.templateId}-${Date.now()}-${Math.random().toString(16).slice(2)}`,
    templateId: template.templateId,
    quantity: Math.max(1, quantity),
    acquiredAt: Date.now(),
  };
}

export function isMinionInjured(minion: Pick<MinionStack, 'injuredUntil'> | null | undefined, now = Date.now()): boolean {
  return Boolean(minion?.injuredUntil && minion.injuredUntil > now);
}

export function getMinionInjuryTimeRemaining(minion: Pick<MinionStack, 'injuredUntil'> | null | undefined, now = Date.now()): number {
  return Math.max(0, (minion?.injuredUntil || 0) - now);
}

export function formatMinionInjuryTime(minion: Pick<MinionStack, 'injuredUntil'> | null | undefined, now = Date.now()): string {
  const remaining = getMinionInjuryTimeRemaining(minion, now);
  if (remaining <= 0) return 'Ready';

  const totalMinutes = Math.ceil(remaining / (60 * 1000));
  const hours = Math.floor(totalMinutes / 60);
  const minutes = totalMinutes % 60;
  if (hours <= 0) return `${minutes}m`;
  if (minutes <= 0) return `${hours}h`;
  return `${hours}h ${minutes}m`;
}

function normalizeMinionRoster(minions: MinionStack[] | undefined): MinionStack[] {
  const expanded: MinionStack[] = [];
  const hasExplicitFielding = (minions || []).some(minion => minion.fielded !== undefined);
  const now = Date.now();

  (minions || []).forEach(minion => {
    const quantity = Math.max(1, Math.floor(minion.quantity || 1));
    const healed = !isMinionInjured(minion, now);

    for (let index = 0; index < quantity; index++) {
      expanded.push({
        ...minion,
        id: quantity === 1 ? minion.id : `${minion.id}-${index + 1}`,
        quantity: 1,
        injuredUntil: healed ? undefined : minion.injuredUntil,
        injuryCount: Math.max(0, Math.floor(minion.injuryCount || 0)),
        lastInjuredAt: minion.lastInjuredAt,
        rosterOrder: typeof minion.rosterOrder === 'number' ? minion.rosterOrder + index / 100 : expanded.length,
      });
    }
  });

  let fieldedCount = 0;
  return expanded
    .sort((a, b) => (a.rosterOrder || 0) - (b.rosterOrder || 0) || a.acquiredAt - b.acquiredAt)
    .map((minion, index) => {
      const injured = isMinionInjured(minion, now);
      const shouldField = !injured && (hasExplicitFielding ? Boolean(minion.fielded) : index < MAX_FIELD_MINIONS);
      const fielded = shouldField && fieldedCount < MAX_FIELD_MINIONS;
      if (fielded) fieldedCount += 1;

      return {
        ...minion,
        quantity: 1,
        fielded,
        rosterOrder: index,
      };
    });
}

function mergeMinionStacks(currentMinions: MinionStack[], incomingMinions: MinionStack[]): MinionStack[] {
  return [
    ...normalizeMinionRoster(currentMinions),
    ...normalizeMinionRoster(incomingMinions),
  ];
}

export function getOrderedMinions(user: Pick<User, 'minions'> | null | undefined): MinionStack[] {
  return normalizeMinionRoster(user?.minions);
}

export function getFieldedMinions(user: Pick<User, 'minions'> | null | undefined): MinionStack[] {
  return getOrderedMinions(user).filter(minion => minion.fielded && !isMinionInjured(minion)).slice(0, MAX_FIELD_MINIONS);
}

function pushActivityEntry(currentLog: ActivityEntry[] | undefined, entry: ActivityEntry): ActivityEntry[] {
  return [entry, ...(currentLog || [])].slice(0, MAX_ACTIVITY_LOG_ENTRIES);
}

function pushActivityEntries(currentLog: ActivityEntry[] | undefined, entries: ActivityEntry[]): ActivityEntry[] {
  if (entries.length === 0) return currentLog || [];
  return [...entries, ...(currentLog || [])].slice(0, MAX_ACTIVITY_LOG_ENTRIES);
}

export function getInventoryItemDefinition(itemId: string): InventoryItemDefinition | undefined {
  return INVENTORY_ITEM_DEFINITIONS[itemId];
}

export function makeInventoryItem(itemId: string, quantity = 1): InventoryItem {
  const definition = getInventoryItemDefinition(itemId);

  return {
    id: itemId,
    name: definition?.name || itemId,
    quantity,
    icon: definition?.icon || itemId,
    kind: definition?.kind,
    rarity: definition?.rarity,
    description: definition?.description,
    value: definition?.sellValue,
    imagePath: definition?.imagePath,
  };
}

export function getInventoryItemSellValue(item: InventoryItem): number {
  const definition = getInventoryItemDefinition(item.id);
  if (definition?.kind === 'quest' || item.kind === 'quest') return 0;
  if (definition?.sellValue) return definition.sellValue;
  if (item.value && item.value > 0) return Math.max(1, Math.floor(item.value));

  const rarity = definition?.rarity || item.rarity || 'common';
  const kind = definition?.kind || item.kind || 'material';
  const rarityBase: Record<InventoryItemRarity, number> = {
    common: 12,
    uncommon: 32,
    rare: 70,
    epic: 150,
    legendary: 320,
  };
  const kindMultiplier: Record<InventoryItemKind, number> = {
    material: 1,
    consumable: 1.35,
    container: 1.8,
    trade: 1,
    quest: 0,
  };

  return Math.max(1, Math.round(rarityBase[rarity] * kindMultiplier[kind]));
}

export function getEquipmentSellValue(item: Pick<Equipment, 'rarity' | 'socketBonuses'>): number {
  const rarityBase: Record<EquipmentRarity, number> = {
    decent: 38,
    rare: 120,
    epic: 360,
    legendary: 950,
  };
  const socketValue = (item.socketBonuses || []).reduce(
    (total, bonus) => total + 20 + bonus.upgradeLevel * 12,
    0
  );

  return rarityBase[item.rarity] + socketValue;
}

export function getMinionSellValue(minion: Pick<MinionStack, 'templateId'>): number {
  const tier = getMinionTemplate(minion.templateId)?.tier || 'tier1';
  const tierValue: Record<MinionTier, number> = {
    tier1: 65,
    tier2: 190,
    tier3: 540,
  };

  return tierValue[tier];
}

function normalizeInventoryItem(item: InventoryItem): InventoryItem {
  const definition = getInventoryItemDefinition(item.id);
  if (!definition) return item;

  return {
    ...item,
    name: definition.name,
    icon: definition.icon,
    kind: definition.kind,
    rarity: definition.rarity,
    description: definition.description,
    value: definition.sellValue,
    imagePath: definition.imagePath,
  };
}

function addInventoryItems(currentInventory: InventoryItem[], incomingItems: InventoryItem[]): InventoryItem[] {
  const updatedInventory = [...currentInventory];

  incomingItems.forEach(newItem => {
    const normalizedItem = normalizeInventoryItem(newItem);
    const existingItem = updatedInventory.find(item => item.id === newItem.id);
    if (existingItem) {
      existingItem.quantity += normalizedItem.quantity;
    } else {
      updatedInventory.push(normalizedItem);
    }
  });

  return updatedInventory.map(normalizeInventoryItem).filter(item => item.quantity > 0);
}

export function getInventorySlotCapacity(user: Pick<User, 'inventorySlots'> | null | undefined): number {
  return user?.inventorySlots || BASE_INVENTORY_SLOTS;
}

export function getGearUsedSlots(user: Pick<User, 'equipment' | 'equippedSlots'>): number {
  const equippedIds = new Set(Object.values(user.equippedSlots || {}).filter(Boolean));
  return (user.equipment || []).filter(item => !equippedIds.has(item.id)).length;
}

/** @deprecated Stackable items are unlimited; use getGearUsedSlots for satchel limits. */
export function getInventoryUsedSlots(inventory: InventoryItem[] = []): number {
  return inventory.reduce((sum, item) => sum + Math.max(0, item.quantity || 0), 0);
}

export function canAcceptGearReward(
  user: Pick<User, 'equipment' | 'equippedSlots' | 'inventorySlots'>,
  incomingCount = 1,
): boolean {
  return getGearUsedSlots(user) + incomingCount <= getInventorySlotCapacity(user);
}

export function addEquipmentWithLimit(
  currentEquipment: Equipment[],
  equippedSlots: User['equippedSlots'],
  incomingEquipment: Equipment[],
  capacity: number,
): { equipment: Equipment[]; acceptedEquipment: Equipment[]; rejectedEquipment: Equipment[] } {
  const equippedIds = new Set(Object.values(equippedSlots || {}).filter(Boolean));
  const used = currentEquipment.filter(item => !equippedIds.has(item.id)).length;
  const available = Math.max(0, capacity - used);
  const acceptedEquipment = incomingEquipment.slice(0, available);
  const rejectedEquipment = incomingEquipment.slice(available);

  return {
    equipment: [...currentEquipment, ...acceptedEquipment],
    acceptedEquipment,
    rejectedEquipment,
  };
}

export function addInventoryItemsWithLimit(
  currentInventory: InventoryItem[],
  incomingItems: InventoryItem[],
  _capacity: number
): { inventory: InventoryItem[]; acceptedItems: InventoryItem[]; rejectedItems: InventoryItem[] } {
  void _capacity;
  const acceptedItems: InventoryItem[] = [];

  incomingItems.forEach(item => {
    const requestedQuantity = Math.max(0, item.quantity || 0);
    if (requestedQuantity > 0) {
      acceptedItems.push(normalizeInventoryItem({ ...item, quantity: requestedQuantity }));
    }
  });

  return {
    inventory: addInventoryItems(currentInventory, acceptedItems),
    acceptedItems,
    rejectedItems: [],
  };
}

function removeInventoryItem(currentInventory: InventoryItem[], itemId: string, quantity: number): InventoryItem[] {
  let remaining = quantity;

  return currentInventory
    .map(item => {
      if (item.id !== itemId || remaining <= 0) return item;
      const removed = Math.min(item.quantity, remaining);
      remaining -= removed;
      return { ...item, quantity: item.quantity - removed };
    })
    .filter(item => item.quantity > 0);
}

export function getRareGemCount(user: User | null = getCurrentUser()): number {
  return user?.inventory?.find(item => item.id === 'rare-gem')?.quantity || 0;
}

function getInventoryItemCount(user: User | null | undefined, itemId?: string): number {
  if (!user || !itemId) return 0;
  return (user.inventory || [])
    .filter(item => item.id === itemId)
    .reduce((total, item) => total + (item.quantity || 0), 0);
}

function randomInt(min: number, max: number): number {
  return Math.floor(Math.random() * (max - min + 1)) + min;
}

function getInventoryDropChance(context: InventoryDropContext): number {
  switch (context) {
    case 'dungeon':
      return 0.58;
    case 'dungeonRun':
      return 0.75;
    case 'dailyRun':
      return 0.62;
    case 'nearbyBattle':
      return 0.34;
    case 'battle':
      return 0.22;
    case 'travel':
      return 0.18;
    default:
      return 0.14;
  }
}

export function rollInventoryBonusDrops(level: number, context: InventoryDropContext): InventoryItem[] {
  if (Math.random() > getInventoryDropChance(context)) return [];

  const drops: InventoryItem[] = [];
  const roll = Math.random();

  if (context === 'dungeon' || context === 'dungeonRun') {
    if (level >= 12 && roll < 0.18) drops.push(makeInventoryItem('epic-loot-chest'));
    else if (level >= 6 && roll < 0.48) drops.push(makeInventoryItem('rare-loot-chest'));
    else drops.push(makeInventoryItem('decent-loot-chest'));

    if (Math.random() < 0.28) drops.push(makeInventoryItem(level >= 8 ? 'relic-gem-sack' : 'small-gem-sack'));
    if (level >= 3 && Math.random() < 0.16) drops.push(makeInventoryItem('sealed-spell-cache'));
    return drops;
  }

  if (context === 'dailyRun') {
    drops.push(makeInventoryItem(level >= 8 && roll < 0.35 ? 'rare-loot-chest' : 'decent-loot-chest'));
    if (Math.random() < 0.22) drops.push(makeInventoryItem('small-gem-sack'));
    if (level >= 3 && Math.random() < 0.12) drops.push(makeInventoryItem('sealed-spell-cache'));
    return drops;
  }

  if (roll < 0.22) drops.push(makeInventoryItem('red-mercy-draught'));
  else if (roll < 0.4) drops.push(makeInventoryItem('small-gem-sack'));
  else if (roll < 0.58) drops.push(makeInventoryItem('black-amber'));
  else if (roll < 0.72) drops.push(makeInventoryItem(level >= 7 ? 'pilgrim-icon' : 'black-amber'));
  else if (roll < 0.9) drops.push(makeInventoryItem(level >= 5 ? 'decent-loot-chest' : 'field-surgeon-kit'));
  else drops.push(makeInventoryItem('candle-key-fragment'));

  if ((context === 'battle' || context === 'nearbyBattle') && level >= 3 && Math.random() < 0.08) {
    drops.push(makeInventoryItem('sealed-spell-cache'));
  }

  return drops;
}

function getContainerRewards(itemId: string, user: User): RewardSummary {
  const level = user.stats.level || 1;

  if (itemId === 'small-gem-sack') {
    const quantity = randomInt(1, 2);
    return {
      rareGems: quantity,
      items: [makeInventoryItem('rare-gem', quantity)],
    };
  }

  if (itemId === 'relic-gem-sack') {
    const quantity = randomInt(2, 4);
    return {
      rareGems: quantity,
      items: [makeInventoryItem('rare-gem', quantity)],
    };
  }

  if (itemId === 'sealed-spell-cache') {
    const spellIds = pickUnknownSpellRewards(user, 1);
    if (spellIds.length > 0) {
      return { spellIds };
    }

    const quantity = randomInt(2, 3);
    return {
      rareGems: quantity,
      items: [makeInventoryItem('rare-gem', quantity)],
    };
  }

  if (itemId === 'decent-loot-chest') {
    const requestedRarity: EquipmentRarity = Math.random() < 0.12 ? 'rare' : 'decent';
    const unlockedRarity = capEquipmentRarityForLevel(requestedRarity, level);
    const equipment = Math.random() < 0.72
      ? [generateEquipment(0, unlockedRarity || 'decent', 0, level)].filter(Boolean) as Equipment[]
      : [];
    const items = Math.random() < 0.42 ? [makeInventoryItem('red-mercy-draught')] : [];

    return {
      gold: randomInt(25 + level * 2, 70 + level * 5),
      items: items.length > 0 ? items : undefined,
      equipment: equipment.length > 0 ? equipment : undefined,
    };
  }

  if (itemId === 'rare-loot-chest') {
    const gemQuantity = randomInt(1, 2);
    const requestedRarity: EquipmentRarity = Math.random() < 0.15 ? 'epic' : 'rare';
    const unlockedRarity = capEquipmentRarityForLevel(requestedRarity, level);
    const equipment = unlockedRarity
      ? [generateEquipment(0, unlockedRarity, 0, level)].filter(Boolean) as Equipment[]
      : [];

    return {
      gold: randomInt(70 + level * 4, 150 + level * 7),
      rareGems: gemQuantity,
      items: [makeInventoryItem('rare-gem', gemQuantity)],
      equipment: equipment.length > 0 ? equipment : undefined,
    };
  }

  if (itemId === 'epic-loot-chest') {
    const gemQuantity = randomInt(2, 4);
    const requestedRarity: EquipmentRarity = Math.random() < 0.16 ? 'legendary' : 'epic';
    const unlockedRarity = capEquipmentRarityForLevel(requestedRarity, level);
    const equipment = unlockedRarity
      ? [generateEquipment(0, unlockedRarity, 0, level)].filter(Boolean) as Equipment[]
      : [];

    return {
      gold: randomInt(140 + level * 8, 260 + level * 10),
      rareGems: gemQuantity,
      items: [makeInventoryItem('rare-gem', gemQuantity)],
      equipment: equipment.length > 0 ? equipment : undefined,
    };
  }

  return {};
}

function formatRewardSummary(rewards: RewardSummary): string {
  const parts: string[] = [];
  if (rewards.gold) parts.push(`${rewards.gold} gold`);
  if (rewards.exp) parts.push(`${rewards.exp} XP`);
  if (rewards.healthRestore) parts.push(`${rewards.healthRestore} health`);
  rewards.items?.forEach(item => parts.push(`${item.quantity} ${item.name}`));
  rewards.equipment?.forEach(item => parts.push(item.name));
  rewards.spellIds?.forEach(spellId => parts.push(`${formatSpellId(spellId)} spell`));

  return parts.join(', ') || 'nothing';
}

function formatSpellId(spellId: string): string {
  return spellId
    .split('-')
    .map(part => part.charAt(0).toUpperCase() + part.slice(1))
    .join(' ');
}

export function activateInventoryItem(itemId: string): InventoryActionResult {
  const currentUser = getCurrentUser();
  if (!currentUser) return { success: false, error: 'No active user.' };

  const item = (currentUser.inventory || []).find(inventoryItem => inventoryItem.id === itemId);
  if (!item || item.quantity <= 0) return { success: false, error: 'Item not found.' };

  const definition = getInventoryItemDefinition(itemId);
  if (!definition || !['consumable', 'container'].includes(definition.kind)) {
    return { success: false, error: 'This item cannot be used yet.' };
  }

  const completedAt = Date.now();
  let inventoryAfterUse = removeInventoryItem(currentUser.inventory || [], itemId, 1);
  let stats = { ...currentUser.stats };
  let gold = currentUser.gold;
  let exp = currentUser.exp;
  let equipment = [...(currentUser.equipment || [])];
  let knownSpellIds = currentUser.knownSpellIds || DEFAULT_KNOWN_SPELL_IDS;
  let rewards: RewardSummary = {};

  if (definition.kind === 'consumable') {
    const restore = definition.healthRestore || 0;
    if (restore > 0 && stats.health >= stats.maxHealth) {
      return { success: false, error: 'Health is already full.' };
    }

    const restored = Math.min(restore, Math.max(0, stats.maxHealth - stats.health));
    stats = { ...stats, health: Math.min(stats.maxHealth, stats.health + restore) };
    rewards = { healthRestore: restored };
  } else {
    rewards = getContainerRewards(itemId, currentUser);
    const incomingItems = rewards.items || [];
    const incomingEquipment = rewards.equipment || [];
    const itemCapacity = getInventorySlotCapacity(currentUser);

    if (incomingEquipment.length > 0 && !canAcceptGearReward(currentUser, incomingEquipment.length)) {
      return { success: false, error: 'Gear storage is full. Sell or equip gear before opening this.' };
    }

    const itemResult = addInventoryItemsWithLimit(inventoryAfterUse, incomingItems, itemCapacity);
    inventoryAfterUse = itemResult.inventory;
    gold += rewards.gold || 0;
    exp += rewards.exp || 0;
    const gearResult = addEquipmentWithLimit(
      equipment,
      currentUser.equippedSlots || {},
      incomingEquipment,
      itemCapacity,
    );
    equipment = gearResult.equipment;
    if (rewards.spellIds?.length) {
      const spellUnlock = applySpellUnlocks({ ...currentUser, knownSpellIds }, rewards.spellIds);
      knownSpellIds = spellUnlock.knownSpellIds;
      rewards = {
        ...rewards,
        spellIds: spellUnlock.unlockedSpellIds.length > 0 ? spellUnlock.unlockedSpellIds : undefined,
      };
    }
  }

  const activity: ActivityEntry = {
    id: `activity-item-${itemId}-${completedAt}`,
    type: 'item',
    title: `${definition.useLabel || 'Use'} ${definition.name}`,
    source: 'Inventory',
    completedAt,
    rewards,
    description: `${definition.name}: ${formatRewardSummary(rewards)}.`,
  };

  updateCurrentUser({
    gold,
    exp,
    stats,
    inventory: inventoryAfterUse,
    equipment,
    knownSpellIds,
    activityLog: pushActivityEntry(currentUser.activityLog, activity),
  });

  return {
    success: true,
    message: `${definition.name}: ${formatRewardSummary(rewards)}.`,
    rewards,
  };
}

export function sellInventoryItem(itemId: string): InventoryActionResult {
  const currentUser = getCurrentUser();
  if (!currentUser) return { success: false, error: 'No active user.' };

  const item = (currentUser.inventory || []).find(inventoryItem => inventoryItem.id === itemId);
  const definition = getInventoryItemDefinition(itemId);
  if (!item || item.quantity <= 0) return { success: false, error: 'Item not found.' };
  if (definition?.kind === 'quest' || item.kind === 'quest') {
    return { success: false, error: 'Quest items cannot be sold.' };
  }

  const sellValue = getInventoryItemSellValue(item);
  if (sellValue <= 0) {
    return { success: false, error: 'This item cannot be sold.' };
  }

  const completedAt = Date.now();
  const inventory = removeInventoryItem(currentUser.inventory || [], itemId, 1);
  const itemName = definition?.name || item.name;
  const rewards: RewardSummary = { gold: sellValue };

  updateCurrentUser({
    gold: currentUser.gold + sellValue,
    inventory,
    activityLog: pushActivityEntry(currentUser.activityLog, {
      id: `activity-sell-${itemId}-${completedAt}`,
      type: 'item',
      title: `Sold ${itemName}`,
      source: 'Town Market',
      completedAt,
      rewards,
      description: `${itemName} sold for ${sellValue} gold.`,
    }),
  });

  return {
    success: true,
    message: `${itemName} sold for ${sellValue} gold.`,
    rewards,
  };
}

export function sellEquipmentItem(equipmentId: string): InventoryActionResult {
  const currentUser = getCurrentUser();
  if (!currentUser) return { success: false, error: 'No active user.' };

  const equipment = (currentUser.equipment || []).find(item => item.id === equipmentId);
  if (!equipment) return { success: false, error: 'Gear not found.' };
  if (Object.values(currentUser.equippedSlots || {}).includes(equipmentId)) {
    return { success: false, error: 'Unequip gear before selling it.' };
  }

  const sellValue = getEquipmentSellValue(equipment);
  const completedAt = Date.now();
  const rewards: RewardSummary = { gold: sellValue };

  updateCurrentUser({
    gold: currentUser.gold + sellValue,
    equipment: (currentUser.equipment || []).filter(item => item.id !== equipmentId),
    activityLog: pushActivityEntry(currentUser.activityLog, {
      id: `activity-sell-gear-${equipmentId}-${completedAt}`,
      type: 'item',
      title: `Sold ${equipment.name}`,
      source: 'Town Market',
      completedAt,
      rewards,
      description: `${equipment.name} sold for ${sellValue} gold.`,
    }),
  });

  return {
    success: true,
    message: `${equipment.name} sold for ${sellValue} gold.`,
    rewards,
  };
}

export function sellMinion(minionId: string): InventoryActionResult {
  const currentUser = getCurrentUser();
  if (!currentUser) return { success: false, error: 'No active user.' };

  const roster = normalizeMinionRoster(currentUser.minions);
  const minion = roster.find(item => item.id === minionId);
  if (!minion) return { success: false, error: 'Unit not found.' };

  const template = getMinionTemplate(minion.templateId);
  const minionName = template?.name || 'Unit';
  const fieldedIds = new Set(getFieldedMinions(currentUser).map(item => item.id));
  if (fieldedIds.has(minionId)) {
    return { success: false, error: 'Remove this unit from your active roster before selling it.' };
  }

  const sellValue = getMinionSellValue(minion);
  const completedAt = Date.now();
  const rewards: RewardSummary = { gold: sellValue };

  updateCurrentUser({
    gold: currentUser.gold + sellValue,
    minions: normalizeMinionRoster(roster.filter(item => item.id !== minionId)),
    activityLog: pushActivityEntry(currentUser.activityLog, {
      id: `activity-sell-minion-${minionId}-${completedAt}`,
      type: 'item',
      title: `Sold ${minionName}`,
      source: 'Army Broker',
      completedAt,
      rewards,
      description: `${minionName} left your army for ${sellValue} gold.`,
    }),
  });

  return {
    success: true,
    message: `${minionName} sold for ${sellValue} gold.`,
    rewards,
  };
}

export function performTradeExchange(exchangeId: string): InventoryActionResult {
  const currentUser = getCurrentUser();
  if (!currentUser) return { success: false, error: 'No active user.' };
  const unlock = requireMultiplayerUnlock('trading', currentUser);
  if (!unlock.allowed) return { success: false, error: unlock.error };

  const offer = TRADE_EXCHANGE_OFFERS.find(exchange => exchange.id === exchangeId);
  if (!offer) return { success: false, error: 'Exchange not found.' };

  const goldCost = offer.cost.gold || 0;
  if (currentUser.gold < goldCost) return { success: false, error: 'Not enough gold.' };

  for (const costItem of offer.cost.items || []) {
    if (getInventoryItemCount(currentUser, costItem.itemId) < costItem.quantity) {
      const itemName = getInventoryItemDefinition(costItem.itemId)?.name || 'required item';
      return { success: false, error: `Need ${costItem.quantity} ${itemName}.` };
    }
  }

  let inventoryAfterCost = currentUser.inventory || [];
  (offer.cost.items || []).forEach(costItem => {
    inventoryAfterCost = removeInventoryItem(inventoryAfterCost, costItem.itemId, costItem.quantity);
  });

  const incomingItems = offer.rewardItems.map(item => makeInventoryItem(item.itemId, item.quantity));
  const itemResult = addInventoryItemsWithLimit(inventoryAfterCost, incomingItems, getInventorySlotCapacity(currentUser));

  const rareGems = itemResult.acceptedItems
    .filter(item => item.id === 'rare-gem')
    .reduce((total, item) => total + item.quantity, 0);
  const rewards: RewardSummary = {
    goldLoss: goldCost || undefined,
    items: itemResult.acceptedItems,
    rareGems: rareGems || undefined,
  };
  const completedAt = Date.now();

  updateCurrentUser({
    gold: currentUser.gold - goldCost,
    inventory: itemResult.inventory,
    activityLog: pushActivityEntry(currentUser.activityLog, {
      id: `activity-trade-exchange-${exchangeId}-${completedAt}`,
      type: 'item',
      title: offer.name,
      source: 'Town Reliquary',
      completedAt,
      rewards,
      description: `${offer.name}: ${formatRewardSummary({ items: itemResult.acceptedItems })}.`,
    }),
  });

  return {
    success: true,
    message: `${offer.name}: ${formatRewardSummary({ items: itemResult.acceptedItems })}.`,
    rewards,
  };
}

function getEquippedItems(user: User): Equipment[] {
  const equippedIds = Object.values(user.equippedSlots || {}).filter(Boolean);
  return (user.equipment || []).filter(item => equippedIds.includes(item.id));
}

function hasEquippedPassive(user: User, passivePrefix: string): boolean {
  return getEquippedItems(user).some(item => item.passive?.startsWith(passivePrefix));
}

export function getTravelTimeModifier(user: Pick<User, 'stats' | 'equipment' | 'equippedSlots'>): number {
  const morale = Math.max(1, user.stats.morale ?? user.stats.speed ?? 5);
  let modifier = Math.max(0.5, 1 - morale * 0.05);

  if (hasEquippedPassive(user as User, 'Swift')) {
    modifier *= 0.75;
  }

  return Math.max(0.35, modifier);
}

const DIRECT_TRAVEL_MS_PER_TILE = 450;
const DIRECT_TRAVEL_MIN_DURATION_MS = 1200;
const DIRECT_TRAVEL_MAX_DURATION_MS = 60000;
const JOB_TRAVEL_MS_PER_TILE = DIRECT_TRAVEL_MS_PER_TILE;
const JOB_TRAVEL_MIN_DURATION_MS = 1200;
const JOB_TRAVEL_MAX_DURATION_MS = 60000;

function getScaledTravelDurationMs(
  distance: number,
  speedModifier: number,
  msPerTile: number,
  minDuration: number,
  maxDuration: number
): number {
  if (distance <= 0) return 0;
  const scaledDuration = Math.ceil(distance * msPerTile * speedModifier);
  return Math.min(maxDuration, Math.max(minDuration, scaledDuration));
}

export function getDirectTravelDurationMs(
  user: Pick<User, 'x' | 'y' | 'stats' | 'equipment' | 'equippedSlots'>,
  targetX: number,
  targetY: number
): number {
  const distance = Math.abs(targetX - user.x) + Math.abs(targetY - user.y);
  return getScaledTravelDurationMs(
    distance,
    getTravelTimeModifier(user),
    DIRECT_TRAVEL_MS_PER_TILE,
    DIRECT_TRAVEL_MIN_DURATION_MS,
    DIRECT_TRAVEL_MAX_DURATION_MS
  );
}

export function getJobTravelDurationMs(
  user: Pick<User, 'stats' | 'equipment' | 'equippedSlots'>,
  distance: number
): number {
  return getScaledTravelDurationMs(
    distance,
    getTravelTimeModifier(user),
    JOB_TRAVEL_MS_PER_TILE,
    JOB_TRAVEL_MIN_DURATION_MS,
    JOB_TRAVEL_MAX_DURATION_MS
  );
}

function getGoldRewardMultiplier(user: User): number {
  return hasEquippedPassive(user, 'Wealthy') ? 1.5 : 1;
}

function getEquipmentDropBonus(user: User): number {
  return hasEquippedPassive(user, 'Lucky') ? 10 : 0;
}

function makeTravelEventReward(user: User, event: TravelEventTemplate, durationMs: number): {
  goldDelta: number;
  healthDelta: number;
  items: InventoryItem[];
  equipment: Equipment[];
  minions: MinionStack[];
  summary: RewardSummary;
} {
  const level = user.stats.level || 1;
  const travelHours = Math.max(0.1, durationMs / 3600000);
  const goldAmount = Math.max(4, Math.round(8 + level * 2 + travelHours * 8));
  const healthAmount = Math.max(4, Math.round(6 + level + travelHours * 4));
  const rareGemQuantity = travelHours >= 2 ? 2 : 1;
  const summary: RewardSummary = {};
  let goldDelta = 0;
  let healthDelta = 0;
  const items: InventoryItem[] = [];
  const equipment: Equipment[] = [];
  const minions: MinionStack[] = [];

  switch (event.effect) {
    case 'gold':
      goldDelta = goldAmount;
      summary.gold = goldAmount;
      break;
    case 'rareGem':
      items.push(makeInventoryItem('rare-gem', rareGemQuantity));
      summary.rareGems = rareGemQuantity;
      break;
    case 'heal':
      healthDelta = healthAmount;
      summary.healthRestore = healthAmount;
      break;
    case 'equipment': {
      const rarity: EquipmentRarity = level >= 12 ? 'epic' : level >= 6 ? 'rare' : 'decent';
      const unlockedRarity = capEquipmentRarityForLevel(rarity, level);
      const item = unlockedRarity ? generateEquipment(0, unlockedRarity) : null;
      if (item) {
        equipment.push(item);
        summary.equipment = [item];
      }
      break;
    }
    case 'minion': {
      const tier: MinionTier = level >= getMinionTierMinLevel('tier3')
        ? 'tier3'
        : level >= getMinionTierMinLevel('tier2')
          ? 'tier2'
          : 'tier1';
      const minion = generateMinionDrop(0, tier, 1, level);
      if (minion) {
        minions.push(minion);
        summary.minions = [minion];
      }
      break;
    }
    case 'loseGold': {
      const loss = Math.min(user.gold, goldAmount);
      goldDelta = -loss;
      summary.goldLoss = loss;
      break;
    }
    case 'loseHealth': {
      const loss = Math.min(Math.max(0, user.stats.health - 1), healthAmount);
      healthDelta = -loss;
      summary.healthLoss = loss;
      break;
    }
    default:
      break;
  }

  if (items.length > 0) summary.items = items;

  return { goldDelta, healthDelta, items, equipment, minions, summary };
}

function resolveTravelEvents(
  user: User,
  context: {
    seed: string;
    title: string;
    source: string;
    durationMs: number;
    completedAt: number;
  }
): Partial<User> {
  const events = rollTravelEvents(context.durationMs, context.seed);
  if (events.length === 0) return {};

  let gold = user.gold;
  const stats = { ...user.stats };
  let inventory = [...(user.inventory || [])];
  let equipment = [...(user.equipment || [])];
  let minions = [...(user.minions || [])];
  const activityEntries: ActivityEntry[] = [];

  events.forEach((event, index) => {
    const reward = makeTravelEventReward(
      { ...user, gold, stats, inventory, equipment, minions },
      event,
      context.durationMs
    );
    const itemResult = addInventoryItemsWithLimit(
      inventory,
      reward.items,
      user.inventorySlots || BASE_INVENTORY_SLOTS
    );

    gold = Math.max(0, gold + reward.goldDelta);
    stats.health = Math.max(1, Math.min(stats.maxHealth, stats.health + reward.healthDelta));
    inventory = itemResult.inventory;
    const gearResult = addEquipmentWithLimit(
      equipment,
      user.equippedSlots || {},
      reward.equipment,
      getInventorySlotCapacity(user),
    );
    equipment = gearResult.equipment;
    minions = mergeMinionStacks(minions, reward.minions);

    const summary = { ...reward.summary };
    if (reward.items.length > 0) {
      summary.items = itemResult.acceptedItems.length > 0 ? itemResult.acceptedItems : undefined;
      summary.rareGems = itemResult.acceptedItems
        .filter(item => item.id === 'rare-gem')
        .reduce((total, item) => total + item.quantity, 0) || undefined;
    }

    activityEntries.push({
      id: `activity-travel-${context.seed}-${index}-${context.completedAt}`,
      type: 'travel',
      title: event.title,
      source: context.source,
      completedAt: context.completedAt - index,
      description: event.message,
      rewards: summary,
    });
  });

  return {
    gold,
    stats,
    inventory,
    equipment,
    minions,
    activityLog: pushActivityEntries(user.activityLog, activityEntries),
  };
}

export function getInventoryUpgradeQuote(user: User | null = getCurrentUser()): {
  nextLevel: number;
  goldCost: number;
  gemCost: number;
  successChance: number;
  maxed: boolean;
} {
  const currentLevel = user?.inventoryUpgradeLevel || 0;
  const nextLevel = currentLevel + 1;

  return {
    nextLevel,
    goldCost: nextLevel * 120,
    gemCost: Math.ceil(nextLevel / 2),
    successChance: Math.max(25, 95 - nextLevel * 7),
    maxed: currentLevel >= 10,
  };
}

export function upgradeInventoryCapacity(): { success: boolean; upgraded?: boolean; error?: string } {
  const currentUser = getCurrentUser();
  if (!currentUser) return { success: false, error: 'Not logged in.' };

  const quote = getInventoryUpgradeQuote(currentUser);
  if (quote.maxed) return { success: false, error: 'Inventory upgrade is already maxed.' };
  if (currentUser.gold < quote.goldCost) return { success: false, error: 'Not enough gold.' };
  if (getRareGemCount(currentUser) < quote.gemCost) return { success: false, error: 'Not enough rare gems.' };

  const upgraded = Math.random() * 100 < quote.successChance;
  const nextLevel = upgraded ? quote.nextLevel : currentUser.inventoryUpgradeLevel || 0;
  const completedAt = Date.now();

  updateCurrentUser({
    gold: currentUser.gold - quote.goldCost,
    inventory: removeInventoryItem(currentUser.inventory || [], 'rare-gem', quote.gemCost),
    inventoryUpgradeLevel: nextLevel,
    inventorySlots: BASE_INVENTORY_SLOTS + nextLevel,
    activityLog: pushActivityEntry(currentUser.activityLog, {
      id: `activity-upgrade-inventory-${completedAt}`,
      type: 'upgrade',
      title: upgraded ? `Gear storage expanded to ${BASE_INVENTORY_SLOTS + nextLevel} slots` : 'Gear storage upgrade failed',
      source: 'Arcane Ledger',
      completedAt,
      rewards: {},
    }),
  });

  return { success: true, upgraded };
}

export function getEquipmentSocketAddQuote(item: Equipment | null | undefined): {
  goldCost: number;
  gemCost: number;
  socketLimit: number;
  usedSockets: number;
  maxed: boolean;
} {
  const socketLimit = getEquipmentSocketLimit(item);
  const usedSockets = normalizeEquipmentSocketBonuses(item?.socketBonuses).length;

  return {
    goldCost: 160 + usedSockets * 140 + socketLimit * 40,
    gemCost: 1 + Math.floor(usedSockets / 2),
    socketLimit,
    usedSockets,
    maxed: usedSockets >= socketLimit,
  };
}

export function getEquipmentSocketUpgradeQuote(bonus: EquipmentSocketBonus | null | undefined): {
  nextLevel: number;
  goldCost: number;
  successChance: number;
  maxed: boolean;
} {
  const currentLevel = Math.max(0, Math.min(10, Math.floor(toFiniteNumber(bonus?.upgradeLevel, 0))));
  const nextLevel = currentLevel + 1;
  const chanceByLevel = [90, 82, 70, 48, 30, 18, 10, 6, 4, 3];

  return {
    nextLevel,
    goldCost: 90 + nextLevel * 85,
    successChance: chanceByLevel[nextLevel - 1] || 3,
    maxed: currentLevel >= 10,
  };
}

function getRandomSocketStat(slot: EquipmentSlot): EquipmentSocketStat {
  const slotPools: Record<EquipmentSlot, EquipmentSocketStat[]> = {
    sword: ['armyPower', 'armyPower', 'morale', 'spellPower'],
    shield: ['defensivePower', 'defensivePower', 'maxHealth', 'morale'],
    armor: ['defensivePower', 'maxHealth', 'maxHealth', 'morale'],
    'armor-pants': ['defensivePower', 'morale', 'maxHealth'],
    boots: ['morale', 'morale', 'defensivePower', 'armyPower'],
    gloves: ['armyPower', 'armyPower', 'spellPower', 'morale'],
    helmet: ['spellPower', 'spellPower', 'maxHealth', 'morale'],
  };
  const pool = slotPools[slot] || EQUIPMENT_SOCKET_STATS;
  return pool[Math.floor(Math.random() * pool.length)] || 'armyPower';
}

function rollSocketBaseValue(rarity: EquipmentRarity, stat: EquipmentSocketStat): number {
  const ranges: Record<EquipmentRarity, { min: number; max: number }> = {
    decent: { min: 1, max: 2 },
    rare: { min: 2, max: 3 },
    epic: { min: 3, max: 4 },
    legendary: { min: 4, max: 6 },
  };
  const range = ranges[rarity];
  const value = randomInt(range.min, range.max);
  return stat === 'maxHealth' ? value * 5 : value;
}

function applyEquippedEquipmentDiff(user: User, before: Equipment, after: Equipment): CharacterStats {
  const equipped = Object.values(user.equippedSlots || {}).includes(before.id);
  if (!equipped) return user.stats;

  const nextStats = { ...user.stats };
  const statKeys: EquipmentSocketStat[] = ['armyPower', 'defensivePower', 'morale', 'spellPower', 'maxHealth'];

  statKeys.forEach(stat => {
    const beforeValue = getEquipmentStatValue(before, stat);
    const afterValue = getEquipmentStatValue(after, stat);
    const delta = afterValue - beforeValue;
    if (!delta) return;

    if (stat === 'maxHealth') {
      nextStats.maxHealth += delta;
      nextStats.health = delta > 0
        ? nextStats.health + delta
        : Math.max(1, Math.min(nextStats.health, nextStats.maxHealth));
      return;
    }

    nextStats[stat] += delta;
  });

  return nextStats;
}

function updateEquipmentWithForgeChange(
  user: User,
  before: Equipment,
  after: Equipment,
  cost: { gold: number; gems?: number },
  activity: Omit<ActivityEntry, 'completedAt' | 'type' | 'rewards'>
): void {
  const completedAt = Date.now();

  updateCurrentUser({
    gold: user.gold - cost.gold,
    inventory: cost.gems ? removeInventoryItem(user.inventory || [], 'rare-gem', cost.gems) : user.inventory || [],
    stats: applyEquippedEquipmentDiff(user, before, after),
    equipment: (user.equipment || []).map(item => item.id === before.id ? after : item),
    activityLog: pushActivityEntry(user.activityLog, {
      ...activity,
      type: 'upgrade',
      completedAt,
      rewards: {
        goldLoss: cost.gold,
        items: cost.gems ? [makeInventoryItem('rare-gem', cost.gems)] : undefined,
      },
    }),
  });
}

export function addEquipmentSocketBonus(equipmentId: string): {
  success: boolean;
  bonus?: EquipmentSocketBonus;
  error?: string;
} {
  const currentUser = getCurrentUser();
  if (!currentUser) return { success: false, error: 'Not logged in.' };
  const unlock = requireMultiplayerUnlock('gear-upgrades', currentUser);
  if (!unlock.allowed) return { success: false, error: unlock.error };

  const equipment = (currentUser.equipment || []).find(item => item.id === equipmentId);
  if (!equipment) return { success: false, error: 'Equipment not found.' };

  const quote = getEquipmentSocketAddQuote(equipment);
  if (quote.maxed) return { success: false, error: 'All forge slots are already filled.' };
  if (currentUser.gold < quote.goldCost) return { success: false, error: 'Not enough gold.' };
  if (getRareGemCount(currentUser) < quote.gemCost) return { success: false, error: 'Not enough rare gems.' };

  const stat = getRandomSocketStat(equipment.slot);
  const bonus: EquipmentSocketBonus = {
    id: `socket-${equipment.id}-${Date.now()}-${Math.random().toString(16).slice(2)}`,
    stat,
    baseValue: rollSocketBaseValue(equipment.rarity, stat),
    upgradeLevel: 0,
  };
  const updatedEquipment: Equipment = {
    ...equipment,
    socketBonuses: [...normalizeEquipmentSocketBonuses(equipment.socketBonuses), bonus],
  };

  updateEquipmentWithForgeChange(
    currentUser,
    equipment,
    updatedEquipment,
    { gold: quote.goldCost, gems: quote.gemCost },
    {
      id: `activity-forge-socket-${equipment.id}-${Date.now()}`,
      title: `${equipment.name} gained ${stat.replace(/([A-Z])/g, ' $1').toLowerCase()}`,
      source: 'Town Blacksmith',
    }
  );

  return { success: true, bonus };
}

export function upgradeEquipmentSocketBonus(equipmentId: string, bonusId: string): {
  success: boolean;
  upgraded?: boolean;
  previousLevel?: number;
  nextLevel?: number;
  error?: string;
} {
  const currentUser = getCurrentUser();
  if (!currentUser) return { success: false, error: 'Not logged in.' };
  const unlock = requireMultiplayerUnlock('gear-upgrades', currentUser);
  if (!unlock.allowed) return { success: false, error: unlock.error };

  const equipment = (currentUser.equipment || []).find(item => item.id === equipmentId);
  if (!equipment) return { success: false, error: 'Equipment not found.' };

  const socketBonuses = normalizeEquipmentSocketBonuses(equipment.socketBonuses);
  const target = socketBonuses.find(bonus => bonus.id === bonusId);
  if (!target) return { success: false, error: 'Forge bonus not found.' };

  const quote = getEquipmentSocketUpgradeQuote(target);
  if (quote.maxed) return { success: false, error: 'This bonus is already +10.' };
  if (currentUser.gold < quote.goldCost) return { success: false, error: 'Not enough gold.' };

  const upgraded = Math.random() * 100 < quote.successChance;
  const previousLevel = target.upgradeLevel;
  const nextLevel = upgraded ? quote.nextLevel : Math.max(0, previousLevel - 1);
  const updatedBonuses = socketBonuses.map(bonus => (
    bonus.id === bonusId ? { ...bonus, upgradeLevel: nextLevel } : bonus
  ));
  const updatedEquipment: Equipment = {
    ...equipment,
    socketBonuses: updatedBonuses,
  };

  updateEquipmentWithForgeChange(
    currentUser,
    equipment,
    updatedEquipment,
    { gold: quote.goldCost },
    {
      id: `activity-forge-upgrade-${equipment.id}-${Date.now()}`,
      title: upgraded
        ? `${equipment.name} bonus upgraded to +${nextLevel}`
        : `${equipment.name} forge attempt failed`,
      source: 'Town Blacksmith',
    }
  );

  return { success: true, upgraded, previousLevel, nextLevel };
}

function saveMinionRoster(roster: MinionStack[]): void {
  updateCurrentUser({
    minions: roster.map((minion, index) => ({
      ...minion,
      quantity: 1,
      rosterOrder: index,
    })),
  });
}

export function toggleMinionFielded(minionId: string): { success: boolean; error?: string } {
  const currentUser = getCurrentUser();
  if (!currentUser) return { success: false, error: 'Not logged in.' };

  const roster = normalizeMinionRoster(currentUser.minions);
  const target = roster.find(minion => minion.id === minionId);
  if (!target) return { success: false, error: 'Minion not found.' };

  const nextFielded = !target.fielded;
  if (nextFielded && isMinionInjured(target)) {
    return { success: false, error: `${getMinionTemplate(target.templateId)?.name || 'This minion'} is injured for ${formatMinionInjuryTime(target)}.` };
  }

  const fieldedCount = roster.filter(minion => minion.fielded).length;
  if (nextFielded && fieldedCount >= MAX_FIELD_MINIONS) {
    return { success: false, error: `Only ${MAX_FIELD_MINIONS} minions can be fielded.` };
  }

  saveMinionRoster(roster.map(minion => (
    minion.id === minionId
      ? { ...minion, fielded: nextFielded }
      : minion
  )));

  return { success: true };
}

export function assignMinionToBattleSlot(minionId: string, slotIndex: number): { success: boolean; error?: string } {
  const currentUser = getCurrentUser();
  if (!currentUser) return { success: false, error: 'Not logged in.' };

  const roster = normalizeMinionRoster(currentUser.minions);
  const source = roster.find(minion => minion.id === minionId);
  if (!source) return { success: false, error: 'Minion not found.' };
  if (isMinionInjured(source)) {
    return { success: false, error: `${getMinionTemplate(source.templateId)?.name || 'This minion'} is injured for ${formatMinionInjuryTime(source)}.` };
  }

  const targetSlot = Math.max(0, Math.min(MAX_FIELD_MINIONS - 1, Math.floor(slotIndex)));
  const currentFieldedIds = roster
    .filter(minion => minion.fielded && !isMinionInjured(minion))
    .slice(0, MAX_FIELD_MINIONS)
    .map(minion => minion.id);
  const nextFieldedIds = currentFieldedIds.filter(id => id !== minionId);
  const insertIndex = Math.min(targetSlot, nextFieldedIds.length);

  if (nextFieldedIds.length >= MAX_FIELD_MINIONS) {
    nextFieldedIds.splice(targetSlot, 1, minionId);
  } else {
    nextFieldedIds.splice(insertIndex, 0, minionId);
  }

  const fieldedSet = new Set(nextFieldedIds.slice(0, MAX_FIELD_MINIONS));
  const fieldedRoster = nextFieldedIds
    .map(id => roster.find(minion => minion.id === id))
    .filter((minion): minion is MinionStack => Boolean(minion));
  const reserveRoster = roster.filter(minion => !fieldedSet.has(minion.id));

  saveMinionRoster([
    ...fieldedRoster.map(minion => ({ ...minion, fielded: true })),
    ...reserveRoster.map(minion => ({ ...minion, fielded: false })),
  ]);

  return { success: true };
}

export function reorderMinionRoster(draggedMinionId: string, targetMinionId: string): { success: boolean; error?: string } {
  const currentUser = getCurrentUser();
  if (!currentUser) return { success: false, error: 'Not logged in.' };
  if (draggedMinionId === targetMinionId) return { success: true };

  const roster = normalizeMinionRoster(currentUser.minions);
  const fromIndex = roster.findIndex(minion => minion.id === draggedMinionId);
  const toIndex = roster.findIndex(minion => minion.id === targetMinionId);
  if (fromIndex === -1 || toIndex === -1) return { success: false, error: 'Minion not found.' };

  const nextRoster = [...roster];
  const [movedMinion] = nextRoster.splice(fromIndex, 1);
  nextRoster.splice(toIndex, 0, movedMinion);
  saveMinionRoster(nextRoster);

  return { success: true };
}

export function moveMinionInRoster(minionId: string, direction: 'up' | 'down'): { success: boolean; error?: string } {
  const currentUser = getCurrentUser();
  if (!currentUser) return { success: false, error: 'Not logged in.' };

  const roster = normalizeMinionRoster(currentUser.minions);
  const currentIndex = roster.findIndex(minion => minion.id === minionId);
  if (currentIndex === -1) return { success: false, error: 'Minion not found.' };

  const nextIndex = direction === 'up' ? currentIndex - 1 : currentIndex + 1;
  if (nextIndex < 0 || nextIndex >= roster.length) return { success: true };

  const nextRoster = [...roster];
  [nextRoster[currentIndex], nextRoster[nextIndex]] = [nextRoster[nextIndex], nextRoster[currentIndex]];
  saveMinionRoster(nextRoster);

  return { success: true };
}

export function removeMinionsByIds(minionIds: string[]): void {
  if (minionIds.length === 0) return;

  const currentUser = getCurrentUser();
  if (!currentUser) return;

  updateCurrentUser({
    minions: normalizeMinionRoster(currentUser.minions).filter(minion => !minionIds.includes(minion.id)),
  });
}

export function equipBattleSpellSet(spellIds: string[]): { success: boolean; error?: string } {
  const currentUser = getCurrentUser();
  if (!currentUser) return { success: false, error: 'Not logged in.' };

  const known = new Set(currentUser.knownSpellIds || DEFAULT_KNOWN_SPELL_IDS);
  const uniqueSpellIds = Array.from(new Set(spellIds)).filter(spellId => known.has(spellId)).slice(0, 4);
  if (uniqueSpellIds.length !== 4) {
    return { success: false, error: 'Choose exactly 4 known spells.' };
  }

  updateCurrentUser({
    equippedSpellIds: uniqueSpellIds,
    knownSpellIds: Array.from(known),
  });

  return { success: true };
}

export function applyMinionBattleCasualties(
  minionIds: string[],
  source = 'Battle',
  options: { deleteImmediately?: boolean } = {}
): MinionCasualtyReport {
  const emptyReport: MinionCasualtyReport = { injuredNames: [], deadNames: [] };
  const uniqueIds = Array.from(new Set(minionIds.filter(id => id && !id.startsWith('loaned-'))));
  if (uniqueIds.length === 0) return emptyReport;

  const currentUser = getCurrentUser();
  if (!currentUser) return emptyReport;

  const casualtyIds = new Set(uniqueIds);
  const completedAt = Date.now();
  const report: MinionCasualtyReport = { injuredNames: [], deadNames: [] };
  const nextRoster = normalizeMinionRoster(currentUser.minions).reduce<MinionStack[]>((roster, minion) => {
    if (!casualtyIds.has(minion.id)) {
      roster.push(minion);
      return roster;
    }

    const template = getMinionTemplate(minion.templateId);
    const name = template?.name || minion.templateId;
    const injuryCount = Math.max(0, Math.floor(minion.injuryCount || 0));

    if (options.deleteImmediately || injuryCount >= MINION_SAFE_INJURIES) {
      report.deadNames.push(name);
      return roster;
    }

    report.injuredNames.push(name);
    roster.push({
      ...minion,
      fielded: false,
      injuryCount: injuryCount + 1,
      injuredUntil: completedAt + MINION_INJURY_DURATION_MS,
      lastInjuredAt: completedAt,
    });
    return roster;
  }, []);

  const activityLog = report.injuredNames.length > 0 || report.deadNames.length > 0
    ? pushActivityEntry(currentUser.activityLog, {
      id: `activity-casualties-${completedAt}`,
      type: 'battle',
      title: report.deadNames.length > 0 ? 'Warband Casualties' : 'Warband Injuries',
      source,
      completedAt,
      rewards: {},
      description: [
        report.injuredNames.length > 0 ? `Injured: ${report.injuredNames.join(', ')}.` : '',
        report.deadNames.length > 0 ? `Lost permanently: ${report.deadNames.join(', ')}.` : '',
      ].filter(Boolean).join(' '),
    })
    : currentUser.activityLog;

  updateCurrentUser({
    minions: nextRoster,
    activityLog,
  });

  return report;
}

export function recruitMinionsFromOffer(
  minions: MinionStack[],
  source: string,
  title = 'Accepted surrender'
): { success: boolean; error?: string } {
  const currentUser = getCurrentUser();
  if (!currentUser) return { success: false, error: 'Not logged in.' };
  if (minions.length === 0) return { success: false, error: 'No minions offered.' };
  const blockedTier = minions
    .map(minion => getMinionTemplate(minion.templateId)?.tier)
    .find((tier): tier is MinionTier => Boolean(tier && !canAcquireMinionTier(tier, currentUser.stats.level || 1)));
  if (blockedTier) {
    return { success: false, error: `${MINION_TIER_LABELS[blockedTier]} recruits require level ${getMinionTierMinLevel(blockedTier)}.` };
  }

  const completedAt = Date.now();
  updateCurrentUser({
    minions: mergeMinionStacks(currentUser.minions || [], minions),
    activityLog: pushActivityEntry(currentUser.activityLog, {
      id: `activity-recruit-${completedAt}`,
      type: 'battle',
      title,
      source,
      completedAt,
      rewards: {
        minions,
      },
    }),
  });

  return { success: true };
}

export function buyShopOffer(offerId: string, townName: string): { success: boolean; error?: string } {
  const currentUser = getCurrentUser();
  if (!currentUser) return { success: false, error: 'Not logged in.' };

  const offer = getTownShopOffers(townName).find(item => item.id === offerId);
  if (!offer) return { success: false, error: 'Offer is not available here.' };
  if (currentUser.gold < offer.price) return { success: false, error: 'Not enough gold.' };

  const nextStats = { ...currentUser.stats };
  const nextInventory = [...(currentUser.inventory || [])];
  let nextEquipment = [...(currentUser.equipment || [])];
  let nextMinions = normalizeMinionRoster(currentUser.minions);
  const rewards: RewardSummary = {};

  if (offer.kind === 'heal') {
    const restored = Math.min(offer.value || 0, nextStats.maxHealth - nextStats.health);
    nextStats.health = Math.min(nextStats.maxHealth, nextStats.health + (offer.value || 0));
    rewards.healthRestore = restored || offer.value;
  }

  if (offer.kind === 'gem') {
    const gem = makeInventoryItem('rare-gem', offer.value || 1);
    rewards.items = [gem];
  }

  if (offer.kind === 'equipment') {
    const requiredLevel = offer.rarity ? getEquipmentRarityMinLevel(offer.rarity) : 1;
    if ((currentUser.stats.level || 1) < requiredLevel) {
      return { success: false, error: `This gear rarity requires level ${requiredLevel}.` };
    }
    const item = generateEquipment(0, offer.rarity || 'decent');
    if (item) {
      if (!canAcceptGearReward(currentUser, 1)) {
        return { success: false, error: 'Gear storage is full. Upgrade storage or sell gear first.' };
      }
      nextEquipment = [...nextEquipment, item];
      rewards.equipment = [item];
    }
  }

  if (offer.kind === 'minion' && offer.minionTemplateId) {
    const template = getMinionTemplate(offer.minionTemplateId);
    if (template) {
      if (!canAcquireMinionTier(template.tier, currentUser.stats.level || 1)) {
        return { success: false, error: `${MINION_TIER_LABELS[template.tier]} recruits require level ${getMinionTierMinLevel(template.tier)}.` };
      }
      const minion = createMinionStack(template, 1);
      nextMinions = mergeMinionStacks(nextMinions, [minion]);
      rewards.minions = [minion];
    }
  }

  const completedAt = Date.now();

  updateCurrentUser({
    gold: currentUser.gold - offer.price,
    stats: nextStats,
    inventory: addInventoryItemsWithLimit(
      nextInventory,
      rewards.items || [],
      currentUser.inventorySlots || BASE_INVENTORY_SLOTS
    ).inventory,
    equipment: nextEquipment,
    minions: nextMinions,
    activityLog: pushActivityEntry(currentUser.activityLog, {
      id: `activity-shop-${offer.id}-${completedAt}`,
      type: 'shop',
      title: `Bought ${offer.name}`,
      source: townName,
      completedAt,
      rewards,
    }),
  });

  return { success: true };
}

export function recruitTownWeeklyOffer(
  offerId: string,
  townName: string,
  now = Date.now(),
): { success: boolean; minion?: MinionStack; error?: string } {
  const currentUser = getCurrentUser();
  if (!currentUser) return { success: false, error: 'Not logged in.' };

  const offer = getTownRecruitmentOffers(townName, currentUser, now)
    .find(candidate => candidate.offerId === offerId);
  if (!offer) return { success: false, error: 'That weekly recruit is not available here.' };
  if (offer.claimed) return { success: false, error: 'This weekly recruit was already signed.' };
  if (!offer.unlocked) return { success: false, error: `Requires level ${offer.minLevel}.` };
  if (currentUser.gold < offer.price) return { success: false, error: 'Not enough gold.' };

  const template = getMinionTemplate(offer.templateId);
  if (!template || !isPlayerRecruitableMinionTemplate(template.templateId)) {
    return { success: false, error: 'Recruit template is unavailable.' };
  }
  if (!canAcquireMinionTier(template.tier, currentUser.stats.level || 1)) {
    return { success: false, error: `${MINION_TIER_LABELS[template.tier]} recruits require level ${getMinionTierMinLevel(template.tier)}.` };
  }

  const minion = createMinionStack(template, 1);
  const claimedAt = now;
  const claim: TownRecruitmentClaim = {
    offerId: offer.offerId,
    weekKey: offer.weekKey,
    townName: offer.townName,
    templateId: offer.templateId,
    claimedAt,
  };
  updateCurrentUser({
    gold: currentUser.gold - offer.price,
    minions: mergeMinionStacks(currentUser.minions || [], [minion]),
    townRecruitmentClaims: normalizeTownRecruitmentClaims([
      claim,
      ...(currentUser.townRecruitmentClaims || []),
    ]),
    activityLog: pushActivityEntry(currentUser.activityLog, {
      id: `activity-weekly-recruit-${offer.offerId}-${claimedAt}`,
      type: 'shop',
      title: `Recruited ${template.name}`,
      source: `${townName} Weekly Muster`,
      completedAt: claimedAt,
      rewards: { minions: [minion] },
      description: `${MINION_TIER_LABELS[template.tier]} weekly recruitment contract claimed.`,
    }),
  });

  return { success: true, minion };
}

export function register(username: string, password: string): { success: boolean; error?: string } {
  if (!username || !password) {
    return { success: false, error: 'Username and password are required' };
  }

  if (username.length < 3) {
    return { success: false, error: 'Username must be at least 3 characters' };
  }

  if (password.length < 4) {
    return { success: false, error: 'Password must be at least 4 characters' };
  }

  const users = getUsers();
  
  if (users.find(u => u.username.toLowerCase() === username.toLowerCase())) {
    return { success: false, error: 'Username already exists' };
  }

  const newUser: User = {
    username,
    password,
    gold: 100,
    exp: 0,
    x: STARTING_X,
    y: STARTING_Y,
    inventory: [],
    equipment: [],
    equippedSlots: {},
    minions: [],
    activityLog: [],
    stats: {
      armyPower: 5,
      defensivePower: 5,
      morale: 5,
      spellPower: 3,
      health: 100,
      maxHealth: 100,
      level: 1,
      unallocatedPoints: 0,
    },
    traveling: null,
    jobQueue: [],
    selectedModel: 3,
    inventorySlots: BASE_INVENTORY_SLOTS,
    inventoryUpgradeLevel: 0,
    dailyQuests: initializeDailyQuests(),
    cityQuests: [],
    storyQuests: [],
    dailyRun: normalizeDailyRunState(),
    mpDailyDungeon: normalizeMpDailyDungeonState(),
    pvpRating: createDefaultPvpRatingState(),
    multiplayerEngagement: normalizeMultiplayerEngagementState(null, username),
    townRecruitmentClaims: [],
    knownSpellIds: DEFAULT_KNOWN_SPELL_IDS,
    equippedSpellIds: DEFAULT_EQUIPPED_SPELL_IDS,
    spellUnlockVersion: 1,
  };

  users.push(newUser);
  saveUsers(users);

  return { success: true };
}

export function login(username: string, password: string): { success: boolean; error?: string; user?: User } {
  if (!username || !password) {
    return { success: false, error: 'Username and password are required' };
  }

  const users = getUsers();
  const user = users.find(u => u.username.toLowerCase() === username.toLowerCase());

  if (!user) {
    return { success: false, error: 'User not found' };
  }

  if (user.password !== password) {
    return { success: false, error: 'Invalid password' };
  }

  // Store the session copy without the password. The users table keeps it.
  writeGameJson(CURRENT_USER_KEY, toSessionUser(user));

  return { success: true, user };
}

export function getCurrentUser(): User | null {
  if (typeof window === 'undefined') return null;
  const parsedUser = readGameJson<User | null>(CURRENT_USER_KEY, null);
  if (!parsedUser) return null;
  
  // Migration: Add inventory if it doesn't exist
  if (!parsedUser.inventory) {
    parsedUser.inventory = [];
  }
  parsedUser.inventory = parsedUser.inventory.map(normalizeInventoryItem);
  
  // Migration: Add stats if they don't exist
  if (!parsedUser.stats) {
    parsedUser.stats = {
      armyPower: 5,
      defensivePower: 5,
      morale: 5,
      spellPower: 3,
      health: 100,
      maxHealth: 100,
      level: 1,
      unallocatedPoints: 0,
    };
  }
  parsedUser.stats = normalizeCharacterStats(parsedUser.stats);
  
  // Migration: Add unallocatedPoints if it doesn't exist
  if (parsedUser.stats && parsedUser.stats.unallocatedPoints === undefined) {
    parsedUser.stats.unallocatedPoints = 0;
  }
  
  // Migration: Add traveling if it doesn't exist
  if (parsedUser.traveling === undefined) {
    parsedUser.traveling = null;
  }
  
  // Migration: Add jobQueue if it doesn't exist
  if (!parsedUser.jobQueue) {
    parsedUser.jobQueue = [];
  }

  if (
    parsedUser.x === 5 &&
    parsedUser.y === 5 &&
    !parsedUser.traveling &&
    parsedUser.jobQueue.length === 0 &&
    (parsedUser.exp || 0) === 0 &&
    (parsedUser.stats?.level || 1) === 1 &&
    (!parsedUser.activityLog || parsedUser.activityLog.length === 0)
  ) {
    parsedUser.x = STARTING_X;
    parsedUser.y = STARTING_Y;
  }

  parsedUser.x = clampWorldCoordinate(parsedUser.x, MAP_CONFIG.width - 1, STARTING_X);
  parsedUser.y = clampWorldCoordinate(parsedUser.y, MAP_CONFIG.height - 1, STARTING_Y);
  if (parsedUser.traveling) {
    parsedUser.traveling.startX = clampWorldCoordinate(parsedUser.traveling.startX, MAP_CONFIG.width - 1, parsedUser.x);
    parsedUser.traveling.startY = clampWorldCoordinate(parsedUser.traveling.startY, MAP_CONFIG.height - 1, parsedUser.y);
    parsedUser.traveling.targetX = clampWorldCoordinate(parsedUser.traveling.targetX, MAP_CONFIG.width - 1, parsedUser.x);
    parsedUser.traveling.targetY = clampWorldCoordinate(parsedUser.traveling.targetY, MAP_CONFIG.height - 1, parsedUser.y);
  }
  
  // Migration: Add selectedModel if it doesn't exist
  if (parsedUser.selectedModel === undefined) {
    parsedUser.selectedModel = 3;
  }
  if (![1, 2, 3, 4, 5, 6].includes(parsedUser.selectedModel)) {
    parsedUser.selectedModel = 3;
  }
  if (parsedUser.inventorySlots === undefined) {
    parsedUser.inventorySlots = BASE_INVENTORY_SLOTS;
  }
  if (parsedUser.inventoryUpgradeLevel === undefined) {
    parsedUser.inventoryUpgradeLevel = Math.max(0, parsedUser.inventorySlots - BASE_INVENTORY_SLOTS);
  }
  if (!parsedUser.storyQuests) {
    parsedUser.storyQuests = [];
  }
  if (!parsedUser.knownSpellIds || parsedUser.knownSpellIds.length === 0) {
    parsedUser.knownSpellIds = DEFAULT_KNOWN_SPELL_IDS;
  } else {
    parsedUser.knownSpellIds = normalizeSpellIds([...parsedUser.knownSpellIds, ...DEFAULT_KNOWN_SPELL_IDS]);
  }
  if (
    parsedUser.spellUnlockVersion !== 1 &&
    parsedUser.knownSpellIds.length >= ALL_BATTLE_SPELL_IDS.length &&
    parsedUser.storyQuests.length === 0
  ) {
    parsedUser.knownSpellIds = DEFAULT_KNOWN_SPELL_IDS;
  }
  parsedUser.spellUnlockVersion = 1;
  if (!parsedUser.equippedSpellIds || parsedUser.equippedSpellIds.length === 0) {
    parsedUser.equippedSpellIds = DEFAULT_EQUIPPED_SPELL_IDS;
  } else {
    const equippedSpellIds = parsedUser.equippedSpellIds.filter(spellId => parsedUser.knownSpellIds?.includes(spellId)).slice(0, 4);
    DEFAULT_EQUIPPED_SPELL_IDS.forEach(spellId => {
      if (equippedSpellIds.length < 4 && !equippedSpellIds.includes(spellId)) {
        equippedSpellIds.push(spellId);
      }
    });
    parsedUser.equippedSpellIds = equippedSpellIds;
  }
  
  // Migration: Update old job format to new format with travel fields
  if (parsedUser.jobQueue && parsedUser.jobQueue.length > 0) {
    parsedUser.jobQueue = parsedUser.jobQueue.map((job) => {
      if (job.targetX === undefined) {
        return {
          ...job,
          workDuration: job.duration,
          targetX: parsedUser.x,
          targetY: parsedUser.y,
          startX: parsedUser.x,
          startY: parsedUser.y,
          travelComplete: true,
          travelCompleteTime: job.startTime,
          lastMoveTime: job.startTime,
          travelEventsResolved: true,
        };
      }
      // Migration: Add travelCompleteTime field if missing
      if (job.travelCompleteTime === undefined) {
        return {
          ...job,
          travelCompleteTime: job.travelComplete ? job.startTime : null,
          travelEventsResolved: job.travelComplete ? true : job.travelEventsResolved,
        };
      }
      if (job.travelEventsResolved === undefined) {
        return {
          ...job,
          travelEventsResolved: Boolean(job.travelComplete),
        };
      }
      return job;
    }).map(job => ({
      ...job,
      startX: clampWorldCoordinate(job.startX, MAP_CONFIG.width - 1, parsedUser.x),
      startY: clampWorldCoordinate(job.startY, MAP_CONFIG.height - 1, parsedUser.y),
      targetX: clampWorldCoordinate(job.targetX, MAP_CONFIG.width - 1, parsedUser.x),
      targetY: clampWorldCoordinate(job.targetY, MAP_CONFIG.height - 1, parsedUser.y),
    }));
  }
  
  // Migration: Add equipment and equippedSlots if they don't exist
  if (!parsedUser.equipment) {
    parsedUser.equipment = [];
  } else {
    parsedUser.equipment = parsedUser.equipment.map(item => ({
      ...item,
      stats: normalizeEquipmentStats(item.stats),
      socketBonuses: normalizeEquipmentSocketBonuses(item.socketBonuses),
    }));
  }
  if (!parsedUser.equippedSlots) {
    parsedUser.equippedSlots = {};
  }
  if (!parsedUser.minions) {
    parsedUser.minions = [];
  } else {
    parsedUser.minions = normalizeMinionRoster(parsedUser.minions);
  }
  if (!parsedUser.activityLog) {
    parsedUser.activityLog = [];
  }
  if (!parsedUser.cityQuests) {
    parsedUser.cityQuests = [];
  }
  parsedUser.social = normalizeSocialStateForUser(parsedUser);
  parsedUser.dailyRun = normalizeDailyRunState(parsedUser.dailyRun, parsedUser.knownSpellIds);
  parsedUser.mpDailyDungeon = normalizeMpDailyDungeonState(parsedUser.mpDailyDungeon);
  parsedUser.pvpRating = normalizePvpRatingState(parsedUser.pvpRating);
  parsedUser.multiplayerEngagement = normalizeMultiplayerEngagementState(
    parsedUser.multiplayerEngagement,
    parsedUser.username,
  );
  parsedUser.townRecruitmentClaims = normalizeTownRecruitmentClaims(parsedUser.townRecruitmentClaims);

  parsedUser.dailyQuests = normalizeDailyQuests(parsedUser.dailyQuests);
  
  const sessionUser = toSessionUser(parsedUser);

  // Save migrations
  writeGameJson(CURRENT_USER_KEY, sessionUser);
  
  // Also update in users array
  const users = getUsers();
  const userIndex = users.findIndex(u => u.username === parsedUser.username);
  if (userIndex !== -1) {
    users[userIndex] = mergeUserForStorage(users[userIndex], parsedUser);
    saveUsers(users);
  }
  
  return sessionUser;
}

export function updateCurrentUser(updates: Partial<User>): void {
  const currentUser = getCurrentUser();
  if (!currentUser) return;

  const updatedUser = toSessionUser({ ...currentUser, ...updates });
  writeGameJson(CURRENT_USER_KEY, updatedUser);

  // Also update in users array
  const users = getUsers();
  const userIndex = users.findIndex(u => u.username === currentUser.username);
  if (userIndex !== -1) {
    users[userIndex] = mergeUserForStorage(users[userIndex], updatedUser);
    saveUsers(users);
  }

  if (isSupabaseAuthEnabled()) {
    void persistCurrentUserToSupabase();
  }
}

function recordUserMultiplayerEvent(
  user: User,
  event: MultiplayerEngagementEventInput | MultiplayerEngagementEventInputKind,
  now = Date.now(),
  baseEngagement: Partial<MultiplayerEngagementState> | null | undefined = user.multiplayerEngagement,
): {
  multiplayerEngagement: MultiplayerEngagementState;
  multiplayerChronicle: MultiplayerChronicleState;
} {
  const multiplayerEngagement = recordMultiplayerEngagementEvent(
    baseEngagement,
    user.username,
    event,
    now,
  );
  return {
    multiplayerEngagement,
    multiplayerChronicle: syncMultiplayerChronicleEvents(
      user.multiplayerChronicle,
      multiplayerEngagement.events,
    ),
  };
}

export interface MultiplayerEngagementView {
  state: MultiplayerEngagementState;
  dailyContracts: MultiplayerContractView[];
  weeklyOath: MultiplayerWeeklyOathView;
  returnTrack: MultiplayerReturnTrackView;
  regionalThreat: RegionalThreatView;
  firstCompletionBonuses: MultiplayerFirstCompletionBonusView[];
  claimableCount: number;
}

function scaleEngagementReward<T extends { rewardGold: number; rewardExp: number }>(
  reward: T,
  playerLevel: number,
  source: MultiplayerRewardSource,
): T {
  const scaled = scaleMultiplayerRewards(
    { gold: reward.rewardGold, exp: reward.rewardExp },
    playerLevel,
    source,
  );
  return { ...reward, rewardGold: scaled.gold, rewardExp: scaled.exp };
}

export function getMultiplayerEngagementView(
  user: User | null = getCurrentUser(),
  now = Date.now(),
): MultiplayerEngagementView | null {
  if (!user) return null;
  const state = normalizeMultiplayerEngagementState(user.multiplayerEngagement, user.username, now);
  const playerLevel = user.stats.level;
  const regionalThreat = scaleEngagementReward(
    getMultiplayerRegionalThreat(state, user.username, playerLevel, now),
    playerLevel,
    'pve',
  );
  const firstCompletionBonuses = getMultiplayerFirstCompletionBonuses(state, user.username, playerLevel, now)
    .map(bonus => scaleEngagementReward(bonus, playerLevel, 'pve'));
  return {
    state,
    dailyContracts: getMultiplayerDailyContracts(state, user.username, now)
      .map(contract => scaleEngagementReward(contract, playerLevel, 'contract')),
    weeklyOath: scaleEngagementReward(
      getMultiplayerWeeklyOath(state, user.username, now, playerLevel),
      playerLevel,
      'contract',
    ),
    returnTrack: getMultiplayerReturnTrack(state, user.username, now),
    regionalThreat,
    firstCompletionBonuses,
    claimableCount: getMultiplayerEngagementClaimableCount(state, user.username, now)
      + (regionalThreat.complete && !regionalThreat.claimed ? 1 : 0)
      + firstCompletionBonuses.filter(bonus => bonus.complete && !bonus.claimed).length,
  };
}

export function getMultiplayerChronicleView(
  user: User | null = getCurrentUser(),
  now = Date.now(),
): MultiplayerChronicleView | null {
  if (!user) return null;
  const engagement = normalizeMultiplayerEngagementState(user.multiplayerEngagement, user.username, now);
  return getMultiplayerChronicleViewState(user.multiplayerChronicle, engagement.events);
}

export function claimCurrentMultiplayerChronicleRank(
  rankNumber: number,
  now = Date.now(),
): { success: boolean; rewards?: RewardSummary; error?: string } {
  const currentUser = getCurrentUser();
  if (!currentUser) return { success: false, error: 'Not logged in.' };
  const engagement = normalizeMultiplayerEngagementState(
    currentUser.multiplayerEngagement,
    currentUser.username,
    now,
  );
  const result = claimMultiplayerChronicleRankState(
    currentUser.multiplayerChronicle,
    engagement.events,
    rankNumber,
  );
  if (!result.success) return { success: false, error: result.error };

  const gold = result.rank.rewards.reduce((total, reward) => total + (reward.gold || 0), 0);
  const rareGems = result.rank.rewards.reduce((total, reward) => total + (reward.rareGems || 0), 0);
  const rewardItems = result.rank.rewards.flatMap(reward => (
    reward.itemId && reward.itemQuantity
      ? [makeInventoryItem(reward.itemId, reward.itemQuantity)]
      : []
  ));
  const rewardMinions = result.rank.rewards.flatMap(reward => {
    if (!reward.minionTemplateId) return [];
    const template = getMinionTemplate(reward.minionTemplateId);
    return template ? [createMinionStack(template)] : [];
  });
  if (rareGems > 0) rewardItems.push(makeInventoryItem('rare-gem', rareGems));
  const inventoryResult = addInventoryItemsWithLimit(
    currentUser.inventory || [],
    rewardItems,
    getInventorySlotCapacity(currentUser),
  );
  const acceptedRareGems = inventoryResult.acceptedItems
    .filter(item => item.id === 'rare-gem')
    .reduce((total, item) => total + item.quantity, 0);
  const acceptedItems = inventoryResult.acceptedItems.filter(item => item.id !== 'rare-gem');
  const rewards: RewardSummary = {
    gold: gold || undefined,
    rareGems: acceptedRareGems || undefined,
    items: acceptedItems.length > 0 ? acceptedItems : undefined,
    minions: rewardMinions.length > 0 ? rewardMinions : undefined,
  };
  const entitlementLabels = result.rank.rewards
    .flatMap(reward => reward.entitlement ? [reward.entitlement.label] : []);
  const rejectedQuantity = inventoryResult.rejectedItems.reduce((total, item) => total + item.quantity, 0);

  updateCurrentUser({
    multiplayerChronicle: result.state,
    gold: currentUser.gold + gold,
    inventory: inventoryResult.inventory,
    minions: mergeMinionStacks(currentUser.minions || [], rewardMinions),
    activityLog: pushActivityEntry(currentUser.activityLog, {
      id: `activity-chronicle-rank-${result.rank.rank}-${now}`,
      type: 'quest',
      title: `Chronicle Rank ${result.rank.rank}: ${result.rank.title}`,
      source: 'The Black Pike Ledger',
      completedAt: now,
      rewards,
      description: [
        entitlementLabels.length > 0 ? `Unlocked ${entitlementLabels.join(', ')}.` : '',
        rejectedQuantity > 0 ? `${rejectedQuantity} item reward could not fit in inventory.` : '',
      ].filter(Boolean).join(' ') || 'Chronicle rank reward claimed.',
    }),
  });
  return { success: true, rewards };
}

export function touchCurrentMultiplayerEngagement(now = Date.now()): MultiplayerEngagementState | null {
  const currentUser = getCurrentUser();
  if (!currentUser) return null;
  const state = touchMultiplayerEngagementState(
    currentUser.multiplayerEngagement,
    currentUser.username,
    now,
  );
  if (JSON.stringify(state) !== JSON.stringify(currentUser.multiplayerEngagement)) {
    updateCurrentUser({ multiplayerEngagement: state });
  }
  return state;
}

export function recordCurrentMultiplayerEngagementEvent(
  event: MultiplayerEngagementEventInput | MultiplayerEngagementEventInputKind,
  now = Date.now(),
): MultiplayerEngagementState | null {
  const currentUser = getCurrentUser();
  if (!currentUser) return null;
  const progress = recordUserMultiplayerEvent(currentUser, event, now);
  updateCurrentUser(progress);
  return progress.multiplayerEngagement;
}

export function rerollCurrentMultiplayerDailyContract(
  contractId: string,
  now = Date.now(),
): { success: boolean; error?: string } {
  const currentUser = getCurrentUser();
  if (!currentUser) return { success: false, error: 'Not logged in.' };
  const result = rerollMultiplayerDailyContractState(
    currentUser.multiplayerEngagement,
    currentUser.username,
    contractId,
    now,
  );
  if (result.success) updateCurrentUser({ multiplayerEngagement: result.state });
  return { success: result.success, error: result.error };
}

export function claimCurrentMultiplayerDailyContract(
  contractId: string,
  now = Date.now(),
): { success: boolean; rewards?: RewardSummary; error?: string } {
  const currentUser = getCurrentUser();
  if (!currentUser) return { success: false, error: 'Not logged in.' };
  const result = claimMultiplayerDailyContractState(
    currentUser.multiplayerEngagement,
    currentUser.username,
    contractId,
    now,
  );
  if (!result.success || !result.contract) return { success: false, error: result.error };

  const scaledReward = scaleMultiplayerRewards(
    { gold: result.contract.rewardGold, exp: result.contract.rewardExp },
    currentUser.stats.level,
    'contract',
  );
  const rewards: RewardSummary = {
    gold: scaledReward.gold,
    exp: scaledReward.exp,
  };
  const engagementUpdates = recordUserMultiplayerEvent(
    currentUser,
    {
      id: `daily-contract-claimed:${result.contract.id}`,
      kind: 'daily-contract-claimed',
      occurredAt: now,
      contextId: 'daily-orders',
      targetId: result.contract.id,
    },
    now,
    result.state,
  );
  updateCurrentUser({
    ...engagementUpdates,
    gold: currentUser.gold + scaledReward.gold,
    exp: currentUser.exp + scaledReward.exp,
    activityLog: pushActivityEntry(currentUser.activityLog, {
      id: `activity-daily-contract-${result.contract.id}-${now}`,
      type: 'quest',
      title: result.contract.title,
      source: 'Daily Order Board',
      completedAt: now,
      rewards,
      description: 'Daily multiplayer order claimed.',
    }),
  });
  levelUp();
  return { success: true, rewards };
}

export function claimCurrentMultiplayerFirstCompletionBonus(
  bonusId: MultiplayerFirstCompletionBonusId,
  now = Date.now(),
): { success: boolean; rewards?: RewardSummary; error?: string } {
  const currentUser = getCurrentUser();
  if (!currentUser) return { success: false, error: 'Not logged in.' };
  const result = claimMultiplayerFirstCompletionBonusState(
    currentUser.multiplayerEngagement,
    currentUser.username,
    currentUser.stats.level,
    bonusId,
    now,
  );
  if (!result.success) return { success: false, error: result.error };

  const scaledReward = scaleMultiplayerRewards(
    { gold: result.bonus.rewardGold, exp: result.bonus.rewardExp },
    currentUser.stats.level,
    'pve',
  );
  const rewards: RewardSummary = {
    gold: scaledReward.gold,
    exp: scaledReward.exp,
  };
  updateCurrentUser({
    multiplayerEngagement: result.state,
    gold: currentUser.gold + scaledReward.gold,
    exp: currentUser.exp + scaledReward.exp,
    activityLog: pushActivityEntry(currentUser.activityLog, {
      id: `activity-first-completion-${result.bonus.id}-${now}`,
      type: 'quest',
      title: result.bonus.title,
      source: 'First Completion Board',
      completedAt: now,
      rewards,
      description: 'Daily first-completion bonus claimed.',
    }),
  });
  levelUp();
  return { success: true, rewards };
}

export function claimCurrentMultiplayerWeeklyOath(
  now = Date.now(),
): { success: boolean; rewards?: RewardSummary; error?: string } {
  const currentUser = getCurrentUser();
  if (!currentUser) return { success: false, error: 'Not logged in.' };
  const result = claimMultiplayerWeeklyOathState(
    currentUser.multiplayerEngagement,
    currentUser.username,
    now,
    currentUser.stats.level,
  );
  if (!result.success) return { success: false, error: result.error };

  const scaledReward = scaleMultiplayerRewards(
    { gold: result.oath.rewardGold, exp: result.oath.rewardExp },
    currentUser.stats.level,
    'contract',
  );
  const weeklyRecruit = generateMinionDrop(
    0,
    result.oath.rewardMinionTier,
    1,
    currentUser.stats.level || 1,
  );
  const recruitRewards = weeklyRecruit ? [weeklyRecruit] : [];
  const rewards: RewardSummary = {
    gold: scaledReward.gold,
    exp: scaledReward.exp,
    minions: recruitRewards.length > 0 ? recruitRewards : undefined,
  };
  const engagementUpdates = recordUserMultiplayerEvent(
    currentUser,
    {
      id: `weekly-oath-claimed:${result.oath.id}`,
      kind: 'weekly-oath-claimed',
      occurredAt: now,
      contextId: 'weekly-oath',
      targetId: result.oath.id,
    },
    now,
    result.state,
  );
  updateCurrentUser({
    ...engagementUpdates,
    gold: currentUser.gold + scaledReward.gold,
    exp: currentUser.exp + scaledReward.exp,
    minions: mergeMinionStacks(currentUser.minions || [], recruitRewards),
    activityLog: pushActivityEntry(currentUser.activityLog, {
      id: `activity-weekly-oath-${result.oath.id}-${now}`,
      type: 'quest',
      title: result.oath.title,
      source: 'Weekly Faction Oath',
      completedAt: now,
      rewards,
      description: 'Weekly multiplayer contribution oath claimed.',
    }),
  });
  levelUp();
  return { success: true, rewards };
}

export function claimCurrentMultiplayerRegionalThreat(
  now = Date.now(),
): { success: boolean; rewards?: RewardSummary; error?: string } {
  const currentUser = getCurrentUser();
  if (!currentUser) return { success: false, error: 'Not logged in.' };
  const result = claimMultiplayerRegionalThreatState(
    currentUser.multiplayerEngagement,
    currentUser.username,
    currentUser.stats.level,
    now,
  );
  if (!result.success) return { success: false, error: result.error };

  const scaledReward = scaleMultiplayerRewards(
    { gold: result.threat.rewardGold, exp: result.threat.rewardExp },
    currentUser.stats.level,
    'pve',
  );

  const gemResult = addInventoryItemsWithLimit(
    currentUser.inventory || [],
    result.threat.rewardRareGems > 0 ? [makeInventoryItem('rare-gem', result.threat.rewardRareGems)] : [],
    getInventorySlotCapacity(currentUser),
  );
  const acceptedRareGems = gemResult.acceptedItems
    .filter(item => item.id === 'rare-gem')
    .reduce((total, item) => total + item.quantity, 0);
  const rewards: RewardSummary = {
    gold: scaledReward.gold,
    exp: scaledReward.exp,
    rareGems: acceptedRareGems || undefined,
  };
  const engagementUpdates = recordUserMultiplayerEvent(
    currentUser,
    {
      id: `regional-threat-claimed:${result.threat.instanceId}`,
      kind: 'regional-threat-claimed',
      occurredAt: now,
      contextId: result.threat.regionId,
      targetId: result.threat.instanceId,
    },
    now,
    result.state,
  );
  updateCurrentUser({
    ...engagementUpdates,
    gold: currentUser.gold + scaledReward.gold,
    exp: currentUser.exp + scaledReward.exp,
    inventory: gemResult.inventory,
    activityLog: pushActivityEntry(currentUser.activityLog, {
      id: `activity-regional-threat-${result.threat.instanceId}-${now}`,
      type: 'quest',
      title: result.threat.title,
      source: 'Regional Threat Board',
      completedAt: now,
      rewards,
      description: `${result.threat.regionName} threat reward claimed.`,
    }),
  });
  levelUp();
  return { success: true, rewards };
}

export function dismissCurrentMultiplayerReturningBriefing(now = Date.now()): void {
  const currentUser = getCurrentUser();
  if (!currentUser) return;
  updateCurrentUser({
    multiplayerEngagement: dismissMultiplayerReturningBriefingState(
      currentUser.multiplayerEngagement,
      currentUser.username,
      now,
    ),
  });
}

export function logout(): void {
  if (isSupabaseAuthEnabled()) {
    void logoutSupabase();
    return;
  }

  removeGameStorageItem(CURRENT_USER_KEY);
}

export function getPlayersAtLocation(x: number, y: number): User[] {
  const usersByName = new Map<string, User>();

  getUsers()
    .filter(user => user.x === x && user.y === y)
    .forEach(user => usersByName.set(user.username.toLowerCase(), user));

  if (isSupabaseConfigured()) {
    getCachedWorldPlayers()
      .filter(player => player.x === x && player.y === y)
      .forEach(player => {
        const key = player.username.toLowerCase();
        if (!usersByName.has(key)) {
          usersByName.set(key, worldMapPlayerToUser(player));
        }
      });
  }

  return Array.from(usersByName.values());
}

function makeJobQueueCanceledActivity(
  user: User,
  canceledJobs: JobState[],
  reason: string,
  completedAt = Date.now()
): ActivityEntry {
  const firstJob = canceledJobs[0];

  return {
    id: `activity-job-queue-canceled-${completedAt}`,
    type: 'travel',
    title: canceledJobs.length === 1 ? 'Job Canceled' : `${canceledJobs.length} Jobs Canceled`,
    source: firstJob?.poiName || 'World Map',
    completedAt,
    rewards: {},
    description: reason,
  };
}

function clearJobQueueForMovement(user: User, reason: string, completedAt = Date.now()): Partial<User> {
  const canceledJobs = user.jobQueue || [];
  if (canceledJobs.length === 0) return {};

  return {
    jobQueue: [],
    activityLog: pushActivityEntry(
      user.activityLog,
      makeJobQueueCanceledActivity(user, canceledJobs, reason, completedAt)
    ),
  };
}

function getInvalidJobQueueLocationReason(user: User, now = Date.now()): string | null {
  const activeJob = user.jobQueue?.[0];
  if (!activeJob || user.traveling) return null;

  if (now < activeJob.startTime) {
    const stillAtQueuedStart = user.x === activeJob.startX && user.y === activeJob.startY;
    return stillAtQueuedStart
      ? null
      : `Queued jobs were canceled because the commander left ${activeJob.startX}:${activeJob.startY}.`;
  }

  if (activeJob.travelComplete) {
    const stillAtWorkSite = user.x === activeJob.targetX && user.y === activeJob.targetY;
    return stillAtWorkSite
      ? null
      : `Job work at ${activeJob.poiName} was canceled because the commander left the work site.`;
  }

  const travelNotAdvanced = activeJob.lastMoveTime <= activeJob.startTime;
  const stillAtTravelStart = user.x === activeJob.startX && user.y === activeJob.startY;
  if (travelNotAdvanced && !stillAtTravelStart) {
    return `Queued jobs were canceled because the commander left ${activeJob.startX}:${activeJob.startY}.`;
  }

  return null;
}

function cancelInvalidJobQueueForLocation(user: User, now = Date.now()): boolean {
  const reason = getInvalidJobQueueLocationReason(user, now);
  if (!reason) return false;

  updateCurrentUser(clearJobQueueForMovement(user, reason, now));
  return true;
}

export function startTravel(targetX: number, targetY: number): void {
  const currentUser = getCurrentUser();
  if (!currentUser) return;

  const duration = getDirectTravelDurationMs(currentUser, targetX, targetY);
  const startTime = Date.now();

  const travelState: TravelState = {
    targetX,
    targetY,
    startX: currentUser.x,
    startY: currentUser.y,
    startTime,
    duration,
    eventSeed: `${currentUser.username}-walk-${currentUser.x}-${currentUser.y}-${targetX}-${targetY}-${startTime}`,
  };

  // Taking direct control of movement invalidates queued road work.
  updateCurrentUser({
    traveling: travelState,
    ...clearJobQueueForMovement(
      currentUser,
      `Walking to ${targetX}:${targetY} canceled the current job queue.`,
      startTime
    ),
  });
}

function getRoutePosition(
  startX: number,
  startY: number,
  targetX: number,
  targetY: number,
  elapsedMs: number,
  durationMs: number
): { x: number; y: number; arrived: boolean } {
  const distanceX = Math.abs(targetX - startX);
  const distanceY = Math.abs(targetY - startY);
  const totalDistance = distanceX + distanceY;

  if (totalDistance <= 0 || durationMs <= 0) {
    return { x: targetX, y: targetY, arrived: true };
  }

  const elapsed = Math.max(0, Math.min(durationMs, elapsedMs));
  const coveredSteps = Math.min(totalDistance, Math.floor((elapsed / durationMs) * totalDistance));
  let x = startX;
  let y = startY;
  let remainingSteps = coveredSteps;

  const xDirection = targetX >= startX ? 1 : -1;
  const xSteps = Math.min(distanceX, remainingSteps);
  x += xSteps * xDirection;
  remainingSteps -= xSteps;

  const yDirection = targetY >= startY ? 1 : -1;
  const ySteps = Math.min(distanceY, remainingSteps);
  y += ySteps * yDirection;

  return {
    x,
    y,
    arrived: elapsed >= durationMs || (x === targetX && y === targetY),
  };
}

function getDirectTravelPosition(travel: TravelState, now = Date.now()): { x: number; y: number; arrived: boolean } {
  return getRoutePosition(
    travel.startX ?? travel.targetX,
    travel.startY ?? travel.targetY,
    travel.targetX,
    travel.targetY,
    now - travel.startTime,
    travel.duration
  );
}

export function checkTravelComplete(): boolean {
  const currentUser = getCurrentUser();
  if (!currentUser || !currentUser.traveling) return false;

  const now = Date.now();
  const travelPosition = getDirectTravelPosition(currentUser.traveling, now);

  if (travelPosition.arrived) {
    const completedAt = now;
    const travelUpdates = resolveTravelEvents(currentUser, {
      seed: currentUser.traveling.eventSeed || `${currentUser.username}-walk-${currentUser.traveling.startTime}`,
      title: 'Road travel',
      source: `${currentUser.traveling.startX ?? currentUser.x}:${currentUser.traveling.startY ?? currentUser.y} to ${currentUser.traveling.targetX}:${currentUser.traveling.targetY}`,
      durationMs: currentUser.traveling.duration,
      completedAt,
    });
    const arrivalPoi = getPoiAtTile(currentUser.traveling.targetX, currentUser.traveling.targetY);
    const arrivalActivityLog = arrivalPoi
      ? pushActivityEntry(travelUpdates.activityLog || currentUser.activityLog, {
          id: `activity-arrival-${arrivalPoi.id}-${completedAt}`,
          type: 'travel',
          title: `Arrived at ${arrivalPoi.name}`,
          source: 'World Map',
          completedAt,
          rewards: {},
          description: `Reached ${arrivalPoi.name}.`,
        })
      : travelUpdates.activityLog || currentUser.activityLog;

    // Travel complete! Update position
    updateCurrentUser({
      ...travelUpdates,
      x: currentUser.traveling.targetX,
      y: currentUser.traveling.targetY,
      traveling: null,
      activityLog: arrivalActivityLog,
      ...recordUserMultiplayerEvent(
        currentUser,
        {
          id: `travel-completed:${currentUser.traveling.eventSeed || currentUser.traveling.startTime}`,
          kind: 'travel-completed',
          occurredAt: completedAt,
          contextId: arrivalPoi?.id || 'world-map',
          targetId: `${currentUser.traveling.targetX}:${currentUser.traveling.targetY}`,
        },
        completedAt,
      ),
    });
    return true;
  }

  if (travelPosition.x !== currentUser.x || travelPosition.y !== currentUser.y) {
    updateCurrentUser({
      x: travelPosition.x,
      y: travelPosition.y,
    });
  }

  return false;
}

export function cancelTravel(): { success: boolean; x?: number; y?: number; message?: string } {
  const currentUser = getCurrentUser();
  if (!currentUser?.traveling) return { success: false, message: 'No direct travel in progress.' };

  const travelPosition = getDirectTravelPosition(currentUser.traveling);
  if (travelPosition.arrived) {
    checkTravelComplete();
    const arrivedUser = getCurrentUser();
    return {
      success: true,
      x: arrivedUser?.x ?? currentUser.traveling.targetX,
      y: arrivedUser?.y ?? currentUser.traveling.targetY,
      message: 'Arrived before travel could be canceled.',
    };
  }

  updateCurrentUser({
    ...clearJobQueueForMovement(
      currentUser,
      `Stopping at ${travelPosition.x}:${travelPosition.y} canceled queued jobs tied to the previous route.`
    ),
    x: travelPosition.x,
    y: travelPosition.y,
    traveling: null,
  });

  return {
    success: true,
    x: travelPosition.x,
    y: travelPosition.y,
    message: `Travel canceled at ${travelPosition.x}:${travelPosition.y}.`,
  };
}

export function getTravelProgress(): number {
  const currentUser = getCurrentUser();
  if (!currentUser || !currentUser.traveling) return 0;

  const elapsed = Date.now() - currentUser.traveling.startTime;
  return Math.min(100, (elapsed / currentUser.traveling.duration) * 100);
}

// Job duration mapping (in milliseconds) — same tiers for every POI
export const JOB_WORK_DURATIONS_MS = [
  1 * 60 * 1000,
  10 * 60 * 1000,
  30 * 60 * 1000,
  60 * 60 * 1000,
] as const;

export const JOB_DURATION_LABELS = ['1 min', '10 min', '30 min', '1 hour'] as const;
export const JOB_REWARD_MULTIPLIER = 0.3;

const JOB_DURATIONS = JOB_WORK_DURATIONS_MS;

interface JobRewardProfile {
  gold: number[];
  exp: number[];
  rareGems?: number[];
  healthRestore?: number[];
  itemIds?: Array<string | null>;
  equipmentRarities?: Array<EquipmentRarity | null>;
  minionTiers?: Array<MinionTier | null>;
  levelRequirements?: number[];
  notes?: Array<string | null>;
}

const DEFAULT_JOB_REWARD_PROFILE: JobRewardProfile = {
  gold: [10, 22, 36, 58],
  exp: [5, 10, 16, 24],
  rareGems: [0, 0, 1, 1],
  itemIds: [null, null, 'black-amber', 'small-gem-sack'],
  levelRequirements: [1, 1, 1, 5],
  notes: [null, null, 'Trade good chance.', 'Best payout requires level 5.'],
};

const JOB_REWARD_PROFILES: Record<string, JobRewardProfile> = {
  forest: {
    gold: [8, 18, 30, 48],
    exp: [7, 14, 22, 32],
    rareGems: [0, 0, 0, 1],
    itemIds: [null, 'black-amber', 'field-surgeon-kit', 'small-gem-sack'],
    levelRequirements: [1, 1, 1, 5],
    notes: [null, 'Forest trade goods.', 'Safer long-road supplies.', 'Level 5 forest cache.'],
  },
  mountain: {
    gold: [14, 32, 56, 96],
    exp: [5, 10, 16, 24],
    rareGems: [0, 0, 1, 2],
    itemIds: [null, null, 'black-amber', 'small-gem-sack'],
    equipmentRarities: [null, null, null, 'rare'],
    levelRequirements: [1, 1, 1, 5],
    notes: [null, null, 'Gem-bearing stone.', 'Level 5 rare gear work.'],
  },
  farm: {
    gold: [12, 26, 40, 62],
    exp: [4, 9, 15, 22],
    rareGems: [0, 0, 0, 1],
    itemIds: [null, 'red-mercy-draught', 'black-amber', 'decent-loot-chest'],
    levelRequirements: [1, 1, 1, 5],
    notes: [null, 'Restorative crop draught.', 'Trade goods.', 'Level 5 barn reliquary.'],
  },
  hunting_lodge: {
    gold: [10, 24, 42, 70],
    exp: [6, 13, 21, 31],
    rareGems: [0, 0, 1, 1],
    itemIds: [null, null, 'field-surgeon-kit', null],
    levelRequirements: [1, 1, 1, 5],
    notes: [null, null, 'Hunting supplies.', 'Level 5 veteran cache.'],
  },
  windmill: {
    gold: [9, 22, 38, 60],
    exp: [6, 12, 18, 27],
    rareGems: [0, 0, 1, 1],
    itemIds: [null, 'black-amber', null, 'sealed-spell-cache'],
    levelRequirements: [1, 1, 1, 5],
    notes: [null, 'Gear-oil trade goods.', null, 'Level 5 spell cache.'],
  },
  crab_trap: {
    gold: [13, 28, 46, 74],
    exp: [4, 9, 15, 23],
    rareGems: [0, 0, 1, 1],
    itemIds: [null, 'black-amber', 'small-gem-sack', 'rare-loot-chest'],
    levelRequirements: [1, 1, 1, 5],
    notes: [null, 'Black shell trade goods.', 'Tide gems.', 'Level 5 cove cache.'],
  },
  fishing_dock: {
    gold: [11, 25, 44, 72],
    exp: [5, 10, 16, 24],
    rareGems: [0, 0, 1, 1],
    itemIds: [null, 'red-mercy-draught', 'small-gem-sack', 'sealed-spell-cache'],
    levelRequirements: [1, 1, 1, 5],
    notes: [null, 'Dockside tonic.', 'Lake gems.', 'Level 5 drowned spell cache.'],
  },
  granite_quarry: {
    gold: [16, 36, 62, 105],
    exp: [4, 9, 15, 23],
    rareGems: [0, 0, 1, 2],
    itemIds: [null, null, 'black-amber', 'rare-loot-chest'],
    equipmentRarities: [null, null, null, 'rare'],
    levelRequirements: [1, 1, 1, 5],
    notes: [null, null, 'Cut-stone relic goods.', 'Level 5 quarry cache and rare gear.'],
  },
  coffee_plantation: {
    gold: [15, 33, 52, 82],
    exp: [4, 8, 14, 21],
    rareGems: [0, 0, 0, 1],
    itemIds: [null, 'red-mercy-draught', 'pilgrim-icon', 'small-gem-sack'],
    levelRequirements: [1, 1, 1, 5],
    notes: [null, 'Vigil draught.', 'Rare trade icon.', 'Level 5 estate cache.'],
  },
  campfire: {
    gold: [0, 0, 0, 0],
    exp: [3, 7, 12, 18],
    healthRestore: [25, 40, 60, 90],
    rareGems: [0, 0, 0, 1],
    itemIds: [null, 'red-mercy-draught', 'field-surgeon-kit', 'small-gem-sack'],
    levelRequirements: [1, 1, 1, 5],
    notes: [null, 'Shared medicine.', 'Field surgeon kit.', 'Level 5 pilgrim cache.'],
  },
  town: {
    gold: [8, 18, 34, 60],
    exp: [4, 9, 14, 22],
    rareGems: [0, 0, 1, 1],
    itemIds: [null, 'black-amber', 'pilgrim-icon', 'sealed-spell-cache'],
    levelRequirements: [1, 1, 1, 5],
    notes: [null, 'Market trade good.', 'Rare town relic.', 'Level 5 spell broker.'],
  },
};

function getJobRewardProfile(poiType?: string): JobRewardProfile {
  return JOB_REWARD_PROFILES[poiType || ''] || DEFAULT_JOB_REWARD_PROFILE;
}

export function getJobRewardPreview(jobIndex: number, poiType?: string, playerLevel = 1): JobRewardPreview {
  const safeIndex = Math.max(0, Math.min(JOB_DURATIONS.length - 1, jobIndex));
  const profile = getJobRewardProfile(poiType);
  const workDuration = JOB_DURATIONS[safeIndex];
  const itemId = profile.itemIds?.[safeIndex] || null;
  const equipmentDropChance = getJobEquipmentDropChance(workDuration, playerLevel);
  const equipmentRarity = equipmentDropChance > 0
    ? getHighestJobEquipmentRarity(workDuration, playerLevel) || undefined
    : undefined;
  const offeredMinionTier = profile.minionTiers?.[safeIndex] || undefined;
  const minionTier = offeredMinionTier && canAcquireMinionTier(offeredMinionTier, playerLevel)
    ? offeredMinionTier
    : undefined;
  const rareGems = safeIndex === JOB_DURATIONS.length - 1 ? profile.rareGems?.[safeIndex] || 0 : 0;
  const healthRestore = profile.healthRestore?.[safeIndex] || 0;

  const scaledReward = scaleMultiplayerRewards({
    gold: profile.gold[safeIndex] > 0 ? Math.max(1, Math.round(profile.gold[safeIndex] * JOB_REWARD_MULTIPLIER)) : 0,
    exp: profile.exp[safeIndex] > 0 ? Math.max(1, Math.round(profile.exp[safeIndex] * JOB_REWARD_MULTIPLIER)) : 0,
  }, playerLevel, 'job');

  return {
    gold: scaledReward.gold,
    exp: scaledReward.exp,
    rareGems: rareGems > 0 ? rareGems : undefined,
    healthRestore: healthRestore > 0 ? healthRestore : undefined,
    items: itemId ? [makeInventoryItem(itemId)] : undefined,
    equipmentRarity,
    equipmentDropChance: equipmentDropChance > 0 ? equipmentDropChance : undefined,
    minionTier,
    levelRequirement: profile.levelRequirements?.[safeIndex] || 1,
    rewardNote: profile.notes?.[safeIndex] || undefined,
  };
}

export function startJob(poiId: string, poiName: string, jobName: string, jobIndex: number, poiX: number, poiY: number, poiType?: string): { success: boolean; jobId?: string; error?: string } {
  const currentUser = getCurrentUser();
  if (!currentUser) return { success: false, error: 'Not logged in' };

  if (currentUser.jobQueue.length >= 4) {
    return { success: false, error: 'Job queue is full (max 4 jobs)' };
  }

  const workDuration = JOB_DURATIONS[jobIndex] || JOB_DURATIONS[0];
  const rewardPreview = getJobRewardPreview(jobIndex, poiType, currentUser.stats.level);
  const levelRequirement = rewardPreview.levelRequirement || 1;
  if ((currentUser.stats.level || 1) < levelRequirement) {
    return { success: false, error: `Requires level ${levelRequirement}.` };
  }
  
  // Determine where the player will be when this job starts
  let startX = currentUser.x;
  let startY = currentUser.y;
  const queuedAt = Date.now();
  let jobStartTime = queuedAt;
  
  // If there are jobs in the queue, this job starts after the last one completes
  if (currentUser.jobQueue.length > 0) {
    const lastJob = currentUser.jobQueue[currentUser.jobQueue.length - 1];
    // This job starts when the last job completes
    jobStartTime = lastJob.startTime + lastJob.duration;
    // Player will be at the last job's POI when this job starts
    startX = lastJob.targetX;
    startY = lastJob.targetY;
  } else if (currentUser.traveling) {
    // If the player is already walking, queue this job after the current trip lands.
    jobStartTime = currentUser.traveling.startTime + currentUser.traveling.duration;
    startX = currentUser.traveling.targetX;
    startY = currentUser.traveling.targetY;
  }
  
  // Calculate travel time from where player will be (not current location)
  const distance = Math.abs(poiX - startX) + Math.abs(poiY - startY);
  const travelTime = getJobTravelDurationMs(currentUser, distance);
  
  const totalDuration = travelTime + workDuration;
  
  const guaranteedMinions = rewardPreview.minionTier
    ? [generateMinionDrop(workDuration, rewardPreview.minionTier, 1, currentUser.stats.level || 1)].filter(Boolean) as MinionStack[]
    : [];
  const guaranteedItems = rewardPreview.items?.map(item => ({ ...item })) || [];

  const newJob: JobState = {
    id: `job-${queuedAt}-${Math.random()}`,
    poiId,
    poiName,
    jobName,
    startTime: jobStartTime,
    duration: totalDuration,
    workDuration,
    rewards: {
      gold: Math.round(rewardPreview.gold * getGoldRewardMultiplier(currentUser)),
      exp: rewardPreview.exp,
      rareGems: rewardPreview.rareGems,
      healthRestore: rewardPreview.healthRestore,
      items: guaranteedItems.length > 0 ? guaranteedItems : undefined,
      minions: guaranteedMinions.length > 0 ? guaranteedMinions : undefined,
    },
    targetX: poiX,
    targetY: poiY,
    startX: startX,
    startY: startY,
    travelComplete: distance === 0, // Already at location (or will be after previous job)
    travelCompleteTime: distance === 0 ? jobStartTime : null, // Set time if already at location
    lastMoveTime: jobStartTime,
    eventSeed: `${currentUser.username}-job-${poiId}-${startX}-${startY}-${poiX}-${poiY}-${jobStartTime}`,
    travelEventsResolved: distance === 0,
  };

  const updatedQueue = [...currentUser.jobQueue, newJob];
  updateCurrentUser({
    jobQueue: updatedQueue,
    ...recordUserMultiplayerEvent(
      currentUser,
      {
        id: `job-started:${newJob.id}`,
        kind: 'job-started',
        occurredAt: queuedAt,
        contextId: poiId,
        targetId: newJob.id,
      },
      queuedAt,
    ),
  });

  return { success: true, jobId: newJob.id };
}

export function updateJobTravelProgress(): void {
  const currentUser = getCurrentUser();
  if (!currentUser || currentUser.jobQueue.length === 0 || currentUser.traveling) return;

  const now = Date.now();
  if (cancelInvalidJobQueueForLocation(currentUser, now)) return;

  const updatedQueue = [...currentUser.jobQueue];
  let positionChanged = false;
  let travelUpdates: Partial<User> = {};
  let newX = currentUser.x;
  let newY = currentUser.y;

  // Only process the first job in the queue (the active one)
  const activeJob = updatedQueue[0];
  
  // Only process if the job has started
  if (activeJob && now >= activeJob.startTime && !activeJob.travelComplete) {
    const travelPosition = getJobTravelPosition(activeJob, now);
    newX = travelPosition.x;
    newY = travelPosition.y;
    positionChanged = newX !== currentUser.x || newY !== currentUser.y;

    if (travelPosition.arrived && !activeJob.travelEventsResolved) {
      travelUpdates = resolveTravelEvents(currentUser, {
        seed: activeJob.eventSeed || `${currentUser.username}-job-${activeJob.id}`,
        title: activeJob.jobName,
        source: `${activeJob.poiName} road`,
        durationMs: activeJob.duration - activeJob.workDuration,
        completedAt: now,
      });
    }

    if (positionChanged || travelPosition.arrived) {
      updatedQueue[0] = {
        ...activeJob,
        lastMoveTime: now,
        travelComplete: travelPosition.arrived,
        travelCompleteTime: travelPosition.arrivalTime ?? activeJob.travelCompleteTime,
        travelEventsResolved: travelPosition.arrived ? true : activeJob.travelEventsResolved,
      };
    }
  }

  // Update position and queue if anything changed
  if (positionChanged) {
    updateCurrentUser({
      ...travelUpdates,
      x: newX,
      y: newY,
      jobQueue: updatedQueue,
    });
  } else if (JSON.stringify(updatedQueue) !== JSON.stringify(currentUser.jobQueue)) {
    updateCurrentUser({ ...travelUpdates, jobQueue: updatedQueue });
  }
}

export function checkJobsComplete(): void {
  const currentUser = getCurrentUser();
  if (!currentUser || currentUser.jobQueue.length === 0) return;

  const now = Date.now();
  if (cancelInvalidJobQueueForLocation(currentUser, now)) return;

  const updatedQueue = [...currentUser.jobQueue];
  let goldEarned = 0;
  let expEarned = 0;
  let restedBonusExp = 0;
  let nextMultiplayerEngagement = currentUser.multiplayerEngagement;
  let healthRestored = 0;
  const itemsEarned: InventoryItem[] = [];
  const equipmentEarned: Equipment[] = [];
  const minionsEarned: MinionStack[] = [];

  // Only check the first job (active job) since jobs are queued
  const firstJob = updatedQueue[0];
  if (firstJob) {
    // Only complete job if we've arrived AND the work duration has elapsed since arrival
    if (firstJob.travelComplete && firstJob.travelCompleteTime) {
      const workElapsed = now - firstJob.travelCompleteTime;
      if (workElapsed >= firstJob.workDuration) {
        // Job complete! Give rewards
        goldEarned += firstJob.rewards.gold;
        const restedBonus = consumeMultiplayerRestedJobBonus(
          currentUser.multiplayerEngagement,
          currentUser.username,
          firstJob.rewards.exp,
          now,
        );
        restedBonusExp = restedBonus.bonusExp;
        nextMultiplayerEngagement = restedBonus.state;
        expEarned += firstJob.rewards.exp + restedBonusExp;
      
      // Restore health if job has healthRestore
      if (firstJob.rewards.healthRestore) {
        healthRestored += firstJob.rewards.healthRestore;
      }
      
      // Add rare gems to inventory if job has them
      if (firstJob.rewards.rareGems && firstJob.rewards.rareGems > 0) {
        const existingGem = itemsEarned.find(item => item.name === 'Rare Gem');
        if (existingGem) {
          existingGem.quantity += firstJob.rewards.rareGems;
        } else {
          itemsEarned.push(makeInventoryItem('rare-gem', firstJob.rewards.rareGems));
        }
      }

      if (firstJob.rewards.items?.length) {
        itemsEarned.push(...firstJob.rewards.items);
      }

      if (firstJob.rewards.equipment?.length) {
        equipmentEarned.push(...firstJob.rewards.equipment);
      }

      if (firstJob.rewards.minions?.length) {
        minionsEarned.push(...firstJob.rewards.minions);
      }

      itemsEarned.push(...rollInventoryBonusDrops(currentUser.stats.level || 1, 'job'));
      
      // Generate equipment drop
      const droppedEquipment = generateEquipment(
        firstJob.workDuration,
        undefined,
        getEquipmentDropBonus(currentUser),
        currentUser.stats.level || 1,
      );
      if (droppedEquipment) {
        equipmentEarned.push(droppedEquipment);
      }

      const droppedMinion = generateMinionDrop(
        firstJob.workDuration,
        undefined,
        1,
        currentUser.stats.level || 1,
      );
      if (droppedMinion) {
        minionsEarned.push(droppedMinion);
      }
      
      // Update daily quest progress
      updateQuestProgress(firstJob.workDuration);
      
      // Remove completed job from queue
      updatedQueue.shift();
      }
    }
  }

  // Update user if any jobs completed
  if (
    goldEarned > 0 ||
    expEarned > 0 ||
    healthRestored > 0 ||
    itemsEarned.length > 0 ||
    equipmentEarned.length > 0 ||
    minionsEarned.length > 0
  ) {
    const updatedStats = { ...currentUser.stats };

    // Restore health (cap at maxHealth)
    if (healthRestored > 0) {
      updatedStats.health = Math.min(updatedStats.maxHealth, updatedStats.health + healthRestored);
    }

    const itemCapacity = getInventorySlotCapacity(currentUser);
    const itemAddResult = addInventoryItemsWithLimit(currentUser.inventory || [], itemsEarned, itemCapacity);
    const acceptedRareGems = itemAddResult.acceptedItems
      .filter(item => item.id === 'rare-gem')
      .reduce((total, item) => total + item.quantity, 0);
    const gearAddResult = addEquipmentWithLimit(
      currentUser.equipment || [],
      currentUser.equippedSlots || {},
      equipmentEarned,
      itemCapacity,
    );
    const inventoryOverflowed = gearAddResult.rejectedEquipment.length > 0;
    
    const updatedEquipment = gearAddResult.equipment;
    const updatedMinions = mergeMinionStacks(currentUser.minions || [], minionsEarned);
    const updatedCityQuests = firstJob
      ? updateCityQuestProgressForJob(currentUser.cityQuests || [], firstJob.workDuration, firstJob.poiName)
      : currentUser.cityQuests || [];
    const updatedActivityLog = firstJob
      ? pushActivityEntry(currentUser.activityLog, {
          id: `activity-job-${firstJob.id}-${now}`,
          type: 'job',
          title: inventoryOverflowed ? `${firstJob.jobName} (gear storage full)` : firstJob.jobName,
          source: firstJob.poiName,
          completedAt: now,
          jobDurationMs: firstJob.workDuration,
          description: restedBonusExp > 0 ? `Rested command added ${restedBonusExp} bonus XP.` : undefined,
          rewards: {
            gold: goldEarned || undefined,
            exp: expEarned || undefined,
            items: itemAddResult.acceptedItems.length > 0 ? itemAddResult.acceptedItems : undefined,
            equipment: gearAddResult.acceptedEquipment.length > 0 ? gearAddResult.acceptedEquipment : undefined,
            minions: minionsEarned.length > 0 ? minionsEarned : undefined,
            rareGems: acceptedRareGems || undefined,
            healthRestore: healthRestored || undefined,
          },
        })
      : currentUser.activityLog || [];
    
    const engagementUpdates = firstJob
      ? recordUserMultiplayerEvent(
          currentUser,
          {
            id: `job-completed:${firstJob.id}`,
            kind: 'job-completed',
            occurredAt: now,
            contextId: firstJob.poiId,
            targetId: firstJob.id,
          },
          now,
          nextMultiplayerEngagement,
        )
      : {
          multiplayerEngagement: currentUser.multiplayerEngagement,
          multiplayerChronicle: currentUser.multiplayerChronicle,
        };

    updateCurrentUser({
      jobQueue: updatedQueue,
      gold: currentUser.gold + goldEarned,
      exp: currentUser.exp + expEarned,
      stats: updatedStats,
      inventory: itemAddResult.inventory,
      equipment: updatedEquipment,
      minions: updatedMinions,
      cityQuests: updatedCityQuests,
      activityLog: updatedActivityLog,
      ...engagementUpdates,
    });
  }
}

function getJobTravelPosition(job: JobState, now = Date.now()): { x: number; y: number; arrived: boolean; arrivalTime: number | null } {
  const travelDuration = Math.max(0, job.duration - job.workDuration);

  if (now < job.startTime) {
    return { x: job.startX, y: job.startY, arrived: false, arrivalTime: null };
  }

  const position = getRoutePosition(
    job.startX,
    job.startY,
    job.targetX,
    job.targetY,
    now - job.startTime,
    travelDuration
  );

  return {
    ...position,
    arrivalTime: position.arrived ? job.startTime + travelDuration : null,
  };
}

function rebaseJobQueue(queue: JobState[], sourceX: number, sourceY: number, startAt: number, user: User): JobState[] {
  let nextStartTime = startAt;
  let nextStartX = sourceX;
  let nextStartY = sourceY;

  return queue.map((job) => {
    const distance = Math.abs(job.targetX - nextStartX) + Math.abs(job.targetY - nextStartY);
    const travelTime = getJobTravelDurationMs(user, distance);
    const duration = travelTime + job.workDuration;
    const travelComplete = distance === 0;
    const rebasedJob: JobState = {
      ...job,
      startTime: nextStartTime,
      duration,
      startX: nextStartX,
      startY: nextStartY,
      travelComplete,
      travelCompleteTime: travelComplete ? nextStartTime : null,
      lastMoveTime: nextStartTime,
      travelEventsResolved: travelComplete,
      eventSeed: `${user.username}-job-${job.poiId}-${nextStartX}-${nextStartY}-${job.targetX}-${job.targetY}-${nextStartTime}`,
    };

    nextStartTime += duration;
    nextStartX = job.targetX;
    nextStartY = job.targetY;

    return rebasedJob;
  });
}

export function cancelJob(jobId: string): { success: boolean; message?: string } {
  const currentUser = getCurrentUser();
  if (!currentUser) return { success: false, message: 'Not logged in.' };

  const jobIndex = currentUser.jobQueue.findIndex(job => job.id === jobId);
  if (jobIndex === -1) return { success: false, message: 'Job was not found.' };

  const now = Date.now();
  const canceledJob = currentUser.jobQueue[jobIndex];
  const jobsBeforeCanceled = currentUser.jobQueue.slice(0, jobIndex);
  const jobsAfterCanceled = currentUser.jobQueue.slice(jobIndex + 1);
  let update: Partial<User> = {};
  let updatedQueue: JobState[];
  let message = 'Job canceled.';

  if (jobIndex === 0) {
    let baseX = currentUser.x;
    let baseY = currentUser.y;
    let baseStartTime = now;

    if (now >= canceledJob.startTime) {
      const cancelPosition = canceledJob.travelComplete
        ? { x: canceledJob.targetX, y: canceledJob.targetY }
        : getJobTravelPosition(canceledJob, now);
      baseX = cancelPosition.x;
      baseY = cancelPosition.y;
      update = { x: baseX, y: baseY };
      message = canceledJob.travelComplete
        ? `Job canceled at ${baseX}:${baseY}.`
        : `Travel canceled at ${baseX}:${baseY}.`;
    } else if (currentUser.traveling) {
      const directArrivalTime = currentUser.traveling.startTime + currentUser.traveling.duration;
      const directArrival = getDirectTravelPosition(currentUser.traveling, directArrivalTime);
      baseX = directArrival.x;
      baseY = directArrival.y;
      baseStartTime = directArrivalTime;
    }

    updatedQueue = rebaseJobQueue(jobsAfterCanceled, baseX, baseY, baseStartTime, currentUser);
  } else {
    const previousJob = jobsBeforeCanceled[jobsBeforeCanceled.length - 1];
    const rebasedAfter = rebaseJobQueue(
      jobsAfterCanceled,
      previousJob.targetX,
      previousJob.targetY,
      previousJob.startTime + previousJob.duration,
      currentUser
    );
    updatedQueue = [...jobsBeforeCanceled, ...rebasedAfter];
  }

  updateCurrentUser({ ...update, jobQueue: updatedQueue });
  return { success: true, message };
}

export function getJobProgress(job: JobState, now = Date.now()): number {
  // If job hasn't started yet, show 0 progress
  if (now < job.startTime) return 0;
  
  // Calculate progress based on travel and work phases
  let progress = 0;
  
  if (!job.travelComplete) {
    // Still traveling - calculate distance progress (worth 50% of total)
    const totalDistance = Math.abs(job.targetX - job.startX) + Math.abs(job.targetY - job.startY);
    if (totalDistance === 0) {
      progress = 50; // No travel needed, start at 50%
    } else {
      const currentUser = getCurrentUser();
      if (currentUser) {
        const remainingDistance = Math.abs(job.targetX - currentUser.x) + Math.abs(job.targetY - currentUser.y);
        const distanceProgress = ((totalDistance - remainingDistance) / totalDistance) * 50;
        progress = Math.min(50, distanceProgress);
      }
    }
  } else if (job.travelCompleteTime) {
    // Travel complete, now working (worth remaining 50%)
    const workElapsed = now - job.travelCompleteTime;
    const workProgress = (workElapsed / job.workDuration) * 50;
    progress = 50 + Math.min(50, workProgress);
  } else {
    // Travel complete but travelCompleteTime not set (migration fallback)
    const elapsed = now - job.startTime;
    const travelDuration = job.duration - job.workDuration;
    const workElapsed = Math.max(0, elapsed - travelDuration);
    const workProgress = (workElapsed / job.workDuration) * 50;
    progress = 50 + Math.min(50, workProgress);
  }
  
  return Math.min(100, progress);
}

export function getJobTimeRemaining(job: JobState, now = Date.now()): number {
  // If job hasn't started yet, show full duration + wait time
  if (now < job.startTime) {
    return (job.startTime - now) + job.duration;
  }
  
  if (!job.travelComplete) {
    // Still traveling - estimate travel time remaining based on distance
    const currentUser = getCurrentUser();
    if (!currentUser) return job.duration;
    
    const remainingDistance = Math.abs(job.targetX - currentUser.x) + Math.abs(job.targetY - currentUser.y);
    const estimatedTravelTimeRemaining = getJobTravelDurationMs(currentUser, remainingDistance);
    
    return estimatedTravelTimeRemaining + job.workDuration;
  } else if (job.travelCompleteTime) {
    // Travel complete, return work time remaining
    const workElapsed = now - job.travelCompleteTime;
    return Math.max(0, job.workDuration - workElapsed);
  } else {
    // Travel complete but travelCompleteTime not set (migration fallback)
    // Assume travel took the expected time
    const elapsed = now - job.startTime;
    const travelDuration = job.duration - job.workDuration;
    const workElapsed = Math.max(0, elapsed - travelDuration);
    return Math.max(0, job.workDuration - workElapsed);
  }
}

// Stat allocation functions
export function allocateStatPoint(stat: AllocatableStat): { success: boolean; error?: string } {
  const currentUser = getCurrentUser();
  if (!currentUser) return { success: false, error: 'Not logged in' };

  if (currentUser.stats.unallocatedPoints <= 0) {
    return { success: false, error: 'No stat points available' };
  }

  const updatedStats = { ...currentUser.stats };
  updatedStats.unallocatedPoints -= 1;

  if (stat === 'health') {
    updatedStats.maxHealth += 10; // Each health point adds 10 max HP
    updatedStats.health += 10; // Also heal the player
  } else {
    updatedStats[stat] += 1;
  }

  updateCurrentUser({ stats: updatedStats });
  return { success: true };
}

// Calculate experience needed for next level. Level 15 should take sustained play, not a few early rewards.
export function getExpNeeded(currentLevel: number): number {
  const level = Math.max(1, Math.floor(currentLevel));
  if (level <= 5) return 80 + (level - 1) * 70 + (level - 1) ** 2 * 20;
  return 680 + (level - 5) * 220 + (level - 5) ** 2 * 35;
}

// Generate random equipment
export function generateEquipment(
  jobDuration: number,
  forcedRarity?: EquipmentRarity,
  dropBonus = 0,
  playerLevel = MAX_PLAYER_LEVEL,
): Equipment | null {
  const rarity = forcedRarity
    ? capEquipmentRarityForLevel(forcedRarity, playerLevel)
    : rollJobEquipmentRarity(jobDuration, playerLevel, dropBonus);
  if (!rarity) return null;
  
  // Random equipment slot
  const slots: EquipmentSlot[] = ['sword', 'shield', 'armor', 'armor-pants', 'boots', 'gloves', 'helmet'];
  const slot = slots[Math.floor(Math.random() * slots.length)];
  
  // Generate stats based on rarity
  const equipment: Equipment = {
    id: `${slot}-${rarity}-${Date.now()}-${Math.random()}`,
    name: `${rarity.charAt(0).toUpperCase() + rarity.slice(1)} ${slot.split('-').map(s => s.charAt(0).toUpperCase() + s.slice(1)).join(' ')}`,
    slot,
    rarity,
    stats: {},
    socketBonuses: [],
  };
  
  // Stat ranges by rarity
  const statRanges = {
    decent: { min: 1, max: 3 },
    rare: { min: 3, max: 6 },
    epic: { min: 6, max: 10 },
    legendary: { min: 10, max: 15 },
  };
  
  const range = statRanges[rarity];
  
  // Assign stats based on equipment type
  if (slot === 'sword') {
    equipment.stats.armyPower = Math.floor(Math.random() * (range.max - range.min + 1)) + range.min;
  } else if (slot === 'shield') {
    equipment.stats.defensivePower = Math.floor(Math.random() * (range.max - range.min + 1)) + range.min;
  } else if (slot === 'armor') {
    equipment.stats.defensivePower = Math.floor(Math.random() * (range.max - range.min + 1)) + range.min;
    equipment.stats.maxHealth = (Math.floor(Math.random() * (range.max - range.min + 1)) + range.min) * 5;
  } else if (slot === 'armor-pants') {
    equipment.stats.defensivePower = Math.floor(Math.random() * (range.max - range.min + 1)) + range.min;
  } else if (slot === 'boots') {
    equipment.stats.morale = Math.floor(Math.random() * (range.max - range.min + 1)) + range.min;
  } else if (slot === 'gloves') {
    equipment.stats.armyPower = Math.floor(Math.random() * (range.max - range.min + 1)) + range.min;
  } else if (slot === 'helmet') {
    equipment.stats.spellPower = Math.floor(Math.random() * (range.max - range.min + 1)) + range.min;
  }
  
  // Legendary passive effects
  if (rarity === 'legendary') {
    const passives = [
      'Swift: Travel time reduced by another 25%',
      'Lucky: +10% equipment drop chance from jobs',
      'Wealthy: +50% gold from jobs',
    ];
    equipment.passive = passives[Math.floor(Math.random() * passives.length)];
  }
  
  return equipment;
}

function rollMinionTier(workDuration: number, playerLevel: number): MinionTier | null {
  const roll = Math.random();
  const tier2Unlocked = canAcquireMinionTier('tier2', playerLevel);
  const tier3Unlocked = canAcquireMinionTier('tier3', playerLevel);
  const rates = workDuration >= JOB_WORK_DURATIONS_MS[3]
    ? { tier1: 0.009, tier2: 0.0018, tier3: 0.0003 }
    : workDuration >= JOB_WORK_DURATIONS_MS[2]
      ? { tier1: 0.005, tier2: 0.001, tier3: 0.0001 }
      : workDuration >= JOB_WORK_DURATIONS_MS[1]
        ? { tier1: 0.0022, tier2: 0.0002, tier3: 0 }
        : { tier1: 0.0004, tier2: 0, tier3: 0 };
  const tier3Chance = tier3Unlocked ? rates.tier3 : 0;
  const tier2Chance = tier2Unlocked ? rates.tier2 : 0;

  if (roll < tier3Chance) return 'tier3';
  if (roll < tier3Chance + tier2Chance) return 'tier2';
  if (roll < tier3Chance + tier2Chance + rates.tier1) return 'tier1';
  return null;
}

export function generateMinionDrop(
  workDuration: number,
  forcedTier?: MinionTier,
  quantity = 1,
  playerLevel = 1,
): MinionStack | null {
  const tier = forcedTier || rollMinionTier(workDuration, playerLevel);
  if (!tier) return null;
  if (!canAcquireMinionTier(tier, playerLevel)) return null;

  const eligibleTemplates = MINION_TEMPLATES.filter(template => (
    template.tier === tier && isPlayerRecruitableMinionTemplate(template.templateId)
  ));
  const template = eligibleTemplates[Math.floor(Math.random() * eligibleTemplates.length)];
  if (!template) return null;

  return createMinionStack(template, quantity);
}

// Equip an equipment piece
export function equipItem(equipmentId: string): { success: boolean; error?: string } {
  const currentUser = getCurrentUser();
  if (!currentUser) return { success: false, error: 'No user logged in' };
  
  const equipment = currentUser.equipment.find(e => e.id === equipmentId);
  if (!equipment) return { success: false, error: 'Equipment not found' };
  
  // Unequip existing item in this slot if any
  const existingEquipId = currentUser.equippedSlots[equipment.slot];
  if (existingEquipId) {
    unequipItem(equipment.slot);
  }
  
  // Equip the new item
  const updatedSlots = { ...currentUser.equippedSlots };
  updatedSlots[equipment.slot] = equipmentId;
  
  // Apply stats
  const updatedStats = { ...currentUser.stats };
  const armyPower = getEquipmentStatValue(equipment, 'armyPower');
  const defensivePower = getEquipmentStatValue(equipment, 'defensivePower');
  const morale = getEquipmentStatValue(equipment, 'morale');
  const spellPower = getEquipmentStatValue(equipment, 'spellPower');
  const maxHealth = getEquipmentStatValue(equipment, 'maxHealth');

  if (armyPower) updatedStats.armyPower += armyPower;
  if (defensivePower) updatedStats.defensivePower += defensivePower;
  if (morale) updatedStats.morale += morale;
  if (spellPower) updatedStats.spellPower += spellPower;
  if (maxHealth) {
    updatedStats.maxHealth += maxHealth;
    updatedStats.health += maxHealth; // Also increase current health
  }

  const previewUser = { ...currentUser, equippedSlots: updatedSlots };
  const reconciled = reconcileGearSetBonuses(previewUser, updatedStats);

  updateCurrentUser({
    equippedSlots: updatedSlots,
    stats: reconciled.stats,
    gearSetBonusSnapshot: reconciled.snapshot,
  });
  return { success: true };
}

// Unequip an equipment piece
export function unequipItem(slot: EquipmentSlot): { success: boolean; error?: string } {
  const currentUser = getCurrentUser();
  if (!currentUser) return { success: false, error: 'No user logged in' };
  
  const equipmentId = currentUser.equippedSlots[slot];
  if (!equipmentId) return { success: false, error: 'No equipment in this slot' };
  
  const equipment = currentUser.equipment.find(e => e.id === equipmentId);
  if (!equipment) return { success: false, error: 'Equipment not found' };
  
  // Remove from equipped slots
  const updatedSlots = { ...currentUser.equippedSlots };
  delete updatedSlots[slot];
  
  // Remove stats
  const updatedStats = { ...currentUser.stats };
  const armyPower = getEquipmentStatValue(equipment, 'armyPower');
  const defensivePower = getEquipmentStatValue(equipment, 'defensivePower');
  const morale = getEquipmentStatValue(equipment, 'morale');
  const spellPower = getEquipmentStatValue(equipment, 'spellPower');
  const maxHealth = getEquipmentStatValue(equipment, 'maxHealth');

  if (armyPower) updatedStats.armyPower -= armyPower;
  if (defensivePower) updatedStats.defensivePower -= defensivePower;
  if (morale) updatedStats.morale -= morale;
  if (spellPower) updatedStats.spellPower -= spellPower;
  if (maxHealth) {
    updatedStats.maxHealth -= maxHealth;
    // Don't reduce current health below 1
    updatedStats.health = Math.max(1, Math.min(updatedStats.health, updatedStats.maxHealth));
  }

  const previewUser = { ...currentUser, equippedSlots: updatedSlots };
  const reconciled = reconcileGearSetBonuses(previewUser, updatedStats);

  updateCurrentUser({
    equippedSlots: updatedSlots,
    stats: reconciled.stats,
    gearSetBonusSnapshot: reconciled.snapshot,
  });
  return { success: true };
}

// Daily Quest Functions
const DAILY_RESET_MS = 24 * 60 * 60 * 1000;

function formatLocalDate(date: Date): string {
  return `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, '0')}-${String(date.getDate()).padStart(2, '0')}`;
}

function getYesterdayDateString(now = new Date()): string {
  const yesterday = new Date(now);
  yesterday.setDate(yesterday.getDate() - 1);
  return formatLocalDate(yesterday);
}

function getDateStringStartMs(dateKey?: string): number | null {
  if (!dateKey) return null;
  const match = /^(\d{4})-(\d{2})-(\d{2})$/.exec(dateKey);
  if (!match) return null;

  const [, year, month, day] = match;
  const date = new Date(Number(year), Number(month) - 1, Number(day));
  const time = date.getTime();
  return Number.isFinite(time) ? time : null;
}

const DAILY_RUN_MODIFIERS: DailyRunModifier[] = [
  {
    id: 'candle-oath',
    name: 'Candle Oath',
    description: '+2 Spell Power and a little extra XP.',
    statBonus: { spellPower: 2 },
    rewardExpMultiplier: 1.1,
  },
  {
    id: 'iron-road',
    name: 'Iron Road',
    description: '+2 Defensive Power, tougher enemies, better gold.',
    statBonus: { defensivePower: 2 },
    enemyLevelOffset: 1,
    rewardGoldMultiplier: 1.12,
  },
  {
    id: 'blood-moon',
    name: 'Blood Moon',
    description: '+2 Army Power, harsher enemies, richer spoils.',
    statBonus: { armyPower: 2 },
    enemyLevelOffset: 2,
    rewardGoldMultiplier: 1.22,
    rewardExpMultiplier: 1.08,
  },
  {
    id: 'pilgrim-dawn',
    name: 'Pilgrim Dawn',
    description: '+20 commander health and bonus XP.',
    statBonus: { maxHealth: 20, health: 20 },
    rewardExpMultiplier: 1.08,
  },
  {
    id: 'deadwind-vow',
    name: 'Deadwind Vow',
    description: '+2 Morale, one more battle, better rewards.',
    statBonus: { morale: 2 },
    targetBattleBonus: 1,
    rewardGoldMultiplier: 1.1,
    rewardExpMultiplier: 1.1,
  },
  {
    id: 'ash-benediction',
    name: 'Ash Benediction',
    description: '+1 to all commander powers.',
    statBonus: { armyPower: 1, defensivePower: 1, morale: 1, spellPower: 1, maxHealth: 10, health: 10 },
  },
  {
    id: 'black-banner',
    name: 'Black Banner',
    description: '+3 Army Power, enemies rise by one level.',
    statBonus: { armyPower: 3 },
    enemyLevelOffset: 1,
  },
  {
    id: 'moonwell-rites',
    name: 'Moonwell Rites',
    description: '+3 Spell Power, tougher casters, higher XP.',
    statBonus: { spellPower: 3 },
    enemyLevelOffset: 1,
    rewardExpMultiplier: 1.15,
  },
];

const DAILY_RUN_BOSSES: BossProfile[] = BOSS_PROFILES;

const DAILY_RUN_TITLES = [
  'Candle Road Trial',
  'Black Bell March',
  'Moonlit Causeway',
  'Ash Gate Vigil',
  'Relic Storm Chain',
  'Dead Orchard Run',
  'Hollow Crown Trial',
  'Pilgrim Sword Path',
];

const DAILY_RUN_WEEKLY_REWARDS: Array<{
  id: string;
  name: string;
  description: string;
  itemId: string;
  goldMultiplier: number;
  expMultiplier: number;
}> = [
  {
    id: 'gem-vigil',
    name: 'Gem Vigil Week',
    description: 'First clear includes a Small Gem Sack and a little more gold.',
    itemId: 'small-gem-sack',
    goldMultiplier: 1.08,
    expMultiplier: 1,
  },
  {
    id: 'armory-vigil',
    name: 'Armory Vigil Week',
    description: 'First clear includes an extra Decent Loot Chest.',
    itemId: 'decent-loot-chest',
    goldMultiplier: 1,
    expMultiplier: 1.05,
  },
  {
    id: 'relic-vigil',
    name: 'Relic Vigil Week',
    description: 'First clear includes a Candle-Key Fragment and bonus XP.',
    itemId: 'candle-key-fragment',
    goldMultiplier: 1.03,
    expMultiplier: 1.08,
  },
  {
    id: 'deep-cache',
    name: 'Deep Cache Week',
    description: 'First clear includes a Rare Loot Chest, with harder payout pressure.',
    itemId: 'rare-loot-chest',
    goldMultiplier: 1,
    expMultiplier: 1.12,
  },
];

function hashDailyText(input: string): number {
  let hash = 2166136261;

  for (let index = 0; index < input.length; index += 1) {
    hash ^= input.charCodeAt(index);
    hash = Math.imul(hash, 16777619);
  }

  return hash >>> 0;
}

function seededDailyNumber(seed: string, salt: string): number {
  return hashDailyText(`${seed}:${salt}`) / 4294967295;
}

function pickDailySeeded<T>(items: T[], seed: string, salt: string): T {
  return items[Math.floor(seededDailyNumber(seed, salt) * items.length)] || items[0];
}

function pickDailySeededDistinct<T extends { id: string }>(items: T[], seed: string, count: number): T[] {
  const picked: T[] = [];
  let saltIndex = 0;

  while (picked.length < count && picked.length < items.length) {
    const candidate = pickDailySeeded(items, seed, `modifier-${saltIndex}`);
    if (!picked.some(item => item.id === candidate.id)) picked.push(candidate);
    saltIndex += 1;
  }

  return picked;
}

function getDailyWeekKey(date: Date): string {
  const firstDay = new Date(date.getFullYear(), 0, 1);
  const dayOfYear = Math.floor((date.getTime() - firstDay.getTime()) / 86400000) + 1;
  const weekNumber = Math.max(1, Math.ceil(dayOfYear / 7));
  return `${date.getFullYear()}-W${String(weekNumber).padStart(2, '0')}`;
}

function roundRewardMultiplier(value: number): number {
  return Math.round(value * 100) / 100;
}

export function getDailyRunChallenge(now = Date.now()): DailyRunChallenge {
  const dateObject = new Date(now);
  const date = formatLocalDate(dateObject);
  const weekKey = getDailyWeekKey(dateObject);
  const title = pickDailySeeded(DAILY_RUN_TITLES, date, 'title');
  const boss = pickDailySeeded(DAILY_RUN_BOSSES, date, 'boss');
  const weeklyReward = pickDailySeeded(DAILY_RUN_WEEKLY_REWARDS, weekKey, 'weekly-reward');
  const modifiers = pickDailySeededDistinct(DAILY_RUN_MODIFIERS, date, 2);
  const targetBattleBonus = modifiers.reduce((total, modifier) => total + (modifier.targetBattleBonus || 0), 0);
  const routeLengthRoll = seededDailyNumber(date, 'battle-count');
  const baseBattles = routeLengthRoll > 0.82 ? 16 : routeLengthRoll > 0.52 ? 14 : 12;
  const targetBattles = Math.max(12, Math.min(18, baseBattles + targetBattleBonus));
  const routeRewardMultiplier = targetBattles >= 16 ? 1.22 : targetBattles >= 14 ? 1.12 : 1;
  const enemyLevelOffset = modifiers.reduce((total, modifier) => total + (modifier.enemyLevelOffset || 0), 0);
  const rewardGoldMultiplier = roundRewardMultiplier(
    weeklyReward.goldMultiplier *
    modifiers.reduce((total, modifier) => total * (modifier.rewardGoldMultiplier || 1), 1) *
    routeRewardMultiplier
  );
  const rewardExpMultiplier = roundRewardMultiplier(
    weeklyReward.expMultiplier *
    modifiers.reduce((total, modifier) => total * (modifier.rewardExpMultiplier || 1), 1) *
    (1 + (routeRewardMultiplier - 1) * 0.7)
  );

  return {
    date,
    weekKey,
    name: title,
    subtitle: `${modifiers.map(modifier => modifier.name).join(' + ')} against ${boss.name}`,
    bossId: boss.id,
    bossName: boss.name,
    bossSubtitle: boss.subtitle,
    bossStory: boss.story,
    bossIntro: boss.intro,
    bossArtworkPath: boss.assetPath,
    bossModelNumber: boss.modelNumber,
    modifiers,
    weeklyRewardName: weeklyReward.name,
    weeklyRewardDescription: weeklyReward.description,
    weeklyRewardItemId: weeklyReward.itemId,
    rewardGoldMultiplier,
    rewardExpMultiplier,
    enemyLevelOffset,
    targetBattles,
  };
}

export const DEFAULT_RANDOM_RUN_PERMANENT_STATS: RandomRunPermanentStats = {
  armyPower: 0,
  defensivePower: 0,
  morale: 0,
  spellPower: 0,
  maxHealth: 0,
  unitPower: 0,
  unitWard: 0,
};

export const RANDOM_RUN_BALANCE = {
  levelCap: 15,
  routeBattleMin: 12,
  routeBattleMax: 15,
  enemyLevelCap: 15,
  bossSpacing: 5,
  minBosses: 2,
  currentContentBosses: 8,
  maxBankedCapLevels: 2,
} as const;

export function getRandomRunEffectiveLevel(level: number): number {
  return Math.max(1, Math.min(RANDOM_RUN_BALANCE.levelCap, Math.floor(toFiniteNumber(level, 1))));
}

export function getRandomRunProgressRatio(level: number): number {
  if (RANDOM_RUN_BALANCE.levelCap <= 1) return 1;
  return (getRandomRunEffectiveLevel(level) - 1) / (RANDOM_RUN_BALANCE.levelCap - 1);
}

function capRandomRunPermanentStats(stats: RandomRunPermanentStats, _runLevel: number = RANDOM_RUN_BALANCE.levelCap): RandomRunPermanentStats {
  void _runLevel;
  return {
    armyPower: Math.max(0, Math.floor(toFiniteNumber(stats.armyPower, 0))),
    defensivePower: Math.max(0, Math.floor(toFiniteNumber(stats.defensivePower, 0))),
    morale: Math.max(0, Math.floor(toFiniteNumber(stats.morale, 0))),
    spellPower: Math.max(0, Math.floor(toFiniteNumber(stats.spellPower, 0))),
    maxHealth: Math.max(0, Math.floor(toFiniteNumber(stats.maxHealth, 0))),
    unitPower: Math.max(0, Math.floor(toFiniteNumber(stats.unitPower, 0))),
    unitWard: Math.max(0, Math.floor(toFiniteNumber(stats.unitWard, 0))),
  };
}

function normalizeRandomRunPermanentStats(stats?: Partial<RandomRunPermanentStats> | null): RandomRunPermanentStats {
  const normalized = {
    armyPower: Math.max(0, Math.floor(toFiniteNumber(stats?.armyPower, 0))),
    defensivePower: Math.max(0, Math.floor(toFiniteNumber(stats?.defensivePower, 0))),
    morale: Math.max(0, Math.floor(toFiniteNumber(stats?.morale, 0))),
    spellPower: Math.max(0, Math.floor(toFiniteNumber(stats?.spellPower, 0))),
    maxHealth: Math.max(0, Math.floor(toFiniteNumber(stats?.maxHealth, 0))),
    unitPower: Math.max(0, Math.floor(toFiniteNumber(stats?.unitPower, 0))),
    unitWard: Math.max(0, Math.floor(toFiniteNumber(stats?.unitWard, 0))),
  };

  return capRandomRunPermanentStats(normalized);
}

export function getRandomRunExpNeeded(level: number): number {
  const safeLevel = getRandomRunEffectiveLevel(level);
  return 160 + safeLevel * 75 + safeLevel * safeLevel * 10;
}

function applyAutomaticRandomRunUpgrade(stats: RandomRunPermanentStats, newLevel: number): RandomRunPermanentStats {
  const upgraded = { ...stats };
  switch (newLevel % 7) {
    case 0:
      upgraded.maxHealth += 10;
      break;
    case 1:
      upgraded.armyPower += 1;
      break;
    case 2:
      upgraded.defensivePower += 1;
      break;
    case 3:
      upgraded.spellPower += 1;
      break;
    case 4:
      upgraded.morale += 1;
      break;
    case 5:
      upgraded.unitPower += 1;
      break;
    default:
      upgraded.unitWard += 1;
      break;
  }
  return upgraded;
}

function normalizeDailyRunState(
  state?: Partial<DailyRunState> | null,
  legacySpellIds: readonly string[] = [],
): DailyRunState {
  const runLevel = getRandomRunEffectiveLevel(toFiniteNumber(state?.runLevel, 1));
  const runExp = Math.max(0, Math.floor(toFiniteNumber(state?.runExp, 0)));
  const history = (state?.history || []).slice(0, 12).map(entry => ({
    ...entry,
    wins: Math.max(0, Math.floor(toFiniteNumber(entry.wins, 0))),
    targetBattles: Math.max(1, Math.floor(toFiniteNumber(entry.targetBattles, 1))),
    unitsStanding: Math.max(0, Math.floor(toFiniteNumber(entry.unitsStanding, 0))),
    gold: Math.max(0, Math.floor(toFiniteNumber(entry.gold, 0))),
    exp: Math.max(0, Math.floor(toFiniteNumber(entry.exp, 0))),
    score: Math.max(0, Math.floor(toFiniteNumber(entry.score, 0))),
    durationMs: Math.max(0, Math.floor(toFiniteNumber(entry.durationMs, 0))),
    bossesDefeated: (entry.bossesDefeated || []).slice(0, 6),
    flawlessBossNames: (entry.flawlessBossNames || []).filter(Boolean).slice(0, 6),
    fastBossNames: (entry.fastBossNames || []).filter(Boolean).slice(0, 6),
    routeSummary: (entry.routeSummary || []).slice(0, 24),
    shopBuys: (entry.shopBuys || []).slice(0, 24),
    shopGoldSpent: Math.max(0, Math.floor(toFiniteNumber(entry.shopGoldSpent, 0))),
    omens: (entry.omens || []).slice(0, 24),
    unlockedSpellNames: (entry.unlockedSpellNames || []).slice(0, 12),
    temporarySpellIds: (entry.temporarySpellIds || []).filter(Boolean).slice(0, 20),
    unitTemplateIds: (entry.unitTemplateIds || []).filter(Boolean).slice(0, 24),
    unitClassIds: (entry.unitClassIds || []).filter(Boolean).slice(0, 8) as MinionClass[],
    tierThreeUnitNames: (entry.tierThreeUnitNames || []).filter(Boolean).slice(0, 12),
    healingDone: Math.max(0, Math.floor(toFiniteNumber(entry.healingDone, 0))),
    unitsLost: Math.max(0, Math.floor(toFiniteNumber(entry.unitsLost, 0))),
    lowestCommanderHealthRatio: Math.max(0, Math.min(1, toFiniteNumber(entry.lowestCommanderHealthRatio, 1))),
    commanderUntouchedBattles: Math.max(0, Math.floor(toFiniteNumber(entry.commanderUntouchedBattles, 0))),
    challengeModifierIds: Array.from(new Set((entry.challengeModifierIds || []).filter(Boolean))).slice(0, 12),
    discoveryOfferIdsSeen: Array.from(new Set((entry.discoveryOfferIdsSeen || []).filter(Boolean))).slice(0, 36),
    runLevelAfter: Math.max(1, Math.floor(toFiniteNumber(entry.runLevelAfter, runLevel))),
    streakAfter: Math.max(0, Math.floor(toFiniteNumber(entry.streakAfter, 0))),
  }));

  const normalized: DailyRunState = {
    lastCompletedDate: state?.lastCompletedDate,
    streak: Math.max(0, Math.floor(toFiniteNumber(state?.streak, 0))),
    bestWins: Math.max(0, Math.floor(toFiniteNumber(state?.bestWins, 0))),
    completions: Math.max(0, Math.floor(toFiniteNumber(state?.completions, 0))),
    history,
    runLevel,
    runExp,
    runUpgradePoints: Math.max(0, Math.floor(toFiniteNumber(state?.runUpgradePoints, 0))),
    permanentStats: capRandomRunPermanentStats(normalizeRandomRunPermanentStats(state?.permanentStats)),
    claimedMilestoneIds: Array.from(new Set((state?.claimedMilestoneIds || []).filter(Boolean))).slice(0, 64),
    milestoneUnlocks: (state?.milestoneUnlocks || []).filter(record => (
      Boolean(record?.id) && Number.isFinite(record?.unlockedAt)
    )),
    discovery: normalizeRunDiscoveryState(state?.discovery, legacySpellIds, history),
  };

  const migrationTimestamp = history[history.length - 1]?.completedAt || 1;
  const withMilestones = syncRunMilestoneUnlockRecords(normalized, migrationTimestamp);
  return {
    ...withMilestones,
    discovery: syncRunDiscoveryState(withMilestones, legacySpellIds, migrationTimestamp),
  };
}

export function getDailyRunState(
  user: (Pick<User, 'dailyRun'> & Partial<Pick<User, 'knownSpellIds'>>) | null | undefined = getCurrentUser(),
): DailyRunState {
  return normalizeDailyRunState(user?.dailyRun, user?.knownSpellIds || []);
}

export function getDailyRunStatus(user: Pick<User, 'dailyRun'> | null | undefined = getCurrentUser(), now = Date.now()): DailyRunStatus {
  const state = getDailyRunState(user);
  const today = formatLocalDate(new Date(now));
  const latestCompletionAt = state.history.find(entry => entry.date === state.lastCompletedDate)?.completedAt || 0;
  const staleSameDateLock = state.lastCompletedDate === today
    && latestCompletionAt > 0
    && now - latestCompletionAt >= DAILY_RESET_MS;

  return {
    today,
    completedToday: state.lastCompletedDate === today && !staleSameDateLock,
    streak: state.streak,
    bestWins: state.bestWins,
    completions: state.completions,
    history: state.history,
  };
}

export function getDailyRunLeaderboard(): DailyRunLeaderboardEntry[] {
  return getUsers()
    .map(user => {
      const state = getDailyRunState(user);
      return {
        username: user.username,
        streak: state.streak,
        bestWins: state.bestWins,
        completions: state.completions,
        lastCompletedDate: state.lastCompletedDate,
      };
    })
    .filter(entry => entry.completions > 0 || entry.bestWins > 0)
    .sort((a, b) => b.streak - a.streak || b.bestWins - a.bestWins || b.completions - a.completions)
    .slice(0, 5);
}

function normalizeLeaderboardUser(user: User): User {
  return {
    ...user,
    inventory: (user.inventory || []).map(normalizeInventoryItem),
    equipment: (user.equipment || []).map(item => ({
      ...item,
      stats: normalizeEquipmentStats(item.stats),
      socketBonuses: normalizeEquipmentSocketBonuses(item.socketBonuses),
    })),
    equippedSlots: user.equippedSlots || {},
    minions: normalizeMinionRoster(user.minions),
    activityLog: user.activityLog || [],
    stats: normalizeCharacterStats(user.stats),
    traveling: user.traveling ?? null,
    jobQueue: user.jobQueue || [],
    selectedModel: [1, 2, 3, 4, 5, 6].includes(user.selectedModel) ? user.selectedModel : 3,
    inventorySlots: user.inventorySlots || BASE_INVENTORY_SLOTS,
    inventoryUpgradeLevel: user.inventoryUpgradeLevel || 0,
    dailyQuests: user.dailyQuests,
    cityQuests: user.cityQuests || [],
    storyQuests: user.storyQuests || [],
    dailyRun: normalizeDailyRunState(user.dailyRun, user.knownSpellIds),
    knownSpellIds: normalizeSpellIds(user.knownSpellIds || DEFAULT_KNOWN_SPELL_IDS),
    equippedSpellIds: (user.equippedSpellIds || DEFAULT_EQUIPPED_SPELL_IDS).slice(0, 4),
    spellUnlockVersion: user.spellUnlockVersion || 1,
    pvpRating: normalizePvpRatingState(user.pvpRating),
  };
}

export function getPvpRating(user: Pick<User, 'pvpRating'> | null | undefined = getCurrentUser()): PvpRatingState {
  return normalizePvpRatingState(user?.pvpRating);
}

export function recordPvpDuelOutcome(
  winnerUsername: string,
  loserUsername: string,
  duelId?: string,
  now = Date.now(),
): { success: boolean; duplicate?: boolean; delta?: ReturnType<typeof calculatePvpRatingDelta> } {
  const winnerKey = normalizeUsername(winnerUsername);
  const loserKey = normalizeUsername(loserUsername);
  if (!winnerKey || !loserKey || winnerKey === loserKey) {
    return { success: false };
  }

  const users = getUsers();
  const winnerIndex = users.findIndex(user => normalizeUsername(user.username) === winnerKey);
  const loserIndex = users.findIndex(user => normalizeUsername(user.username) === loserKey);
  if (winnerIndex === -1 || loserIndex === -1) {
    return { success: false };
  }

  const winnerRating = normalizePvpRatingState(users[winnerIndex].pvpRating);
  const loserRating = normalizePvpRatingState(users[loserIndex].pvpRating);
  const duelReceiptId = duelId?.trim().slice(0, 180);
  if (
    duelReceiptId
    && (
      winnerRating.processedDuelIds?.includes(duelReceiptId)
      || loserRating.processedDuelIds?.includes(duelReceiptId)
    )
  ) {
    return { success: true, duplicate: true };
  }
  const delta = calculatePvpRatingDelta(winnerRating, loserRating);

  users[winnerIndex] = {
    ...users[winnerIndex],
    pvpRating: {
      ...applyPvpRatingWin(winnerRating, delta),
      processedDuelIds: duelReceiptId
        ? [duelReceiptId, ...(winnerRating.processedDuelIds || [])].slice(0, 200)
        : winnerRating.processedDuelIds,
    },
  };
  users[loserIndex] = {
    ...users[loserIndex],
    pvpRating: {
      ...applyPvpRatingLoss(loserRating, delta),
      processedDuelIds: duelReceiptId
        ? [duelReceiptId, ...(loserRating.processedDuelIds || [])].slice(0, 200)
        : loserRating.processedDuelIds,
    },
  };
  if (duelReceiptId) {
    const winnerEngagement = recordUserMultiplayerEvent(users[winnerIndex], {
      id: `pvp-completed-${duelReceiptId}-${winnerKey}`,
      kind: 'pvp-completed',
      occurredAt: now,
      contextId: duelReceiptId,
      targetId: users[loserIndex].username,
    }, now);
    const loserEngagement = recordUserMultiplayerEvent(users[loserIndex], {
      id: `pvp-completed-${duelReceiptId}-${loserKey}`,
      kind: 'pvp-completed',
      occurredAt: now,
      contextId: duelReceiptId,
      targetId: users[winnerIndex].username,
    }, now);
    users[winnerIndex] = { ...users[winnerIndex], ...winnerEngagement };
    users[loserIndex] = { ...users[loserIndex], ...loserEngagement };
  }
  saveUsers(users);

  const sessionUser = readGameJson<User | null>(CURRENT_USER_KEY, null);
  if (sessionUser) {
    const currentKey = normalizeUsername(sessionUser.username);
    if (currentKey === winnerKey) {
      updateCurrentUser({
        pvpRating: users[winnerIndex].pvpRating,
        multiplayerEngagement: users[winnerIndex].multiplayerEngagement,
        multiplayerChronicle: users[winnerIndex].multiplayerChronicle,
      });
    } else if (currentKey === loserKey) {
      updateCurrentUser({
        pvpRating: users[loserIndex].pvpRating,
        multiplayerEngagement: users[loserIndex].multiplayerEngagement,
        multiplayerChronicle: users[loserIndex].multiplayerChronicle,
      });
    }
  }

  return { success: true, delta };
}

export interface CoopRaidRewardGrant {
  gold: number;
  exp: number;
  rareGems: number;
  equipmentRarity: EquipmentRarity;
}

export interface CoopRaidRewardResult {
  success: boolean;
  duplicate?: boolean;
  equipmentName?: string;
  equipmentStored?: boolean;
  error?: string;
}

function applyCommanderExperienceReward(user: User, gainedExp: number): Pick<User, 'exp' | 'stats'> {
  const stats = { ...user.stats };
  let exp = Math.max(0, user.exp + Math.max(0, Math.floor(gainedExp)));

  while (stats.level < MAX_PLAYER_LEVEL) {
    const needed = getExpNeeded(stats.level);
    if (exp < needed) break;
    exp -= needed;
    stats.level += 1;
    stats.unallocatedPoints += 4;
  }

  return { exp, stats };
}

export function recordCoopRaidOutcome(
  username: string,
  raidId: string,
  bossName: string,
  reward: CoopRaidRewardGrant,
  now = Date.now(),
): CoopRaidRewardResult {
  const usernameKey = normalizeUsername(username);
  const normalizedRaidId = raidId.trim().slice(0, 180);
  if (!usernameKey || !normalizedRaidId) return { success: false, error: 'Raid reward identity is invalid.' };

  const users = getUsers();
  const userIndex = users.findIndex(user => normalizeUsername(user.username) === usernameKey);
  if (userIndex === -1) return { success: false, error: 'Raid participant profile was not found.' };
  const user = users[userIndex];
  const receiptId = `coop-completed:${normalizedRaidId}:${usernameKey}`;
  const engagement = normalizeMultiplayerEngagementState(
    user.multiplayerEngagement,
    user.username,
    now,
  );
  if (engagement.events.some(event => event.id === receiptId)) {
    return { success: true, duplicate: true };
  }

  const equipment = generateEquipment(
    60 * 60 * 1000,
    reward.equipmentRarity,
    0,
    user.stats.level || 1,
  );
  if (equipment) equipment.id = `raid-gear-${normalizedRaidId}-${usernameKey}`;
  const equipmentResult = addEquipmentWithLimit(
    user.equipment || [],
    user.equippedSlots || {},
    equipment ? [equipment] : [],
    getInventorySlotCapacity(user),
  );
  const gemResult = addInventoryItemsWithLimit(
    user.inventory || [],
    [makeInventoryItem('rare-gem', Math.max(0, Math.floor(reward.rareGems)))],
    getInventorySlotCapacity(user),
  );
  const experience = applyCommanderExperienceReward(user, reward.exp);

  let engagementUser = user;
  const engagementEvents: MultiplayerEngagementEventInput[] = [
    {
      id: receiptId,
      kind: 'coop-completed',
      occurredAt: now,
      contextId: normalizedRaidId,
      targetId: bossName,
    },
    {
      id: `dungeon-cleared:${normalizedRaidId}:${usernameKey}`,
      kind: 'dungeon-cleared',
      occurredAt: now,
      contextId: normalizedRaidId,
      targetId: bossName,
    },
    {
      id: `battle-result-claimed:${normalizedRaidId}:${usernameKey}`,
      kind: 'battle-result-claimed',
      occurredAt: now,
      contextId: 'coop-raid',
      targetId: bossName,
    },
  ];
  engagementEvents.forEach(event => {
    const updates = recordUserMultiplayerEvent(
      engagementUser,
      event,
      now,
      engagementUser.multiplayerEngagement,
    );
    engagementUser = { ...engagementUser, ...updates };
  });

  const acceptedEquipment = equipmentResult.acceptedEquipment;
  const nextUser: User = {
    ...user,
    ...experience,
    gold: user.gold + Math.max(0, Math.floor(reward.gold)),
    inventory: gemResult.inventory,
    equipment: equipmentResult.equipment,
    multiplayerEngagement: engagementUser.multiplayerEngagement,
    multiplayerChronicle: engagementUser.multiplayerChronicle,
    activityLog: pushActivityEntry(user.activityLog, {
      id: `activity-coop-raid-${normalizedRaidId}-${usernameKey}`,
      type: 'battle',
      title: `Raid Victory: ${bossName}`,
      source: 'Co-op Incursion',
      completedAt: now,
      battleLevel: Math.max(1, user.stats.level),
      description: equipmentResult.rejectedEquipment.length > 0
        ? 'Raid cleared. Gear storage was full, so the chest item was not stored.'
        : 'Raid cleared with a second commander.',
      rewards: {
        gold: Math.max(0, Math.floor(reward.gold)),
        exp: Math.max(0, Math.floor(reward.exp)),
        rareGems: Math.max(0, Math.floor(reward.rareGems)),
        equipment: acceptedEquipment.length > 0 ? acceptedEquipment : undefined,
      },
    }),
  };
  users[userIndex] = nextUser;
  saveUsers(users);

  const current = readGameJson<User | null>(CURRENT_USER_KEY, null);
  if (current && normalizeUsername(current.username) === usernameKey) {
    updateCurrentUser({
      exp: nextUser.exp,
      stats: nextUser.stats,
      gold: nextUser.gold,
      inventory: nextUser.inventory,
      equipment: nextUser.equipment,
      activityLog: nextUser.activityLog,
      multiplayerEngagement: nextUser.multiplayerEngagement,
      multiplayerChronicle: nextUser.multiplayerChronicle,
    });
  }

  return {
    success: true,
    equipmentName: acceptedEquipment[0]?.name,
    equipmentStored: acceptedEquipment.length > 0,
  };
}

function getFieldedMinionPowerScore(user: User): number {
  return getFieldedMinions(user).reduce((total, minion) => {
    const template = getMinionTemplate(minion.templateId);
    if (!template) return total;

    return total
      + template.stats.attack * 8
      + template.stats.defense * 7
      + template.stats.magic * 7
      + template.stats.healing * 6
      + template.stats.health * 2
      + template.stats.movement * 4
      + template.stats.range * 3;
  }, 0);
}

function getPlayerPowerScore(user: User): number {
  return Math.round(
    user.stats.level * 100
    + user.stats.armyPower * 16
    + user.stats.defensivePower * 14
    + user.stats.morale * 9
    + user.stats.spellPower * 15
    + user.stats.maxHealth * 0.8
    + getFieldedMinionPowerScore(user)
  );
}

function makeLeaderboardEntries(
  category: LeaderboardCategory,
  users: User[],
  getScore: (user: User) => number,
  getLabel: (user: User, score: number) => string,
  getDetail: (user: User, score: number) => string
): LeaderboardEntry[] {
  return users
    .map(user => {
      const score = getScore(user);
      return {
        rank: 0,
        username: user.username,
        category,
        score,
        label: getLabel(user, score),
        detail: getDetail(user, score),
        level: user.stats.level,
        selectedModel: user.selectedModel,
      };
    })
    .filter(entry => entry.score > 0)
    .sort((a, b) => b.score - a.score || b.level - a.level || a.username.localeCompare(b.username))
    .slice(0, 10)
    .map((entry, index) => ({ ...entry, rank: index + 1 }));
}

export function getLeaderboardBoards(scope: LeaderboardScope = 'world'): LeaderboardBoard[] {
  const users = getUsers().map(normalizeLeaderboardUser);

  const boards: LeaderboardBoard[] = [
    {
      id: 'power',
      title: 'Commander Power',
      subtitle: 'Level, commander stats, and fielded warband strength.',
      entries: makeLeaderboardEntries(
        'power',
        users,
        getPlayerPowerScore,
        (_user, score) => `${score} power`,
        user => `Level ${user.stats.level} - ${getFieldedMinions(user).length}/${user.minions.length} fielded`
      ),
    },
    {
      id: 'daily',
      title: 'Run',
      subtitle: 'Run chain, best clear depth, and total clears.',
      entries: makeLeaderboardEntries(
        'daily',
        users,
        user => {
          const dailyRun = getDailyRunState(user);
          return dailyRun.streak * 100 + dailyRun.bestWins * 10 + dailyRun.completions;
        },
        user => `${getDailyRunState(user).streak} streak`,
        user => {
          const dailyRun = getDailyRunState(user);
          return `${dailyRun.bestWins} best wins - ${dailyRun.completions} clears`;
        }
      ),
    },
    {
      id: 'gold',
      title: 'Vault Gold',
      subtitle: 'Current spendable gold held by each commander.',
      entries: makeLeaderboardEntries(
        'gold',
        users,
        user => user.gold || 0,
        (_user, score) => `${score} gold`,
        user => `Level ${user.stats.level} - ${getRareGemCount(user)} rare gems`
      ),
    },
    {
      id: 'battles',
      title: 'Battle Victories',
      subtitle: 'Recorded NPC, dungeon, and PVP battle wins.',
      entries: makeLeaderboardEntries(
        'battles',
        users,
        getBattleWinCount,
        (_user, score) => `${score} wins`,
        user => `${(user.activityLog || []).filter(activity => activity.type === 'battle').slice(0, 1)[0]?.title || 'No battle report yet'}`
      ),
    },
    {
      id: 'pvp',
      title: 'PVP Rating',
      subtitle: 'Ranked duel rating from 100 to 300.',
      entries: makeLeaderboardEntries(
        'pvp',
        users,
        user => getPvpRating(user).rating,
        user => `${getPvpRating(user).rating} rating`,
        user => {
          const rating = getPvpRating(user);
          return `${rating.wins}W / ${rating.losses}L · streak ${rating.winStreak || rating.lossStreak * -1}`;
        }
      ),
    },
  ];

  if (scope === 'all') return boards;
  return boards.filter(board => scope === 'run' ? board.id === 'daily' : board.id !== 'daily');
}

export function getNextDailyRunStreak(user: Pick<User, 'dailyRun'>, completedAt = Date.now()): number {
  const state = getDailyRunState(user);
  const completedDate = formatLocalDate(new Date(completedAt));
  const yesterday = getYesterdayDateString(new Date(completedAt));

  if (state.lastCompletedDate === completedDate) return state.streak;
  if (state.lastCompletedDate === yesterday) return state.streak + 1;
  return 1;
}

export function hasCompletedDailyRunToday(user: Pick<User, 'dailyRun'> | null | undefined = getCurrentUser()): boolean {
  return getDailyRunStatus(user).completedToday;
}

export function recordDailyRunCompletionState(
  user: Pick<User, 'dailyRun'>,
  report: Omit<DailyRunHistoryEntry, 'id' | 'date' | 'streakAfter'>
): DailyRunState {
  const state = getDailyRunState(user);
  const completedDate = formatLocalDate(new Date(report.completedAt));
  const nextStreak = state.streak + 1;
  const gainedRunExp = Math.max(0, Math.floor(toFiniteNumber(report.exp, 0)));
  let runLevel = state.runLevel;
  let runExp = state.runExp + gainedRunExp;
  let permanentStats = normalizeRandomRunPermanentStats(state.permanentStats);
  let levelUps = 0;

  while (runExp >= getRandomRunExpNeeded(runLevel) && runLevel < RANDOM_RUN_BALANCE.levelCap) {
    runExp -= getRandomRunExpNeeded(runLevel);
    runLevel += 1;
    levelUps += 1;
    permanentStats = applyAutomaticRandomRunUpgrade(permanentStats, runLevel);
  }

  if (runLevel >= RANDOM_RUN_BALANCE.levelCap) {
    runExp = Math.min(runExp, getRandomRunExpNeeded(runLevel) * RANDOM_RUN_BALANCE.maxBankedCapLevels);
  }

  permanentStats = capRandomRunPermanentStats(permanentStats);

  const entry: DailyRunHistoryEntry = {
    ...report,
    id: `random-run-${completedDate}-${report.completedAt}`,
    date: completedDate,
    runLevelAfter: runLevel,
    streakAfter: nextStreak,
  };

  const withMilestones = syncRunMilestoneUnlockRecords({
    lastCompletedDate: completedDate,
    streak: nextStreak,
    bestWins: Math.max(state.bestWins, report.wins),
    completions: state.completions + 1,
    history: [entry, ...state.history].slice(0, 12),
    runLevel,
    runExp,
    runUpgradePoints: Math.max(0, state.runUpgradePoints + levelUps),
    permanentStats,
    claimedMilestoneIds: state.claimedMilestoneIds || [],
    milestoneUnlocks: state.milestoneUnlocks || [],
    discovery: state.discovery,
  }, report.completedAt);
  return {
    ...withMilestones,
    discovery: syncRunDiscoveryState(withMilestones, [], report.completedAt),
  };
}

export type RandomRunUpgradeStat = keyof RandomRunPermanentStats;

const RANDOM_RUN_UPGRADE_INCREMENTS: Record<RandomRunUpgradeStat, number> = {
  armyPower: 1,
  defensivePower: 1,
  morale: 1,
  spellPower: 1,
  maxHealth: 10,
  unitPower: 1,
  unitWard: 1,
};

function applyRandomRunExperienceGain(state: DailyRunState, gainedExp: number): DailyRunState {
  const safeGain = Math.max(0, Math.floor(gainedExp));
  if (safeGain <= 0) return state;

  let runLevel = state.runLevel;
  let runExp = state.runExp + safeGain;
  let permanentStats = normalizeRandomRunPermanentStats(state.permanentStats);
  let levelUps = 0;

  while (runExp >= getRandomRunExpNeeded(runLevel) && runLevel < RANDOM_RUN_BALANCE.levelCap) {
    runExp -= getRandomRunExpNeeded(runLevel);
    runLevel += 1;
    levelUps += 1;
    permanentStats = applyAutomaticRandomRunUpgrade(permanentStats, runLevel);
  }

  if (runLevel >= RANDOM_RUN_BALANCE.levelCap) {
    runExp = Math.min(runExp, getRandomRunExpNeeded(runLevel) * RANDOM_RUN_BALANCE.maxBankedCapLevels);
  }

  permanentStats = capRandomRunPermanentStats(permanentStats);

  return {
    ...state,
    runLevel,
    runExp,
    runUpgradePoints: Math.max(0, state.runUpgradePoints + levelUps),
    permanentStats,
  };
}

export function spendRunUpgradePoint(
  user: Pick<User, 'dailyRun'>,
  stat: RandomRunUpgradeStat,
): { ok: boolean; message: string; dailyRun: DailyRunState } {
  const state = getDailyRunState(user);
  if (state.runUpgradePoints <= 0) {
    return { ok: false, message: 'No upgrade points available.', dailyRun: state };
  }

  const increment = RANDOM_RUN_UPGRADE_INCREMENTS[stat];
  const nextStats = capRandomRunPermanentStats({
    ...state.permanentStats,
    [stat]: state.permanentStats[stat] + increment,
  });

  if (nextStats[stat] === state.permanentStats[stat]) {
    return { ok: false, message: 'That bonus could not be upgraded.', dailyRun: state };
  }

  const dailyRun: DailyRunState = {
    ...state,
    runUpgradePoints: state.runUpgradePoints - 1,
    permanentStats: nextStats,
  };

  return { ok: true, message: `+${increment} ${stat} applied.`, dailyRun };
}

export function claimRunMilestoneReward(
  user: Pick<User, 'dailyRun'>,
  milestoneId: string,
  rewardExp: number,
  isUnlocked: boolean,
  claimReward?: string,
): { ok: boolean; message: string; dailyRun: DailyRunState } {
  const state = getDailyRunState(user);
  const claimed = new Set(state.claimedMilestoneIds || []);

  if (!isUnlocked) {
    return { ok: false, message: 'That milestone is not unlocked yet.', dailyRun: state };
  }
  if (claimed.has(milestoneId)) {
    return { ok: false, message: 'Milestone reward already claimed.', dailyRun: state };
  }

  const withMilestones = syncRunMilestoneUnlockRecords(applyRandomRunExperienceGain({
    ...state,
    claimedMilestoneIds: [...claimed, milestoneId],
  }, rewardExp), Date.now());
  const dailyRun = {
    ...withMilestones,
    discovery: syncRunDiscoveryState(withMilestones, [], Date.now()),
  };

  return {
    ok: true,
    message: `Milestone reward claimed: +${rewardExp} run XP.${claimReward ? ` ${claimReward}` : ''}`,
    dailyRun,
  };
}

function initializeDailyQuests(now = Date.now()): DailyQuestState {
  return {
    lastResetDate: formatLocalDate(new Date(now)),
    lastResetAt: now,
    quests: [
      {
        id: 'daily-1',
        name: 'Candlelit Errands',
        description: 'Complete 2 field jobs for the night guilds.',
        requirement: {
          type: 'complete_jobs',
          count: 2
        },
        progress: 0,
        claimed: false,
        rewards: {
          guaranteedItem: 'decent',
          legendaryChance: 0.01,
        }
      },
      {
        id: 'daily-2',
        name: 'Vows of the Road',
        description: 'Complete 2 jobs lasting at least 10 minutes.',
        requirement: {
          type: 'complete_timed_jobs',
          count: 2,
          minDuration: 10 * 60 * 1000,
        },
        progress: 0,
        claimed: false,
        rewards: {
          guaranteedItem: 'rare',
          bonusItem: {
            rarity: 'epic',
            chance: 0.10
          },
          legendaryChance: 0.01,
        }
      },
      {
        id: 'daily-3',
        name: 'Oath of the War Commander',
        description: 'Complete 2 jobs lasting at least 30 minutes to earn a Tier I recruit.',
        requirement: {
          type: 'complete_timed_jobs',
          count: 2,
          minDuration: 30 * 60 * 1000,
        },
        progress: 0,
        claimed: false,
        rewards: {
          guaranteedItem: 'epic',
          legendaryChance: 0.01,
          guaranteedMinionTier: 'tier1',
        }
      },
      {
        id: 'daily-gift',
        name: 'Daily Supply Cache',
        description: 'Claim one free supply cache. Most contain gear; recruits are rare.',
        requirement: {
          type: 'collect_daily_gift',
          count: 1,
        },
        progress: 1,
        claimed: false,
        rewards: {
          randomSupply: true,
          guaranteedItem: 'decent',
          legendaryChance: 0.02,
        },
      }
    ]
  };
}

function normalizeDailyQuests(state?: Partial<DailyQuestState> | null, now = Date.now()): DailyQuestState {
  if (!state) return initializeDailyQuests(now);

  const lastResetDate = typeof state.lastResetDate === 'string' ? state.lastResetDate : '';
  const dateStartMs = getDateStringStartMs(lastResetDate);
  const lastResetAt = toFiniteNumber(state.lastResetAt, dateStartMs || 0);
  const today = formatLocalDate(new Date(now));
  const resetByDate = lastResetDate !== today;
  const resetByAge = lastResetAt > 0 && now - lastResetAt >= DAILY_RESET_MS;

  if (resetByDate || resetByAge) return initializeDailyQuests(now);

  const fallback = initializeDailyQuests(lastResetAt || now);
  const quests = fallback.quests.map(template => {
    const existing = (state.quests || []).find(quest => quest.id === template.id);
    if (!existing) return template;

    return {
      ...template,
      progress: Math.max(0, Math.floor(toFiniteNumber(existing.progress, template.progress))),
      claimed: Boolean(existing.claimed),
      claimedAt: existing.claimedAt === undefined ? undefined : toFiniteNumber(existing.claimedAt, now),
    };
  });

  return {
    lastResetDate,
    lastResetAt: lastResetAt || dateStartMs || now,
    quests,
  };
}

export function checkAndResetDailyQuests(): void {
  const currentUser = getCurrentUser();
  if (!currentUser) return;

  const dailyQuests = normalizeDailyQuests(currentUser.dailyQuests);
  if (
    !currentUser.dailyQuests
    || currentUser.dailyQuests.lastResetDate !== dailyQuests.lastResetDate
    || currentUser.dailyQuests.lastResetAt !== dailyQuests.lastResetAt
    || currentUser.dailyQuests.quests.length !== dailyQuests.quests.length
  ) {
    updateCurrentUser({ dailyQuests });
  }
}

function updateQuestProgress(jobDuration: number): void {
  const currentUser = getCurrentUser();
  if (!currentUser) return;

  const dailyQuests = normalizeDailyQuests(currentUser.dailyQuests);
  const updatedQuests = dailyQuests.quests.map(quest => {
    if (quest.claimed) return quest; // Don't update claimed quests
    
    // Check if job meets quest requirements
    if (quest.requirement.type === 'complete_jobs') {
      // Any job counts
      return { ...quest, progress: quest.progress + 1 };
    } else if (quest.requirement.type === 'complete_timed_jobs') {
      // Only jobs meeting duration requirement count
      if (quest.requirement.minDuration && jobDuration >= quest.requirement.minDuration) {
        return { ...quest, progress: quest.progress + 1 };
      }
    } else if (quest.requirement.type === 'collect_daily_gift') {
      return quest;
    }
    
    return quest;
  });

  updateCurrentUser({
    dailyQuests: {
      ...dailyQuests,
      quests: updatedQuests
    }
  });
}

export function claimQuestReward(questId: string): { success: boolean; rewards?: Equipment[]; minions?: MinionStack[]; error?: string } {
  const currentUser = getCurrentUser();
  if (!currentUser) {
    return { success: false, error: 'No daily quests available' };
  }

  const dailyQuests = normalizeDailyQuests(currentUser.dailyQuests);
  const quest = dailyQuests.quests.find(q => q.id === questId);
  if (!quest) {
    return { success: false, error: 'Quest not found' };
  }

  if (quest.claimed) {
    return { success: false, error: 'Quest already claimed' };
  }

  if (quest.progress < quest.requirement.count) {
    return { success: false, error: 'Quest not completed yet' };
  }

  // Generate rewards
  const rewardEquipment: Equipment[] = [];
  const rewardMinions: MinionStack[] = [];

  if (quest.rewards.randomSupply) {
    if (Math.random() < 0.08) {
      const minion = generateMinionDrop(
        5 * 60 * 1000,
        canAcquireMinionTier('tier2', currentUser.stats.level || 1) && Math.random() < 0.10 ? 'tier2' : 'tier1',
        1,
        currentUser.stats.level || 1,
      );
      if (minion) rewardMinions.push(minion);
    } else {
      const forcedRarity: EquipmentRarity = Math.random() < 0.08
        ? 'legendary'
        : Math.random() < 0.28
          ? 'epic'
          : Math.random() < 0.55
            ? 'rare'
            : 'decent';
      const supplyItem = generateLootEquipment({
        source: 'quest',
        forcedRarity,
        playerLevel: currentUser.stats.level || 1,
      });
      if (supplyItem) rewardEquipment.push(supplyItem);
    }
  } else {
    // Guaranteed item
    const guaranteedRarity = capEquipmentRarityForLevel(
      quest.rewards.guaranteedItem,
      currentUser.stats.level || 1,
    );
    const guaranteedItem = guaranteedRarity ? generateEquipment(0, guaranteedRarity) : null;
    if (guaranteedItem) {
      rewardEquipment.push(guaranteedItem);
    }

    // Bonus item (if applicable)
    if (quest.rewards.bonusItem) {
      const bonusRoll = Math.random();
      if (bonusRoll < quest.rewards.bonusItem.chance) {
        const bonusRarity = capEquipmentRarityForLevel(
          quest.rewards.bonusItem.rarity,
          currentUser.stats.level || 1,
        );
        const bonusItem = bonusRarity ? generateEquipment(0, bonusRarity) : null;
        if (bonusItem) {
          rewardEquipment.push(bonusItem);
        }
      }
    }

    // Legendary chance
    const legendaryRoll = Math.random();
    if (legendaryRoll < quest.rewards.legendaryChance) {
      const legendaryRarity = capEquipmentRarityForLevel('legendary', currentUser.stats.level || 1);
      const legendaryItem = legendaryRarity ? generateEquipment(0, legendaryRarity) : null;
      if (legendaryItem) {
        rewardEquipment.push(legendaryItem);
      }
    }

    if (quest.rewards.guaranteedMinionTier) {
      const minion = generateMinionDrop(
        0,
        quest.rewards.guaranteedMinionTier,
        1,
        currentUser.stats.level || 1,
      );

      if (minion) rewardMinions.push(minion);
    } else if (quest.rewards.minionChance && Math.random() < quest.rewards.minionChance.chance) {
      const minion = generateMinionDrop(
        0,
        quest.rewards.minionChance.tier,
        quest.rewards.minionChance.quantity || 1,
        currentUser.stats.level || 1,
      );

      if (minion) {
        rewardMinions.push(minion);
      }
    }
  }

  const gearResult = addEquipmentWithLimit(
    currentUser.equipment || [],
    currentUser.equippedSlots || {},
    rewardEquipment,
    getInventorySlotCapacity(currentUser),
  );
  if (gearResult.rejectedEquipment.length > 0) {
    return { success: false, error: 'Gear storage is full. Sell or equip gear before claiming this reward.' };
  }

  const updatedMinions = mergeMinionStacks(currentUser.minions || [], rewardMinions);
  // Update quest as claimed and add rewards.
  const claimedAt = Date.now();
  const updatedQuests = dailyQuests.quests.map(q => 
    q.id === questId ? { ...q, claimed: true, claimedAt } : q
  );

  const acceptedEquipment = gearResult.acceptedEquipment;
  const updatedActivityLog = pushActivityEntry(currentUser.activityLog, {
    id: `activity-quest-${quest.id}-${claimedAt}`,
    type: 'quest',
    title: quest.name,
    source: 'Daily Quests',
    completedAt: claimedAt,
    rewards: {
      equipment: acceptedEquipment.length > 0 ? acceptedEquipment : undefined,
      minions: rewardMinions.length > 0 ? rewardMinions : undefined,
    },
  });

  updateCurrentUser({
    dailyQuests: {
      ...dailyQuests,
      quests: updatedQuests
    },
    equipment: gearResult.equipment,
    minions: updatedMinions,
    activityLog: updatedActivityLog
  });

  return { success: true, rewards: acceptedEquipment, minions: rewardMinions };
}

export function claimReadyQuestRewards(options: { includeDaily?: boolean } = {}): { success: boolean; claimed: AutoClaimedQuestReward[]; error?: string } {
  let currentUser = getCurrentUser();
  if (!currentUser) return { success: false, claimed: [], error: 'Not logged in.' };

  const claimed: AutoClaimedQuestReward[] = [];

  for (const story of STORY_CHAPTERS.flatMap(chapter => chapter.quests).sort((left, right) => left.order - right.order)) {
    const status = getStoryQuestStatus(currentUser, story.id);
    if (!status.unlocked || !status.complete || status.claimed) continue;

    const result = claimStoryQuestReward(story.id);
    if (result.success) {
      claimed.push({
        id: `auto-story-${story.id}-${Date.now()}`,
        type: 'story',
        kicker: 'Story Quest',
        title: story.name,
        description: story.lore,
        rewards: result.rewards || {},
      });
      currentUser = getCurrentUser();
      if (!currentUser) break;
    }
  }

  if (!currentUser) return { success: true, claimed };

  for (const progress of currentUser.cityQuests || []) {
    const quest = getCityQuestTemplate(progress.questId);
    if (!quest) continue;
    const status = getCityQuestStatus(currentUser, progress.questId);
    if (!status.accepted || !status.complete || status.claimed) continue;

    const result = claimCityQuestReward(progress.questId);
    if (result.success) {
      claimed.push({
        id: `auto-city-${quest.id}-${Date.now()}`,
        type: 'city',
        kicker: quest.town,
        title: quest.name,
        description: quest.description,
        rewards: result.rewards || {},
      });
      currentUser = getCurrentUser();
      if (!currentUser) break;
    }
  }

  if (!currentUser) return { success: true, claimed };

  if (options.includeDaily !== false && currentUser.dailyQuests?.quests) {
    for (const quest of currentUser.dailyQuests.quests) {
      if (quest.claimed || quest.progress < quest.requirement.count) continue;

      const result = claimQuestReward(quest.id);
      if (result.success) {
        claimed.push({
          id: `auto-daily-${quest.id}-${Date.now()}`,
          type: 'daily',
          kicker: 'Daily Oath',
          title: quest.name,
          description: quest.description,
          rewards: {
            equipment: result.rewards && result.rewards.length > 0 ? result.rewards : undefined,
            minions: result.minions && result.minions.length > 0 ? result.minions : undefined,
          },
        });
        currentUser = getCurrentUser();
        if (!currentUser) break;
      }
    }
  }

  return { success: true, claimed };
}

export function levelUp(): void {
  const currentUser = getCurrentUser();
  if (!currentUser) return;

  if (currentUser.stats.level >= MAX_PLAYER_LEVEL) return;

  const expNeeded = getExpNeeded(currentUser.stats.level);
  
  if (currentUser.exp >= expNeeded) {
    const updatedStats = { ...currentUser.stats };
    updatedStats.level = Math.min(MAX_PLAYER_LEVEL, updatedStats.level + 1);
    updatedStats.unallocatedPoints += 4;
    
    updateCurrentUser({ 
      exp: currentUser.exp - expNeeded,
      stats: updatedStats 
    });
  }
}
