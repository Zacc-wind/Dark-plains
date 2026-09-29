import type { User } from '@/lib/auth';
import { isSupabaseConfigured } from '@/lib/supabase/config';

export interface WorldMapPlayer {
  userId: string;
  username: string;
  x: number;
  y: number;
  selectedModel: number;
  level: number;
  updatedAt?: string;
}

export const WORLD_PLAYER_ONLINE_WINDOW_MS = 2 * 60 * 1000;

let cachedWorldPlayers: WorldMapPlayer[] = [];

export function getCachedWorldPlayers(): WorldMapPlayer[] {
  return cachedWorldPlayers;
}

function createDefaultStats(level: number): User['stats'] {
  return {
    armyPower: 5,
    defensivePower: 5,
    morale: 5,
    spellPower: 3,
    health: 100,
    maxHealth: 100,
    level,
    unallocatedPoints: 0,
  };
}

export function worldMapPlayerToUser(player: WorldMapPlayer): User {
  return {
    username: player.username,
    password: '',
    gold: 0,
    exp: 0,
    x: player.x,
    y: player.y,
    inventory: [],
    equipment: [],
    equippedSlots: {},
    minions: [],
    activityLog: [],
    stats: createDefaultStats(player.level),
    traveling: null,
    jobQueue: [],
    selectedModel: player.selectedModel,
  };
}

export function getWorldPlayerUpdatedMs(player: Pick<WorldMapPlayer, 'updatedAt'>): number {
  const parsed = player.updatedAt ? Date.parse(player.updatedAt) : 0;
  return Number.isFinite(parsed) ? parsed : 0;
}

export function isWorldPlayerOnline(player: Pick<WorldMapPlayer, 'updatedAt'>, now = Date.now()): boolean {
  const updatedMs = getWorldPlayerUpdatedMs(player);
  return updatedMs > 0 && now - updatedMs <= WORLD_PLAYER_ONLINE_WINDOW_MS;
}

export function formatWorldPlayerLastSeen(player: Pick<WorldMapPlayer, 'updatedAt'>, now = Date.now()): string {
  const updatedMs = getWorldPlayerUpdatedMs(player);
  if (updatedMs <= 0) return 'unknown';

  const diffMs = Math.max(0, now - updatedMs);
  if (diffMs < 10_000) return 'just now';
  if (diffMs < 60_000) return `${Math.ceil(diffMs / 1000)}s ago`;
  if (diffMs < 60 * 60_000) return `${Math.floor(diffMs / 60_000)}m ago`;
  if (diffMs < 24 * 60 * 60_000) return `${Math.floor(diffMs / (60 * 60_000))}h ago`;
  return `${Math.floor(diffMs / (24 * 60 * 60_000))}d ago`;
}

/** Map, PVP overlay and PVP hub all poll this endpoint; calls inside this window share one response. */
export const WORLD_PLAYERS_CACHE_TTL_MS = 4_000;

let worldPlayersInFlight: Promise<WorldMapPlayer[]> | null = null;
let worldPlayersFetchedAt = 0;

export function refreshWorldPlayers(options: { force?: boolean } = {}): Promise<WorldMapPlayer[]> {
  if (!isSupabaseConfigured()) {
    cachedWorldPlayers = [];
    return Promise.resolve(cachedWorldPlayers);
  }

  if (worldPlayersInFlight) return worldPlayersInFlight;
  if (!options.force && worldPlayersFetchedAt > 0 && Date.now() - worldPlayersFetchedAt < WORLD_PLAYERS_CACHE_TTL_MS) {
    return Promise.resolve(cachedWorldPlayers);
  }

  worldPlayersInFlight = fetchWorldPlayers().finally(() => {
    worldPlayersFetchedAt = Date.now();
    worldPlayersInFlight = null;
  });
  return worldPlayersInFlight;
}

async function fetchWorldPlayers(): Promise<WorldMapPlayer[]> {
  try {
    const response = await fetch('/api/world/players', { cache: 'no-store' });
    if (!response.ok) return cachedWorldPlayers;

    const payload = await response.json() as {
      ok?: boolean;
      data?: { players?: Array<WorldMapPlayer & { updated_at?: string }> };
    };

    cachedWorldPlayers = (payload.data?.players || []).map(player => ({
      ...player,
      selectedModel: Number(player.selectedModel || 3),
      level: Number(player.level || 1),
      updatedAt: player.updatedAt || player.updated_at,
    }));
    return cachedWorldPlayers;
  } catch {
    return cachedWorldPlayers;
  }
}
