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
  | 'defeat_boss';

export interface QuestRequirementSpec {
  type: QuestRequirementType;
  count: number;
  minDuration?: number;
  poiId?: string;
  poiName?: string;
  itemId?: string;
  bossId?: string;
  questNpcId?: string;
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
  dialogId?: string;
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
const FIVE_MINUTES = 5 * 60 * 1000;
const THIRTY_MINUTES = FIVE_MINUTES;

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
    requirement: { type: 'complete_timed_jobs', count: 2, minDuration: ONE_MINUTE },
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
    description: 'Complete Harborview-area jobs for road workers; each finished job returns one signed pilgrim scrip.',
    requirement: { type: 'complete_jobs', count: 5 },
    rewards: { gold: 210, exp: 130, rareGems: 1 },
  },
  {
    id: 'hv-abbey-stone',
    town: 'Harborview',
    faction: 'Abbey Masons',
    name: 'Abbey Stone',
    description: 'Haul grave-black granite for a chapel wall that refuses to stay built.',
    requirement: { type: 'complete_timed_jobs', count: 3, minDuration: ONE_MINUTE },
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
    requirement: { type: 'complete_timed_jobs', count: 1, minDuration: ONE_MINUTE },
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
    requirement: { type: 'complete_timed_jobs', count: 2, minDuration: ONE_MINUTE },
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
    requirement: { type: 'complete_timed_jobs', count: 3, minDuration: ONE_MINUTE },
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
        requiredLevel: 2,
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
        dialogId: 'story-06-black-pike',
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
        requirement: { type: 'complete_timed_jobs', count: 3, minDuration: ONE_MINUTE },
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
        lore: 'Emperor Grave-Aurel keeps a broken crown for anyone who still believes commanders rule alone.',
        dialogId: 'story-15-broken-crown',
        requirement: { type: 'defeat_boss', count: 1, bossId: 'emperor-grave-aurel' },
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
        lore: 'Veil Captain Serat summons commanders who survived the crown. The mirror court listens through glass and ash.',
        dialogId: 'story-16-mirror-council',
        requirement: { type: 'visit_quest_npc', count: 1, questNpcId: 'quest-npc-veil-captain' },
        rewards: { gold: 520, exp: 340, equipmentRarity: 'rare', spellIds: ['moonlit-veil'] },
      },
      {
        id: 'story-17-moonwell-contract',
        chapter: 'chapter-2',
        order: 2,
        requiredLevel: 17,
        name: 'Moonwell Contract',
        lore: 'Star Law pays in ink and salt for work done where the moonwell pier still remembers drowned kings.',
        dialogId: 'story-17-moonwell-contract',
        requirement: { type: 'complete_jobs_at_poi', count: 2, poiName: 'Moonwell Pier', minDuration: ONE_MINUTE },
        rewards: { gold: 580, exp: 380, rareGems: 2 },
      },
      {
        id: 'story-18-blackwater-gate',
        chapter: 'chapter-2',
        order: 3,
        requiredLevel: 18,
        name: 'Blackwater Gate',
        lore: 'Blackwater Gate trades in writs that outlive their signers. Walk its walls before the mirror court buys them.',
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
        lore: 'Mirror scouts wear your old banner colors. Break their warbands before they learn your formations.',
        requirement: { type: 'defeat_enemies_level', count: 3, minEnemyLevel: 14, maxEnemyLevel: 19 },
        rewards: { gold: 700, exp: 460, minionTier: 'tier2' },
      },
      {
        id: 'story-20-first-dungeon-oath',
        chapter: 'chapter-2',
        order: 5,
        requiredLevel: 20,
        name: 'First Dungeon Oath',
        lore: 'The ossuaries beneath the marches are recruiting again. Clear a sealed chamber and bring proof.',
        dialogId: 'story-20-first-dungeon-oath',
        requirement: { type: 'clear_dungeons', count: 1, minDungeonLevel: 5 },
        rewards: { gold: 760, exp: 500, rareGems: 2, equipmentRarity: 'epic' },
      },
      {
        id: 'story-21-quarry-ledger',
        chapter: 'chapter-2',
        order: 6,
        requiredLevel: 21,
        name: 'Quarry Ledger',
        lore: 'Granite Heights still cuts saint-bone for the mirror court. Work the quarry and steal their tally.',
        requirement: { type: 'complete_jobs_at_poi', count: 2, poiName: 'Granite Heights Quarry', minDuration: ONE_MINUTE },
        rewards: { gold: 820, exp: 540, equipmentRarity: 'epic' },
      },
      {
        id: 'story-22-eclipse-hold',
        chapter: 'chapter-2',
        order: 7,
        requiredLevel: 22,
        name: 'Eclipse Hold',
        lore: 'Eclipse Hold is where king-mages signed their last lies. Reach the hold before the mirror court rewrites them.',
        dialogId: 'story-22-eclipse-hold',
        requirement: { type: 'visit_poi', count: 1, poiName: 'Eclipse Hold' },
        rewards: { gold: 880, exp: 580, spellIds: ['frost-lance'] },
      },
      {
        id: 'story-23-iron-chorus',
        chapter: 'chapter-2',
        order: 8,
        requiredLevel: 23,
        name: 'Iron Chorus',
        lore: 'Veteran warbands now march under mirror sigils. Hunt the strongest among them on the eastern roads.',
        requirement: { type: 'defeat_enemies_level', count: 4, minEnemyLevel: 18, maxEnemyLevel: 24 },
        rewards: { gold: 940, exp: 620, minionTier: 'tier3' },
      },
      {
        id: 'story-24-candle-key',
        chapter: 'chapter-2',
        order: 9,
        requiredLevel: 24,
        name: 'Candle Key Fragment',
        lore: 'Brother Kaito claims a candle key can unseal the mirror court if the fragments are whole.',
        dialogId: 'story-24-candle-key',
        requirement: { type: 'collect_item', count: 3, itemId: 'candle-key-fragment' },
        rewards: { gold: 1000, exp: 660, rareGems: 3 },
      },
      {
        id: 'story-25-paragon-muster',
        chapter: 'chapter-2',
        order: 10,
        requiredLevel: 25,
        name: 'Paragon Muster',
        lore: 'The mirror court fields elites that remember every defeat you ever paid for.',
        requirement: { type: 'recruit_minions', count: 8 },
        rewards: { gold: 1080, exp: 700, equipmentRarity: 'epic', minionTier: 'tier3' },
      },
      {
        id: 'story-26-deep-dungeon',
        chapter: 'chapter-2',
        order: 11,
        requiredLevel: 26,
        name: 'Deep Chamber',
        lore: 'A deeper ossuary opens only when the mirror moon is high. Clear a veteran dungeon and return.',
        requirement: { type: 'clear_dungeons', count: 2, minDungeonLevel: 10 },
        rewards: { gold: 1160, exp: 760, equipmentRarity: 'legendary' },
      },
      {
        id: 'story-27-mirror-envoy',
        chapter: 'chapter-2',
        order: 12,
        requiredLevel: 27,
        name: 'Mirror Envoy',
        lore: 'Archivist Letho carries the court writ in a reliquary of glass. Find the envoy on the eclipse road.',
        dialogId: 'story-27-mirror-envoy',
        requirement: { type: 'visit_quest_npc', count: 1, questNpcId: 'quest-npc-archivist-letho' },
        rewards: { gold: 1240, exp: 820, spellIds: ['saint-king-aegis'] },
      },
      {
        id: 'story-28-eclipse-field',
        chapter: 'chapter-2',
        order: 13,
        requiredLevel: 28,
        name: 'Eclipse Field Redux',
        lore: 'The field where Aurel fell now reflects every army you have ever lost.',
        requirement: { type: 'win_battles', count: 6 },
        rewards: { gold: 1320, exp: 880, equipmentRarity: 'legendary' },
      },
      {
        id: 'story-29-high-war',
        chapter: 'chapter-2',
        order: 14,
        requiredLevel: 29,
        name: 'High War',
        lore: 'Only commanders who break mirror champions above level twenty-four earn the right to enter the court.',
        requirement: { type: 'defeat_enemies_level', count: 5, minEnemyLevel: 24, maxEnemyLevel: 30 },
        rewards: { gold: 1400, exp: 940, rareGems: 4, minionTier: 'tier3' },
      },
      {
        id: 'story-30-lady-in-glass',
        chapter: 'chapter-2',
        order: 15,
        requiredLevel: 30,
        name: 'The Lady in Glass',
        lore: 'Lady Mirror-Veyra keeps the last king-mage reflection. Shatter the court or kneel to your own image.',
        dialogId: 'story-30-lady-in-glass',
        requirement: { type: 'defeat_boss', count: 1, bossId: 'lady-mirror-veyra' },
        rewards: { gold: 1800, exp: 1200, equipmentRarity: 'legendary', minionTier: 'tier3', spellIds: ['blood-star', 'eclipse-nova'] },
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
    questHook: 'Introduces early healing contracts and the First Banner story chain.',
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
    levelRange: '3-8',
    town: 'Harborview',
    line: 'Bring me proof that your soldiers follow orders after moonrise.',
    questHook: 'Points players toward Harborview city contracts and mid-road enemies.',
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
    questHook: 'Introduces Riverside contracts, star-law motifs, and rare gem requirements.',
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
    questHook: 'Routes players toward longer timed jobs and bridge-region contracts.',
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
    questHook: 'Teaches spell-power, Focus Mana, and eastern combat prep.',
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
    questHook: 'Foreshadows boss country, dungeon fights, and the Broken Crown finale.',
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
    questHook: 'Guides the mirror court chapter and candle key lore.',
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
    questHook: 'Routes players toward Blackwater contracts and quarry jobs.',
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

export function getRotatingCityQuests(townName: string, now = Date.now(), limit = 5): CityQuestTemplate[] {
  const townQuests = CITY_QUESTS.filter(quest => quest.town === townName);
  const questPool = townQuests.length > 0 ? townQuests : CITY_QUESTS;
  const cycle = Math.floor(now / (3 * 60 * 60 * 1000));
  const seed = Math.abs(hashText(`${townName}-${cycle}`));
  const startIndex = seed % questPool.length;
  return questPool.map((_, index) => questPool[(startIndex + index) % questPool.length]).slice(0, limit);
}
