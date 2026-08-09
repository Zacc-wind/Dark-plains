export type ChapterTalentId =
  | 'road-quartermaster'
  | 'field-chaplain'
  | 'banner-scout'
  | 'forge-adept'
  | 'oathbound-captain'
  | 'mirror-ward';

export interface ChapterTalentDefinition {
  id: ChapterTalentId;
  name: string;
  band: '1-5' | '6-10' | '11-15' | '16-20' | '21-25' | '26-30';
  summary: string;
  effect: string;
}

export const CHAPTER_TALENTS: ChapterTalentDefinition[] = [
  {
    id: 'road-quartermaster',
    name: 'Road Quartermaster',
    band: '1-5',
    summary: 'Jobs pay a little cleaner on the open road.',
    effect: '+8% job gold (utility, not combat power).',
  },
  {
    id: 'field-chaplain',
    name: 'Field Chaplain',
    band: '1-5',
    summary: 'Injured soldiers recover sooner between marches.',
    effect: 'Injury ward rest removes 20% more remaining time.',
  },
  {
    id: 'banner-scout',
    name: 'Banner Scout',
    band: '6-10',
    summary: 'Your scouts mark threats with clearer risk.',
    effect: 'Enemy inspect reveals an extra risk note in intel.',
  },
  {
    id: 'forge-adept',
    name: 'Forge Adept',
    band: '6-10',
    summary: 'Scrap feeds the forge more efficiently.',
    effect: '+1 set scrap when salvaging gear.',
  },
  {
    id: 'oathbound-captain',
    name: 'Oathbound Captain',
    band: '11-15',
    summary: 'Weekly oaths recognize your steady banner.',
    effect: '+5% weekly oath gold/XP when claimed.',
  },
  {
    id: 'mirror-ward',
    name: 'Mirror Ward',
    band: '11-15',
    summary: 'A quiet ward against sudden social pressure.',
    effect: 'Social return pings stay muted one extra day.',
  },
];

export function getChapterTalentsForBand(band: ChapterTalentDefinition['band']): ChapterTalentDefinition[] {
  return CHAPTER_TALENTS.filter(talent => talent.band === band);
}

export function getChapterTalent(id: string | null | undefined): ChapterTalentDefinition | null {
  if (!id) return null;
  return CHAPTER_TALENTS.find(talent => talent.id === id) || null;
}

export function bandForPlayerLevel(level: number): ChapterTalentDefinition['band'] | null {
  if (level >= 26) return '26-30';
  if (level >= 21) return '21-25';
  if (level >= 16) return '16-20';
  if (level >= 11) return '11-15';
  if (level >= 6) return '6-10';
  if (level >= 5) return '1-5';
  return null;
}
