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

const ONE_MINUTE = 1 * 60 * 1000;
const TEN_MINUTES = 10 * 60 * 1000;
const THIRTY_MINUTES = 30 * 60 * 1000;

export const CITY_QUESTS: CityQuestTemplate[] = [
  {
    id: 'hv-candle-watch',
    town: 'Harborview',
    faction: 'Candlewardens',
    name: 'Candle Watch',
    description: 'Keep the harbor lanterns lit while the fog presses against the wall.',
    requirement: { type: 'complete_jobs_at_poi', count: 2, poiName: "Fisher's Wharf", minDuration: ONE_MINUTE },
    rewards: { gold: 85, exp: 35, equipmentRarity: 'decent' },
  },
  {
    id: 'hv-salt-vigil',
    town: 'Harborview',
    faction: 'Salt Chapel',
    name: 'Salt Vigil',
    description: 'Carry warding salt between shrines before the drowned lights rise.',
    requirement: { type: 'win_battles', count: 2 },
    rewards: { gold: 135, exp: 65, equipmentRarity: 'decent' },
  },
  {
    id: 'hv-blackwater-nets',
    town: 'Harborview',
    faction: 'Net-Menders',
    name: 'Blackwater Nets',
    description: 'Recover torn moon nets from the lakes and mark any occult catches.',
    requirement: { type: 'complete_timed_jobs', count: 1, minDuration: THIRTY_MINUTES },
    rewards: { gold: 180, exp: 90, rareGems: 2 },
  },
  {
    id: 'hv-hospitaller-round',
    town: 'Harborview',
    faction: 'Hospitaller Lanterns',
    name: 'Hospitaller Round',
    description: 'Bring medicine to wounded field workers and receive a blessing in kind.',
    requirement: { type: 'complete_jobs_at_poi', count: 2, poiName: 'Pilgrim Fire' },
    rewards: { gold: 110, exp: 95, healthRestore: 40 },
  },
  {
    id: 'hv-violet-tithe',
    town: 'Harborview',
    faction: 'Violet Tithe',
    name: 'Violet Tithe',
    description: 'Offer rare gems to the city vault so the armorers can wake an old forge.',
    requirement: { type: 'own_rare_gems', count: 2 },
    rewards: { gold: 240, exp: 130, equipmentRarity: 'rare' },
  },
  {
    id: 'hv-drowned-catechism',
    town: 'Harborview',
    faction: 'Salt Chapel',
    name: 'Drowned Catechism',
    description: 'Copy prayers from a book that was found dry beneath the black lake.',
    requirement: { type: 'collect_item', count: 2, itemId: 'black-amber' },
    rewards: { gold: 330, exp: 180, equipmentRarity: 'rare' },
  },
  {
    id: 'hv-starless-writ',
    town: 'Harborview',
    faction: 'Relic Weighers',
    name: 'Starless Writ',
    description: 'Recover a sealed writ naming the first war-wizard who broke the coast.',
    requirement: { type: 'collect_item', count: 1, itemId: 'candle-key-fragment' },
    rewards: { gold: 400, exp: 240, equipmentRarity: 'epic' },
  },
  {
    id: 'hv-harbor-marshal',
    town: 'Harborview',
    faction: 'Candlewardens',
    name: 'Harbor Marshal',
    description: 'Earn the right to command under Harborview law and carry its black pennon.',
    requirement: { type: 'player_level', count: 10 },
    rewards: { gold: 520, exp: 310, rareGems: 2, equipmentRarity: 'rare' },
  },
  {
    id: 'rs-bridge-bells',
    town: 'Riverside',
    faction: 'Bridge Bell Monks',
    name: 'Bridge Bells',
    description: 'Ring the crossing bells before dusk and listen for the bell that answers back.',
    requirement: { type: 'complete_jobs_at_poi', count: 2, poiName: 'Hilltop Windmill', minDuration: ONE_MINUTE },
    rewards: { gold: 90, exp: 35, equipmentRarity: 'decent' },
  },
  {
    id: 'rs-ancestor-masks',
    town: 'Riverside',
    faction: 'Mask Keepers',
    name: 'Ancestor Masks',
    description: 'Recover ancestor masks from abandoned farms before the names fade.',
    requirement: { type: 'defeat_enemies_level', count: 3, minEnemyLevel: 2, maxEnemyLevel: 6 },
    rewards: { gold: 170, exp: 90, equipmentRarity: 'decent' },
  },
  {
    id: 'rs-bitter-beans',
    town: 'Riverside',
    faction: 'Night Roasters',
    name: 'Bitter Beans',
    description: 'Gather vigil coffee and roast it for priests who refuse sleep.',
    requirement: { type: 'complete_jobs_at_poi', count: 2, poiName: 'Vigil Coffee Estate', minDuration: TEN_MINUTES },
    rewards: { gold: 240, exp: 140, healthRestore: 50 },
  },
  {
    id: 'rs-violet-current',
    town: 'Riverside',
    faction: 'River Shrine',
    name: 'Violet Current',
    description: 'Trade rare gems to wake the shrine current beneath the old bridge.',
    requirement: { type: 'own_rare_gems', count: 3 },
    rewards: { gold: 340, exp: 170, equipmentRarity: 'rare' },
  },
  {
    id: 'rs-stone-hermit',
    town: 'Riverside',
    faction: 'Mountain Hermits',
    name: 'Stone Hermit',
    description: 'Carry a sealed meal to a hermit who blesses armies and curses commanders.',
    requirement: { type: 'complete_timed_jobs', count: 2, minDuration: THIRTY_MINUTES },
    rewards: { gold: 380, exp: 220, rareGems: 2 },
  },
  {
    id: 'rs-bell-tower-keys',
    town: 'Riverside',
    faction: 'Bridge Bell Monks',
    name: 'Bell Tower Keys',
    description: 'Recover keys that open no tower visible from the riverbank.',
    requirement: { type: 'clear_dungeons', count: 1, minDungeonLevel: 2 },
    rewards: { gold: 390, exp: 220, equipmentRarity: 'rare' },
  },
  {
    id: 'rs-black-lotus',
    town: 'Riverside',
    faction: 'Lotus Scriptorium',
    name: 'Black Lotus Margin',
    description: 'Annotate forbidden diagrams without waking the ink in the margins.',
    requirement: { type: 'collect_item', count: 2, itemId: 'black-amber' },
    rewards: { gold: 460, exp: 280, equipmentRarity: 'epic' },
  },
  {
    id: 'rs-riverside-marshal',
    town: 'Riverside',
    faction: 'River Council',
    name: 'Riverside Marshal',
    description: 'Earn command rights in Riverside and take a writ for the eastern marches.',
    requirement: { type: 'player_level', count: 11 },
    rewards: { gold: 580, exp: 360, rareGems: 3, equipmentRarity: 'epic' },
  },
  {
    id: 'mb-drowned-ledger',
    town: 'Moonbridge',
    faction: 'Star Lawkeepers',
    name: 'Drowned Ledger',
    description: 'Work two Moonwell Pier shifts and recover the names washed from its tithe book.',
    requirement: { type: 'complete_jobs_at_poi', count: 2, poiName: 'Moonwell Pier', minDuration: ONE_MINUTE },
    rewards: { gold: 240, exp: 130, rareGems: 1 },
  },
  {
    id: 'mb-long-bell-vigil',
    town: 'Moonbridge',
    faction: 'Bridge Bell Monks',
    name: 'Long Bell Vigil',
    description: 'Complete one full ten-minute watch while the drowned bell tests the bridge wards.',
    requirement: { type: 'complete_timed_jobs', count: 1, minDuration: TEN_MINUTES },
    rewards: { gold: 280, exp: 150, equipmentRarity: 'decent' },
  },
  {
    id: 'mb-root-road',
    town: 'Moonbridge',
    faction: 'River Concord',
    name: 'Root Road',
    description: 'Defeat two veteran warbands carrying black roots between the river and Moonwell Pier.',
    requirement: { type: 'defeat_enemies_level', count: 2, minEnemyLevel: 6, maxEnemyLevel: 9 },
    rewards: { gold: 310, exp: 165, equipmentRarity: 'rare' },
  },
  {
    id: 'mb-candle-patrol',
    town: 'Moonbridge',
    faction: 'Candle Compact',
    name: 'Candle Patrol',
    description: 'Win two field battles before candle-fire scouts can close the Moonbridge road.',
    requirement: { type: 'win_battles', count: 2 },
    rewards: { gold: 330, exp: 180, healthRestore: 45 },
  },
  {
    id: 'mb-ossuary-sounding',
    town: 'Moonbridge',
    faction: 'Ossuary Order',
    name: 'Ossuary Sounding',
    description: 'Clear one level-two-or-higher dungeon and return its ward echo to the bridge monks.',
    requirement: { type: 'clear_dungeons', count: 1, minDungeonLevel: 2 },
    rewards: { gold: 370, exp: 200, rareGems: 2 },
  },
  {
    id: 'mb-black-amber-proof',
    town: 'Moonbridge',
    faction: 'Relic Weighers',
    name: 'Black Amber Proof',
    description: 'Carry two pieces of black amber so the pier scribes can compare the new root growth.',
    requirement: { type: 'collect_item', count: 2, itemId: 'black-amber' },
    rewards: { gold: 400, exp: 215, equipmentRarity: 'rare' },
  },
  {
    id: 'mb-violet-reserve',
    town: 'Moonbridge',
    faction: 'River Shrine',
    name: 'Violet Reserve',
    description: 'Show two rare gems to prove the bridge evacuation fund can survive another breach.',
    requirement: { type: 'own_rare_gems', count: 2 },
    rewards: { gold: 430, exp: 230, equipmentRarity: 'rare' },
  },
  {
    id: 'mb-moonbridge-writ',
    town: 'Moonbridge',
    faction: 'River Council',
    name: 'Moonbridge Writ',
    description: 'Reach level ten and receive the veteran writ used to enter the eastern march.',
    requirement: { type: 'player_level', count: 10 },
    rewards: { gold: 520, exp: 280, rareGems: 2, equipmentRarity: 'epic' },
  },
  {
    id: 'mb-eastern-march-preview',
    town: 'Moonbridge',
    faction: 'Veil Scouts',
    name: 'Eastern March Preview',
    description: 'After the Moonwell is sealed, scout East Road Camp and prove the iron choir has not yet claimed the bridge\'s eastern rumor line.',
    requiresClaimedQuestId: 'story-14-moonwell-sealed',
    requirement: { type: 'visit_poi', count: 1, poiName: 'East Road Camp' },
    rewards: { gold: 480, exp: 250, rareGems: 2, equipmentRarity: 'rare' },
  },
  {
    id: 'af-field-wards',
    town: 'Ashford',
    faction: 'Ashfield Reeve',
    name: 'Field Wards',
    description: 'Reset the ward posts around Witherfield before the dead wheat turns toward town.',
    requirement: { type: 'complete_jobs_at_poi', count: 2, poiName: 'Witherfield Farm', minDuration: ONE_MINUTE },
    rewards: { gold: 260, exp: 145, healthRestore: 35 },
  },
  {
    id: 'af-road-levy',
    town: 'Ashford',
    faction: 'Ash Road Watch',
    name: 'Road Levy',
    description: 'Break the veteran warbands collecting false tolls along the western ash road.',
    requirement: { type: 'defeat_enemies_level', count: 3, minEnemyLevel: 7, maxEnemyLevel: 12 },
    rewards: { gold: 320, exp: 180, equipmentRarity: 'rare' },
  },
  {
    id: 'af-amber-reliquary',
    town: 'Ashford',
    faction: 'Cinder Reliquary',
    name: 'Amber Reliquary',
    description: 'Recover black amber for a reliquary that keeps the pilgrim dead quiet.',
    requirement: { type: 'collect_item', count: 2, itemId: 'black-amber' },
    rewards: { gold: 350, exp: 195, rareGems: 1 },
  },
  {
    id: 'af-crypt-sounding',
    town: 'Ashford',
    faction: 'Grave Bell Order',
    name: 'Crypt Sounding',
    description: 'Clear a deep dungeon and return with the tone struck by its final ward stone.',
    requirement: { type: 'clear_dungeons', count: 1, minDungeonLevel: 4 },
    rewards: { gold: 410, exp: 230, equipmentRarity: 'rare' },
  },
  {
    id: 'af-long-vigil',
    town: 'Ashford',
    faction: 'Pilgrim Hospice',
    name: 'Long Vigil',
    description: 'Hold one full road watch while the hospice moves its wounded through the ash fields.',
    requirement: { type: 'complete_timed_jobs', count: 1, minDuration: THIRTY_MINUTES },
    rewards: { gold: 460, exp: 250, rareGems: 2, healthRestore: 60 },
  },
  {
    id: 'af-crossroads-rumor',
    town: 'Ashford',
    faction: 'Ash Road Watch',
    name: 'Crossroads Rumor',
    description: 'Reach Crossroads Camp and confirm no mirror scout has bought the western rumor line.',
    requirement: { type: 'visit_poi', count: 1, poiName: 'Crossroads Camp' },
    rewards: { gold: 300, exp: 165, equipmentRarity: 'rare' },
  },
  {
    id: 'af-banner-muster',
    town: 'Ashford',
    faction: 'Ashfield Reeve',
    name: 'Banner Muster',
    description: 'Win two field battles and bring the ash-road muster report back to the reeve.',
    requirement: { type: 'win_battles', count: 2 },
    rewards: { gold: 340, exp: 190, equipmentRarity: 'rare', rareGems: 1 },
  },
  {
    id: 'af-pilgrim-gems',
    town: 'Ashford',
    faction: 'Cinder Reliquary',
    name: 'Pilgrim Gems',
    description: 'Show two rare gems so the reliquary can fund one more ash-road healing wagon.',
    requirement: { type: 'own_rare_gems', count: 2 },
    rewards: { gold: 380, exp: 210, healthRestore: 45, rareGems: 1 },
  },
  {
    id: 'bw-moonwell-tithe',
    town: 'Blackwater Gate',
    faction: 'Moon Tithe',
    name: 'Moonwell Tithe',
    description: 'Work the Moonwell Pier ledgers before mirror agents forge the entries.',
    requirement: { type: 'complete_jobs_at_poi', count: 2, poiName: 'Moonwell Pier', minDuration: ONE_MINUTE },
    rewards: { gold: 420, exp: 240, rareGems: 2 },
  },
  {
    id: 'bw-scout-breaker',
    town: 'Blackwater Gate',
    faction: 'Gate Watch',
    name: 'Scout Breaker',
    description: 'Break mirror warbands stalking the roads between level fourteen and nineteen.',
    requirement: { type: 'defeat_enemies_level', count: 3, minEnemyLevel: 14, maxEnemyLevel: 19 },
    rewards: { gold: 480, exp: 280, equipmentRarity: 'rare' },
  },
  {
    id: 'bw-ossuary-proof',
    town: 'Blackwater Gate',
    faction: 'Relic Weighers',
    name: 'Ossuary Proof',
    description: 'Clear a sealed dungeon and bring back its ward stone.',
    requirement: { type: 'clear_dungeons', count: 1, minDungeonLevel: 5 },
    rewards: { gold: 540, exp: 320, equipmentRarity: 'epic' },
  },
  {
    id: 'bw-quarry-tally',
    town: 'Blackwater Gate',
    faction: 'Blackwater Syndicate',
    name: 'Quarry Tally',
    description: 'Work Granite Heights Quarry and return with a signed eastern stone tally.',
    requirement: { type: 'complete_jobs_at_poi', count: 2, poiName: 'Granite Heights Quarry', minDuration: ONE_MINUTE },
    rewards: { gold: 450, exp: 255, equipmentRarity: 'rare' },
  },
  {
    id: 'bw-gate-watch',
    town: 'Blackwater Gate',
    faction: 'Gate Watch',
    name: 'Gate Watch',
    description: 'Stand a proper timed watch so the gate bells stay honest after midnight.',
    requirement: { type: 'complete_timed_jobs', count: 2, minDuration: ONE_MINUTE },
    rewards: { gold: 470, exp: 265, rareGems: 1, healthRestore: 40 },
  },
  {
    id: 'bw-amber-bond',
    town: 'Blackwater Gate',
    faction: 'Relic Weighers',
    name: 'Amber Bond',
    description: 'Deliver two pieces of black amber to seal a syndicate escrow against forged writs.',
    requirement: { type: 'collect_item', count: 2, itemId: 'black-amber' },
    rewards: { gold: 500, exp: 285, rareGems: 2 },
  },
  {
    id: 'bw-east-road-camp',
    town: 'Blackwater Gate',
    faction: 'Ossuary Order',
    name: 'East Road Sounding',
    description: 'Reach East Road Camp and confirm the rumor line still answers living scouts.',
    requirement: { type: 'visit_poi', count: 1, poiName: 'East Road Camp' },
    rewards: { gold: 430, exp: 245, equipmentRarity: 'rare' },
  },
  {
    id: 'bw-writ-proof',
    town: 'Blackwater Gate',
    faction: 'Blackwater Syndicate',
    name: 'Writ Proof',
    description: 'Win two field battles and bring the broken mirror seals back to the gate ledger.',
    requirement: { type: 'win_battles', count: 2 },
    rewards: { gold: 520, exp: 300, equipmentRarity: 'epic' },
  },
  {
    id: 'eh-mirror-hunt',
    town: 'Eclipse Hold',
    faction: 'Eclipse Tribunal',
    name: 'Mirror Hunt',
    description: 'Hunt veteran warbands between level twenty and twenty-six on the eclipse marches.',
    requirement: { type: 'defeat_enemies_level', count: 4, minEnemyLevel: 20, maxEnemyLevel: 26 },
    rewards: { gold: 620, exp: 380, equipmentRarity: 'epic', rareGems: 2 },
  },
  {
    id: 'eh-deep-chamber',
    town: 'Eclipse Hold',
    faction: 'Ossuary Order',
    name: 'Deep Chamber',
    description: 'Clear two veteran dungeons beneath the hold.',
    requirement: { type: 'clear_dungeons', count: 2, minDungeonLevel: 10 },
    rewards: { gold: 700, exp: 420, equipmentRarity: 'legendary' },
  },
  {
    id: 'eh-candle-council',
    town: 'Eclipse Hold',
    faction: 'Candle Synod',
    name: 'Candle Council',
    description: 'Gather candle key fragments for the archivist before the court seals the hold.',
    requirement: { type: 'collect_item', count: 3, itemId: 'candle-key-fragment' },
    rewards: { gold: 760, exp: 460, rareGems: 3, spellIds: ['iron-benediction'] },
  },
  {
    id: 'eh-plantation-watch',
    town: 'Eclipse Hold',
    faction: 'Moon Observers',
    name: 'Plantation Watch',
    description: 'Work Black Dawn Plantation shifts before mirror overseers rewrite the harvest tallies.',
    requirement: { type: 'complete_jobs_at_poi', count: 2, poiName: 'Black Dawn Plantation', minDuration: ONE_MINUTE },
    rewards: { gold: 580, exp: 350, equipmentRarity: 'epic' },
  },
  {
    id: 'eh-long-eclipse',
    town: 'Eclipse Hold',
    faction: 'Eclipse Tribunal',
    name: 'Long Eclipse',
    description: 'Hold one full veteran watch while the hold relocates its glass wards.',
    requirement: { type: 'complete_timed_jobs', count: 1, minDuration: THIRTY_MINUTES },
    rewards: { gold: 640, exp: 390, rareGems: 2, healthRestore: 50 },
  },
  {
    id: 'eh-shadowgrove-scout',
    town: 'Eclipse Hold',
    faction: 'Moon Court',
    name: 'Shadowgrove Scout',
    description: 'Reach Shadowgrove and confirm no mirror camp has claimed the southeast thicket.',
    requirement: { type: 'visit_poi', count: 1, poiName: 'Shadowgrove' },
    rewards: { gold: 560, exp: 340, equipmentRarity: 'rare' },
  },
  {
    id: 'eh-hold-battles',
    town: 'Eclipse Hold',
    faction: 'Eclipse Tribunal',
    name: 'Hold Battles',
    description: 'Win three battles on the eclipse marches and return with formation reports.',
    requirement: { type: 'win_battles', count: 3 },
    rewards: { gold: 660, exp: 400, equipmentRarity: 'epic', rareGems: 1 },
  },
  {
    id: 'eh-gem-reserve',
    town: 'Eclipse Hold',
    faction: 'Glass Reliquary',
    name: 'Gem Reserve',
    description: 'Show three rare gems so the hold can fund one more sealed chamber expedition.',
    requirement: { type: 'own_rare_gems', count: 3 },
    rewards: { gold: 720, exp: 430, equipmentRarity: 'legendary' },
  },
];

export const STORY_CHAPTERS: StoryChapter[] = [
  {
    id: 'chapter-1',
    title: 'Chapter I: The Eclipsed Banner',
    summary: 'A new commander gathers minions, studies king-magic, and follows the trail of a war-wizard whose eclipse army broke the old roads.',
    quests: [
      {
        id: 'story-01-first-banner',
        chapter: 'chapter-1',
        order: 1,
        requiredLevel: 1,
        name: 'First Banner',
        lore: 'The road accepts no commander without a banner. Raise yours under the first moon and learn who salutes.',
        dialogId: 'story-01-first-banner',
        requirement: { type: 'complete_jobs', count: 1 },
        rewards: { gold: 80, exp: 40, minionTier: 'tier1' },
      },
      {
        id: 'story-02-candle-road',
        chapter: 'chapter-1',
        order: 2,
        requiredLevel: 1,
        name: 'The Candle Road',
        lore: 'Harborview claims the old road was once lit by saints, scholars, and oath fires. Walk to its gates and report to the candle court.',
        dialogId: 'story-02-candle-road',
        requirement: { type: 'visit_poi', count: 1, poiName: 'Harborview' },
        rewards: { gold: 120, exp: 70, equipmentRarity: 'decent', spellIds: ['thorn-ward'] },
      },
      {
        id: 'story-03-lost-apprentice',
        chapter: 'chapter-1',
        order: 3,
        requiredLevel: 1,
        name: "Marshal's Muster",
        lore: 'Sister Avel sends the new banner to Marshal Orren, who keeps Harborview field law and the western muster roll.',
        dialogId: 'story-03-lost-apprentice',
        requirement: { type: 'visit_quest_npc', count: 1, questNpcId: 'quest-npc-marshal-orren' },
        rewards: { gold: 150, exp: 90, minionTier: 'tier1' },
      },
      {
        id: 'story-04-river-law',
        chapter: 'chapter-1',
        order: 4,
        requiredLevel: 2,
        name: 'Trial by Steel',
        lore: 'Marshal Orren will not recognize a paper formation. Defeat a hostile warband and return with the commander standing.',
        dialogId: 'story-04-river-law',
        requirement: { type: 'win_battles', count: 1 },
        rewards: { gold: 180, exp: 110, rareGems: 1, spellIds: ['gravity-snare'] },
      },
      {
        id: 'story-05-violet-satchel',
        chapter: 'chapter-1',
        order: 5,
        requiredLevel: 2,
        name: 'River Law',
        lore: 'The first victory opens the eastern road. Reach Riverside and learn why its bells have begun answering Black Pike signals.',
        dialogId: 'story-05-violet-satchel',
        requirement: { type: 'visit_poi', count: 1, poiName: 'Riverside' },
        rewards: { gold: 220, exp: 130, equipmentRarity: 'rare' },
      },
      {
        id: 'story-06-black-pike',
        chapter: 'chapter-1',
        order: 6,
        requiredLevel: 3,
        name: 'Black Pike Warning',
        lore: 'A Black Pike lieutenant has raised a toll camp beyond Riverside. Read the scout report before committing your banner.',
        dialogId: 'story-06-black-pike',
        requirement: { type: 'inspect_enemy', count: 1, enemyId: 'story-boss-black-pike-lieutenant' },
        rewards: { gold: 260, exp: 160, minionTier: 'tier2', spellIds: ['chain-spark'] },
      },
      {
        id: 'story-07-broken-toll',
        chapter: 'chapter-1',
        order: 7,
        requiredLevel: 5,
        name: 'The Broken Toll',
        lore: 'The lieutenant has measured your army and kept the road closed. Break the Black Pike toll and carry Orren\'s law through the camp.',
        dialogId: 'story-07-broken-toll',
        requirement: {
          type: 'defeat_boss',
          count: 1,
          bossId: 'black-pike-lieutenant',
          enemyId: 'story-boss-black-pike-lieutenant',
        },
        rewards: { gold: 420, exp: 320, rareGems: 2, equipmentRarity: 'rare', spellIds: ['withering-curse'] },
      },
      {
        id: 'story-08-banner-recognized',
        chapter: 'chapter-1',
        order: 8,
        requiredLevel: 5,
        name: 'Banner Recognized',
        lore: 'Carry Lieutenant Veyr\'s broken pike back to Marshal Orren and receive Harborview\'s recognition before the Moonwell road opens.',
        dialogId: 'story-08-banner-recognized',
        requirement: {
          type: 'visit_quest_npc',
          count: 1,
          questNpcId: 'quest-npc-marshal-orren',
          afterQuestId: 'story-07-broken-toll',
        },
        rewards: { gold: 500, exp: 380, rareGems: 3, minionTier: 'tier2', spellIds: ['royal-command'] },
      },
      {
        id: 'story-09-moonwell-summons',
        chapter: 'chapter-1',
        order: 9,
        requiredLevel: 6,
        name: 'The Drowned Summons',
        lore: 'Contact: Scribe Naima at Riverside. Consequence: Black Pike coin sits beside names scraped from the Moonwell Pier ledger—living people still walk those erasures.',
        dialogId: 'story-09-moonwell-summons',
        requirement: { type: 'visit_quest_npc', count: 1, questNpcId: 'quest-npc-scribe-naima' },
        rewards: { gold: 260, exp: 150, rareGems: 1 },
      },
      {
        id: 'story-07-moonwell',
        chapter: 'chapter-1',
        order: 10,
        requiredLevel: 6,
        name: 'Road to the Drowned Pier',
        lore: 'Place: Moonwell Pier. Consequence: midnight cargo marks still guard the drowned road; reflections there know your name before you speak.',
        dialogId: 'story-07-moonwell',
        requirement: { type: 'visit_poi', count: 1, poiName: 'Moonwell Pier' },
        rewards: { gold: 280, exp: 160, equipmentRarity: 'decent' },
      },
      {
        id: 'story-10-moonwell-tithe',
        chapter: 'chapter-1',
        order: 11,
        requiredLevel: 7,
        name: 'Names Beneath the Tithe',
        lore: 'Place: Moonwell Pier work shifts. Consequence: honest cargo separates from the candle-cult recruitment cipher Naima needs to prove the tithe is alive.',
        dialogId: 'story-10-moonwell-tithe',
        requirement: { type: 'complete_jobs_at_poi', count: 2, poiName: 'Moonwell Pier', minDuration: ONE_MINUTE },
        rewards: { gold: 300, exp: 175, rareGems: 1 },
      },
      {
        id: 'story-08-templar-seal',
        chapter: 'chapter-1',
        order: 12,
        requiredLevel: 7,
        name: 'The Tongueless Bell',
        lore: 'Contact: Brother Kaito on the river road. Consequence: the cipher is a drowned bell sequence that wakes roots beneath the graves.',
        dialogId: 'story-08-templar-seal',
        requirement: { type: 'visit_quest_npc', count: 1, questNpcId: 'quest-npc-brother-kaito' },
        rewards: { gold: 320, exp: 185, equipmentRarity: 'rare', spellIds: ['judgement'] },
      },
      {
        id: 'story-10-blackroot-warning',
        chapter: 'chapter-1',
        order: 13,
        requiredLevel: 8,
        name: 'Blackroot on the Road',
        lore: 'Place: the drowned approach near Moonwell Pier. Consequence: a named Blackroot Vessel finishes the interrupted bell—read its host before you strike.',
        dialogId: 'story-10-blackroot-warning',
        requirement: { type: 'inspect_enemy', count: 1, enemyId: 'story-elite-blackroot-vessel' },
        rewards: { gold: 340, exp: 195, rareGems: 1 },
      },
      {
        id: 'story-09-gravebound-script',
        chapter: 'chapter-1',
        order: 14,
        requiredLevel: 8,
        name: 'The Blackroot Vessel',
        lore: 'Place: drowned road elite. Consequence: break the vessel and recover root-scarred orders that name Mother Cindervein.',
        dialogId: 'story-09-gravebound-script',
        requirement: { type: 'defeat_boss', count: 1, bossId: 'blackroot-vessel', enemyId: 'story-elite-blackroot-vessel' },
        rewards: { gold: 380, exp: 220, equipmentRarity: 'rare' },
      },
      {
        id: 'story-12-cindervein-warning',
        chapter: 'chapter-1',
        order: 15,
        requiredLevel: 9,
        name: 'The Mother of Black Candles',
        lore: 'Place: Moonwell Pier capstone host. Consequence: Mother Cindervein keeps a black candle for every stolen name—inspect before the final count.',
        dialogId: 'story-12-cindervein-warning',
        requirement: { type: 'inspect_enemy', count: 1, enemyId: 'story-boss-mother-cindervein' },
        rewards: { gold: 410, exp: 235, rareGems: 1 },
      },
      {
        id: 'story-10-field-council',
        chapter: 'chapter-1',
        order: 16,
        requiredLevel: 10,
        name: 'The Drowned Moonwell',
        lore: 'Place: candle host beneath the pier. Consequence: defeat Mother Cindervein and end the recruitment rite before erased names become soldiers.',
        dialogId: 'story-10-field-council',
        requirement: { type: 'defeat_boss', count: 1, bossId: 'mother-cindervein', enemyId: 'story-boss-mother-cindervein' },
        rewards: { gold: 500, exp: 300, rareGems: 2, equipmentRarity: 'epic', minionTier: 'tier2', spellIds: ['frost-lance'] },
      },
      {
        id: 'story-14-moonwell-sealed',
        chapter: 'chapter-1',
        order: 17,
        requiredLevel: 10,
        name: 'Names Returned to the River',
        lore: 'Contact: Scribe Naima at Riverside. Consequence: return the burned ledger so drowned recruits are named, released, and the eastern march can open.',
        dialogId: 'story-14-moonwell-sealed',
        requirement: {
          type: 'visit_quest_npc',
          count: 1,
          questNpcId: 'quest-npc-scribe-naima',
          afterQuestId: 'story-10-field-council',
        },
        rewards: { gold: 560, exp: 330, rareGems: 3, spellIds: ['royal-command'] },
      },
      {
        id: 'story-side-silk-scout',
        chapter: 'chapter-1',
        order: 171,
        requiredLevel: 7,
        track: 'side',
        unlockAfterQuestId: 'story-07-moonwell',
        name: 'Silk Under Stone',
        lore: 'Contact: Brother Kaito. Place: Moonbridge underside. Consequence: Moonfen broodlings are spinning cathedral silk into the bridge stones—inspect the first nest risk.',
        dialogId: 'story-side-silk-scout',
        requirement: { type: 'inspect_enemy', count: 1, enemyId: 'story-elite-moonfen-brood' },
        rewards: { gold: 220, exp: 120, rareGems: 1 },
      },
      {
        id: 'story-side-silk-clear',
        chapter: 'chapter-1',
        order: 172,
        requiredLevel: 8,
        track: 'side',
        unlockAfterQuestId: 'story-side-silk-scout',
        name: 'Clear the Bridge Nest',
        lore: 'Place: Moonbridge brood nest. Consequence: defeat the Moonfen Brood Mother before silk seals the river crossing.',
        dialogId: 'story-side-silk-clear',
        requirement: {
          type: 'defeat_boss',
          count: 1,
          bossId: 'moonfen-brood-mother',
          enemyId: 'story-elite-moonfen-brood',
        },
        rewards: { gold: 300, exp: 170, equipmentRarity: 'rare', items: [{ itemId: 'cathedral-silk', quantity: 1 }] },
      },
      {
        id: 'story-side-silk-return',
        chapter: 'chapter-1',
        order: 173,
        requiredLevel: 8,
        track: 'side',
        unlockAfterQuestId: 'story-side-silk-clear',
        name: 'Cathedral Silk Delivered',
        lore: 'Contact: Brother Kaito. Consequence: deliver cathedral silk so the Bridge Bell Monks can reweave the wards under Moonbridge.',
        dialogId: 'story-side-silk-return',
        requirement: {
          type: 'visit_quest_npc',
          count: 1,
          questNpcId: 'quest-npc-brother-kaito',
          afterQuestId: 'story-side-silk-clear',
        },
        rewards: { gold: 280, exp: 150, rareGems: 1, spellIds: ['judgement'] },
      },
      {
        id: 'story-side-tithe-cutters',
        chapter: 'chapter-1',
        order: 174,
        requiredLevel: 7,
        track: 'side',
        unlockAfterQuestId: 'story-10-moonwell-tithe',
        name: 'The Stolen Tithe',
        lore: 'Place: roads between Moonwell Pier and Crossroads Camp. Consequence: Tollroad Goblin Cutters still move drowned ledger pages—break two of their warbands.',
        dialogId: 'story-side-tithe-cutters',
        requirement: { type: 'defeat_enemies_level', count: 2, minEnemyLevel: 6, maxEnemyLevel: 9 },
        rewards: { gold: 240, exp: 130 },
      },
      {
        id: 'story-side-tithe-ledger',
        chapter: 'chapter-1',
        order: 175,
        requiredLevel: 8,
        track: 'side',
        unlockAfterQuestId: 'story-side-tithe-cutters',
        name: 'Recover the Drowned Ledger',
        lore: 'Place: Crossroads Camp approach. Consequence: defeat the Tollroad Goblin Hexer and seize the water-swollen tithe ledger.',
        dialogId: 'story-side-tithe-ledger',
        requirement: {
          type: 'defeat_boss',
          count: 1,
          bossId: 'tollroad-goblin-hexer',
          enemyId: 'story-elite-tollroad-hexer',
        },
        rewards: {
          gold: 320,
          exp: 180,
          equipmentRarity: 'rare',
          items: [{ itemId: 'drowned-tithe-ledger', quantity: 1 }],
        },
      },
      {
        id: 'story-side-tithe-return',
        chapter: 'chapter-1',
        order: 176,
        requiredLevel: 8,
        track: 'side',
        unlockAfterQuestId: 'story-side-tithe-ledger',
        name: 'Ledger Returned to Law',
        lore: 'Contact: Scribe Naima. Consequence: return the drowned tithe ledger so Star Law can name who funded the rite.',
        dialogId: 'story-side-tithe-return',
        requirement: {
          type: 'visit_quest_npc',
          count: 1,
          questNpcId: 'quest-npc-scribe-naima',
          afterQuestId: 'story-side-tithe-ledger',
        },
        rewards: { gold: 300, exp: 160, rareGems: 2 },
      },
      {
        id: 'story-11-eastward-march',
        chapter: 'chapter-1',
        order: 18,
        requiredLevel: 11,
        name: 'Eastward March',
        lore: 'Contact: Ash Hermit Yara near the ash road. Consequence: she opens the eastern march and warns that king-magic answers faster than mercy east of Blackwater.',
        dialogId: 'story-11-eastward-march',
        requirement: { type: 'visit_quest_npc', count: 1, questNpcId: 'quest-npc-ash-hermit' },
        rewards: { gold: 500, exp: 320, rareGems: 3 },
      },
      {
        id: 'story-12-choir-of-iron',
        chapter: 'chapter-1',
        order: 19,
        requiredLevel: 12,
        name: 'Choir of Iron',
        lore: 'Place: Blackwater Gate. Consequence: the iron choir forges armor by singing names into steel—walk the walls before their hymn reaches your banner.',
        dialogId: 'story-12-choir-of-iron',
        requirement: { type: 'visit_poi', count: 1, poiName: 'Blackwater Gate' },
        rewards: { gold: 560, exp: 360, equipmentRarity: 'epic', spellIds: ['frost-lance'] },
      },
      {
        id: 'story-13-paragon-vow',
        chapter: 'chapter-1',
        order: 20,
        requiredLevel: 13,
        name: 'Paragon Vow',
        lore: 'Contact: Veil Captain Serat on the eclipse road. Consequence: she names the Iron Choir Marshal as the midpoint threat guarding Grave-Aurel\'s approach.',
        dialogId: 'story-13-paragon-vow',
        requirement: { type: 'visit_quest_npc', count: 1, questNpcId: 'quest-npc-veil-captain' },
        rewards: { gold: 640, exp: 410, minionTier: 'tier3' },
      },
      {
        id: 'story-14-eclipse-field',
        chapter: 'chapter-1',
        order: 21,
        requiredLevel: 14,
        name: 'Eclipse Field',
        lore: 'Place: East Road Camp approach. Consequence: silence the Iron Choir Marshal before the field learns your formations by hymn.',
        dialogId: 'story-14-eclipse-field',
        requirement: {
          type: 'defeat_boss',
          count: 1,
          bossId: 'iron-choir-marshal',
          enemyId: 'story-elite-iron-choir-marshal',
        },
        rewards: { gold: 720, exp: 470, equipmentRarity: 'epic', spellIds: ['saint-king-aegis'] },
      },
      {
        id: 'story-15-broken-crown',
        chapter: 'chapter-1',
        order: 22,
        requiredLevel: 15,
        name: 'The Broken Crown',
        lore: 'Place: southeast of Eclipse Hold. Consequence: defeat Emperor Grave-Aurel and take the broken crown lesson before the Mirror Court claims your reflection.',
        dialogId: 'story-15-broken-crown',
        requirement: {
          type: 'defeat_boss',
          count: 1,
          bossId: 'emperor-grave-aurel',
          enemyId: 'story-boss-emperor-grave-aurel',
        },
        rewards: { gold: 900, exp: 600, equipmentRarity: 'legendary', minionTier: 'tier3', spellIds: ['eclipse-nova', 'time-crown-edict'] },
      },
    ],
  },
  {
    id: 'chapter-2',
    title: 'Chapter II: The Mirror Court',
    summary: 'The broken crown was only the first seal. A mirror court rises in the east, and every road you cleared now feeds its war.',
    quests: [
      {
        id: 'story-16-mirror-council',
        chapter: 'chapter-2',
        order: 1,
        requiredLevel: 16,
        name: 'Mirror Council',
        lore: 'Contact: Veil Captain Serat on the eclipse road. Consequence: the Mirror Court has begun rewriting roads with glass scouts wearing your old banner colors.',
        dialogId: 'story-16-mirror-council',
        requirement: { type: 'visit_quest_npc', count: 1, questNpcId: 'quest-npc-veil-captain' },
        rewards: { gold: 520, exp: 340, equipmentRarity: 'rare', spellIds: ['moonlit-veil'] },
      },
      {
        id: 'story-17-moonwell-contract',
        chapter: 'chapter-2',
        order: 2,
        requiredLevel: 17,
        name: 'Writs at the Gate',
        lore: 'Contact: Gate Warden Sable at Blackwater Gate. Consequence: living writs still hold the eastern road—meet Sable before mirror forgers buy them all.',
        dialogId: 'story-17-moonwell-contract',
        requirement: { type: 'visit_quest_npc', count: 1, questNpcId: 'quest-npc-gate-warden' },
        rewards: { gold: 580, exp: 380, rareGems: 2 },
      },
      {
        id: 'story-18-blackwater-gate',
        chapter: 'chapter-2',
        order: 3,
        requiredLevel: 18,
        name: 'Blackwater Gate',
        lore: 'Place: Blackwater Gate walls. Consequence: walk the checkpoint while it still answers living commanders, then hunt the Mirror Road Captain rewriting the quarry road.',
        dialogId: 'story-18-blackwater-gate',
        requirement: { type: 'visit_poi', count: 1, poiName: 'Blackwater Gate' },
        rewards: { gold: 640, exp: 420, equipmentRarity: 'rare' },
      },
      {
        id: 'story-19-eclipse-scouts',
        chapter: 'chapter-2',
        order: 4,
        requiredLevel: 19,
        name: 'Eclipse Scouts',
        lore: 'Place: Granite Heights Quarry approach. Consequence: defeat the Mirror Road Captain before glass scouts finish learning your formations.',
        dialogId: 'story-19-eclipse-scouts',
        requirement: {
          type: 'defeat_boss',
          count: 1,
          bossId: 'mirror-road-captain',
          enemyId: 'story-elite-mirror-road-captain',
        },
        rewards: { gold: 700, exp: 460, minionTier: 'tier2', equipmentRarity: 'epic' },
      },
      {
        id: 'story-20-first-dungeon-oath',
        chapter: 'chapter-2',
        order: 5,
        requiredLevel: 20,
        name: 'Prior of the Glass Road',
        lore: 'Place: Eclipse Hold ossuary road. Consequence: defeat Prior Moon Voss and stop the court from opening every sealed chamber with reflected water.',
        dialogId: 'story-20-first-dungeon-oath',
        requirement: {
          type: 'defeat_boss',
          count: 1,
          bossId: 'prior-moon-voss',
          enemyId: 'story-boss-prior-moon-voss',
        },
        rewards: { gold: 820, exp: 540, rareGems: 3, equipmentRarity: 'epic', spellIds: ['frost-lance'] },
      },
      {
        id: 'story-20-glass-sealed',
        chapter: 'chapter-2',
        order: 6,
        requiredLevel: 20,
        name: 'Glass Road Sealed',
        lore: 'Contact: Gate Warden Sable. Consequence: return Voss\'s broken moon glass so Blackwater records the Glass Road under living law and opens the Candle Key preview.',
        dialogId: 'story-20-glass-sealed',
        requirement: {
          type: 'visit_quest_npc',
          count: 1,
          questNpcId: 'quest-npc-gate-warden',
          afterQuestId: 'story-20-first-dungeon-oath',
        },
        rewards: { gold: 760, exp: 500, rareGems: 2, equipmentRarity: 'epic' },
      },
      {
        id: 'story-21-quarry-ledger',
        chapter: 'chapter-2',
        order: 10,
        requiredLevel: 21,
        name: 'Candle Key Summons',
        lore: 'Contact: Brother Kaito. Consequence: rival powers race to assemble the candle key—Kaito opens the chapter before the Mirror Court seals the lock.',
        dialogId: 'story-21-quarry-ledger',
        requirement: { type: 'visit_quest_npc', count: 1, questNpcId: 'quest-npc-brother-kaito' },
        rewards: { gold: 820, exp: 540, equipmentRarity: 'epic' },
      },
      {
        id: 'story-22-eclipse-hold',
        chapter: 'chapter-2',
        order: 11,
        requiredLevel: 22,
        name: 'Eclipse Hold',
        lore: 'Place: Eclipse Hold. Consequence: reach the hold where king-mages signed their last lies before the court rewrites every oath recorded there.',
        dialogId: 'story-22-eclipse-hold',
        requirement: { type: 'visit_poi', count: 1, poiName: 'Eclipse Hold' },
        rewards: { gold: 880, exp: 580, spellIds: ['frost-lance'] },
      },
      {
        id: 'story-23-iron-chorus',
        chapter: 'chapter-2',
        order: 12,
        requiredLevel: 23,
        name: 'Key Warden',
        lore: 'Place: Granite Heights Quarry approach. Consequence: defeat Ser Kael Duskplate, the blue-oath warden guarding candle key routes.',
        dialogId: 'story-23-iron-chorus',
        requirement: {
          type: 'defeat_boss',
          count: 1,
          bossId: 'ser-kael-duskplate',
          enemyId: 'story-elite-ser-kael-duskplate',
        },
        rewards: { gold: 940, exp: 620, minionTier: 'tier3', equipmentRarity: 'epic' },
      },
      {
        id: 'story-24-candle-key',
        chapter: 'chapter-2',
        order: 13,
        requiredLevel: 24,
        name: 'Candle Key Fragment',
        lore: 'Contact: Brother Kaito. Consequence: gather three candle-key fragments so the synod lock can turn against the court.',
        dialogId: 'story-24-candle-key',
        requirement: { type: 'collect_item', count: 3, itemId: 'candle-key-fragment' },
        rewards: { gold: 1000, exp: 660, rareGems: 3 },
      },
      {
        id: 'story-25-paragon-muster',
        chapter: 'chapter-2',
        order: 14,
        requiredLevel: 25,
        name: 'Key-Saint Ardan',
        lore: 'Place: Eclipse Hold sealed gate. Consequence: defeat Key-Saint Ardan before he locks the court against every living banner.',
        dialogId: 'story-25-paragon-muster',
        requirement: {
          type: 'defeat_boss',
          count: 1,
          bossId: 'key-saint-ardan',
          enemyId: 'story-boss-key-saint-ardan',
        },
        rewards: { gold: 1080, exp: 700, equipmentRarity: 'epic', minionTier: 'tier3', spellIds: ['iron-benediction'] },
      },
      {
        id: 'story-25-key-sealed',
        chapter: 'chapter-2',
        order: 15,
        requiredLevel: 25,
        name: 'Candle Key Sealed',
        lore: 'Contact: Brother Kaito. Consequence: return Ardan\'s broken gate key so the synod records the lock under living hands and opens the Lady in Glass.',
        dialogId: 'story-25-key-sealed',
        requirement: {
          type: 'visit_quest_npc',
          count: 1,
          questNpcId: 'quest-npc-brother-kaito',
          afterQuestId: 'story-25-paragon-muster',
        },
        rewards: { gold: 1100, exp: 720, rareGems: 3, equipmentRarity: 'legendary' },
      },
      {
        id: 'story-26-deep-dungeon',
        chapter: 'chapter-2',
        order: 16,
        requiredLevel: 26,
        name: 'Court Reflections',
        lore: 'Contact: Archivist Letho. Consequence: the court now fields reflections of your old victories—meet Letho before Lady Mirror-Veyra chooses your image.',
        dialogId: 'story-26-deep-dungeon',
        requirement: {
          type: 'visit_quest_npc',
          count: 1,
          questNpcId: 'quest-npc-archivist-letho',
          afterQuestId: 'story-25-key-sealed',
        },
        rewards: { gold: 1160, exp: 760, equipmentRarity: 'legendary' },
      },
      {
        id: 'story-27-mirror-envoy',
        chapter: 'chapter-2',
        order: 17,
        requiredLevel: 27,
        name: 'Mirror Envoy',
        lore: 'Contact: Archivist Letho on the eclipse road. Consequence: stand before the court writ and refuse to kneel before Scarlet Matron Yvane hunts your banner.',
        dialogId: 'story-27-mirror-envoy',
        requirement: { type: 'visit_quest_npc', count: 1, questNpcId: 'quest-npc-archivist-letho' },
        rewards: { gold: 1240, exp: 820, spellIds: ['saint-king-aegis'] },
      },
      {
        id: 'story-28-eclipse-field',
        chapter: 'chapter-2',
        order: 18,
        requiredLevel: 28,
        name: 'Scarlet Matron',
        lore: 'Place: Shadowgrove. Consequence: defeat Scarlet Matron Yvane before her red thread knots around your commander\'s heart.',
        dialogId: 'story-28-eclipse-field',
        requirement: {
          type: 'defeat_boss',
          count: 1,
          bossId: 'scarlet-matron-yvane',
          enemyId: 'story-elite-scarlet-matron',
        },
        rewards: { gold: 1320, exp: 880, equipmentRarity: 'legendary' },
      },
      {
        id: 'story-29-high-war',
        chapter: 'chapter-2',
        order: 19,
        requiredLevel: 29,
        name: 'High War',
        lore: 'Place: Eclipse Hold approaches. Consequence: inspect Lady Mirror-Veyra\'s reflected host and learn which of your old victories she intends to field.',
        dialogId: 'story-29-high-war',
        requirement: { type: 'inspect_enemy', count: 1, enemyId: 'story-boss-lady-mirror-veyra' },
        rewards: { gold: 1400, exp: 940, rareGems: 4, minionTier: 'tier3' },
      },
      {
        id: 'story-30-lady-in-glass',
        chapter: 'chapter-2',
        order: 20,
        requiredLevel: 30,
        name: 'The Lady in Glass',
        lore: 'Place: Eclipse Hold court. Consequence: defeat Lady Mirror-Veyra and shatter the last king-mage reflection before it learns your name by heart.',
        dialogId: 'story-30-lady-in-glass',
        requirement: {
          type: 'defeat_boss',
          count: 1,
          bossId: 'lady-mirror-veyra',
          enemyId: 'story-boss-lady-mirror-veyra',
        },
        rewards: { gold: 1800, exp: 1200, equipmentRarity: 'legendary', minionTier: 'tier3', spellIds: ['blood-star', 'eclipse-nova'] },
      },
      {
        id: 'story-30-court-sealed',
        chapter: 'chapter-2',
        order: 21,
        requiredLevel: 30,
        name: 'Court Shatter Recorded',
        lore: 'Contact: Archivist Letho. Consequence: return the broken glass so the Mirror Court act closes under living law and the endgame board opens.',
        dialogId: 'story-30-court-sealed',
        requirement: {
          type: 'visit_quest_npc',
          count: 1,
          questNpcId: 'quest-npc-archivist-letho',
          afterQuestId: 'story-30-lady-in-glass',
        },
        rewards: { gold: 1600, exp: 1000, rareGems: 5, equipmentRarity: 'legendary', spellIds: ['time-crown-edict'] },
      },
      {
        id: 'story-side-ash-scout',
        chapter: 'chapter-2',
        order: 61,
        requiredLevel: 16,
        track: 'side',
        unlockAfterQuestId: 'story-15-broken-crown',
        name: 'Ash on the Pilgrim Road',
        lore: 'Contact: Ash Hermit Yara. Place: Witherfield ash road. Consequence: a named Ash Road Revenant is collecting pilgrim cinders—inspect the host before the lantern fills.',
        dialogId: 'story-side-ash-scout',
        requirement: { type: 'inspect_enemy', count: 1, enemyId: 'story-elite-ash-road-revenant' },
        rewards: { gold: 420, exp: 260, rareGems: 1 },
      },
      {
        id: 'story-side-ash-clear',
        chapter: 'chapter-2',
        order: 62,
        requiredLevel: 17,
        track: 'side',
        unlockAfterQuestId: 'story-side-ash-scout',
        name: 'Quiet the Ash Lantern',
        lore: 'Place: Witherfield Farm approach. Consequence: defeat the Ash Road Revenant before false pilgrim omens turn Ashford\'s hospice against living banners.',
        dialogId: 'story-side-ash-clear',
        requirement: {
          type: 'defeat_boss',
          count: 1,
          bossId: 'ash-road-revenant',
          enemyId: 'story-elite-ash-road-revenant',
        },
        rewards: {
          gold: 520,
          exp: 320,
          equipmentRarity: 'rare',
          items: [{ itemId: 'ash-pilgrim-cinder', quantity: 1 }],
        },
      },
      {
        id: 'story-side-ash-return',
        chapter: 'chapter-2',
        order: 63,
        requiredLevel: 17,
        track: 'side',
        unlockAfterQuestId: 'story-side-ash-clear',
        name: 'Cinder Returned to Oath Fire',
        lore: 'Contact: Ash Hermit Yara. Consequence: deliver the ash pilgrim cinder so Yara can quiet the false road omens west of Blackwater.',
        dialogId: 'story-side-ash-return',
        requirement: {
          type: 'visit_quest_npc',
          count: 1,
          questNpcId: 'quest-npc-ash-hermit',
          afterQuestId: 'story-side-ash-clear',
        },
        rewards: { gold: 480, exp: 290, rareGems: 2, spellIds: ['ashen-step'] },
      },
      {
        id: 'story-side-writ-cutters',
        chapter: 'chapter-2',
        order: 64,
        requiredLevel: 17,
        track: 'side',
        unlockAfterQuestId: 'story-17-moonwell-contract',
        name: 'Forged Writ Couriers',
        lore: 'Place: roads between Blackwater Gate and East Road Camp. Consequence: mirror couriers still move glass-stamped writs—break two of their warbands.',
        dialogId: 'story-side-writ-cutters',
        requirement: { type: 'defeat_enemies_level', count: 2, minEnemyLevel: 16, maxEnemyLevel: 19 },
        rewards: { gold: 460, exp: 280 },
      },
      {
        id: 'story-side-writ-clear',
        chapter: 'chapter-2',
        order: 65,
        requiredLevel: 18,
        track: 'side',
        unlockAfterQuestId: 'story-side-writ-cutters',
        name: 'Break the Glass Forger',
        lore: 'Place: East Road Camp approach. Consequence: defeat the Glass Writ Forger and seize a forged mirror writ before Blackwater accepts false seals.',
        dialogId: 'story-side-writ-clear',
        requirement: {
          type: 'defeat_boss',
          count: 1,
          bossId: 'glass-writ-forger',
          enemyId: 'story-elite-glass-writ-forger',
        },
        rewards: {
          gold: 580,
          exp: 360,
          equipmentRarity: 'epic',
          items: [{ itemId: 'forged-mirror-writ', quantity: 1 }],
        },
      },
      {
        id: 'story-side-writ-return',
        chapter: 'chapter-2',
        order: 66,
        requiredLevel: 18,
        track: 'side',
        unlockAfterQuestId: 'story-side-writ-clear',
        name: 'Writ Burned Under Living Law',
        lore: 'Contact: Gate Warden Sable. Consequence: return the forged mirror writ so Blackwater can burn the counterfeit seal from its ledgers.',
        dialogId: 'story-side-writ-return',
        requirement: {
          type: 'visit_quest_npc',
          count: 1,
          questNpcId: 'quest-npc-gate-warden',
          afterQuestId: 'story-side-writ-clear',
        },
        rewards: { gold: 540, exp: 330, rareGems: 2 },
      },
      {
        id: 'story-side-synod-scout',
        chapter: 'chapter-2',
        order: 71,
        requiredLevel: 21,
        track: 'side',
        unlockAfterQuestId: 'story-21-quarry-ledger',
        name: 'Bell That Calls Fragments',
        lore: 'Contact: Brother Kaito. Place: Eclipse Hold approach. Consequence: a Synod Bell Reclaimer rings cracked bells for candle-key fragments—inspect the host before another shard answers.',
        dialogId: 'story-side-synod-scout',
        requirement: { type: 'inspect_enemy', count: 1, enemyId: 'story-elite-synod-bell' },
        rewards: { gold: 640, exp: 400, rareGems: 1 },
      },
      {
        id: 'story-side-synod-clear',
        chapter: 'chapter-2',
        order: 72,
        requiredLevel: 22,
        track: 'side',
        unlockAfterQuestId: 'story-side-synod-scout',
        name: 'Mute the Synod Bell',
        lore: 'Place: Eclipse Hold sealed approaches. Consequence: defeat the Synod Bell Reclaimer and recover the cracked synod bell before key fragments leave living hands.',
        dialogId: 'story-side-synod-clear',
        requirement: {
          type: 'defeat_boss',
          count: 1,
          bossId: 'synod-bell-reclaimer',
          enemyId: 'story-elite-synod-bell',
        },
        rewards: {
          gold: 760,
          exp: 480,
          equipmentRarity: 'epic',
          items: [{ itemId: 'cracked-synod-bell', quantity: 1 }],
        },
      },
      {
        id: 'story-side-synod-return',
        chapter: 'chapter-2',
        order: 73,
        requiredLevel: 22,
        track: 'side',
        unlockAfterQuestId: 'story-side-synod-clear',
        name: 'Bell Quieted for Living Keys',
        lore: 'Contact: Brother Kaito. Consequence: deliver the cracked synod bell so Bridge Bell Monks can mute false rings during the candle key race.',
        dialogId: 'story-side-synod-return',
        requirement: {
          type: 'visit_quest_npc',
          count: 1,
          questNpcId: 'quest-npc-brother-kaito',
          afterQuestId: 'story-side-synod-clear',
        },
        rewards: { gold: 720, exp: 450, rareGems: 2, spellIds: ['warding-prayer'] },
      },
    ],
  },
];

export function getAllStoryQuestsSorted(): StoryQuestTemplate[] {
  return STORY_CHAPTERS.flatMap(chapter => chapter.quests)
    .sort((left, right) => {
      const leftChapter = STORY_CHAPTERS.findIndex(chapter => chapter.id === left.chapter);
      const rightChapter = STORY_CHAPTERS.findIndex(chapter => chapter.id === right.chapter);
      if (leftChapter !== rightChapter) return leftChapter - rightChapter;
      return left.order - right.order;
    });
}

export const QUEST_NPCS: QuestNpc[] = [
  {
    id: 'quest-npc-sister-avel',
    name: 'Sister Avel',
    title: 'Hospitaller of the Candle Road',
    faction: 'Hospitaller Lanterns',
    x: 23,
    y: 17,
    modelNumber: 4,
    levelRange: '1-4',
    town: 'Harborview',
    line: 'The first wounds are small. That is why commanders ignore them until armies fall.',
    questHook: 'Finish one local job so I can see whether your banner survives ordinary duty.',
    requirement: { type: 'complete_jobs', count: 1 },
    rewards: { gold: 35, exp: 20, healthRestore: 40 },
  },
  {
    id: 'quest-npc-marshal-orren',
    name: 'Marshal Orren',
    title: 'Harborview Field Marshal',
    faction: 'Candlewardens',
    x: 38,
    y: 15,
    modelNumber: 1,
    levelRange: '1-8',
    town: 'Harborview',
    line: 'Bring me proof that your soldiers follow orders after moonrise.',
    questHook: 'Break one hostile warband near Harborview and bring back a field report.',
    requirement: { type: 'win_battles', count: 1 },
    rewards: { gold: 75, exp: 45, equipmentRarity: 'decent' },
  },
  {
    id: 'quest-npc-scribe-naima',
    name: 'Scribe Naima',
    title: 'Star Lawkeeper',
    faction: 'Star Lawkeepers',
    x: 14,
    y: 36,
    modelNumber: 5,
    levelRange: '4-9',
    town: 'Riverside',
    line: 'Law is only magic that everyone agreed to fear.',
    questHook: 'Complete three jobs under Riverside law and bring me the signed records.',
    requirement: { type: 'complete_jobs', count: 3 },
    rewards: { gold: 90, exp: 55, rareGems: 1 },
  },
  {
    id: 'quest-npc-brother-kaito',
    name: 'Brother Kaito',
    title: 'Bell Tower Monk',
    faction: 'Bridge Bell Monks',
    x: 31,
    y: 38,
    modelNumber: 2,
    levelRange: '6-11',
    town: 'Riverside',
    line: 'Every bell has a ghost in it. Some are more punctual than others.',
    questHook: 'Finish two proper work shifts. The bridge bells do not reward commanders who leave early.',
    requirement: { type: 'complete_timed_jobs', count: 2, minDuration: ONE_MINUTE },
    rewards: { gold: 120, exp: 80, minionTier: 'tier1' },
  },
  {
    id: 'quest-npc-ash-hermit',
    name: 'Ash Hermit Yara',
    title: 'Keeper of Oath Fire',
    faction: 'Ash Rite',
    x: 59,
    y: 24,
    modelNumber: 6,
    levelRange: '9-13',
    town: 'Riverside',
    line: 'Skip a command. Let the mana stack. Then you will learn what a king is.',
    questHook: 'Win two battles and learn when saving mana is worth more than spending steel.',
    requirement: { type: 'win_battles', count: 2 },
    rewards: { gold: 180, exp: 115, equipmentRarity: 'rare', rareGems: 1 },
  },
  {
    id: 'quest-npc-veil-captain',
    name: 'Veil Captain Serat',
    title: 'Eclipse March Scout',
    faction: 'Moon Court',
    x: 81,
    y: 39,
    modelNumber: 3,
    levelRange: '12-15',
    town: 'Harborview',
    line: 'The southeast does not need roads. It has teeth.',
    questHook: 'Win three battles on the eastern road. The Broken Crown notices banners that endure.',
    requirement: { type: 'win_battles', count: 3 },
    rewards: { gold: 260, exp: 160, equipmentRarity: 'epic', minionTier: 'tier2' },
  },
  {
    id: 'quest-npc-archivist-letho',
    name: 'Archivist Letho',
    title: 'Mirror Court Scribe',
    faction: 'Glass Reliquary',
    x: 73,
    y: 38,
    modelNumber: 5,
    levelRange: '24-30',
    town: 'Eclipse Hold',
    line: 'Every reflection in the court is a confession someone refused to make aloud.',
    questHook: 'Recover two candle key fragments before the mirror court seals its records.',
    requirement: { type: 'collect_item', count: 2, itemId: 'candle-key-fragment' },
    rewards: { gold: 320, exp: 200, rareGems: 2, equipmentRarity: 'epic' },
  },
  {
    id: 'quest-npc-gate-warden',
    name: 'Gate Warden Sable',
    title: 'Blackwater Quartermaster',
    faction: 'Blackwater Syndicate',
    x: 54,
    y: 20,
    modelNumber: 1,
    levelRange: '16-22',
    town: 'Blackwater Gate',
    line: 'Writs outlive the hands that signed them. Bring me work from the eastern quarries.',
    questHook: 'Complete two jobs at Granite Heights Quarry and return with the eastern tally.',
    requirement: { type: 'complete_jobs_at_poi', count: 2, poiName: 'Granite Heights Quarry' },
    rewards: { gold: 210, exp: 130, equipmentRarity: 'rare' },
  },
];

export function getQuestNpcById(npcId: string): QuestNpc | undefined {
  return QUEST_NPCS.find(npc => npc.id === npcId);
}

function hashText(value: string): number {
  return value.split('').reduce((hash, char) => ((hash << 5) - hash + char.charCodeAt(0)) | 0, 0);
}

export function getCityQuestTemplate(questId: string): CityQuestTemplate | undefined {
  return CITY_QUESTS.find(quest => quest.id === questId);
}

export function getRotatingCityQuests(
  townName: string,
  now = Date.now(),
  limit = 5,
  options?: { claimedStoryQuestIds?: Iterable<string> },
): CityQuestTemplate[] {
  const claimed = new Set(options?.claimedStoryQuestIds || []);
  const townQuests = CITY_QUESTS.filter(quest => {
    if (quest.town !== townName) return false;
    if (quest.requiresClaimedQuestId && !claimed.has(quest.requiresClaimedQuestId)) return false;
    return true;
  });
  const questPool = townQuests.length > 0 ? townQuests : CITY_QUESTS.filter(quest => !quest.requiresClaimedQuestId);
  if (questPool.length === 0) return [];
  const cycle = Math.floor(now / (3 * 60 * 60 * 1000));
  const seed = Math.abs(hashText(`${townName}-${cycle}`));
  const startIndex = seed % questPool.length;
  return questPool.map((_, index) => questPool[(startIndex + index) % questPool.length]).slice(0, limit);
}

export function getQuestNpcWorldVoice(
  npc: QuestNpc,
  subject?: {
    storyQuests?: Array<{ questId: string; claimed?: boolean }> | null;
  } | null,
): { line: string; questHook: string } {
  const claimed = (questId: string) => Boolean(
    subject?.storyQuests?.some(progress => progress.questId === questId && progress.claimed),
  );
  const moonwellSealed = claimed('story-14-moonwell-sealed');
  const crownBroken = claimed('story-15-broken-crown');
  const glassSealed = claimed('story-20-glass-sealed');
  const keySealed = claimed('story-25-key-sealed');
  const courtSealed = claimed('story-30-court-sealed');

  if (npc.id === 'quest-npc-scribe-naima' && moonwellSealed) {
    return {
      line: crownBroken
        ? 'The ledger is quiet. Mirror scouts now ask for the same names you freed from the tithe.'
        : 'The Moonwell ledger is readable again. East of Blackwater, an iron choir has begun singing commander names into steel.',
      questHook: crownBroken
        ? 'Keep Star Law copies sealed. The Mirror Court buys erased histories.'
        : 'When you reach Ash Hermit Yara, tell her the river returned its names. The eastern march is open.',
    };
  }

  if (npc.id === 'quest-npc-brother-kaito' && moonwellSealed) {
    return {
      line: keySealed
        ? 'Ardan\'s key is cracked. Lady Mirror-Veyra will not forgive a lock that answered living hands.'
        : glassSealed
          ? 'Voss is quiet. The candle key fragments will not stay quiet for long.'
          : 'The drowned bell stays one beat short. That is a mercy you earned under the pier.',
      questHook: keySealed
        ? 'Find Archivist Letho. The court already fields reflections of your victories.'
        : glassSealed
          ? 'When you reach twenty-one, bring me every fragment you find. The court is racing the same road.'
          : 'If silk or goblin ledgers still trouble the bridge, finish those side roads before the east calls louder.',
    };
  }

  if (npc.id === 'quest-npc-ash-hermit' && moonwellSealed && !crownBroken) {
    return {
      line: 'The Moonwell stopped choosing soldiers. The crown country will try to choose kings instead.',
      questHook: 'Walk to me when your banner is ready. King-magic eats commanders who skip the lesson.',
    };
  }

  if (npc.id === 'quest-npc-veil-captain' && moonwellSealed) {
    return {
      line: courtSealed
        ? 'The Mirror Court act is closed. Endgame roads still remember every reflection you shattered.'
        : glassSealed
          ? 'The Glass Road is sealed. Candle Key country begins where reflections stop answering honestly.'
          : crownBroken
            ? 'Grave-Aurel fell. The mirror court already wears fragments of his hymn.'
            : 'Moonwell smoke still rides the west wind. Good. The iron choir hates banners that arrive smelling of victory.',
      questHook: courtSealed
        ? 'Keep your roster breathing. Veteran boards do not forgive empty banners.'
        : glassSealed
          ? 'Find Brother Kaito when the key race opens. I will scout the hold\'s deeper glass.'
          : crownBroken
            ? 'Meet me on the eclipse road when you are ready for glass and forged writs.'
            : 'Scout Blackwater Gate, then find me. We silence the choir before it learns your true name.',
    };
  }

  if (npc.id === 'quest-npc-gate-warden' && crownBroken) {
    return {
      line: glassSealed
        ? 'Living law owns the Glass Road for now. Mirror agents already ask about candle keys.'
        : 'Writs outlive the hands that signed them. Bring me proof you still command east of the gate.',
      questHook: glassSealed
        ? 'Keep your roster breathing. The Candle Key chapter does not forgive empty banners.'
        : 'Walk Blackwater Gate, then hunt the Mirror Road Captain near Granite Heights.',
    };
  }

  if (npc.id === 'quest-npc-archivist-letho' && keySealed) {
    return {
      line: courtSealed
        ? 'The shard is quiet. That is rarer than victory. Walk carefully—mirrors remember longer than roads.'
        : 'The key turned. Now the court fields armies built from reflections of old victories.',
      questHook: courtSealed
        ? 'The Mirror Court act is recorded. Endgame work begins where living law still holds.'
        : 'Stand with me. Scarlet Matron Yvane hunts banners that refuse to kneel.',
    };
  }

  return { line: npc.line, questHook: npc.questHook };
}
