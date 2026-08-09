import { getAllStoryQuestsSorted, type StoryQuestTemplate } from './questData';

export interface MultiplayerChapterDefinition {
  id: string;
  act: 'The Eclipsed Banner' | 'The Mirror Court';
  numeral: string;
  title: string;
  minLevel: number;
  maxLevel: number;
  guideName: string;
  conflict: string;
  capstone: string;
}

export interface MultiplayerChapterView extends MultiplayerChapterDefinition {
  quests: StoryQuestTemplate[];
  questCount: number;
  claimedCount: number;
  recordedCount: number;
  unlocked: boolean;
  active: boolean;
  complete: boolean;
}

export interface MultiplayerCampaignSubject {
  stats?: { level?: number } | null;
  storyQuests?: Array<{
    questId: string;
    claimed?: boolean;
    introSeen?: boolean;
  }> | null;
}

export const MULTIPLAYER_CHAPTER_DEFINITIONS: MultiplayerChapterDefinition[] = [
  {
    id: 'first-banner',
    act: 'The Eclipsed Banner',
    numeral: 'I',
    title: 'The First Banner',
    minLevel: 1,
    maxLevel: 5,
    guideName: 'Sister Avel and Marshal Orren',
    conflict: 'Earn recognition while the Black Pike taxes the western road.',
    capstone: 'Black Pike lieutenant',
  },
  {
    id: 'drowned-moonwell',
    act: 'The Eclipsed Banner',
    numeral: 'II',
    title: 'The Drowned Moonwell',
    minLevel: 6,
    maxLevel: 10,
    guideName: 'Scribe Naima and Brother Kaito',
    conflict: 'Trace Moonwell recruitment and the first candle-fire breach.',
    capstone: 'Mother Cindervein',
  },
  {
    id: 'broken-crown',
    act: 'The Eclipsed Banner',
    numeral: 'III',
    title: 'The Broken Crown',
    minLevel: 11,
    maxLevel: 15,
    guideName: 'Ash Hermit Yara and Veil Captain Serat',
    conflict: 'Cross the eastern march and silence Grave-Aurel\'s iron choir.',
    capstone: 'Emperor Grave-Aurel',
  },
  {
    id: 'glass-road',
    act: 'The Mirror Court',
    numeral: 'IV',
    title: 'The Glass Road',
    minLevel: 16,
    maxLevel: 20,
    guideName: 'Gate Warden Sable and Veil Captain Serat',
    conflict: 'Stop mirror scouts from rewriting roads and opening ossuaries.',
    capstone: 'Prior Moon Voss',
  },
  {
    id: 'candle-key',
    act: 'The Mirror Court',
    numeral: 'V',
    title: 'The Candle Key',
    minLevel: 21,
    maxLevel: 25,
    guideName: 'Brother Kaito and Archivist Letho',
    conflict: 'Assemble the key before rival powers seal the court.',
    capstone: 'Key-Saint Ardan',
  },
  {
    id: 'lady-in-glass',
    act: 'The Mirror Court',
    numeral: 'VI',
    title: 'The Lady In Glass',
    minLevel: 26,
    maxLevel: 30,
    guideName: 'Archivist Letho',
    conflict: 'Face veteran armies built from reflections of old victories.',
    capstone: 'Lady Mirror Veyra',
  },
];

function getSubjectLevel(subject: MultiplayerCampaignSubject | null | undefined): number {
  const value = subject?.stats?.level;
  return Math.max(1, Math.floor(Number.isFinite(value) ? Number(value) : 1));
}

export function getMultiplayerChapterViews(
  subject: MultiplayerCampaignSubject | null | undefined,
): MultiplayerChapterView[] {
  const level = getSubjectLevel(subject);
  const progressByQuestId = new Map((subject?.storyQuests || []).map(progress => [progress.questId, progress]));
  const allQuests = getAllStoryQuestsSorted();

  const views = MULTIPLAYER_CHAPTER_DEFINITIONS.map(definition => {
    const quests = allQuests.filter(quest => (
      quest.track !== 'side'
      && quest.requiredLevel >= definition.minLevel
      && quest.requiredLevel <= definition.maxLevel
    ));
    const claimedCount = quests.filter(quest => progressByQuestId.get(quest.id)?.claimed).length;
    const recordedCount = quests.filter(quest => progressByQuestId.get(quest.id)?.introSeen).length;
    return {
      ...definition,
      quests,
      questCount: quests.length,
      claimedCount,
      recordedCount,
      unlocked: level >= definition.minLevel,
      active: false,
      complete: quests.length > 0 && claimedCount >= quests.length,
    };
  });

  const activeIndex = views.findIndex(view => view.unlocked && !view.complete);
  if (activeIndex >= 0) views[activeIndex] = { ...views[activeIndex], active: true };
  return views;
}
