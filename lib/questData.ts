import type { EquipmentRarity, MinionTier } from './auth';

export type QuestTown = 'Harborview' | 'Riverside';
export type QuestRequirementType =
  | 'complete_jobs'
  | 'complete_timed_jobs'
  | 'player_level'
  | 'own_rare_gems'
  | 'collect_item'
  | 'recruit_minions'
  | 'win_battles'
  | 'visit_poi'
  | 'defeat_boss';

export interface QuestRequirementSpec {
  type: QuestRequirementType;
  count: number;
  minDuration?: number;
  poiId?: string;
  poiName?: string;
  itemId?: string;
  bossId?: string;
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
}

export interface CityQuestTemplate {
  id: string;
  town: QuestTown;
  faction: string;
  name: string;
  description: string;
  requirement: QuestRequirementSpec;
  rewards: QuestRewardSpec;
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
  rewards: QuestRewardSpec;
}

const FIFTEEN_MINUTES = 15 * 60 * 1000;
const THIRTY_MINUTES = 30 * 60 * 1000;

export const CITY_QUESTS: CityQuestTemplate[] = [
  {
    id: 'hv-candle-watch',
    town: 'Harborview',
    faction: 'Candlewardens',
    name: 'Candle Watch',
    description: 'Keep the harbor lanterns lit while the fog presses against the wall.',
    requirement: { type: 'complete_jobs', count: 2 },
    rewards: { gold: 85, exp: 35, equipmentRarity: 'decent' },
  },
  {
    id: 'hv-relic-ledger',
    town: 'Harborview',
    faction: 'Relic Weighers',
    name: 'Relic Ledger',
    description: 'Audit the dockside relic trade and expose false saint-bone shipments.',
    requirement: { type: 'complete_timed_jobs', count: 2, minDuration: FIFTEEN_MINUTES },
    rewards: { gold: 120, exp: 55, rareGems: 1 },
  },
  {
    id: 'hv-salt-vigil',
    town: 'Harborview',
    faction: 'Salt Chapel',
    name: 'Salt Vigil',
    description: 'Carry warding salt between shrines before the drowned lights rise.',
    requirement: { type: 'complete_jobs', count: 3 },
    rewards: { gold: 135, exp: 65, minionTier: 'tier1' },
  },
  {
    id: 'hv-bell-oaths',
    town: 'Harborview',
    faction: 'Bell Oath',
    name: 'Bell Oaths',
    description: 'Answer the old bells and make sure the night watch still remembers its vows.',
    requirement: { type: 'player_level', count: 3 },
    rewards: { gold: 160, exp: 80, equipmentRarity: 'rare' },
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
    requirement: { type: 'complete_jobs', count: 4 },
    rewards: { gold: 110, exp: 95, healthRestore: 40 },
  },
  {
    id: 'hv-squire-roll',
    town: 'Harborview',
    faction: 'Iron Yard',
    name: 'Squire Roll',
    description: 'Prove there is room in your command for new steel and scared courage.',
    requirement: { type: 'recruit_minions', count: 1 },
    rewards: { gold: 150, exp: 100, equipmentRarity: 'decent' },
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
    id: 'hv-pilgrim-scrip',
    town: 'Harborview',
    faction: 'Road Pilgrims',
    name: 'Pilgrim Scrip',
    description: 'Collect signed scrips from workers who still travel under holy protection.',
    requirement: { type: 'complete_jobs', count: 5 },
    rewards: { gold: 210, exp: 130, rareGems: 1 },
  },
  {
    id: 'hv-abbey-stone',
    town: 'Harborview',
    faction: 'Abbey Masons',
    name: 'Abbey Stone',
    description: 'Haul grave-black granite for a chapel wall that refuses to stay built.',
    requirement: { type: 'complete_timed_jobs', count: 3, minDuration: FIFTEEN_MINUTES },
    rewards: { gold: 260, exp: 150, equipmentRarity: 'rare' },
  },
  {
    id: 'hv-moon-court',
    town: 'Harborview',
    faction: 'Moon Court',
    name: 'Moon Court Summons',
    description: 'Stand before the moon court and report on the state of your army.',
    requirement: { type: 'player_level', count: 6 },
    rewards: { gold: 300, exp: 170, minionTier: 'tier2' },
  },
  {
    id: 'hv-drowned-catechism',
    town: 'Harborview',
    faction: 'Salt Chapel',
    name: 'Drowned Catechism',
    description: 'Copy prayers from a book that was found dry beneath the black lake.',
    requirement: { type: 'complete_jobs', count: 6 },
    rewards: { gold: 330, exp: 180, equipmentRarity: 'rare' },
  },
  {
    id: 'hv-iron-confession',
    town: 'Harborview',
    faction: 'Iron Yard',
    name: 'Iron Confession',
    description: 'Test your soldiers in the yard and learn which ones flinch from bells.',
    requirement: { type: 'recruit_minions', count: 3 },
    rewards: { gold: 360, exp: 200, rareGems: 2 },
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
    rewards: { gold: 520, exp: 310, minionTier: 'tier2', equipmentRarity: 'rare' },
  },
  {
    id: 'rs-bridge-bells',
    town: 'Riverside',
    faction: 'Bridge Bell Monks',
    name: 'Bridge Bells',
    description: 'Ring the crossing bells before dusk and listen for the bell that answers back.',
    requirement: { type: 'complete_jobs', count: 2 },
    rewards: { gold: 90, exp: 35, equipmentRarity: 'decent' },
  },
  {
    id: 'rs-river-offering',
    town: 'Riverside',
    faction: 'River Shrine',
    name: 'River Offering',
    description: 'Carry votive lamps to the old river shrines without letting the flames die.',
    requirement: { type: 'complete_timed_jobs', count: 1, minDuration: FIFTEEN_MINUTES },
    rewards: { gold: 125, exp: 55, rareGems: 1 },
  },
  {
    id: 'rs-lotus-ledger',
    town: 'Riverside',
    faction: 'Lotus Scriptorium',
    name: 'Lotus Ledger',
    description: 'Copy field reports for the quiet scholars who count wars like seasons.',
    requirement: { type: 'complete_jobs', count: 3 },
    rewards: { gold: 145, exp: 70, equipmentRarity: 'decent' },
  },
  {
    id: 'rs-ancestor-masks',
    town: 'Riverside',
    faction: 'Mask Keepers',
    name: 'Ancestor Masks',
    description: 'Recover ancestor masks from abandoned farms before the names fade.',
    requirement: { type: 'complete_jobs', count: 4 },
    rewards: { gold: 170, exp: 90, minionTier: 'tier1' },
  },
  {
    id: 'rs-ash-rite',
    town: 'Riverside',
    faction: 'Ash Rite',
    name: 'Ash Rite',
    description: 'Feed the oath fire with black pine and speak no command while it burns.',
    requirement: { type: 'player_level', count: 4 },
    rewards: { gold: 200, exp: 100, rareGems: 1 },
  },
  {
    id: 'rs-moon-observance',
    town: 'Riverside',
    faction: 'Moon Observers',
    name: 'Moon Observance',
    description: 'Chart the moon through river mist for scholars who distrust daylight.',
    requirement: { type: 'complete_timed_jobs', count: 2, minDuration: FIFTEEN_MINUTES },
    rewards: { gold: 230, exp: 120, equipmentRarity: 'rare' },
  },
  {
    id: 'rs-bitter-beans',
    town: 'Riverside',
    faction: 'Night Roasters',
    name: 'Bitter Beans',
    description: 'Gather vigil coffee and roast it for priests who refuse sleep.',
    requirement: { type: 'complete_jobs', count: 5 },
    rewards: { gold: 240, exp: 140, healthRestore: 50 },
  },
  {
    id: 'rs-cleric-road',
    town: 'Riverside',
    faction: 'Hospice Road',
    name: 'Cleric Road',
    description: 'Prove you can protect healers who travel beyond the bridge lamps.',
    requirement: { type: 'recruit_minions', count: 2 },
    rewards: { gold: 260, exp: 150, minionTier: 'tier2' },
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
    requirement: { type: 'complete_jobs', count: 6 },
    rewards: { gold: 390, exp: 220, equipmentRarity: 'rare' },
  },
  {
    id: 'rs-desert-star',
    town: 'Riverside',
    faction: 'Star Lawkeepers',
    name: 'Desert Star Law',
    description: 'Study a foreign star-code used to settle disputes between rival commanders.',
    requirement: { type: 'player_level', count: 8 },
    rewards: { gold: 430, exp: 260, minionTier: 'tier2' },
  },
  {
    id: 'rs-black-lotus',
    town: 'Riverside',
    faction: 'Lotus Scriptorium',
    name: 'Black Lotus Margin',
    description: 'Annotate forbidden diagrams without waking the ink in the margins.',
    requirement: { type: 'complete_timed_jobs', count: 3, minDuration: FIFTEEN_MINUTES },
    rewards: { gold: 460, exp: 280, equipmentRarity: 'epic' },
  },
  {
    id: 'rs-ashen-general',
    town: 'Riverside',
    faction: 'Ash Rite',
    name: 'Ashen General',
    description: 'Bring your command before the oath fire and let it judge your banner.',
    requirement: { type: 'recruit_minions', count: 5 },
    rewards: { gold: 520, exp: 320, rareGems: 3 },
  },
  {
    id: 'rs-riverside-marshal',
    town: 'Riverside',
    faction: 'River Council',
    name: 'Riverside Marshal',
    description: 'Earn command rights in Riverside and take a writ for the eastern marches.',
    requirement: { type: 'player_level', count: 11 },
    rewards: { gold: 580, exp: 360, equipmentRarity: 'epic', minionTier: 'tier2' },
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
        requirement: { type: 'complete_jobs', count: 1 },
        rewards: { gold: 80, exp: 40, minionTier: 'tier1' },
      },
      {
        id: 'story-02-candle-road',
        chapter: 'chapter-1',
        order: 2,
        requiredLevel: 2,
        name: 'The Candle Road',
        lore: 'Harborview claims the old road was once lit by saints, scholars, and oath fires. Walk to its gates and report to the candle court.',
        requirement: { type: 'visit_poi', count: 1, poiName: 'Harborview' },
        rewards: { gold: 120, exp: 70, equipmentRarity: 'decent', spellIds: ['thorn-ward'] },
      },
      {
        id: 'story-03-lost-apprentice',
        chapter: 'chapter-1',
        order: 3,
        requiredLevel: 3,
        name: 'Lost Apprentice',
        lore: 'A wizard apprentice fled into the moors carrying a map of battle hexes drawn before the war.',
        requirement: { type: 'recruit_minions', count: 1 },
        rewards: { gold: 150, exp: 90, minionTier: 'tier1' },
      },
      {
        id: 'story-04-river-law',
        chapter: 'chapter-1',
        order: 4,
        requiredLevel: 4,
        name: 'River Law',
        lore: 'Riverside offers law written in stars and bridge bells: reach the river wall and hear the code spoken under lanterns.',
        requirement: { type: 'visit_poi', count: 1, poiName: 'Riverside' },
        rewards: { gold: 180, exp: 110, rareGems: 1, spellIds: ['gravity-snare'] },
      },
      {
        id: 'story-05-violet-satchel',
        chapter: 'chapter-1',
        order: 5,
        requiredLevel: 5,
        name: 'The Violet Satchel',
        lore: 'Rare gems hum near your inventory ledger. The old quartermasters used them to stretch space itself.',
        requirement: { type: 'own_rare_gems', count: 1 },
        rewards: { gold: 220, exp: 130, equipmentRarity: 'rare' },
      },
      {
        id: 'story-06-black-pike',
        chapter: 'chapter-1',
        order: 6,
        requiredLevel: 6,
        name: 'Black Pike Warning',
        lore: 'The Black Pike Raider taxes the mid-road in blood and calls it discipline.',
        requirement: { type: 'win_battles', count: 1 },
        rewards: { gold: 260, exp: 160, minionTier: 'tier2', spellIds: ['chain-spark'] },
      },
      {
        id: 'story-07-moonwell',
        chapter: 'chapter-1',
        order: 7,
        requiredLevel: 7,
        name: 'Moonwell Descent',
        lore: 'A temporary breach opens where the moon is reflected in dead water. Something below is recruiting.',
        requirement: { type: 'complete_timed_jobs', count: 3, minDuration: FIFTEEN_MINUTES },
        rewards: { gold: 300, exp: 190, rareGems: 2 },
      },
      {
        id: 'story-08-templar-seal',
        chapter: 'chapter-1',
        order: 8,
        requiredLevel: 8,
        name: 'Templar Seal',
        lore: 'A relic shield bears a seal from an order that swore never to serve another wizard.',
        requirement: { type: 'recruit_minions', count: 3 },
        rewards: { gold: 340, exp: 210, equipmentRarity: 'rare', spellIds: ['judgement'] },
      },
      {
        id: 'story-09-gravebound-script',
        chapter: 'chapter-1',
        order: 9,
        requiredLevel: 9,
        name: 'Gravebound Script',
        lore: 'The Gravebound Magus writes orders in ash. Each command is a spell, each spell a debt.',
        requirement: { type: 'win_battles', count: 2 },
        rewards: { gold: 390, exp: 250, minionTier: 'tier2' },
      },
      {
        id: 'story-10-field-council',
        chapter: 'chapter-1',
        order: 10,
        requiredLevel: 10,
        name: 'Field Council',
        lore: 'Harborview and Riverside agree on one thing: your army is either useful or dangerous.',
        requirement: { type: 'player_level', count: 10 },
        rewards: { gold: 450, exp: 280, equipmentRarity: 'epic', spellIds: ['royal-command'] },
      },
      {
        id: 'story-11-eastward-march',
        chapter: 'chapter-1',
        order: 11,
        requiredLevel: 11,
        name: 'Eastward March',
        lore: 'The road bends toward Blackwater and the old map begins to show places nobody painted.',
        requirement: { type: 'complete_jobs', count: 8 },
        rewards: { gold: 500, exp: 320, rareGems: 3 },
      },
      {
        id: 'story-12-choir-of-iron',
        chapter: 'chapter-1',
        order: 12,
        requiredLevel: 12,
        name: 'Choir of Iron',
        lore: 'The enemy forges armor by singing names into steel. Silence the choir or wear its hymn.',
        requirement: { type: 'complete_timed_jobs', count: 4, minDuration: THIRTY_MINUTES },
        rewards: { gold: 560, exp: 360, equipmentRarity: 'epic', spellIds: ['frost-lance'] },
      },
      {
        id: 'story-13-paragon-vow',
        chapter: 'chapter-1',
        order: 13,
        requiredLevel: 13,
        name: 'Paragon Vow',
        lore: 'One elite knight will kneel if your army proves it can survive the eclipse marches.',
        requirement: { type: 'recruit_minions', count: 6 },
        rewards: { gold: 640, exp: 410, minionTier: 'tier3' },
      },
      {
        id: 'story-14-eclipse-field',
        chapter: 'chapter-1',
        order: 14,
        requiredLevel: 14,
        name: 'Eclipse Field',
        lore: 'The battlefield where the first king-mage fell is no longer empty. It has learned to wait.',
        requirement: { type: 'win_battles', count: 4 },
        rewards: { gold: 720, exp: 470, equipmentRarity: 'epic', spellIds: ['saint-king-aegis'] },
      },
      {
        id: 'story-15-broken-crown',
        chapter: 'chapter-1',
        order: 15,
        requiredLevel: 15,
        name: 'The Broken Crown',
        lore: 'The Eclipsed Warlord keeps a broken crown for anyone who still believes commanders rule alone.',
        requirement: { type: 'defeat_boss', count: 1, bossId: 'eclipsed-warlord' },
        rewards: { gold: 900, exp: 600, equipmentRarity: 'legendary', minionTier: 'tier3', spellIds: ['eclipse-nova', 'time-crown-edict'] },
      },
    ],
  },
];

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
    questHook: 'Introduces early healing contracts and the First Banner story chain.',
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
    levelRange: '3-8',
    town: 'Harborview',
    line: 'Bring me proof that your soldiers follow orders after moonrise.',
    questHook: 'Points players toward Harborview city contracts and mid-road enemies.',
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
    questHook: 'Introduces Riverside contracts, star-law motifs, and rare gem requirements.',
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
    questHook: 'Routes players toward longer timed jobs and bridge-region contracts.',
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
    questHook: 'Teaches spell-power, Focus Mana, and eastern combat prep.',
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
    questHook: 'Foreshadows boss country, dungeon fights, and the Broken Crown finale.',
    rewards: { gold: 260, exp: 160, equipmentRarity: 'epic', minionTier: 'tier2' },
  },
];

function hashText(value: string): number {
  return value.split('').reduce((hash, char) => ((hash << 5) - hash + char.charCodeAt(0)) | 0, 0);
}

export function getCityQuestTemplate(questId: string): CityQuestTemplate | undefined {
  return CITY_QUESTS.find(quest => quest.id === questId);
}

export function getRotatingCityQuests(townName: string, now = Date.now(), limit = 5): CityQuestTemplate[] {
  const townQuests = CITY_QUESTS.filter(quest => quest.town === townName);
  const questPool = townQuests.length > 0 ? townQuests : CITY_QUESTS;
  const cycle = Math.floor(now / (3 * 60 * 60 * 1000));
  const seed = Math.abs(hashText(`${townName}-${cycle}`));
  const startIndex = seed % questPool.length;
  return questPool.map((_, index) => questPool[(startIndex + index) % questPool.length]).slice(0, limit);
}
