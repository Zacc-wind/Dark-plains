import { applyStoryChapterOverlays } from './storyChapterOverlay';
import type {
  CityQuestTemplate,
  QuestNpc,
  StoryChapter,
  StoryQuestTemplate,
} from './questDataTypes';
import { ONE_MINUTE } from './questDataTypes';
import { CITY_QUESTS } from './questDataCity';
import { STORY_CHAPTERS_RAW } from './questDataStoryRaw';

export type {
  CityQuestTemplate,
  QuestNpc,
  QuestRequirementSpec,
  QuestRewardSpec,
  QuestRequirementType,
  QuestTown,
  StoryChapter,
  StoryQuestTemplate,
} from './questDataTypes';
export { CITY_QUESTS } from './questDataCity';

export const STORY_CHAPTERS: StoryChapter[] = applyStoryChapterOverlays(STORY_CHAPTERS_RAW);


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
  const choirPracticeQuiet = claimed('story-side-choir-return');

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
      line: choirPracticeQuiet
        ? 'The Moonwell stopped choosing soldiers. One cantor is quiet; good. The crown country will try to choose kings instead.'
        : 'The Moonwell stopped choosing soldiers. The crown country will try to choose kings instead.',
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
