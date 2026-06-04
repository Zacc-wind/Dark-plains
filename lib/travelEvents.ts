export type TravelEventTone = 'positive' | 'neutral' | 'negative';
export type TravelEventEffect =
  | 'gold'
  | 'rareGem'
  | 'heal'
  | 'equipment'
  | 'minion'
  | 'lore'
  | 'nothing'
  | 'loseGold'
  | 'loseHealth';

export interface TravelEventTemplate {
  id: string;
  tone: TravelEventTone;
  title: string;
  message: string;
  effect: TravelEventEffect;
}

const positiveScenes = [
  'A candle shrine leans beside the road',
  'A river pilgrim shares a quiet blessing',
  'A bell monk marks your banner in chalk',
  'A moon scholar studies your footprints',
  'A masked elder watches from a ruined wall',
  'A field priest leaves bread near an ash post',
  'A caravan of relic weighers passes under lanterns',
  'A hermit has stacked stones into a small gate',
  'A black pine fire burns without smoke',
  'A lotus scribe dries pages in the night wind',
  'A star lawkeeper asks which road you claim',
  'An old farmhand points toward safer ground',
  'A bridge lamp flickers when your army passes',
  'A templar scout salutes from the fog',
  'A fisherman pulls up a bottle sealed in violet wax',
  'A quarry mason taps a rune into split granite',
  'A child of the road offers a lucky nail',
  'A silent chapel opens its door for one breath',
  'A coffee roaster keeps vigil beside hot coals',
  'A raven-black milestone shows an older route',
];

const positiveOutcomes: Array<Pick<TravelEventTemplate, 'title' | 'message' | 'effect'>> = [
  { title: 'Found Tithe', message: 'and a hidden tithe-box yields old coins.', effect: 'gold' },
  { title: 'Violet Glimmer', message: 'and a violet chip of gem-light drops into your satchel.', effect: 'rareGem' },
  { title: 'Road Mercy', message: 'and the moment of rest steadies your blood.', effect: 'heal' },
  { title: 'Discarded Relic', message: 'and a usable piece of field gear is wrapped in cloth.', effect: 'equipment' },
  { title: 'Willing Recruit', message: 'and a lone wanderer asks to march under your command.', effect: 'minion' },
  { title: 'Old Lore', message: 'and you learn a rumor about the eclipse war.', effect: 'lore' },
  { title: 'Safe Passage', message: 'and nothing is lost on the next stretch of road.', effect: 'nothing' },
  { title: 'Good Omen', message: 'and your banner feels lighter in the moon wind.', effect: 'lore' },
];

const negativeScenes = [
  'A tax-bandit waits near a broken toll stone',
  'Black water rises across the road',
  'A false pilgrim asks for mercy with a hidden knife',
  'Rotten bridge planks give way underfoot',
  'A feverish mist crawls out of the moor',
  'Old battlefield iron cuts through a boot sole',
  'A shrine bell rings backward as you pass',
  'Hungry deserters shadow your campfire',
  'A dead lantern bursts into ash and sparks',
  'A road curse twists every familiar landmark',
];

const negativeOutcomes: Array<Pick<TravelEventTemplate, 'title' | 'message' | 'effect'>> = [
  { title: 'Road Toll', message: 'and you lose coin before the path clears.', effect: 'loseGold' },
  { title: 'Blood on Stone', message: 'and the march costs health before dawn.', effect: 'loseHealth' },
  { title: 'Bad Omen', message: 'but the fear passes without lasting harm.', effect: 'nothing' },
  { title: 'Spoiled Rest', message: 'and the night gives nothing back.', effect: 'nothing' },
];

export const POSITIVE_TRAVEL_EVENTS: TravelEventTemplate[] = positiveScenes.flatMap((scene, sceneIndex) =>
  positiveOutcomes.map((outcome, outcomeIndex) => ({
    id: `travel-good-${sceneIndex + 1}-${outcomeIndex + 1}`,
    tone: outcome.effect === 'nothing' || outcome.effect === 'lore' ? 'neutral' : 'positive',
    title: outcome.title,
    message: `${scene} ${outcome.message}`,
    effect: outcome.effect,
  }))
);

export const NEGATIVE_TRAVEL_EVENTS: TravelEventTemplate[] = negativeScenes.flatMap((scene, sceneIndex) =>
  negativeOutcomes.map((outcome, outcomeIndex) => ({
    id: `travel-bad-${sceneIndex + 1}-${outcomeIndex + 1}`,
    tone: 'negative',
    title: outcome.title,
    message: `${scene} ${outcome.message}`,
    effect: outcome.effect,
  }))
);

export const TRAVEL_EVENT_CONTENT_COUNTS = {
  positiveOrNeutral: POSITIVE_TRAVEL_EVENTS.length,
  negative: NEGATIVE_TRAVEL_EVENTS.length,
};

function hashText(value: string): number {
  return value.split('').reduce((hash, char) => ((hash << 5) - hash + char.charCodeAt(0)) | 0, 0);
}

function seededRoll(seed: number): number {
  const value = Math.sin(seed) * 10000;
  return value - Math.floor(value);
}

export function getTravelEventCount(durationMs: number, seedText: string): number {
  const minutes = durationMs / 60000;
  const seed = Math.abs(hashText(seedText));

  if (minutes < 5) return 0;
  if (minutes <= 7) return seededRoll(seed) < 0.18 ? 1 : 0;
  if (minutes < 30) return seededRoll(seed) < 0.35 ? 1 : 0;

  const hours = durationMs / 3600000;
  const baseline = Math.floor(hours * 1.55);
  const swing = Math.floor(seededRoll(seed + 17) * 3);
  return Math.max(1, Math.min(9, baseline + swing + 1));
}

export function rollTravelEvents(durationMs: number, seedText: string): TravelEventTemplate[] {
  const count = getTravelEventCount(durationMs, seedText);
  const seed = Math.abs(hashText(seedText));

  return Array.from({ length: count }, (_, index) => {
    const isNegative = seededRoll(seed + index * 13) >= 0.8;
    const pool = isNegative ? NEGATIVE_TRAVEL_EVENTS : POSITIVE_TRAVEL_EVENTS;
    const eventIndex = Math.floor(seededRoll(seed + index * 31 + 5) * pool.length);
    return pool[eventIndex];
  });
}
