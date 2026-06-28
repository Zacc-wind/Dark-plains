import type { User } from './auth';

function formatLocalDate(date: Date): string {
  const year = date.getFullYear();
  const month = `${date.getMonth() + 1}`.padStart(2, '0');
  const day = `${date.getDate()}`.padStart(2, '0');
  return `${year}-${month}-${day}`;
}

export interface MpDailyDungeonChallenge {
  date: string;
  name: string;
  subtitle: string;
  battleCount: number;
  bossId: string;
  bossName: string;
  bossSubtitle: string;
  bossStory: string;
  bossIntro: string;
  bossArtworkPath?: string;
  bossModelNumber?: number;
  enemyLevelOffset: number;
  rewardGold: number;
  rewardExp: number;
  rewardRareGems: number;
}

export interface MpDailyDungeonState {
  lastCompletedDate?: string;
  completions: number;
  bestTimeMs?: number;
  history: Array<{
    id: string;
    date: string;
    completedAt: number;
    durationMs: number;
    wins: number;
    bossName: string;
  }>;
}

const MP_DAILY_TITLES = [
  'Shattered Gate Gauntlet',
  'Mirror Court Sortie',
  'Blackwater Breach',
  'Eclipse Hold Raid',
  'Stormbreak Trial',
  'Ashen Crossing',
];

const MP_DAILY_BOSSES = [
  {
    id: 'mp-blackwater-revenant',
    name: 'Blackwater Revenant',
    subtitle: 'Drowned commander of the breach',
    story: 'The revenant rises from the daily breach to test every warband that dares the gauntlet.',
    intro: 'The tide pulls back. Something armored walks out of the water.',
    assetPath: '/assets/bosses/blackwater-revenant.png',
    modelNumber: 12,
  },
  {
    id: 'mp-mirror-warden',
    name: 'Mirror Warden',
    subtitle: 'Keeper of the daily rite',
    story: 'Each dawn the warden reshapes the gauntlet and waits at the final mirror.',
    intro: 'Glass cracks. A warden steps through with your reflection behind it.',
    assetPath: '/assets/bosses/mirror-warden.png',
    modelNumber: 11,
  },
  {
    id: 'mp-eclipse-hound',
    name: 'Eclipse Hound',
    subtitle: 'Hunter of the daily eclipse',
    story: 'The hound only hunts during the short multiplayer rite window.',
    intro: 'A horn of shadow sounds. The hound is already sprinting.',
    assetPath: '/assets/bosses/eclipse-hound.png',
    modelNumber: 13,
  },
];

function seededDailyNumber(seed: string, salt: string): number {
  let hash = 2166136261;
  const input = `${seed}:${salt}`;
  for (let index = 0; index < input.length; index += 1) {
    hash ^= input.charCodeAt(index);
    hash = Math.imul(hash, 16777619);
  }
  return (hash >>> 0) / 4294967296;
}

function pickDailySeeded<T>(items: T[], seed: string, salt: string): T {
  return items[Math.floor(seededDailyNumber(seed, salt) * items.length)] || items[0];
}

export function getMpDailyDungeonChallenge(now = Date.now()): MpDailyDungeonChallenge {
  const date = formatLocalDate(new Date(now));
  const title = pickDailySeeded(MP_DAILY_TITLES, date, 'mp-daily-title');
  const boss = pickDailySeeded(MP_DAILY_BOSSES, date, 'mp-daily-boss');
  const battleRoll = seededDailyNumber(date, 'mp-daily-battles');
  const battleCount = battleRoll > 0.66 ? 6 : battleRoll > 0.33 ? 5 : 4;

  return {
    date,
    name: title,
    subtitle: `${battleCount} fights ending with ${boss.name}`,
    battleCount,
    bossId: boss.id,
    bossName: boss.name,
    bossSubtitle: boss.subtitle,
    bossStory: boss.story,
    bossIntro: boss.intro,
    bossArtworkPath: boss.assetPath,
    bossModelNumber: boss.modelNumber,
    enemyLevelOffset: battleCount >= 6 ? 2 : 1,
    rewardGold: 120 + battleCount * 25,
    rewardExp: 80 + battleCount * 20,
    rewardRareGems: battleCount >= 6 ? 2 : 1,
  };
}

export function normalizeMpDailyDungeonState(state?: Partial<MpDailyDungeonState> | null): MpDailyDungeonState {
  return {
    lastCompletedDate: typeof state?.lastCompletedDate === 'string' ? state.lastCompletedDate : undefined,
    completions: Math.max(0, Math.floor(Number(state?.completions) || 0)),
    bestTimeMs: state?.bestTimeMs === undefined ? undefined : Math.max(0, Math.floor(Number(state.bestTimeMs) || 0)),
    history: Array.isArray(state?.history) ? state.history.slice(0, 20) : [],
  };
}

export function hasCompletedMpDailyDungeonToday(
  user: Pick<User, 'mpDailyDungeon'> | null | undefined,
  now = Date.now(),
): boolean {
  const state = normalizeMpDailyDungeonState(user?.mpDailyDungeon);
  return state.lastCompletedDate === formatLocalDate(new Date(now));
}

export function recordMpDailyDungeonCompletion(
  user: Pick<User, 'mpDailyDungeon' | 'username'>,
  report: {
    wins: number;
    durationMs: number;
    bossName: string;
    completedAt?: number;
  },
): MpDailyDungeonState {
  const completedAt = report.completedAt || Date.now();
  const date = formatLocalDate(new Date(completedAt));
  const previous = normalizeMpDailyDungeonState(user.mpDailyDungeon);
  const entry = {
    id: `mp-daily-${user.username}-${completedAt}`,
    date,
    completedAt,
    durationMs: Math.max(0, Math.floor(report.durationMs)),
    wins: Math.max(0, Math.floor(report.wins)),
    bossName: report.bossName,
  };

  return {
    lastCompletedDate: date,
    completions: previous.completions + 1,
    bestTimeMs: previous.bestTimeMs
      ? Math.min(previous.bestTimeMs, entry.durationMs)
      : entry.durationMs,
    history: [entry, ...previous.history].slice(0, 20),
  };
}
