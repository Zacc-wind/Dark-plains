import type { EnemyAiPersonality, PlayerModelNumber } from './battle';

export interface BossProfile {
  id: string;
  name: string;
  subtitle: string;
  story: string;
  intro: string;
  assetPath: string;
  modelNumber: PlayerModelNumber;
  personality: EnemyAiPersonality;
  minionTemplates: string[];
}

export const BOSS_PROFILES: BossProfile[] = [
  {
    id: 'mother-cindervein',
    name: 'Mother Cindervein',
    subtitle: 'Candle-fire priestess',
    story: 'She keeps saints alive inside black candles and feeds each flame with a failed commander name.',
    intro: 'The candles bow before their mother.',
    assetPath: '/assets/bosses/boss1.png',
    modelNumber: 4,
    personality: 'arcane',
    minionTemplates: ['darkpriest', 'witchdoc', 'bell', 'knight-squire'],
  },
  {
    id: 'ser-kael-duskplate',
    name: 'Ser Kael Duskplate',
    subtitle: 'Blue oath templar',
    story: 'A templar drowned in moonlit steel and returned with vows too cold for mortal law.',
    intro: 'Blue steel answers before he speaks.',
    assetPath: '/assets/bosses/boss2.png',
    modelNumber: 2,
    personality: 'defensive',
    minionTemplates: ['bell', 'crossbow', 'firelord', 'mercenary'],
  },
  {
    id: 'prior-moon-voss',
    name: 'Prior Moon Voss',
    subtitle: 'Moonlit field priest',
    story: 'He reads omens from broken water and turns every reflected wound into doctrine.',
    intro: 'The moon narrows to a blade.',
    assetPath: '/assets/bosses/boss3.png',
    modelNumber: 5,
    personality: 'arcane',
    minionTemplates: ['witchdoc', 'enchanter', 'plaugedoc', 'darkpriest'],
  },
  {
    id: 'key-saint-ardan',
    name: 'Key-Saint Ardan',
    subtitle: 'Paladin of sealed gates',
    story: 'Ardan carries the last gate key, but every lock he opens takes a year from the living.',
    intro: 'The old key turns in the dark.',
    assetPath: '/assets/bosses/boss4.png',
    modelNumber: 1,
    personality: 'balanced',
    minionTemplates: ['fallen', 'mercenary', 'bell', 'crossbow'],
  },
  {
    id: 'blackroot-vessel',
    name: 'Blackroot Vessel',
    subtitle: 'Tree-soul demon',
    story: 'A dead forest learned the shape of a commander and now marches with roots for nerves.',
    intro: 'The roots remember every buried oath.',
    assetPath: '/assets/bosses/boss5.png',
    modelNumber: 6,
    personality: 'boss',
    minionTemplates: ['plaugedoc', 'fallen', 'enchanter', 'mercenary'],
  },
  {
    id: 'lady-mirror-veyra',
    name: 'Lady Mirror Veyra',
    subtitle: 'Illusion court wizard',
    story: 'Veyra breaks armies with reflections, then sends the surviving image home wearing the commander face.',
    intro: 'Every mirror chooses a side.',
    assetPath: '/assets/bosses/boss6.png',
    modelNumber: 5,
    personality: 'arcane',
    minionTemplates: ['enchanter', 'plaugedoc', 'witchdoc', 'crow'],
  },
  {
    id: 'scarlet-matron-yvane',
    name: 'Scarlet Matron Yvane',
    subtitle: 'Blood-star witch',
    story: 'She writes curses in red thread and knots them around the hearts of proud captains.',
    intro: 'Scarlet thread tightens across the field.',
    assetPath: '/assets/bosses/boss7.png',
    modelNumber: 6,
    personality: 'aggressive',
    minionTemplates: ['crow', 'plaugedoc', 'firelord', 'witchdoc'],
  },
  {
    id: 'emperor-grave-aurel',
    name: 'Emperor Grave-Aurel',
    subtitle: 'Undead templar emperor',
    story: 'The emperor still commands from inside his funeral armor, waiting for a war worthy of waking fully.',
    intro: 'The dead emperor stands, and the road kneels.',
    assetPath: '/assets/bosses/boss8.png',
    modelNumber: 6,
    personality: 'boss',
    minionTemplates: ['mercenary', 'fallen', 'crow', 'plaugedoc', 'bell'],
  },
];

export const STORY_BOSS_PROFILES: BossProfile[] = [
  {
    id: 'black-pike-lieutenant',
    name: 'Lieutenant Veyr',
    subtitle: 'Black Pike tollmaster',
    story: 'Veyr weighs every passing banner against the price on its commander. The toll camp is his ledger, and each hanging pike records a company that paid too late.',
    intro: 'The toll bell sounds once. Black pikes lower across the road.',
    assetPath: '/assets/bosses/boss2.png',
    modelNumber: 2,
    personality: 'aggressive',
    minionTemplates: ['crossbow', 'bell', 'darkpriest'],
  },
];

export function getBossProfileById(id?: string): BossProfile | undefined {
  return [...BOSS_PROFILES, ...STORY_BOSS_PROFILES].find(profile => profile.id === id);
}

export function getBossProfileByIndex(index: number): BossProfile {
  return BOSS_PROFILES[((index % BOSS_PROFILES.length) + BOSS_PROFILES.length) % BOSS_PROFILES.length];
}
