import type { EquipmentRarity, MinionTier } from './auth';

export type QuestTown = 'Harborview' | 'Riverside' | 'Blackwater Gate' | 'Moonbridge' | 'Ashford' | 'Eclipse Hold';

export type QuestRequirementType =
  | 'complete_jobs'
  | 'complete_timed_jobs'
  | 'complete_jobs_at_poi'
  | 'player_level'
  | 'own_rare_gems'
  | 'collect_item'
  | 'recruit_minions'
  | 'win_battles'
  | 'defeat_enemies_level'
  | 'clear_dungeons'
  | 'visit_poi'
  | 'visit_quest_npc'
  | 'inspect_enemy'
  | 'defeat_boss';

export interface QuestRequirementSpec {
  type: QuestRequirementType;
  count: number;
  minDuration?: number;
  poiId?: string;
  poiName?: string;
  itemId?: string;
  bossId?: string;
  enemyId?: string;
  questNpcId?: string;
  afterQuestId?: string;
  minEnemyLevel?: number;
  maxEnemyLevel?: number;
  minDungeonLevel?: number;
}

export interface QuestRewardSpec {
  gold?: number;
  exp?: number;
  rareGems?: number;
  healthRestore?: number;
  equipmentRarity?: EquipmentRarity;
  minionTier?: MinionTier;
  spellIds?: string[];
  spellChestChance?: number;
  items?: Array<{ itemId: string; quantity: number }>;
}

export interface CityQuestTemplate {
  id: string;
  town: QuestTown;
  faction: string;
  name: string;
  description: string;
  requirement: QuestRequirementSpec;
  rewards: QuestRewardSpec;
  /** When set, the contract only enters rotation after this story quest is claimed. */
  requiresClaimedQuestId?: string;
}

export interface StoryQuestTemplate {
  id: string;
  chapter: string;
  order: number;
  requiredLevel: number;
  name: string;
  lore: string;
  requirement: QuestRequirementSpec;
  rewards: QuestRewardSpec;
  dialogId?: string;
  /** Mainline campaigns gate on previous main quests. Side stories use unlockAfterQuestId. */
  track?: 'main' | 'side';
  unlockAfterQuestId?: string;
}

export interface StoryChapter {
  id: string;
  title: string;
  summary: string;
  quests: StoryQuestTemplate[];
}

export interface QuestNpc {
  id: string;
  name: string;
  title: string;
  faction: string;
  x: number;
  y: number;
  modelNumber: 1 | 2 | 3 | 4 | 5 | 6;
  levelRange: string;
  town: QuestTown;
  line: string;
  questHook: string;
  requirement: QuestRequirementSpec;
  rewards: QuestRewardSpec;
}

export const ONE_MINUTE = 1 * 60 * 1000;
export const TEN_MINUTES = 10 * 60 * 1000;
export const THIRTY_MINUTES = 30 * 60 * 1000;
