// Persisted player model shared by gameplay (lib/auth), Supabase sync, and API routes.
import type { EquipmentQualityLabel } from './gearProgression';
import type { MpDailyDungeonState } from './mpDailyDungeon';
import type { MultiplayerChronicleState } from './multiplayerChronicle';
import type { MultiplayerDeedsState } from './multiplayerDeeds';
import type { MultiplayerEngagementState } from './multiplayerEngagement';
import type { MultiplayerReputationState } from './multiplayerReputation';
import type { PvpRatingState } from './pvpRating';
import type { RunDiscoveryState } from './runDiscovery';
import type { SocialRequestRecord } from './socialRequests';
import type { StoryResponseTone } from './storyDialogue';
import type { TownRecruitmentClaim } from './townRecruitment';
import type { TradeSession } from './tradeSessions';

export type EquipmentSlot = 'sword' | 'shield' | 'armor' | 'armor-pants' | 'boots' | 'gloves' | 'helmet';
export type EquipmentRarity = 'decent' | 'rare' | 'epic' | 'legendary';
export type EquipmentSocketStat = 'armyPower' | 'defensivePower' | 'morale' | 'spellPower' | 'maxHealth';
export type MinionClass = 'wizard' | 'knight' | 'templar' | 'priest';
export type MinionTier = 'tier1' | 'tier2' | 'tier3';
export type ActivityEntryType = 'job' | 'quest' | 'battle' | 'shop' | 'upgrade' | 'travel' | 'item';
export type AllocatableStat = 'armyPower' | 'defensivePower' | 'morale' | 'spellPower' | 'health';
export const MAX_PLAYER_LEVEL = 30;

export interface EquipmentSocketBonus {
  id: string;
  stat: EquipmentSocketStat;
  baseValue: number;
  upgradeLevel: number;
}

export type { EquipmentQualityLabel };

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
  /** Affix roll vs rarity base (typically 0.85–1.15; Lucky+ uses 1.0–1.15). */
  rollMultiplier?: number;
  /** Display quality derived from the affix roll — not a 5th rarity. */
  qualityLabel?: EquipmentQualityLabel;
  /** ~2% of drops; name ends with +, better roll floor. */
  isLucky?: boolean;
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
  multiplayerReputation?: MultiplayerReputationState;
  multiplayerDeeds?: MultiplayerDeedsState;
  chapterTalentIds?: string[];
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
