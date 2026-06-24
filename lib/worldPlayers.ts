import type { User } from '@/lib/auth';
import { isSupabaseConfigured } from '@/lib/supabase/config';

export interface WorldMapPlayer {
  userId: string;
  username: string;
  x: number;
  y: number;
  selectedModel: number;
  level: number;
}

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

export async function refreshWorldPlayers(): Promise<WorldMapPlayer[]> {
  if (!isSupabaseConfigured()) {
    cachedWorldPlayers = [];
    return cachedWorldPlayers;
  }

  try {
    const response = await fetch('/api/world/players', { cache: 'no-store' });
    if (!response.ok) return cachedWorldPlayers;

    const payload = await response.json() as {
      ok?: boolean;
      data?: { players?: WorldMapPlayer[] };
    };

    cachedWorldPlayers = payload.data?.players || [];
    return cachedWorldPlayers;
  } catch {
    return cachedWorldPlayers;
  }
}
